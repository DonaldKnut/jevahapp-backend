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

// CRITICAL: Compound unique index to prevent duplicate likes at the DB level
likeSchema.index({ contentId: 1, userId: 1 }, { unique: true });
likeSchema.index({ contentType: 1, contentId: 1 });

export const Like =
  mongoose.models.Like || mongoose.model<ILike>("Like", likeSchema);
