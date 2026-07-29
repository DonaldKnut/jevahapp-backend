import { Types } from "mongoose";
import { Media } from "../../../models/media.model";
import { Devotional } from "../../../models/devotional.model";
import { NotificationService } from "../../../service/notification.service";
import mentionDetectionService from "../../../service/mentionDetection.service";
import logger from "../../../utils/logger";
import { CommentErrors } from "./comment.errors";

export async function assertContentExists(
  contentId: string,
  normalized: string
): Promise<void> {
  if (normalized === "media") {
    const exists = await Media.findById(contentId).select("_id").lean();
    if (!exists) throw CommentErrors.contentNotFound();
  } else if (normalized === "devotional") {
    const exists = await Devotional.findById(contentId).select("_id").lean();
    if (!exists) throw CommentErrors.contentNotFound();
  }
}

/** Notify newly mentioned users only (create + edit). */
export function notifyMentions(input: {
  userId: string;
  contentId: string;
  contentType: string;
  commentId: string;
  text: string;
  imageUrl?: string;
  mentions: Array<{ userId: Types.ObjectId; displayName?: string }>;
}): void {
  const { userId, contentId, contentType, commentId, text, imageUrl, mentions } =
    input;
  const notifySnippet = text || (imageUrl ? "[image]" : "");
  if (!mentions.length) return;

  for (const m of mentions) {
    const mentionedUserId = m.userId.toString();
    if (mentionedUserId === userId) continue;
    void NotificationService.notifyContentMention(
      userId,
      mentionedUserId,
      contentId,
      contentType,
      notifySnippet
    ).catch((err: any) => {
      logger.warn("Failed to send structured mention notification", {
        error: err?.message,
        commentId,
        mentionedUserId,
      });
    });
  }
}

/** Fire-and-forget notifications after a comment is persisted. */
export function notifyAfterCommentCreate(input: {
  userId: string;
  contentId: string;
  contentType: string;
  commentId: string;
  text: string;
  imageUrl?: string;
  parentCommentId?: string;
  mentions: Array<{ userId: Types.ObjectId; displayName?: string }>;
}): void {
  const {
    userId,
    contentId,
    contentType,
    commentId,
    text,
    imageUrl,
    parentCommentId,
    mentions,
  } = input;
  const notifySnippet = text || (imageUrl ? "[image]" : "");

  Promise.resolve(
    NotificationService.notifyContentComment(
      userId,
      contentId,
      contentType,
      notifySnippet,
      commentId
    )
  ).catch((err: Error) => {
    logger.warn("Failed to send comment notification", {
      error: err.message,
      commentId,
    });
  });

  if (mentions.length) {
    notifyMentions({
      userId,
      contentId,
      contentType,
      commentId,
      text,
      imageUrl,
      mentions,
    });
  } else if (text) {
    void mentionDetectionService
      .detectAndNotifyMentions(userId, contentId, contentType, text)
      .catch((err: any) => {
        logger.warn("Failed to send mention notifications", {
          error: err?.message,
          commentId,
        });
      });
  }

  if (parentCommentId && Types.ObjectId.isValid(parentCommentId)) {
    Promise.resolve(
      NotificationService.notifyCommentReply(
        userId,
        parentCommentId,
        contentId,
        contentType,
        notifySnippet,
        commentId
      )
    ).catch((err: Error) => {
      logger.warn("Failed to send reply notification", {
        error: err.message,
        commentId,
        parentCommentId,
      });
    });
  }
}
