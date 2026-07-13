import { Types } from "mongoose";
import { Like } from "../../../models/like.model";
import { Interaction } from "../../../models/interaction.model";
import {
  getUserLikeState,
  setUserLikeState,
  setPostCounter,
  incrPostCounter,
  clampCount,
} from "../../../lib/redisCounters";
import { redisRateLimit } from "../../../lib/redisRateLimit";
import { LikeContentType } from "../../../models/like.model";
import { LikeToggleResult } from "../shared/engagement.types";
import { verifyContentExists } from "../shared/contentType.resolver";
import { ForumPost } from "../../../models/forumPost.model";
import { PrayerPost } from "../../../models/prayerPost.model";
import { getLikeCountFromDB } from "./like.counts";

export const communityLikeService = {
  async toggleFast(
    userId: string,
    contentId: string,
    contentType: LikeContentType
  ): Promise<LikeToggleResult> {
    const rl = await redisRateLimit({
      key: `rl:like:${userId}:${contentId}`,
      limit: 10,
      windowSeconds: 30,
    });
    if (!rl.allowed) throw new Error("Too many like requests. Please slow down.");

    let currentLiked = await getUserLikeState({ userId, contentId });
    if (currentLiked === null) {
      currentLiked = await communityLikeService.hasUserLiked(userId, contentId, contentType);
      setUserLikeState({ userId, contentId, liked: currentLiked });
    }

    const newLiked = !currentLiked;
    setUserLikeState({ userId, contentId, liked: newLiked });

    const delta = newLiked ? 1 : -1;
    const likeCount = clampCount(await incrPostCounter({ postId: contentId, field: "likes", delta }));
    return { contentId, liked: newLiked, likeCount };
  },

  async toggle(
    userId: string,
    contentId: string,
    contentType: LikeContentType
  ): Promise<LikeToggleResult> {
    const exists = await verifyContentExists(contentId, contentType);
    if (!exists) throw new Error(`Content not found: ${contentType}`);

    const userObjId = new Types.ObjectId(userId);
    const contentObjId = new Types.ObjectId(contentId);
    const existing = await Like.findOne({ userId: userObjId, contentId: contentObjId });
    let liked: boolean;

    if (existing) {
      await Like.findByIdAndDelete(existing._id);
      liked = false;
      await adjustCount(contentId, contentType, -1);
    } else {
      await Like.create({ userId: userObjId, contentId: contentObjId, contentType });
      liked = true;
      await adjustCount(contentId, contentType, 1);
      await Interaction.deleteMany({
        user: userObjId,
        media: contentObjId,
        interactionType: "like",
      });
    }

    const likeCount = await getLikeCountFromDB(contentId, contentType);
    setPostCounter({ postId: contentId, field: "likes", count: likeCount }).catch(() => {});
    return { contentId, liked, likeCount };
  },

  async hasUserLiked(
    userId: string,
    contentId: string,
    contentType: LikeContentType
  ): Promise<boolean> {
    const like = await Like.findOne({
      userId: new Types.ObjectId(userId),
      contentId: new Types.ObjectId(contentId),
      contentType,
    });
    if (like) return true;

    const legacy = await Interaction.findOne({
      user: new Types.ObjectId(userId),
      media: new Types.ObjectId(contentId),
      interactionType: "like",
    });
    return !!legacy;
  },
};

async function adjustCount(
  contentId: string,
  contentType: LikeContentType,
  delta: number
): Promise<void> {
  if (contentType === "prayer") {
    const prayer = await PrayerPost.findById(contentId);
    if (prayer) {
      prayer.likesCount = Math.max(0, (prayer.likesCount || 0) + delta);
      await prayer.save();
    }
  } else if (contentType === "forum_post") {
    const post = await ForumPost.findById(contentId);
    if (post) {
      post.likesCount = Math.max(0, (post.likesCount || 0) + delta);
      await post.save();
    }
  }
  incrPostCounter({ postId: contentId, field: "likes", delta }).catch(() => {});
}
