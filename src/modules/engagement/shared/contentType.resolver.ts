import { Types, ClientSession } from "mongoose";
import { Media } from "../../../models/media.model";
import { User } from "../../../models/user.model";
import { Devotional } from "../../../models/devotional.model";
import { ForumPost } from "../../../models/forumPost.model";
import { PrayerPost } from "../../../models/prayerPost.model";
import { CopyrightFreeSong } from "../../../models/copyrightFreeSong.model";
import {
  ALL_LIKE_CONTENT_TYPES,
  LikeContentType,
  UNIVERSAL_LIKE_CONTENT_TYPES,
} from "./engagement.types";

/** ebook and podcast are Media collection items — normalize to media for like/view logic */
export function normalizeContentType(contentType: string): string {
  if (contentType === "ebook" || contentType === "podcast") {
    return "media";
  }
  return contentType;
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
        const media = await Media.findById(contentId).select("_id").setOptions(query);
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
