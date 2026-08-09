import { Request, Response } from "express";
import { Types } from "mongoose";
import { ingestFeedEvents } from "./feedEvents.service";
import { getForYouFeed } from "./forYou.service";
import { getMusicForYouFeed } from "./musicForYou.service";
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
 * GET /api/feed/for-you?cursor=&limit=20
 * Same card shape as GET /api/media/all-content items.
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

    const limit = req.query.limit
      ? parseInt(String(req.query.limit), 10)
      : 20;
    const cursor =
      (req.query.cursor as string) ||
      (req.query.page as string) ||
      null;

    const result = await getForYouFeed({
      userId,
      limit: Number.isFinite(limit) ? limit : 20,
      cursor,
    });

    res.status(200).json({
      success: true,
      data: {
        items: result.items,
        // Alias for FE that reuses all-content parsers
        media: result.items,
        cursor: result.cursor,
        hasMore: result.hasMore,
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
 * GET /api/feed/music-for-you?cursor=&limit=20&lane=artist|curated
 * Personalized artist-lane (default) gospel tracks.
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

    const limit = req.query.limit
      ? parseInt(String(req.query.limit), 10)
      : 20;
    const cursor =
      (req.query.cursor as string) || (req.query.page as string) || null;
    const laneRaw = String(req.query.lane || "artist");
    const lane =
      laneRaw === "curated" ? "curated" : ("artist" as const);

    const result = await getMusicForYouFeed({
      userId,
      limit: Number.isFinite(limit) ? limit : 20,
      cursor,
      lane,
    });

    res.status(200).json({
      success: true,
      data: {
        tracks: result.tracks,
        items: result.items,
        cursor: result.cursor,
        hasMore: result.hasMore,
        lane,
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
