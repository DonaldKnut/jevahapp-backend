/** Backward-compatible re-exports — handlers live in engagement module */
export {
  removeComment,
  addCommentReaction,
} from "../modules/engagement/comments/comments.controller";

export { getShareUrls, getShareStats } from "../modules/engagement/share/share.controller";

export {
  sendMessage,
  getConversationMessages,
  getUserConversations,
  deleteMessage,
} from "../modules/engagement/messaging/messaging.controller";
