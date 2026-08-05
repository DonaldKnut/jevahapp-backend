import { Request, Response } from "express";
import logger from "../utils/logger";
import {
  ensureUnsubscribeToken,
  getUnsubscribeStatus,
  previewMarketingCount,
  sendMarketingCampaign,
  setMarketingEmailEnabled,
  unsubscribeByToken,
  MARKETING_EMAIL_MAX_RECIPIENTS,
  type MarketingSegment,
} from "../service/marketingEmail.service";
import {
  ARTIST_ONBOARD_EMAIL_MAX_RECIPIENTS,
  previewArtistOnboardCount,
  sendArtistOnboardCampaign,
  type ArtistOnboardSegment,
} from "../service/artistOnboardEmail.service";
import { User } from "../models/user.model";

function parseSegment(raw: unknown): MarketingSegment {
  const s = String(raw || "all_opted_in").trim();
  if (
    s === "all_opted_in" ||
    s === "role" ||
    s === "userIds" ||
    s === "emails"
  ) {
    return s;
  }
  throw new Error(
    "segment must be one of: all_opted_in, role, userIds, emails"
  );
}

/**
 * POST /api/admin/email/marketing
 */
export const sendMarketingEmail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const {
      subject,
      message,
      html,
      segment,
      roles,
      userIds,
      emails,
      allowRawEmails,
      dryRun,
      limit,
    } = req.body || {};

    const result = await sendMarketingCampaign({
      adminId,
      subject,
      message,
      html,
      segment: parseSegment(segment),
      roles: Array.isArray(roles) ? roles : undefined,
      userIds: Array.isArray(userIds) ? userIds : undefined,
      emails: Array.isArray(emails) ? emails : undefined,
      allowRawEmails: allowRawEmails === true,
      dryRun: dryRun === true || dryRun === "true",
      limit:
        typeof limit === "number"
          ? limit
          : limit
            ? parseInt(String(limit), 10)
            : undefined,
    });

    res.status(200).json({
      success: true,
      message: result.dryRun
        ? `Dry run: would send to ${result.recipientCount} recipients`
        : `Sent ${result.sent} of ${result.recipientCount} marketing emails`,
      data: {
        ...result,
        maxRecipients: MARKETING_EMAIL_MAX_RECIPIENTS,
      },
    });
  } catch (error: any) {
    logger.error("Admin marketing email error", { error: error.message });
    const msg = error?.message || "Failed to send marketing email";
    const status =
      msg.includes("required") ||
      msg.includes("segment") ||
      msg.includes("Maximum") ||
      msg.includes("No opted-in")
        ? 400
        : 500;
    res.status(status).json({ success: false, message: msg });
  }
};

/**
 * GET /api/admin/email/marketing/preview-count
 */
export const previewMarketingEmailCount = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const segment = parseSegment(req.query.segment || "all_opted_in");
    const roles = req.query.roles
      ? String(req.query.roles)
          .split(",")
          .map((r) => r.trim())
          .filter(Boolean)
      : undefined;
    const userIds = req.query.userIds
      ? String(req.query.userIds)
          .split(",")
          .map((r) => r.trim())
          .filter(Boolean)
      : undefined;
    const emails = req.query.emails
      ? String(req.query.emails)
          .split(",")
          .map((r) => r.trim())
          .filter(Boolean)
      : undefined;
    const limit = req.query.limit
      ? parseInt(String(req.query.limit), 10)
      : undefined;

    const result = await previewMarketingCount({
      segment,
      roles,
      userIds,
      emails,
      limit,
    });

    res.status(200).json({
      success: true,
      data: {
        ...result,
        maxRecipients: MARKETING_EMAIL_MAX_RECIPIENTS,
        segment,
      },
    });
  } catch (error: any) {
    logger.error("Marketing preview-count error", { error: error.message });
    res.status(400).json({
      success: false,
      message: error?.message || "Failed to preview recipients",
    });
  }
};

function parseArtistOnboardSegment(raw: unknown): ArtistOnboardSegment {
  const s = String(raw || "active_missing_onboard").trim();
  if (
    s === "artistIds" ||
    s === "userIds" ||
    s === "emails" ||
    s === "pending" ||
    s === "active_missing_onboard" ||
    s === "active"
  ) {
    return s;
  }
  throw new Error(
    "segment must be one of: artistIds, userIds, emails, pending, active, active_missing_onboard"
  );
}

/**
 * POST /api/admin/email/artist-onboard
 * Ops invite / welcome for creators (not marketing opt-out).
 */
