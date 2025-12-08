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

// Indexes for optimal search performance
// Text index for full-text search across title and singer (artist)
copyrightFreeSongSchema.index({ title: "text", singer: "text" }, { name: "search_text_index" });

// Single field indexes for sorting
copyrightFreeSongSchema.index({ likeCount: -1 }, { name: "like_count_index" }); // For sorting by popularity
copyrightFreeSongSchema.index({ viewCount: -1 }, { name: "view_count_index" }); // For sorting by most viewed
copyrightFreeSongSchema.index({ createdAt: -1 }, { name: "created_at_index" }); // For sorting by newest
copyrightFreeSongSchema.index({ title: 1 }, { name: "title_index" }); // For alphabetical sorting

// Compound indexes for common query patterns
copyrightFreeSongSchema.index({ viewCount: -1, likeCount: -1 }, { name: "popularity_compound_index" }); // For relevance sorting
copyrightFreeSongSchema.index({ createdAt: -1, viewCount: -1 }, { name: "newest_popular_compound_index" }); // For newest with popularity fallback

export const CopyrightFreeSong =
  mongoose.models.CopyrightFreeSong ||
  mongoose.model<ICopyrightFreeSong>("CopyrightFreeSong", copyrightFreeSongSchema);

