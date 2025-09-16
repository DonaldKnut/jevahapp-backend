"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentInteractionService = void 0;
const mongoose_1 = require("mongoose");
const mediaInteraction_model_1 = require("../models/mediaInteraction.model");
const media_model_1 = require("../models/media.model");
const user_model_1 = require("../models/user.model");
const devotional_model_1 = require("../models/devotional.model");
const devotionalLike_model_1 = require("../models/devotionalLike.model");
const notification_service_1 = require("./notification.service");
const logger_1 = __importDefault(require("../utils/logger"));
class ContentInteractionService {
    /**
     * Toggle like on any content type
     */
    toggleLike(userId, contentId, contentType) {
        return __awaiter(this, void 0, void 0, function* () {
            // Enhanced validation
            if (!mongoose_1.Types.ObjectId.isValid(userId) || !mongoose_1.Types.ObjectId.isValid(contentId)) {
                throw new Error("Invalid user or content ID");
            }
            // Validate content type
            const validContentTypes = [
                "media",
                "devotional",
                "artist",
                "merch",
                "ebook",
                "podcast",
            ];
            if (!validContentTypes.includes(contentType)) {
                throw new Error(`Unsupported content type: ${contentType}`);
            }
            logger_1.default.info("Toggle like request", {
                userId,
                contentId,
                contentType,
                timestamp: new Date().toISOString(),
            });
            const session = yield media_model_1.Media.startSession();
            try {
                let liked = false;
                let contentExists = false;
                yield session.withTransaction(() => __awaiter(this, void 0, void 0, function* () {
                    // First, verify content exists
                    contentExists = yield this.verifyContentExists(contentId, contentType, session);
                    if (!contentExists) {
                        throw new Error(`Content not found: ${contentType} with ID ${contentId}`);
                    }
                    // Check if user is trying to like their own content (optional business rule)
                    const isOwnContent = yield this.isUserOwnContent(userId, contentId, contentType, session);
                    if (isOwnContent) {
                        logger_1.default.info("User attempting to like own content", {
                            userId,
                            contentId,
                            contentType,
                        });
                        // Allow self-likes but log for analytics
                    }
                    // Handle different content types
                    switch (contentType) {
                        case "media":
                            liked = yield this.toggleMediaLike(userId, contentId, session);
                            break;
                        case "devotional":
                            liked = yield this.toggleDevotionalLike(userId, contentId, session);
                            break;
                        case "artist":
                            liked = yield this.toggleArtistFollow(userId, contentId, session);
                            break;
                        case "merch":
                            liked = yield this.toggleMerchFavorite(userId, contentId, session);
                            break;
                        case "ebook":
                        case "podcast":
                            // Handle ebook and podcast likes using media interaction
                            liked = yield this.toggleMediaLike(userId, contentId, session);
                            break;
                        default:
                            throw new Error(`Unsupported content type: ${contentType}`);
                    }
                }));
                const likeCount = yield this.getLikeCount(contentId, contentType);
                // Send notification if content was liked (not unliked)
                if (liked) {
                    try {
                        yield notification_service_1.NotificationService.notifyContentLike(userId, contentId, contentType);
                        logger_1.default.info("Like notification sent", {
                            userId,
                            contentId,
                            contentType,
                        });
                    }
                    catch (notificationError) {
                        // Don't fail the like operation if notification fails
                        logger_1.default.error("Failed to send like notification", {
                            error: notificationError.message,
                            userId,
                            contentId,
                            contentType,
                        });
                    }
                }
                logger_1.default.info("Toggle like completed", {
                    userId,
                    contentId,
                    contentType,
                    liked,
                    likeCount,
                    timestamp: new Date().toISOString(),
                });
                return {
                    liked,
                    likeCount,
                };
            }
            catch (error) {
                logger_1.default.error("Toggle like transaction failed", {
                    error: error.message,
                    userId,
                    contentId,
                    contentType,
                    timestamp: new Date().toISOString(),
                });
                throw error;
            }
            finally {
                session.endSession();
            }
        });
    }
    /**
     * Add comment to any content type
     */
    addComment(userId, contentId, contentType, content, parentCommentId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!mongoose_1.Types.ObjectId.isValid(userId) || !mongoose_1.Types.ObjectId.isValid(contentId)) {
                throw new Error("Invalid user or content ID");
            }
            if (!content || content.trim().length === 0) {
                throw new Error("Comment content is required");
            }
            // Only media and devotional support comments for now
            if (!["media", "devotional"].includes(contentType)) {
                throw new Error(`Comments not supported for content type: ${contentType}`);
            }
            const session = yield media_model_1.Media.startSession();
            try {
                const comment = yield session.withTransaction(() => __awaiter(this, void 0, void 0, function* () {
                    const commentData = {
                        user: new mongoose_1.Types.ObjectId(userId),
                        media: new mongoose_1.Types.ObjectId(contentId),
                        interactionType: "comment",
                        content: content.trim(),
                    };
                    if (parentCommentId && mongoose_1.Types.ObjectId.isValid(parentCommentId)) {
                        commentData.parentCommentId = new mongoose_1.Types.ObjectId(parentCommentId);
                    }
                    const comment = yield mediaInteraction_model_1.MediaInteraction.create([commentData], {
                        session,
                    });
                    // Update content comment count
                    if (contentType === "media") {
                        yield media_model_1.Media.findByIdAndUpdate(contentId, { $inc: { commentCount: 1 } }, { session });
                    }
                    return comment[0];
                }));
                // Populate user info for response
                const populatedComment = yield mediaInteraction_model_1.MediaInteraction.findById(comment._id)
                    .populate("user", "firstName lastName avatar")
                    .populate("parentCommentId", "content user");
                return populatedComment;
            }
            finally {
                session.endSession();
            }
        });
    }
    /**
     * Get comments for content
     */
    getContentComments(contentId_1, contentType_1) {
        return __awaiter(this, arguments, void 0, function* (contentId, contentType, page = 1, limit = 20) {
            if (!mongoose_1.Types.ObjectId.isValid(contentId)) {
                throw new Error("Invalid content ID");
            }
            if (!["media", "devotional"].includes(contentType)) {
                throw new Error("Comments not supported for this content type");
            }
            const skip = (page - 1) * limit;
            // For now, we'll use MediaInteraction for both media and devotional
            // TODO: Create a more generic ContentInteraction model in the future
            const comments = yield mediaInteraction_model_1.MediaInteraction.find({
                media: new mongoose_1.Types.ObjectId(contentId),
                interactionType: "comment",
                isRemoved: { $ne: true },
            })
                .populate("user", "firstName lastName avatar")
                .populate("parentCommentId", "content user")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);
            const total = yield mediaInteraction_model_1.MediaInteraction.countDocuments({
                media: new mongoose_1.Types.ObjectId(contentId),
                interactionType: "comment",
                isRemoved: { $ne: true },
            });
            return {
                comments,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                },
            };
        });
    }
    /**
     * Remove comment
     */
    removeContentComment(commentId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!mongoose_1.Types.ObjectId.isValid(commentId) || !mongoose_1.Types.ObjectId.isValid(userId)) {
                throw new Error("Invalid comment or user ID");
            }
            const comment = yield mediaInteraction_model_1.MediaInteraction.findOne({
                _id: commentId,
                user: userId,
                interactionType: "comment",
                isRemoved: { $ne: true },
            });
            if (!comment) {
                throw new Error("Comment not found or you don't have permission to delete it");
            }
            // Soft delete the comment
            yield mediaInteraction_model_1.MediaInteraction.findByIdAndUpdate(commentId, {
                isRemoved: true,
                content: "[Comment removed]",
            });
            // Decrement comment count on the content
            if (comment.media) {
                yield media_model_1.Media.findByIdAndUpdate(comment.media, {
                    $inc: { commentCount: -1 },
                });
            }
        });
    }
    /**
     * Get content metadata for frontend UI
     */
    getContentMetadata(userId, contentId, contentType) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            if (!mongoose_1.Types.ObjectId.isValid(contentId)) {
                throw new Error("Invalid content ID");
            }
            let content;
            let author;
            // Get content based on type
            switch (contentType) {
                case "media":
                    content = yield media_model_1.Media.findById(contentId).populate("uploadedBy", "firstName lastName avatar");
                    author = content === null || content === void 0 ? void 0 : content.uploadedBy;
                    break;
                case "devotional":
                    content = yield devotional_model_1.Devotional.findById(contentId).populate("author", "firstName lastName avatar");
                    author = content === null || content === void 0 ? void 0 : content.author;
                    break;
                case "artist":
                    content = yield user_model_1.User.findById(contentId).select("firstName lastName avatar artistProfile");
                    author = content;
                    break;
                case "merch":
                    content = yield media_model_1.Media.findById(contentId).populate("uploadedBy", "firstName lastName avatar");
                    author = content === null || content === void 0 ? void 0 : content.uploadedBy;
                    break;
                default:
                    throw new Error(`Unsupported content type: ${contentType}`);
            }
            if (!content) {
                throw new Error("Content not found");
            }
            // Get stats
            const stats = yield this.getContentStats(contentId, contentType);
            // Get user interactions
            const userInteraction = yield this.getUserInteraction(userId, contentId, contentType);
            return {
                id: content._id.toString(),
                title: content.title || content.firstName || ((_a = content.artistProfile) === null || _a === void 0 ? void 0 : _a.artistName),
                description: content.description || content.bio || ((_b = content.artistProfile) === null || _b === void 0 ? void 0 : _b.bio),
                contentType,
                author: author
                    ? {
                        id: author._id.toString(),
                        name: author.firstName + " " + author.lastName ||
                            ((_c = author.artistProfile) === null || _c === void 0 ? void 0 : _c.artistName),
                        avatar: author.avatar,
                    }
                    : undefined,
                stats,
                userInteraction,
                createdAt: content.createdAt,
                updatedAt: content.updatedAt,
            };
        });
    }
    /**
     * Get content statistics
     */
    getContentStats(contentId, contentType) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            switch (contentType) {
                case "media":
                    const media = yield media_model_1.Media.findById(contentId);
                    return {
                        likes: (media === null || media === void 0 ? void 0 : media.likeCount) || 0,
                        comments: (media === null || media === void 0 ? void 0 : media.commentCount) || 0,
                        shares: (media === null || media === void 0 ? void 0 : media.shareCount) || 0,
                        views: (media === null || media === void 0 ? void 0 : media.viewCount) || 0,
                        downloads: (media === null || media === void 0 ? void 0 : media.downloadCount) || 0,
                    };
                case "devotional":
                    const devotional = yield devotional_model_1.Devotional.findById(contentId);
                    const devotionalLikes = yield devotionalLike_model_1.DevotionalLike.countDocuments({
                        devotional: contentId,
                    });
                    return {
                        likes: devotionalLikes,
                        comments: 0, // Devotionals don't have comments yet
                        shares: 0,
                        views: (devotional === null || devotional === void 0 ? void 0 : devotional.viewCount) || 0,
                    };
                case "artist":
                    const artist = yield user_model_1.User.findById(contentId);
                    return {
                        likes: 0,
                        comments: 0,
                        shares: 0,
                        views: 0,
                        followers: ((_a = artist === null || artist === void 0 ? void 0 : artist.artistProfile) === null || _a === void 0 ? void 0 : _a.followerCount) || 0,
                    };
                case "merch":
                    const merch = yield media_model_1.Media.findById(contentId);
                    return {
                        likes: (merch === null || merch === void 0 ? void 0 : merch.likeCount) || 0,
                        comments: (merch === null || merch === void 0 ? void 0 : merch.commentCount) || 0,
                        shares: (merch === null || merch === void 0 ? void 0 : merch.shareCount) || 0,
                        views: (merch === null || merch === void 0 ? void 0 : merch.viewCount) || 0,
                        sales: 0, // TODO: Implement sales tracking
                    };
                default:
                    return { likes: 0, comments: 0, shares: 0, views: 0 };
            }
        });
    }
    /**
     * Get user interaction status
     */
    getUserInteraction(userId, contentId, contentType) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!userId) {
                return {
                    hasLiked: false,
                    hasCommented: false,
                    hasShared: false,
                    hasFavorited: false,
                    hasBookmarked: false,
                };
            }
            const [hasLiked, hasCommented, hasShared, hasFavorited, hasBookmarked] = yield Promise.all([
                this.checkUserLike(userId, contentId, contentType),
                this.checkUserComment(userId, contentId, contentType),
                this.checkUserShare(userId, contentId, contentType),
                this.checkUserFavorite(userId, contentId, contentType),
                this.checkUserBookmark(userId, contentId, contentType),
            ]);
            return {
                hasLiked,
                hasCommented,
                hasShared,
                hasFavorited,
                hasBookmarked,
            };
        });
    }
    /**
     * Check if user has liked content
     */
    checkUserLike(userId, contentId, contentType) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            switch (contentType) {
                case "media":
                    const mediaLike = yield mediaInteraction_model_1.MediaInteraction.findOne({
                        user: userId,
                        media: contentId,
                        interactionType: "like",
                        isRemoved: { $ne: true },
                    });
                    return !!mediaLike;
                case "devotional":
                    const devotionalLike = yield devotionalLike_model_1.DevotionalLike.findOne({
                        user: userId,
                        devotional: contentId,
                    });
                    return !!devotionalLike;
                case "artist":
                    const artist = yield user_model_1.User.findById(userId);
                    return ((_a = artist === null || artist === void 0 ? void 0 : artist.following) === null || _a === void 0 ? void 0 : _a.includes(contentId)) || false;
                default:
                    return false;
            }
        });
    }
    /**
     * Check if user has commented on content
     */
    checkUserComment(userId, contentId, contentType) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!["media", "devotional"].includes(contentType))
                return false;
            const comment = yield mediaInteraction_model_1.MediaInteraction.findOne({
                user: userId,
                media: contentId,
                interactionType: "comment",
                isRemoved: { $ne: true },
            });
            return !!comment;
        });
    }
    /**
     * Check if user has shared content
     */
    checkUserShare(userId, contentId, contentType) {
        return __awaiter(this, void 0, void 0, function* () {
            const share = yield mediaInteraction_model_1.MediaInteraction.findOne({
                user: userId,
                media: contentId,
                interactionType: "share",
                isRemoved: { $ne: true },
            });
            return !!share;
        });
    }
    /**
     * Check if user has favorited content
     */
    checkUserFavorite(userId, contentId, contentType) {
        return __awaiter(this, void 0, void 0, function* () {
            const favorite = yield mediaInteraction_model_1.MediaInteraction.findOne({
                user: userId,
                media: contentId,
                interactionType: "favorite",
                isRemoved: { $ne: true },
            });
            return !!favorite;
        });
    }
    /**
     * Check if user has bookmarked content
     */
    checkUserBookmark(userId, contentId, contentType) {
        return __awaiter(this, void 0, void 0, function* () {
            // TODO: Implement bookmark system
            return false;
        });
    }
    /**
     * Get like count for content
     */
    getLikeCount(contentId, contentType) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                switch (contentType) {
                    case "media":
                    case "ebook":
                    case "podcast":
                        const media = yield media_model_1.Media.findById(contentId).select("likeCount");
                        return (media === null || media === void 0 ? void 0 : media.likeCount) || 0;
                    case "devotional":
                        const devotionalLikes = yield devotionalLike_model_1.DevotionalLike.countDocuments({
                            devotional: contentId,
                        });
                        return devotionalLikes;
                    case "artist":
                        const artist = yield user_model_1.User.findById(contentId);
                        return ((_a = artist === null || artist === void 0 ? void 0 : artist.artistProfile) === null || _a === void 0 ? void 0 : _a.followerCount) || 0;
                    case "merch":
                        const merch = yield media_model_1.Media.findById(contentId).select("favoriteCount");
                        return (merch === null || merch === void 0 ? void 0 : merch.favoriteCount) || 0;
                    default:
                        return 0;
                }
            }
            catch (error) {
                logger_1.default.error("Failed to get like count", {
                    contentId,
                    contentType,
                    error: error.message,
                });
                return 0;
            }
        });
    }
    /**
     * Verify content exists in database
     */
    verifyContentExists(contentId, contentType, session) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                switch (contentType) {
                    case "media":
                    case "ebook":
                    case "podcast":
                        const media = yield media_model_1.Media.findById(contentId)
                            .session(session)
                            .select("_id");
                        return !!media;
                    case "devotional":
                        const devotional = yield devotional_model_1.Devotional.findById(contentId)
                            .session(session)
                            .select("_id");
                        return !!devotional;
                    case "artist":
                        const artist = yield user_model_1.User.findById(contentId)
                            .session(session)
                            .select("_id");
                        return !!artist;
                    case "merch":
                        const merch = yield media_model_1.Media.findById(contentId)
                            .session(session)
                            .select("_id");
                        return !!merch;
                    default:
                        return false;
                }
            }
            catch (error) {
                logger_1.default.error("Failed to verify content exists", {
                    contentId,
                    contentType,
                    error: error.message,
                });
                return false;
            }
        });
    }
    /**
     * Check if user owns the content
     */
    isUserOwnContent(userId, contentId, contentType, session) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                switch (contentType) {
                    case "media":
                    case "ebook":
                    case "podcast":
                    case "merch":
                        const media = yield media_model_1.Media.findById(contentId)
                            .session(session)
                            .select("uploadedBy");
                        return ((_a = media === null || media === void 0 ? void 0 : media.uploadedBy) === null || _a === void 0 ? void 0 : _a.toString()) === userId;
                    case "devotional":
                        const devotional = yield devotional_model_1.Devotional.findById(contentId)
                            .session(session)
                            .select("uploadedBy");
                        return ((_b = devotional === null || devotional === void 0 ? void 0 : devotional.uploadedBy) === null || _b === void 0 ? void 0 : _b.toString()) === userId;
                    case "artist":
                        return contentId === userId; // Artist ID is the same as user ID
                    default:
                        return false;
                }
            }
            catch (error) {
                logger_1.default.error("Failed to check content ownership", {
                    userId,
                    contentId,
                    contentType,
                    error: error.message,
                });
                return false;
            }
        });
    }
    /**
     * Toggle media like
     */
    toggleMediaLike(userId, contentId, session) {
        return __awaiter(this, void 0, void 0, function* () {
            const existingLike = yield mediaInteraction_model_1.MediaInteraction.findOne({
                user: new mongoose_1.Types.ObjectId(userId),
                media: new mongoose_1.Types.ObjectId(contentId),
                interactionType: "like",
                isRemoved: { $ne: true },
            }).session(session);
            if (existingLike) {
                // Unlike
                yield mediaInteraction_model_1.MediaInteraction.findByIdAndUpdate(existingLike._id, { isRemoved: true }, { session });
                yield media_model_1.Media.findByIdAndUpdate(contentId, { $inc: { likeCount: -1 } }, { session });
                return false;
            }
            else {
                // Like
                yield mediaInteraction_model_1.MediaInteraction.findOneAndUpdate({
                    user: new mongoose_1.Types.ObjectId(userId),
                    media: new mongoose_1.Types.ObjectId(contentId),
                    interactionType: "like",
                }, { isRemoved: false }, { upsert: true, session });
                yield media_model_1.Media.findByIdAndUpdate(contentId, { $inc: { likeCount: 1 } }, { session });
                return true;
            }
        });
    }
    /**
     * Toggle devotional like
     */
    toggleDevotionalLike(userId, contentId, session) {
        return __awaiter(this, void 0, void 0, function* () {
            const existingLike = yield devotionalLike_model_1.DevotionalLike.findOne({
                user: new mongoose_1.Types.ObjectId(userId),
                devotional: new mongoose_1.Types.ObjectId(contentId),
            }).session(session);
            if (existingLike) {
                // Unlike
                yield devotionalLike_model_1.DevotionalLike.findByIdAndDelete(existingLike._id, { session });
                yield devotional_model_1.Devotional.findByIdAndUpdate(contentId, { $inc: { likeCount: -1 } }, { session });
                return false;
            }
            else {
                // Like
                yield devotionalLike_model_1.DevotionalLike.create([
                    {
                        user: new mongoose_1.Types.ObjectId(userId),
                        devotional: new mongoose_1.Types.ObjectId(contentId),
                    },
                ], { session });
                yield devotional_model_1.Devotional.findByIdAndUpdate(contentId, { $inc: { likeCount: 1 } }, { session });
                return true;
            }
        });
    }
    /**
     * Toggle artist follow
     */
    toggleArtistFollow(userId, contentId, session) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const follower = yield user_model_1.User.findById(userId).session(session);
            const artist = yield user_model_1.User.findById(contentId).session(session);
            if (!follower || !artist) {
                throw new Error("User or artist not found");
            }
            const isFollowing = (_a = follower.following) === null || _a === void 0 ? void 0 : _a.some((followedArtistId) => followedArtistId.equals(new mongoose_1.Types.ObjectId(contentId)));
            if (isFollowing) {
                // Unfollow
                yield user_model_1.User.findByIdAndUpdate(userId, { $pull: { following: new mongoose_1.Types.ObjectId(contentId) } }, { session });
                yield user_model_1.User.findByIdAndUpdate(contentId, {
                    $pull: { followers: new mongoose_1.Types.ObjectId(userId) },
                    $inc: { "artistProfile.followerCount": -1 },
                }, { session });
                return false;
            }
            else {
                // Follow
                yield user_model_1.User.findByIdAndUpdate(userId, { $push: { following: new mongoose_1.Types.ObjectId(contentId) } }, { session });
                yield user_model_1.User.findByIdAndUpdate(contentId, {
                    $push: { followers: new mongoose_1.Types.ObjectId(userId) },
                    $inc: { "artistProfile.followerCount": 1 },
                }, { session });
                return true;
            }
        });
    }
    /**
     * Toggle merch favorite
     */
    toggleMerchFavorite(userId, contentId, session) {
        return __awaiter(this, void 0, void 0, function* () {
            const existingFavorite = yield mediaInteraction_model_1.MediaInteraction.findOne({
                user: new mongoose_1.Types.ObjectId(userId),
                media: new mongoose_1.Types.ObjectId(contentId),
                interactionType: "favorite",
                isRemoved: { $ne: true },
            }).session(session);
            if (existingFavorite) {
                // Remove favorite
                yield mediaInteraction_model_1.MediaInteraction.findByIdAndUpdate(existingFavorite._id, { isRemoved: true }, { session });
                return false;
            }
            else {
                // Add favorite
                yield mediaInteraction_model_1.MediaInteraction.findOneAndUpdate({
                    user: new mongoose_1.Types.ObjectId(userId),
                    media: new mongoose_1.Types.ObjectId(contentId),
                    interactionType: "favorite",
                }, { isRemoved: false }, { upsert: true, session });
                return true;
            }
        });
    }
}
exports.ContentInteractionService = ContentInteractionService;
exports.default = new ContentInteractionService();
