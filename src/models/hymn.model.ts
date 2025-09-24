import mongoose, { Schema, Document } from "mongoose";

export interface IHymn extends Document {
  title: string;
  author: string;
  composer?: string;
  year?: number;
  category: string;
  lyrics: string[];
  audioUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  hymnNumber?: string;
  meter?: string;
  key?: string;
  scripture: string[];
  tags: string[];
  source: "hymnary" | "openhymnal" | "manual";
  externalId: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  bookmarkCount: number;
  isActive: boolean;
  // Hymnary.org specific fields
  hymnaryData?: {
    textLink?: string;
    placeOfOrigin?: string;
    originalLanguage?: string;
    numberOfHymnals?: number;
    roles?: Array<{
      name: string;
      role: string;
    }>;
  };
  createdAt: Date;
  updatedAt: Date;
}

const hymnSchema = new Schema<IHymn>(
  {
    title: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    author: {
      type: String,
      required: true,
      trim: true,
    },
    composer: {
      type: String,
      trim: true,
    },
    year: {
      type: Number,
      min: 1000,
      max: new Date().getFullYear(),
    },
    category: {
      type: String,
      required: true,
      enum: [
        "praise",
        "worship",
        "traditional",
        "contemporary",
        "gospel",
        "christmas",
        "easter",
      ],
      index: true,
    },
    lyrics: [
      {
        type: String,
        trim: true,
      },
    ],
    audioUrl: {
      type: String,
      validate: {
        validator: function (v: string) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: "Audio URL must be a valid HTTP/HTTPS URL",
      },
    },
    thumbnailUrl: {
      type: String,
      validate: {
        validator: function (v: string) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: "Thumbnail URL must be a valid HTTP/HTTPS URL",
      },
    },
    duration: {
      type: Number,
      min: 0,
    },
    hymnNumber: {
      type: String,
      trim: true,
    },
    meter: {
      type: String,
      trim: true,
    },
    key: {
      type: String,
      trim: true,
    },
    scripture: [
      {
        type: String,
        trim: true,
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
        index: true,
      },
    ],
    source: {
      type: String,
      enum: ["hymnary", "openhymnal", "manual"],
      default: "manual",
      index: true,
    },
    externalId: {
      type: String,
      index: true,
      unique: true,
      sparse: true,
    },
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    likeCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    commentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    shareCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    bookmarkCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    // Hymnary.org specific fields
    hymnaryData: {
      textLink: String,
      placeOfOrigin: String,
      originalLanguage: String,
      numberOfHymnals: Number,
      roles: [
        {
          name: String,
          role: String,
        },
      ],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better performance
hymnSchema.index({ title: "text", author: "text", lyrics: "text" });
hymnSchema.index({ category: 1, isActive: 1 });
hymnSchema.index({ source: 1, externalId: 1 });
hymnSchema.index({ scripture: 1 });
hymnSchema.index({ tags: 1 });
hymnSchema.index({ viewCount: -1 });
hymnSchema.index({ likeCount: -1 });
hymnSchema.index({ createdAt: -1 });

// Virtual for total interactions
hymnSchema.virtual("totalInteractions").get(function () {
  return (
    this.likeCount + this.commentCount + this.shareCount + this.bookmarkCount
  );
});

// Pre-save middleware
hymnSchema.pre("save", function (next) {
  // Ensure externalId is unique per source
  if (this.isNew && this.externalId) {
    this.externalId = `${this.source}-${this.externalId}`;
  }
  next();
});

export const Hymn =
  mongoose.models.Hymn || mongoose.model<IHymn>("Hymn", hymnSchema);

