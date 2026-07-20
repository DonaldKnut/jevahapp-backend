import { Types, ClientSession } from "mongoose";
import { Media } from "../../../models/media.model";
import { Devotional } from "../../../models/devotional.model";
import { normalizeContentType } from "../shared/contentType.resolver";
import { commentRepository } from "./comment.repository";
import { sanitizeCommentContent, formatComment, applyIsLiked } from "./comment.formatter";
import { publishEngagementEvent } from "../../../lib/engagementEvents";
import { NotificationService } from "../../../service/notification.service";
import { setPostCounter } from "../../../lib/redisCounters";
import { bumpCommentsVersion } from "./comment.version";
import { emitCommentRoomEvents } from "./comment.realtime";
import logger from "../../../utils/logger";
import mentionDetectionService from "../../../service/mentionDetection.service";

const FLOOR_COMMENT = [
  {
    $set: {
      commentCount: {
        $max: [0, { $subtract: [{ $ifNull: ["$commentCount", 0] }, 1] }],
      },
    },
  },
];

async function bumpCommentCount(
  contentId: string,
  contentType: string,
  delta: number,
  session?: ClientSession
) {
  const normalized = normalizeContentType(contentType);
  const opts = session ? { session } : {};
  if (delta < 0) {
    if (normalized === "media") {
      await Media.findByIdAndUpdate(contentId, FLOOR_COMMENT, opts);
    } else if (normalized === "devotional") {
      await Devotional.findByIdAndUpdate(contentId, FLOOR_COMMENT, opts);
    }
    return;
  }
  if (normalized === "media") {
    await Media.findByIdAndUpdate(contentId, { $inc: { commentCount: delta } }, opts);
  } else if (normalized === "devotional") {
    await Devotional.findByIdAndUpdate(contentId, { $inc: { commentCount: delta } }, opts);
  }
}

export class CommentService {
  async addComment(
    userId: string,
    contentId: string,
    contentType: string,
    content: string,
    parentCommentId?: string
  ) {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(contentId)) {
      throw new Error("Invalid user or content ID");
    }
    if (!content?.trim()) throw new Error("Comment content is required");

    const normalized = normalizeContentType(contentType);
    if (!["media", "devotional"].includes(normalized)) {
      throw new Error(`Comments not supported for content type: ${contentType}`);
    }

