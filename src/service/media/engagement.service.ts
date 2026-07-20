import { Media } from "../../models/media.model";
import { Interaction } from "../../models/interaction.model";
import { User } from "../../models/user.model";
import { UserViewedMedia } from "../../models/userViewedMedia.model";
import { MediaUserAction } from "../../models/mediaUserAction.model";
import { Like } from "../../models/like.model";
import { Types, ClientSession } from "mongoose";
import { EmailService } from "../../config/email.config";
import {
  MediaInteractionInput,
  MediaUserActionInput,
  PopulatedMedia,
  LeanUserViewedMedia,
  ViewTrackingInput,
} from "./types";

export class MediaEngagementService {
  async recordInteraction(data: MediaInteractionInput) {
    if (!Types.ObjectId.isValid(data.mediaIdentifier)) {
      throw new Error("Invalid media identifier");
    }

    const media = await Media.findById(data.mediaIdentifier);
    if (!media) {
      throw new Error("Media not found");
    }

    // Allow "download" interaction for all content types
    // Other interaction types have specific restrictions per content type
    if (data.interactionType !== "download") {
      if (
        (media.contentType === "videos" && data.interactionType !== "view") ||
        (media.contentType === "music" && data.interactionType !== "listen") ||
        (media.contentType === "ebook" &&
          !["read", "download"].includes(data.interactionType))
      ) {
        throw new Error(
          `Invalid interaction type ${data.interactionType} for ${media.contentType} media`
        );
      }
    }

    const session: ClientSession = await Media.startSession();
    try {
      const interaction = await session.withTransaction(async () => {
        const isUserAuth = Types.ObjectId.isValid(data.userIdentifier);
        let interactionResult = null;

        if (isUserAuth) {
          const userIdObj = new Types.ObjectId(data.userIdentifier);
          const existingInteraction = await Interaction.findOne({
            user: userIdObj,
            media: new Types.ObjectId(data.mediaIdentifier),
            interactionType: data.interactionType,
          }).session(session);

          if (!existingInteraction) {
            const created = await Interaction.create(
              [
                {
                  user: userIdObj,
                  media: new Types.ObjectId(data.mediaIdentifier),
                  interactionType: data.interactionType,
                  lastInteraction: new Date(),
                  count: 1,
                  interactions: data.duration
                    ? [
                      {
                        timestamp: new Date(),
                        duration: data.duration,
                        isComplete: false,
                      },
                    ]
                    : [],
                },
              ],
              { session }
            );
            interactionResult = created[0];
          } else {
            // Update existing interaction but don't error - allow count increment
            await Interaction.updateOne(
              { _id: existingInteraction._id },
              {
                $inc: { count: 1 },
                $set: { lastInteraction: new Date() },
                $push: {
                  interactions: data.duration
                    ? {
                      timestamp: new Date(),
                      duration: data.duration,
                      isComplete: false,
                    }
                    : undefined,
                },
              },
              { session }
            );
            interactionResult = existingInteraction;
          }
        }

        // Atomic global count increment (always happens, even for anonymous or repeat views)
        const updateField: { [key: string]: number } = {};
        if (data.interactionType === "view") updateField.viewCount = 1;
        if (data.interactionType === "listen") updateField.listenCount = 1;
        if (data.interactionType === "read") updateField.readCount = 1;
        if (data.interactionType === "download") updateField.downloadCount = 1;

        await Media.findByIdAndUpdate(
          data.mediaIdentifier,
          { $inc: updateField },
          { session }
        );

        return interactionResult;
      });

      return interaction;
    } finally {
      session.endSession();
    }
  }

  async getInteractionCounts(mediaIdentifier: string) {
    if (!Types.ObjectId.isValid(mediaIdentifier)) {
      throw new Error("Invalid media identifier");
    }

    const media = await Media.findById(mediaIdentifier).select(
      "contentType viewCount listenCount readCount downloadCount favoriteCount shareCount likeCount"
    );
    if (!media) {
      throw new Error("Media not found");
    }

    const result: {
      viewCount?: number;
      listenCount?: number;
      readCount?: number;
      downloadCount?: number;
      favoriteCount?: number;
      shareCount?: number;
      likeCount?: number;
    } = {};

    if (media.contentType === "videos") result.viewCount = media.viewCount;
    if (media.contentType === "music") result.listenCount = media.listenCount;
    if (media.contentType === "books") {
      result.readCount = media.readCount;
      result.downloadCount = media.downloadCount;
    }
    result.favoriteCount = media.favoriteCount;
    result.likeCount = media.likeCount || 0;
    result.shareCount = media.shareCount;

    return result;
  }

