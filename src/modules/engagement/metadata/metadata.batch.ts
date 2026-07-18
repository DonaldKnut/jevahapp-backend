import { Types } from "mongoose";
import { Media } from "../../../models/media.model";
import { User } from "../../../models/user.model";
import { Devotional } from "../../../models/devotional.model";
import { DevotionalLike } from "../../../models/devotionalLike.model";
import { Interaction } from "../../../models/interaction.model";
import { Bookmark } from "../../../models/bookmark.model";
import { Like } from "../../../models/like.model";
import { ViewEvent } from "../../../models/viewEvent.model";
import { ShareEvent } from "../../../models/shareEvent.model";
import logger from "../../../utils/logger";
import { BatchMetadataItem } from "../shared/engagement.types";
import { normalizeContentType } from "../shared/contentType.resolver";

export class MetadataBatchService {
  async getBatchContentMetadata(
    userId: string | undefined,
    contentIds: string[],
    contentType: string = "media"
  ): Promise<BatchMetadataItem[]> {
    const validIds = contentIds.filter(id => Types.ObjectId.isValid(id));
    if (validIds.length === 0) return [];

    let validUserId = userId || "";
    if (validUserId && !Types.ObjectId.isValid(validUserId)) validUserId = "";

    const normalized = normalizeContentType(contentType);
    const contentIdsObj = validIds.map(id => new Types.ObjectId(id));

    const isDevotional = contentType === "devotional";
    const [mediaDocs, devotionalDocs, commentCountMap] = await Promise.all([
      normalized === "media" || normalized === "merch"
        ? Media.find({ _id: { $in: contentIdsObj } })
            .select("likeCount shareCount viewCount bookmarkCount commentCount")
            .lean()
        : Promise.resolve([]),
      isDevotional
        ? Devotional.find({ _id: { $in: contentIdsObj } })
            .select("likeCount commentCount viewCount shareCount bookmarkCount")
            .lean()
        : Promise.resolve([]),
      Interaction.aggregate([
        {
          $match: {
            media: { $in: contentIdsObj },
            interactionType: "comment",
            isRemoved: { $ne: true },
            isHidden: { $ne: true },
          },
        },
        { $group: { _id: "$media", count: { $sum: 1 } } },
      ]),
    ]);

    const safeCommentCounts = commentCountMap || [];

    const mediaMap = new Map(
      (mediaDocs as any[]).map(m => [m._id.toString(), m])
    );
    const devotionalMap = new Map(
      (devotionalDocs as any[]).map(d => [d._id.toString(), d])
    );
    const commentsMap = new Map(
      safeCommentCounts.map((r: { _id: Types.ObjectId; count: number }) => [
        r._id.toString(),
        r.count,
      ])
    );

    const userLikesMap = new Map<string, boolean>();
    const userBookmarksMap = new Map<string, boolean>();
    const userSharesMap = new Map<string, boolean>();
    const userViewsMap = new Map<string, boolean>();

    if (validUserId) {
      try {
        const userIdObj = new Types.ObjectId(validUserId);

        if (normalized === "media") {
          // Durable Like rows only — do not hydrate liked=true from optimistic Redis
          const userLikes = await Like.find({
            userId: userIdObj,
            contentId: { $in: contentIdsObj },
            contentType: "media",
          })
            .select("contentId")
            .lean();
          userLikes.forEach(l => userLikesMap.set(l.contentId.toString(), true));
        } else if (normalized === "artist") {
          const user = await User.findById(userIdObj).select("following").lean();
          if ((user as any)?.following) {
            contentIdsObj.forEach(id => {
              if ((user as any).following.some((fid: any) => fid.toString() === id.toString())) {
                userLikesMap.set(id.toString(), true);
              }
            });
          }
        } else if (normalized === "merch") {
          const userLikes = await Like.find({
            userId: userIdObj,
            contentId: { $in: contentIdsObj },
            contentType: "merch",
          })
            .select("contentId")
            .lean();
          userLikes.forEach(l => userLikesMap.set(l.contentId.toString(), true));
        } else if (isDevotional) {
          const userLikes = await DevotionalLike.find({
            user: userIdObj,
            devotional: { $in: contentIdsObj },
          })
            .select("devotional")
            .lean();
          userLikes.forEach(l => userLikesMap.set(l.devotional.toString(), true));
        }

        const [userBookmarks, userShares, userViews] = await Promise.all([
          Bookmark.find({ user: userIdObj, media: { $in: contentIdsObj } })
            .select("media")
            .lean(),
          ShareEvent.find({ userId: userIdObj, contentId: { $in: contentIdsObj } })
            .select("contentId")
            .lean(),
          ViewEvent.find({ userId: userIdObj, contentId: { $in: contentIdsObj } })
            .select("contentId")
            .lean(),
        ]);

        userBookmarks.forEach(b => userBookmarksMap.set(b.media.toString(), true));
        userShares.forEach(s => userSharesMap.set(s.contentId.toString(), true));
        userViews.forEach(v => userViewsMap.set(v.contentId.toString(), true));
      } catch (error: any) {
        logger.error("Error in batch user interaction queries", {
          error: error.message,
          userId: validUserId,
        });
      }
    }

    return validIds.map(id => {
      const media = mediaMap.get(id);
      const devotional = devotionalMap.get(id);
      const doc = media ?? devotional;
      const commentCount =
        commentsMap.get(id) ?? (doc as any)?.commentCount ?? 0;
      return {
        id,
        likeCount: (doc as any)?.likeCount ?? 0,
        commentCount,
        shareCount: (doc as any)?.shareCount ?? 0,
        bookmarkCount: (doc as any)?.bookmarkCount ?? 0,
        viewCount: (doc as any)?.viewCount ?? 0,
        hasLiked: userLikesMap.has(id),
        hasBookmarked: userBookmarksMap.has(id),
        hasShared: userSharesMap.has(id),
        hasViewed: userViewsMap.has(id),
      };
    });
  }
}
