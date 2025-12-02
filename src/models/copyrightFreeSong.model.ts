import mongoose, { Schema, Document } from "mongoose";

export interface ICopyrightFreeSong extends Document {
  title: string;
  singer: string; // Artist/author name
  uploadedBy: mongoose.Types.ObjectId; // Admin who uploaded
  fileUrl: string; // Audio file URL
  thumbnailUrl?: string; // Optional thumbnail
  likeCount: number;
  shareCount: number;
  viewCount: number;
  duration?: number; // Optional duration in seconds
  createdAt: Date;
  updatedAt: Date;
}

const copyrightFreeSongSchema = new Schema<ICopyrightFreeSong>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    singer: {
      type: String,
      required: true,
      trim: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    thumbnailUrl: {
      type: String,
    },
    likeCount: {
      type: Number,
      default: 0,
    },
    shareCount: {
      type: Number,
      default: 0,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    duration: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
copyrightFreeSongSchema.index({ title: "text", singer: "text" }); // For search
copyrightFreeSongSchema.index({ likeCount: -1 }); // For sorting by popularity
copyrightFreeSongSchema.index({ viewCount: -1 }); // For sorting by most viewed
copyrightFreeSongSchema.index({ createdAt: -1 }); // For sorting by newest

export const CopyrightFreeSong =
  mongoose.models.CopyrightFreeSong ||
  mongoose.model<ICopyrightFreeSong>("CopyrightFreeSong", copyrightFreeSongSchema);

