import mongoose, { Schema, Document } from "mongoose";

export interface IForum {
  title: string;
  description: string;
  createdBy: mongoose.Types.ObjectId; // Admin user ID or creator
  isActive: boolean;
  isCategory?: boolean;
  categoryId?: mongoose.Types.ObjectId | null;
  postsCount?: number; // Denormalized count
  participantsCount?: number; // Denormalized count (unique users who posted)
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IForumDocument extends IForum, Document {}

const forumSchema = new Schema<IForumDocument>(
  {
    title: {
      type: String,
      required: true,
      minlength: 3,
      maxlength: 100,
    },
    description: {
      type: String,
      required: true,
      minlength: 10,
      maxlength: 500,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isCategory: {
      type: Boolean,
      default: false,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Forum",
      default: null,
      index: true,
    },
    postsCount: {
      type: Number,
      default: 0,
    },
    participantsCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

forumSchema.index({ createdAt: -1 });
forumSchema.index({ isActive: 1, createdAt: -1 });
forumSchema.index({ createdBy: 1 });
forumSchema.index(
  { title: 1 },
  {
    unique: true,
    partialFilterExpression: { isCategory: true },
  }
);

export const Forum =
  mongoose.models.Forum || mongoose.model<IForumDocument>("Forum", forumSchema);

