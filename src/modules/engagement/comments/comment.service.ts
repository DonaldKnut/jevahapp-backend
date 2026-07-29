import { Types } from "mongoose";
import { Media } from "../../../models/media.model";
import { Devotional } from "../../../models/devotional.model";
import { assertCommentableContentType } from "../shared/contentType.resolver";
import { commentRepository } from "./comment.repository";
import { formatComment } from "./comment.formatter";
import { publishEngagementEvent } from "../../../lib/engagementEvents";
import { setPostCounter } from "../../../lib/redisCounters";
import { bumpCommentsVersion } from "./comment.version";
import logger from "../../../utils/logger";
import { bumpCommentCount } from "./comment.counters";
import {
  createComment,
  AddCommentOptions,
} from "./comment.create";
import { editComment, EditCommentOptions } from "./comment.edit";
import { CommentErrors } from "./comment.errors";
import { persistHealedCommentImageUrls } from "./comment.heal";
import { deleteCommentImageFromR2, healAvatarUrl } from "./comment.media";

export type { AddCommentOptions, EditCommentOptions };

export class CommentService {
  /** Create comment (text / mentions / image). Delegates to comment.create. */
  async addComment(
    userId: string,
    contentId: string,
    contentType: string,
    content: string,
    parentCommentId?: string,
    options: AddCommentOptions = {}
  ) {
    return createComment(
      userId,
      contentId,
      contentType,
      content,
      parentCommentId,
      options
    );
  }

