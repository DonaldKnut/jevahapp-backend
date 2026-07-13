import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import userService from "../../service/user.service";
import { Media } from "../../models/media.model";
import logger from "../../utils/logger";

/**
 * @swagger
 * components:
 *   schemas:
 *     UserProfile:
 *     UserProfile:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: User's unique identifier
 *         firstName:
 *           type: string
 *           description: User's first name
 *         lastName:
 *           type: string
 *           description: User's last name
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address
 *         avatar:
 *           type: string
 *           description: User's avatar URL
 *         avatarUpload:
 *           type: string
 *           description: User's uploaded avatar URL
 *         section:
 *           type: string
 *           enum: [kids, adults]
 *           description: User's section (kids or adults)
 *         role:
 *           type: string
 *           enum: [learner, parent, educator, moderator, admin, content_creator, vendor, church_admin, artist]
 *           description: User's role in the platform
 *         isProfileComplete:
 *           type: boolean
 *           description: Whether the user's profile is complete
 *         isEmailVerified:
 *           type: boolean
 *           description: Whether the user's email is verified
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: User creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: User last update timestamp
 *     UserListResponse:
 *       type: object
 *       properties:
 *         users:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/UserProfile'

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Get current user profile
 *     description: Retrieve the profile information of the currently authenticated user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
export const getCurrentUser = async (
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = request.userId; // populated by verifyToken middleware

    if (!userId) {
      logger.warn("Unauthorized access attempt - missing user ID", {
        ip: request.ip,
        userAgent: request.get("User-Agent"),
      });

      response.status(401).json({
        success: false,
        message: "Unauthorized: User ID missing",
      });
      return;
    }

    const user = await userService.getCurrentUser(userId);

    logger.info("Current user profile retrieved", { userId });

    response.status(200).json({
      success: true,
      data: user, // This will match your frontend expectation: data.firstName etc.
    });
  } catch (error: any) {
    logger.error("Error getting current user", {
      error: error.message,
      userId: request.userId,
    });
    next(error);
  }
};

/**
 * @swagger
 * /api/users/{userId}/posts:
 *   get:
 *     summary: Get user's posts
 *     description: Retrieve paginated list of user's posts (ebooks, devotionals, sermons)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User's unique identifier
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Posts retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Can only view own posts
 */
