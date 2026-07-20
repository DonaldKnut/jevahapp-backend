import { Media } from "../../models/media.model";
import { Interaction } from "../../models/interaction.model";
import { MediaUserAction } from "../../models/mediaUserAction.model";
import logger from "../../utils/logger";
import likeService from "../../modules/engagement/like/like.service";
import commentService from "../../modules/engagement/comments/comment.service";
import { checkCommentRateLimit } from "../../modules/engagement/comments/comment.rateLimit";
import { normalizeContentType } from "../../modules/engagement/shared/contentType.resolver";
import {
  AuthenticatedUser,
  CommentData,
  ReactionData,
  SocketContext,
} from "../types";
import { getContentById } from "../helpers";

const TYPING_TTL_MS = Number(process.env.TYPING_TTL_MS || 3000);
/** key → timeout that auto-clears stuck typing indicators */
const typingTimers = new Map<string, NodeJS.Timeout>();

type TypingTarget =
  | { kind: "media"; mediaId: string; rooms: string[] }
  | { kind: "content"; contentId: string; contentType: string; rooms: string[] };

function resolveTypingTarget(
  data: string | { mediaId?: string; contentId?: string; contentType?: string }
): TypingTarget | null {
  if (typeof data === "string" && data.trim()) {
    const mediaId = data.trim();
    return {
      kind: "media",
      mediaId,
      rooms: [`media:${mediaId}`, `content:media:${mediaId}`],
    };
  }
  if (data && typeof data === "object") {
    if (data.mediaId) {
      const mediaId = String(data.mediaId);
      return {
        kind: "media",
        mediaId,
        rooms: [`media:${mediaId}`, `content:media:${mediaId}`],
      };
    }
    if (data.contentId && data.contentType) {
      const contentId = String(data.contentId);
      const contentType = normalizeContentType(String(data.contentType));
      const rooms = [`content:${contentType}:${contentId}`];
      if (contentType === "media") {
        rooms.push(`media:${contentId}`);
      }
      return { kind: "content", contentId, contentType, rooms };
    }
  }
  return null;
}

function typingKey(userId: string, target: TypingTarget): string {
  if (target.kind === "media") return `${userId}:media:${target.mediaId}`;
  return `${userId}:content:${target.contentType}:${target.contentId}`;
}

function clearTypingTimer(key: string): void {
  const existing = typingTimers.get(key);
  if (existing) {
    clearTimeout(existing);
    typingTimers.delete(key);
  }
}

function emitTyping(
  socket: any,
  user: AuthenticatedUser,
  rooms: string[],
  isTyping: boolean
): void {
  const payload = {
    userId: user.userId,
    firstName: user.firstName,
    isTyping,
  };
  for (const room of rooms) {
    socket.to(room).emit("user-typing", payload);
  }
}

export async function handleNewComment(
  ctx: SocketContext,
  socket: any,
  user: AuthenticatedUser,
  data: CommentData
): Promise<void> {
  try {
    const { mediaId, content, parentCommentId } = data;
    const rl = await checkCommentRateLimit({
      userId: user.userId,
      contentType: "media",
      contentId: mediaId,
    });
    if (!rl.allowed) {
      socket.emit("error", {
        message: "Too many comments. Please wait a moment.",
        code: "COMMENT_RATE_LIMITED",
        retryAfterSeconds: rl.retryAfterSeconds,
      });
      return;
    }

    const media = await Media.findById(mediaId).select("_id").lean();
    if (!media) {
      socket.emit("error", { message: "Media not found" });
      return;
    }

    // Canonical comment service handles Mongo + room fan-out + notifications
    const comment = await commentService.addComment(
      user.userId,
      mediaId,
      "media",
      content,
      parentCommentId
    );

    socket.emit("comment-created", comment);
    logger.info("New comment created", {
      userId: user.userId,
      mediaId,
      commentId: comment.id || comment._id,
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
      const result = await likeService.toggleLike(user.userId, mediaId, "media");

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
      const result = await likeService.toggleLike(user.userId, contentId, contentType);

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
    const normalized = normalizeContentType(contentType);

    const rl = await checkCommentRateLimit({
      userId: user.userId,
      contentType: normalized,
      contentId,
    });
    if (!rl.allowed) {
      socket.emit("error", {
        message: "Too many comments. Please wait a moment.",
        code: "COMMENT_RATE_LIMITED",
        retryAfterSeconds: rl.retryAfterSeconds,
      });
      return;
    }

    const comment = await commentService.addComment(
      user.userId,
      contentId,
      contentType,
      commentContent,
      parentCommentId
    );

    socket.emit("comment-created", comment);

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
  data: string | { mediaId?: string; contentId?: string; contentType?: string }
): void {
  const target = resolveTypingTarget(data);
  if (!target) return;

  const key = typingKey(user.userId, target);
  clearTypingTimer(key);
  emitTyping(socket, user, target.rooms, true);

  const timer = setTimeout(() => {
    typingTimers.delete(key);
    emitTyping(socket, user, target.rooms, false);
  }, TYPING_TTL_MS);
  timer.unref?.();
  typingTimers.set(key, timer);
}

export function handleTypingStop(
  socket: any,
  user: AuthenticatedUser,
  data: string | { mediaId?: string; contentId?: string; contentType?: string }
): void {
  const target = resolveTypingTarget(data);
  if (!target) return;

  clearTypingTimer(typingKey(user.userId, target));
  emitTyping(socket, user, target.rooms, false);
}

/** Test helper — clears TTL map between unit tests */
export function _resetTypingTimersForTests(): void {
  for (const t of typingTimers.values()) clearTimeout(t);
  typingTimers.clear();
}

export function handleUserPresence(
  socket: any,
  user: AuthenticatedUser,
  status: string
): void {
  socket.broadcast.emit("user-presence", { userId: user.userId, status });
}
