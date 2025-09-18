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
  | "merch_purchase"; // Merchandise purchase

// TypeScript interface for a Notification
export interface INotification extends Document {
  user: mongoose.Types.ObjectId;
  title: string;
  message: string;
  isRead: boolean;
  type: NotificationType;
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
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Export model
export const Notification =
  mongoose.models.Notification ||
  mongoose.model<INotification>("Notification", notificationSchema);
