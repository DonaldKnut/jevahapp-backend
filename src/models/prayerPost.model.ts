import mongoose, { Schema, Document } from "mongoose";

export interface IPrayerPost {
  content: string;
  anonymous?: boolean;
  media?: string[];
  authorId: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPrayerPostDocument extends IPrayerPost, Document {}

const prayerPostSchema = new Schema<IPrayerPostDocument>(
  {
    content: { type: String, required: true },
    anonymous: { type: Boolean, default: false },
    media: { type: [String], default: [] },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

prayerPostSchema.index({ createdAt: -1 });
prayerPostSchema.index({ authorId: 1, createdAt: -1 });

export const PrayerPost =
  mongoose.models.PrayerPost ||
  mongoose.model<IPrayerPostDocument>("PrayerPost", prayerPostSchema);



