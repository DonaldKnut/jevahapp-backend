import mongoose, { Schema, Document } from "mongoose";

export interface IEmbeddedLink {
  url: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  type: "video" | "article" | "resource" | "other";
}

export interface IForumPost {
  forumId: mongoose.Types.ObjectId; // Reference to Forum
  userId: mongoose.Types.ObjectId; // User who created the post
  content: string; // Post content/text
  embeddedLinks?: IEmbeddedLink[]; // Optional embedded links
  tags?: string[]; // Optional tags
  likesCount?: number; // Denormalized count
  commentsCount?: number; // Denormalized count
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IForumPostDocument extends IForumPost, Document {}

const forumPostSchema = new Schema<IForumPostDocument>(
  {
    forumId: { 
      type: Schema.Types.ObjectId, 
      ref: "Forum", 
      required: true 
    },
    userId: { 
      type: Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    content: { 
      type: String, 
      required: true,
      minlength: 1,
      maxlength: 5000,
    },
    embeddedLinks: [
      {
        url: { type: String, required: true },
        title: { type: String, maxlength: 200 },
        description: { type: String, maxlength: 500 },
        thumbnail: { type: String },
        type: { 
          type: String, 
          enum: ["video", "article", "resource", "other"],
          required: true,
        },
      },
    ],
    tags: { 
      type: [String], 
      default: [] 
    },
    likesCount: { 
      type: Number, 
      default: 0 
    },
    commentsCount: { 
      type: Number, 
      default: 0 
    },
  },
  { timestamps: true }
);

forumPostSchema.index({ forumId: 1, createdAt: -1 });
forumPostSchema.index({ userId: 1, createdAt: -1 });
forumPostSchema.index({ createdAt: -1 });
forumPostSchema.index({ tags: 1 });
forumPostSchema.index({ content: "text" }); // Text search index

export const ForumPost =
  mongoose.models.ForumPost || mongoose.model<IForumPostDocument>("ForumPost", forumPostSchema);

