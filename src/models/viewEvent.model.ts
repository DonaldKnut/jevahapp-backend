import mongoose, { Schema, Document } from "mongoose";

export type ViewContentType =
  | "media"
  | "devotional"
  | "ebook"
  | "podcast"
  | "merch"
  | "artist";

export interface IViewEvent extends Document {
  contentId: mongoose.Types.ObjectId;
  contentType: ViewContentType;
  userId?: mongoose.Types.ObjectId | null;
  deviceId?: string | null;
  sessionId?: string | null;
  windowKey: number;
  viewedAt: Date;
  durationMs?: number;
  progressPct?: number; // normalized 0..1
  isComplete?: boolean;
  source?: string;
}

const viewEventSchema = new Schema<IViewEvent>(
  {
    contentId: { type: Schema.Types.ObjectId, required: true, index: true },
    contentType: {
      type: String,
      required: true,
      enum: ["media", "devotional", "ebook", "podcast", "merch", "artist"],
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    deviceId: { type: String, default: null, index: true },
    sessionId: { type: String, default: null, index: true },
    windowKey: { type: Number, required: true, index: true },
    viewedAt: { type: Date, required: true, index: true },
    durationMs: { type: Number },
    progressPct: { type: Number, min: 0, max: 1 },
    isComplete: { type: Boolean, default: false },
    source: { type: String },
  },
  { timestamps: false }
);

// Analytics index (per spec): (contentType, contentId, viewedAt)
viewEventSchema.index({ contentType: 1, contentId: 1, viewedAt: -1 });

// Dedupe indexes (window-based)
viewEventSchema.index(
  { userId: 1, contentType: 1, contentId: 1, windowKey: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: "objectId" } } }
);

viewEventSchema.index(
  { deviceId: 1, contentType: 1, contentId: 1, windowKey: 1 },
  { unique: true, partialFilterExpression: { deviceId: { $type: "string" } } }
);

viewEventSchema.index(
  { sessionId: 1, contentType: 1, contentId: 1, windowKey: 1 },
  { unique: true, partialFilterExpression: { sessionId: { $type: "string" } } }
);

export const ViewEvent =
  mongoose.models.ViewEvent || mongoose.model<IViewEvent>("ViewEvent", viewEventSchema);


