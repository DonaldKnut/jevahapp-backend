/**
 * Typed domain errors for comment use-cases (no stringly-typed throws).
 */
export class CommentError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status = 400) {
    super(message);
    this.name = "CommentError";
    this.code = code;
    this.status = status;
  }
}

export const CommentErrors = {
  invalidIds: () =>
    new CommentError("Invalid user or content ID", "INVALID_IDS", 400),
  invalidCommentId: () =>
    new CommentError("Invalid comment ID", "INVALID_COMMENT_ID", 400),
  contentRequired: () =>
    new CommentError(
      "Comment content is required (or attach an image)",
      "COMMENT_CONTENT_REQUIRED",
      400
    ),
  contentNotFound: () =>
    new CommentError("Content not found", "CONTENT_NOT_FOUND", 404),
  commentNotFound: () =>
    new CommentError("Comment not found", "COMMENT_NOT_FOUND", 404),
  forbidden: () =>
    new CommentError(
      "Comment not found or you don't have permission",
      "COMMENT_FORBIDDEN",
      403
    ),
  editWindowExpired: (hours: number) =>
    new CommentError(
      `Comments can only be edited within ${hours} hour(s)`,
      "COMMENT_EDIT_WINDOW_EXPIRED",
      403
    ),
  invalidImageUrl: () =>
    new CommentError("Invalid imageUrl", "INVALID_IMAGE_URL", 400),
  uploadFailed: () =>
    new CommentError("UPLOAD_FAILED", "UPLOAD_FAILED", 500),
  notSupported: (msg: string) =>
    new CommentError(msg, "COMMENT_NOT_SUPPORTED", 400),
  cannotReportOwn: () =>
    new CommentError(
      "You cannot report your own comment",
      "CANNOT_REPORT_OWN",
      400
    ),
  alreadyReported: () =>
    new CommentError(
      "You have already reported this comment",
      "ALREADY_REPORTED",
      400
    ),
};

export function isCommentError(err: unknown): err is CommentError {
  return err instanceof CommentError;
}
