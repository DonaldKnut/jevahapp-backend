import { Types } from "mongoose";
import { ensurePublicR2Url } from "../../../service/fileUpload.service";
import { healAvatarUrl } from "./comment.media";

export function sanitizeCommentContent(raw: string): { text: string } {
  const urlRegex = /(https?:\/\/|www\.)[^\s]+/gi;
  let text = (raw || "").toString().replace(urlRegex, "").trim();
  const list = (process.env.PROFANITY_BLOCK_LIST || "")
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);
  for (const word of list) {
    const pattern = new RegExp(
      `\\b${word.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`,
      "ig"
    );
    text = text.replace(pattern, "***");
  }
  return { text };
}

function reactionLikes(comment: any): any[] {
  const reactions = comment?.reactions;
  if (!reactions) return [];
  if (reactions instanceof Map) return reactions.get("like") || [];
  return reactions.like || [];
}

function isLikedBy(comment: any, userId?: string): boolean {
  if (!userId || !Types.ObjectId.isValid(userId)) return false;
  const uid = userId.toString();
  return reactionLikes(comment).some((id: any) => id?.toString?.() === uid);
}

export function formatComment(comment: any, viewerUserId?: string): any {
  const user = comment.user;
  const userId = user?._id?.toString() || user?.toString() || "";
  const likes = reactionLikes(comment).length;

  const rawImage = comment.imageUrl || null;
  const imageUrl = rawImage ? ensurePublicR2Url(rawImage) : null;
  const mentions = Array.isArray(comment.mentions)
    ? comment.mentions
        .map((m: any) => ({
          userId: m?.userId?._id?.toString?.() || m?.userId?.toString?.() || "",
          displayName: m?.displayName || "",
        }))
        .filter((m: { userId: string }) => !!m.userId)
    : [];

  const editedAt = comment.editedAt || null;
  const isEdited = !!editedAt;

  return {
    _id: comment._id,
    id: comment._id?.toString(),
    content: comment.content || "",
    comment: comment.content || "",
    imageUrl,
    image: imageUrl,
    mediaUrl: imageUrl,
    attachmentUrl: imageUrl,
    mentions,
    isEdited,
    edited: isEdited,
    editedAt,
    authorId: userId,
    userId,
    user: user
      ? {
          _id: user._id || user,
          id: userId,
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          avatar: healAvatarUrl(user.avatar || user.avatarUpload),
        }
      : null,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    likesCount: likes,
    likes,
    replyCount: comment.replyCount || 0,
    parentCommentId: comment.parentCommentId?.toString?.() || null,
    replies: [],
    isLiked: isLikedBy(comment, viewerUserId),
  };
}

/** Apply viewer like state after format (uses raw Interaction docs when provided). */
export function applyIsLiked(
  formatted: any,
  viewerUserId?: string,
  raw?: any
): any {
  const source = raw || formatted;
  formatted.isLiked = isLikedBy(source, viewerUserId);
  if (formatted.replies?.length && Array.isArray(raw?.replies)) {
    formatted.replies = formatted.replies.map((r: any, i: number) => ({
      ...r,
      isLiked: isLikedBy(raw.replies[i] || r, viewerUserId),
    }));
  } else if (formatted.replies?.length && !viewerUserId) {
    formatted.replies = formatted.replies.map((r: any) => ({
      ...r,
      isLiked: false,
    }));
  }
  return formatted;
}
