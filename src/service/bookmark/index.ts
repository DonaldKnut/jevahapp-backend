import { toggleBookmark, type BookmarkResult } from "./bookmark.toggle";
import {
  getBookmarkCount,
  isBookmarked,
  getUserBookmarks,
  getBookmarkStats,
} from "./bookmark.query";
import { bulkBookmark } from "./bookmark.bulk";

export type { BookmarkResult } from "./bookmark.toggle";

export class UnifiedBookmarkService {
  static toggleBookmark = toggleBookmark;
  static getBookmarkCount = getBookmarkCount;
  static isBookmarked = isBookmarked;
  static getUserBookmarks = getUserBookmarks;
  static getBookmarkStats = getBookmarkStats;
  static bulkBookmark = bulkBookmark;
}