  async getContentComments(
    contentId: string,
    contentType: string,
    page = 1,
    limit = 20,
    sortBy: "newest" | "oldest" | "top" = "newest",
    userId?: string
  ) {
    if (!Types.ObjectId.isValid(contentId)) throw CommentErrors.invalidIds();
    const normalized = assertCommentableContentType(contentType);

    if (normalized === "media") {
      const exists = await Media.findById(contentId).select("_id").lean();
      if (!exists) throw CommentErrors.contentNotFound();
    } else if (normalized === "devotional") {
      const exists = await Devotional.findById(contentId).select("_id").lean();
      if (!exists) throw CommentErrors.contentNotFound();
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

    const allDocs: any[] = [...rows];
    for (const replies of replyMap.values()) {
      allDocs.push(...replies);
    }
    persistHealedCommentImageUrls(allDocs);

    const withReplies = rows.map((c: any) => {
      const replyDocs = replyMap.get(c._id.toString()) || [];
      const formatted = formatComment(c, userId);
      formatted.replies = replyDocs.map((r: any) => formatComment(r, userId));
      return formatted;
    });

    const [topLevel, replies] = await commentRepository.countForContent(contentId);
    const total = topLevel + replies;

    void this.healCommentCount(contentId, normalized, total);

    return {
      comments: withReplies,
      total,
      totalComments: total,
      hasMore: page * limit < topLevel,
      page,
      limit,
    };
  }

  private async healCommentCount(
    contentId: string,
    normalized: string,
    actualTotal: number
  ): Promise<void> {
    try {
      if (normalized === "media") {
        const media = await Media.findById(contentId).select("commentCount").lean();
        const baked = Number((media as any)?.commentCount || 0);
        if (baked !== actualTotal) {
          await Media.findByIdAndUpdate(contentId, { $set: { commentCount: actualTotal } });
          void setPostCounter({
            postId: contentId,
            field: "comments",
            count: actualTotal,
          });
        }
      } else if (normalized === "devotional") {
        const d = await Devotional.findById(contentId).select("commentCount").lean();
        const baked = Number((d as any)?.commentCount || 0);
        if (baked !== actualTotal) {
          await Devotional.findByIdAndUpdate(contentId, {
            $set: { commentCount: actualTotal },
          });
        }
      }
    } catch (err: any) {
      logger.warn("Failed to heal commentCount", {
        contentId,
        error: err?.message,
      });
    }
  }

  async toggleCommentReaction(commentId: string, userId: string, reactionType = "like") {
    if (!Types.ObjectId.isValid(commentId) || !Types.ObjectId.isValid(userId)) {
      throw CommentErrors.invalidIds();
    }
    const comment = await commentRepository.findComment(commentId);
    if (!comment) throw CommentErrors.commentNotFound();

    let reactions: Map<string, Types.ObjectId[]> =
      comment.reactions instanceof Map
        ? comment.reactions
        : new Map(Object.entries(comment.reactions || {}));

    const arr = reactions.get(reactionType) || [];
    const uid = userId.toString();
    const has = arr.some((id: Types.ObjectId) => id.toString() === uid);
    reactions.set(
      reactionType,
      has
        ? arr.filter((id: Types.ObjectId) => id.toString() !== uid)
        : [...arr, new Types.ObjectId(userId)]
    );
    comment.reactions = reactions as any;
    await commentRepository.save(comment);
    bumpCommentsVersion(comment.media?.toString());

    const totalLikes = (reactions.get("like") || []).length;
    return { liked: !has, totalLikes };
  }

  async getCommentReplies(commentId: string, page = 1, limit = 20) {
    if (!Types.ObjectId.isValid(commentId)) throw CommentErrors.invalidCommentId();
    const skip = (page - 1) * limit;
    const [replies, total] = await commentRepository.findRepliesPaginated(
      commentId,
      skip,
      limit
    );
    return {
      replies,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async editContentComment(
    commentId: string,
    userId: string,
    newContent: string | EditCommentOptions,
    options?: EditCommentOptions
  ) {
    if (typeof newContent === "string") {
      return editComment(commentId, userId, {
        content: newContent,
        ...options,
      });
    }
    return editComment(commentId, userId, newContent);
  }

  async reportContentComment(commentId: string, userId: string, _reason?: string) {
    if (!Types.ObjectId.isValid(commentId) || !Types.ObjectId.isValid(userId)) {
      throw CommentErrors.invalidIds();
    }

    const commentDoc = await commentRepository
      .findById(commentId)
      ?.populate("user", "firstName lastName email")
      .populate("media", "title contentType uploadedBy");

    if (!commentDoc || commentDoc.interactionType !== "comment") {
      throw CommentErrors.commentNotFound();
    }
    if (commentDoc.user?.toString() === userId) {
      throw CommentErrors.cannotReportOwn();
    }
    if (commentDoc.reportedBy?.some((id: Types.ObjectId) => id.toString() === userId)) {
      throw CommentErrors.alreadyReported();
    }

    const update = await commentRepository.report(commentId, userId);
    if (!update) throw CommentErrors.commentNotFound();

    const author = commentDoc.user as any;
    const media = commentDoc.media as any;
    return {
      reportCount: update.reportCount || 0,
      comment: {
        id: commentId,
        content: commentDoc.content || "",
        authorId: author?._id?.toString() || "",
        authorName:
          `${author?.firstName || ""} ${author?.lastName || ""}`.trim() ||
          author?.email,
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
      throw CommentErrors.invalidIds();
    }

    const comment = await commentRepository.findComment(commentId);
    if (!comment || comment.user.toString() !== userId) {
      throw CommentErrors.forbidden();
    }

    const contentId = comment.media?.toString();
    const imageUrl = comment.imageUrl || null;
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

    void deleteCommentImageFromR2(imageUrl);

    if (contentId) {
      bumpCommentsVersion(contentId);
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
      throw CommentErrors.invalidIds();
    }
    const updated = await commentRepository.hide(commentId, moderatorId, reason);
    if (!updated) throw CommentErrors.commentNotFound();
    bumpCommentsVersion((updated as any).media?.toString());
  }

  async moderateUnhideComment(commentId: string) {
    if (!Types.ObjectId.isValid(commentId)) {
      throw CommentErrors.invalidCommentId();
    }
    const comment = await commentRepository.findComment(commentId);
    if (!comment) throw CommentErrors.commentNotFound();
    const updated = await commentRepository.unhide(commentId);
    if (!updated) throw CommentErrors.commentNotFound();
    bumpCommentsVersion(comment.media?.toString());
  }

  async dismissCommentReports(commentId: string) {
    if (!Types.ObjectId.isValid(commentId)) {
      throw CommentErrors.invalidCommentId();
    }
    const comment = await commentRepository.findComment(commentId);
    if (!comment) throw CommentErrors.commentNotFound();
    const updated = await commentRepository.dismissReports(commentId);
    if (!updated) throw CommentErrors.commentNotFound();
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
              avatar: healAvatarUrl(c.user.avatar),
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
