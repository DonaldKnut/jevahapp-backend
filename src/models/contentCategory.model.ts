import mongoose, { Schema, Document } from "mongoose";

export interface IContentCategory extends Document {
  key: string;
  label: string;
  kind: "media" | "audio" | "both";
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const contentCategorySchema = new Schema<IContentCategory>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    label: { type: String, required: true, trim: true },
    kind: {
      type: String,
      enum: ["media", "audio", "both"],
      default: "both",
      index: true,
    },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const ContentCategory =
  mongoose.models.ContentCategory ||
  mongoose.model<IContentCategory>("ContentCategory", contentCategorySchema);
