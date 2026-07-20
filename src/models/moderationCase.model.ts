import mongoose, { Document, Schema, Types } from "mongoose";

export interface IModerationCase extends Document {
  mediaId: Types.ObjectId;
  /** SHA-256 of source bytes — enables decision-only reuse across uploads */
  contentHash?: string;
  provider: string;
  modelId?: string;
  promptVersion: string;
  policyVersion: string;
  evidenceHashes: string[];
  modalityCoverage: {
    title?: boolean;
    description?: boolean;
    transcript?: boolean;
    thumbnail?: boolean;
    frames?: boolean;
    frameCount?: number;
  };
  languageCandidates: string[];
  decision: {
    isApproved: boolean;
    confidence: number;
    reason?: string;
    flags: string[];
    requiresReview: boolean;
  };
  scores?: Record<string, number>;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    estimatedCostUsd?: number;
  };
  reviewerOutcome?: {
    status?: "approved" | "rejected" | "pending";
    reviewerId?: Types.ObjectId;
    note?: string;
    reviewedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const moderationCaseSchema = new Schema<IModerationCase>(
  {
    mediaId: { type: Schema.Types.ObjectId, ref: "Media", required: true, index: true },
    contentHash: { type: String, index: true, sparse: true },
    provider: { type: String, default: "google-gemini" },
    modelId: { type: String },
    promptVersion: { type: String, default: "v2-ng-multilingual" },
    policyVersion: { type: String, default: "christian-platform-v2" },
    evidenceHashes: { type: [String], default: [] },
    modalityCoverage: {
      title: Boolean,
      description: Boolean,
      transcript: Boolean,
      thumbnail: Boolean,
      frames: Boolean,
      frameCount: Number,
    },
    languageCandidates: { type: [String], default: [] },
    decision: {
      isApproved: { type: Boolean, required: true },
      confidence: { type: Number, required: true },
      reason: String,
      flags: { type: [String], default: [] },
      requiresReview: { type: Boolean, default: false },
    },
    scores: { type: Schema.Types.Mixed },
    usage: {
      inputTokens: Number,
      outputTokens: Number,
      estimatedCostUsd: Number,
    },
    reviewerOutcome: {
      status: { type: String, enum: ["approved", "rejected", "pending"] },
      reviewerId: { type: Schema.Types.ObjectId, ref: "User" },
      note: String,
      reviewedAt: Date,
    },
  },
  { timestamps: true }
);

moderationCaseSchema.index({ mediaId: 1, createdAt: -1 });
moderationCaseSchema.index(
  {
    contentHash: 1,
    policyVersion: 1,
    promptVersion: 1,
    modelId: 1,
    createdAt: -1,
  },
  { sparse: true }
);

export const ModerationCase =
  mongoose.models.ModerationCase ||
  mongoose.model<IModerationCase>("ModerationCase", moderationCaseSchema);
