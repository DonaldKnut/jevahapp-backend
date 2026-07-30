import mongoose, { Schema, Document } from "mongoose";

// Define media content types
export type MediaContentType =
  | "music"
  | "videos"
  | "ebook"
  | "podcast"
  | "devotional"
  | "sermon"
  | "live"
  | "recording"
  | "audio"
  | "merch";

// Define live stream status
export type LiveStreamStatus = "scheduled" | "live" | "ended" | "archived";

// Define recording status
export type RecordingStatus =
  | "recording"
  | "processing"
  | "completed"
  | "failed";

// Define the Media interface for TypeScript
export interface IMedia extends Document {
  title: string;
  description?: string;
  contentType: MediaContentType;
  category?: string;
  fileUrl: string;
  fileMimeType?: string;
  fileObjectKey?: string; // Cloudflare R2 object key for the main file (needed to delete from storage)
  thumbnailUrl?: string; // Thumbnail for media
  thumbnailObjectKey?: string; // Cloudflare R2 object key for the thumbnail (needed to delete from storage)
  previewUrl?: string; // Preview/teaser video
  coverImageUrl?: string; // Cover image for ebooks/merch
  // TTS (Text-to-Speech) fields for ebooks
  ttsAudioUrl?: string; // URL to generated TTS audio file
  ttsAudioObjectKey?: string; // Cloudflare R2 object key for TTS audio
  ttsVoice?: string; // Voice used for TTS (e.g., "en-US-female-1")
  ttsLanguageCode?: string; // Language code (e.g., "en-US")
  ttsGeneratedAt?: Date; // When TTS was generated
  topics?: string[];
  uploadedBy: mongoose.Types.ObjectId;
  viewCount: number;
  listenCount: number;
  readCount: number;
  downloadCount: number;
  favoriteCount: number;
  shareCount: number;
  likeCount: number;
  commentCount: number;
  bookmarkCount: number; // Added for atomic save tracking
  isLive?: boolean;
  liveStreamStatus?: LiveStreamStatus;
  streamKey?: string;
  streamId?: string; // New field for Contabo stream ID
  playbackUrl?: string;
  hlsUrl?: string; // New field for HLS URL
  dashUrl?: string; // New field for DASH URL
  derivatives?: Array<{
    kind: "mp4" | "hls";
    objectKey: string;
    url: string;
    width?: number;
    height?: number;
    videoCodec?: string;
    audioCodec?: string;
    bitrate?: number;
  }>;
  processingMetadata?: {
    sourceWidth?: number;
    sourceHeight?: number;
    durationSeconds?: number;
    videoCodec?: string;
    audioCodec?: string;
    verifiedAt?: Date;
  };
  rtmpUrl?: string;
  // Recording fields
  isRecording?: boolean;
  recordingStatus?: RecordingStatus;
  r2Url?: string; // Cloudflare R2 URL for recorded content
  fileSize?: number; // Size of recorded file in bytes
  scheduledStart?: Date;
  scheduledEnd?: Date;
  actualStart?: Date;
  actualEnd?: Date;
  concurrentViewers?: number;
  duration?: number;
  // New fields for enhanced functionality
  isDownloadable?: boolean;
  downloadUrl?: string;
  shareUrl?: string;
  viewThreshold?: number; // Minimum seconds to count as a view

  // Merchandise fields
  price?: number;
  currency?: string;
  stockQuantity?: number;
  isAvailable?: boolean;
  merchCategory?: string; // Renamed to avoid conflict with existing category
  tags?: string[];

  // Analytics fields
  totalViews?: number;
  totalLikes?: number;
  totalShares?: number;
  totalDownloads?: number;
  averageWatchTime?: number;
  completionRate?: number;

  // Library fields
  isInLibrary?: boolean;
  libraryAddedAt?: Date;

  // Default content fields
  isDefaultContent?: boolean;
  isOnboardingContent?: boolean;

