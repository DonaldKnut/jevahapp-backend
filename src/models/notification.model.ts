import mongoose, { Schema, Document } from "mongoose";

// TikTok-like notification types
export type NotificationType =
  | "follow" // User followed you
  | "like" // User liked your content
  | "comment" // User commented on your content
  | "share" // User shared your content
  | "mention" // User mentioned you in a comment
  | "download" // User downloaded your content
  | "bookmark" // User bookmarked your content
  | "milestone" // Content reached a milestone
  | "public_activity" // Public activity from followed users
  | "system" // System notifications
  | "security" // Security alerts
  | "live_stream" // Live stream notifications
  | "merch_purchase" // Merchandise purchase
  | "content_report" // Admin: content reported by a user
  | "content_moderation" // Uploader: content removed / moderated
  | "moderation_alert" // Admin: AI / auto moderation alert
  | "admin_warning" // Trust & safety warning from admin
  | "message" // Direct message
  | "reengagement"; // AI re-engagement nudge

// TypeScript interface for a Notification
export interface INotification extends Document {
  user: mongoose.Types.ObjectId;
  title: string;
  message: string;
  isRead: boolean;
  type: NotificationType;
  /** Deduplicate retries / concurrent like notifications */
  dedupeKey?: string;
  metadata?: {
    actorName?: string;
    actorAvatar?: string;
    contentTitle?: string;
    contentType?: string;
    thumbnailUrl?: string;
    commentText?: string;
    sharePlatform?: string;
    milestone?: string;
    count?: number;
    [key: string]: any;
  };
  priority: "low" | "medium" | "high";
  relatedId?: mongoose.Types.ObjectId; // ID of related content
  expiresAt?: Date; // Optional expiration date
  createdAt: Date;
  updatedAt: Date;
}

// Mongoose schema definition
const notificationSchema = new Schema<INotification>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      enum: [
        "follow",
        "like",
        "comment",
        "share",
        "mention",
        "download",
        "bookmark",
        "milestone",
        "public_activity",
        "system",
        "security",
        "live_stream",
        "merch_purchase",
        "content_report",
        "content_moderation",
        "moderation_alert",
        "admin_warning",
        "message",
        "reengagement",
      ],
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    relatedId: {
      type: Schema.Types.ObjectId,
    },
    dedupeKey: {
      type: String,
      trim: true,
    },
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Unique when present — prevents duplicate like/follow notifications on retry
notificationSchema.index(
  { dedupeKey: 1 },
  {
    unique: true,
    partialFilterExpression: { dedupeKey: { $type: "string" } },
    name: "unique_notification_dedupeKey",
  }
);
notificationSchema.index({ user: 1, createdAt: -1 }, { name: "notification_user_createdAt" });
notificationSchema.index({ user: 1, isRead: 1 }, { name: "notification_user_isRead" });

// Export model
export const Notification =
  mongoose.models.Notification ||
  mongoose.model<INotification>("Notification", notificationSchema);
