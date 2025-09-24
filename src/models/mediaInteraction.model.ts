import mongoose, { Schema, Document } from "mongoose";

export interface IMediaInteraction extends Document {
  user: mongoose.Types.ObjectId;
  media: mongoose.Types.ObjectId;
  interactionType:
    | "view"
    | "listen"
    | "read"
    | "download"
    | "like"
    | "comment"
    | "share";
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
    fileSize?: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const mediaInteractionSchema = new Schema<IMediaInteraction>(
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
      enum: ["view", "listen", "read", "download", "like", "comment", "share"],
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
      ref: "MediaInteraction",
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
    reportedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    isRemoved: {
      type: Boolean,
      default: false,
    },
    interactions: [
      {
        timestamp: { type: Date, default: Date.now },
        duration: { type: Number },
        isComplete: { type: Boolean },
        progressPct: { type: Number },
        fileSize: { type: Number },
      },
    ],
  },
  { timestamps: true }
);

// Indexes for better performance
mediaInteractionSchema.index({ user: 1, media: 1, interactionType: 1 });
mediaInteractionSchema.index({ media: 1, interactionType: 1 });
mediaInteractionSchema.index({ parentCommentId: 1 });
mediaInteractionSchema.index({ createdAt: -1 });
mediaInteractionSchema.index({ media: 1, parentCommentId: 1, createdAt: -1 });

export const MediaInteraction =
  mongoose.models.MediaInteraction ||
  mongoose.model<IMediaInteraction>("MediaInteraction", mediaInteractionSchema);
