import { User } from "../../models/user.model";
import { Media } from "../../models/media.model";
import { Devotional } from "../../models/devotional.model";
import logger from "../../utils/logger";
import { createNotification } from "./create";

export async function notifyViralContent(
  contentId: string,
  contentType: string,
  milestone: string,
  count: number
): Promise<void> {
  try {
    let content, contentOwner;

    if (contentType === "media") {
      content = await Media.findById(contentId);
      if (!content?.uploadedBy) return;
      contentOwner = await User.findById(content.uploadedBy);
    } else if (contentType === "devotional") {
      content = await Devotional.findById(contentId);
      if (!(content as any)?.submittedBy) return;
      contentOwner = await User.findById((content as any).submittedBy);
    }

    if (!content || !contentOwner) return;

    const milestoneMessages = {
      views: `${count.toLocaleString()} views`,
      likes: `${count.toLocaleString()} likes`,
      shares: `${count.toLocaleString()} shares`,
      comments: `${count.toLocaleString()} comments`,
    };

    await createNotification({
      userId: contentOwner._id.toString(),
      type: "milestone",
      title: "🎉 Content Milestone!",
      message: `Your ${contentType} "${content.title}" reached ${milestoneMessages[milestone as keyof typeof milestoneMessages]}`,
      metadata: {
        contentTitle: content.title,
        contentType,
        thumbnailUrl: content.thumbnailUrl,
        milestone,
        count,
      },
      priority: "high",
      relatedId: contentId,
    });
  } catch (error) {
    logger.error("Failed to send viral content notification:", error);
  }
}

export async function notifyPublicActivity(
  actorId: string,
  action: string,
  targetId: string,
  targetType: string,
  targetTitle?: string
): Promise<void> {
  try {
    const actor = await User.findById(actorId);
    if (!actor) return;

    // Get actor's followers who opted into public activity
    const followers = await User.find({
      _id: { $in: actor.followers || [] },
      "pushNotifications.preferences.publicActivity": { $ne: false },
    });

    if (followers.length === 0) return;

    const actionMessages = {
      like: "liked",
      comment: "commented on",
      share: "shared",
      follow: "started following",
    };

    const actionText =
      actionMessages[action as keyof typeof actionMessages] || action;
    const targetText = targetTitle ? `"${targetTitle}"` : `a ${targetType}`;

    // Send to all followers
    const notifications = followers.map(follower => ({
      userId: follower._id.toString(),
      type: "public_activity",
      title: "Activity Update",
      message: `${actor.firstName || actor.email} ${actionText} ${targetText}`,
      metadata: {
        actorName: actor.firstName || actor.email,
        actorAvatar: actor.avatar,
        action,
        targetType,
        targetTitle,
      },
      priority: "low" as const,
      relatedId: targetId,
    }));

    // Create notifications in batch
    for (const notificationData of notifications) {
      await createNotification(notificationData);
    }

    logger.info("Public activity notifications sent", {
      actorId,
      action,
      targetType,
      followerCount: followers.length,
    });
  } catch (error) {
    logger.error("Failed to send public activity notifications:", error);
  }
}

export async function notifyContentDownload(
  downloaderId: string,
  contentId: string,
  contentType: string
): Promise<void> {
  try {
    const downloader = await User.findById(downloaderId);
    let content, contentOwner;

    if (contentType === "media") {
      content = await Media.findById(contentId);
      if (!content?.uploadedBy) return;
      contentOwner = await User.findById(content.uploadedBy);
    }

    if (
      !downloader ||
      !content ||
      !contentOwner ||
      downloaderId === contentOwner._id.toString()
    )
      return;

    await createNotification({
      userId: contentOwner._id.toString(),
      type: "download",
      title: "Content Downloaded",
      message: `${downloader.firstName || downloader.email} downloaded your ${contentType}`,
      metadata: {
        actorName: downloader.firstName || downloader.email,
        actorAvatar: downloader.avatar,
        contentTitle: content.title,
        contentType,
        thumbnailUrl: content.thumbnailUrl,
        downloadCount: content.downloadCount || 0,
      },
      priority: "medium",
      relatedId: contentId,
    });
  } catch (error) {
    logger.error("Failed to send download notification:", error);
  }
}

export async function notifyContentBookmark(
  bookmarkerId: string,
  contentId: string,
  contentType: string,
  bookmarkId?: string
): Promise<void> {
  try {
    const bookmarker = await User.findById(bookmarkerId);
    let content, contentOwner;

    if (contentType === "media") {
      content = await Media.findById(contentId);
      if (!content?.uploadedBy) return;
      contentOwner = await User.findById(content.uploadedBy);
    }

    if (
      !bookmarker ||
      !content ||
      !contentOwner ||
      bookmarkerId === contentOwner._id.toString()
    )
      return;

    await createNotification({
      userId: contentOwner._id.toString(),
      type: "bookmark",
      title: "Content Saved",
      message: `${bookmarker.firstName || bookmarker.email} saved your ${contentType} to their library`,
      metadata: {
        actorName: bookmarker.firstName || bookmarker.email,
        actorAvatar: bookmarker.avatar,
        contentTitle: content.title,
        contentType,
        thumbnailUrl: content.thumbnailUrl,
        bookmarkCount: content.bookmarkCount || 0,
        bookmarkId,
      },
      priority: "low",
      relatedId: contentId,
      dedupeKey: bookmarkId ? `bookmark:${bookmarkId}` : undefined,
    });
  } catch (error) {
    logger.error("Failed to send bookmark notification:", error);
  }
}

export async function notifyMerchPurchase(
  buyerId: string,
  sellerId: string,
  merchItem: any
): Promise<void> {
  try {
    const buyer = await User.findById(buyerId);
    const seller = await User.findById(sellerId);

    if (!buyer || !seller || buyerId === sellerId) return;

    await createNotification({
      userId: sellerId,
      type: "merch_purchase",
      title: "Merch Purchase",
      message: `${buyer.firstName || buyer.email} purchased ${merchItem.name}`,
      metadata: {
        actorName: buyer.firstName || buyer.email,
        actorAvatar: buyer.avatar,
        merchName: merchItem.name,
        merchPrice: merchItem.price,
        merchImage: merchItem.imageUrl,
      },
      priority: "high",
    });
  } catch (error) {
    logger.error("Failed to send merch purchase notification:", error);
  }
}

export async function notifyMilestone(
  userId: string,
  milestone: string,
  count: number
): Promise<void> {
  try {
    await createNotification({
      userId,
      type: "milestone",
      title: "Milestone Achieved! 🎉",
      message: `Congratulations! You've reached ${count} ${milestone}`,
      metadata: {
        milestone,
        count,
        achievementType: milestone,
      },
      priority: "high",
    });
  } catch (error) {
    logger.error("Failed to send milestone notification:", error);
  }
}
