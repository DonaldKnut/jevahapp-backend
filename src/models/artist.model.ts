import mongoose, { Schema, Document } from "mongoose";

export type ArtistStatus = "pending" | "active" | "suspended";
export type CreatorType = "artist" | "minister" | "podcaster";

/**
 * Phase 2 catalog entity. Phase 1: admins can stub/register; users apply via /api/creators/apply.
 * Do not fork a second songs system — tracks reference artistId when lane=artist.
 */
export interface IArtist extends Document {
  userId?: mongoose.Types.ObjectId | null;
  displayName: string;
  slug: string;
  bio?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  location?: string | null;
  genres: string[];
  creatorTypes: CreatorType[];
  isVerified: boolean;
  status: ArtistStatus;
  socials?: {
    spotify?: string;
    youtube?: string;
    instagram?: string;
    twitter?: string;
    tiktok?: string;
    website?: string;
  };
  applicationNote?: string | null;
  reviewedByAdminId?: mongoose.Types.ObjectId | null;
  reviewedAt?: Date | null;
  /** Last time admin sent an artist onboard / welcome email for this profile. */
  onboardEmailSentAt?: Date | null;
  avatarPendingKey?: string | null;
  bannerPendingKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const artistSchema = new Schema<IArtist>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    displayName: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    bio: { type: String, default: null },
    avatarUrl: { type: String, default: null },
    bannerUrl: { type: String, default: null },
    location: { type: String, default: null, trim: true, maxlength: 120 },
    genres: { type: [String], default: [] },
    creatorTypes: {
      type: [String],
      enum: ["artist", "minister", "podcaster"],
      default: ["artist"],
    },
    isVerified: { type: Boolean, default: false, index: true },
    status: {
      type: String,
      enum: ["pending", "active", "suspended"],
      default: "pending",
      index: true,
    },
    socials: {
      spotify: String,
      youtube: String,
      instagram: String,
      twitter: String,
      tiktok: String,
      website: String,
    },
    applicationNote: { type: String, default: null },
    reviewedByAdminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    onboardEmailSentAt: { type: Date, default: null, index: true },
    avatarPendingKey: { type: String, default: null },
    bannerPendingKey: { type: String, default: null },
  },
  { timestamps: true }
);

artistSchema.index({ displayName: "text", bio: "text" });
artistSchema.index({ status: 1, isVerified: 1, createdAt: -1 });

export function slugifyArtistName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || `artist-${Date.now()}`;
}

export const Artist =
  mongoose.models.Artist || mongoose.model<IArtist>("Artist", artistSchema);
