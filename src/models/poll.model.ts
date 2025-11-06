import mongoose, { Schema, Document } from "mongoose";

export interface IPollVote {
  userId: mongoose.Types.ObjectId;
  optionIndexes: number[]; // supports multi-select
  votedAt: Date;
}

export interface IPoll {
  question: string;
  title?: string; // Alias for question
  description?: string; // Optional description
  options: string[];
  multiSelect?: boolean;
  closesAt?: Date | null;
  expiresAt?: Date | null; // Alias for closesAt
  authorId: mongoose.Types.ObjectId;
  votes: IPollVote[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPollDocument extends IPoll, Document {}

const pollSchema = new Schema<IPollDocument>(
  {
    question: { 
      type: String, 
      required: true,
      minlength: 5,
      maxlength: 200,
    },
    title: { type: String }, // Alias, will sync with question
    description: { 
      type: String, 
      maxlength: 500,
    },
    options: { 
      type: [String], 
      required: true, 
      validate: (v: any) => Array.isArray(v) && v.length >= 2 && v.length <= 10,
    },
    multiSelect: { type: Boolean, default: false },
    closesAt: { type: Date },
    expiresAt: { type: Date }, // Alias, will sync with closesAt
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

// Sync title with question
pollSchema.pre("save", function(next) {
  if (this.title && !this.question) {
    this.question = this.title;
  } else if (this.question && !this.title) {
    this.title = this.question;
  }
  // Sync expiresAt with closesAt
  if (this.expiresAt && !this.closesAt) {
    this.closesAt = this.expiresAt;
  } else if (this.closesAt && !this.expiresAt) {
    this.expiresAt = this.closesAt;
  }
  next();
});

pollSchema.index({ createdAt: -1 });
pollSchema.index({ closesAt: 1 });
pollSchema.index({ authorId: 1, createdAt: -1 });

export const Poll =
  mongoose.models.Poll || mongoose.model<IPollDocument>("Poll", pollSchema);



