import { Types } from "mongoose";
import { Interaction } from "../../../models/interaction.model";
import { sanitizeCommentContent, formatComment } from "./comment.formatter";
import { emitCommentRoomEvents } from "./comment.realtime";
import { publishEngagementEvent } from "../../../lib/engagementEvents";
import { CommentErrors } from "./comment.errors";
import logger from "../../../utils/logger";

export type CommunityContentKind = "prayer" | "forum";

export interface AddCommunityCommentInput {
  userId: string;
  contentId: string;
  contentKind: CommunityContentKind;
  content: string;
  parentCommentId?: string;
  /** Called after Interaction insert to bump domain-specific counters */
  bumpCount: () => Promise<number | void>;
}

/**
 * Shared write boundary for prayer/forum comments:
 * sanitize → Mongo Interaction → counter bump → room fan-out → analytics event.
 * Domain-specific post models stay outside this helper.
 */
export async function addCommunityComment(input: AddCommunityCommentInput) {
  const { userId, contentId, contentKind, content, parentCommentId, bumpCount } =
    input;

  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(contentId)) {
    throw CommentErrors.invalidIds();
  }
  if (!content?.trim()) {
    throw CommentErrors.contentRequired();
  }

  const { text } = sanitizeCommentContent(content);
  const data: Record<string, unknown> = {
    user: new Types.ObjectId(userId),
    media: new Types.ObjectId(contentId),
    interactionType: "comment",
    content: text,
    lastInteraction: new Date(),
    count: 1,
    isRemoved: false,
  };

  if (parentCommentId && Types.ObjectId.isValid(parentCommentId)) {
    data.parentCommentId = new Types.ObjectId(parentCommentId);
    await Interaction.findByIdAndUpdate(parentCommentId, {
      $inc: { replyCount: 1 },
    });
  }

  const doc = await Interaction.create(data as any);
  const commentCount = (await bumpCount()) ?? undefined;

  await doc.populate("user", "firstName lastName username avatar");
  const formatted = formatComment(doc.toObject ? doc.toObject() : doc);

  emitCommentRoomEvents({
    contentId,
    contentType: contentKind,
    comment: formatted,
    commentCount: typeof commentCount === "number" ? commentCount : undefined,
  });

  publishEngagementEvent("comment.created", {
    userId,
    contentId,
    contentType: contentKind,
    commentId: String(doc._id),
    parentCommentId,
  });

  logger.info("Community comment created", {
    contentKind,
    contentId,
    userId,
    commentId: doc._id,
  });

  return { doc, formatted, text };
}