    const session = await Media.startSession();
    try {
      const { text } = sanitizeCommentContent(content);
      const created = await session.withTransaction(async () => {
        const data: any = {
          user: new Types.ObjectId(userId),
          media: new Types.ObjectId(contentId),
          content: text,
        };
        if (parentCommentId && Types.ObjectId.isValid(parentCommentId)) {
          data.parentCommentId = new Types.ObjectId(parentCommentId);
        }
        const doc = await commentRepository.create(data, session);
        await bumpCommentCount(contentId, contentType, 1, session);
        if (data.parentCommentId) {
          await commentRepository.incrementReplyCount(data.parentCommentId, session);
        }
        return doc;
      });

      const commentId = created._id.toString();
      publishEngagementEvent("comment.created", {
        userId,
        contentId,
        contentType: normalized,
        commentId,
        parentCommentId,
      });

      bumpCommentsVersion(contentId);

      const populated = await commentRepository
        .findById(commentId)
        .populate("user", "firstName lastName avatar")
        .lean();
      const formatted = formatComment(populated);

      let likeCount = 0;
      let shareCount = 0;
      let viewCount = 0;
      let commentCount = 0;
      let ownerUserId: string | undefined;
      let contentTitle: string | undefined;
      if (normalized === "media") {
        const media = await Media.findById(contentId)
          .select("likeCount shareCount viewCount commentCount uploadedBy title")
          .lean();
        likeCount = (media as any)?.likeCount || 0;
        shareCount = (media as any)?.shareCount || 0;
        viewCount = (media as any)?.viewCount || 0;
        commentCount = (media as any)?.commentCount || 0;
        ownerUserId = (media as any)?.uploadedBy?.toString?.();
        contentTitle = (media as any)?.title;
      } else if (normalized === "devotional") {
        const d = await Devotional.findById(contentId)
          .select("likeCount shareCount viewCount commentCount submittedBy title")
          .lean();
        likeCount = (d as any)?.likeCount || 0;
        shareCount = (d as any)?.shareCount || 0;
        viewCount = (d as any)?.viewCount || 0;
        commentCount = (d as any)?.commentCount || 0;
        ownerUserId = (d as any)?.submittedBy?.toString?.();
        contentTitle = (d as any)?.title;
      }

      // Refresh Redis comment counter so cached feeds overlay the new count
      // (no feed-cache invalidation needed). setPostCounter never rejects.
      void setPostCounter({
        postId: contentId,
        field: "comments",
        count: commentCount,
      });

      emitCommentRoomEvents({
        contentId,
        contentType: normalized,
        comment: formatted,
        commentCount,
        likeCount,
        shareCount,
        viewCount,
        ownerUserId,
        actorUserId: userId,
        contentTitle,
      });

      Promise.resolve(
        NotificationService.notifyContentComment(
          userId,
          contentId,
          normalized,
          text,
          commentId
        )
      ).catch((err) => {
        logger.warn("Failed to send comment notification", {
          error: (err as Error).message,
          commentId,
        });
      });

      void mentionDetectionService
        .detectAndNotifyMentions(userId, contentId, normalized, text)
        .catch((err: any) => {
          logger.warn("Failed to send mention notifications", {
            error: err?.message,
            commentId,
          });
        });

      if (parentCommentId && Types.ObjectId.isValid(parentCommentId)) {
        Promise.resolve(
          NotificationService.notifyCommentReply(
            userId,
            parentCommentId,
            contentId,
            normalized,
            text,
            commentId
          )
        ).catch((err) => {
          logger.warn("Failed to send reply notification", {
            error: (err as Error).message,
            commentId,
            parentCommentId,
          });
        });
      }

      return formatted;
    } finally {
      session.endSession();
    }
  }

  async getContentComments(
    contentId: string,
    contentType: string,
    page = 1,
    limit = 20,
    sortBy: "newest" | "oldest" | "top" = "newest",
    userId?: string
  ) {
    if (!Types.ObjectId.isValid(contentId)) throw new Error("Invalid content ID");
    const normalized = normalizeContentType(contentType);
    if (!["media", "devotional"].includes(normalized)) {
      throw new Error("Comments not supported for this content type");
    }

    const skip = (page - 1) * limit;
    const sort = sortBy === "oldest" ? "createdAt" : "-createdAt";
    const rows =
      sortBy === "top"
        ? await commentRepository.findTopByScore(contentId, skip, limit)
        : await commentRepository.findTopLevel(contentId, skip, limit, sort);

    const replyMap = await commentRepository.findRepliesForParents(
      rows.map((c: any) => c._id)
    );
    const withReplies = rows.map((c: any) => {
      const formatted = formatComment(c);
      formatted.replies = (replyMap.get(c._id.toString()) || []).map(formatComment);
      return applyIsLiked(formatted, userId);
    });

    const [topLevel, replies] = await commentRepository.countForContent(contentId);
    const total = topLevel + replies;

    return {
      comments: withReplies,
      total,
      totalComments: total,
      hasMore: page * limit < topLevel,
      page,
      limit,
    };
  }

  async toggleCommentReaction(commentId: string, userId: string, reactionType = "like") {
    if (!Types.ObjectId.isValid(commentId) || !Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid comment or user ID");
    }
    const comment = await commentRepository.findComment(commentId);
    if (!comment) throw new Error("Comment not found");

    let reactions: Map<string, Types.ObjectId[]> =
      comment.reactions instanceof Map
        ? comment.reactions
        : new Map(Object.entries(comment.reactions || {}));

    const arr = reactions.get(reactionType) || [];
    const uid = userId.toString();
    const has = arr.some((id: Types.ObjectId) => id.toString() === uid);
    reactions.set(
      reactionType,
      has ? arr.filter((id: Types.ObjectId) => id.toString() !== uid) : [...arr, new Types.ObjectId(userId)]
    );
    comment.reactions = reactions as any;
    await commentRepository.save(comment);
    bumpCommentsVersion(comment.media?.toString());

    const totalLikes = (reactions.get("like") || []).length;
    return { liked: !has, totalLikes };
  }

  async getCommentReplies(commentId: string, page = 1, limit = 20) {
    if (!Types.ObjectId.isValid(commentId)) throw new Error("Invalid comment ID");
    const skip = (page - 1) * limit;
    const [replies, total] = await commentRepository.findRepliesPaginated(commentId, skip, limit);
    return {
      replies,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async editContentComment(commentId: string, userId: string, newContent: string) {
    if (!Types.ObjectId.isValid(commentId) || !Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid comment or user ID");
    }
    if (!newContent?.trim()) throw new Error("Comment content is required");

    const comment = await commentRepository.findComment(commentId);
    if (!comment || comment.user.toString() !== userId) {
      throw new Error("Comment not found or you don't have permission to edit it");
    }

    const { text } = sanitizeCommentContent(newContent);
    await commentRepository.updateContent(commentId, text);
    bumpCommentsVersion(comment.media?.toString());
    const updated = await commentRepository
      .findById(commentId)
      .populate("user", "firstName lastName avatar")
      .lean();
    return formatComment(updated);
  }

  async reportContentComment(commentId: string, userId: string, _reason?: string) {
    if (!Types.ObjectId.isValid(commentId) || !Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid comment or user ID");
    }

    const commentDoc = await commentRepository
      .findById(commentId)
      ?.populate("user", "firstName lastName email")
      .populate("media", "title contentType uploadedBy");

    if (!commentDoc || commentDoc.interactionType !== "comment") {
      throw new Error("Comment not found");
    }
    if (commentDoc.user?.toString() === userId) {
      throw new Error("You cannot report your own comment");
    }
    if (commentDoc.reportedBy?.some((id: Types.ObjectId) => id.toString() === userId)) {
      throw new Error("You have already reported this comment");
    }

    const update = await commentRepository.report(commentId, userId);
    if (!update) throw new Error("Failed to update comment report");

    const author = commentDoc.user as any;
    const media = commentDoc.media as any;
    return {
      reportCount: update.reportCount || 0,
      comment: {
        id: commentId,
        content: commentDoc.content || "",
        authorId: author?._id?.toString() || "",
        authorName: `${author?.firstName || ""} ${author?.lastName || ""}`.trim() || author?.email,
        authorEmail: author?.email || "Unknown",
        createdAt: commentDoc.createdAt,
      },
      media: {
        id: media?._id?.toString() || commentDoc.media?.toString(),
        title: media?.title || "Unknown Media",
        contentType: media?.contentType || "unknown",
        uploaderEmail: "Unknown",
      },
    };
  }

  async removeContentComment(commentId: string, userId: string) {
    if (!Types.ObjectId.isValid(commentId) || !Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid comment or user ID");
    }

    const comment = await commentRepository.findComment(commentId);
    if (!comment || comment.user.toString() !== userId) {
      throw new Error("Comment not found or you don't have permission to delete it");
    }

    const contentId = comment.media?.toString();
    const session = await Media.startSession();
    try {
      await session.withTransaction(async () => {
        await commentRepository.softDelete(commentId, session);
        if (contentId) {
          await bumpCommentCount(contentId, "media", -1, session);
        }
        if (comment.parentCommentId) {
          await commentRepository.decrementReplyCount(comment.parentCommentId, session);
        }
      });
    } catch (error: any) {
      if (
        error.message?.includes("Transaction numbers are only allowed") ||
        error.message?.includes("replica set")
      ) {
        await commentRepository.softDelete(commentId);
        if (contentId) {
          await bumpCommentCount(contentId, "media", -1);
        }
        if (comment.parentCommentId) {
          await commentRepository.decrementReplyCount(comment.parentCommentId);
        }
      } else {
        throw error;
      }
    } finally {
      session.endSession();
    }

    if (contentId) {
      bumpCommentsVersion(contentId);
      // Refresh Redis comment counter from Mongo so cached feeds overlay
      // the decremented count.
      void (async () => {
        const m = await Media.findById(contentId).select("commentCount").lean();
        await setPostCounter({
          postId: contentId,
          field: "comments",
          count: (m as any)?.commentCount || 0,
        });
      })().catch(() => {});
    }

    publishEngagementEvent("comment.removed", {
      userId,
      commentId,
      contentId,
    });
  }

  async moderateHideComment(commentId: string, moderatorId: string, reason?: string) {
    if (!Types.ObjectId.isValid(commentId) || !Types.ObjectId.isValid(moderatorId)) {
      throw new Error("Invalid comment or user ID");
    }
    const updated = await commentRepository.hide(commentId, moderatorId, reason);
    if (!updated) throw new Error("Comment not found");
    bumpCommentsVersion((updated as any).media?.toString());
  }

  async moderateUnhideComment(commentId: string) {
    if (!Types.ObjectId.isValid(commentId)) {
      throw new Error("Invalid comment ID");
    }
    const comment = await commentRepository.findComment(commentId);
    if (!comment) throw new Error("Comment not found");
    const updated = await commentRepository.unhide(commentId);
    if (!updated) throw new Error("Comment not found");
    bumpCommentsVersion(comment.media?.toString());
  }

  async dismissCommentReports(commentId: string) {
    if (!Types.ObjectId.isValid(commentId)) {
      throw new Error("Invalid comment ID");
    }
    const comment = await commentRepository.findComment(commentId);
    if (!comment) throw new Error("Comment not found");
    const updated = await commentRepository.dismissReports(commentId);
    if (!updated) throw new Error("Comment not found");
    return { commentId, reportCount: 0 };
  }

  async listReportedComments(options: {
    page?: number;
    limit?: number;
    hidden?: boolean;
  }) {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 20, 100);
    const skip = (page - 1) * limit;
    const { comments, total } = await commentRepository.listReported({
      skip,
      limit,
      hidden: options.hidden,
    });
    return {
      comments: comments.map((c: any) => ({
        id: c._id.toString(),
        content: c.content,
        reportCount: c.reportCount || 0,
        isHidden: !!c.isHidden,
        hiddenReason: c.hiddenReason || null,
        hiddenBy: c.hiddenBy
          ? {
              id: c.hiddenBy._id?.toString?.() || c.hiddenBy.toString(),
              name:
                `${c.hiddenBy.firstName || ""} ${c.hiddenBy.lastName || ""}`.trim() ||
                c.hiddenBy.username,
            }
          : null,
        author: c.user
          ? {
              id: c.user._id?.toString?.() || c.user.toString(),
              firstName: c.user.firstName,
              lastName: c.user.lastName,
              username: c.user.username,
              email: c.user.email,
              avatar: c.user.avatar,
            }
          : null,
        media: c.media
          ? {
              id: c.media._id?.toString?.() || c.media.toString(),
              title: c.media.title,
              contentType: c.media.contentType,
              thumbnailUrl: c.media.thumbnailUrl,
            }
          : null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }
}

export default new CommentService();
