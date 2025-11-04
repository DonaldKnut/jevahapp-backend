import mongoose, { Schema, Document } from "mongoose";

export interface IPollVote {
  userId: mongoose.Types.ObjectId;
  optionIndexes: number[]; // supports multi-select
  votedAt: Date;
}

export interface IPoll {
  question: string;
  options: string[];
  multiSelect?: boolean;
  closesAt?: Date | null;
  authorId: mongoose.Types.ObjectId;
  votes: IPollVote[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPollDocument extends IPoll, Document {}

const pollSchema = new Schema<IPollDocument>(
  {
    question: { type: String, required: true },
    options: { type: [String], required: true, validate: v => Array.isArray(v) && v.length >= 2 },
    multiSelect: { type: Boolean, default: false },
    closesAt: { type: Date },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    votes: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        optionIndexes: { type: [Number], required: true },
        votedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

pollSchema.index({ createdAt: -1 });
pollSchema.index({ closesAt: 1 });
pollSchema.index({ authorId: 1, createdAt: -1 });

export const Poll =
  mongoose.models.Poll || mongoose.model<IPollDocument>("Poll", pollSchema);



