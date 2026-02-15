import { ClientSession, Types } from "mongoose";
import { Media } from "../models/media.model";
import { Devotional } from "../models/devotional.model";
import { MediaInteraction } from "../models/mediaInteraction.model";
import logger from "../utils/logger";
import { ViewEvent } from "../models/viewEvent.model";

type ContentType =
  | "media"
  | "devotional"
  | "artist"
  | "merch"
  | "ebook"
  | "podcast";

interface RecordViewInput {
  userId?: string;
  contentId: string;
  contentType: ContentType;
  durationMs?: number;
  progressPct?: number;
  isComplete?: boolean;
  source?: string;
  sessionId?: string;
  deviceId?: string;
  ip?: string;
  userAgent?: string;
}

const VIEW_DEDUPE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Thresholds (per spec)
const MIN_VIDEO_VIEW_MS = 3000;
const MIN_VIDEO_VIEW_PCT = 0.25;
const MIN_AUDIO_VIEW_MS = 10000;
const MIN_AUDIO_VIEW_PCT = 0.2;
const MIN_EBOOK_VIEW_MS = 10000;
const MIN_EBOOK_VIEW_PCT = 0.1;

function normalizeProgressPct(progressPct?: number): number {
  const p = typeof progressPct === "number" && isFinite(progressPct) ? progressPct : 0;
  // Accept either 0..1 (preferred) or 0..100 (legacy percent)
  if (p > 1) return Math.max(0, Math.min(1, p / 100));
  return Math.max(0, Math.min(1, p));
}

async function getMediaKindForThresholds(
  contentId: string,
  contentType: ContentType
): Promise<"video" | "audio" | "ebook"> {
  // For devotional, treat as read/open behavior (ebook-like)
  if (contentType === "devotional") return "ebook";
  if (contentType === "ebook") return "ebook";
  if (contentType === "podcast") return "audio";

  if (contentType === "media" || contentType === "merch") {
    const m = await Media.findById(contentId).select("contentType").lean();
    const mt = (m as any)?.contentType;
    if (["videos", "live", "recording"].includes(mt)) return "video";
    if (["audio", "music", "podcast"].includes(mt)) return "audio";
    if (["ebook"].includes(mt)) return "ebook";
  }

  // Default to video rules
  return "video";
}

function qualifiesView(params: {
  kind: "video" | "audio" | "ebook";
  durationMs?: number;
  progressPct?: number; // normalized 0..1
  isComplete?: boolean;
}): boolean {
  const isComplete = !!params.isComplete;
  const durationMs = typeof params.durationMs === "number" ? params.durationMs : 0;
  const progressPct = typeof params.progressPct === "number" ? params.progressPct : 0;
  if (isComplete) return true;

  if (params.kind === "video") {
    return durationMs >= MIN_VIDEO_VIEW_MS || progressPct >= MIN_VIDEO_VIEW_PCT;
  }
  if (params.kind === "audio") {
    return durationMs >= MIN_AUDIO_VIEW_MS || progressPct >= MIN_AUDIO_VIEW_PCT;
  }
  return durationMs >= MIN_EBOOK_VIEW_MS || progressPct >= MIN_EBOOK_VIEW_PCT;
}

async function verifyContentExists(
  contentId: string,
  contentType: ContentType
): Promise<boolean> {
  try {
    switch (contentType) {
      case "media":
      case "ebook":
      case "podcast":
      case "merch":
        return !!(await Media.findById(contentId).select("_id"));
      case "devotional":
        return !!(await Devotional.findById(contentId).select("_id"));
      default:
        return false;
    }
  } catch (e) {
    return false;
  }
}

async function incrementViewCount(
  contentId: string,
  contentType: ContentType,
  session?: ClientSession
) {
  if (
    contentType === "media" ||
    contentType === "ebook" ||
    contentType === "podcast" ||
    contentType === "merch"
  ) {
    await Media.findByIdAndUpdate(
      contentId,
      { $inc: { viewCount: 1 } },
      { session }
    );
  } else if (contentType === "devotional") {
    await Devotional.findByIdAndUpdate(
      contentId,
      { $inc: { viewCount: 1 } },
      { session }
    );
  }
}

