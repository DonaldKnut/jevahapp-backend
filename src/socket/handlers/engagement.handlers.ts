import { Media } from "../../models/media.model";
import { Interaction } from "../../models/interaction.model";
import { MediaUserAction } from "../../models/mediaUserAction.model";
import logger from "../../utils/logger";
import likeService from "../../modules/engagement/like/like.service";
import commentService from "../../modules/engagement/comments/comment.service";
import {
  AuthenticatedUser,
  CommentData,
  ReactionData,
  SocketContext,
} from "../types";
import { getContentById } from "../helpers";

export async function handleNewComment(
  ctx: SocketContext,
  socket: any,
  user: AuthenticatedUser,
  data: CommentData
): Promise<void> {
  try {
    const { mediaId, content, parentCommentId } = data;
    const media = await Media.findById(mediaId);
    if (!media) {
      socket.emit("error", { message: "Media not found" });
      return;
    }

    const comment = await Interaction.create({
      user: user.userId,
      media: mediaId,
      interactionType: "comment",
      content,
      parentCommentId,
    });

    const commentData = {
      id: comment._id,
      content: comment.content,
      user: {
        id: user.userId,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      createdAt: comment.createdAt,
      parentCommentId,
    };

    ctx.io.to(`media:${mediaId}`).emit("new-comment", commentData);
    logger.info("New comment created", {
      userId: user.userId,
      mediaId,
      commentId: comment._id,
    });
  } catch (error) {
    logger.error("Error creating comment", { error: (error as Error).message });
    socket.emit("error", { message: "Failed to create comment" });
  }
}

export async function handleCommentReaction(
  ctx: SocketContext,
  socket: any,
  user: AuthenticatedUser,
  data: { commentId: string; reaction: string }
): Promise<void> {
  try {
    const { commentId, reaction } = data;
    const reactionType = reaction || "like";

    const result = await commentService.toggleCommentReaction(
      commentId,
      user.userId,
      reactionType
    );

    const comment = await Interaction.findById(commentId).select("media").lean();
    const mediaId = comment && !Array.isArray(comment) ? (comment as any).media : null;
    if (mediaId) {
      ctx.io.to(`media:${mediaId}`).emit("comment-reaction", {
        commentId,
        reaction: reactionType,
        liked: result.liked,
        count: result.totalLikes,
      });
    }

    logger.info("Comment reaction added", { userId: user.userId, commentId, reaction });
  } catch (error) {
    logger.error("Error adding comment reaction", { error: (error as Error).message });
    socket.emit("error", { message: "Failed to add reaction" });
  }
}

export async function handleMediaReaction(
  ctx: SocketContext,
  socket: any,
  user: AuthenticatedUser,
  data: ReactionData
): Promise<void> {
  try {
    const { mediaId, actionType } = data;

    if (actionType === "like") {
      const result = await likeService.toggleLikeFast(user.userId, mediaId, "media");
      likeService.toggleLike(user.userId, mediaId, "media").catch(err => {
        logger.error("Socket background like sync failed", { error: err.message, mediaId });
      });

      ctx.io.to(`media:${mediaId}`).emit("media-reaction", {
        mediaId,
        actionType: "like",
        liked: result.liked,
        count: result.likeCount,
      });
    } else {
      await MediaUserAction.findOneAndUpdate(
        { user: user.userId, media: mediaId, actionType },
        { isRemoved: false },
        { upsert: true, new: true }
      );

      const media = await Media.findByIdAndUpdate(
        mediaId,
        { $inc: { [`${actionType}Count`]: 1 } },
        { new: true }
      );

      if (media) {
        ctx.io.to(`media:${mediaId}`).emit("media-reaction", {
          mediaId,
          actionType,
          count: media[`${actionType}Count`],
        });
      }
    }

    logger.info("Media reaction added", { userId: user.userId, mediaId, actionType });
  } catch (error) {
    logger.error("Error adding media reaction", { error: (error as Error).message });
    socket.emit("error", { message: "Failed to add reaction" });
  }
}

export async function handleContentReaction(
  ctx: SocketContext,
  socket: any,
  user: AuthenticatedUser,
  data: { contentId: string; contentType: string; actionType: string }
): Promise<void> {
  try {
    const { contentId, contentType, actionType } = data;

    if (actionType === "like") {
      const result = await likeService.toggleLikeFast(
        user.userId,
        contentId,
        contentType
      );
      likeService.toggleLike(user.userId, contentId, contentType).catch(err => {
        logger.error("Socket background like sync failed", {
          error: err.message,
          contentId,
          contentType,
        });
      });

      const content = await getContentById(contentId, contentType);

      ctx.io
        .to(`content:${contentType}:${contentId}`)
        .emit("content-reaction", {
          contentId,
          contentType,
          actionType: "like",
          liked: result.liked,
          count: result.likeCount,
          user: {
            id: user.userId,
            firstName: user.firstName,
            lastName: user.lastName,
          },
        });

      ctx.io.to(`content:${contentType}:${contentId}`).emit("count-update", {
        contentId,
        contentType,
        likeCount: content?.likeCount || 0,
        commentCount: content?.commentCount || 0,
        shareCount: content?.shareCount || 0,
        viewCount: content?.viewCount || 0,
      });

      if (content?.uploadedBy && content.uploadedBy.toString() !== user.userId) {
        ctx.io.to(`user:${content.uploadedBy}`).emit("new-like-notification", {
          contentId,
          contentType,
          contentTitle: content.title,
          liker: {
            id: user.userId,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          likeCount: result.likeCount,
        });
      }
    }

    logger.info("Content reaction added", {
      userId: user.userId,
      contentId,
      contentType,
      actionType,
    });
  } catch (error) {
    logger.error("Error adding content reaction", { error: (error as Error).message });
    socket.emit("error", { message: "Failed to add reaction" });
  }
}

export async function handleContentComment(
  ctx: SocketContext,
  socket: any,
  user: AuthenticatedUser,
  data: {
    contentId: string;
    contentType: string;
    content: string;
    parentCommentId?: string;
  }
): Promise<void> {
  try {
    const { contentId, contentType, content: commentContent, parentCommentId } = data;

    const comment = await commentService.addComment(
      user.userId,
      contentId,
      contentType,
      commentContent,
      parentCommentId
    );

    const commentData = {
      id: comment.id || comment._id,
      content: comment.content,
      user: {
        id: user.userId,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      createdAt: comment.createdAt,
      parentCommentId,
      contentType,
    };

    const content = await getContentById(contentId, contentType);

    ctx.io.to(`content:${contentType}:${contentId}`).emit("content-comment", commentData);
    ctx.io.to(`content:${contentType}:${contentId}`).emit("count-update", {
      contentId,
      contentType,
      likeCount: content?.likeCount || 0,
      commentCount: content?.commentCount || 0,
      shareCount: content?.shareCount || 0,
      viewCount: content?.viewCount || 0,
    });

    if (content?.uploadedBy && content.uploadedBy.toString() !== user.userId) {
      ctx.io.to(`user:${content.uploadedBy}`).emit("new-comment-notification", {
        contentId,
        contentType,
        contentTitle: content.title,
        comment: commentData,
        commenter: {
          id: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        commentCount: content?.commentCount || 0,
      });
    }

    logger.info("Content comment created", {
      userId: user.userId,
      contentId,
      contentType,
      commentId: comment._id,
    });
  } catch (error) {
    logger.error("Error creating content comment", { error: (error as Error).message });
    socket.emit("error", { message: "Failed to create comment" });
  }
}

export function handleTypingStart(
  socket: any,
  user: AuthenticatedUser,
  mediaId: string
): void {
  socket.to(`media:${mediaId}`).emit("user-typing", {
    userId: user.userId,
    firstName: user.firstName,
    isTyping: true,
  });
}

export function handleTypingStop(
  socket: any,
  user: AuthenticatedUser,
  mediaId: string
): void {
  socket.to(`media:${mediaId}`).emit("user-typing", {
    userId: user.userId,
    firstName: user.firstName,
    isTyping: false,
  });
}

export function handleUserPresence(
  socket: any,
  user: AuthenticatedUser,
  status: string
): void {
  socket.broadcast.emit("user-presence", { userId: user.userId, status });
}
