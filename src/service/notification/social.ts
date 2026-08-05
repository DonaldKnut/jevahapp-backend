import { User } from "../../models/user.model";
import { Media } from "../../models/media.model";
import { Devotional } from "../../models/devotional.model";
import logger from "../../utils/logger";
import { createNotification } from "./create";

export async function notifyUserFollow(
  followerId: string,
  followingId: string
): Promise<void> {
  try {
    const follower = await User.findById(followerId);
    const following = await User.findById(followingId);

    if (!follower || !following) return;

    // No permanent follow dedupeKey — unlike/refollow should notify again.
    // Concurrent duplicate delivery is rare; mutation path is idempotent.
    await createNotification({
      userId: followingId,
      type: "follow",
      title: "New Follower",
      message: `${follower.firstName || follower.email} started following you`,
      metadata: {
        actorName: follower.firstName || follower.email,
        actorAvatar: follower.avatar,
        followerCount: following.followers?.length || 0,
      },
      priority: "medium",
    });
  } catch (error) {
    logger.error("Failed to send follow notification:", error);
  }
}

export async function notifyContentLike(
  likerId: string,
  contentId: string,
  contentType: string,
  /** Active Like document id — one notification per like cycle */
  likeId?: string
): Promise<void> {
  try {
    const liker = await User.findById(likerId);
    let content, contentOwner;

    if (contentType === "media") {
      content = await Media.findById(contentId);
      if (content?.uploadedBy) {
        contentOwner = await User.findById(content.uploadedBy);
      }
    } else if (contentType === "devotional") {
      content = await Devotional.findById(contentId);
      if (content?.submittedBy) {
        contentOwner = await User.findById(content.submittedBy);
      }
    }

    // Prevent self-notifications
    if (
      !liker ||
      !content ||
      !contentOwner ||
      likerId === contentOwner._id.toString()
    ) {
      logger.info("Skipping self-notification for content like", {
        likerId,
        contentOwnerId: contentOwner?._id.toString(),
        contentId,
        contentType,
      });
      return;
    }

    const ownerId = contentOwner._id.toString();
    // Per-cycle dedupe: same Like _id → suppress retry duplicates;
    // unlike + relike creates a new Like → new notification allowed.
    const dedupeKey = likeId
      ? `like:${likeId}`
      : undefined;

    await createNotification({
      userId: ownerId,
      type: "like",
      title: "New Like",
      message: `${liker.firstName || liker.email} liked your ${contentType}`,
      metadata: {
        actorName: liker.firstName || liker.email,
        actorAvatar: liker.avatar,
        contentTitle: content.title,
        contentType,
        thumbnailUrl: content.thumbnailUrl,
        likeCount: content.likeCount || 0,
        likeId,
      },
      priority: "low",
      relatedId: contentId,
      dedupeKey,
    });
  } catch (error) {
    logger.error("Failed to send like notification:", error);
  }
}

export async function notifyContentComment(
  commenterId: string,
  contentId: string,
  contentType: string,
  commentText: string,
  commentId?: string
): Promise<void> {
  try {
    const commenter = await User.findById(commenterId);
    let content, contentOwner;

    if (contentType === "media") {
      content = await Media.findById(contentId);
      contentOwner = await User.findById(content.uploadedBy);
    } else if (contentType === "devotional") {
      content = await Devotional.findById(contentId);
      contentOwner = await User.findById(content.submittedBy);
    }

    // Prevent self-notifications
    if (
      !commenter ||
      !content ||
      !contentOwner ||
      commenterId === contentOwner._id.toString()
    ) {
      logger.info("Skipping self-notification for content comment", {
        commenterId,
        contentOwnerId: contentOwner?._id.toString(),
        contentId,
        contentType,
      });
      return;
    }

    await createNotification({
      userId: contentOwner._id.toString(),
      type: "comment",
      title: "New Comment",
      message: `${commenter.firstName || commenter.email} commented on your ${contentType}`,
      metadata: {
        actorName: commenter.firstName || commenter.email,
        actorAvatar: commenter.avatar,
        contentTitle: content.title,
        contentType,
        thumbnailUrl: content.thumbnailUrl,
        commentText: commentText.substring(0, 100),
        commentCount: content.commentCount || 0,
        commentId,
      },
      priority: "medium",
      relatedId: contentId,
      dedupeKey: commentId ? `comment:${commentId}` : undefined,
    });
  } catch (error) {
    logger.error("Failed to send comment notification:", error);
  }
}