  async recordUserAction(data: MediaUserActionInput) {
    if (!data.userIdentifier || !data.mediaIdentifier || !data.actionType) {
      throw new Error(
        "User identifier, media identifier, and action type are required"
      );
    }

    if (!["favorite", "share"].includes(data.actionType)) {
      throw new Error("Invalid action type. Must be 'favorite' or 'share'");
    }

    const media = await Media.findById(data.mediaIdentifier);
    if (!media) {
      throw new Error("Media not found");
    }

    const user = await User.findById(data.userIdentifier);
    if (!user) {
      throw new Error("User not found");
    }

    if (media.uploadedBy.toString() === data.userIdentifier) {
      throw new Error("You cannot favorite or share your own content");
    }

    const session: ClientSession = await Media.startSession();
    try {
      const action = await session.withTransaction(async () => {
        const existingAction = await MediaUserAction.findOne({
          user: new Types.ObjectId(data.userIdentifier),
          media: new Types.ObjectId(data.mediaIdentifier),
          actionType: data.actionType,
        }).session(session);

        let resultAction;
        const updateField: { [key: string]: number } = {};

        if (existingAction) {
          await MediaUserAction.findByIdAndDelete(existingAction._id).session(
            session
          );
          if (data.actionType === "favorite") updateField.favoriteCount = -1;
          if (data.actionType === "share") updateField.shareCount = -1;

          resultAction = {
            ...existingAction.toObject(),
            _id: existingAction._id,
            removed: true,
          };
        } else {
          const newAction = await MediaUserAction.create(
            [
              {
                user: new Types.ObjectId(data.userIdentifier),
                media: new Types.ObjectId(data.mediaIdentifier),
                actionType: data.actionType,
                createdAt: new Date(),
              },
            ],
            { session }
          );

          if (data.actionType === "favorite") updateField.favoriteCount = 1;
          if (data.actionType === "share") updateField.shareCount = 1;

          resultAction = newAction[0];
        }

        await Media.findByIdAndUpdate(
          data.mediaIdentifier,
          { $inc: updateField },
          { session }
        );

        if (data.actionType === "favorite" && !resultAction.removed) {
          try {
            const artist = await User.findById(media.uploadedBy);
            if (
              artist &&
              artist.email &&
              artist.emailNotifications?.mediaLikes
            ) {
              await EmailService.sendMediaLikedEmail(
                artist.email,
                media.title,
                artist.firstName || artist.artistProfile?.artistName || "Artist"
              );
            }
          } catch (emailError) {
            console.error(
              "Failed to send like notification email:",
              emailError
            );
          }
        }

        return resultAction;
      });

      return action;
    } finally {
      session.endSession();
    }
  }

  async getUserActionStatus(userIdentifier: string, mediaIdentifier: string) {
    if (
      !Types.ObjectId.isValid(userIdentifier) ||
      !Types.ObjectId.isValid(mediaIdentifier)
    ) {
      throw new Error("Invalid user or media identifier");
    }

    const [actions, like] = await Promise.all([
      MediaUserAction.find({
        user: new Types.ObjectId(userIdentifier),
        media: new Types.ObjectId(mediaIdentifier),
      }).select("actionType"),
      Like.findOne({
        userId: new Types.ObjectId(userIdentifier),
        contentId: new Types.ObjectId(mediaIdentifier),
      }).select("_id").lean()
    ]);

    const status = {
      isFavorited: false,
      isShared: false,
      isLiked: !!like
    };

    actions.forEach(action => {
      if (action.actionType === "favorite") status.isFavorited = true;
      if (action.actionType === "share") status.isShared = true;
    });

    return status;
  }

