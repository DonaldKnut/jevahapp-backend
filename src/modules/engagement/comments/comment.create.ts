import { Types } from "mongoose";
import { Media } from "../../../models/media.model";
import { Devotional } from "../../../models/devotional.model";
import { assertCommentableContentType } from "../shared/contentType.resolver";
import { commentRepository } from "./comment.repository";
import { sanitizeCommentContent, formatComment } from "./comment.formatter";
import { publishEngagementEvent } from "../../../lib/engagementEvents";
import { setPostCounter } from "../../../lib/redisCounters";
import { bumpCommentsVersion } from "./comment.version";
import { emitCommentRoomEvents } from "./comment.realtime";
import {
  MentionInput,
  resolveMentions,
  isAllowedImageUrl,
} from "./comment.mentions";
import { ensurePublicR2Url } from "../../../service/fileUpload.service";
import { CommentErrors } from "./comment.errors";
import { notifyAfterCommentCreate, assertContentExists } from "./comment.notify";
import { bumpCommentCount } from "./comment.counters";

export type AddCommentOptions = {
  imageUrl?: string;
  mentions?: MentionInput[];
};

export async function createComment(
  userId: string,
  contentId: string,
  contentType: string,
  content: string,
  parentCommentId?: string,
  options: AddCommentOptions = {}
) {
  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(contentId)) {
    throw CommentErrors.invalidIds();
  }

  const rawImageUrl = options.imageUrl?.trim() || "";
  const normalizedImageUrl = rawImageUrl ? ensurePublicR2Url(rawImageUrl) : "";
  if (normalizedImageUrl && !isAllowedImageUrl(normalizedImageUrl)) {
    throw CommentErrors.invalidImageUrl();
  }
  const imageUrl = normalizedImageUrl || undefined;

  const { text } = sanitizeCommentContent(content || "");
  if (!text && !imageUrl) {
    throw CommentErrors.contentRequired();
  }

  let normalized: string;
  try {
    normalized = assertCommentableContentType(contentType);
  } catch (err: any) {
    throw CommentErrors.notSupported(
      err?.message || "Comments not supported for this content type"
    );
  }

  await assertContentExists(contentId, normalized);
  const mentions = await resolveMentions(options.mentions || []);

  const session = await Media.startSession();
  try {
    const created = await session.withTransaction(async () => {
      const data: any = {
        user: new Types.ObjectId(userId),
        media: new Types.ObjectId(contentId),
        content: text,
      };
      if (imageUrl) data.imageUrl = imageUrl;
      if (mentions.length) data.mentions = mentions;
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
      .populate("user", "firstName lastName avatar avatarUpload")
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

    notifyAfterCommentCreate({
      userId,
      contentId,
      contentType: normalized,
      commentId,
      text,
      imageUrl,
      parentCommentId,
      mentions,
    });

    return formatted;
  } finally {
    session.endSession();
  }
}
