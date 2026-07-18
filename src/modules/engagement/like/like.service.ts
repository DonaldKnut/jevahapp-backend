import { Types } from "mongoose";
import { LikeContentType } from "../../../models/like.model";
import { LikeToggleResult } from "../shared/engagement.types";
import { normalizeContentType } from "../shared/contentType.resolver";
import {
  getPostCounter,
  setPostCounter,
  clampCount,
} from "../../../lib/redisCounters";
import { CopyrightFreeSongInteractionService } from "../../../service/copyrightFreeSongInteraction.service";
import { devotionalService } from "../../../service/devotionals.service";
import { contentLikeService } from "./like.content";
import { communityLikeService } from "./like.community";
import { getLikeCountFromDB } from "./like.counts";
import { LikeOperationError } from "./like.errors";

const audioLikeService = new CopyrightFreeSongInteractionService();
const COMMUNITY_TYPES: LikeContentType[] = ["prayer", "forum_post", "forum_comment"];

function withMeta(
  contentId: string,
  contentType: string,
  liked: boolean,
  likeCount: number
): LikeToggleResult {
  return {
    contentId,
    contentType,
    liked,
    likeCount: clampCount(likeCount),
    updatedAt: new Date().toISOString(),
  };
}

export class LikeService {
  /**
   * Legacy Redis-first path for community / transitional callers.
   * Canonical HTTP Media likes must use {@link toggleLike}.
   */
  async toggleLikeFast(
    userId: string,
    contentId: string,
    contentType: string
  ): Promise<LikeToggleResult> {
    const normalized = normalizeContentType(contentType);

    if (normalized === "devotional") {
      const result = await devotionalService.likeDevotional({
        userId,
        devotionalId: contentId,
      });
      return withMeta(contentId, "devotional", result.liked, result.likeCount);
    }
    if (contentType === "copyright_free_song") {
      const result = await audioLikeService.toggleLike(userId, contentId);
      return withMeta(contentId, "copyright_free_song", result.liked, result.likeCount);
    }
    if (COMMUNITY_TYPES.includes(contentType as LikeContentType)) {
      return communityLikeService.toggleFast(userId, contentId, contentType as LikeContentType);
    }
    if (!contentLikeService.isSupported(normalized)) {
      throw new LikeOperationError(
        "INVALID_CONTENT_TYPE",
        `Unsupported content type: ${contentType}`,
        400,
        { contentType }
      );
    }
    return contentLikeService.toggleFast(userId, contentId, normalized);
  }

  /**
   * Durable like toggle — awaits Mongo commit before returning.
   * Source of truth for canonical POST /api/content/:type/:id/like.
   */
  async toggleLike(
    userId: string,
    contentId: string,
    contentType: string
  ): Promise<LikeToggleResult> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(contentId)) {
      throw new LikeOperationError(
        "INVALID_CONTENT_ID",
        "Invalid user or content ID",
        400,
        { contentId }
      );
    }

    const normalized = normalizeContentType(contentType);

    // Exact "devotional" uses Devotional collection; feed aliases never map here
    if ((contentType || "").trim().toLowerCase() === "devotional") {
      const result = await devotionalService.likeDevotional({
        userId,
        devotionalId: contentId,
      });
      return withMeta(contentId, "devotional", result.liked, result.likeCount);
    }

    if (contentType === "copyright_free_song") {
      const result = await audioLikeService.toggleLike(userId, contentId);
      return withMeta(contentId, "copyright_free_song", result.liked, result.likeCount);
    }
    if (COMMUNITY_TYPES.includes(contentType as LikeContentType)) {
      return communityLikeService.toggle(userId, contentId, contentType as LikeContentType);
    }
    if (!contentLikeService.isSupported(normalized)) {
      throw new LikeOperationError(
        "INVALID_CONTENT_TYPE",
        `Unsupported content type: ${contentType}`,
        400,
        { contentType }
      );
    }
    return contentLikeService.toggleDb(userId, contentId, normalized);
  }

  async hasUserLiked(userId: string, contentId: string, contentType: string): Promise<boolean> {
    if (!userId || !Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(contentId)) {
      return false;
    }

    const raw = (contentType || "").trim().toLowerCase();
    if (raw === "devotional") {
      return devotionalService.hasUserLikedDevotional(userId, contentId);
    }

    const normalized = normalizeContentType(contentType);
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
    const normalized = normalizeContentType(contentType);
    const redisCount = await getPostCounter({
      postId: contentId,
      field: "likes",
      contentType: normalized,
    });
    if (redisCount !== null) return redisCount;

    const dbCount = await getLikeCountFromDB(contentId, contentType);
    if (dbCount > 0) {
      setPostCounter({
        postId: contentId,
        field: "likes",
        count: dbCount,
        contentType: normalized,
      }).catch(() => {});
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
