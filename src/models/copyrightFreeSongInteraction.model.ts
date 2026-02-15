import mongoose, { Schema, Document } from "mongoose";

export interface ICopyrightFreeSongInteraction extends Document {
  userId: mongoose.Types.ObjectId;
  songId: mongoose.Types.ObjectId;
  hasLiked: boolean;
  hasShared: boolean;
  hasViewed: boolean;
  // View engagement metrics (for analytics)
  durationMs?: number; // Total listening duration in milliseconds
  progressPct?: number; // Maximum progress reached (0-100)
  isComplete?: boolean; // Whether song was played to completion
  viewedAt?: Date; // First view timestamp
  lastViewedAt?: Date; // Last view timestamp (for analytics)
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
    // View engagement metrics (optional, for analytics)
    durationMs: {
      type: Number,
      default: 0,
    },
    progressPct: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    isComplete: {
      type: Boolean,
      default: false,
    },
    viewedAt: {
      type: Date,
    },
    lastViewedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Unique index: one interaction record per user per song (CRITICAL for deduplication)
interactionSchema.index({ userId: 1, songId: 1 }, { unique: true, name: "user_song_unique" });
// Index for querying song views
interactionSchema.index({ songId: 1 }, { name: "song_index" });
// Index for querying user views
interactionSchema.index({ userId: 1 }, { name: "user_index" });

export const CopyrightFreeSongInteraction =
  mongoose.models.CopyrightFreeSongInteraction ||
  mongoose.model<ICopyrightFreeSongInteraction>(
    "CopyrightFreeSongInteraction",
    interactionSchema
  );

