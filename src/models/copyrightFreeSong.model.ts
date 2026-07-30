import mongoose, { Schema, Document } from "mongoose";

/**
 * Canonical curated/artist Track document.
 * Collection remains `copyrightfreesongs` so mobile likes/views/playlists keep working.
 * Prefer `artistName` / `playbackUrl` / `durationSec` in new code; `singer` / `fileUrl` / `duration` stay as aliases.
 */
export type TrackLane = "curated" | "artist";
export type TrackVisibility = "draft" | "published" | "archived";
export type AudioProcessingStatus =
  | "pending"
  | "processing"
  | "ready"
  | "failed";
export type CopyrightStatus =
  | "copyright_free"
  | "licensed"
  | "original"
  | "unknown";

export interface ICopyrightFreeSong extends Document {
  title: string;
  /** Legacy display artist field — keep in sync with artistName */
  singer: string;
  artistName?: string;
  artistId?: mongoose.Types.ObjectId | null;
  /** Denormalized Artist.slug for FE deep links */
  artistSlug?: string | null;
  albumId?: mongoose.Types.ObjectId | null;
  genre?: string | null;
  category?: string | null;
  language?: string | null;
  duration?: number | null;
  durationSec?: number | null;
  bpm?: number | null;
  isrc?: string | null;

  lane: TrackLane;
  visibility: TrackVisibility;
  copyrightStatus: CopyrightStatus;
  licenseNote?: string | null;

  uploadedBy: mongoose.Types.ObjectId;
  createdByAdminId?: mongoose.Types.ObjectId | null;

  /** Legacy playable URL — keep in sync with audio.playbackUrl */
  fileUrl: string;
  thumbnailUrl?: string | null;

  audio?: {
    originalKey?: string | null;
    originalUrl?: string | null;
    playbackUrl?: string | null;
    format?: string | null;
    bitrateKbps?: number | null;
    fileSizeBytes?: number | null;
    signed?: boolean;
    expiresInSeconds?: number | null;
  };

  artwork?: {
    key?: string | null;
    url?: string | null;
  } | null;

  processing?: {
    status: AudioProcessingStatus;
    error?: string | null;
    waveformUrl?: string | null;
    updatedAt?: Date | null;
  };

  likeCount: number;
  shareCount: number;
  saveCount: number;
  viewCount: number;
  playCount?: number;

  publishedAt?: Date | null;
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
    artistName: {
      type: String,
      trim: true,
      index: true,
    },
    artistId: {
      type: Schema.Types.ObjectId,
      ref: "Artist",
      default: null,
      index: true,
    },
    /** Denormalized for catalog cards / deep links without populate */
    artistSlug: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
      index: true,
    },
    albumId: {
      type: Schema.Types.ObjectId,
      ref: "Album",
      default: null,
    },
    genre: { type: String, trim: true, default: null, index: true },
    category: {
      type: String,
      trim: true,
      index: true,
    },
    language: { type: String, trim: true, default: null },
    duration: { type: Number, default: null },
    durationSec: { type: Number, default: null },
    bpm: { type: Number, default: null },
    isrc: { type: String, trim: true, default: null },

    lane: {
      type: String,
      enum: ["curated", "artist"],
      default: "curated",
      index: true,
    },
    visibility: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "published",
      index: true,
    },
    copyrightStatus: {
      type: String,
      enum: ["copyright_free", "licensed", "original", "unknown"],
      default: "copyright_free",
    },
    licenseNote: { type: String, trim: true, default: null },

    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    createdByAdminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    fileUrl: {
      type: String,
      required: true,
    },
    thumbnailUrl: {
      type: String,
      default: null,
    },

    audio: {
      originalKey: { type: String, default: null },
      originalUrl: { type: String, default: null },
      playbackUrl: { type: String, default: null },
      format: { type: String, default: null },
      bitrateKbps: { type: Number, default: null },
      fileSizeBytes: { type: Number, default: null },
      signed: { type: Boolean, default: false },
      expiresInSeconds: { type: Number, default: null },
    },

    artwork: {
      key: { type: String, default: null },
      url: { type: String, default: null },
    },

    processing: {
      status: {
        type: String,
        enum: ["pending", "processing", "ready", "failed"],
        default: "ready",
        index: true,
      },
      error: { type: String, default: null },
      waveformUrl: { type: String, default: null },
      updatedAt: { type: Date, default: null },
    },

    likeCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
    saveCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    playCount: { type: Number, default: 0 },

    publishedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

copyrightFreeSongSchema.index(
  { title: "text", singer: "text", artistName: "text" },
  { name: "search_text_index" }
);
copyrightFreeSongSchema.index({ likeCount: -1 }, { name: "like_count_index" });
copyrightFreeSongSchema.index({ viewCount: -1 }, { name: "view_count_index" });
copyrightFreeSongSchema.index({ createdAt: -1 }, { name: "created_at_index" });
copyrightFreeSongSchema.index({ title: 1 }, { name: "title_index" });
copyrightFreeSongSchema.index(
  { viewCount: -1, likeCount: -1 },
  { name: "popularity_compound_index" }
);
copyrightFreeSongSchema.index(
  { createdAt: -1, viewCount: -1 },
  { name: "newest_popular_compound_index" }
);
copyrightFreeSongSchema.index(
  { category: 1, viewCount: -1 },
  { name: "category_popularity_index" }
);
copyrightFreeSongSchema.index(
  { lane: 1, visibility: 1, "processing.status": 1, createdAt: -1 },
  { name: "catalog_list_index" }
);
copyrightFreeSongSchema.index(
  { lane: 1, visibility: 1, publishedAt: -1, createdAt: -1 },
  { name: "catalog_published_sort_index" }
);
copyrightFreeSongSchema.index(
  { artistId: 1, lane: 1, visibility: 1, publishedAt: -1 },
  { name: "artist_catalog_index" }
);

/** Sync legacy + preferred fields before save */
copyrightFreeSongSchema.pre("save", function (next) {
  const doc = this as ICopyrightFreeSong;
  if (doc.artistName && !doc.singer) doc.singer = doc.artistName;
  if (doc.singer && !doc.artistName) doc.artistName = doc.singer;
  if (doc.durationSec != null && doc.duration == null) {
    doc.duration = doc.durationSec;
  }
  if (doc.duration != null && doc.durationSec == null) {
    doc.durationSec = doc.duration;
  }
  const playback = doc.audio?.playbackUrl;
  if (playback && (!doc.fileUrl || doc.fileUrl.startsWith("pending://"))) {
    doc.fileUrl = playback;
  }
  if (doc.fileUrl && doc.audio && !doc.audio.playbackUrl) {
    doc.audio.playbackUrl = doc.fileUrl;
  }
  if (doc.artwork?.url && !doc.thumbnailUrl) {
    doc.thumbnailUrl = doc.artwork.url;
  }
  if (doc.thumbnailUrl && doc.artwork && !doc.artwork.url) {
    doc.artwork.url = doc.thumbnailUrl;
  }
  next();
});

export const CopyrightFreeSong =
  mongoose.models.CopyrightFreeSong ||
  mongoose.model<ICopyrightFreeSong>(
    "CopyrightFreeSong",
    copyrightFreeSongSchema
  );

/** Alias for Phase 1+ catalog code */
export const Track = CopyrightFreeSong;
export type ITrack = ICopyrightFreeSong;
