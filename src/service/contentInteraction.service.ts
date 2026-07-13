/**
 * Thin backward-compatible facade — all logic lives in src/modules/engagement/.
 * Do not add business logic here.
 */
export type {
  ContentMetadata,
  BatchMetadataItem,
  LikeToggleResult,
  ShareResult,
} from "../modules/engagement/shared/engagement.types";

import likeService from "../modules/engagement/like/like.service";
import engagementShareService from "../modules/engagement/share/share.service";
import metadataService from "../modules/engagement/metadata/metadata.service";
import commentService from "../modules/engagement/comments/comment.service";

export interface ContentInteractionInput {
  userId: string;
  contentId: string;
  contentType: string;
  actionType: "like" | "comment" | "share" | "favorite" | "bookmark";
  content?: string;
  parentCommentId?: string;
  reactionType?: string;
}

export class ContentInteractionService {
  toggleLikeFast = likeService.toggleLikeFast.bind(likeService);
  toggleLike = likeService.toggleLike.bind(likeService);
  shareContent = engagementShareService.shareContent.bind(engagementShareService);
  getContentMetadata = metadataService.getContentMetadata.bind(metadataService);
  getBatchContentMetadata = metadataService.getBatchContentMetadata.bind(metadataService);
  getContentLikers = likeService.getContentLikers.bind(likeService);

  addComment = commentService.addComment.bind(commentService);
  getContentComments = commentService.getContentComments.bind(commentService);
  toggleCommentReaction = commentService.toggleCommentReaction.bind(commentService);
  getCommentReplies = commentService.getCommentReplies.bind(commentService);
  editContentComment = commentService.editContentComment.bind(commentService);
  reportContentComment = commentService.reportContentComment.bind(commentService);
  removeContentComment = commentService.removeContentComment.bind(commentService);
  moderateHideComment = commentService.moderateHideComment.bind(commentService);
}

export default new ContentInteractionService();
