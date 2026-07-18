import { Types } from "mongoose";
import { Like } from "../../models/like.model";
import { Bookmark } from "../../models/bookmark.model";

/**
 * Overlay per-user like/save flags onto feed media cards.
 * Safe to run on cached feed payloads — does not mutate Redis cache contents in-place
 * when caller passes a mapped copy.
 */
export async function attachFeedUserInteractionFlags(
  mediaItems: any[],
  userId?: string | null
): Promise<any[]> {
  if (!userId || !Types.ObjectId.isValid(userId) || !Array.isArray(mediaItems) || mediaItems.length === 0) {
    return mediaItems.map(item => ({
      ...item,
      hasLiked: item.hasLiked ?? false,
      hasBookmarked: item.hasBookmarked ?? false,
      userInteractions: item.userInteractions ?? {
        liked: item.hasLiked ?? false,
        saved: item.hasBookmarked ?? false,
      },
    }));
  }

  const ids = mediaItems
    .map(m => (m._id || m.id)?.toString?.())
    .filter((id): id is string => !!id && Types.ObjectId.isValid(id));

  if (ids.length === 0) return mediaItems;

  const objectIds = ids.map(id => new Types.ObjectId(id));
  const userObj = new Types.ObjectId(userId);

  const [likes, bookmarks] = await Promise.all([
    Like.find({
      userId: userObj,
      contentId: { $in: objectIds },
      contentType: "media",
    })
      .select("contentId")
      .lean(),
    Bookmark.find({
      user: userObj,
      media: { $in: objectIds },
    })
      .select("media")
      .lean(),
  ]);

  const likedSet = new Set(likes.map((l: any) => l.contentId.toString()));
  const savedSet = new Set(bookmarks.map((b: any) => b.media.toString()));

  return mediaItems.map(item => {
    const id = (item._id || item.id)?.toString?.() || "";
    const hasLiked = likedSet.has(id);
    const hasBookmarked = savedSet.has(id);
    return {
      ...item,
      hasLiked,
      hasBookmarked,
      userInteractions: {
        liked: hasLiked,
        saved: hasBookmarked,
      },
    };
  });
}
