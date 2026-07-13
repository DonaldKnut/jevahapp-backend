/** Re-export save/bookmark service from engagement module boundary */
export {
  UnifiedBookmarkService as SaveService,
  UnifiedBookmarkService,
  type BookmarkResult as SaveToggleResult,
} from "../../../service/unifiedBookmark.service";
