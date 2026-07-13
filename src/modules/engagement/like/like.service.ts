import { Types } from "mongoose";
import { LikeContentType } from "../../../models/like.model";
import { LikeToggleResult } from "../shared/engagement.types";
import { normalizeContentType } from "../shared/contentType.resolver";
import {
  getPostCounter,
  setPostCounter,
} from "../../../lib/redisCounters";
import { CopyrightFreeSongInteractionService } from "../../../service/copyrightFreeSongInteraction.service";
import { CopyrightFreeSong } from "../../../models/copyrightFreeSong.model";
import { devotionalService } from "../../../service/devotionals.service";
import { contentLikeService } from "./like.content";
import { communityLikeService } from "./like.community";
import { getLikeCountFromDB } from "./like.counts";

const audioLikeService = new CopyrightFreeSongInteractionService();
const COMMUNITY_TYPES: LikeContentType[] = ["prayer", "forum_post", "forum_comment"];

export class LikeService {
  async toggleLikeFast(
    userId: string,
    contentId: string,
    contentType: string
  ): Promise<LikeToggleResult> {
    const normalized = normalizeContentType(contentType);

    if (normalized === "devotional") {
      throw new Error("Use POST /api/devotionals/:id/like for devotional likes");
    }
    if (contentType === "copyright_free_song") {
      const result = await audioLikeService.toggleLike(userId, contentId);
      return { contentId, liked: result.liked, likeCount: result.likeCount };
    }
    if (COMMUNITY_TYPES.includes(contentType as LikeContentType)) {
      return communityLikeService.toggleFast(userId, contentId, contentType as LikeContentType);
    }
    if (!contentLikeService.isSupported(normalized)) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }
    return contentLikeService.toggleFast(userId, contentId, normalized);
  }

  async toggleLike(
    userId: string,
    contentId: string,
    contentType: string
  ): Promise<LikeToggleResult> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(contentId)) {
      throw new Error("Invalid user or content ID");
    }

    const normalized = normalizeContentType(contentType);

    if (normalized === "devotional") {
      const result = await devotionalService.likeDevotional({ userId, devotionalId: contentId });
      return { contentId, liked: result.liked, likeCount: result.likeCount };
    }
    if (contentType === "copyright_free_song") {
      // Fast path already toggled — read current state (avoids double-toggle)
      const liked = await audioLikeService.isLiked(userId, contentId);
      const song = await CopyrightFreeSong.findById(contentId).select("likeCount").lean();
      return { contentId, liked, likeCount: (song as any)?.likeCount ?? 0 };
    }
    if (COMMUNITY_TYPES.includes(contentType as LikeContentType)) {
      return communityLikeService.toggle(userId, contentId, contentType as LikeContentType);
    }
    if (!contentLikeService.isSupported(normalized)) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }
    return contentLikeService.toggleDb(userId, contentId, normalized);
  }

  async hasUserLiked(userId: string, contentId: string, contentType: string): Promise<boolean> {
    if (!userId || !Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(contentId)) {
      return false;
    }

    const normalized = normalizeContentType(contentType);
    if (normalized === "devotional") return devotionalService.hasUserLikedDevotional(userId, contentId);
    if (contentType === "copyright_free_song") return audioLikeService.isLiked(userId, contentId);
    if (COMMUNITY_TYPES.includes(contentType as LikeContentType)) {
      return communityLikeService.hasUserLiked(userId, contentId, contentType as LikeContentType);
    }
    if (contentLikeService.isSupported(normalized)) {
      return contentLikeService.hasUserLiked(userId, contentId, normalized);
    }
    return false;
  }

  async getLikeCount(contentId: string, contentType: string): Promise<number> {
    const redisCount = await getPostCounter({ postId: contentId, field: "likes" });
    if (redisCount !== null) return redisCount;

    const dbCount = await getLikeCountFromDB(contentId, contentType);
    if (dbCount > 0) {
      setPostCounter({ postId: contentId, field: "likes", count: dbCount }).catch(() => {});
    }
    return dbCount;
  }

  getLikeCountFromDB = getLikeCountFromDB;

  getContentLikers(
    contentId: string,
    contentType: string,
    page: number,
    limit: number
  ) {
    return contentLikeService.getContentLikers(contentId, contentType, page, limit);
  }
}

export default new LikeService();
