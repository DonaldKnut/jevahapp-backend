import mongoose, { Schema, Document } from "mongoose";

export interface IInteraction extends Document {
  user: mongoose.Types.ObjectId;
  media: mongoose.Types.ObjectId;
  interactionType:
    | "view"
    | "listen"
    | "read"
    | "download"
    | "comment"
    | "share"
    | "favorite";
  lastInteraction: Date;
  count: number;
  content?: string; // For comments
  parentCommentId?: mongoose.Types.ObjectId; // For nested comments
  reactions?: {
    [reactionType: string]: mongoose.Types.ObjectId[]; // Per-user reactions for toggling
  };
  replyCount?: number; // Denormalized count of direct replies
  isHidden?: boolean; // Moderator-hidden
  hiddenReason?: string;
  hiddenBy?: mongoose.Types.ObjectId; // ref: User
  reportCount?: number; // Number of reports
  reportedBy?: mongoose.Types.ObjectId[]; // Users who reported
  isRemoved?: boolean; // For soft deletion
  interactions: {
    timestamp: Date;
    duration?: number;
    isComplete?: boolean;
    progressPct?: number;
    fileSize?: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const interactionSchema = new Schema<IInteraction>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    media: {
      type: Schema.Types.ObjectId,
      ref: "Media",
      required: true,
    },
    interactionType: {
      type: String,
      enum: ["view", "listen", "read", "download", "comment", "share", "favorite"],
      required: true,
    },
    lastInteraction: {
      type: Date,
      default: Date.now,
    },
    count: {
      type: Number,
      default: 0,
    },
    content: {
      type: String,
      required: function () {
        return this.interactionType === "comment";
      },
      maxlength: 1000,
    },
    parentCommentId: {
      type: Schema.Types.ObjectId,
      ref: "Interaction",
      required: function () {
        return this.interactionType === "comment" && this.parentCommentId;
      },
    },
    reactions: {
      type: Map,
      of: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: {},
    },
    replyCount: {
      type: Number,
      default: 0,
    },
    isHidden: {
      type: Boolean,
      default: false,
    },
    hiddenReason: {
      type: String,
      maxlength: 500,
    },
    hiddenBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reportCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    reportedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isRemoved: {
      type: Boolean,
      default: false,
    },
    interactions: [
      {
        timestamp: {
          type: Date,
          required: true,
        },
        duration: {
          type: Number,
        },
        isComplete: {
          type: Boolean,
          default: false,
        },
        progressPct: {
          type: Number,
          min: 0,
          max: 100,
        },
        fileSize: {
          type: Number,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Keep one row per user/media/type for non-comment interactions, but allow
// multiple comments/replies per user on the same media.
interactionSchema.index(
  { user: 1, media: 1, interactionType: 1 },
  {
    unique: true,
    partialFilterExpression: {
      interactionType: { $ne: "comment" },
    },
  }
);

// Index for interaction type queries
interactionSchema.index({ interactionType: 1, isRemoved: 1 });

// Index for parent comments
interactionSchema.index({ parentCommentId: 1 });

// Index for media-based queries
interactionSchema.index({ media: 1 });

// Index for user-based queries
interactionSchema.index({ user: 1 });

export const Interaction =
  mongoose.models.Interaction ||
  mongoose.model<IInteraction>("Interaction", interactionSchema);