import { Request, Response } from "express";
import { Types } from "mongoose";
import { Media } from "../models/media.model";
import { ModerationCase } from "../models/moderationCase.model";
import { Church } from "../models/church.model";
import { AuditService } from "../service/audit.service";
import cacheService from "../service/cache.service";
import {
  resolveAdminMediaPreview,
  shapeAdminMediaCard,
} from "../service/admin/mediaPreview.service";
import logger from "../utils/logger";

const MEDIA_SELECT =
  "title description contentType category thumbnailUrl fileUrl playbackUrl hlsUrl fileObjectKey thumbnailObjectKey uploadIntent moderationStatus moderationResult adminModerationNotes isHidden reportCount likeCount viewCount publicationState processing uploadedBy createdAt updatedAt";

/**
 * GET /api/admin/moderation/:id
 * Single media card for the review pane (with preview URLs).
 */
export const getModerationMediaDetail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid media ID" });
      return;
    }

    const media = await Media.findById(id)
      .select(MEDIA_SELECT)
      .populate("uploadedBy", "firstName lastName email username")
      .lean();

    if (!media) {
      res.status(404).json({ success: false, message: "Media not found" });
      return;
    }

    const preview = await resolveAdminMediaPreview(media as any);
    const latestCase = await ModerationCase.findOne({ mediaId: id })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: {
        media: shapeAdminMediaCard(media, preview),
        moderationCase: latestCase
          ? {
              id: (latestCase as any)._id.toString(),
              decision: (latestCase as any).decision,
              scores: (latestCase as any).scores || null,
              modalityCoverage: (latestCase as any).modalityCoverage || null,
              languageCandidates: (latestCase as any).languageCandidates || [],
              provider: (latestCase as any).provider,
              modelId: (latestCase as any).modelId || null,
              promptVersion: (latestCase as any).promptVersion,
              policyVersion: (latestCase as any).policyVersion,
              reviewerOutcome: (latestCase as any).reviewerOutcome || null,
              createdAt: (latestCase as any).createdAt,
            }
          : null,
      },
    });
  } catch (error: any) {
    logger.error("Get moderation media detail error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch moderation media detail",
    });
  }
};

/**
 * POST /api/admin/media/:id/preview-refresh
 * Re-issue signed preview URLs (TTL ~3600s) for the admin player.
 * Returns `{ preview }` plus full `media` AdminMediaCard for convenience.
 */
export const refreshAdminMediaPreview = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid media ID" });
      return;
    }

    const media = await Media.findById(id)
      .select(MEDIA_SELECT)
      .populate("uploadedBy", "firstName lastName email username")
      .lean();

    if (!media) {
      res.status(404).json({ success: false, message: "Media not found" });
      return;
    }

    const preview = await resolveAdminMediaPreview(media as any);
    const card = shapeAdminMediaCard(media, preview);

    res.status(200).json({
      success: true,
      data: {
        preview: card.preview,
        media: card,
      },
    });
  } catch (error: any) {
    logger.error("Refresh admin media preview error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to refresh media preview",
    });
  }
};

/**
 * GET /api/admin/moderation/:id/case
 * Full AI ModerationCase history for a media item (newest first).
 */
export const getModerationCase = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid media ID" });
      return;
    }

    const mediaExists = await Media.exists({ _id: id });
    if (!mediaExists) {
      res.status(404).json({ success: false, message: "Media not found" });
      return;
    }

    const cases = await ModerationCase.find({ mediaId: id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.status(200).json({
      success: true,
      data: {
        mediaId: id,
        cases: cases.map((c: any) => ({
          id: c._id.toString(),
          contentHash: c.contentHash || null,
          provider: c.provider,
          modelId: c.modelId || null,
          promptVersion: c.promptVersion,
          policyVersion: c.policyVersion,
          evidenceHashes: c.evidenceHashes || [],
          modalityCoverage: c.modalityCoverage || null,
          languageCandidates: c.languageCandidates || [],
          decision: c.decision,
          scores: c.scores || null,
          usage: c.usage || null,
          reviewerOutcome: c.reviewerOutcome || null,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })),
      },
    });
  } catch (error: any) {
    logger.error("Get moderation case error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch moderation case",
    });
  }
};

/**
 * PATCH /api/admin/media/:id
 * Admin metadata edit (title / description / notes). Does not replace files.
 */
