import mongoose, { Schema, Document } from "mongoose";

export interface IAnalyticsEvent extends Document {
  name: string;
  payload: Record<string, any>;
  requestId?: string;
  createdAt: Date;
}

/**
 * Analytics events written by the BullMQ analytics worker.
 * This is intentionally append-only and TTL'd to prevent unbounded growth.
 */
const analyticsEventSchema = new Schema<IAnalyticsEvent>(
  {
    name: { type: String, required: true, index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    requestId: { type: String, index: true },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

// Keep events for 7 days by default (MongoDB TTL index).
// Can be overridden by setting ANALYTICS_EVENTS_TTL_DAYS.
const ttlDays = parseInt(process.env.ANALYTICS_EVENTS_TTL_DAYS || "7", 10);
if (Number.isFinite(ttlDays) && ttlDays > 0) {
  analyticsEventSchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: ttlDays * 24 * 60 * 60 }
  );
}

export const AnalyticsEvent =
  mongoose.models.AnalyticsEvent ||
  mongoose.model<IAnalyticsEvent>("AnalyticsEvent", analyticsEventSchema);