export const getUserPosts = async (
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = request.params;
    const currentUserId = request.userId;

    if (!currentUserId) {
      response.status(401).json({
        success: false,
        error: "Authentication required",
        code: "UNAUTHORIZED",
      });
      return;
    }

    // Authorization: Users can only view their own posts
    if (userId !== currentUserId.toString()) {
      response.status(403).json({
        success: false,
        error: "You can only view your own posts",
        code: "FORBIDDEN",
      });
      return;
    }

    const page = parseInt(request.query.page as string) || 1;
    const limit = parseInt(request.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Only user's own uploads, exclude default/copyright-free content
    const query = {
      uploadedBy: new mongoose.Types.ObjectId(userId),
      contentType: { $in: ["ebook", "devotional", "sermon"] },
      isDefaultContent: { $ne: true }, // Exclude default/pre-populated content
    };

    const [posts, total] = await Promise.all([
      Media.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Media.countDocuments(query),
    ]);

    response.status(200).json({
      success: true,
      data: {
        posts: posts.map((post: any) => ({
          _id: post._id,
          userId: post.uploadedBy.toString(),
          content: post.description || "",
          media: [
            {
              _id: post._id,
              url: post.fileUrl || post.thumbnailUrl,
              type: "image",
              thumbnail: post.thumbnailUrl || post.fileUrl,
            },
          ],
          likesCount: post.likeCount || 0,
          commentsCount: post.commentCount || 0,
          sharesCount: post.shareCount || 0,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: skip + posts.length < total,
        },
      },
    });
  } catch (error: any) {
    logger.error("Error fetching user posts", {
      error: error.message,
      userId: request.params.userId,
    });
    next(error);
  }
};

/**
 * @swagger
 * /api/users/{userId}/media:
 *   get:
 *     summary: Get user's media (images)
 *     description: Retrieve paginated list of user's uploaded images/photos
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User's unique identifier
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [image, video]
 *         description: Filter by media type
 *     responses:
 *       200:
 *         description: Media retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Can only view own media
 */
export const getUserMedia = async (
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = request.params;
    const currentUserId = request.userId;

    if (!currentUserId) {
      response.status(401).json({
        success: false,
        error: "Authentication required",
        code: "UNAUTHORIZED",
      });
      return;
    }

    // Authorization: Users can only view their own media
    if (userId !== currentUserId.toString()) {
      response.status(403).json({
        success: false,
        error: "You can only view your own media",
        code: "FORBIDDEN",
      });
      return;
    }

    const page = parseInt(request.query.page as string) || 1;
    const limit = parseInt(request.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const type = request.query.type as string;

    // Only user's own uploads, exclude default/copyright-free content
    const query: any = {
      uploadedBy: new mongoose.Types.ObjectId(userId),
      isDefaultContent: { $ne: true }, // Exclude default/pre-populated content
    };

    // Filter by type if provided - note: adjust based on your actual content type mapping
    if (type === "image") {
      // You may need to adjust this based on how images are stored
      query.contentType = { $in: ["image"] };
    } else if (type === "video") {
      query.contentType = { $in: ["videos", "sermon", "live", "recording"] };
    }

    const [media, total] = await Promise.all([
      Media.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Media.countDocuments(query),
    ]);

    response.status(200).json({
      success: true,
      data: {
        media: media.map((item: any) => ({
          _id: item._id,
          userId: item.uploadedBy.toString(),
          url: item.fileUrl || item.thumbnailUrl,
          thumbnail: item.thumbnailUrl || item.fileUrl,
          type: type === "video" ? "video" : "image",
          width: item.width,
          height: item.height,
          size: item.fileSize,
          createdAt: item.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: skip + media.length < total,
        },
      },
    });
  } catch (error: any) {
    logger.error("Error fetching user media", {
      error: error.message,
      userId: request.params.userId,
    });
    next(error);
  }
};

/**
 * @swagger
 * /api/users/{userId}/videos:
 *   get:
 *     summary: Get user's videos
 *     description: Retrieve paginated list of user's uploaded videos
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Videos retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Can only view own videos
 */
export const getUserVideos = async (
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = request.params;
    const currentUserId = request.userId;

    if (!currentUserId) {
      response.status(401).json({
        success: false,
        error: "Authentication required",
        code: "UNAUTHORIZED",
      });
      return;
    }

    // Authorization: Users can only view their own videos
    if (userId !== currentUserId.toString()) {
      response.status(403).json({
        success: false,
        error: "You can only view your own videos",
        code: "FORBIDDEN",
      });
      return;
    }

    const page = parseInt(request.query.page as string) || 1;
    const limit = parseInt(request.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Only user's own uploads, exclude default/copyright-free content
    const query = {
      uploadedBy: new mongoose.Types.ObjectId(userId),
      contentType: { $in: ["videos", "sermon", "live", "recording"] },
      isDefaultContent: { $ne: true }, // Exclude default/pre-populated content
    };

    const [videos, total] = await Promise.all([
      Media.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Media.countDocuments(query),
    ]);

    response.status(200).json({
      success: true,
      data: {
        videos: videos.map((video: any) => ({
          _id: video._id,
          userId: video.uploadedBy.toString(),
          url: video.fileUrl || video.playbackUrl || video.hlsUrl,
          thumbnail: video.thumbnailUrl || video.fileUrl,
          type: "video",
          duration: video.duration,
          width: video.width,
          height: video.height,
          size: video.fileSize,
          title: video.title,
          description: video.description,
          viewsCount: video.viewCount || 0,
          likesCount: video.likeCount || 0,
          createdAt: video.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: skip + videos.length < total,
        },
      },
    });
  } catch (error: any) {
    logger.error("Error fetching user videos", {
      error: error.message,
      userId: request.params.userId,
    });
    next(error);
  }
};

/**
 * @swagger
 * /api/users/{userId}/analytics:
 *   get:
 *     summary: Get user analytics
 *     description: Retrieve aggregated analytics metrics for the user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Analytics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Can only view own analytics
 */
export const getUserAnalytics = async (
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = request.params;
    const currentUserId = request.userId;

    if (!currentUserId) {
      response.status(401).json({
        success: false,
        error: "Authentication required",
        code: "UNAUTHORIZED",
      });
      return;
    }

    // Authorization: Users can only view their own analytics
    if (userId !== currentUserId.toString()) {
      response.status(403).json({
        success: false,
        error: "You can only view your own analytics",
        code: "FORBIDDEN",
      });
      return;
    }

    const userIdObj = new mongoose.Types.ObjectId(userId);

    // Base query filter: Only user's own uploads, exclude default/copyright-free content
    const baseUserContentFilter = {
      uploadedBy: userIdObj,
      isDefaultContent: { $ne: true }, // Exclude default/pre-populated content
      isHidden: { $ne: true }, // Exclude hidden/rejected content
      moderationStatus: { $ne: "rejected" }, // Exclude rejected content
      // Note: isPublicDomain content uploaded by user should count, so we don't exclude it
      // Only admin-uploaded copyright-free content is excluded via uploadedBy filter
    };

    // Aggregate analytics data - ONLY user uploads, NOT copyright-free/default content
    const [
      totalPosts,
      publishedPosts,
      draftPosts,
      totalLikes,
      totalComments,
      totalShares,
      liveSessions,
      draftVideos,
    ] = await Promise.all([
      // Total posts (ebook, devotional, sermon) - user uploads only
      Media.countDocuments({
        ...baseUserContentFilter,
        contentType: { $in: ["ebook", "devotional", "sermon"] },
      }),
      // Published posts (moderationStatus: "approved")
      Media.countDocuments({
        ...baseUserContentFilter,
        contentType: { $in: ["ebook", "devotional", "sermon"] },
        moderationStatus: "approved",
      }),
      // Draft posts (moderationStatus: "pending" or "under_review")
      Media.countDocuments({
        ...baseUserContentFilter,
        contentType: { $in: ["ebook", "devotional", "sermon"] },
        moderationStatus: { $in: ["pending", "under_review"] },
      }),
      // Total likes received (aggregate from Media) - user uploads only
      Media.aggregate([
        { $match: baseUserContentFilter },
        { $group: { _id: null, total: { $sum: "$likeCount" } } },
      ]).then((result) => result[0]?.total || 0),
      // Total comments received - user uploads only
      Media.aggregate([
        { $match: baseUserContentFilter },
        { $group: { _id: null, total: { $sum: "$commentCount" } } },
      ]).then((result) => result[0]?.total || 0),
      // Total shares received - user uploads only
      Media.aggregate([
        { $match: baseUserContentFilter },
        { $group: { _id: null, total: { $sum: "$shareCount" } } },
      ]).then((result) => result[0]?.total || 0),
      // Live sessions count - user uploads only
      Media.countDocuments({
        ...baseUserContentFilter,
        $or: [
          { isLive: true },
          { liveStreamStatus: "ended" },
          { contentType: "live" },
        ],
      }),
      // Draft videos (moderationStatus: "pending" or "under_review")
      Media.countDocuments({
        ...baseUserContentFilter,
        contentType: { $in: ["videos", "sermon", "live", "recording"] },
        moderationStatus: { $in: ["pending", "under_review"] },
      }),
    ]);

    // Calculate live sessions total duration - user uploads only
    const liveSessionsData = await Media.aggregate([
      {
        $match: {
          ...baseUserContentFilter,
          $or: [
            { isLive: true },
            { liveStreamStatus: "ended" },
            { contentType: "live" },
          ],
        },
      },
      {
        $group: {
          _id: null,
          totalDuration: {
            $sum: {
              $cond: [
                { $and: ["$actualStart", "$actualEnd"] },
                {
                  $divide: [
                    { $subtract: ["$actualEnd", "$actualStart"] },
                    1000,
                  ],
                },
                0,
              ],
            },
          },
        },
      },
    ]);
    const totalDuration = liveSessionsData[0]?.totalDuration || 0;

    response.status(200).json({
      success: true,
      data: {
        posts: {
          total: totalPosts,
          published: publishedPosts,
          drafts: draftPosts,
        },
        likes: {
          total: totalLikes,
          received: totalLikes,
        },
        liveSessions: {
          total: liveSessions,
          totalDuration: totalDuration,
        },
        comments: {
          total: totalComments,
          received: totalComments,
        },
        drafts: {
          total: draftPosts + draftVideos,
          posts: draftPosts,
          videos: draftVideos,
        },
        shares: {
          total: totalShares,
          received: totalShares,
        },
      },
    });
  } catch (error: any) {
    logger.error("Error fetching user analytics", {
      error: error.message,
      userId: request.params.userId,
    });
    next(error);
  }
};
