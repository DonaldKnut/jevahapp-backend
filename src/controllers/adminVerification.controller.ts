import { Request, Response } from "express";
import { Types } from "mongoose";
import { User } from "../models/user.model";
import { Church } from "../models/church.model";
import { Media } from "../models/media.model";
import { MediaReport } from "../models/mediaReport.model";
import { AuditService } from "../service/audit.service";
import { mediaService } from "../service/media.service";
import cacheService from "../service/cache.service";
import logger from "../utils/logger";

const VERIFICATION_FLAGS = [
  "isVerifiedCreator",
  "isVerifiedVendor",
  "isVerifiedChurch",
  "isVerifiedArtist",
] as const;

type VerificationFlag = (typeof VERIFICATION_FLAGS)[number];

/**
 * PATCH /api/admin/users/:id/verification
 * Body: { isVerifiedCreator?, isVerifiedVendor?, isVerifiedChurch?, isVerifiedArtist? }
 */
export const updateUserVerification = async (
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
      res.status(400).json({ success: false, message: "Invalid user ID" });
      return;
    }

    const body = req.body || {};
    const updates: Partial<Record<VerificationFlag, boolean>> = {};
    for (const flag of VERIFICATION_FLAGS) {
      if (typeof body[flag] === "boolean") {
        updates[flag] = body[flag];
      }
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({
        success: false,
        message:
          "Provide at least one boolean flag: isVerifiedCreator, isVerifiedVendor, isVerifiedChurch, isVerifiedArtist",
      });
      return;
    }

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    const previous: Record<string, boolean | undefined> = {};
    for (const flag of Object.keys(updates) as VerificationFlag[]) {
      previous[flag] = (user as any)[flag];
      (user as any)[flag] = updates[flag];
      if (flag === "isVerifiedArtist") {
        if (!user.artistProfile) {
          (user as any).artistProfile = {};
        }
        (user as any).artistProfile.isVerifiedArtist = updates[flag];
      }
    }
    await user.save();

    await AuditService.logAdminAction(adminId, "update_verification", id, {
      updates,
      previous,
    });

    res.status(200).json({
      success: true,
      message: "Verification flags updated",
      data: {
        userId: id,
        isVerifiedCreator: user.isVerifiedCreator ?? false,
        isVerifiedVendor: user.isVerifiedVendor ?? false,
        isVerifiedChurch: user.isVerifiedChurch ?? false,
        isVerifiedArtist: user.isVerifiedArtist ?? false,
      },
    });
  } catch (error: any) {
    logger.error("Update user verification error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to update verification" });
  }
};

/**
 * PATCH /api/admin/churches/:id/verification
 * Body: { isVerified: boolean }
 */
export const updateChurchVerification = async (
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
    const { isVerified } = req.body || {};

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid church ID" });
      return;
    }
    if (typeof isVerified !== "boolean") {
      res.status(400).json({ success: false, message: "isVerified boolean is required" });
      return;
    }

    const church = await Church.findByIdAndUpdate(
      id,
      { $set: { isVerified } },
      { new: true }
    ).select("name isVerified");

    if (!church) {
      res.status(404).json({ success: false, message: "Church not found" });
      return;
    }

    await AuditService.logAdminAction(adminId, "update_church_verification", id, {
      isVerified,
      churchName: (church as any).name,
    });

    res.status(200).json({
      success: true,
      message: isVerified ? "Church verified" : "Church verification removed",
      data: {
        churchId: id,
        name: (church as any).name,
        isVerified: (church as any).isVerified,
      },
    });
  } catch (error: any) {
    logger.error("Update church verification error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to update church verification",
    });
  }
};

/**
 * DELETE /api/admin/media/:id
 * Admin force-delete any media (not only reported)
 */
export const adminDeleteMedia = async (req: Request, res: Response): Promise<void> => {
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

    const media = await Media.findById(id).select("title contentType uploadedBy");
    if (!media) {
      res.status(404).json({ success: false, message: "Media not found" });
      return;
    }

    await mediaService.deleteMedia(id, adminId, "admin");

    await MediaReport.updateMany(
      { mediaId: new Types.ObjectId(id), status: "pending" },
      {
        $set: {
          status: "resolved",
          reviewedBy: new Types.ObjectId(adminId),
          reviewedAt: new Date(),
          adminNotes: "Content deleted by admin",
        },
      }
    );

    await cacheService.del(`media:public:${id}`);
    await cacheService.del(`media:${id}`);
    await cacheService.delPattern("media:public:*");
    await cacheService.delPattern("media:all:*");

    await AuditService.logAdminAction(adminId, "delete_media", media.uploadedBy?.toString(), {
      mediaId: id,
      title: media.title,
      contentType: media.contentType,
    });

    res.status(200).json({
      success: true,
      message: "Media deleted",
      data: {
        mediaId: id,
        mediaTitle: media.title,
        contentType: media.contentType,
      },
    });
  } catch (error: any) {
    logger.error("Admin delete media error", { error: error.message });
    if (error.message === "Media not found") {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: "Failed to delete media" });
  }
};
