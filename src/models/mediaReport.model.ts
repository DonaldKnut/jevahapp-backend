import mongoose, { Schema, Document } from "mongoose";

export type ReportStatus = "pending" | "reviewed" | "resolved" | "dismissed";
export type ReportReason = 
  | "inappropriate_content"
  | "non_gospel_content"
  | "explicit_language"
  | "violence"
  | "sexual_content"
  | "blasphemy"
  | "spam"
  | "copyright"
  | "other";

export interface IMediaReport extends Document {
  mediaId: mongoose.Types.ObjectId;
  reportedBy: mongoose.Types.ObjectId;
  reason: ReportReason;
  description?: string;
  status: ReportStatus;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const mediaReportSchema = new Schema<IMediaReport>(
  {
    mediaId: {
      type: Schema.Types.ObjectId,
      ref: "Media",
      required: true,
      index: true,
    },
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reason: {
      type: String,
      enum: [
        "inappropriate_content",
        "non_gospel_content",
        "explicit_language",
        "violence",
        "sexual_content",
        "blasphemy",
        "spam",
        "copyright",
        "other",
      ],
      required: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ["pending", "reviewed", "resolved", "dismissed"],
      default: "pending",
      index: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
    adminNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
mediaReportSchema.index({ mediaId: 1, reportedBy: 1 }); // Prevent duplicate reports
mediaReportSchema.index({ status: 1, createdAt: -1 }); // For admin dashboard
mediaReportSchema.index({ mediaId: 1, status: 1 }); // For media-specific reports

export const MediaReport =
  mongoose.models.MediaReport ||
  mongoose.model<IMediaReport>("MediaReport", mediaReportSchema);


