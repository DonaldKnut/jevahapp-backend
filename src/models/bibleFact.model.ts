import mongoose, { Schema, Document } from "mongoose";

// TypeScript interface for a Bible Fact
export interface IBibleFact extends Document {
  title: string;
  fact: string;
  scripture: string;
  category: BibleFactCategory;
  tags: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  language: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type BibleFactCategory =
  | "creation"
  | "prophecy"
  | "miracles"
  | "characters"
  | "history"
  | "wisdom"
  | "love"
  | "faith"
  | "hope"
  | "forgiveness"
  | "prayer"
  | "worship"
  | "salvation"
  | "heaven"
  | "angels"
  | "demons"
  | "end_times"
  | "covenants"
  | "law"
  | "grace"
  | "church"
  | "ministry"
  | "family"
  | "relationships"
  | "money"
  | "work"
  | "health"
  | "nature"
  | "science"
  | "culture";

// Mongoose schema definition
const bibleFactSchema = new Schema<IBibleFact>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    fact: {
      type: String,
      required: true,
      maxlength: 500,
    },
    scripture: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: [
        "creation",
        "prophecy",
        "miracles",
        "characters",
        "history",
        "wisdom",
        "love",
        "faith",
        "hope",
        "forgiveness",
        "prayer",
        "worship",
        "salvation",
        "heaven",
        "angels",
        "demons",
        "end_times",
        "covenants",
        "law",
        "grace",
        "church",
        "ministry",
        "family",
        "relationships",
        "money",
        "work",
        "health",
        "nature",
        "science",
        "culture",
      ],
      required: true,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
      index: true,
    },
    language: {
      type: String,
      default: "en",
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Export model
export const BibleFact =
  mongoose.models.BibleFact ||
  mongoose.model<IBibleFact>("BibleFact", bibleFactSchema);
