import mongoose, { Schema, Document } from "mongoose";

export interface ICopyrightFreeSongInteraction extends Document {
  userId: mongoose.Types.ObjectId;
  songId: mongoose.Types.ObjectId;
  hasLiked: boolean;
  hasShared: boolean;
  hasViewed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const interactionSchema = new Schema<ICopyrightFreeSongInteraction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    songId: {
      type: Schema.Types.ObjectId,
      ref: "CopyrightFreeSong",
      required: true,
      index: true,
    },
    hasLiked: {
      type: Boolean,
      default: false,
    },
    hasShared: {
      type: Boolean,
      default: false,
    },
    hasViewed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Unique index: one interaction record per user per song
interactionSchema.index({ userId: 1, songId: 1 }, { unique: true });
interactionSchema.index({ songId: 1 });

export const CopyrightFreeSongInteraction =
  mongoose.models.CopyrightFreeSongInteraction ||
  mongoose.model<ICopyrightFreeSongInteraction>(
    "CopyrightFreeSongInteraction",
    interactionSchema
  );

