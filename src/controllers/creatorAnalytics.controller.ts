import { Request, Response } from "express";
import {
  getCreatorStudioAnalytics,
  getCreatorTrackAnalytics,
} from "../modules/creators/creatorAnalytics.service";
import logger from "../utils/logger";

/**
 * GET /api/creators/me/analytics?rangeDays=30
 */
export async function getMyCreatorAnalytics(
  req: Request,
  res: Response
): Promise<void> {
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

    const result = await getCreatorStudioAnalytics(
      userId,
      req.query.rangeDays
    );

    if (!result.ok) {
      res.status(result.status).json({
        success: false,
        message: result.message,
        code: result.code,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error: any) {
    logger.error("get_my_creator_analytics_failed", { error: error?.message });
    res.status(500).json({
      success: false,
      message: "Failed to load creator analytics",
    });
  }
}

/**
 * GET /api/creators/me/analytics/tracks/:trackId?rangeDays=30
 */
export async function getMyCreatorTrackAnalytics(
  req: Request,
  res: Response
): Promise<void> {
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

    const result = await getCreatorTrackAnalytics(
      userId,
      req.params.trackId,
      req.query.rangeDays
    );

    if (!result.ok) {
      res.status(result.status).json({
        success: false,
        message: result.message,
        code: result.code,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error: any) {
    logger.error("get_my_creator_track_analytics_failed", {
      error: error?.message,
    });
    res.status(500).json({
      success: false,
      message: "Failed to load track analytics",
    });
  }
}
