import { Request, Response } from "express";
import { Types } from "mongoose";
import engagementShareService from "./share.service";
import logger from "../../../utils/logger";

export const getShareUrls = async (req: Request, res: Response): Promise<void> => {
  try {
    const { mediaId } = req.params;
    const { message } = req.query;

    if (!mediaId || !Types.ObjectId.isValid(mediaId)) {
      res.status(400).json({ success: false, message: "Invalid media ID" });
      return;
    }

    const [shareUrls, qrCode, embedCode] = await Promise.all([
      engagementShareService.generateSocialShareUrls(mediaId, message as string),
      engagementShareService.generateQRCode(mediaId),
      engagementShareService.generateEmbedCode(mediaId),
    ]);

    res.status(200).json({ success: true, data: { shareUrls, qrCode, embedCode } });
  } catch (error: any) {
    logger.error("Get share URLs error", { error: error.message, mediaId: req.params.mediaId });
    if (error.message.includes("not found")) {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: "Failed to get share URLs" });
  }
};

export const getShareStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { mediaId } = req.params;
    if (!mediaId || !Types.ObjectId.isValid(mediaId)) {
      res.status(400).json({ success: false, message: "Invalid media ID" });
      return;
    }

    const stats = await engagementShareService.getShareStats(mediaId);
    res.status(200).json({ success: true, data: stats });
  } catch (error: any) {
    logger.error("Get share stats error", { error: error.message, mediaId: req.params.mediaId });
    res.status(500).json({ success: false, message: "Failed to get share statistics" });
  }
};