  // Copyright-free audio library fields (YouTube Audio Library style)
  isPublicDomain?: boolean; // For copyright-free songs
  speaker?: string; // For audio content (speaker/preacher/artist name)
  /** Sermon teaching metadata (contentType=sermon) */
  church?: string | null;
  scripture?: string | null;
  series?: string | null;
  /** Prefer explicit media kind for public sermons catalog */
  mediaType?: "audio" | "video" | null;
  language?: string | null;
  year?: number; // Year of creation/release

  // Content moderation fields
  moderationStatus?: "pending" | "approved" | "rejected" | "under_review";
  moderationResult?: {
    isApproved: boolean;
    confidence: number;
    reason?: string;
    flags: string[];
    requiresReview: boolean;
    moderatedAt?: Date;
  };
  /** Free-text notes from admin review (approve/reject/hold or metadata edit). */
  adminModerationNotes?: string;
  moderationAssignee?: mongoose.Types.ObjectId | null;
  moderationNoteThread?: Array<{
    body: string;
    authorId?: mongoose.Types.ObjectId;
    authorEmail?: string;
    createdAt?: Date;
  }>;
  reportCount?: number;
  isHidden?: boolean; // Hidden from public view due to reports/moderation
  /** SHA-256 of source file bytes for moderation decision reuse (not object sharing). */
  contentHash?: string;
  /** Cache-busting publication version — increments on each reprocess. */
  assetVersion?: number;
  publicationState?:
    | "draft"
    | "staged"
    | "publishing"
    | "live"
    | "tombstoned";
  publishedAt?: Date;
  /** Absolute R2 prefix for this live version, e.g. media/{id}/v3 */
  storagePrefix?: string;
  derivativeKeys?: string[];

  /**
   * Background processing state (BullMQ worker).
   * This keeps async post-upload tasks observable and debuggable.
   */
  processing?: {
    status?:
      | "idle"
      | "queued"
      | "uploaded"
      | "moderating"
      | "awaiting_review"
      | "transcoding"
      | "processing"
      | "ready"
      | "completed"
      | "rejected"
      | "failed";
    jobType?: string;
    updatedAt?: Date;
    error?: string;
    attempts?: number;
    progress?: number;
    jobId?: string;
  };

