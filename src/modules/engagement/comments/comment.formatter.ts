import { Types } from "mongoose";

export function sanitizeCommentContent(raw: string): { text: string } {
  const urlRegex = /(https?:\/\/|www\.)[^\s]+/gi;
  let text = (raw || "").toString().replace(urlRegex, "").trim();
  const list = (process.env.PROFANITY_BLOCK_LIST || "")
    .split(",")
    .map(w => w.trim())
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

export function formatComment(comment: any): any {
  const user = comment.user;
  const userId = user?._id?.toString() || user?.toString() || "";
  const likes = comment.reactions?.like?.length ?? 0;

  return {
    _id: comment._id,
    id: comment._id?.toString(),
    content: comment.content,
    comment: comment.content,
    authorId: userId,
    userId,
    user: user
      ? {
          _id: user._id || user,
          id: userId,
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          avatar: user.avatar || null,
        }
      : null,
    createdAt: comment.createdAt,
    likesCount: likes,
    likes,
    replyCount: comment.replyCount || 0,
    parentCommentId: comment.parentCommentId?.toString?.(),
    replies: [],
    isLiked: false,
  };
}

export function applyIsLiked(comment: any, userId?: string): any {
  if (!userId || !Types.ObjectId.isValid(userId)) {
    comment.isLiked = false;
    if (comment.replies?.length) {
      comment.replies = comment.replies.map((r: any) => ({ ...r, isLiked: false }));
    }
    return comment;
  }
  const uid = userId.toString();
  const likes: any[] = comment.reactions?.like || [];
  comment.isLiked = likes.some((id: any) => id.toString() === uid);
  if (comment.replies?.length) {
    comment.replies = comment.replies.map((r: any) => {
      const rLikes: any[] = r.reactions?.like || [];
      return { ...r, isLiked: rLikes.some((id: any) => id.toString() === uid) };
    });
  }
  return comment;
}
