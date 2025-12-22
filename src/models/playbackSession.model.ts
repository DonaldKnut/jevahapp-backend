import mongoose, { Schema, Document } from "mongoose";

export interface IPlaybackSession extends Document {
  userId: mongoose.Types.ObjectId;
  mediaId: mongoose.Types.ObjectId;
  startedAt: Date;
  lastProgressAt: Date;
  currentPosition: number; // Current position in seconds
  duration: number; // Total duration in seconds
  progressPercentage: number; // 0-100
  isActive: boolean; // Is this session currently active (playing)
  isPaused: boolean; // Is playback paused
  pausedAt?: Date;
  endedAt?: Date;
  totalWatchTime: number; // Total time watched/listened in this session (seconds) - works for both video and audio
  playbackType?: "video" | "audio"; // Optional: Type of playback (can be inferred from media.contentType)
  deviceInfo?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const playbackSessionSchema = new Schema<IPlaybackSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      // Index defined at schema level (line 96)
    },
    mediaId: {
      type: Schema.Types.ObjectId,
      ref: "Media",
      required: true,
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    lastProgressAt: {
      type: Date,
      default: Date.now,
    },
    currentPosition: {
      type: Number,
      default: 0,
      min: 0,
    },
    duration: {
      type: Number,
      required: true,
      min: 0,
    },
    progressPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    isActive: {
      type: Boolean,
      default: true,
      // Index defined at schema level (line 96)
    },
    isPaused: {
      type: Boolean,
      default: false,
    },
    pausedAt: {
      type: Date,
    },
    endedAt: {
      type: Date,
    },
    totalWatchTime: {
      type: Number,
      default: 0,
      min: 0,
    },
    deviceInfo: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
// Index for active sessions (one active session per user)
// Note: We'll handle uniqueness in service layer since MongoDB unique partial indexes can be tricky
playbackSessionSchema.index({ userId: 1, isActive: 1 });
playbackSessionSchema.index({ userId: 1, mediaId: 1, isActive: 1 });
playbackSessionSchema.index({ lastProgressAt: -1 });
playbackSessionSchema.index({ createdAt: -1 });

export const PlaybackSession =
  mongoose.models.PlaybackSession ||
  mongoose.model<IPlaybackSession>("PlaybackSession", playbackSessionSchema);

