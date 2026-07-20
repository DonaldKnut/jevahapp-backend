import { Types } from "mongoose";
import { Media } from "../../../models/media.model";
import { Devotional } from "../../../models/devotional.model";
import { ShareEvent } from "../../../models/shareEvent.model";
import { ShareResult } from "../shared/engagement.types";
import { normalizeContentType, verifyContentExists } from "../shared/contentType.resolver";
import { publishEngagementEvent } from "../../../lib/engagementEvents";
import { setPostCounter } from "../../../lib/redisCounters";
import { NotificationService } from "../../../service/notification.service";
import logger from "../../../utils/logger";

export interface ShareLink {
  url: string;
  title: string;
  description: string;
  image?: string;
  platform: string;
}

/** Windowed append dedupe — same user+content within this window does not re-increment */
const SHARE_DEDUPE_WINDOW_MS = Number(process.env.SHARE_DEDUPE_WINDOW_MS || 5 * 60 * 1000);

export class EngagementShareService {
  private readonly baseUrl = process.env.API_BASE_URL || process.env.FRONTEND_URL || "http://localhost:4000";

  async shareContent(
    userId: string,
    contentId: string,
    contentType: string,
    sharePlatform?: string
  ): Promise<ShareResult> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(contentId)) {
      throw new Error("Invalid user or content ID");
    }
    if (!(await verifyContentExists(contentId, contentType))) {
      throw new Error(`Content not found: ${contentType} with ID ${contentId}`);
    }

    const normalized = normalizeContentType(contentType);
    const since = new Date(Date.now() - SHARE_DEDUPE_WINDOW_MS);
    const recent = await ShareEvent.findOne({
      userId: new Types.ObjectId(userId),
      contentId: new Types.ObjectId(contentId),
      sharedAt: { $gte: since },
    })
      .select("_id")
      .lean();

    if (recent) {
      const shareCount = await this.getShareCount(contentId, contentType);
      return { shared: true, shareCount };
    }

    const session = await Media.startSession();
    try {
      await session.withTransaction(async () => {
        await ShareEvent.create(
          [
            {
              userId: new Types.ObjectId(userId),
              contentId: new Types.ObjectId(contentId),
              contentType: normalized,
              platform: sharePlatform?.toLowerCase(),
              sharedAt: new Date(),
            },
          ],
          { session }
        );
        if (normalized === "media" || normalized === "merch") {
          await Media.findByIdAndUpdate(contentId, { $inc: { shareCount: 1 } }, { session });
        } else if (contentType === "devotional") {
          await Devotional.findByIdAndUpdate(contentId, { $inc: { shareCount: 1 } }, { session });
        }
      });
    } finally {
      session.endSession();
    }

    const shareCount = await this.getShareCount(contentId, contentType);
    // Refresh Redis share counter so cached feeds overlay the fresh count
    // (setPostCounter never rejects)
    void setPostCounter({ postId: contentId, field: "shares", count: shareCount });
    publishEngagementEvent("content.shared", {
      userId,
      contentId,
      contentType: normalized,
      platform: sharePlatform,
      shareCount,
    });

    void NotificationService.notifyContentShare(
      userId,
      contentId,
      normalized,
      sharePlatform
    ).catch(err => {
      logger.warn("Failed to send share notification", {
        error: (err as Error).message,
        contentId,
      });
    });

    return { shared: true, shareCount };
  }

  async hasUserShared(userId: string, contentId: string): Promise<boolean> {
    if (!userId || !Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(contentId)) {
      return false;
    }
    const event = await ShareEvent.findOne({
      userId: new Types.ObjectId(userId),
      contentId: new Types.ObjectId(contentId),
    })
      .select("_id")
      .lean();
    return !!event;
  }

  async getShareCount(contentId: string, contentType: string): Promise<number> {
    const normalized = normalizeContentType(contentType);
    if (normalized === "media" || normalized === "merch") {
      const m = await Media.findById(contentId).select("shareCount").lean();
      return (m as any)?.shareCount || 0;
    }
    if (contentType === "devotional") {
      const d = await Devotional.findById(contentId).select("shareCount").lean();
      return (d as any)?.shareCount || 0;
    }
    return ShareEvent.countDocuments({ contentId: new Types.ObjectId(contentId) });
  }

  async getShareStats(mediaId: string) {
    if (!Types.ObjectId.isValid(mediaId)) throw new Error("Invalid media ID");
    const contentId = new Types.ObjectId(mediaId);
    const [platformAgg, media] = await Promise.all([
      ShareEvent.aggregate([
        { $match: { contentId } },
        { $group: { _id: { $ifNull: ["$platform", "unknown"] }, count: { $sum: 1 } } },
      ]),
      Media.findById(mediaId).select("shareCount").lean(),
    ]);

    const platformBreakdown: Record<string, number> = {};
    let eventTotal = 0;
    for (const row of platformAgg) {
      const key = (row._id || "unknown").toLowerCase();
      platformBreakdown[key] = row.count;
      eventTotal += row.count;
    }
    return {
      totalShares: Math.max((media as any)?.shareCount ?? 0, eventTotal),
      platformBreakdown,
    };
  }

  async generateShareLink(mediaId: string, platform?: string): Promise<ShareLink> {
    const media = await Media.findById(mediaId)
      .select("title description thumbnailUrl coverImageUrl uploadedBy")
      .populate("uploadedBy", "firstName lastName")
      .lean();
    if (!media) throw new Error("Media not found");
    const uploader = (media as any).uploadedBy;
    return {
      url: `${this.baseUrl}/media/${mediaId}`,
      title: (media as any).title,
      description:
        (media as any).description ||
        `Check out this content by ${uploader?.firstName || "an artist"} on Jevah!`,
      image: (media as any).thumbnailUrl || (media as any).coverImageUrl,
      platform: platform || "web",
    };
  }

  async generateSocialShareUrls(mediaId: string, message?: string) {
    const { url, title, description } = await this.generateShareLink(mediaId);
    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title);
    const encodedDescription = encodeURIComponent(description);
    const msg = message ? encodeURIComponent(message) : "";
    return {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}${msg ? `%20${msg}` : ""}`,
      whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      email: `mailto:?subject=${encodedTitle}&body=${encodedDescription}%20${encodedUrl}`,
      copy: url,
    };
  }

  generateQRCode(mediaId: string): Promise<string> {
    return this.generateShareLink(mediaId).then(
      ({ url }) =>
        `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`
    );
  }

  generateEmbedCode(mediaId: string): Promise<string> {
    return this.generateShareLink(mediaId).then(
      ({ url }) =>
        `<iframe src="${url}/embed" width="560" height="315" frameborder="0" allowfullscreen></iframe>`
    );
  }
}

export default new EngagementShareService();
