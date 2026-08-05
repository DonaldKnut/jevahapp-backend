import type { CreateNotificationData } from "./notification/types";
import {
  createNotification,
  sendPushNotification,
} from "./notification/create";
import {
  notifyUserFollow,
  notifyContentLike,
  notifyContentComment,
  notifyCommentReply,
  notifyContentShare,
  notifyContentMention,
} from "./notification/social";
import {
  notifyViralContent,
  notifyPublicActivity,
  notifyContentDownload,
  notifyContentBookmark,
  notifyMerchPurchase,
  notifyMilestone,
} from "./notification/contentEvents";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  getNotificationStats,
  markAsRead,
  markAllAsRead,
  getUserNotifications,
} from "./notification/inbox";

export type { CreateNotificationData };

/**
 * Static facade — method signatures match the pre-split NotificationService.
 */
export class NotificationService {
  static createNotification = createNotification;
  static notifyUserFollow = notifyUserFollow;
  static notifyContentLike = notifyContentLike;
  static notifyContentComment = notifyContentComment;
  static notifyCommentReply = notifyCommentReply;
  static notifyContentShare = notifyContentShare;
  static notifyContentMention = notifyContentMention;
  static notifyViralContent = notifyViralContent;
  static notifyPublicActivity = notifyPublicActivity;
  static getNotificationPreferences = getNotificationPreferences;
  static updateNotificationPreferences = updateNotificationPreferences;
  static getNotificationStats = getNotificationStats;
  static notifyContentDownload = notifyContentDownload;
  static notifyContentBookmark = notifyContentBookmark;
  static notifyMerchPurchase = notifyMerchPurchase;
  static notifyMilestone = notifyMilestone;
  static markAsRead = markAsRead;
  static markAllAsRead = markAllAsRead;
  static getUserNotifications = getUserNotifications;
  /** @internal retained for any direct callers */
  static sendPushNotification = sendPushNotification;
}

export default NotificationService;
