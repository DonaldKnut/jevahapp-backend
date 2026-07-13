import mongoose, { Schema, Document } from "mongoose";

export interface IShareEvent extends Document {
  userId: mongoose.Types.ObjectId;
  contentId: mongoose.Types.ObjectId;
  contentType: string;
  platform?: string;
  sharedAt: Date;
  createdAt: Date;
}

const shareEventSchema = new Schema<IShareEvent>(
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
      required: true,
      index: true,
    },
    platform: {
      type: String,
      maxlength: 50,
    },
    sharedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

shareEventSchema.index({ userId: 1, contentId: 1 });
shareEventSchema.index({ contentId: 1, contentType: 1 });
shareEventSchema.index({ contentId: 1, platform: 1 });

export const ShareEvent =
  mongoose.models.ShareEvent ||
  mongoose.model<IShareEvent>("ShareEvent", shareEventSchema);