export const updateAdminMediaMetadata = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid media ID" });
      return;
    }

    const body = req.body || {};
    const updates: Record<string, unknown> = {};

    if (typeof body.title === "string") {
      const title = body.title.trim();
      if (!title || title.length > 200) {
        res.status(400).json({
          success: false,
          message: "title must be 1–200 characters",
        });
        return;
      }
      updates.title = title;
    }

    if (typeof body.description === "string") {
      const description = body.description.trim();
      if (description.length > 5000) {
        res.status(400).json({
          success: false,
          message: "description must be ≤ 5000 characters",
        });
        return;
      }
      updates.description = description;
    }

    if (typeof body.adminModerationNotes === "string") {
      const notes = body.adminModerationNotes.trim();
      if (notes.length > 2000) {
        res.status(400).json({
          success: false,
          message: "adminModerationNotes must be ≤ 2000 characters",
        });
        return;
      }
      updates.adminModerationNotes = notes;
    }

    if (typeof body.category === "string" && body.category.trim()) {
      updates.category = body.category.trim();
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({
        success: false,
        message:
          "Provide at least one of: title, description, adminModerationNotes, category",
      });
      return;
    }

    const media = await Media.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    )
      .select(MEDIA_SELECT)
      .populate("uploadedBy", "firstName lastName email username");

    if (!media) {
      res.status(404).json({ success: false, message: "Media not found" });
      return;
    }

    await cacheService.del(`media:public:${id}`);
    await cacheService.del(`media:${id}`);
    await cacheService.delPattern("media:public:all-content*");

    await AuditService.logAdminAction(adminId, "update_media_metadata", id, {
      updates,
    });

    const preview = await resolveAdminMediaPreview(media.toObject() as any);

    res.status(200).json({
      success: true,
      message: "Media metadata updated",
      data: shapeAdminMediaCard(media.toObject(), preview),
    });
  } catch (error: any) {
    logger.error("Update admin media metadata error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to update media metadata",
    });
  }
};

/**
 * GET /api/admin/churches
 * Paginated church catalog for admin UI (onboarding source of truth).
 * Query: page, limit, search, isVerified, isListed, source, hasContactEmail
 */
export const listAdminChurches = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const search = ((req.query.search as string) || "").trim();
    const verifiedParam = req.query.isVerified as string | undefined;
    const listedParam = req.query.isListed as string | undefined;
    const source = req.query.source as string | undefined;
    const hasContactEmail = req.query.hasContactEmail as string | undefined;

    const filter: Record<string, unknown> = {};
    const andClauses: Record<string, unknown>[] = [];

    if (search) {
      andClauses.push({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { denomination: { $regex: search, $options: "i" } },
          { state: { $regex: search, $options: "i" } },
          { contactEmail: { $regex: search, $options: "i" } },
        ],
      });
    }
    if (verifiedParam === "true") filter.isVerified = true;
    if (verifiedParam === "false") filter.isVerified = false;
    if (listedParam === "true") filter.isListed = { $ne: false };
    if (listedParam === "false") filter.isListed = false;
    if (["manual", "outreach", "bulk", "import"].includes(source || "")) {
      filter.source = source;
    }
    if (hasContactEmail === "true") {
      andClauses.push({
        contactEmail: { $exists: true, $type: "string", $ne: "" },
      });
    }
    if (hasContactEmail === "false") {
      andClauses.push({
        $or: [
          { contactEmail: { $exists: false } },
          { contactEmail: null },
          { contactEmail: "" },
        ],
      });
    }
    if (andClauses.length > 0) {
      filter.$and = andClauses;
    }

    const [churches, total] = await Promise.all([
      Church.find(filter)
        .select(
          "name denomination state lga address website contactEmail contactPhone contactName source adminNotes isListed isVerified createdAt updatedAt"
        )
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Church.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        churches: churches.map((c: any) => ({
          id: c._id.toString(),
          name: c.name,
          denomination: c.denomination || null,
          state: c.state || null,
          lga: c.lga || null,
          address: c.address || null,
          website: c.website || null,
          contactEmail: c.contactEmail || null,
          contactPhone: c.contactPhone || null,
          contactName: c.contactName || null,
          source: c.source || "manual",
          adminNotes: c.adminNotes || null,
          isListed: c.isListed !== false,
          isVerified: Boolean(c.isVerified),
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error: any) {
    logger.error("List admin churches error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to list churches",
    });
  }
};
