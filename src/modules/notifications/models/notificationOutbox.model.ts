import mongoose, { Schema, Document } from "mongoose";

export type NotificationOutboxStatus = "pending" | "enqueued" | "failed";

export interface INotificationOutbox extends Document {
  notificationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  payload: Record<string, unknown>;
  status: NotificationOutboxStatus;
  attempts: number;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const notificationOutboxSchema = new Schema<INotificationOutbox>(
  {
    notificationId: {
      type: Schema.Types.ObjectId,
      ref: "Notification",
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "enqueued", "failed"],
      default: "pending",
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastError: {
      type: String,
    },
  },
  { timestamps: true }
);

notificationOutboxSchema.index({ status: 1, createdAt: 1 });

export const NotificationOutbox =
  mongoose.models.NotificationOutbox ||
  mongoose.model<INotificationOutbox>(
    "NotificationOutbox",
    notificationOutboxSchema
  );
