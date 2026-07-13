import { Types } from "mongoose";
import { Media } from "../../../models/media.model";
import { User } from "../../../models/user.model";
import { Devotional } from "../../../models/devotional.model";
import { ForumPost } from "../../../models/forumPost.model";
import { PrayerPost } from "../../../models/prayerPost.model";
import { Like } from "../../../models/like.model";
import logger from "../../../utils/logger";
import { normalizeContentType } from "../shared/contentType.resolver";

export async function getLikeCountFromDB(
  contentId: string,
  contentType: string
): Promise<number> {
  const normalized = normalizeContentType(contentType);
  try {
    switch (normalized) {
      case "media": {
        const media = await Media.findById(contentId).select("likeCount").lean();
        return (media as any)?.likeCount || 0;
      }
      case "artist": {
        const artist = await User.findById(contentId)
          .select("artistProfile.followerCount")
          .lean();
        return (artist as any)?.artistProfile?.followerCount || 0;
      }
      case "merch": {
        const merch = await Media.findById(contentId).select("likeCount favoriteCount").lean();
        return (merch as any)?.likeCount ?? (merch as any)?.favoriteCount ?? 0;
      }
      case "devotional": {
        const d = await Devotional.findById(contentId).select("likeCount").lean();
        return (d as any)?.likeCount || 0;
      }
      default:
        if (contentType === "prayer") {
          const p = await PrayerPost.findById(contentId).select("likesCount").lean();
          return (p as any)?.likesCount || 0;
        }
        if (contentType === "forum_post") {
          const p = await ForumPost.findById(contentId).select("likesCount").lean();
          return (p as any)?.likesCount || 0;
        }
        if (contentType === "forum_comment") {
          return Like.countDocuments({
            contentId: new Types.ObjectId(contentId),
            contentType: "forum_comment",
          });
        }
        return 0;
    }
  } catch (error: any) {
    logger.error("Failed to get like count from DB", {
      contentId,
      contentType,
      error: error.message,
    });
    return 0;
  }
}
