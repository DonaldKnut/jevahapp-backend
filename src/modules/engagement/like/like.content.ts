import { Types, ClientSession } from "mongoose";
import { Media } from "../../../models/media.model";
import { User } from "../../../models/user.model";
import { Like } from "../../../models/like.model";
import { Interaction } from "../../../models/interaction.model";
import logger from "../../../utils/logger";
import {
  getUserLikeState,
  setUserLikeState,
  getPostCounter,
  setPostCounter,
  incrPostCounter,
  clampCount,
} from "../../../lib/redisCounters";
import { setFeedUserLikeFlag } from "../../../service/media/feedUserFlags";
import { LikeToggleResult } from "../shared/engagement.types";
import { toLikeContentType, verifyContentExists } from "../shared/contentType.resolver";
import { getLikeCountFromDB } from "./like.counts";
import { emitLikeSocket, fireLikeNotifications } from "./like.sideEffects";
import { LikeOperationError } from "./like.errors";
import { invalidateContentMetadataCache } from "../metadata/metadata.cache";

const CONTENT_TYPES = ["media", "artist", "merch"] as const;
type ContentType = (typeof CONTENT_TYPES)[number];

function resultShape(
  contentId: string,
  contentType: string,
  liked: boolean,
  likeCount: number,
  likeId?: string
): LikeToggleResult {
  return {
    contentId,
    contentType,
    liked,
    likeCount: clampCount(likeCount),
    updatedAt: new Date().toISOString(),
    ...(likeId ? { likeId } : {}),
  };
}

async function refreshLikeCaches(params: {
  userId: string;
  contentId: string;
  contentType: ContentType;
  liked: boolean;
  likeCount: number;
}): Promise<void> {
  const { userId, contentId, contentType, liked, likeCount } = params;
  // No feed-cache invalidation: counts + flags are overlaid at read time.
  await Promise.all([
    setPostCounter({
      postId: contentId,
      field: "likes",
      count: likeCount,
      contentType,
    }),
    setUserLikeState({ userId, contentId, liked, contentType }),
    contentType === "media"
      ? setFeedUserLikeFlag(userId, contentId, liked)
      : Promise.resolve(),
    invalidateContentMetadataCache(contentId, contentType, userId),
  ]);
}