  /** Staging / direct-upload intent metadata (private until ready). */
  uploadIntent?: {
    intentId?: string;
    stagingKey?: string;
    thumbnailStagingKey?: string;
    checksum?: string;
    declaredSize?: number;
    declaredMime?: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

// Define the Mongoose schema
const mediaSchema = new Schema<IMedia>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    contentType: {
      type: String,
      enum: [
        "music",
        "videos",
        "books",
        "live",
        "recording",
        "audio",
        "merch",
        "ebook",
        "podcast",
        "devotional",
        "sermon",
      ],
      required: true,
    },
    category: {
      type: String,
      trim: true,
      enum: [
        "worship",
        "inspiration",
        "youth",
        "teachings",
        "marriage",
        "counselling",
      ],
    },
    fileUrl: {
      type: String,
      required: function () {
        return this.contentType !== "live";
      },
    },
    // Cloudflare R2 object key for the main file (needed to delete from storage)
    fileObjectKey: {
      type: String,
    },
    fileMimeType: {
      type: String,
    },
    thumbnailUrl: {
      type: String,
      required: function () {
        return this.contentType !== "live"; // Thumbnail required for music, videos, books
      },
    },
    // Cloudflare R2 object key for the thumbnail (needed to delete from storage)
    thumbnailObjectKey: {
      type: String,
    },
    previewUrl: {
      type: String,
    },
    coverImageUrl: {
      type: String,
    },
    // TTS (Text-to-Speech) fields for ebooks
    ttsAudioUrl: {
      type: String,
    },
    ttsAudioObjectKey: {
      type: String,
    },
    ttsVoice: {
      type: String,
    },
    ttsLanguageCode: {
      type: String,
    },
    ttsGeneratedAt: {
      type: Date,
    },
    topics: {
      type: [String],
      default: [],
      validate: {
        validator: function (tags: string[]) {
          const allowedTopics = [
            "faith",
            "healing",
            "grace",
            "prayer",
            "maturity",
            "spiritual growth",
            "worship",
            "inspiration",
            "gospel",
            "sunday-service",
            "christian",
            "bible study",
            "testimony",
            "evangelism",
            "family",
            "marriage",
            "youth",
            "children",
            "music ministry",
            "praise",
            "sermon",
            "teaching",
            "discipleship",
            "leadership",
            "community",
            "outreach",
            "missions",
            "prayer meeting",
            "bible study",
            "fellowship",
            "celebration",
            "repentance",
            "forgiveness",
            "love",
            "hope",
            "joy",
            "peace",
            "patience",
            "kindness",
            "goodness",
            "faithfulness",
            "gentleness",
            "self-control"
          ];
          return tags.every(tag => allowedTopics.includes(tag.toLowerCase()));
        },
        message: props => `Invalid topics: ${props.value}`,
      },
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    listenCount: {
      type: Number,
      default: 0,
    },
    readCount: {
      type: Number,
      default: 0,
    },
    downloadCount: {
      type: Number,
      default: 0,
    },
    favoriteCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    isLive: {
      type: Boolean,
      default: false,
    },
    liveStreamStatus: {
      type: String,
      enum: ["scheduled", "live", "ended", "archived"],
    },
    streamKey: {
      type: String,
      unique: true,
      sparse: true,
    },
    playbackUrl: {
      type: String,
    },
    hlsUrl: {
      type: String,
    },
    derivatives: [
      {
        kind: { type: String, enum: ["mp4", "hls"], required: true },
        objectKey: { type: String, required: true },
        url: { type: String, required: true },
        width: Number,
        height: Number,
        videoCodec: String,
        audioCodec: String,
        bitrate: Number,
      },
    ],
    processingMetadata: {
      sourceWidth: Number,
      sourceHeight: Number,
      durationSeconds: Number,
      videoCodec: String,
      audioCodec: String,
      verifiedAt: Date,
    },
    dashUrl: {
      type: String,
    },
    rtmpUrl: {
      type: String,
    },
    // Recording fields
    isRecording: {
      type: Boolean,
      default: false,
    },
    recordingStatus: {
      type: String,
      enum: ["recording", "processing", "completed", "failed"],
    },
    r2Url: {
      type: String,
    },
    fileSize: {
      type: Number,
      min: 0,
    },
    scheduledStart: {
      type: Date,
    },
    scheduledEnd: {
      type: Date,
    },
    actualStart: {
      type: Date,
    },
    actualEnd: {
      type: Date,
    },
    concurrentViewers: {
      type: Number,
      default: 0,
    },
    duration: {
      type: Number,
      min: 0,
    },
    // New fields for enhanced functionality
    isDownloadable: {
      type: Boolean,
      default: false, // Only artists can make content downloadable
    },
    downloadUrl: {
      type: String,
      // Will be generated for downloadable content
    },
    shareUrl: {
      type: String,
      // Will be generated for sharing
    },
    viewThreshold: {
      type: Number,
      default: 30, // 30 seconds minimum to count as a view
      min: 5,
      max: 300,
    },
    // Merchandise fields
    price: {
      type: Number,
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
    },
    stockQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    merchCategory: {
      type: String,
    },
    tags: {
      type: [String],
      default: [],
    },
    // Analytics fields
    totalViews: {
      type: Number,
      default: 0,
    },
    totalLikes: {
      type: Number,
      default: 0,
    },
    totalShares: {
      type: Number,
      default: 0,
    },
    totalDownloads: {
      type: Number,
      default: 0,
    },
    averageWatchTime: {
      type: Number,
      default: 0,
    },
    completionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    // Library fields
    isInLibrary: {
      type: Boolean,
      default: false,
    },
    libraryAddedAt: {
      type: Date,
    },
    // Default content fields
    isDefaultContent: {
      type: Boolean,
      default: false,
    },
    isOnboardingContent: {
      type: Boolean,
      default: false,
    },
    // Copyright-free audio library fields (YouTube Audio Library style)
    isPublicDomain: {
      type: Boolean,
      default: false,
      index: true,
    },
    speaker: {
      type: String,
      trim: true,
    },
    church: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    scripture: {
      type: String,
      trim: true,
      default: null,
    },
    series: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    mediaType: {
      type: String,
      enum: ["audio", "video"],
      default: undefined,
    },
    language: {
      type: String,
      trim: true,
      default: "en",
      index: true,
    },
    year: {
      type: Number,
      min: 1000,
      max: new Date().getFullYear() + 1,
    },
    // Content moderation fields
    moderationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "under_review"],
      default: "pending",
      index: true,
    },
    contentHash: {
      type: String,
      index: true,
      sparse: true,
    },
    assetVersion: {
      type: Number,
      default: 0,
      min: 0,
    },
    publicationState: {
      type: String,
      enum: ["draft", "staged", "publishing", "live", "tombstoned"],
      default: "draft",
      index: true,
    },
    publishedAt: { type: Date },
    storagePrefix: { type: String },
    derivativeKeys: { type: [String], default: [] },
    moderationResult: {
      isApproved: {
        type: Boolean,
        default: false,
      },
      confidence: {
        type: Number,
        min: 0,
        max: 1,
      },
      reason: {
        type: String,
      },
      flags: {
        type: [String],
        default: [],
      },
      requiresReview: {
        type: Boolean,
        default: false,
      },
      moderatedAt: {
        type: Date,
      },
    },
    adminModerationNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    /** Queue assignment — admin user currently owning this review */
    moderationAssignee: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    /** Append-only admin notes thread (does not replace adminModerationNotes) */
    moderationNoteThread: [
      {
        body: { type: String, required: true, maxlength: 2000 },
        authorId: { type: Schema.Types.ObjectId, ref: "User" },
        authorEmail: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    reportCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isHidden: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Background processing (BullMQ)
    processing: {
      status: {
        type: String,
        enum: [
          "idle",
          "queued",
          "uploaded",
          "moderating",
          "awaiting_review",
          "transcoding",
          "processing",
          "ready",
          "completed",
          "rejected",
          "failed",
        ],
        default: "idle",
        index: true,
      },
      jobType: { type: String },
      updatedAt: { type: Date },
      error: { type: String },
      attempts: { type: Number, default: 0 },
      progress: { type: Number, min: 0, max: 100 },
      jobId: { type: String },
    },

    uploadIntent: {
      intentId: { type: String, index: true },
      stagingKey: { type: String },
      thumbnailStagingKey: { type: String },
      checksum: { type: String },
      declaredSize: { type: Number },
      declaredMime: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
mediaSchema.index({ isLive: 1, liveStreamStatus: 1 });
mediaSchema.index({
  title: "text",
  category: 1,
  contentType: 1,
  uploadedBy: 1,
  createdAt: 1,
});
mediaSchema.index({ isDownloadable: 1 });
mediaSchema.index({ shareUrl: 1 });
// Global feed: moderation + visibility + recency
mediaSchema.index(
  { moderationStatus: 1, isHidden: 1, createdAt: -1 },
  { name: "media_feed_moderation_createdAt" }
);
// Profile media grids
mediaSchema.index(
  { uploadedBy: 1, contentType: 1, createdAt: -1 },
  { name: "media_uploader_type_createdAt" }
);

export const Media =
  mongoose.models.Media || mongoose.model<IMedia>("Media", mediaSchema);
