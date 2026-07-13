import { Types, ClientSession } from "mongoose";
import { Media } from "../../../models/media.model";
import { User } from "../../../models/user.model";
import { Like } from "../../../models/like.model";
import { Interaction } from "../../../models/interaction.model";
import {
  getUserLikeState,
  setUserLikeState,
  getPostCounter,
  setPostCounter,
  incrPostCounter,
  clampCount,
} from "../../../lib/redisCounters";
import { LikeToggleResult } from "../shared/engagement.types";
import { toLikeContentType, verifyContentExists } from "../shared/contentType.resolver";
import { getLikeCountFromDB } from "./like.counts";
import { emitLikeSocket, invalidateFeedCaches, fireLikeNotifications } from "./like.sideEffects";

const CONTENT_TYPES = ["media", "artist", "merch"] as const;
type ContentType = (typeof CONTENT_TYPES)[number];

export const contentLikeService = {
  isSupported(normalized: string): normalized is ContentType {
    return (CONTENT_TYPES as readonly string[]).includes(normalized);
  },

  async toggleFast(
    userId: string,
    contentId: string,
    normalized: ContentType
  ): Promise<LikeToggleResult> {
    let currentTotal = await getPostCounter({ postId: contentId, field: "likes" });
    if (currentTotal === null) {
      currentTotal = await getLikeCountFromDB(contentId, normalized);
      await setPostCounter({ postId: contentId, field: "likes", count: currentTotal });
    }

    let currentLiked = await getUserLikeState({ userId, contentId });
    if (currentLiked === null) {
      currentLiked = await contentLikeService.hasUserLiked(userId, contentId, normalized);
      setUserLikeState({ userId, contentId, liked: currentLiked });
    }

    const newLiked = !currentLiked;
    setUserLikeState({ userId, contentId, liked: newLiked });

    const delta = newLiked ? 1 : -1;
    const likeCount = clampCount(await incrPostCounter({ postId: contentId, field: "likes", delta }));
    emitLikeSocket(contentId, normalized, likeCount, newLiked, userId);
    return { contentId, liked: newLiked, likeCount };
  },

  async toggleDb(
    userId: string,
    contentId: string,
    normalized: ContentType
  ): Promise<LikeToggleResult> {
    const session = await Media.startSession();
    try {
      let liked = false;
      await session.withTransaction(async () => {
        const exists = await verifyContentExists(contentId, normalized, session);
        if (!exists) throw new Error(`Content not found: ${normalized} with ID ${contentId}`);

        switch (normalized) {
          case "media":
            liked = await toggleMediaLike(userId, contentId, session);
            break;
          case "artist":
            liked = await toggleArtistFollow(userId, contentId, session);
            break;
          case "merch":
            liked = await toggleMerchLike(userId, contentId, session);
            break;
        }
      });

      const likeCount = await getLikeCountFromDB(contentId, normalized);
      setPostCounter({ postId: contentId, field: "likes", count: likeCount }).catch(() => {});
      invalidateFeedCaches(contentId, userId).catch(() => {});
      fireLikeNotifications(userId, contentId, normalized, liked);
      return { contentId, liked, likeCount };
    } finally {
      session.endSession();
    }
  },

  async hasUserLiked(userId: string, contentId: string, normalized: ContentType): Promise<boolean> {
    switch (normalized) {
      case "media": {
        const redisLiked = await getUserLikeState({ userId, contentId });
        if (redisLiked === true) return true;
        if (redisLiked === false) return false;
        const like = await Like.findOne({
          userId: new Types.ObjectId(userId),
          contentId: new Types.ObjectId(contentId),
        });
        return !!like;
      }
      case "artist": {
        const artist = await User.findById(userId).select("following").lean();
        return (
          (artist as any)?.following?.some((id: any) => id.toString() === contentId) || false
        );
      }
      case "merch": {
        const like = await Like.findOne({
          userId: new Types.ObjectId(userId),
          contentId: new Types.ObjectId(contentId),
          contentType: "merch",
        });
        if (like) return true;
        const legacy = await Interaction.findOne({
          user: new Types.ObjectId(userId),
          media: new Types.ObjectId(contentId),
          interactionType: "favorite",
          isRemoved: { $ne: true },
        });
        return !!legacy;
      }
    }
  },

  async getContentLikers(contentId: string, contentType: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const likeType = toLikeContentType(contentType === "merch" ? "merch" : contentType);

    const likes = await Like.find({
      contentId: new Types.ObjectId(contentId),
      contentType: likeType,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "firstName lastName avatar email")
      .lean();

    const total = await Like.countDocuments({
      contentId: new Types.ObjectId(contentId),
      contentType: likeType,
    });

    const items = likes.map((like: any) => {
      const user = like.userId;
      const name = user
        ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email
        : "Unknown";
      return {
        userId: user?._id?.toString() || "",
        username: name,
        avatarUrl: user?.avatar || null,
        likedAt: like.createdAt,
      };
    });

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },
};

async function toggleMediaLike(
  userId: string,
  contentId: string,
  session: ClientSession
): Promise<boolean> {
  const userObjId = new Types.ObjectId(userId);
  const contentObjId = new Types.ObjectId(contentId);
  const existing = await Like.findOne({ userId: userObjId, contentId: contentObjId }).session(
    session
  );

  if (existing) {
    await Like.findByIdAndDelete(existing._id).session(session);
    await Media.findByIdAndUpdate(
      contentId,
      [{ $set: { likeCount: { $max: [0, { $subtract: [{ $ifNull: ["$likeCount", 0] }, 1] }] } } }],
      { session }
    );
    return false;
  }

  try {
    await Like.create(
      [{ userId: userObjId, contentId: contentObjId, contentType: "media" }],
      { session }
    );
    await Media.findByIdAndUpdate(contentId, { $inc: { likeCount: 1 } }, { session });
    return true;
  } catch (error: any) {
    if (error.code === 11000) return true;
    throw error;
  }
}

async function toggleMerchLike(
  userId: string,
  contentId: string,
  session: ClientSession
): Promise<boolean> {
  const userObjId = new Types.ObjectId(userId);
  const contentObjId = new Types.ObjectId(contentId);
  const existing = await Like.findOne({
    userId: userObjId,
    contentId: contentObjId,
    contentType: "merch",
  }).session(session);

  if (existing) {
    await Like.findByIdAndDelete(existing._id).session(session);
    await Media.findByIdAndUpdate(
      contentId,
      [
        {
          $set: {
            likeCount: { $max: [0, { $subtract: [{ $ifNull: ["$likeCount", 0] }, 1] }] },
            favoriteCount: { $max: [0, { $subtract: [{ $ifNull: ["$favoriteCount", 0] }, 1] }] },
          },
        },
      ],
      { session }
    );
    await Interaction.updateMany(
      { user: userObjId, media: contentObjId, interactionType: "favorite" },
      { isRemoved: true },
      { session }
    );
    return false;
  }

  await Like.create(
    [{ userId: userObjId, contentId: contentObjId, contentType: "merch" }],
    { session }
  );
  await Media.findByIdAndUpdate(
    contentId,
    { $inc: { likeCount: 1, favoriteCount: 1 } },
    { session }
  );
  await Interaction.updateMany(
    { user: userObjId, media: contentObjId, interactionType: "favorite" },
    { isRemoved: true },
    { session }
  );
  return true;
}

async function toggleArtistFollow(
  userId: string,
  contentId: string,
  session: ClientSession
): Promise<boolean> {
  const follower = await User.findById(userId).session(session);
  const artist = await User.findById(contentId).session(session);
  if (!follower || !artist) throw new Error("User or artist not found");

  const contentObjId = new Types.ObjectId(contentId);
  const isFollowing = follower.following?.some((id: Types.ObjectId) => id.equals(contentObjId));

  if (isFollowing) {
    await User.findByIdAndUpdate(userId, { $pull: { following: contentObjId } }, { session });
    await User.findByIdAndUpdate(
      contentId,
      { $pull: { followers: new Types.ObjectId(userId) }, $inc: { "artistProfile.followerCount": -1 } },
      { session }
    );
    return false;
  }

  await User.findByIdAndUpdate(
    userId,
    { $push: { following: contentObjId } },
    { session }
  );
  await User.findByIdAndUpdate(
    contentId,
    { $push: { followers: new Types.ObjectId(userId) }, $inc: { "artistProfile.followerCount": 1 } },
    { session }
  );
  return true;
}
