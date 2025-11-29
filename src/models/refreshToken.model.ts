import mongoose, { Schema, Document } from "mongoose";

export interface IRefreshToken extends Document {
  token: string;
  userId: mongoose.Types.ObjectId;
  deviceInfo?: string; // Device/browser identifier
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  isRevoked: boolean;
  revokedAt?: Date;
  createdAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    token: {
      type: String,
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
    deviceInfo: {
      type: String,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // Auto-delete expired tokens
    },
    isRevoked: {
      type: Boolean,
      default: false,
    },
    revokedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster lookups
refreshTokenSchema.index({ userId: 1, isRevoked: 1 });
refreshTokenSchema.index({ token: 1, isRevoked: 1 });

export const RefreshToken =
  mongoose.models.RefreshToken ||
  mongoose.model<IRefreshToken>("RefreshToken", refreshTokenSchema);

