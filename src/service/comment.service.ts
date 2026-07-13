/**
 * Legacy static API — delegates to engagement comment module.
 */
import engagementCommentService from "../modules/engagement/comments/comment.service";

export interface CreateCommentData {
  userId: string;
  contentId: string;
  contentType: "media" | "devotional" | "ebook" | "podcast";
  content: string;
  parentCommentId?: string;
}

export interface UpdateCommentData {
  commentId: string;
  userId: string;
  content: string;
}

function normalizeType(contentType: CreateCommentData["contentType"]): string {
  return contentType === "ebook" || contentType === "podcast" ? "media" : contentType;
}

export class CommentService {
  static createComment(data: CreateCommentData) {
    return engagementCommentService.addComment(
      data.userId,
      data.contentId,
      normalizeType(data.contentType),
      data.content,
      data.parentCommentId
    );
  }

  static updateComment(data: UpdateCommentData) {
    return engagementCommentService.editContentComment(
      data.commentId,
      data.userId,
      data.content
    );
  }

  static deleteComment(commentId: string, userId: string) {
    return engagementCommentService.removeContentComment(commentId, userId);
  }

  static toggleLike(commentId: string, userId: string) {
    return engagementCommentService.toggleCommentReaction(commentId, userId, "like");
  }
}

export default CommentService;