export async function notifyCommentReply(
  replierId: string,
  parentCommentId: string,
  contentId: string,
  contentType: string,
  commentText: string,
  commentId?: string
): Promise<void> {
  try {
    const { Interaction } = await import("../../models/interaction.model");
    const [replier, parent] = await Promise.all([
      User.findById(replierId),
      Interaction.findById(parentCommentId).select("user").lean(),
    ]);

    const parentAuthorId = (parent as any)?.user?.toString?.();
    if (!replier || !parentAuthorId || replierId === parentAuthorId) {
      return;
    }

    // Content owner already gets notifyContentComment — skip duplicate for same recipient
    let contentOwnerId: string | undefined;
    if (contentType === "media") {
      const content = await Media.findById(contentId).select("uploadedBy").lean();
      contentOwnerId = (content as any)?.uploadedBy?.toString?.();
    } else if (contentType === "devotional") {
      const content = await Devotional.findById(contentId).select("submittedBy").lean();
      contentOwnerId = (content as any)?.submittedBy?.toString?.();
    }
    if (contentOwnerId && contentOwnerId === parentAuthorId) {
      return;
    }

    await createNotification({
      userId: parentAuthorId,
      type: "comment",
      title: "New Reply",
      message: `${replier.firstName || replier.email} replied to your comment`,
      metadata: {
        actorName: replier.firstName || replier.email,
        actorAvatar: replier.avatar,
        contentType,
        commentText: commentText.substring(0, 100),
        commentId,
        parentCommentId,
      },
      priority: "medium",
      relatedId: contentId,
      dedupeKey: commentId ? `comment:${commentId}:reply` : undefined,
    });
  } catch (error) {
    logger.error("Failed to send reply notification:", error);
  }
}

export async function notifyContentShare(
  sharerId: string,
  contentId: string,
  contentType: string,
  sharePlatform?: string
): Promise<void> {
  try {
    const sharer = await User.findById(sharerId);
    let content, contentOwner;

    if (contentType === "media") {
      content = await Media.findById(contentId);
      contentOwner = await User.findById(content.uploadedBy);
    } else if (contentType === "devotional") {
      content = await Devotional.findById(contentId);
      contentOwner = await User.findById(content.submittedBy);
    }

    // Prevent self-notifications
    if (
      !sharer ||
      !content ||
      !contentOwner ||
      sharerId === contentOwner._id.toString()
    ) {
      logger.info("Skipping self-notification for content share", {
        sharerId,
        contentOwnerId: contentOwner?._id.toString(),
        contentId,
        contentType,
      });
      return;
    }

    const platformText = sharePlatform ? ` on ${sharePlatform}` : "";

    await createNotification({
      userId: contentOwner._id.toString(),
      type: "share",
      title: "Content Shared",
      message: `${sharer.firstName || sharer.email} shared your ${contentType}${platformText}`,
      metadata: {
        actorName: sharer.firstName || sharer.email,
        actorAvatar: sharer.avatar,
        contentTitle: content.title,
        contentType,
        thumbnailUrl: content.thumbnailUrl,
        sharePlatform,
        shareCount: content.shareCount || 0,
      },
      priority: "medium",
      relatedId: contentId,
    });
  } catch (error) {
    logger.error("Failed to send share notification:", error);
  }
}

export async function notifyContentMention(
  mentionerId: string,
  mentionedUserId: string,
  contentId: string,
  contentType: string,
  commentText: string
): Promise<void> {
  try {
    const mentioner = await User.findById(mentionerId);
    const mentionedUser = await User.findById(mentionedUserId);
    let content;

    if (contentType === "media") {
      content = await Media.findById(contentId);
    } else if (contentType === "devotional") {
      content = await Devotional.findById(contentId);
    }

    // Prevent self-mentions
    if (
      !mentioner ||
      !mentionedUser ||
      !content ||
      mentionerId === mentionedUserId
    ) {
      logger.info("Skipping self-mention notification", {
        mentionerId,
        mentionedUserId,
        contentId,
        contentType,
      });
      return;
    }

    await createNotification({
      userId: mentionedUserId,
      type: "mention",
      title: "You were mentioned",
      message: `${mentioner.firstName || mentioner.email} mentioned you in a comment`,
      metadata: {
        actorName: mentioner.firstName || mentioner.email,
        actorAvatar: mentioner.avatar,
        contentTitle: content.title,
        contentType,
        thumbnailUrl: content.thumbnailUrl,
        commentText: commentText.substring(0, 100),
      },
      priority: "high",
      relatedId: contentId,
    });
  } catch (error) {
    logger.error("Failed to send mention notification:", error);
  }
}
