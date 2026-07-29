import { Types, ClientSession } from "mongoose";
import { Media } from "../../../models/media.model";
import { User } from "../../../models/user.model";
import { Devotional } from "../../../models/devotional.model";
import { ForumPost } from "../../../models/forumPost.model";
import { PrayerPost } from "../../../models/prayerPost.model";
import { CopyrightFreeSong } from "../../../models/copyrightFreeSong.model";
import { PUBLIC_MEDIA_FILTER } from "../../../lib/publicMediaVisibility";
import {
  ALL_LIKE_CONTENT_TYPES,
  LikeContentType,
  UNIVERSAL_LIKE_CONTENT_TYPES,
} from "./engagement.types";

/**
 * Feed / path aliases that persist as Media likes.
 * ebook/podcast remain transitional Media mappings (separate collections out of core scope).
 * Exact "devotional" stays on the Devotional collection path — do not map it to media here.
 */
const MEDIA_LIKE_ALIASES = new Set([
  "media",
  "video",
  "videos",
  "audio",
  "music",
  "live",
  "sermon",
  "sermons",
  "teachings",
  "recording",
  "image",
  "images",
  "ebook",
  "ebooks",
  "e-books",
  "books",
  "podcast",
  "podcasts",
]);

/** Normalize client path/body content types for like/view/metadata logic */
export function normalizeContentType(contentType: string): string {
  const t = (contentType || "").trim().toLowerCase();
  if (MEDIA_LIKE_ALIASES.has(t)) return "media";
  return t;
}

export type CommentableContentType = "media" | "devotional";

/** Comments only support media (incl. ebook/podcast aliases) and devotional */
export function resolveCommentContentType(contentType: string): string {
  const t = (contentType || "").trim().toLowerCase();
  if (t === "devotional") return "devotional";
  return normalizeContentType(contentType);
}

/** True when the path/body type can host a comment thread */
export function isCommentableContentType(contentType: string | undefined): boolean {
  if (!contentType) return false;
  const resolved = resolveCommentContentType(contentType);
  return resolved === "devotional" || resolved === "media";
}

/**
 * Normalize to a commentable collection key, or throw.
 * Use in HTTP controllers and CommentService — single policy.
 */
export function assertCommentableContentType(
  contentType: string | undefined
): CommentableContentType {
  if (!isCommentableContentType(contentType)) {
    throw new Error(
      `Comments not supported for content type: ${contentType || "(missing)"}`
    );
  }
  const resolved = resolveCommentContentType(contentType!);
  return resolved === "devotional" ? "devotional" : "media";
}

export function isValidLikeContentType(contentType: string): contentType is LikeContentType {
  return (ALL_LIKE_CONTENT_TYPES as readonly string[]).includes(contentType);
}

export function isUniversalLikeContentType(contentType: string): boolean {
  const normalized = normalizeContentType(contentType);
  return (UNIVERSAL_LIKE_CONTENT_TYPES as readonly string[]).includes(normalized);
}

export function toLikeContentType(contentType: string): LikeContentType {
  const normalized = normalizeContentType(contentType);
  if (normalized === "media") return "media";
  return contentType as LikeContentType;
}

export async function verifyContentExists(
  contentId: string,
  contentType: string,
  session?: ClientSession
): Promise<boolean> {
  if (!Types.ObjectId.isValid(contentId)) return false;

  const normalized = normalizeContentType(contentType);
  const query = session ? { session } : {};

  try {
    switch (normalized) {
      case "media":
      case "merch": {
        const media = await Media.findOne({
          _id: contentId,
          ...PUBLIC_MEDIA_FILTER,
        })
          .select("_id")
          .setOptions(query);
        return !!media;
      }
      case "artist": {
        const artist = await User.findById(contentId).select("_id").setOptions(query);
        return !!artist;
      }
      case "devotional": {
        const devotional = await Devotional.findById(contentId).select("_id").setOptions(query);
        return !!devotional;
      }
      default:
        break;
    }

    switch (contentType) {
      case "prayer": {
        const prayer = await PrayerPost.findById(contentId).select("_id").setOptions(query);
        return !!prayer;
      }
      case "forum_post": {
        const post = await ForumPost.findById(contentId).select("_id").setOptions(query);
        return !!post;
      }
      case "forum_comment": {
        const { Interaction } = await import("../../../models/interaction.model");
        const comment = await Interaction.findById(contentId)
          .select("_id interactionType")
          .setOptions(query);
        return !!comment && comment.interactionType === "comment";
      }
      case "copyright_free_song": {
        const song = await CopyrightFreeSong.findById(contentId).select("_id").setOptions(query);
        return !!song;
      }
      default:
        return false;
    }
  } catch {
    return false;
  }
}

export async function isUserOwnContent(
  userId: string,
  contentId: string,
  contentType: string,
  session?: ClientSession
): Promise<boolean> {
  const normalized = normalizeContentType(contentType);
  const query = session ? { session } : {};

  try {
    switch (normalized) {
      case "media":
      case "merch": {
        const media = await Media.findById(contentId).select("uploadedBy").setOptions(query);
        return media?.uploadedBy?.toString() === userId;
      }
      case "artist":
        return contentId === userId;
      default:
        return false;
    }
  } catch {
    return false;
  }
}
