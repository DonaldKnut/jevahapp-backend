/**
 * Backward-compatible re-exports — canonical handlers live in engagement module.
 */
export {
  toggleContentLike,
  shareContent,
  recordContentView,
  getContentMetadata,
  getBatchContentMetadata,
  getContentLikers,
} from "../modules/engagement/interactions.controller";

export {
  addContentComment,
  removeContentComment,
  getContentComments,
  getCommentReplies,
  editContentComment,
  reportContentComment,
  hideContentComment,
} from "../modules/engagement/comments/comments.controller";
