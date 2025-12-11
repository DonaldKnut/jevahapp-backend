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
const viralContent_service_1 = __importDefault(require("./viralContent.service"));
const mentionDetection_service_1 = __importDefault(require("./mentionDetection.service"));
const logger_1 = __importDefault(require("../utils/logger"));
const bookmark_model_1 = require("../models/bookmark.model");
class ContentInteractionService {
    sanitizeCommentContent(raw) {
        const urlRegex = /(https?:\/\/|www\.)[^\s]+/gi;
        let text = (raw || "").toString();
        text = text.replace(urlRegex, "");
        const list = (process.env.PROFANITY_BLOCK_LIST || "")
            .split(",")
            .map(w => w.trim())
            .filter(Boolean);
        let hadProfanity = false;
        for (const word of list) {
            const pattern = new RegExp(`\\b${word.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "ig");
            if (pattern.test(text)) {
                hadProfanity = true;
                text = text.replace(pattern, "***");
            }
        }
        return { text: text.trim(), hadProfanity };
    }
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
                // Read the updated like count after transaction commits
                // This ensures we get the accurate count that was just updated
                const likeCount = yield this.getLikeCount(contentId, contentType);
                // Send notification if content was liked (not unliked)
                if (liked) {
                    try {
                        if (contentType === "artist") {
                            yield notification_service_1.NotificationService.notifyUserFollow(userId, contentId);
                        }
                        else {
                            yield notification_service_1.NotificationService.notifyContentLike(userId, contentId, contentType);
                        }
                        // Send public activity notification to followers
                        const contentData = yield this.getContentById(contentId, contentType);
                        yield notification_service_1.NotificationService.notifyPublicActivity(userId, "like", contentId, contentType, contentData === null || contentData === void 0 ? void 0 : contentData.title);
                        // Check for viral milestones
                        yield viralContent_service_1.default.checkViralMilestones(contentId, contentType);
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
                // Send real-time notification via Socket.IO
                try {
                    const io = require("../socket/socketManager").getIO();
                    if (io) {
                        const payload = {
                            contentId,
                            contentType,
                            likeCount,
                            userLiked: liked,
                            userId,
                            timestamp: new Date().toISOString(),
                        };
                        // Global event (backward compatible)
                        io.emit("content-like-update", payload);
                        // Room-scoped event for fine-grained subscriptions (spec format: content:contentType:contentId)
                        const roomKey = contentType ? `content:${contentType}:${contentId}` : `content:${contentId}`;
                        io.to(roomKey).emit("like-updated", payload);
                    }
                }
                catch (socketError) {
                    logger_1.default.warn("Failed to send real-time like update", {
                        error: socketError,
                        contentId,
                        contentType,
                    });
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
                    contentId,
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
     * Share content
     */
    shareContent(userId, contentId, contentType, sharePlatform) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const session = yield media_model_1.Media.startSession();
                try {
                    let shared = false;
                    let shareCount = 0;
                    yield session.withTransaction(() => __awaiter(this, void 0, void 0, function* () {
                        // Verify content exists
                        const contentExists = yield this.verifyContentExists(contentId, contentType, session);
                        if (!contentExists) {
                            throw new Error(`Content not found: ${contentType} with ID ${contentId}`);
                        }
                        // Increment share count
                        if (contentType === "media") {
                            yield media_model_1.Media.findByIdAndUpdate(contentId, { $inc: { shareCount: 1 } }, { session });
                        }
                        else if (contentType === "devotional") {
                            yield devotional_model_1.Devotional.findByIdAndUpdate(contentId, { $inc: { shareCount: 1 } }, { session });
                        }
                        shared = true;
                    }));
                    // Get updated share count
                    shareCount = yield this.getShareCount(contentId, contentType);
                    // Send notifications
                    if (shared) {
                        try {
                            yield notification_service_1.NotificationService.notifyContentShare(userId, contentId, contentType, sharePlatform);
                            // Send public activity notification to followers
                            const content = yield this.getContentById(contentId, contentType);
                            yield notification_service_1.NotificationService.notifyPublicActivity(userId, "share", contentId, contentType, content === null || content === void 0 ? void 0 : content.title);
                            // Check for viral milestones
                            yield viralContent_service_1.default.checkViralMilestones(contentId, contentType);
                            logger_1.default.info("Share notification sent", {
                                userId,
                                contentId,
                                contentType,
                                sharePlatform,
                            });
                        }
                        catch (notificationError) {
                            logger_1.default.error("Failed to send share notification", {
                                error: notificationError.message,
                                userId,
                                contentId,
                                contentType,
                            });
                        }
                    }
                    return { shared, shareCount };
                }
                finally {
                    session.endSession();
                }
            }
            catch (error) {
                logger_1.default.error("Share content failed", {
                    error: error.message,
                    userId,
                    contentId,
                    contentType,
                });
                throw error;
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
                const { text: sanitizedText } = this.sanitizeCommentContent(content);
                const comment = yield session.withTransaction(() => __awaiter(this, void 0, void 0, function* () {
                    const commentData = {
                        user: new mongoose_1.Types.ObjectId(userId),
                        media: new mongoose_1.Types.ObjectId(contentId),
                        interactionType: "comment",
                        content: sanitizedText,
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
                    else if (contentType === "devotional") {
                        yield devotional_model_1.Devotional.findByIdAndUpdate(contentId, { $inc: { commentCount: 1 } }, { session });
                    }
                    // If this is a reply, increment parent's replyCount
                    if (commentData.parentCommentId) {
                        yield mediaInteraction_model_1.MediaInteraction.findByIdAndUpdate(commentData.parentCommentId, { $inc: { replyCount: 1 } }, { session });
                    }
                    return comment[0];
                }));
                // Send notification if comment was added
                try {
                    yield notification_service_1.NotificationService.notifyContentComment(userId, contentId, contentType, content);
                    // If this is a reply to an existing comment, notify the original commenter
                    if (parentCommentId && mongoose_1.Types.ObjectId.isValid(parentCommentId)) {
                        try {
                            const parentComment = yield mediaInteraction_model_1.MediaInteraction.findById(parentCommentId).select("user");
                            if (parentComment && parentComment.user.toString() !== userId) {
                                const replier = yield user_model_1.User.findById(userId).select("firstName lastName email");
                                const replierName = ((replier === null || replier === void 0 ? void 0 : replier.firstName) || "").toString() ||
                                    (replier === null || replier === void 0 ? void 0 : replier.email) ||
                                    "Someone";
                                yield notification_service_1.NotificationService.createNotification({
                                    userId: parentComment.user.toString(),
                                    type: "reply",
                                    title: "New Reply",
                                    message: `${replierName} replied to your comment`,
                                    metadata: {
                                        contentId,
                                        contentType,
                                        parentCommentId,
                                        replyPreview: content.substring(0, 100),
                                    },
                                    priority: "medium",
                                });
                            }
                        }
                        catch (replyNotifyError) {
                            logger_1.default.warn("Failed to send reply notification", {
                                error: replyNotifyError === null || replyNotifyError === void 0 ? void 0 : replyNotifyError.message,
                                userId,
                                contentId,
                                parentCommentId,
                            });
                        }
                    }
                    // Send public activity notification to followers
                    const contentData = yield this.getContentById(contentId, contentType);
                    yield notification_service_1.NotificationService.notifyPublicActivity(userId, "comment", contentId, contentType, contentData === null || contentData === void 0 ? void 0 : contentData.title);
                    // Detect and notify mentions
                    yield mentionDetection_service_1.default.detectAndNotifyMentions(userId, contentId, contentType, content);
                    // Check for viral milestones
                    yield viralContent_service_1.default.checkViralMilestones(contentId, contentType);
                    logger_1.default.info("Comment notification sent", {
                        userId,
                        contentId,
                        contentType,
                    });
                }
                catch (notificationError) {
                    // Don't fail the comment operation if notification fails
                    logger_1.default.error("Failed to send comment notification", {
                        error: notificationError.message,
                        userId,
                        contentId,
                        contentType,
                    });
                }
                // Populate user info for response
                const populatedComment = yield mediaInteraction_model_1.MediaInteraction.findById(comment._id)
                    .populate("user", "firstName lastName avatar")
                    .populate("parentCommentId", "content user")
                    .lean();
                // Format comment for frontend compatibility
                const formattedComment = this.formatCommentWithReplies(populatedComment, false);
                formattedComment.replies = []; // New comments don't have replies yet
                // Emit real-time new comment
                try {
                    const io = require("../socket/socketManager").getIO();
                    if (io) {
                        const roomKey = `content:${contentType}:${contentId}`;
                        const payload = {
                            contentId,
                            contentType,
                            commentId: formattedComment.id || formattedComment._id,
                            action: "created",
                        };
                        // Emit to the specific content room (per spec: content:contentType:contentId)
                        io.to(roomKey).emit("content:comment", payload);
                        // Also emit the full comment for immediate UI updates
                        io.to(roomKey).emit("new-comment", formattedComment);
                    }
                }
                catch (_a) { }
                return formattedComment;
            }
            finally {
                session.endSession();
            }
        });
    }
    /**
     * Get comments for content
     */
    /**
     * Helper function to format comment with nested replies and frontend-compatible fields
     */
    formatCommentWithReplies(comment, includeReplies = true) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        // Calculate reactions count
        const reactionsCount = comment.reactions
            ? Object.values(comment.reactions).reduce((sum, arr) => sum + arr.length, 0)
            : 0;
        const formatted = {
            _id: comment._id,
            id: comment._id.toString(), // Alias for frontend compatibility
            content: comment.content,
            authorId: ((_b = (_a = comment.user) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString()) || ((_c = comment.user) === null || _c === void 0 ? void 0 : _c.toString()),
            userId: ((_e = (_d = comment.user) === null || _d === void 0 ? void 0 : _d._id) === null || _e === void 0 ? void 0 : _e.toString()) || ((_f = comment.user) === null || _f === void 0 ? void 0 : _f.toString()), // Alias
            // Provide both 'user' and 'author' for frontend compatibility
            user: comment.user
                ? {
                    _id: comment.user._id || comment.user,
                    id: (comment.user._id || comment.user).toString(),
                    firstName: comment.user.firstName || "",
                    lastName: comment.user.lastName || "",
                    username: comment.user.username || ((_h = (_g = comment.user.firstName) === null || _g === void 0 ? void 0 : _g.toLowerCase()) === null || _h === void 0 ? void 0 : _h.replace(/\s+/g, "_")) || null,
                    avatar: comment.user.avatar || null,
                }
                : null,
            author: comment.user
                ? {
                    _id: comment.user._id || comment.user,
                    firstName: comment.user.firstName || "",
                    lastName: comment.user.lastName || "",
                    avatar: comment.user.avatar || null,
                }
                : null,
            createdAt: comment.createdAt,
            timestamp: comment.createdAt, // Alias
            reactionsCount,
            likes: reactionsCount, // Alias for frontend
            likesCount: reactionsCount, // Spec-compliant field name
            replyCount: comment.replyCount || 0,
            replies: [], // Will be populated if includeReplies is true
        };
        // Add nested replies if requested (limit to first 50 replies per comment)
        if (includeReplies && comment._id) {
            // This will be populated by the calling function
        }
        return formatted;
    }
    /**
     * Helper function to fetch and format replies for a comment
     */
    fetchCommentReplies(commentId_1) {
        return __awaiter(this, arguments, void 0, function* (commentId, limit = 50) {
            const replies = yield mediaInteraction_model_1.MediaInteraction.find({
                parentCommentId: commentId,
                interactionType: "comment",
                isRemoved: { $ne: true },
                isHidden: { $ne: true },
            })
                .populate("user", "firstName lastName avatar")
                .sort("createdAt")
                .limit(limit)
                .lean();
            return replies.map((reply) => this.formatCommentWithReplies(reply, false));
        });
    }
    getContentComments(contentId_1, contentType_1) {
        return __awaiter(this, arguments, void 0, function* (contentId, contentType, page = 1, limit = 20, sortBy = "newest") {
            if (!mongoose_1.Types.ObjectId.isValid(contentId)) {
                throw new Error("Invalid content ID");
            }
            if (!["media", "devotional"].includes(contentType)) {
                throw new Error("Comments not supported for this content type");
            }
            const skip = (page - 1) * limit;
            // For now, we'll use MediaInteraction for both media and devotional
            // TODO: Create a more generic ContentInteraction model in the future
            // Return top-level comments with nested replies array
            if (sortBy === "top") {
                // Aggregate to compute a rough score: replyCount + total reactions
                const pipeline = [
                    {
                        $match: {
                            media: new mongoose_1.Types.ObjectId(contentId),
                            interactionType: "comment",
                            isRemoved: { $ne: true },
                            isHidden: { $ne: true },
                            parentCommentId: { $exists: false },
                        },
                    },
                    {
                        $addFields: {
                            reactionsArray: { $objectToArray: "$reactions" },
                        },
                    },
                    {
                        $addFields: {
                            reactionTotal: {
                                $sum: {
                                    $map: {
                                        input: "$reactionsArray",
                                        as: "r",
                                        in: { $size: "$$r.v" },
                                    },
                                },
                            },
                        },
                    },
                    {
                        $addFields: {
                            score: { $add: ["$replyCount", "$reactionTotal"] },
                        },
                    },
                    { $sort: { score: -1, createdAt: -1 } },
                    { $skip: skip },
                    { $limit: limit },
                ];
                const comments = yield mediaInteraction_model_1.MediaInteraction.aggregate(pipeline);
                // Populate user after aggregation
                const ids = comments.map((c) => c._id);
                const withUsers = yield mediaInteraction_model_1.MediaInteraction.find({ _id: { $in: ids } })
                    .populate("user", "firstName lastName avatar")
                    .lean();
                const map = new Map(withUsers.map((c) => [c._id.toString(), c]));
                const ordered = comments.map((c) => (Object.assign(Object.assign({}, map.get(c._id.toString())), { score: c.score })));
                // Fetch nested replies for each comment
                const commentsWithReplies = yield Promise.all(ordered.map((comment) => __awaiter(this, void 0, void 0, function* () {
                    const formatted = this.formatCommentWithReplies(comment, true);
                    const replies = yield this.fetchCommentReplies(comment._id);
                    formatted.replies = replies;
                    return formatted;
                })));
                const total = yield mediaInteraction_model_1.MediaInteraction.countDocuments({
                    media: new mongoose_1.Types.ObjectId(contentId),
                    interactionType: "comment",
                    isRemoved: { $ne: true },
                    isHidden: { $ne: true },
                    parentCommentId: { $exists: false },
                });
                const hasMore = (page * limit) < total;
                return {
                    comments: commentsWithReplies,
                    totalComments: total,
                    hasMore,
                    pagination: {
                        page,
                        limit,
                        total,
                        pages: Math.ceil(total / limit),
                    },
                };
            }
            const sortStageStr = sortBy === "oldest" ? "createdAt" : "-createdAt";
            const comments = yield mediaInteraction_model_1.MediaInteraction.find({
                media: new mongoose_1.Types.ObjectId(contentId),
                interactionType: "comment",
                isRemoved: { $ne: true },
                isHidden: { $ne: true },
                parentCommentId: { $exists: false },
            })
                .populate("user", "firstName lastName avatar")
                .sort(sortStageStr)
                .skip(skip)
                .limit(limit)
                .lean();
            // Fetch nested replies for each comment
            const commentsWithReplies = yield Promise.all(comments.map((comment) => __awaiter(this, void 0, void 0, function* () {
                const formatted = this.formatCommentWithReplies(comment, true);
                const replies = yield this.fetchCommentReplies(comment._id);
                formatted.replies = replies;
                return formatted;
            })));
            const total = yield mediaInteraction_model_1.MediaInteraction.countDocuments({
                media: new mongoose_1.Types.ObjectId(contentId),
                interactionType: "comment",
                isRemoved: { $ne: true },
                isHidden: { $ne: true },
                parentCommentId: { $exists: false },
            });
            const hasMore = (page * limit) < total;
            return {
                comments: commentsWithReplies,
                totalComments: total,
                hasMore,
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
     * Toggle reaction (like) on a comment
     */
    toggleCommentReaction(commentId_1, userId_1) {
        return __awaiter(this, arguments, void 0, function* (commentId, userId, reactionType = "like") {
            if (!mongoose_1.Types.ObjectId.isValid(commentId) || !mongoose_1.Types.ObjectId.isValid(userId)) {
                throw new Error("Invalid comment or user ID");
            }
            const comment = yield mediaInteraction_model_1.MediaInteraction.findOne({
                _id: new mongoose_1.Types.ObjectId(commentId),
                interactionType: "comment",
                isRemoved: { $ne: true },
            });
            if (!comment) {
                throw new Error("Comment not found");
            }
            // Handle reactions - Mongoose Maps can be Map or plain object when loaded
            let reactions = comment.reactions;
            // Convert to Map if it's a plain object
            if (!(reactions instanceof Map)) {
                reactions = new Map(Object.entries(reactions || {}));
            }
            // Get reaction array for the specified type
            const reactionArray = reactions.get(reactionType) || [];
            const userIdObj = new mongoose_1.Types.ObjectId(userId);
            const userIdStr = userIdObj.toString();
            // Check if user already reacted
            const hasReacted = reactionArray.some((id) => (id.toString ? id.toString() : String(id)) === userIdStr);
            let liked;
            if (hasReacted) {
                // Remove reaction (unlike)
                const filtered = reactionArray.filter((id) => (id.toString ? id.toString() : String(id)) !== userIdStr);
                reactions.set(reactionType, filtered);
                liked = false;
            }
            else {
                // Add reaction (like)
                reactionArray.push(userIdObj);
                reactions.set(reactionType, reactionArray);
                liked = true;
            }
            // Update comment with new reactions
            comment.reactions = reactions;
            yield comment.save();
            // Calculate total likes (sum of all reaction types, or just "like" if it exists)
            const likeReactions = reactions.get("like") || [];
            const reactionTotal = reactions.get(reactionType) || [];
            const totalLikes = reactionType === "like"
                ? likeReactions.length
                : (reactions.get("like") || []).length;
            logger_1.default.info("Comment reaction toggled", {
                commentId,
                userId,
                reactionType,
                liked,
                totalLikes,
            });
            return { liked, totalLikes };
        });
    }
    /**
     * Get replies for a specific comment
     */
    getCommentReplies(commentId_1) {
        return __awaiter(this, arguments, void 0, function* (commentId, page = 1, limit = 20) {
            if (!mongoose_1.Types.ObjectId.isValid(commentId)) {
                throw new Error("Invalid comment ID");
            }
            const skip = (page - 1) * limit;
            const replies = yield mediaInteraction_model_1.MediaInteraction.find({
                parentCommentId: new mongoose_1.Types.ObjectId(commentId),
                interactionType: "comment",
                isRemoved: { $ne: true },
                isHidden: { $ne: true },
            })
                .populate("user", "firstName lastName avatar")
                .sort("createdAt")
                .skip(skip)
                .limit(limit)
                .lean();
            const total = yield mediaInteraction_model_1.MediaInteraction.countDocuments({
                parentCommentId: new mongoose_1.Types.ObjectId(commentId),
                interactionType: "comment",
                isRemoved: { $ne: true },
                isHidden: { $ne: true },
            });
            return {
                replies,
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
     * Edit a comment (owner only)
     */
    editContentComment(commentId, userId, newContent) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!mongoose_1.Types.ObjectId.isValid(commentId) || !mongoose_1.Types.ObjectId.isValid(userId)) {
                throw new Error("Invalid comment or user ID");
            }
            if (!newContent || newContent.trim().length === 0) {
                throw new Error("Comment content is required");
            }
            const comment = yield mediaInteraction_model_1.MediaInteraction.findOne({
                _id: new mongoose_1.Types.ObjectId(commentId),
                user: new mongoose_1.Types.ObjectId(userId),
                interactionType: "comment",
                isRemoved: { $ne: true },
            });
            if (!comment) {
                throw new Error("Comment not found or you don't have permission to edit it");
            }
            const { text: sanitized } = this.sanitizeCommentContent(newContent);
            yield mediaInteraction_model_1.MediaInteraction.findByIdAndUpdate(commentId, {
                content: sanitized,
            });
            const updatedDoc = yield mediaInteraction_model_1.MediaInteraction.findById(commentId).populate("user", "firstName lastName avatar");
            const updated = (updatedDoc === null || updatedDoc === void 0 ? void 0 : updatedDoc.toObject)
                ? updatedDoc.toObject()
                : updatedDoc;
            // Emit real-time edit
            try {
                const io = require("../socket/socketManager").getIO();
                if (io) {
                    io.emit("comment-edited", {
                        commentId,
                        content: sanitized,
                    });
                }
            }
            catch (_a) { }
            return updated;
        });
    }
    /**
     * Report a comment
     */
    reportContentComment(commentId, userId, reason) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!mongoose_1.Types.ObjectId.isValid(commentId) || !mongoose_1.Types.ObjectId.isValid(userId)) {
                throw new Error("Invalid comment or user ID");
            }
            const update = yield mediaInteraction_model_1.MediaInteraction.findByIdAndUpdate(commentId, {
                $inc: { reportCount: 1 },
                $addToSet: { reportedBy: new mongoose_1.Types.ObjectId(userId) },
            }, { new: true }).select("reportCount");
            if (!update) {
                throw new Error("Comment not found");
            }
            return { reportCount: update.reportCount || 0 };
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
                interactionType: "comment",
                isRemoved: { $ne: true },
            }).select("user media parentCommentId");
            if (!comment) {
                throw new Error("Comment not found or you don't have permission to delete it");
            }
            // Permission: owner can delete; moderators/admins can hide
            const isOwner = comment.user.toString() === userId;
            if (!isOwner) {
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
            // If it was a reply, decrement parent's replyCount
            if (comment.parentCommentId) {
                yield mediaInteraction_model_1.MediaInteraction.findByIdAndUpdate(comment.parentCommentId, {
                    $inc: { replyCount: -1 },
                });
            }
            // Emit real-time removal and reply count update
            try {
                const io = require("../socket/socketManager").getIO();
                if (io) {
                    io.emit("comment-removed", { commentId });
                    if (comment.parentCommentId) {
                        io.emit("reply-count-updated", {
                            commentId: comment.parentCommentId.toString(),
                            delta: -1,
                        });
                    }
                }
            }
            catch (_a) { }
        });
    }
    /**
     * Moderator hide comment (does not affect counts)
     */
    moderateHideComment(commentId, moderatorId, reason) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!mongoose_1.Types.ObjectId.isValid(commentId) ||
                !mongoose_1.Types.ObjectId.isValid(moderatorId)) {
                throw new Error("Invalid comment or user ID");
            }
            const updated = yield mediaInteraction_model_1.MediaInteraction.findByIdAndUpdate(commentId, {
                isHidden: true,
                hiddenBy: new mongoose_1.Types.ObjectId(moderatorId),
                hiddenReason: reason === null || reason === void 0 ? void 0 : reason.toString().slice(0, 500),
            }, { new: true }).select("_id");
            if (!updated) {
                throw new Error("Comment not found");
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
                case "ebook":
                case "podcast":
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
            // Validate userId format before querying
            if (!mongoose_1.Types.ObjectId.isValid(userId)) {
                logger_1.default.warn("Invalid userId format in getUserInteraction", {
                    userId,
                    contentId,
                    contentType,
                });
                return {
                    hasLiked: false,
                    hasCommented: false,
                    hasShared: false,
                    hasFavorited: false,
                    hasBookmarked: false,
                };
            }
            try {
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
            }
            catch (error) {
                logger_1.default.error("Error in getUserInteraction", {
                    error: error.message,
                    userId,
                    contentId,
                    contentType,
                });
                // Return false for all on error to prevent UI issues
                return {
                    hasLiked: false,
                    hasCommented: false,
                    hasShared: false,
                    hasFavorited: false,
                    hasBookmarked: false,
                };
            }
        });
    }
    /**
     * Check if user has liked content
     */
    checkUserLike(userId, contentId, contentType) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!userId || !mongoose_1.Types.ObjectId.isValid(userId) || !mongoose_1.Types.ObjectId.isValid(contentId)) {
                return false;
            }
            switch (contentType) {
                case "media":
                case "ebook":
                case "podcast":
                    const mediaLike = yield mediaInteraction_model_1.MediaInteraction.findOne({
                        user: new mongoose_1.Types.ObjectId(userId),
                        media: new mongoose_1.Types.ObjectId(contentId),
                        interactionType: "like",
                        isRemoved: { $ne: true },
                    });
                    return !!mediaLike;
                case "devotional":
                    const devotionalLike = yield devotionalLike_model_1.DevotionalLike.findOne({
                        user: new mongoose_1.Types.ObjectId(userId),
                        devotional: new mongoose_1.Types.ObjectId(contentId),
                    });
                    return !!devotionalLike;
                case "artist":
                    const artist = yield user_model_1.User.findById(new mongoose_1.Types.ObjectId(userId));
                    return ((_a = artist === null || artist === void 0 ? void 0 : artist.following) === null || _a === void 0 ? void 0 : _a.some((id) => id.toString() === contentId)) || false;
                case "merch":
                    // Merch uses "favorite" interactionType, not "like"
                    const merchFavorite = yield mediaInteraction_model_1.MediaInteraction.findOne({
                        user: new mongoose_1.Types.ObjectId(userId),
                        media: new mongoose_1.Types.ObjectId(contentId),
                        interactionType: "favorite",
                        isRemoved: { $ne: true },
                    });
                    return !!merchFavorite;
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
            if (!userId || !mongoose_1.Types.ObjectId.isValid(userId) || !mongoose_1.Types.ObjectId.isValid(contentId)) {
                return false;
            }
            const comment = yield mediaInteraction_model_1.MediaInteraction.findOne({
                user: new mongoose_1.Types.ObjectId(userId),
                media: new mongoose_1.Types.ObjectId(contentId),
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
            if (!userId || !mongoose_1.Types.ObjectId.isValid(userId) || !mongoose_1.Types.ObjectId.isValid(contentId)) {
                return false;
            }
            const share = yield mediaInteraction_model_1.MediaInteraction.findOne({
                user: new mongoose_1.Types.ObjectId(userId),
                media: new mongoose_1.Types.ObjectId(contentId),
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
            if (!userId || !mongoose_1.Types.ObjectId.isValid(userId) || !mongoose_1.Types.ObjectId.isValid(contentId)) {
                return false;
            }
            const favorite = yield mediaInteraction_model_1.MediaInteraction.findOne({
                user: new mongoose_1.Types.ObjectId(userId),
                media: new mongoose_1.Types.ObjectId(contentId),
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
            try {
                if (!userId ||
                    !mongoose_1.Types.ObjectId.isValid(userId) ||
                    !mongoose_1.Types.ObjectId.isValid(contentId)) {
                    return false;
                }
                // Only media-like entities currently support bookmarks
                if (!["media", "ebook", "podcast", "merch"].includes(contentType)) {
                    return false;
                }
                const exists = yield bookmark_model_1.Bookmark.findOne({
                    user: new mongoose_1.Types.ObjectId(userId),
                    media: new mongoose_1.Types.ObjectId(contentId),
                })
                    .select("_id")
                    .lean();
                return !!exists;
            }
            catch (error) {
                logger_1.default.error("Failed to check user bookmark", {
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
     * Get bookmark count for media-like content
     */
    getBookmarkCount(contentId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const total = yield bookmark_model_1.Bookmark.countDocuments({
                    media: new mongoose_1.Types.ObjectId(contentId),
                });
                return total || 0;
            }
            catch (error) {
                logger_1.default.error("Failed to get bookmark count", {
                    contentId,
                    error: error.message,
                });
                return 0;
            }
        });
    }
    /**
     * Batch content metadata for multiple content IDs
     * Returns per-id counts and user interaction flags
     */
    getBatchContentMetadata(userId_1, contentIds_1) {
        return __awaiter(this, arguments, void 0, function* (userId, contentIds, contentType = "media") {
            const validIds = contentIds.filter(id => mongoose_1.Types.ObjectId.isValid(id));
            if (validIds.length === 0)
                return [];
            const tasks = validIds.map((id) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c, _d;
                try {
                    const stats = yield this.getContentStats(id, contentType);
                    // Map stats from existing structure to requested names
                    const likeCount = (_a = stats === null || stats === void 0 ? void 0 : stats.likes) !== null && _a !== void 0 ? _a : 0;
                    const commentCount = (_b = stats === null || stats === void 0 ? void 0 : stats.comments) !== null && _b !== void 0 ? _b : 0;
                    const shareCount = (_c = stats === null || stats === void 0 ? void 0 : stats.shares) !== null && _c !== void 0 ? _c : 0;
                    const viewCount = (_d = stats === null || stats === void 0 ? void 0 : stats.views) !== null && _d !== void 0 ? _d : 0;
                    // Bookmark count (for media-like)
                    const bookmarkCount = yield this.getBookmarkCount(id);
                    // User interaction flags - ensure userId is valid ObjectId
                    let validUserId = userId || "";
                    if (validUserId && !mongoose_1.Types.ObjectId.isValid(validUserId)) {
                        logger_1.default.warn("Invalid userId format in batch metadata", {
                            userId: validUserId,
                            contentId: id,
                            contentType,
                        });
                        validUserId = "";
                    }
                    const userFlags = yield this.getUserInteraction(validUserId, id, contentType);
                    // hasViewed: infer from MediaInteraction 'view' events if present
                    let hasViewed = false;
                    if (validUserId && mongoose_1.Types.ObjectId.isValid(validUserId)) {
                        try {
                            const view = yield mediaInteraction_model_1.MediaInteraction.findOne({
                                user: new mongoose_1.Types.ObjectId(validUserId),
                                media: new mongoose_1.Types.ObjectId(id),
                                interactionType: "view",
                                isRemoved: { $ne: true },
                            })
                                .select("_id")
                                .lean();
                            hasViewed = !!view;
                        }
                        catch (error) {
                            logger_1.default.warn("Error checking hasViewed in batch metadata", {
                                error: error.message,
                                userId: validUserId,
                                contentId: id,
                            });
                        }
                    }
                    return {
                        id,
                        likeCount,
                        commentCount,
                        shareCount,
                        bookmarkCount,
                        viewCount,
                        hasLiked: !!(userFlags === null || userFlags === void 0 ? void 0 : userFlags.hasLiked),
                        hasBookmarked: !!(userFlags === null || userFlags === void 0 ? void 0 : userFlags.hasBookmarked),
                        hasShared: !!(userFlags === null || userFlags === void 0 ? void 0 : userFlags.hasShared),
                        hasViewed,
                    };
                }
                catch (error) {
                    logger_1.default.warn("Batch metadata item failed", {
                        id,
                        contentType,
                        error: error.message,
                    });
                    return {
                        id,
                        likeCount: 0,
                        commentCount: 0,
                        shareCount: 0,
                        bookmarkCount: 0,
                        viewCount: 0,
                        hasLiked: false,
                        hasBookmarked: false,
                        hasShared: false,
                        hasViewed: false,
                    };
                }
            }));
            return yield Promise.all(tasks);
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
                // Like - check if there's a soft-deleted like to restore
                const softDeletedLike = yield mediaInteraction_model_1.MediaInteraction.findOne({
                    user: new mongoose_1.Types.ObjectId(userId),
                    media: new mongoose_1.Types.ObjectId(contentId),
                    interactionType: "like",
                    isRemoved: true,
                }).session(session);
                if (softDeletedLike) {
                    // Restore soft-deleted like
                    yield mediaInteraction_model_1.MediaInteraction.findByIdAndUpdate(softDeletedLike._id, {
                        isRemoved: false,
                        lastInteraction: new Date(),
                    }, { session });
                }
                else {
                    // Create new like
                    yield mediaInteraction_model_1.MediaInteraction.create([
                        {
                            user: new mongoose_1.Types.ObjectId(userId),
                            media: new mongoose_1.Types.ObjectId(contentId),
                            interactionType: "like",
                            lastInteraction: new Date(),
                            count: 1,
                            isRemoved: false,
                        },
                    ], { session });
                }
                // Increment like count atomically
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
                // Decrement favoriteCount atomically
                yield media_model_1.Media.findByIdAndUpdate(contentId, { $inc: { favoriteCount: -1 } }, { session });
                return false;
            }
            else {
                // Check if there's a soft-deleted favorite to restore
                const softDeletedFavorite = yield mediaInteraction_model_1.MediaInteraction.findOne({
                    user: new mongoose_1.Types.ObjectId(userId),
                    media: new mongoose_1.Types.ObjectId(contentId),
                    interactionType: "favorite",
                    isRemoved: true,
                }).session(session);
                if (softDeletedFavorite) {
                    // Restore soft-deleted favorite
                    yield mediaInteraction_model_1.MediaInteraction.findByIdAndUpdate(softDeletedFavorite._id, {
                        isRemoved: false,
                        lastInteraction: new Date(),
                    }, { session });
                }
                else {
                    // Create new favorite
                    yield mediaInteraction_model_1.MediaInteraction.create([
                        {
                            user: new mongoose_1.Types.ObjectId(userId),
                            media: new mongoose_1.Types.ObjectId(contentId),
                            interactionType: "favorite",
                            lastInteraction: new Date(),
                            count: 1,
                            isRemoved: false,
                        },
                    ], { session });
                }
                // Increment favoriteCount atomically
                yield media_model_1.Media.findByIdAndUpdate(contentId, { $inc: { favoriteCount: 1 } }, { session });
                return true;
            }
        });
    }
    /**
     * Get share count for content
     */
    getShareCount(contentId, contentType) {
        return __awaiter(this, void 0, void 0, function* () {
            if (contentType === "media") {
                const media = yield media_model_1.Media.findById(contentId);
                return (media === null || media === void 0 ? void 0 : media.shareCount) || 0;
            }
            else if (contentType === "devotional") {
                const devotional = yield devotional_model_1.Devotional.findById(contentId);
                return (devotional === null || devotional === void 0 ? void 0 : devotional.shareCount) || 0;
            }
            return 0;
        });
    }
    /**
     * Get content by ID
     */
    getContentById(contentId, contentType) {
        return __awaiter(this, void 0, void 0, function* () {
            if (contentType === "media") {
                return yield media_model_1.Media.findById(contentId);
            }
            else if (contentType === "devotional") {
                return yield devotional_model_1.Devotional.findById(contentId);
            }
            return null;
        });
    }
}
exports.ContentInteractionService = ContentInteractionService;
exports.default = new ContentInteractionService();
