"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.shareContent = exports.hideContentComment = exports.reportContentComment = exports.editContentComment = exports.getCommentReplies = exports.getContentComments = exports.removeContentComment = exports.getBatchContentMetadata = exports.recordContentView = exports.getContentMetadata = exports.addContentComment = exports.toggleContentLike = void 0;
const mongoose_1 = require("mongoose");
const contentInteraction_service_1 = __importDefault(require("../service/contentInteraction.service"));
const logger_1 = __importDefault(require("../utils/logger"));
const bookmark_model_1 = require("../models/bookmark.model");
const mediaInteraction_model_1 = require("../models/mediaInteraction.model");
const enqueue_1 = require("../queues/enqueue");
// Toggle like on any content type
const toggleContentLike = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { contentId, contentType } = req.params;
        const userId = req.userId;
        // Enhanced logging for debugging
        logger_1.default.info("Toggle content like request", {
            userId,
            contentId,
            contentType,
            userAgent: req.get("User-Agent"),
            ip: req.ip,
            timestamp: new Date().toISOString(),
        });
        if (!userId) {
            logger_1.default.warn("Unauthorized like request - no user ID", {
                contentId,
                contentType,
                ip: req.ip,
            });
            res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!contentId || !mongoose_1.Types.ObjectId.isValid(contentId)) {
            logger_1.default.warn("Invalid content ID in like request", {
                userId,
                contentId,
                contentType,
                ip: req.ip,
            });
            res.status(400).json({
                success: false,
                message: "Invalid content ID format",
            });
            return;
        }
        const validContentTypes = [
            "media",
            "devotional",
            "artist",
            "merch",
            "ebook",
            "podcast",
        ];
        if (!contentType || !validContentTypes.includes(contentType)) {
            logger_1.default.warn("Invalid content type in like request", {
                userId,
                contentId,
                contentType,
                validTypes: validContentTypes,
                ip: req.ip,
            });
            res.status(400).json({
                success: false,
                message: `Invalid content type. Must be one of: ${validContentTypes.join(", ")}`,
            });
            return;
        }
        const result = yield contentInteraction_service_1.default.toggleLike(userId, contentId, contentType);
        (0, enqueue_1.enqueueAnalyticsEvent)({
            name: "content_like_toggled",
            payload: {
                userId,
                contentId,
                contentType,
                liked: result.liked,
                likeCount: result.likeCount,
                createdAt: new Date().toISOString(),
            },
            requestId: req.requestId,
        });
        logger_1.default.info("Toggle content like successful", {
            userId,
            contentId,
            contentType,
            liked: result.liked,
            likeCount: result.likeCount,
        });
        res.status(200).json({
            success: true,
            message: result.liked
                ? "Content liked successfully"
                : "Content unliked successfully",
            data: result,
        });
    }
    catch (error) {
        logger_1.default.error("Toggle content like error", {
            error: error.message,
            stack: error.stack,
            userId: req.userId,
            contentId: req.params.contentId,
            contentType: req.params.contentType,
            ip: req.ip,
            timestamp: new Date().toISOString(),
        });
        // Handle specific error types with appropriate status codes
        if (error.message.includes("not found") ||
            error.message.includes("Content not found")) {
            res.status(404).json({
                success: false,
                message: "Content not found",
            });
            return;
        }
        if (error.message.includes("Invalid") ||
            error.message.includes("Unsupported")) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
            return;
        }
        // Default to 500 for unexpected errors
        res.status(500).json({
            success: false,
            message: "An unexpected error occurred while processing your request",
        });
    }
});
exports.toggleContentLike = toggleContentLike;
// Add comment to content
const addContentComment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { contentId, contentType } = req.params;
        const { content, parentCommentId } = req.body;
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!contentId || !mongoose_1.Types.ObjectId.isValid(contentId)) {
            res.status(400).json({
                success: false,
                message: "Invalid content ID",
            });
            return;
        }
        if (!contentType || !["media", "devotional"].includes(contentType)) {
            res.status(400).json({
                success: false,
                message: "Comments not supported for this content type",
            });
            return;
        }
        if (!content || content.trim().length === 0) {
            res.status(400).json({
                success: false,
                message: "Comment content is required",
            });
            return;
        }
        const comment = yield contentInteraction_service_1.default.addComment(userId, contentId, contentType, content, parentCommentId);
        (0, enqueue_1.enqueueAnalyticsEvent)({
            name: "content_commented",
            payload: {
                userId,
                contentId,
                contentType,
                parentCommentId: parentCommentId || null,
                commentId: comment === null || comment === void 0 ? void 0 : comment._id,
                createdAt: new Date().toISOString(),
            },
            requestId: req.requestId,
        });
        res.status(201).json({
            success: true,
            message: "Comment added successfully",
            data: comment,
        });
    }
    catch (error) {
        logger_1.default.error("Add content comment error", {
            error: error.message,
            userId: req.userId,
            contentId: req.params.contentId,
            contentType: req.params.contentType,
        });
        if (error.message.includes("not found")) {
            res.status(404).json({
                success: false,
                message: error.message,
            });
            return;
        }
        if (error.message.includes("not supported")) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: "Failed to add comment",
        });
    }
});
exports.addContentComment = addContentComment;
// Get content metadata for frontend UI
const getContentMetadata = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g;
    try {
        const { contentId, contentType } = req.params;
        const userId = req.userId; // Optional, for user-specific interactions
        if (!contentId || !mongoose_1.Types.ObjectId.isValid(contentId)) {
            res.status(400).json({
                success: false,
                message: "Invalid content ID",
            });
            return;
        }
        if (!contentType ||
            !["media", "devotional", "artist", "merch", "ebook", "podcast"].includes(contentType)) {
            res.status(400).json({
                success: false,
                message: "Invalid content type",
            });
            return;
        }
        // Ensure userId is valid before passing to service
        const validUserId = userId && mongoose_1.Types.ObjectId.isValid(userId) ? userId : "";
        const metadata = yield contentInteraction_service_1.default.getContentMetadata(validUserId, contentId, contentType);
        // Fetch bookmark count if content type supports it
        let bookmarkCount = 0;
        if (["media", "ebook", "podcast", "merch"].includes(contentType)) {
            try {
                bookmarkCount = yield bookmark_model_1.Bookmark.countDocuments({
                    media: new mongoose_1.Types.ObjectId(contentId),
                });
            }
            catch (error) {
                // Ignore bookmark count errors
            }
        }
        // Check hasViewed status if user is authenticated
        let hasViewed = false;
        if (validUserId && mongoose_1.Types.ObjectId.isValid(validUserId) && mongoose_1.Types.ObjectId.isValid(contentId)) {
            try {
                const view = yield mediaInteraction_model_1.MediaInteraction.findOne({
                    user: new mongoose_1.Types.ObjectId(validUserId),
                    media: new mongoose_1.Types.ObjectId(contentId),
                    interactionType: "view",
                    isRemoved: { $ne: true },
                })
                    .select("_id")
                    .lean();
                hasViewed = !!view;
            }
            catch (error) {
                logger_1.default.warn("Error checking hasViewed in metadata", {
                    error: error instanceof Error ? error.message : String(error),
                    userId: validUserId,
                    contentId,
                });
                // Ignore view check errors
            }
        }
        // Transform nested structure to flat structure matching frontend spec
        const flatMetadata = {
            id: metadata.id,
            likeCount: ((_a = metadata.stats) === null || _a === void 0 ? void 0 : _a.likes) || 0,
            bookmarkCount: bookmarkCount,
            shareCount: ((_b = metadata.stats) === null || _b === void 0 ? void 0 : _b.shares) || 0,
            viewCount: ((_c = metadata.stats) === null || _c === void 0 ? void 0 : _c.views) || 0,
            commentCount: ((_d = metadata.stats) === null || _d === void 0 ? void 0 : _d.comments) || 0,
            hasLiked: ((_e = metadata.userInteraction) === null || _e === void 0 ? void 0 : _e.hasLiked) || false,
            hasBookmarked: ((_f = metadata.userInteraction) === null || _f === void 0 ? void 0 : _f.hasBookmarked) || false,
            hasShared: ((_g = metadata.userInteraction) === null || _g === void 0 ? void 0 : _g.hasShared) || false,
            hasViewed: hasViewed,
        };
        res.status(200).json({
            success: true,
            data: flatMetadata,
        });
    }
    catch (error) {
        logger_1.default.error("Get content metadata error", {
            error: error.message,
            userId: req.userId,
            contentId: req.params.contentId,
            contentType: req.params.contentType,
        });
        if (error.message.includes("not found")) {
            res.status(404).json({
                success: false,
                message: error.message,
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: "Failed to get content metadata",
        });
    }
});
exports.getContentMetadata = getContentMetadata;
// Record a view/listen/read event with dedupe and thresholding
const recordContentView = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { contentId, contentType } = req.params;
        const { durationMs, progressPct, isComplete } = req.body || {};
        const userId = req.userId; // Required - authentication enforced by middleware
        // Authentication is required - middleware should handle this, but check anyway
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required for view tracking"
            });
            return;
        }
        if (!contentId || !mongoose_1.Types.ObjectId.isValid(contentId)) {
            res.status(400).json({ success: false, message: "Invalid content ID" });
            return;
        }
        const validTypes = [
            "media",
            "devotional",
            "artist",
            "merch",
            "ebook",
            "podcast",
        ];
        if (!contentType || !validTypes.includes(contentType)) {
            res.status(400).json({ success: false, message: "Invalid content type" });
            return;
        }
        // Delegate to service method
        const { default: contentService } = yield Promise.resolve().then(() => __importStar(require("../service/contentView.service")));
        const result = yield contentService.recordView({
            userId: userId,
            contentId,
            contentType: contentType,
            durationMs: typeof durationMs === "number" ? durationMs : undefined,
            progressPct: typeof progressPct === "number" ? progressPct : undefined,
            isComplete: !!isComplete,
            ip: req.ip,
            userAgent: req.get("User-Agent") || "",
        });
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        logger_1.default.error("Record content view error", {
            error: error.message,
            userId: req.userId,
            contentId: req.params.contentId,
            contentType: req.params.contentType,
        });
        // Handle specific error types
        if (error.message.includes("Authentication required")) {
            res.status(401).json({
                success: false,
                message: "Authentication required for view tracking"
            });
            return;
        }
        if (error.message.includes("not found") || error.message.includes("Content not found")) {
            res.status(404).json({
                success: false,
                message: "Content not found",
            });
            return;
        }
        res.status(500).json({ success: false, message: "Failed to record view" });
    }
});
exports.recordContentView = recordContentView;
// Batch metadata for multiple content IDs
const getBatchContentMetadata = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { contentIds, contentType } = req.body || {};
        if (!Array.isArray(contentIds) || contentIds.length === 0) {
            res.status(400).json({
                success: false,
                message: "contentIds must be a non-empty array",
            });
            return;
        }
        if (contentType &&
            !["media", "devotional", "artist", "merch", "ebook", "podcast"].includes(contentType)) {
            res.status(400).json({ success: false, message: "Invalid content type" });
            return;
        }
        const data = yield contentInteraction_service_1.default.getBatchContentMetadata(userId, contentIds, contentType || "media");
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        logger_1.default.error("Batch content metadata error", {
            error: error.message,
            userId: req.userId,
        });
        res
            .status(500)
            .json({ success: false, message: "Failed to get batch metadata" });
    }
});
exports.getBatchContentMetadata = getBatchContentMetadata;
// Remove comment
const removeContentComment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { commentId } = req.params;
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!commentId || !mongoose_1.Types.ObjectId.isValid(commentId)) {
            res.status(400).json({
                success: false,
                message: "Invalid comment ID",
            });
            return;
        }
        yield contentInteraction_service_1.default.removeContentComment(commentId, userId);
        res.status(200).json({
            success: true,
            message: "Comment removed successfully",
        });
    }
    catch (error) {
        logger_1.default.error("Remove content comment error", {
            error: error.message,
            userId: req.userId,
            commentId: req.params.commentId,
        });
        if (error.message.includes("not found") ||
            error.message.includes("permission")) {
            res.status(404).json({
                success: false,
                message: error.message,
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: "Failed to remove comment",
        });
    }
});
exports.removeContentComment = removeContentComment;
// Get comments for content
const getContentComments = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { contentId, contentType } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const sortBy = req.query.sortBy;
        if (!contentId || !mongoose_1.Types.ObjectId.isValid(contentId)) {
            res.status(400).json({
                success: false,
                message: "Invalid content ID",
            });
            return;
        }
        if (!contentType || !["media", "devotional"].includes(contentType)) {
            res.status(400).json({
                success: false,
                message: "Comments not supported for this content type",
            });
            return;
        }
        const result = yield contentInteraction_service_1.default.getContentComments(contentId, contentType, page, limit, sortBy === "oldest" || sortBy === "top" ? sortBy : "newest");
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        logger_1.default.error("Get content comments error", {
            error: error.message,
            contentId: req.params.contentId,
            contentType: req.params.contentType,
        });
        res.status(500).json({
            success: false,
            message: "Failed to get comments",
        });
    }
});
exports.getContentComments = getContentComments;
// Get replies for a comment
const getCommentReplies = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { commentId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        if (!commentId || !mongoose_1.Types.ObjectId.isValid(commentId)) {
            res.status(400).json({ success: false, message: "Invalid comment ID" });
            return;
        }
        const data = yield contentInteraction_service_1.default.getCommentReplies(commentId, page, limit);
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        logger_1.default.error("Get comment replies error", { error: error.message });
        res
            .status(500)
            .json({ success: false, message: "Failed to get comment replies" });
    }
});
exports.getCommentReplies = getCommentReplies;
// Edit comment
const editContentComment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { commentId } = req.params;
        const { content } = req.body;
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        if (!commentId || !mongoose_1.Types.ObjectId.isValid(commentId)) {
            res.status(400).json({ success: false, message: "Invalid comment ID" });
            return;
        }
        if (!content || content.trim().length === 0) {
            res
                .status(400)
                .json({ success: false, message: "Comment content is required" });
            return;
        }
        const updated = yield contentInteraction_service_1.default.editContentComment(commentId, userId, content);
        res
            .status(200)
            .json({ success: true, message: "Comment updated", data: updated });
    }
    catch (error) {
        logger_1.default.error("Edit comment error", { error: error.message });
        res.status(500).json({ success: false, message: "Failed to edit comment" });
    }
});
exports.editContentComment = editContentComment;
// Report comment
const reportContentComment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { commentId } = req.params;
        const { reason } = req.body || {};
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        if (!commentId || !mongoose_1.Types.ObjectId.isValid(commentId)) {
            res.status(400).json({ success: false, message: "Invalid comment ID" });
            return;
        }
        const result = yield contentInteraction_service_1.default.reportContentComment(commentId, userId, reason);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        logger_1.default.error("Report comment error", { error: error.message });
        res
            .status(500)
            .json({ success: false, message: "Failed to report comment" });
    }
});
exports.reportContentComment = reportContentComment;
// Hide comment (moderator/admin)
const hideContentComment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { commentId } = req.params;
        const { reason } = req.body || {};
        const userId = req.userId;
        const role = (_a = req.user) === null || _a === void 0 ? void 0 : _a.role;
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        if (!commentId || !mongoose_1.Types.ObjectId.isValid(commentId)) {
            res.status(400).json({ success: false, message: "Invalid comment ID" });
            return;
        }
        if (!role || !["admin", "moderator"].includes(role)) {
            res.status(403).json({ success: false, message: "Forbidden" });
            return;
        }
        yield contentInteraction_service_1.default.moderateHideComment(commentId, userId, reason);
        res.status(200).json({ success: true, message: "Comment hidden" });
    }
    catch (error) {
        logger_1.default.error("Hide comment error", { error: error.message });
        res.status(500).json({ success: false, message: "Failed to hide comment" });
    }
});
exports.hideContentComment = hideContentComment;
// Share content
const shareContent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { contentId, contentType } = req.params;
        const { platform, message } = req.body;
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!contentId || !mongoose_1.Types.ObjectId.isValid(contentId)) {
            res.status(400).json({
                success: false,
                message: "Invalid content ID",
            });
            return;
        }
        if (!contentType ||
            !["media", "devotional", "artist", "merch", "ebook", "podcast"].includes(contentType)) {
            res.status(400).json({
                success: false,
                message: "Invalid content type",
            });
            return;
        }
        // Use contentInteractionService to track share and get shareCount
        const result = yield contentInteraction_service_1.default.shareContent(userId, contentId, contentType, platform);
        (0, enqueue_1.enqueueAnalyticsEvent)({
            name: "content_shared",
            payload: {
                userId,
                contentId,
                contentType,
                platform,
                message: message || null,
                shareCount: result.shareCount,
                createdAt: new Date().toISOString(),
            },
            requestId: req.requestId,
        });
        res.status(200).json({
            success: true,
            message: "Content shared successfully",
            data: {
                shareCount: result.shareCount,
                platform,
                contentType,
            },
        });
    }
    catch (error) {
        logger_1.default.error("Share content error", {
            error: error.message,
            userId: req.userId,
            contentId: req.params.contentId,
            contentType: req.params.contentType,
        });
        if (error.message.includes("not found")) {
            res.status(404).json({
                success: false,
                message: error.message,
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: "Failed to share content",
        });
    }
});
exports.shareContent = shareContent;
