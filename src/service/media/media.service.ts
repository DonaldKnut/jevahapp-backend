import type { MediaQueryService } from "./query.service";
import { IMedia } from "../../models/media.model";
import { mediaUploadService } from "./upload.service";
import { mediaQueryService } from "./query.service";
import { mediaEngagementService } from "./engagement.service";
import { mediaDownloadService } from "./download.service";
import { mediaAnalyticsService } from "./analytics.service";
import { mediaDeleteService } from "./delete.service";
import {
  MediaInput,
  MediaInteractionInput,
  MediaUserActionInput,
  ViewTrackingInput,
  PopulatedMedia,
} from "./types";

export * from "./types";

export class MediaService {
  uploadMedia(data: MediaInput): Promise<IMedia> {
    return mediaUploadService.uploadMedia(data);
  }

  getAllMedia(
    filters: any = {},
    options: { enforceModeration?: boolean; actingUserId?: string } = {
      enforceModeration: true,
    }
  ) {
    return mediaQueryService.getAllMedia(filters, options);
  }

  getAllContentForAllTab(options?: Parameters<MediaQueryService["getAllContentForAllTab"]>[0]) {
    return mediaQueryService.getAllContentForAllTab(options);
  }

  getRecommendationsForAllContent(
    userId?: string,
    options?: Parameters<MediaQueryService["getRecommendationsForAllContent"]>[1]
  ) {
    return mediaQueryService.getRecommendationsForAllContent(userId, options);
  }

  getMediaByIdentifier(
    mediaIdentifier: string,
    options: { actingUserId?: string; userRole?: string } = {}
  ) {
    return mediaQueryService.getMediaByIdentifier(mediaIdentifier, options);
  }

  getRecentMedia(limit: number) {
    return mediaQueryService.getRecentMedia(limit);
  }

  deleteMedia(mediaIdentifier: string, userIdentifier: string, userRole: string) {
    return mediaDeleteService.deleteMedia(mediaIdentifier, userIdentifier, userRole);
  }

  softDeleteMedia(mediaIdentifier: string, userIdentifier: string, userRole: string) {
    return mediaDeleteService.softDeleteMedia(mediaIdentifier, userIdentifier, userRole);
  }

  recordInteraction(data: MediaInteractionInput) {
    return mediaEngagementService.recordInteraction(data);
  }

  getInteractionCounts(mediaIdentifier: string) {
    return mediaEngagementService.getInteractionCounts(mediaIdentifier);
  }

  recordUserAction(data: MediaUserActionInput) {
    return mediaEngagementService.recordUserAction(data);
  }

  getUserActionStatus(userIdentifier: string, mediaIdentifier: string) {
    return mediaEngagementService.getUserActionStatus(userIdentifier, mediaIdentifier);
  }

  addToViewedMedia(userIdentifier: string, mediaIdentifier: string) {
    return mediaEngagementService.addToViewedMedia(userIdentifier, mediaIdentifier);
  }

  getViewedMedia(
    userIdentifier: string
  ): Promise<{ media: Partial<PopulatedMedia>; viewedAt: Date }[]> {
    return mediaEngagementService.getViewedMedia(userIdentifier);
  }

  getMediaCountByContentType() {
    return mediaAnalyticsService.getMediaCountByContentType();
  }

  getTotalInteractionCounts() {
    return mediaAnalyticsService.getTotalInteractionCounts();
  }

  getMediaCountSinceDate(since: Date) {
    return mediaAnalyticsService.getMediaCountSinceDate(since);
  }

  getInteractionCountSinceDate(since: Date) {
    return mediaAnalyticsService.getInteractionCountSinceDate(since);
  }

  getUserMediaCountByContentType(userIdentifier: string) {
    return mediaAnalyticsService.getUserMediaCountByContentType(userIdentifier);
  }

  getUserInteractionCounts(userIdentifier: string) {
    return mediaAnalyticsService.getUserInteractionCounts(userIdentifier);
  }

  getUserBookmarkCount(userIdentifier: string) {
    return mediaAnalyticsService.getUserBookmarkCount(userIdentifier);
  }

  getUserRecentMedia(userIdentifier: string, limit: number) {
    return mediaAnalyticsService.getUserRecentMedia(userIdentifier, limit);
  }

  getUserMediaCountSinceDate(userIdentifier: string, since: Date) {
    return mediaAnalyticsService.getUserMediaCountSinceDate(userIdentifier, since);
  }

  getUserInteractionCountSinceDate(userIdentifier: string, since: Date) {
    return mediaAnalyticsService.getUserInteractionCountSinceDate(userIdentifier, since);
  }

  trackViewWithDuration(data: ViewTrackingInput) {
    return mediaEngagementService.trackViewWithDuration(data);
  }

  getMediaWithEngagement(mediaId: string, userId: string) {
    return mediaEngagementService.getMediaWithEngagement(mediaId, userId);
  }

  downloadMedia(data: { mediaId: string; userId: string; fileSize?: number }) {
    return mediaDownloadService.downloadMedia(data);
  }

  getUserOfflineDownloads(
    userId: string,
    page?: number,
    limit?: number,
    filters?: { status?: string; contentType?: string }
  ) {
    return mediaDownloadService.getUserOfflineDownloads(userId, page, limit, filters);
  }

  removeFromOfflineDownloads(userId: string, mediaId: string) {
    return mediaDownloadService.removeFromOfflineDownloads(userId, mediaId);
  }

  updateDownloadStatus(
    userId: string,
    mediaId: string,
    updates: {
      localPath?: string;
      isDownloaded?: boolean;
      downloadStatus?: "pending" | "downloading" | "completed" | "failed" | "cancelled";
      downloadProgress?: number;
    }
  ) {
    return mediaDownloadService.updateDownloadStatus(userId, mediaId, updates);
  }

  getDownloadStatus(userId: string, mediaId: string) {
    return mediaDownloadService.getDownloadStatus(userId, mediaId);
  }

  downloadMediaFile(data: { mediaId: string; userId: string; range?: string }) {
    return mediaDownloadService.downloadMediaFile(data);
  }

  shareMedia(data: { mediaId: string; userId: string; platform?: string }) {
    return mediaEngagementService.shareMedia(data);
  }
}

export const mediaService = new MediaService();
