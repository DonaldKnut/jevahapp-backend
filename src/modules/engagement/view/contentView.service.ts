import { Types } from "mongoose";
import { Media } from "../../../models/media.model";
import { Devotional } from "../../../models/devotional.model";
import logger from "../../../utils/logger";
import { ViewEvent } from "../../../models/viewEvent.model";
import { setPostCounter } from "../../../lib/redisCounters";
import { normalizeContentType } from "../shared/contentType.resolver";

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
  contentType: string;
  durationMs?: number;
  progressPct?: number;
  isComplete?: boolean;
  source?: string;
  sessionId?: string;
  deviceId?: string;
  ip?: string;
  userAgent?: string;
}

export interface RecordViewResult {
  contentId: string;
  viewCount: number;
  hasViewed: boolean;
  counted: boolean;
  /** Alias of counted — first qualified view in the dedupe window */
  isNewView: boolean;
}

const VIEW_DEDUPE_WINDOW_MS = 60 * 60 * 1000;
const MIN_VIDEO_VIEW_MS = 3000;
const MIN_VIDEO_VIEW_PCT = 0.25;
const MIN_AUDIO_VIEW_MS = 10000;
const MIN_AUDIO_VIEW_PCT = 0.2;
const MIN_EBOOK_VIEW_MS = 10000;
const MIN_EBOOK_VIEW_PCT = 0.1;

function normalizeProgressPct(progressPct?: number): number {
  const p =
    typeof progressPct === "number" && isFinite(progressPct) ? progressPct : 0;
  if (p > 1) return Math.max(0, Math.min(1, p / 100));
  return Math.max(0, Math.min(1, p));
}

function softResult(
  contentId: string,
  viewCount: number,
  extras?: Partial<RecordViewResult>
): RecordViewResult {
  return {
    contentId,
    viewCount: Math.max(0, viewCount || 0),
    hasViewed: false,
    counted: false,
    isNewView: false,
    ...extras,
  };
}

async function getMediaKindForThresholds(
  contentId: string,
  contentType: ContentType
): Promise<"video" | "audio" | "ebook"> {
  if (contentType === "devotional") return "ebook";
  if (contentType === "ebook") return "ebook";
  if (contentType === "podcast") return "audio";

  if (contentType === "media" || contentType === "merch") {
    const m = await Media.findById(contentId)
      .select("contentType mediaType fileMimeType")
      .lean();
    const mt = (m as any)?.contentType;
    if (["videos", "live", "recording"].includes(mt)) return "video";
    if (["audio", "music", "podcast"].includes(mt)) return "audio";
    if (mt === "sermon") {
      const mediaType = String((m as any)?.mediaType || "").toLowerCase();
      const mime = String((m as any)?.fileMimeType || "").toLowerCase();
      if (mediaType === "audio" || mime.startsWith("audio/")) return "audio";
      return "video";
    }
    if (["ebook"].includes(mt)) return "ebook";
  }
  return "video";
}

function qualifiesView(params: {
  kind: "video" | "audio" | "ebook";
  durationMs?: number;
  progressPct?: number;
  isComplete?: boolean;
}): boolean {
  const isComplete = !!params.isComplete;
  const durationMs =
    typeof params.durationMs === "number" ? params.durationMs : 0;
  const progressPct =
    typeof params.progressPct === "number" ? params.progressPct : 0;
  if (isComplete) return true;

  if (params.kind === "video") {
    return (
      durationMs >= MIN_VIDEO_VIEW_MS || progressPct >= MIN_VIDEO_VIEW_PCT
    );
  }
  if (params.kind === "audio") {
    return (
      durationMs >= MIN_AUDIO_VIEW_MS || progressPct >= MIN_AUDIO_VIEW_PCT
    );
  }
  return durationMs >= MIN_EBOOK_VIEW_MS || progressPct >= MIN_EBOOK_VIEW_PCT;
}

type EngageableDoc = {
  _id: Types.ObjectId;
  viewCount?: number;
  moderationStatus?: string | null;
  deletedAt?: Date | string | null;
};

/**
 * Load content for view telemetry — no approved-only filter.
 * Returns null when missing / soft-deleted.
 */
async function loadEngageableContent(
  contentId: string,
  contentType: ContentType
): Promise<EngageableDoc | null> {
  if (["media", "ebook", "podcast", "merch"].includes(contentType)) {
    const doc = await Media.findById(contentId)
      .select("_id viewCount moderationStatus deletedAt")
      .lean();
    if (!doc || (doc as EngageableDoc).deletedAt) return null;
    return doc as EngageableDoc;
  }
  if (contentType === "devotional") {
    const doc = await Devotional.findById(contentId)
      .select("_id viewCount")
      .lean();
    return (doc as EngageableDoc) || null;
  }
  return null;
}

