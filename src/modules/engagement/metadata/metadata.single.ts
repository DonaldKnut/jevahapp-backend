import { Types } from "mongoose";
import { Media } from "../../../models/media.model";
import { User } from "../../../models/user.model";
import { Devotional } from "../../../models/devotional.model";
import { Interaction } from "../../../models/interaction.model";
import { Bookmark } from "../../../models/bookmark.model";
import { ViewEvent } from "../../../models/viewEvent.model";
import logger from "../../../utils/logger";
import { ContentMetadata, BOOKMARK_CONTENT_TYPES } from "../shared/engagement.types";
import { normalizeContentType } from "../shared/contentType.resolver";
import likeService from "../like/like.service";
import engagementShareService from "../share/share.service";

export class MetadataSingleService {
  async getContentMetadata(
    userId: string,
    contentId: string,
    contentType: string
  ): Promise<ContentMetadata> {
    if (!Types.ObjectId.isValid(contentId)) {
      throw new Error("Invalid content ID");
    }

    const normalized = normalizeContentType(contentType);
    const isDevotional = contentType === "devotional";
    let content: any;
    let author: any;

    switch (normalized) {
      case "media":
      case "merch":
        content = await Media.findById(contentId).populate(
          "uploadedBy",
          "firstName lastName avatar"
        );
        author = content?.uploadedBy;
        break;
      case "artist":
        content = await User.findById(contentId).select(
          "firstName lastName avatar artistProfile createdAt updatedAt"
        );
        author = content;
        break;
      default:
        if (isDevotional) {
          content = await Devotional.findById(contentId).populate(
            "submittedBy",
            "firstName lastName avatar"
          );
          author = content?.submittedBy;
          break;
        }
        throw new Error(`Unsupported content type: ${contentType}`);
    }

    if (!content) throw new Error("Content not found");

    const stats = await this.getContentStats(contentId, contentType);
    const userInteraction = await this.getUserInteraction(userId, contentId, contentType);

    let hasViewed = false;
    if (userId && Types.ObjectId.isValid(userId)) {
      const view = await ViewEvent.findOne({
        contentId: new Types.ObjectId(contentId),
        userId: new Types.ObjectId(userId),
      })
        .select("_id")
        .lean();
      hasViewed = !!view;
    }

    return {
      id: content._id.toString(),
      title:
        content.title || content.firstName || content.artistProfile?.artistName,
      description:
        content.description || content.bio || content.artistProfile?.bio,
      contentType,
      author: author
        ? {
            id: author._id.toString(),
            name:
              `${author.firstName || ""} ${author.lastName || ""}`.trim() ||
              author.artistProfile?.artistName,
            avatar: author.avatar,
          }
        : undefined,
      stats,
      userInteraction: { ...userInteraction, hasViewed },
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
    };
  }

  private async getContentStats(contentId: string, contentType: string) {
    const normalized = normalizeContentType(contentType);

    switch (normalized) {
      case "media":
      case "merch": {
        const media = await Media.findById(contentId);
        const commentCount = await this.getCommentCount(contentId);
        return {
          likes: media?.likeCount || 0,
          comments: commentCount,
          shares: media?.shareCount || 0,
          views: media?.viewCount || 0,
          downloads: media?.downloadCount || 0,
          saves: media?.bookmarkCount || 0,
        };
      }
      case "artist": {
        const artist = await User.findById(contentId);
        return {
          likes: 0,
          comments: 0,
          shares: 0,
          views: 0,
          saves: 0,
          followers: artist?.artistProfile?.followerCount || 0,
        };
      }
      default:
        if (contentType === "devotional") {
          const devotional = await Devotional.findById(contentId);
          const commentCount = await this.getCommentCount(contentId);
          return {
            likes: devotional?.likeCount || 0,
            comments: commentCount,
            shares: (devotional as any)?.shareCount || 0,
            views: (devotional as any)?.viewCount || 0,
            saves: 0,
          };
        }
        return { likes: 0, comments: 0, shares: 0, views: 0, saves: 0 };
    }
  }

  private async getCommentCount(contentId: string): Promise<number> {
    const contentObjId = new Types.ObjectId(contentId);
    const [topLevel, replies] = await Promise.all([
      Interaction.countDocuments({
        media: contentObjId,
        interactionType: "comment",
        isRemoved: { $ne: true },
        isHidden: { $ne: true },
        $or: [{ parentCommentId: { $exists: false } }, { parentCommentId: null }],
      }),
      Interaction.countDocuments({
        media: contentObjId,
        interactionType: "comment",
        isRemoved: { $ne: true },
        isHidden: { $ne: true },
        parentCommentId: { $exists: true, $ne: null },
      }),
    ]);
    return topLevel + replies;
  }

  private async getUserInteraction(userId: string, contentId: string, contentType: string) {
    const empty = {
      hasLiked: false,
      hasCommented: false,
      hasShared: false,
      hasFavorited: false,
      hasBookmarked: false,
    };

    if (!userId || !Types.ObjectId.isValid(userId)) return empty;

    try {
      const [hasLiked, hasCommented, hasShared, hasBookmarked] = await Promise.all([
        likeService.hasUserLiked(userId, contentId, contentType),
        this.checkUserComment(userId, contentId, contentType),
        engagementShareService.hasUserShared(userId, contentId),
        this.checkUserBookmark(userId, contentId, contentType),
      ]);

      return {
        hasLiked,
        hasCommented,
        hasShared,
        hasFavorited: hasLiked && normalizeContentType(contentType) === "merch",
        hasBookmarked,
      };
    } catch (error: any) {
      logger.error("Error in getUserInteraction", { error: error.message });
      return empty;
    }
  }

  private async checkUserComment(
    userId: string,
    contentId: string,
    contentType: string
  ): Promise<boolean> {
    const normalized = normalizeContentType(contentType);
    if (!["media", "devotional"].includes(normalized)) return false;
    const comment = await Interaction.findOne({
      user: new Types.ObjectId(userId),
      media: new Types.ObjectId(contentId),
      interactionType: "comment",
      isRemoved: { $ne: true },
    });
    return !!comment;
  }

  private async checkUserBookmark(
    userId: string,
    contentId: string,
    contentType: string
  ): Promise<boolean> {
    if (!(BOOKMARK_CONTENT_TYPES as readonly string[]).includes(contentType)) {
      return false;
    }
    const exists = await Bookmark.findOne({
      user: new Types.ObjectId(userId),
      media: new Types.ObjectId(contentId),
    })
      .select("_id")
      .lean();
    return !!exists;
  }
}
