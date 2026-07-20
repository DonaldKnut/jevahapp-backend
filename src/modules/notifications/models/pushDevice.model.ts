import mongoose, { Schema, Document } from "mongoose";

export type PushDeviceStatus = "active" | "disabled" | "invalid";
export type PushDevicePlatform = "ios" | "android" | "web";

export interface IPushDevice extends Document {
  expoToken: string;
  userId: mongoose.Types.ObjectId;
  installationId?: string;
  platform?: PushDevicePlatform;
  projectId?: string;
  status: PushDeviceStatus;
  lastSeenAt: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const pushDeviceSchema = new Schema<IPushDevice>(
  {
    expoToken: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    installationId: {
      type: String,
      trim: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ["ios", "android", "web"],
    },
    projectId: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "disabled", "invalid"],
      default: "active",
      index: true,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    lastError: {
      type: String,
    },
  },
  { timestamps: true }
);

pushDeviceSchema.index({ userId: 1, status: 1 });

export const PushDevice =
  mongoose.models.PushDevice ||
  mongoose.model<IPushDevice>("PushDevice", pushDeviceSchema);
