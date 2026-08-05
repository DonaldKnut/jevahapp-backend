import mongoose, { Schema, Document } from "mongoose";

/**
 * Lightweight ranking / fatigue signals for For You.
 * Separate from ViewEvent (which drives counted views + dedupe windows).
 */
export type FeedEventType =
  | "impression"
  | "watch_time"
  | "skip"
  | "like"
  | "save"
  | "share";

export interface IFeedEvent extends Document {
  userId: mongoose.Types.ObjectId;
  contentId: mongoose.Types.ObjectId;
  contentType: string;
  eventType: FeedEventType;
  watchMs?: number;
  progressPct?: number;
  sessionId?: string | null;
  deviceId?: string | null;
  source?: string;
  createdAt: Date;
}

const FEED_EVENT_TYPES: FeedEventType[] = [
  "impression",
  "watch_time",
  "skip",
  "like",
  "save",
  "share",
];

const feedEventSchema = new Schema<IFeedEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    contentId: { type: Schema.Types.ObjectId, required: true, index: true },
    contentType: { type: String, default: "media", index: true },
    eventType: {
      type: String,
      required: true,
      enum: FEED_EVENT_TYPES,
      index: true,
    },
    watchMs: { type: Number, min: 0 },
    progressPct: { type: Number, min: 0, max: 1 },
    sessionId: { type: String, default: null },
    deviceId: { type: String, default: null },
    source: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Fatigue / for-you exclusion
feedEventSchema.index({ userId: 1, eventType: 1, createdAt: -1 });
feedEventSchema.index({ userId: 1, contentId: 1, eventType: 1, createdAt: -1 });

// Impression dedupe within a short window (app may still send; we upsert lightly)
feedEventSchema.index(
  { userId: 1, contentId: 1, eventType: 1, sessionId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      eventType: "impression",
      sessionId: { $type: "string" },
    },
  }
);

export const FeedEvent =
  mongoose.models.FeedEvent || mongoose.model<IFeedEvent>("FeedEvent", feedEventSchema);

export { FEED_EVENT_TYPES };
