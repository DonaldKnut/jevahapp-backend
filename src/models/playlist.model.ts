import mongoose, { Schema, Document } from "mongoose";

export interface IPlaylist extends Document {
  name: string;
  description?: string;
  userId: mongoose.Types.ObjectId;
  isPublic: boolean;
  tracks: {
    mediaId?: mongoose.Types.ObjectId; // For regular Media items
    copyrightFreeSongId?: mongoose.Types.ObjectId; // For copyright-free songs
    trackType: "media" | "copyrightFree"; // Type discriminator
    addedAt: Date;
    addedBy: mongoose.Types.ObjectId;
    order: number; // Position in playlist
    notes?: string; // Optional user notes for this track
  }[];
  coverImageUrl?: string; // Custom playlist cover image
  totalTracks: number; // Denormalized count for performance
  totalDuration?: number; // Total duration in seconds (denormalized)
  playCount: number; // How many times playlist was played
  lastPlayedAt?: Date;
  tags?: string[]; // For categorization
  isDefault?: boolean; // Default playlists like "Favorites", "Recently Played"
  createdAt: Date;
  updatedAt: Date;
}

const playlistTrackSchema = new Schema(
  {
    // Content reference - one required (polymorphic)
    mediaId: {
      type: Schema.Types.ObjectId,
      ref: "Media",
      required: false,
    },
    copyrightFreeSongId: {
      type: Schema.Types.ObjectId,
      ref: "CopyrightFreeSong",
      required: false,
    },
    // Type discriminator (required)
    trackType: {
      type: String,
      enum: ["media", "copyrightFree"],
      required: true,
      index: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
    addedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    order: {
      type: Number,
      required: true,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { _id: false }
);

// Professional validation: Ensure exactly one content reference matches trackType
playlistTrackSchema.pre("validate", function (next) {
  const hasMedia = !!this.mediaId;
  const hasCopyrightFree = !!this.copyrightFreeSongId;
  
  // Must have exactly one
  if (!hasMedia && !hasCopyrightFree) {
    return next(new Error("Track must have either mediaId or copyrightFreeSongId"));
  }
  
  if (hasMedia && hasCopyrightFree) {
    return next(new Error("Track cannot have both mediaId and copyrightFreeSongId"));
  }
  
  // Validate trackType matches content reference
  if (this.trackType === "media" && !hasMedia) {
    return next(new Error("trackType 'media' requires mediaId"));
  }
  
  if (this.trackType === "copyrightFree" && !hasCopyrightFree) {
    return next(new Error("trackType 'copyrightFree' requires copyrightFreeSongId"));
  }
  
  next();
});

const playlistSchema = new Schema<IPlaylist>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    tracks: [playlistTrackSchema],
    coverImageUrl: {
      type: String,
    },
    totalTracks: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalDuration: {
      type: Number,
      min: 0,
    },
    playCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastPlayedAt: {
      type: Date,
    },
    tags: {
      type: [String],
      default: [],
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
playlistSchema.index({ userId: 1, createdAt: -1 });
playlistSchema.index({ userId: 1, name: 1 }); // For finding playlists by name
playlistSchema.index({ isPublic: 1, playCount: -1 }); // For public playlist discovery
playlistSchema.index({ "tracks.mediaId": 1 }); // For finding which playlists contain a media track
playlistSchema.index({ "tracks.copyrightFreeSongId": 1 }); // For finding which playlists contain a copyright-free song
playlistSchema.index({ "tracks.trackType": 1 }); // For filtering by track type

// Pre-save middleware to update totalTracks
playlistSchema.pre("save", function (next) {
  this.totalTracks = this.tracks ? this.tracks.length : 0;
  next();
});

// Virtual for calculating total duration (can be computed on-demand)
playlistSchema.virtual("calculatedDuration").get(async function () {
  if (!this.tracks || this.tracks.length === 0) return 0;

  const Media = mongoose.model("Media");
  const mediaIds = this.tracks.map((t: any) => t.mediaId);
  
  const mediaItems = await Media.find({ _id: { $in: mediaIds } }).select("duration");
  return mediaItems.reduce((total: number, media: any) => {
    return total + (media.duration || 0);
  }, 0);
});

export const Playlist =
  mongoose.models.Playlist ||
  mongoose.model<IPlaylist>("Playlist", playlistSchema);


