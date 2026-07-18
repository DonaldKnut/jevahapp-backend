/**
 * Canonical engagement types for like, save, share, view interactions.
 * Single source of truth for frontend contract alignment.
 */

export const UNIVERSAL_LIKE_CONTENT_TYPES = [
  "media",
  "artist",
  "merch",
  "ebook",
  "podcast",
  "devotional",
] as const;

export const COMMUNITY_LIKE_CONTENT_TYPES = [
  "prayer",
  "forum_post",
  "forum_comment",
] as const;

export const AUDIO_LIKE_CONTENT_TYPES = ["copyright_free_song"] as const;

export const ALL_LIKE_CONTENT_TYPES = [
  ...UNIVERSAL_LIKE_CONTENT_TYPES,
  ...COMMUNITY_LIKE_CONTENT_TYPES,
  ...AUDIO_LIKE_CONTENT_TYPES,
] as const;

export type UniversalLikeContentType = (typeof UNIVERSAL_LIKE_CONTENT_TYPES)[number];
export type CommunityLikeContentType = (typeof COMMUNITY_LIKE_CONTENT_TYPES)[number];
export type AudioLikeContentType = (typeof AUDIO_LIKE_CONTENT_TYPES)[number];
export type LikeContentType = (typeof ALL_LIKE_CONTENT_TYPES)[number];

export const BOOKMARK_CONTENT_TYPES = [
  "media",
  "ebook",
  "podcast",
  "merch",
] as const;

export type BookmarkContentType = (typeof BOOKMARK_CONTENT_TYPES)[number];

export const VIEW_CONTENT_TYPES = [
  "media",
  "devotional",
  "artist",
  "merch",
  "ebook",
  "podcast",
] as const;

export type ViewContentType = (typeof VIEW_CONTENT_TYPES)[number];

export const SHARE_CONTENT_TYPES = [
  "media",
  "devotional",
  "merch",
  "ebook",
  "podcast",
] as const;

export type ShareContentType = (typeof SHARE_CONTENT_TYPES)[number];

export interface LikeToggleResult {
  contentId: string;
  contentType?: string;
  liked: boolean;
  likeCount: number;
  updatedAt?: string;
  /** Active Like document id when liked — used for notification dedupe */
  likeId?: string;
}

export interface ShareResult {
  shared: boolean;
  shareCount: number;
}

export interface ViewRecordResult {
  contentId: string;
  viewCount: number;
  hasViewed: boolean;
  counted: boolean;
}

export interface BookmarkToggleResult {
  bookmarked: boolean;
  bookmarkCount: number;
}

export interface ContentMetadata {
  id: string;
  title: string;
  description?: string;
  contentType: string;
  author?: {
    id: string;
    name: string;
    avatar?: string;
  };
  stats: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
    downloads?: number;
    saves: number;
  };
  userInteraction: {
    hasLiked: boolean;
    hasCommented: boolean;
    hasShared: boolean;
    hasFavorited: boolean;
    hasBookmarked: boolean;
    hasViewed?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface BatchMetadataItem {
  id: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  bookmarkCount: number;
  viewCount: number;
  hasLiked: boolean;
  hasBookmarked: boolean;
  hasShared: boolean;
  hasViewed: boolean;
}