export const contentLikeService = {
  isSupported(normalized: string): normalized is ContentType {
    return (CONTENT_TYPES as readonly string[]).includes(normalized);
  },

  /** Legacy Redis-first path — not used for canonical HTTP Media likes */
  async toggleFast(
    userId: string,
    contentId: string,
    normalized: ContentType
  ): Promise<LikeToggleResult> {
    let currentTotal = await getPostCounter({
      postId: contentId,
      field: "likes",
      contentType: normalized,
    });
    if (currentTotal === null) {
      currentTotal = await getLikeCountFromDB(contentId, normalized);
      await setPostCounter({
        postId: contentId,
        field: "likes",
        count: currentTotal,
        contentType: normalized,
      });
    }

    let currentLiked = await getUserLikeState({
      userId,
      contentId,
      contentType: normalized,
    });
    if (currentLiked === null) {
      currentLiked = await contentLikeService.hasUserLiked(userId, contentId, normalized);
      setUserLikeState({
        userId,
        contentId,
        liked: currentLiked,
        contentType: normalized,
      });
    }

    const newLiked = !currentLiked;
    setUserLikeState({
      userId,
      contentId,
      liked: newLiked,
      contentType: normalized,
    });

    const delta = newLiked ? 1 : -1;
    const likeCount = clampCount(
      await incrPostCounter({
        postId: contentId,
        field: "likes",
        delta,
        contentType: normalized,
      })
    );
    emitLikeSocket(contentId, normalized, likeCount, newLiked, userId);
    return resultShape(contentId, normalized, newLiked, likeCount);
  },

  async toggleDb(
    userId: string,
    contentId: string,
    normalized: ContentType
  ): Promise<LikeToggleResult> {
    // Existence check outside the transaction — clear 404 before mutation
    const exists = await verifyContentExists(contentId, normalized);
    if (!exists) {
      throw new LikeOperationError(
        "CONTENT_NOT_FOUND",
        `Content not found: ${normalized} with ID ${contentId}`,
        404,
        { contentId, contentType: normalized }
      );
    }

    try {
      return await contentLikeService.toggleDbWithTransaction(userId, contentId, normalized);
    } catch (error: any) {
      if (
        error.message?.includes("Transaction numbers are only allowed") ||
        error.message?.includes("replica set")
      ) {
        logger.warn("Like toggle falling back without transaction", {
          contentId,
          userId,
          contentType: normalized,
        });
        return contentLikeService.toggleDbWithoutTransaction(userId, contentId, normalized);
      }
      throw error;
    }
  },

  async toggleDbWithTransaction(
    userId: string,
    contentId: string,
    normalized: ContentType
  ): Promise<LikeToggleResult> {
    const session = await Media.startSession();
    try {
      let liked = false;
      await session.withTransaction(async () => {
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

      return finalizeToggle(userId, contentId, normalized, liked);
    } finally {
      session.endSession();
    }
  },

  async toggleDbWithoutTransaction(
    userId: string,
    contentId: string,
    normalized: ContentType
  ): Promise<LikeToggleResult> {
    let liked = false;
    switch (normalized) {
      case "media":
        liked = await toggleMediaLike(userId, contentId);
        break;
      case "artist":
        liked = await toggleArtistFollow(userId, contentId);
        break;
      case "merch":
        liked = await toggleMerchLike(userId, contentId);
        break;
    }
    return finalizeToggle(userId, contentId, normalized, liked);
  },

  async hasUserLiked(userId: string, contentId: string, normalized: ContentType): Promise<boolean> {
    switch (normalized) {
      case "media": {
        // Durable source of truth is Mongo; Redis is post-commit cache only
        const like = await Like.findOne({
          userId: new Types.ObjectId(userId),
          contentId: new Types.ObjectId(contentId),
          contentType: "media",
        })
          .select("_id")
          .lean();
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
        })
          .select("_id")
          .lean();
        if (like) return true;
        const legacy = await Interaction.findOne({
          user: new Types.ObjectId(userId),
          media: new Types.ObjectId(contentId),
          interactionType: "favorite",
          isRemoved: { $ne: true },
        })
          .select("_id")
          .lean();
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

async function finalizeToggle(
  userId: string,
  contentId: string,
  normalized: ContentType,
  liked: boolean
): Promise<LikeToggleResult> {
  const likeCount = clampCount(await getLikeCountFromDB(contentId, normalized));

  let likeId: string | undefined;
  if (liked && (normalized === "media" || normalized === "merch")) {
    const row = (await Like.findOne({
      userId: new Types.ObjectId(userId),
      contentId: new Types.ObjectId(contentId),
      contentType: normalized,
    })
      .select("_id")
      .lean()) as { _id?: { toString(): string } } | null;
    likeId = row?._id?.toString();
  }

  await refreshLikeCaches({
    userId,
    contentId,
    contentType: normalized,
    liked,
    likeCount,
  }).catch(err => {
    logger.warn("Like cache refresh failed after commit", {
      error: (err as Error).message,
      userId,
      contentId,
      contentType: normalized,
    });
  });

  emitLikeSocket(contentId, normalized, likeCount, liked, userId);
  fireLikeNotifications(userId, contentId, normalized, liked, likeId);

  return resultShape(contentId, normalized, liked, likeCount, likeId);
}

async function toggleMediaLike(
  userId: string,
  contentId: string,
  session?: ClientSession
): Promise<boolean> {
  const userObjId = new Types.ObjectId(userId);
  const contentObjId = new Types.ObjectId(contentId);
  const query = Like.findOne({
    userId: userObjId,
    contentId: contentObjId,
    contentType: "media",
  });
  if (session) query.session(session);
  const existing = await query;

  if (existing) {
    const del = Like.findByIdAndDelete(existing._id);
    if (session) del.session(session);
    await del;
    await Media.findByIdAndUpdate(
      contentId,
      [{ $set: { likeCount: { $max: [0, { $subtract: [{ $ifNull: ["$likeCount", 0] }, 1] }] } } }],
      session ? { session } : undefined
    );
    return false;
  }

  try {
    if (session) {
      await Like.create(
        [{ userId: userObjId, contentId: contentObjId, contentType: "media" }],
        { session }
      );
      await Media.findByIdAndUpdate(contentId, { $inc: { likeCount: 1 } }, { session });
    } else {
      await Like.create({
        userId: userObjId,
        contentId: contentObjId,
        contentType: "media",
      });
      await Media.findByIdAndUpdate(contentId, { $inc: { likeCount: 1 } });
    }
    return true;
  } catch (error: any) {
    if (error.code === 11000) return true;
    throw error;
  }
}

async function toggleMerchLike(
  userId: string,
  contentId: string,
  session?: ClientSession
): Promise<boolean> {
  const userObjId = new Types.ObjectId(userId);
  const contentObjId = new Types.ObjectId(contentId);
  const query = Like.findOne({
    userId: userObjId,
    contentId: contentObjId,
    contentType: "merch",
  });
  if (session) query.session(session);
  const existing = await query;

  if (existing) {
    const del = Like.findByIdAndDelete(existing._id);
    if (session) del.session(session);
    await del;
    await Media.findByIdAndUpdate(
      contentId,
      [
        {
          $set: {
            likeCount: { $max: [0, { $subtract: [{ $ifNull: ["$likeCount", 0] }, 1] }] },
            favoriteCount: {
              $max: [0, { $subtract: [{ $ifNull: ["$favoriteCount", 0] }, 1] }],
            },
          },
        },
      ],
      session ? { session } : undefined
    );
    await Interaction.updateMany(
      { user: userObjId, media: contentObjId, interactionType: "favorite" },
      { isRemoved: true },
      session ? { session } : undefined
    );
    return false;
  }

  try {
    if (session) {
      await Like.create(
        [{ userId: userObjId, contentId: contentObjId, contentType: "merch" }],
        { session }
      );
    } else {
      await Like.create({
        userId: userObjId,
        contentId: contentObjId,
        contentType: "merch",
      });
    }
  } catch (error: any) {
    if (error.code === 11000) return true;
    throw error;
  }

  if (session) {
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
  } else {
    await Media.findByIdAndUpdate(contentId, { $inc: { likeCount: 1, favoriteCount: 1 } });
    await Interaction.updateMany(
      { user: userObjId, media: contentObjId, interactionType: "favorite" },
      { isRemoved: true }
    );
  }
  return true;
}

async function toggleArtistFollow(
  userId: string,
  contentId: string,
  session?: ClientSession
): Promise<boolean> {
  const followerQuery = User.findById(userId);
  const artistQuery = User.findById(contentId);
  if (session) {
    followerQuery.session(session);
    artistQuery.session(session);
  }
  const follower = await followerQuery;
  const artist = await artistQuery;
  if (!follower || !artist) {
    throw new LikeOperationError(
      "CONTENT_NOT_FOUND",
      "User or artist not found",
      404,
      { contentId, contentType: "artist" }
    );
  }

  const contentObjId = new Types.ObjectId(contentId);
  const isFollowing = follower.following?.some((id: Types.ObjectId) => id.equals(contentObjId));

  if (isFollowing) {
    await User.findByIdAndUpdate(
      userId,
      { $pull: { following: contentObjId } },
      session ? { session } : undefined
    );
    await User.findByIdAndUpdate(
      contentId,
      {
        $pull: { followers: new Types.ObjectId(userId) },
        $inc: { "artistProfile.followerCount": -1 },
      },
      session ? { session } : undefined
    );
    return false;
  }

  await User.findByIdAndUpdate(
    userId,
    { $addToSet: { following: contentObjId } },
    session ? { session } : undefined
  );
  await User.findByIdAndUpdate(
    contentId,
    {
      $addToSet: { followers: new Types.ObjectId(userId) },
      $inc: { "artistProfile.followerCount": 1 },
    },
    session ? { session } : undefined
  );
  return true;
}
