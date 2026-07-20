import logger from "../../../utils/logger";

export interface CommentRoomPayload {
  contentId: string;
  contentType: string;
  comment: any;
  commentCount?: number;
  likeCount?: number;
  shareCount?: number;
  viewCount?: number;
  /** Content owner user id — receives private new-comment-notification */
  ownerUserId?: string;
  /** Comment author user id — skipped for self-notify */
  actorUserId?: string;
  contentTitle?: string;
}

/**
 * Fan-out a committed comment to content + legacy media rooms.
 * Safe no-op when Socket.IO is not initialized.
 */
export function emitCommentRoomEvents(params: CommentRoomPayload): void {
  try {
    const io = require("../../../socket/socketManager").getIO();
    if (!io) return;

    const {
      contentId,
      contentType,
      comment,
      commentCount,
      likeCount = 0,
      shareCount = 0,
      viewCount = 0,
      ownerUserId,
      actorUserId,
      contentTitle,
    } = params;

    const contentRoom = `content:${contentType}:${contentId}`;
    const commentData = {
      id: comment.id || comment._id,
      _id: comment._id || comment.id,
      content: comment.content,
      user: comment.user,
      createdAt: comment.createdAt,
      parentCommentId: comment.parentCommentId,
      contentType,
      contentId,
      likesCount: comment.likesCount ?? 0,
      replyCount: comment.replyCount ?? 0,
    };

    io.to(contentRoom).emit("content-comment", commentData);
    io.to(contentRoom).emit("new-comment", comment);
    io.to(contentRoom).emit("count-update", {
      contentId,
      contentType,
      likeCount,
      commentCount: commentCount ?? 0,
      shareCount,
      viewCount,
    });

    if (contentType === "media") {
      const mediaRoom = `media:${contentId}`;
      io.to(mediaRoom).emit("new-comment", comment);
      io.to(mediaRoom).emit("content-comment", commentData);
      io.to(mediaRoom).emit("count-update", {
        contentId,
        contentType,
        likeCount,
        commentCount: commentCount ?? 0,
        shareCount,
        viewCount,
      });
    }

    if (ownerUserId && actorUserId && ownerUserId !== actorUserId) {
      io.to(`user:${ownerUserId}`).emit("new-comment-notification", {
        contentId,
        contentType,
        contentTitle,
        comment: commentData,
        commenter: comment.user,
        commentCount: commentCount ?? 0,
      });
    }
  } catch (err) {
    logger.warn("Failed to emit comment room events", {
      error: (err as Error).message,
      contentId: params.contentId,
    });
  }
}
