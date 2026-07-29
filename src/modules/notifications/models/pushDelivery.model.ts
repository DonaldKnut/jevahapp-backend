import mongoose, { Schema, Document } from "mongoose";

export type PushDeliveryStatus = "pending" | "ok" | "error";

export interface IPushDelivery extends Document {
  userId: mongoose.Types.ObjectId;
  notificationId: mongoose.Types.ObjectId;
  ticketId: string;
  token: string;
  status: PushDeliveryStatus;
  receiptStatus?: string;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

const pushDeliverySchema = new Schema<IPushDelivery>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    notificationId: {
      type: Schema.Types.ObjectId,
      ref: "Notification",
      required: true,
      index: true,
    },
    ticketId: {
      type: String,
      required: true,
      unique: true,
    },
    token: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "ok", "error"],
      default: "ok",
      index: true,
    },
    receiptStatus: {
      type: String,
    },
    attempts: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

pushDeliverySchema.index({ status: 1, receiptStatus: 1, createdAt: 1 });

export const PushDelivery =
  mongoose.models.PushDelivery ||
  mongoose.model<IPushDelivery>("PushDelivery", pushDeliverySchema);
