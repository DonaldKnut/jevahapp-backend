import { getAllMedia } from "./query/getAllMedia";
import { getAllContentForAllTab } from "./query/allContentFeed";
import { getRecommendationsForAllContent } from "./query/recommendations";
import { getMediaByIdentifier, getRecentMedia } from "./query/getById";

export class MediaQueryService {
  async getAllMedia(
    filters: any = {},
    options: { enforceModeration?: boolean; actingUserId?: string } = {
      enforceModeration: true,
    }
  ) {
    return getAllMedia(filters, options);
  }

  async getAllContentForAllTab(options?: any) {
    return getAllContentForAllTab(options);
  }

  async getRecommendationsForAllContent(
    userId?: string,
    options?: { limitPerSection?: number; mood?: string }
  ) {
    return getRecommendationsForAllContent(userId, options);
  }

  async getMediaByIdentifier(
    mediaIdentifier: string,
    options: { actingUserId?: string; userRole?: string } = {}
  ) {
    return getMediaByIdentifier(mediaIdentifier, options);
  }

  async getRecentMedia(limit: number) {
    return getRecentMedia(limit);
  }
}

export const mediaQueryService = new MediaQueryService();
