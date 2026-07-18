import mongoose, { Schema, Document } from "mongoose";
import { ALL_LIKE_CONTENT_TYPES } from "../modules/engagement/shared/engagement.types";

export type LikeContentType = (typeof ALL_LIKE_CONTENT_TYPES)[number];

export interface ILike extends Document {
  userId: mongoose.Types.ObjectId;
  contentId: mongoose.Types.ObjectId;
  contentType: LikeContentType;
  createdAt: Date;
}

const likeSchema = new Schema<ILike>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    contentId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    contentType: {
      type: String,
      enum: ALL_LIKE_CONTENT_TYPES,
      required: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// CRITICAL: one active like per (user, type, content) — contentId alone is not unique across collections
likeSchema.index(
  { userId: 1, contentType: 1, contentId: 1 },
  { unique: true, name: "unique_user_content_like" }
);
likeSchema.index({ contentType: 1, contentId: 1 }, { name: "content_likes" });
likeSchema.index({ userId: 1, createdAt: -1 }, { name: "user_likes" });

export const Like =
  mongoose.models.Like || mongoose.model<ILike>("Like", likeSchema);
