import mongoose, { Schema, Document } from "mongoose";

export interface ILike extends Document {
    userId: mongoose.Types.ObjectId;
    contentId: mongoose.Types.ObjectId;
    contentType: "media" | "artist" | "merch" | "ebook" | "podcast";
    createdAt: Date;
}

const likeSchema = new Schema<ILike>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        contentId: {
            type: Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        contentType: {
            type: String,
            enum: ["media", "artist", "merch", "ebook", "podcast"],
            required: true,
            index: true,
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    }
);

// CRITICAL: Compound unique index to prevent duplicate likes at the DB level
likeSchema.index({ contentId: 1, userId: 1 }, { unique: true });

export const Like = mongoose.models.Like || mongoose.model<ILike>("Like", likeSchema);
