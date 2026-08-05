import mongoose, { Schema, Document } from "mongoose";

/**
 * Spotify-for-Artists style catalog release (single / EP / album / mixtape).
 * Tracks attach via CopyrightFreeSong.releaseId + trackNumber.
 * DSP export (Amuse-like) is out of scope — see DistributionProvider stub.
 */
export type ReleaseType = "single" | "ep" | "album" | "mixtape";
export type ReleaseStatus = "draft" | "scheduled" | "published" | "archived";

export interface IRelease extends Document {
  artistId: mongoose.Types.ObjectId;
  artistSlug?: string | null;
  title: string;
  slug: string;
  type: ReleaseType;
  description?: string | null;
  label?: string | null;
  upc?: string | null;
  releaseDate?: Date | null;
  scheduledAt?: Date | null;
  publishedAt?: Date | null;
  status: ReleaseStatus;
  /** Creator releases always artist lane */
  lane: "artist";
  artwork?: {
    key?: string | null;
    url?: string | null;
  } | null;
  createdByUserId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const releaseSchema = new Schema<IRelease>(
  {
    artistId: {
      type: Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
      index: true,
    },
    artistSlug: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["single", "ep", "album", "mixtape"],
      required: true,
      default: "single",
      index: true,
    },
    description: { type: String, default: null },
    label: { type: String, trim: true, default: null },
    upc: { type: String, trim: true, default: null },
    releaseDate: { type: Date, default: null },
    scheduledAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["draft", "scheduled", "published", "archived"],
      default: "draft",
      index: true,
    },
    lane: {
      type: String,
      enum: ["artist"],
      default: "artist",
      index: true,
    },
    artwork: {
      key: { type: String, default: null },
      url: { type: String, default: null },
    },
    createdByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

releaseSchema.index(
  { slug: 1 },
  { unique: true, name: "release_slug_global_unique" }
);
releaseSchema.index(
  { artistId: 1, status: 1, publishedAt: -1, createdAt: -1 },
  { name: "artist_discography_index" }
);
releaseSchema.index(
  { status: 1, scheduledAt: 1 },
  { name: "release_schedule_index" }
);

export function slugifyReleaseTitle(title: string): string {
  let slug =
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || `release-${Date.now()}`;
  if (slug.length < 3) {
    slug = `${slug}-rel`.slice(0, 80);
  }
  return slug;
}

/** Soft track-count guidance (enforced lightly on publish) */
export const RELEASE_TYPE_TRACK_HINTS: Record<
  ReleaseType,
  { min: number; max: number }
> = {
  single: { min: 1, max: 1 },
  ep: { min: 2, max: 6 },
  album: { min: 7, max: 40 },
  mixtape: { min: 7, max: 40 },
};

export const Release =
  mongoose.models.Release ||
  mongoose.model<IRelease>("Release", releaseSchema);
