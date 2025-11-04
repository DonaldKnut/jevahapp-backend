import mongoose, { Schema, Document } from "mongoose";

export interface IForumThread {
  title: string;
  body: string;
  tags?: string[];
  authorId: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IForumThreadDocument extends IForumThread, Document {}

const forumThreadSchema = new Schema<IForumThreadDocument>(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    tags: { type: [String], default: [] },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

forumThreadSchema.index({ updatedAt: -1 });
forumThreadSchema.index({ tags: 1 });
forumThreadSchema.index({ authorId: 1, createdAt: -1 });

export const ForumThread =
  mongoose.models.ForumThread ||
  mongoose.model<IForumThreadDocument>("ForumThread", forumThreadSchema);