async function incrementAndGetViewCount(
  contentId: string,
  contentType: ContentType,
  session?: ClientSession
): Promise<number> {
  if (
    contentType === "media" ||
    contentType === "ebook" ||
    contentType === "podcast" ||
    contentType === "merch"
  ) {
    const doc = await Media.findByIdAndUpdate(
      contentId,
      { $inc: { viewCount: 1 } },
      { session, new: true }
    ).select("viewCount");
    return doc?.viewCount || 0;
  }
  if (contentType === "devotional") {
    const doc = await Devotional.findByIdAndUpdate(
      contentId,
      { $inc: { viewCount: 1 } },
      { session, new: true }
    ).select("viewCount");
    return (doc as any)?.viewCount || 0;
  }
  return 0;
}

async function getViewCount(
  contentId: string,
  contentType: ContentType
): Promise<number> {
  if (
    contentType === "media" ||
    contentType === "ebook" ||
    contentType === "podcast" ||
    contentType === "merch"
  ) {
    const m = await Media.findById(contentId).select("viewCount");
    return m?.viewCount || 0;
  } else if (contentType === "devotional") {
    const d = await Devotional.findById(contentId).select("viewCount");
    return (d as any)?.viewCount || 0;
  }
  return 0;
}

export default {
  async recordView(
    input: RecordViewInput
  ): Promise<{ contentId: string; viewCount: number; hasViewed: boolean; counted: boolean }> {
    const {
      userId,
      contentId,
      contentType,
      durationMs = 0,
      progressPct,
      isComplete = false,
      source,
      sessionId,
      deviceId,
    } = input;

    if (!Types.ObjectId.isValid(contentId)) {
      throw new Error("Invalid content ID");
    }
    const exists = await verifyContentExists(contentId, contentType);
    if (!exists) throw new Error("Content not found");

    // Resolve viewer identity for dedupe
    const validUserId = userId && Types.ObjectId.isValid(userId) ? userId : undefined;
    const viewerDeviceId = typeof deviceId === "string" && deviceId.trim() ? deviceId.trim() : undefined;
    const viewerSessionId = typeof sessionId === "string" && sessionId.trim() ? sessionId.trim() : undefined;

    const hasViewerKey = !!validUserId || !!viewerDeviceId || !!viewerSessionId;
    if (!hasViewerKey) {
      const viewCount = await getViewCount(contentId, contentType);
      return { contentId, viewCount, hasViewed: false, counted: false };
    }

    const normalizedProgress = normalizeProgressPct(progressPct);
    const kind = await getMediaKindForThresholds(contentId, contentType);
    const qualifies = qualifiesView({
      kind,
      durationMs,
      progressPct: normalizedProgress,
      isComplete,
    });

    const now = new Date();
    const contentIdObj = new Types.ObjectId(contentId);

    // Below threshold: do not count, but still report current counter
    if (!qualifies) {
      const viewCount = await getViewCount(contentId, contentType);
      return { contentId, viewCount, hasViewed: false, counted: false };
    }

    const windowKey = Math.floor(now.getTime() / VIEW_DEDUPE_WINDOW_MS);
    let counted = false;
    let hasViewed = false;
    let viewCount: number;

    // Write ViewEvent (dedupe) + increment counter if insert succeeds
    try {
      await ViewEvent.create({
        contentId: contentIdObj,
        contentType,
        userId: validUserId ? new Types.ObjectId(validUserId) : null,
        deviceId: viewerDeviceId || null,
        sessionId: viewerSessionId || null,
        windowKey,
        viewedAt: now,
        durationMs,
        progressPct: normalizedProgress,
        isComplete,
        source,
      });
      counted = true;
      hasViewed = true;
      viewCount = await incrementAndGetViewCount(contentId, contentType);
    } catch (e: any) {
      // Duplicate => already counted in this window
      if (e?.code === 11000) {
        counted = false;
        hasViewed = true;
        viewCount = await getViewCount(contentId, contentType);
      } else {
        throw e;
      }
    }

    // Emit real-time update via socket
    try {
      const io = require("../socket/socketManager").getIO();
      if (io) {
        const payload = {
          contentId,
          contentType,
          viewCount,
          timestamp: new Date().toISOString(),
        };
        // legacy
        io.to(`content:${contentId}`).emit("view-updated", payload);
        // spec-ish
        io.emit("content:viewCountUpdated", payload);
      }
    } catch (e) {
      logger.warn("Failed to emit view-updated", {
        contentId,
        error: (e as any)?.message,
      });
    }

    return { contentId, viewCount, hasViewed, counted };
  },
};