  async addToViewedMedia(userIdentifier: string, mediaIdentifier: string) {
    if (
      !Types.ObjectId.isValid(userIdentifier) ||
      !Types.ObjectId.isValid(mediaIdentifier)
    ) {
      throw new Error("Invalid user or media identifier");
    }

    const media = await Media.findById(mediaIdentifier);
    if (!media) {
      throw new Error("Media not found");
    }

    const session: ClientSession = await UserViewedMedia.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const update = await UserViewedMedia.findOneAndUpdate(
          { user: new Types.ObjectId(userIdentifier) },
          {
            $push: {
              viewedMedia: {
                $each: [
                  {
                    media: new Types.ObjectId(mediaIdentifier),
                    viewedAt: new Date(),
                  },
                ],
                $slice: -50,
              },
            },
          },
          { upsert: true, new: true, session }
        );

        return update;
      });

      return result;
    } finally {
      session.endSession();
    }
  }

  async getViewedMedia(
    userIdentifier: string
  ): Promise<{ media: Partial<PopulatedMedia>; viewedAt: Date }[]> {
    if (!Types.ObjectId.isValid(userIdentifier)) {
      throw new Error("Invalid user identifier");
    }

    const viewedMedia = await UserViewedMedia.findOne({
      user: new Types.ObjectId(userIdentifier),
    })
      .populate<{ viewedMedia: { media: PopulatedMedia; viewedAt: Date }[] }>({
        path: "viewedMedia.media",
        select:
          "title contentType category createdAt thumbnailUrl fileUrl topics duration uploadedBy",
        populate: { path: "uploadedBy", select: "firstName lastName avatar" },
      })
      .lean<LeanUserViewedMedia>();

    return viewedMedia ? viewedMedia.viewedMedia : [];
  }

  /**
   * @deprecated Use modules/engagement/view contentView.service (Mongo + ViewEvent dedupe).
   */
  async trackViewWithDuration(data: ViewTrackingInput) {
    const {
      userIdentifier,
      mediaIdentifier,
      duration,
      isComplete = false,
    } = data;

    if (!userIdentifier || !mediaIdentifier) {
      throw new Error("User identifier and media identifier are required");
    }

    if (duration < 0) {
      throw new Error("Duration must be a positive number");
    }

    const viewService = (await import("../../modules/engagement/view/view.service")).default;
    const result = await viewService.recordView({
      userId: userIdentifier,
      contentId: mediaIdentifier,
      contentType: "media",
      // Legacy callers passed seconds; contentView expects ms when values are large
      durationMs: duration < 1000 ? duration * 1000 : duration,
      isComplete,
      source: "legacy:mediaEngagement.trackViewWithDuration",
    });

    if (result.counted) {
      this.addToViewedMedia(userIdentifier, mediaIdentifier).catch(() => {});
    }

    return { success: true, countedAsView: result.counted, viewCount: result.viewCount };
  }

  async getMediaWithEngagement(mediaId: string, userId: string) {
    try {
      const media = await Media.findById(mediaId).populate(
        "uploadedBy",
        "firstName lastName avatar"
      );
      if (!media) {
        throw new Error("Media not found");
      }

      // Get user's interaction status
      const userAction = await MediaUserAction.findOne({
        user: userId,
        media: mediaId,
      });

      return {
        ...media.toObject(),
        userAction: userAction
          ? {
            isFavorited: userAction.actionType === "favorite",
            isShared: userAction.actionType === "share",
          }
          : {
            isFavorited: false,
            isShared: false,
          },
      };
    } catch (error) {
      throw error;
    }
  }

  async shareMedia(data: {
    mediaId: string;
    userId: string;
    platform?: string;
  }) {
    try {
      const { mediaId, userId, platform } = data;

      const media = await Media.findById(mediaId);
      if (!media) {
        throw new Error("Media not found");
      }

      // Record share interaction
      await this.recordUserAction({
        userIdentifier: userId,
        mediaIdentifier: mediaId,
        actionType: "share",
        metadata: { platform },
      });

      // Generate share URL
      const shareUrl = `${process.env.FRONTEND_URL}/media/${mediaId}`;

      return {
        success: true,
        shareUrl,
        message: "Media shared successfully",
      };
    } catch (error) {
      throw error;
    }
  }
}

export const mediaEngagementService = new MediaEngagementService();