export const sendArtistOnboardEmail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const {
      subject,
      message,
      segment,
      artistIds,
      userIds,
      emails,
      dryRun,
      limit,
    } = req.body || {};

    const result = await sendArtistOnboardCampaign({
      adminId,
      subject,
      message,
      segment: parseArtistOnboardSegment(segment),
      artistIds: Array.isArray(artistIds) ? artistIds : undefined,
      userIds: Array.isArray(userIds) ? userIds : undefined,
      emails: Array.isArray(emails) ? emails : undefined,
      dryRun: dryRun === true || dryRun === "true",
      limit:
        typeof limit === "number"
          ? limit
          : limit
            ? parseInt(String(limit), 10)
            : undefined,
    });

    res.status(200).json({
      success: true,
      message: result.dryRun
        ? `Dry run: would send onboard email to ${result.recipientCount} artists`
        : `Sent ${result.sent} of ${result.recipientCount} artist onboard emails`,
      data: {
        ...result,
        maxRecipients: ARTIST_ONBOARD_EMAIL_MAX_RECIPIENTS,
        reminder:
          "After activating an artist, send this onboard email so they know how to upload to Music → Artists.",
      },
    });
  } catch (error: any) {
    logger.error("Admin artist onboard email error", { error: error.message });
    const msg = error?.message || "Failed to send artist onboard email";
    const status =
      msg.includes("required") ||
      msg.includes("segment") ||
      msg.includes("No recipients")
        ? 400
        : 500;
    res.status(status).json({ success: false, message: msg });
  }
};

/**
 * GET /api/admin/email/artist-onboard/preview-count
 */
export const previewArtistOnboardEmailCount = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const segment = parseArtistOnboardSegment(
      req.query.segment || "active_missing_onboard"
    );
    const artistIds = req.query.artistIds
      ? String(req.query.artistIds)
          .split(",")
          .map((r) => r.trim())
          .filter(Boolean)
      : undefined;
    const userIds = req.query.userIds
      ? String(req.query.userIds)
          .split(",")
          .map((r) => r.trim())
          .filter(Boolean)
      : undefined;
    const emails = req.query.emails
      ? String(req.query.emails)
          .split(",")
          .map((r) => r.trim())
          .filter(Boolean)
      : undefined;
    const limit = req.query.limit
      ? parseInt(String(req.query.limit), 10)
      : undefined;

    const result = await previewArtistOnboardCount({
      segment,
      artistIds,
      userIds,
      emails,
      limit,
    });

    res.status(200).json({
      success: true,
      data: {
        ...result,
        maxRecipients: ARTIST_ONBOARD_EMAIL_MAX_RECIPIENTS,
        segment,
        reminder:
          "Admins should email newly activated artists an onboard invite (creator studio steps).",
      },
    });
  } catch (error: any) {
    logger.error("Artist onboard preview-count error", {
      error: error.message,
    });
    res.status(400).json({
      success: false,
      message: error?.message || "Failed to preview recipients",
    });
  }
};

/**
 * GET /api/me/marketing-email
 */
export const getMyMarketingEmailPrefs = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const token = await ensureUnsubscribeToken(userId);
    const user = await User.findById(userId).select("marketingEmails email");
    const enabled = (user as any)?.marketingEmails?.enabled !== false;
    res.status(200).json({
      success: true,
      data: {
        enabled,
        unsubscribedAt: (user as any)?.marketingEmails?.unsubscribedAt || null,
        hasUnsubscribeToken: Boolean(token),
      },
    });
  } catch (error: any) {
    logger.error("Get marketing prefs error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to load marketing email preferences",
    });
  }
};

/**
 * PATCH /api/me/marketing-email
 */
export const updateMyMarketingEmailPrefs = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    if (typeof req.body?.enabled !== "boolean") {
      res.status(400).json({
        success: false,
        message: "enabled (boolean) is required",
      });
      return;
    }
    const result = await setMarketingEmailEnabled(userId, req.body.enabled);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error("Update marketing prefs error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to update marketing email preferences",
    });
  }
};

/**
 * GET /api/email/unsubscribe?token=
 */
export const getPublicUnsubscribe = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const token = String(req.query.token || "");
    const status = await getUnsubscribeStatus(token);
    if (!status.ok) {
      res.status(404).json({
        success: false,
        message: "Invalid or expired unsubscribe link",
      });
      return;
    }
    res.status(200).json({
      success: true,
      data: {
        enabled: status.enabled,
        emailMasked: status.emailMasked,
        message: status.enabled
          ? "You are currently subscribed to Jevah marketing emails."
          : "You are already unsubscribed from marketing emails.",
      },
    });
  } catch (error: any) {
    logger.error("Public unsubscribe GET error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to check status" });
  }
};

/**
 * POST /api/email/unsubscribe  { token }
 */
export const postPublicUnsubscribe = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const token = String(req.body?.token || req.query.token || "");
    const result = await unsubscribeByToken(token);
    if (!result.ok) {
      res.status(404).json({
        success: false,
        message: "Invalid or expired unsubscribe link",
      });
      return;
    }
    res.status(200).json({
      success: true,
      data: {
        enabled: false,
        emailMasked: result.emailMasked,
        alreadyUnsubscribed: result.alreadyUnsubscribed === true,
        message: "You have been unsubscribed from Jevah marketing emails.",
      },
    });
  } catch (error: any) {
    logger.error("Public unsubscribe POST error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to unsubscribe" });
  }
};
