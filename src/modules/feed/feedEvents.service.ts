import { Types } from "mongoose";
import {
  FeedEvent,
  FeedEventType,
  FEED_EVENT_TYPES,
} from "../../models/feedEvent.model";
import { normalizeContentType } from "../engagement/shared/contentType.resolver";
import logger from "../../utils/logger";

export type FeedEventInput = {
  contentId: string;
  contentType?: string;
  eventType: string;
  watchMs?: number;
  progressPct?: number;
  sessionId?: string;
  deviceId?: string;
  source?: string;
};

export type IngestResult = {
  accepted: number;
  skipped: number;
  errors: Array<{ index: number; message: string }>;
};

function isFeedEventType(v: string): v is FeedEventType {
  return (FEED_EVENT_TYPES as readonly string[]).includes(v);
}

/**
 * Ingest ranking signals. Soft-fail per event so one bad row does not drop the batch.
 * Impression + sessionId is idempotent (unique index).
 */
export async function ingestFeedEvents(
  userId: string,
  events: FeedEventInput[]
): Promise<IngestResult> {
  if (!Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid user ID");
  }
  if (!Array.isArray(events) || events.length === 0) {
    return { accepted: 0, skipped: 0, errors: [] };
  }
  if (events.length > 50) {
    throw new Error("Maximum 50 events per request");
  }

  const userObj = new Types.ObjectId(userId);
  let accepted = 0;
  let skipped = 0;
  const errors: Array<{ index: number; message: string }> = [];

  for (let i = 0; i < events.length; i++) {
    const raw = events[i];
    try {
      if (!raw?.contentId || !Types.ObjectId.isValid(raw.contentId)) {
        errors.push({ index: i, message: "Invalid contentId" });
        continue;
      }
      const eventType = String(raw.eventType || "")
        .trim()
        .toLowerCase();
      if (!isFeedEventType(eventType)) {
        errors.push({
          index: i,
          message: `Invalid eventType (use: ${FEED_EVENT_TYPES.join(", ")})`,
        });
        continue;
      }

      const contentType = normalizeContentType(raw.contentType || "media");
      const doc: Record<string, unknown> = {
        userId: userObj,
        contentId: new Types.ObjectId(raw.contentId),
        contentType,
        eventType,
        source: raw.source || "feed",
      };
      if (raw.watchMs != null && Number.isFinite(Number(raw.watchMs))) {
        doc.watchMs = Math.max(0, Math.floor(Number(raw.watchMs)));
      }
      if (raw.progressPct != null && Number.isFinite(Number(raw.progressPct))) {
        const p = Number(raw.progressPct);
        doc.progressPct = p > 1 ? Math.min(1, p / 100) : Math.max(0, Math.min(1, p));
      }
      if (raw.sessionId) doc.sessionId = String(raw.sessionId).slice(0, 128);
      if (raw.deviceId) doc.deviceId = String(raw.deviceId).slice(0, 128);

      if (eventType === "impression" && doc.sessionId) {
        try {
          await FeedEvent.updateOne(
            {
              userId: userObj,
              contentId: doc.contentId,
              eventType: "impression",
              sessionId: doc.sessionId,
            },
            { $setOnInsert: doc },
            { upsert: true }
          );
          accepted += 1;
        } catch (err: any) {
          if (err?.code === 11000) {
            skipped += 1;
          } else {
            throw err;
          }
        }
      } else {
        await FeedEvent.create(doc);
        accepted += 1;
      }
    } catch (err: any) {
      if (err?.code === 11000) {
        skipped += 1;
      } else {
        logger.warn("feed_event_ingest_row_failed", {
          index: i,
          error: err?.message,
          userId,
        });
        errors.push({ index: i, message: err?.message || "ingest failed" });
      }
    }
  }

  return { accepted, skipped, errors };
}

/** Content IDs the user saw recently (impressions + watch_time) — for fatigue. */
export async function getRecentFeedContentIds(
  userId: string,
  options: { sinceHours?: number; limit?: number } = {}
): Promise<Set<string>> {
  const sinceHours = options.sinceHours ?? 24;
  const limit = options.limit ?? 500;
  if (!Types.ObjectId.isValid(userId)) return new Set();

  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  const rows = await FeedEvent.find({
    userId: new Types.ObjectId(userId),
    eventType: { $in: ["impression", "watch_time", "skip"] },
    createdAt: { $gte: since },
  })
    .select("contentId")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return new Set(rows.map((r: any) => r.contentId.toString()));
}
