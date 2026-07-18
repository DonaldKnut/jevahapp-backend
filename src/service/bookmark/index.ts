import { toggleBookmark, type BookmarkResult } from "./bookmark.toggle";
import {
  getBookmarkCount,
  isBookmarked,
  getUserBookmarks,
  getBookmarkStats,
} from "./bookmark.query";
import { bulkBookmark } from "./bookmark.bulk";

export type { BookmarkResult } from "./bookmark.toggle";
export { mapBookmarkContentType } from "./bookmark.toggle";

export class UnifiedBookmarkService {
  static toggleBookmark(
    userId: string,
    mediaId: string,
    contentTypeHint?: string
  ) {
    return toggleBookmark(userId, mediaId, contentTypeHint);
  }
  static getBookmarkCount = getBookmarkCount;
  static isBookmarked = isBookmarked;
  static getUserBookmarks = getUserBookmarks;
  static getBookmarkStats = getBookmarkStats;
  static bulkBookmark = bulkBookmark;
}