async function incrementAndGetViewCount(
  contentId: string,
  contentType: ContentType
): Promise<number> {
  if (["media", "ebook", "podcast", "merch"].includes(contentType)) {
    const doc = await Media.findByIdAndUpdate(
      contentId,
      { $inc: { viewCount: 1 } },
      { new: true }
    )
      .select("viewCount")
      .lean();
    return (doc as any)?.viewCount || 0;
  }
  if (contentType === "devotional") {
    const doc = await Devotional.findByIdAndUpdate(
      contentId,
      { $inc: { viewCount: 1 } },
      { new: true }
    )
      .select("viewCount")
      .lean();
    return (doc as any)?.viewCount || 0;
  }
  return 0;
}

async function getViewCount(
  contentId: string,
  contentType: ContentType
): Promise<number> {
  if (["media", "ebook", "podcast", "merch"].includes(contentType)) {
    const m = await Media.findById(contentId).select("viewCount").lean();
    return (m as any)?.viewCount || 0;
  }
  if (contentType === "devotional") {
    const d = await Devotional.findById(contentId).select("viewCount").lean();
    return (d as any)?.viewCount || 0;
  }
  return 0;
}

function emitViewUpdated(
  contentId: string,
  contentType: ContentType,
  viewCount: number
): void {
  try {
    const io = require("../../../socket/socketManager").getIO();
    if (!io) return;
    const payload = {
      contentId,
      contentType,
      viewCount,
      timestamp: new Date().toISOString(),
    };
    const room = `content:${contentType}:${contentId}`;
    io.to(room).emit("view-updated", payload);
    io.to(`content:${contentId}`).emit("view-updated", payload);
    io.emit("content:viewCountUpdated", payload);
  } catch (e) {
    logger.warn("Failed to emit view-updated", {
      contentId,
      error: (e as any)?.message,
    });
  }
}

const viewService = {
  async recordView(input: RecordViewInput): Promise<RecordViewResult> {
    const {
      userId,
      contentId,
      durationMs = 0,
      progressPct,
      isComplete = false,
      source,
      sessionId,
      deviceId,
    } = input;

    const rawType = (input.contentType || "").trim().toLowerCase();
    const contentType = (
      rawType === "devotional"
        ? "devotional"
        : normalizeContentType(input.contentType || "media")
    ) as ContentType;

    if (!Types.ObjectId.isValid(contentId)) {
      return softResult(contentId || "", 0);
    }

    // approved | under_review | pending → ok; rejected / deleted / missing → soft no-op
    const content = await loadEngageableContent(contentId, contentType);
    if (!content) {
      return softResult(contentId, 0);
    }
    if (
      contentType !== "devotional" &&
      content.moderationStatus === "rejected"
    ) {
      return softResult(contentId, content.viewCount || 0);
    }

    const validUserId =
      userId && Types.ObjectId.isValid(userId) ? userId : undefined;
    const viewerDeviceId =
      typeof deviceId === "string" && deviceId.trim()
        ? deviceId.trim()
        : undefined;
    const viewerSessionId =
      typeof sessionId === "string" && sessionId.trim()
        ? sessionId.trim()
        : undefined;

    if (!validUserId && !viewerDeviceId && !viewerSessionId) {
      return softResult(contentId, content.viewCount || 0);
    }

    const normalizedProgress = normalizeProgressPct(progressPct);
    const kind = await getMediaKindForThresholds(contentId, contentType);
    if (
      !qualifiesView({
        kind,
        durationMs,
        progressPct: normalizedProgress,
        isComplete,
      })
    ) {
      return softResult(contentId, content.viewCount || 0);
    }

    const now = new Date();
    const contentIdObj = new Types.ObjectId(contentId);
    const windowKey = Math.floor(now.getTime() / VIEW_DEDUPE_WINDOW_MS);
    let counted = false;
    let hasViewed = false;
    let viewCount = content.viewCount || 0;

    // Persist as canonical Media / Devotional type for ViewEvent enum
    const eventContentType: ContentType =
      contentType === "ebook" || contentType === "podcast"
        ? "media"
        : contentType === "merch"
          ? "merch"
          : contentType;

    try {
      await ViewEvent.create({
        contentId: contentIdObj,
        contentType: eventContentType,
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
      if (e?.code === 11000) {
        counted = false;
        hasViewed = true;
        viewCount = await getViewCount(contentId, contentType);
      } else {
        logger.error("ViewEvent create failed", {
          contentId,
          contentType,
          moderationStatus: content.moderationStatus,
          error: e?.message,
          stack: e?.stack,
        });
        // Never 500 for telemetry — return current count
        viewCount = await getViewCount(contentId, contentType).catch(
          () => content.viewCount || 0
        );
        return softResult(contentId, viewCount, { hasViewed: false });
      }
    }

    if (counted) {
      void setPostCounter({
        postId: contentId,
        field: "views",
        count: viewCount,
      });
      emitViewUpdated(contentId, contentType, viewCount);
    }

    return {
      contentId,
      viewCount,
      hasViewed,
      counted,
      isNewView: counted,
    };
  },
};

export default viewService;
