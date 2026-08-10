import { Request, Response } from "express";
import { Types } from "mongoose";
import { ingestFeedEvents } from "./feedEvents.service";
import { getForYouFeed } from "./forYou.service";
import { getMusicForYouFeed } from "./musicForYou.service";
import {
  compactFeedItems,
  compactTrackCards,
  liteDefaultLimit,
  resolveClientProfile,
} from "../clientProfile/liteProfile";
import logger from "../../utils/logger";

/**
 * POST /api/feed/events
 * Body: { events: [...] } or a single event object
 */
export async function postFeedEvents(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        code: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    const body = req.body || {};
    const events = Array.isArray(body.events)
      ? body.events
      : body.contentId
        ? [body]
        : [];

    if (events.length === 0) {
      res.status(400).json({
        success: false,
        message: "Provide events[] or a single event with contentId + eventType",
        code: "INVALID_BODY",
      });
      return;
    }

    const result = await ingestFeedEvents(userId, events);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error("post_feed_events_failed", { error: error?.message });
    if (error?.message?.includes("Maximum")) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({
      success: false,
      message: "Failed to ingest feed events",
    });
  }
}

/**
 * GET /api/feed/for-you?cursor=&limit=20&profile=lite
 * Compact cards when profile=lite / X-Jevah-Client: lite
 */
export async function getForYou(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        code: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    const profile = resolveClientProfile(req);
    const rawLimit = req.query.limit
      ? parseInt(String(req.query.limit), 10)
      : profile === "lite"
        ? 8
        : 20;
    const limit =
      profile === "lite"
        ? liteDefaultLimit(rawLimit, 12)
        : Number.isFinite(rawLimit)
          ? Math.min(50, Math.max(1, rawLimit))
          : 20;
    const cursor =
      (req.query.cursor as string) ||
      (req.query.page as string) ||
      null;

    const result = await getForYouFeed({
      userId,
      limit,
      cursor,
    });

    const items =
      profile === "lite" ? compactFeedItems(result.items) : result.items;

    res.status(200).json({
      success: true,
      data: {
        items,
        media: items,
        cursor: result.cursor,
        hasMore: result.hasMore,
        profile,
      },
    });
  } catch (error: any) {
    logger.error("get_for_you_failed", { error: error?.message });
    res.status(500).json({
      success: false,
      message: "Failed to load For You feed",
    });
  }
}

/**
 * GET /api/feed/music-for-you?cursor=&limit=20&lane=artist|curated&profile=lite
 */
export async function getMusicForYou(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        code: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    const profile = resolveClientProfile(req);
    const rawLimit = req.query.limit
      ? parseInt(String(req.query.limit), 10)
      : profile === "lite"
        ? 8
        : 20;
    const limit =
      profile === "lite"
        ? liteDefaultLimit(rawLimit, 12)
        : Number.isFinite(rawLimit)
          ? Math.min(50, Math.max(1, rawLimit))
          : 20;
    const cursor =
      (req.query.cursor as string) || (req.query.page as string) || null;
    const laneRaw = String(req.query.lane || "artist");
    const lane =
      laneRaw === "curated" ? "curated" : ("artist" as const);

    const result = await getMusicForYouFeed({
      userId,
      limit,
      cursor,
      lane,
    });

    const tracks =
      profile === "lite" ? compactTrackCards(result.tracks) : result.tracks;

    res.status(200).json({
      success: true,
      data: {
        tracks,
        items: tracks,
        cursor: result.cursor,
        hasMore: result.hasMore,
        lane,
        profile,
      },
    });
  } catch (error: any) {
    logger.error("get_music_for_you_failed", { error: error?.message });
    res.status(500).json({
      success: false,
      message: "Failed to load music For You",
    });
  }
}
