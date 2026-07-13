/**
 * Legacy share API — delegates to engagement share module.
 */
import engagementShareService, {
  ShareLink,
} from "../modules/engagement/share/share.service";
import logger from "../utils/logger";

export type { ShareLink };

export interface ShareData {
  mediaId: string;
  userId: string;
  platform?: string;
  message?: string;
}

export class ShareService {
  generateShareLink = engagementShareService.generateShareLink.bind(engagementShareService);
  generateSocialShareUrls =
    engagementShareService.generateSocialShareUrls.bind(engagementShareService);
  generateQRCode = engagementShareService.generateQRCode.bind(engagementShareService);
  generateEmbedCode = engagementShareService.generateEmbedCode.bind(engagementShareService);
  getShareStats = engagementShareService.getShareStats.bind(engagementShareService);

  async shareToPlatform(
    data: ShareData
  ): Promise<{ success: boolean; shareUrl?: string; message: string }> {
    try {
      const { mediaId, platform, message, userId } = data;
      if (!platform) throw new Error("Platform is required for sharing");

      const socialUrls = await engagementShareService.generateSocialShareUrls(mediaId, message);
      const key = platform.toLowerCase() as keyof typeof socialUrls;
      if (!socialUrls[key]) throw new Error(`Unsupported platform: ${platform}`);

      logger.info("Media shared to platform", { mediaId, platform, userId });
      return {
        success: true,
        shareUrl: socialUrls[key],
        message: `Successfully shared to ${platform}`,
      };
    } catch (error) {
      logger.error("Error sharing to platform", {
        error: (error as Error).message,
        data,
      });
      return { success: false, message: (error as Error).message };
    }
  }
}

export default new ShareService();
