import { Request, Response } from "express";
import { Types } from "mongoose";
import logger from "../../../utils/logger";
import viewService from "../view/view.service";

const SUCCESSOR_VIEW = "POST /api/content/media/:contentId/view";
const SUCCESSOR_INTERACT = "POST /api/content/media/:contentId/view";

/**
 * @deprecated Use POST /api/content/media/:contentId/view
 * Shim for POST /api/media/:id/track-view
 */
export const deprecatedTrackView = async (req: Request, res: Response): Promise<void> => {
  try {
    const contentId = req.params.id || req.body?.mediaId;
    const userId = req.userId;
    const durationMs = typeof req.body?.duration === "number" ? req.body.duration : req.body?.durationMs;
    const isComplete = !!req.body?.isComplete;
    const progressPct = req.body?.progressPct;

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    if (!contentId || !Types.ObjectId.isValid(contentId)) {
      res.status(400).json({ success: false, message: "Invalid media ID" });
      return;
    }

    const result = await viewService.recordView({
      userId,
      contentId,
      contentType: "media",
      durationMs,
      progressPct,
      isComplete,
      source: "legacy:track-view",
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(200).json({
      success: true,
      deprecated: true,
      successor: SUCCESSOR_VIEW,
      data: {
        countedAsView: result.counted,
        viewCount: result.viewCount,
        hasViewed: result.hasViewed,
        duration: durationMs,
        isComplete,
      },
    });
  } catch (error: any) {
    logger.error("Deprecated track-view shim error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to record view" });
  }
};

/**
 * @deprecated Use POST /api/content/media/:contentId/view for views
 * Shim for POST /api/media/:id/interact (view/listen/read only; download unchanged)
 */
export const deprecatedRecordInteract = async (req: Request, res: Response): Promise<void> => {
  try {
    const contentId = req.params.id;
    const userId = req.userId;
    const { interactionType } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    if (!contentId || !Types.ObjectId.isValid(contentId)) {
      res.status(400).json({ success: false, message: "Invalid media ID" });
      return;
    }

    if (!["view", "listen", "read"].includes(interactionType)) {
      res.status(400).json({
        success: false,
        message: `interactionType "${interactionType}" is deprecated. Use dedicated download endpoint.`,
        successor: interactionType === "download" ? "POST /api/media/:mediaId/download" : SUCCESSOR_INTERACT,
      });
      return;
    }

    const result = await viewService.recordView({
      userId,
      contentId,
      contentType: "media",
      durationMs: interactionType === "listen" ? 10000 : 3000,
      isComplete: false,
      source: `legacy:interact:${interactionType}`,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(201).json({
      success: true,
      deprecated: true,
      successor: SUCCESSOR_INTERACT,
      message: `Recorded ${interactionType} via deprecated endpoint — migrate to ${SUCCESSOR_VIEW}`,
      data: {
        viewCount: result.viewCount,
        counted: result.counted,
      },
    });
  } catch (error: any) {
    logger.error("Deprecated interact shim error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to record interaction" });
  }
};
