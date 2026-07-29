import mongoose, { Schema, Document } from "mongoose";

export interface IAnnouncement extends Document {
  title: string;
  body: string;
  audience: "all" | "mobile" | "admin" | "creators";
  status: "draft" | "published" | "archived";
  startsAt?: Date | null;
  endsAt?: Date | null;
  createdByAdminId: mongoose.Types.ObjectId;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const announcementSchema = new Schema<IAnnouncement>(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    audience: {
      type: String,
      enum: ["all", "mobile", "admin", "creators"],
      default: "all",
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    createdByAdminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

announcementSchema.index({ status: 1, audience: 1, publishedAt: -1 });

export const Announcement =
  mongoose.models.Announcement ||
  mongoose.model<IAnnouncement>("Announcement", announcementSchema);
