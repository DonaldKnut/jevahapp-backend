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
exports.generateMediaDescription = exports.removeFromOfflineDownloads = exports.getOfflineDownloads = exports.getOnboardingContent = exports.refreshVideoUrl = exports.getDefaultContent = exports.searchPublicMedia = exports.getPublicMediaByIdentifier = exports.getPublicAllContent = exports.getPublicMedia = exports.goLive = exports.getUserRecordings = exports.getRecordingStatus = exports.stopRecording = exports.startRecording = exports.getStreamStats = exports.scheduleLiveStream = exports.getStreamStatus = exports.getLiveStreams = exports.endMuxLiveStream = exports.startMuxLiveStream = exports.getViewedMedia = exports.addToViewedMedia = exports.getUserActionStatus = exports.recordUserAction = exports.shareMedia = exports.downloadMediaFile = exports.downloadMedia = exports.getMediaWithEngagement = exports.trackViewWithDuration = exports.recordMediaInteraction = exports.bookmarkMedia = exports.deleteMedia = exports.getMediaStats = exports.getMediaByIdentifier = exports.searchMedia = exports.getAllContentForAllTab = exports.getAllMedia = exports.uploadMedia = exports.getAnalyticsDashboard = void 0;
const media_service_1 = require("../service/media.service");
const bookmark_model_1 = require("../models/bookmark.model");
const mongoose_1 = require("mongoose");
const media_model_1 = require("../models/media.model");
const contaboStreaming_service_1 = __importDefault(require("../service/contaboStreaming.service"));
const liveRecording_service_1 = __importDefault(require("../service/liveRecording.service"));
const notification_service_1 = require("../service/notification.service");
const cache_service_1 = __importDefault(require("../service/cache.service"));
const aiContentDescription_service_1 = require("../service/aiContentDescription.service");
const user_model_1 = require("../models/user.model");
const contentModeration_service_1 = require("../service/contentModeration.service");
const mediaProcessing_service_1 = require("../service/mediaProcessing.service");
const transcription_service_1 = require("../service/transcription.service");
const optimizedVerification_service_1 = require("../service/optimizedVerification.service");
const uploadProgress_service_1 = require("../service/uploadProgress.service");
const logger_1 = __importDefault(require("../utils/logger"));
const resendEmail_service_1 = __importDefault(require("../service/resendEmail.service"));
const mediaReport_model_1 = require("../models/mediaReport.model");
const getAnalyticsDashboard = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userIdentifier = request.userId;
        const userRole = request.userRole;
        if (!userIdentifier) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        let analyticsData;
        if (userRole === "admin") {
            const mediaCountByContentType = yield media_service_1.mediaService.getMediaCountByContentType();
            const totalInteractionCounts = yield media_service_1.mediaService.getTotalInteractionCounts();
            const totalBookmarks = yield bookmark_model_1.Bookmark.countDocuments();
            const recentMedia = yield media_service_1.mediaService.getRecentMedia(10);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const uploadsLastThirtyDays = yield media_service_1.mediaService.getMediaCountSinceDate(thirtyDaysAgo);
            const interactionsLastThirtyDays = yield media_service_1.mediaService.getInteractionCountSinceDate(thirtyDaysAgo);
            analyticsData = {
                isAdmin: true,
                mediaCountByContentType,
                totalInteractionCounts,
                totalBookmarks,
                recentMedia,
                uploadsLastThirtyDays,
                interactionsLastThirtyDays,
            };
        }
        else {
            const userMediaCountByContentType = yield media_service_1.mediaService.getUserMediaCountByContentType(userIdentifier);
            const userInteractionCounts = yield media_service_1.mediaService.getUserInteractionCounts(userIdentifier);
            const userBookmarks = yield media_service_1.mediaService.getUserBookmarkCount(userIdentifier);
            const userRecentMedia = yield media_service_1.mediaService.getUserRecentMedia(userIdentifier, 5);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const userUploadsLastThirtyDays = yield media_service_1.mediaService.getUserMediaCountSinceDate(userIdentifier, thirtyDaysAgo);
            const userInteractionsLastThirtyDays = yield media_service_1.mediaService.getUserInteractionCountSinceDate(userIdentifier, thirtyDaysAgo);
            analyticsData = {
                isAdmin: false,
                userMediaCountByContentType,
                userInteractionCounts,
                userBookmarks,
                userRecentMedia,
                userUploadsLastThirtyDays,
                userInteractionsLastThirtyDays,
            };
        }
        response.status(200).json({
            success: true,
            message: "Analytics data retrieved successfully",
            data: analyticsData,
        });
    }
    catch (error) {
        console.error("Analytics error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to fetch analytics",
        });
    }
});
exports.getAnalyticsDashboard = getAnalyticsDashboard;
const uploadMedia = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { title, description, contentType, category, topics, duration } = request.body;
        // Type assertion for Multer files from upload.fields
        const files = request.files;
        // Check if files object exists
        if (!files) {
            console.log("No files received in request");
            response.status(400).json({
                success: false,
                message: "No files uploaded",
            });
            return;
        }
        const file = (_a = files === null || files === void 0 ? void 0 : files.file) === null || _a === void 0 ? void 0 : _a[0]; // Access the first file in the 'file' field
        const thumbnail = (_b = files === null || files === void 0 ? void 0 : files.thumbnail) === null || _b === void 0 ? void 0 : _b[0]; // Access the first file in the 'thumbnail' field
        // Detailed logging for debugging
        console.log("Request Files:", {
            fileExists: !!file,
            fileBufferExists: !!(file === null || file === void 0 ? void 0 : file.buffer),
            fileMimetype: file === null || file === void 0 ? void 0 : file.mimetype,
            fileOriginalname: file === null || file === void 0 ? void 0 : file.originalname,
            fileSize: file === null || file === void 0 ? void 0 : file.size,
            thumbnailExists: !!thumbnail,
            thumbnailBufferExists: !!(thumbnail === null || thumbnail === void 0 ? void 0 : thumbnail.buffer),
            thumbnailMimetype: thumbnail === null || thumbnail === void 0 ? void 0 : thumbnail.mimetype,
            thumbnailOriginalname: thumbnail === null || thumbnail === void 0 ? void 0 : thumbnail.originalname,
            thumbnailSize: thumbnail === null || thumbnail === void 0 ? void 0 : thumbnail.size,
            body: {
                title,
                description,
                contentType,
                category,
                topics,
                duration,
            },
        });
        // Validate required fields
        if (!title || !contentType) {
            response.status(400).json({
                success: false,
                message: "Title and contentType are required",
            });
            return;
        }
        // Validate contentType
        if (!["music", "videos", "books", "live"].includes(contentType)) {
            response.status(400).json({
                success: false,
                message: "Invalid content type. Must be 'music', 'videos', 'books', or 'live'",
            });
            return;
        }
        // Validate file presence
        if (!file || !file.buffer) {
            response.status(400).json({
                success: false,
                message: "No file uploaded",
            });
            return;
        }
        // Validate thumbnail presence
        if (!thumbnail || !thumbnail.buffer) {
            response.status(400).json({
                success: false,
                message: "No thumbnail uploaded",
            });
            return;
        }
        // Validate user authentication
        if (!request.userId) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        // Parse and validate topics
        let parsedTopics = [];
        if (topics) {
            try {
                parsedTopics = Array.isArray(topics) ? topics : JSON.parse(topics);
                if (!Array.isArray(parsedTopics)) {
                    throw new Error("Topics must be an array");
                }
            }
            catch (error) {
                response.status(400).json({
                    success: false,
                    message: "Invalid topics format. Must be an array of strings",
                });
                return;
            }
        }
        // Validate duration (optional, only checked if provided)
        if (duration !== undefined && (isNaN(duration) || duration < 0)) {
            response.status(400).json({
                success: false,
                message: "Invalid duration. Must be a non-negative number",
            });
            return;
        }
        // Generate upload ID for progress tracking (used for all content types)
        const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        const userId = request.userId || "";
        // PRE-UPLOAD VERIFICATION: Verify content before uploading to storage
        // Skip verification for "live" content type as it doesn't require file uploads
        let verificationResult = null;
        if (contentType !== "live") {
            logger_1.default.info("Starting optimized pre-upload content verification with progress", {
                uploadId,
                contentType,
            });
            // Register upload session for progress tracking
            uploadProgress_service_1.uploadProgressService.registerUploadSession(uploadId, userId);
            try {
                // Use optimized verification service with progress updates
                // Include thumbnail moderation (CRITICAL - first thing users see)
                verificationResult = yield optimizedVerification_service_1.optimizedVerificationService.verifyContentWithProgress(file.buffer, file.mimetype, contentType, title, description, uploadId, (progress) => {
                    // Send progress update via Socket.IO
                    uploadProgress_service_1.uploadProgressService.sendProgress(progress, userId);
                }, thumbnail.buffer, // Include thumbnail for moderation
                thumbnail.mimetype);
            }
            catch (error) {
                logger_1.default.error("Pre-upload verification error:", error);
                // Send error progress
                uploadProgress_service_1.uploadProgressService.sendProgress({
                    uploadId,
                    progress: 0,
                    stage: "error",
                    message: `Verification failed: ${error.message}`,
                    timestamp: new Date().toISOString(),
                }, userId);
                // Cleanup session
                uploadProgress_service_1.uploadProgressService.clearUploadSession(uploadId);
                // If verification fails, reject the upload for safety
                response.status(400).json({
                    success: false,
                    message: "Content verification failed. Please try again or contact support.",
                    error: error.message,
                    uploadId, // Include uploadId in response for frontend tracking
                });
                return;
            }
            // Check if content is approved
            if (!verificationResult.isApproved) {
                const status = verificationResult.moderationResult.requiresReview
                    ? "under_review"
                    : "rejected";
                logger_1.default.warn("Content rejected during pre-upload verification", {
                    status,
                    reason: verificationResult.moderationResult.reason,
                    flags: verificationResult.moderationResult.flags,
                    uploadId,
                });
                // Send rejection progress
                uploadProgress_service_1.uploadProgressService.sendProgress({
                    uploadId,
                    progress: 0,
                    stage: "rejected",
                    message: "Content does not meet community guidelines",
                    timestamp: new Date().toISOString(),
                }, userId);
                // Cleanup session
                uploadProgress_service_1.uploadProgressService.clearUploadSession(uploadId);
                // Return appropriate error response
                response.status(403).json({
                    success: false,
                    message: verificationResult.moderationResult.requiresReview
                        ? "Content requires manual review before it can be uploaded. Please contact support."
                        : "Content does not meet our community guidelines and cannot be uploaded.",
                    moderationResult: {
                        status,
                        reason: verificationResult.moderationResult.reason,
                        flags: verificationResult.moderationResult.flags,
                        confidence: verificationResult.moderationResult.confidence,
                    },
                    uploadId,
                });
                return;
            }
            // Content is approved - send completion progress
            uploadProgress_service_1.uploadProgressService.sendProgress({
                uploadId,
                progress: 100,
                stage: "complete",
                message: "Content verified and approved!",
                timestamp: new Date().toISOString(),
            }, userId);
            // Content is approved - proceed with upload
            logger_1.default.info("Content approved, proceeding with upload to storage", { uploadId });
        }
        else {
            logger_1.default.info("Skipping verification for live content type");
        }
        // Call mediaService to upload the media
        const media = yield media_service_1.mediaService.uploadMedia({
            title,
            description,
            contentType,
            category,
            file: file.buffer,
            fileMimeType: file.mimetype,
            thumbnail: thumbnail.buffer,
            thumbnailMimeType: thumbnail.mimetype,
            uploadedBy: new mongoose_1.Types.ObjectId(request.userId),
            topics: parsedTopics,
            duration,
        });
        // Update media with pre-upload verification result (if verification was performed)
        if (verificationResult) {
            const updateData = {
                moderationStatus: "approved",
                moderationResult: Object.assign(Object.assign({}, verificationResult.moderationResult), { moderatedAt: new Date() }),
                isHidden: false,
            };
            yield media_model_1.Media.findByIdAndUpdate(media._id, updateData);
            // Update media object for response
            media.moderationStatus = "approved";
            media.moderationResult = updateData.moderationResult;
            media.isHidden = false;
        }
        else {
            // For live content, set to pending (will be moderated separately if needed)
            const updateData = {
                moderationStatus: "pending",
                isHidden: false,
            };
            yield media_model_1.Media.findByIdAndUpdate(media._id, updateData);
            media.moderationStatus = "pending";
        }
        // Invalidate cache for media lists
        yield cache_service_1.default.delPattern("media:public:*");
        yield cache_service_1.default.delPattern("media:all:*");
        // Cleanup upload session
        if (contentType !== "live") {
            uploadProgress_service_1.uploadProgressService.clearUploadSession(uploadId);
        }
        // Return success response
        response.status(201).json({
            success: true,
            message: verificationResult
                ? "Media uploaded successfully. Content has been verified and approved."
                : "Media uploaded successfully.",
            media: Object.assign(Object.assign({}, media.toObject()), { fileUrl: media.fileUrl, thumbnailUrl: media.thumbnailUrl, moderationStatus: media.moderationStatus || "pending", moderationResult: media.moderationResult }),
            uploadId: contentType !== "live" ? uploadId : undefined, // Include uploadId for tracking
        });
    }
    catch (error) {
        console.error("Upload media error:", error);
        // Cleanup upload session on error (only if variables are available)
        if (request.body && request.body.contentType && request.body.contentType !== "live") {
            const errorUploadId = request.headers['x-upload-id'] || undefined;
            const errorUserId = request.userId || "";
            if (errorUploadId && errorUserId) {
                uploadProgress_service_1.uploadProgressService.sendProgress({
                    uploadId: errorUploadId,
                    progress: 0,
                    stage: "error",
                    message: `Upload failed: ${error.message}`,
                    timestamp: new Date().toISOString(),
                }, errorUserId);
                uploadProgress_service_1.uploadProgressService.clearUploadSession(errorUploadId);
            }
        }
        response.status(500).json({
            success: false,
            message: `Failed to upload media: ${error.message}`,
        });
    }
});
exports.uploadMedia = uploadMedia;
const getAllMedia = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const filters = request.query;
        const mediaList = yield media_service_1.mediaService.getAllMedia(filters);
        response.status(200).json({
            success: true,
            media: mediaList.media,
            pagination: mediaList.pagination,
        });
    }
    catch (error) {
        console.error("Fetch media error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to retrieve media",
        });
    }
});
exports.getAllMedia = getAllMedia;
// New endpoint specifically for the "All" tab - returns all content for all users
const getAllContentForAllTab = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const result = yield media_service_1.mediaService.getAllContentForAllTab();
        // Optional personalization: include recommendations when user is authenticated
        let recommendations = undefined;
        const userIdentifier = request.userId;
        try {
            recommendations = yield media_service_1.mediaService.getRecommendationsForAllContent(userIdentifier, {
                limitPerSection: 12,
                mood: ((_a = request.query) === null || _a === void 0 ? void 0 : _a.mood) || undefined,
            });
        }
        catch (err) {
            // Non-blocking failure; proceed without recommendations
            recommendations = undefined;
        }
        response.status(200).json({
            success: true,
            media: result.media,
            total: result.total,
            recommendations,
        });
    }
    catch (error) {
        console.error("Fetch all content error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to retrieve all content",
        });
    }
});
exports.getAllContentForAllTab = getAllContentForAllTab;
const searchMedia = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { search, contentType, category, topics, sort, page, limit, creator, duration, startDate, endDate, } = request.query;
        if (page && isNaN(parseInt(page))) {
            response.status(400).json({
                success: false,
                message: "Invalid page number",
            });
            return;
        }
        if (limit && isNaN(parseInt(limit))) {
            response.status(400).json({
                success: false,
                message: "Invalid limit",
            });
            return;
        }
        const filters = {};
        if (search)
            filters.search = search;
        if (contentType)
            filters.contentType = contentType;
        if (category)
            filters.category = category;
        if (topics)
            filters.topics = topics;
        if (sort)
            filters.sort = sort;
        if (page)
            filters.page = page;
        if (limit)
            filters.limit = limit;
        if (creator)
            filters.creator = creator;
        if (duration)
            filters.duration = duration;
        if (startDate)
            filters.startDate = startDate;
        if (endDate)
            filters.endDate = endDate;
        const result = yield media_service_1.mediaService.getAllMedia(filters);
        response.status(200).json({
            success: true,
            message: "Media search completed",
            media: result.media,
            pagination: result.pagination,
        });
    }
    catch (error) {
        console.error("Search media error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to search media",
        });
    }
});
exports.searchMedia = searchMedia;
const getMediaByIdentifier = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = request.params;
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            response.status(400).json({
                success: false,
                message: "Invalid media identifier",
            });
            return;
        }
        const media = yield media_service_1.mediaService.getMediaByIdentifier(id);
        const interactionCounts = yield media_service_1.mediaService.getInteractionCounts(id);
        response.status(200).json({
            success: true,
            media: Object.assign(Object.assign({}, media.toObject()), interactionCounts),
        });
    }
    catch (error) {
        console.error("Get media by identifier error:", error);
        response.status(error.message === "Media not found" ? 404 : 400).json({
            success: false,
            message: error.message || "Failed to fetch media item",
        });
    }
});
exports.getMediaByIdentifier = getMediaByIdentifier;
const getMediaStats = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = request.params;
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            response.status(400).json({
                success: false,
                message: "Invalid media identifier",
            });
            return;
        }
        const stats = yield media_service_1.mediaService.getInteractionCounts(id);
        response.status(200).json({
            success: true,
            message: "Media stats retrieved successfully",
            stats,
        });
    }
    catch (error) {
        console.error("Get media stats error:", error);
        response.status(error.message === "Media not found" ? 404 : 400).json({
            success: false,
            message: error.message || "Failed to fetch media stats",
        });
    }
});
exports.getMediaStats = getMediaStats;
const deleteMedia = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = request.params;
        const userIdentifier = request.userId;
        const userRole = (_a = request.user) === null || _a === void 0 ? void 0 : _a.role;
        // Debug logging
        console.log("Delete Media Request:", {
            mediaId: id,
            userId: userIdentifier,
            userRole: userRole,
            hasUser: !!request.user,
            authHeader: request.headers.authorization ? "present" : "missing",
        });
        if (!userIdentifier) {
            console.error("Delete Media: No user identifier found");
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            response.status(400).json({
                success: false,
                message: "Invalid media identifier",
            });
            return;
        }
        yield media_service_1.mediaService.deleteMedia(id, userIdentifier, userRole || "");
        // Invalidate cache for this media and related caches
        yield cache_service_1.default.del(`media:public:${id}`);
        yield cache_service_1.default.del(`media:${id}`);
        yield cache_service_1.default.delPattern("media:public:*");
        yield cache_service_1.default.delPattern("media:all:*");
        response.status(200).json({
            success: true,
            message: "Media deleted successfully",
        });
    }
    catch (error) {
        console.error("Delete media error:", error);
        response.status(error.message === "Media not found" ? 404 : 400).json({
            success: false,
            message: error.message || "Failed to delete media",
        });
    }
});
exports.deleteMedia = deleteMedia;
const bookmarkMedia = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = request.params;
        const userIdentifier = request.userId;
        if (!userIdentifier) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            response.status(400).json({
                success: false,
                message: "Invalid media identifier",
            });
            return;
        }
        const mediaExists = yield media_service_1.mediaService.getMediaByIdentifier(id);
        if (!mediaExists) {
            response.status(404).json({
                success: false,
                message: "Media not found",
            });
            return;
        }
        const existingBookmark = yield bookmark_model_1.Bookmark.findOne({
            user: new mongoose_1.Types.ObjectId(userIdentifier),
            media: new mongoose_1.Types.ObjectId(id),
        });
        if (existingBookmark) {
            response.status(400).json({
                success: false,
                message: "Media already saved",
            });
            return;
        }
        const bookmark = yield bookmark_model_1.Bookmark.create({
            user: new mongoose_1.Types.ObjectId(userIdentifier),
            media: new mongoose_1.Types.ObjectId(id),
        });
        response.status(200).json({
            success: true,
            message: `Saved media ${id}`,
            bookmark,
        });
    }
    catch (error) {
        console.error("Bookmark media error:", error);
        if (error.code === 11000) {
            response.status(400).json({
                success: false,
                message: "Media already saved",
            });
            return;
        }
        response.status(500).json({
            success: false,
            message: "Failed to save media",
        });
    }
});
exports.bookmarkMedia = bookmarkMedia;
const recordMediaInteraction = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = request.params;
        const { interactionType } = request.body;
        const userIdentifier = request.userId;
        if (!userIdentifier) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            response.status(400).json({
                success: false,
                message: "Invalid media identifier",
            });
            return;
        }
        if (!["view", "listen", "read", "download"].includes(interactionType)) {
            response.status(400).json({
                success: false,
                message: "Invalid interaction type",
            });
            return;
        }
        const interaction = yield media_service_1.mediaService.recordInteraction({
            userIdentifier,
            mediaIdentifier: id,
            interactionType,
        });
        // If interaction is a view, add to viewed media list
        if (interactionType === "view") {
            yield media_service_1.mediaService.addToViewedMedia(userIdentifier, id);
        }
        response.status(201).json({
            success: true,
            message: `Recorded ${interactionType} for media ${id}`,
            interaction,
        });
    }
    catch (error) {
        console.error("Record media interaction error:", error);
        if (error.message.includes("Invalid") ||
            error.message.includes("already") ||
            error.message.includes("Media not found")) {
            response.status(error.message === "Media not found" ? 404 : 400).json({
                success: false,
                message: error.message,
            });
            return;
        }
        response.status(500).json({
            success: false,
            message: "Failed to record interaction",
        });
    }
});
exports.recordMediaInteraction = recordMediaInteraction;
// New method for tracking views with duration
const trackViewWithDuration = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = request.userId;
        const { mediaId, duration, isComplete } = request.body;
        if (!userId) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User ID missing",
            });
            return;
        }
        if (!mediaId ||
            typeof duration !== "number" ||
            typeof isComplete !== "boolean") {
            response.status(400).json({
                success: false,
                message: "Missing required fields: mediaId, duration, isComplete",
            });
            return;
        }
        const result = yield media_service_1.mediaService.trackViewWithDuration({
            userIdentifier: userId,
            mediaIdentifier: mediaId,
            duration,
            isComplete,
        });
        response.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        console.error("Track view error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to track view",
        });
    }
});
exports.trackViewWithDuration = trackViewWithDuration;
const getMediaWithEngagement = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { mediaId } = request.params;
        const userId = request.userId; // Optional for public access
        if (!mediaId) {
            response.status(400).json({
                success: false,
                message: "Media ID is required",
            });
            return;
        }
        const media = yield media_service_1.mediaService.getMediaWithEngagement(mediaId, userId || "");
        response.status(200).json({
            success: true,
            data: media,
        });
    }
    catch (error) {
        console.error("Get media with engagement error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to retrieve media with engagement data",
        });
    }
});
exports.getMediaWithEngagement = getMediaWithEngagement;
// New method for downloading media
const downloadMedia = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = request.params;
        const { fileSize } = request.body;
        const userIdentifier = request.userId;
        if (!userIdentifier) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!id || !mongoose_1.Types.ObjectId.isValid(id)) {
            response.status(400).json({
                success: false,
                message: "Invalid media ID",
            });
            return;
        }
        // Fetch media to get fileSize if not provided in request
        const media = yield media_model_1.Media.findById(id).select("fileSize fileUrl contentType title isDownloadable");
        if (!media) {
            response.status(404).json({
                success: false,
                message: "Media not found",
            });
            return;
        }
        // Use provided fileSize, or fallback to media.fileSize, or 0 as default
        const finalFileSize = fileSize && typeof fileSize === "number" && fileSize > 0
            ? fileSize
            : (media.fileSize && typeof media.fileSize === "number" && media.fileSize > 0
                ? media.fileSize
                : 0); // Default to 0 if neither available
        const result = yield media_service_1.mediaService.downloadMedia({
            userId: userIdentifier,
            mediaId: id,
            fileSize: finalFileSize,
        });
        // Notify content owner about the download (if not self)
        try {
            yield notification_service_1.NotificationService.notifyContentDownload(userIdentifier, id, "media");
        }
        catch (notifyError) {
            // Non-blocking
        }
        response.status(200).json({
            success: true,
            message: "Download recorded successfully",
            downloadUrl: result.downloadUrl,
            fileName: result.fileName,
            fileSize: result.fileSize,
            contentType: result.contentType,
        });
    }
    catch (error) {
        console.error("Download media error:", error);
        if (error instanceof Error) {
            if (error.message.includes("not found")) {
                response.status(404).json({
                    success: false,
                    message: error.message,
                });
                return;
            }
            if (error.message.includes("not available for download")) {
                response.status(403).json({
                    success: false,
                    message: error.message,
                });
                return;
            }
            if (error.message.includes("Invalid") ||
                error.message.includes("required")) {
                response.status(400).json({
                    success: false,
                    message: error.message,
                });
                return;
            }
        }
        response.status(500).json({
            success: false,
            message: "Failed to record download",
        });
    }
});
exports.downloadMedia = downloadMedia;
// New method for direct file download (for UI components)
const downloadMediaFile = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = request.params;
        const userIdentifier = request.userId;
        if (!userIdentifier) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!id || !mongoose_1.Types.ObjectId.isValid(id)) {
            response.status(400).json({
                success: false,
                message: "Invalid media ID",
            });
            return;
        }
        const result = yield media_service_1.mediaService.downloadMediaFile({
            userId: userIdentifier,
            mediaId: id,
        });
        // Notify content owner about the download (if not self)
        try {
            yield notification_service_1.NotificationService.notifyContentDownload(userIdentifier, id, "media");
        }
        catch (notifyError) {
            // Non-blocking
        }
        // Set appropriate headers for file download
        response.setHeader("Content-Type", result.contentType || "application/octet-stream");
        response.setHeader("Content-Disposition", `attachment; filename="${result.fileName}"`);
        response.setHeader("Content-Length", result.fileSize);
        // Stream the file
        response.send(result.fileBuffer);
    }
    catch (error) {
        console.error("Download media file error:", error);
        if (error instanceof Error) {
            if (error.message.includes("not found")) {
                response.status(404).json({
                    success: false,
                    message: error.message,
                });
                return;
            }
            if (error.message.includes("not available for download")) {
                response.status(403).json({
                    success: false,
                    message: error.message,
                });
                return;
            }
            if (error.message.includes("Invalid") ||
                error.message.includes("required")) {
                response.status(400).json({
                    success: false,
                    message: error.message,
                });
                return;
            }
        }
        response.status(500).json({
            success: false,
            message: "Failed to download media file",
        });
    }
});
exports.downloadMediaFile = downloadMediaFile;
// New method for sharing media
const shareMedia = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = request.params;
        const { platform } = request.body;
        const userIdentifier = request.userId;
        if (!userIdentifier) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!id || !mongoose_1.Types.ObjectId.isValid(id)) {
            response.status(400).json({
                success: false,
                message: "Invalid media ID",
            });
            return;
        }
        const result = yield media_service_1.mediaService.shareMedia({
            userId: userIdentifier,
            mediaId: id,
            platform,
        });
        response.status(200).json({
            success: true,
            message: "Share recorded successfully",
            shareUrl: result.shareUrl,
        });
    }
    catch (error) {
        console.error("Share media error:", error);
        if (error instanceof Error) {
            if (error.message.includes("not found")) {
                response.status(404).json({
                    success: false,
                    message: error.message,
                });
                return;
            }
            if (error.message.includes("Invalid") ||
                error.message.includes("required")) {
                response.status(400).json({
                    success: false,
                    message: error.message,
                });
                return;
            }
        }
        response.status(500).json({
            success: false,
            message: "Failed to record share",
        });
    }
});
exports.shareMedia = shareMedia;
const recordUserAction = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = request.params;
        const { actionType } = request.body;
        const userIdentifier = request.userId;
        if (!userIdentifier) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!id || !mongoose_1.Types.ObjectId.isValid(id)) {
            response.status(400).json({
                success: false,
                message: "Invalid media ID",
            });
            return;
        }
        if (!["favorite", "share"].includes(actionType)) {
            response.status(400).json({
                success: false,
                message: "Invalid action type",
            });
            return;
        }
        const action = yield media_service_1.mediaService.recordUserAction({
            userIdentifier,
            mediaIdentifier: id,
            actionType,
        });
        const isRemoved = action.removed;
        const message = isRemoved
            ? `Removed ${actionType} from media ${id}`
            : `Added ${actionType} to media ${id}`;
        response.status(201).json({
            success: true,
            message,
            action: Object.assign(Object.assign({}, action.toObject()), { isRemoved }),
        });
    }
    catch (error) {
        console.error("Record user action error:", error);
        const safeActionType = ((_a = request.body) === null || _a === void 0 ? void 0 : _a.actionType) || "unknown action";
        if (error instanceof Error) {
            if (error.message.includes("own content")) {
                response.status(400).json({
                    success: false,
                    message: error.message,
                });
                return;
            }
            if (error.message.includes("Invalid") ||
                error.message.includes("Media not found")) {
                response.status(error.message === "Media not found" ? 404 : 400).json({
                    success: false,
                    message: error.message,
                });
                return;
            }
        }
        response.status(500).json({
            success: false,
            message: `Failed to record ${safeActionType}`,
        });
    }
});
exports.recordUserAction = recordUserAction;
const getUserActionStatus = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = request.params;
        const userIdentifier = request.userId;
        if (!userIdentifier) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            response.status(400).json({
                success: false,
                message: "Invalid media identifier",
            });
            return;
        }
        const status = yield media_service_1.mediaService.getUserActionStatus(userIdentifier, id);
        response.status(200).json({
            success: true,
            message: "User action status retrieved successfully",
            status,
        });
    }
    catch (error) {
        console.error("Get user action status error:", error);
        response.status(error.message === "Media not found" ? 404 : 400).json({
            success: false,
            message: error.message || "Failed to get user action status",
        });
    }
});
exports.getUserActionStatus = getUserActionStatus;
const addToViewedMedia = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { mediaId } = request.body;
        const userIdentifier = request.userId;
        if (!userIdentifier) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!mongoose_1.Types.ObjectId.isValid(mediaId)) {
            response.status(400).json({
                success: false,
                message: "Invalid media identifier",
            });
            return;
        }
        const result = yield media_service_1.mediaService.addToViewedMedia(userIdentifier, mediaId);
        response.status(201).json({
            success: true,
            message: "Added media to viewed list",
            viewedMedia: result.viewedMedia,
        });
    }
    catch (error) {
        console.error("Add to viewed media error:", error);
        response.status(error.message === "Media not found" ? 404 : 400).json({
            success: false,
            message: error.message || "Failed to add to viewed media",
        });
    }
});
exports.addToViewedMedia = addToViewedMedia;
const getViewedMedia = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userIdentifier = request.userId;
        if (!userIdentifier) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        const viewedMedia = yield media_service_1.mediaService.getViewedMedia(userIdentifier);
        response.status(200).json({
            success: true,
            message: "Retrieved viewed media list",
            viewedMedia,
        });
    }
    catch (error) {
        console.error("Get viewed media error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to retrieve viewed media",
        });
    }
});
exports.getViewedMedia = getViewedMedia;
const startMuxLiveStream = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { title, description, category, topics } = request.body;
        const userIdentifier = request.userId;
        if (!userIdentifier) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        const stream = yield contaboStreaming_service_1.default.startLiveStream({
            title,
            description,
            category,
            topics: Array.isArray(topics)
                ? topics
                : typeof topics === "string"
                    ? topics.split(",").map(t => t.trim())
                    : [],
            uploadedBy: new mongoose_1.Types.ObjectId(userIdentifier),
        });
        response.status(201).json({
            success: true,
            message: "Live stream started successfully",
            stream: {
                streamKey: stream.streamKey,
                rtmpUrl: stream.rtmpUrl,
                playbackUrl: stream.playbackUrl,
                hlsUrl: stream.hlsUrl,
                dashUrl: stream.dashUrl,
                streamId: stream.streamId,
            },
        });
    }
    catch (error) {
        console.error("Contabo live stream creation error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to start live stream",
        });
    }
});
exports.startMuxLiveStream = startMuxLiveStream;
const endMuxLiveStream = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = request.params;
        const userIdentifier = request.userId;
        if (!userIdentifier) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            response.status(400).json({
                success: false,
                message: "Invalid media identifier",
            });
            return;
        }
        const stream = yield media_model_1.Media.findById(id);
        if (!stream || !stream.isLive) {
            response.status(404).json({
                success: false,
                message: "Live stream not found",
            });
            return;
        }
        if (stream.uploadedBy.toString() !== userIdentifier &&
            request.userRole !== "admin") {
            response.status(403).json({
                success: false,
                message: "Unauthorized to end this live stream",
            });
            return;
        }
        yield contaboStreaming_service_1.default.endLiveStream(stream.streamId, userIdentifier);
        response.status(200).json({
            success: true,
            message: "Live stream ended successfully",
        });
    }
    catch (error) {
        console.error("End live stream error:", error);
        response
            .status(error.message === "Live stream not found" ? 404 : 500)
            .json({
            success: false,
            message: error.message || "Failed to end live stream",
        });
    }
});
exports.endMuxLiveStream = endMuxLiveStream;
const getLiveStreams = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const streams = yield contaboStreaming_service_1.default.getActiveStreams();
        response.status(200).json({
            success: true,
            streams,
        });
    }
    catch (error) {
        console.error("Get live streams error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to retrieve live streams",
        });
    }
});
exports.getLiveStreams = getLiveStreams;
// New Contabo-specific endpoints
const getStreamStatus = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { streamId } = request.params;
        const userIdentifier = request.userId;
        if (!userIdentifier) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        const status = yield contaboStreaming_service_1.default.getStreamStatus(streamId);
        response.status(200).json({
            success: true,
            status,
        });
    }
    catch (error) {
        console.error("Get stream status error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to get stream status",
        });
    }
});
exports.getStreamStatus = getStreamStatus;
const scheduleLiveStream = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { title, description, category, topics, scheduledStart, scheduledEnd, } = request.body;
        const userIdentifier = request.userId;
        if (!userIdentifier) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!scheduledStart) {
            response.status(400).json({
                success: false,
                message: "Scheduled start time is required",
            });
            return;
        }
        const stream = yield contaboStreaming_service_1.default.scheduleLiveStream({
            title,
            description,
            category,
            topics: Array.isArray(topics)
                ? topics
                : typeof topics === "string"
                    ? topics.split(",").map(t => t.trim())
                    : [],
            uploadedBy: new mongoose_1.Types.ObjectId(userIdentifier),
            scheduledStart: new Date(scheduledStart),
            scheduledEnd: scheduledEnd ? new Date(scheduledEnd) : undefined,
        });
        response.status(201).json({
            success: true,
            message: "Live stream scheduled successfully",
            stream: {
                streamKey: stream.streamKey,
                rtmpUrl: stream.rtmpUrl,
                playbackUrl: stream.playbackUrl,
                hlsUrl: stream.hlsUrl,
                dashUrl: stream.dashUrl,
                streamId: stream.streamId,
                scheduledStart,
                scheduledEnd,
            },
        });
    }
    catch (error) {
        console.error("Schedule live stream error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to schedule live stream",
        });
    }
});
exports.scheduleLiveStream = scheduleLiveStream;
const getStreamStats = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { streamId } = request.params;
        const userIdentifier = request.userId;
        if (!userIdentifier) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        const stats = yield contaboStreaming_service_1.default.getStreamStats(streamId);
        response.status(200).json({
            success: true,
            stats,
        });
    }
    catch (error) {
        console.error("Get stream stats error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to get stream statistics",
        });
    }
});
exports.getStreamStats = getStreamStats;
/**
 * Start recording a live stream
 */
const startRecording = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { streamId, streamKey, title, description, category, topics } = request.body;
        const userIdentifier = request.userId;
        if (!userIdentifier) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!streamId || !streamKey || !title) {
            response.status(400).json({
                success: false,
                message: "Stream ID, stream key, and title are required",
            });
            return;
        }
        const recording = yield liveRecording_service_1.default.startRecording({
            streamId,
            streamKey,
            title,
            description,
            category,
            topics: topics ? JSON.parse(topics) : [],
            uploadedBy: new mongoose_1.Types.ObjectId(userIdentifier),
        });
        response.status(201).json({
            success: true,
            message: "Recording started successfully",
            recording,
        });
    }
    catch (error) {
        console.error("Start recording error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to start recording",
        });
    }
});
exports.startRecording = startRecording;
/**
 * Stop recording a live stream
 */
const stopRecording = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { streamId } = request.params;
        const userIdentifier = request.userId;
        if (!userIdentifier) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        const recording = yield liveRecording_service_1.default.stopRecording(streamId, userIdentifier);
        response.status(200).json({
            success: true,
            message: "Recording stopped successfully",
            recording,
        });
    }
    catch (error) {
        console.error("Stop recording error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to stop recording",
        });
    }
});
exports.stopRecording = stopRecording;
/**
 * Get recording status
 */
const getRecordingStatus = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { streamId } = request.params;
        const userIdentifier = request.userId;
        if (!userIdentifier) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        const status = yield liveRecording_service_1.default.getRecordingStatus(streamId);
        response.status(200).json({
            success: true,
            status,
        });
    }
    catch (error) {
        console.error("Get recording status error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to get recording status",
        });
    }
});
exports.getRecordingStatus = getRecordingStatus;
/**
 * Get user's recordings
 */
const getUserRecordings = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userIdentifier = request.userId;
        if (!userIdentifier) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        const recordings = yield liveRecording_service_1.default.getUserRecordings(userIdentifier);
        response.status(200).json({
            success: true,
            recordings,
        });
    }
    catch (error) {
        console.error("Get user recordings error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to get user recordings",
        });
    }
});
exports.getUserRecordings = getUserRecordings;
const goLive = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { title, description } = request.body;
        const userIdentifier = request.userId;
        if (!userIdentifier) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!title || title.trim() === "") {
            response.status(400).json({
                success: false,
                message: "Title is required for live stream",
            });
            return;
        }
        // Start live stream immediately with minimal info
        const stream = yield contaboStreaming_service_1.default.startLiveStream({
            title: title.trim(),
            description: (description === null || description === void 0 ? void 0 : description.trim()) || "Live stream",
            category: "live",
            topics: ["live-stream"],
            uploadedBy: new mongoose_1.Types.ObjectId(userIdentifier),
        });
        response.status(201).json({
            success: true,
            message: "Live stream started successfully",
            stream: {
                streamKey: stream.streamKey,
                rtmpUrl: stream.rtmpUrl,
                playbackUrl: stream.playbackUrl,
                hlsUrl: stream.hlsUrl,
                dashUrl: stream.dashUrl,
                streamId: stream.streamId,
            },
        });
    }
    catch (error) {
        console.error("Go live stream creation error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to start live stream",
        });
    }
});
exports.goLive = goLive;
// Public endpoints for viewing media (no authentication required)
const getPublicMedia = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const filters = request.query;
        const cacheKey = `media:public:${JSON.stringify(filters)}`;
        // Cache for 5 minutes (300 seconds)
        const result = yield cache_service_1.default.getOrSet(cacheKey, () => __awaiter(void 0, void 0, void 0, function* () {
            const mediaList = yield media_service_1.mediaService.getAllMedia(filters);
            return {
                success: true,
                media: mediaList.media,
                pagination: mediaList.pagination,
            };
        }), 300 // 5 minutes cache
        );
        response.status(200).json(result);
    }
    catch (error) {
        console.error("Fetch public media error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to retrieve media",
        });
    }
});
exports.getPublicMedia = getPublicMedia;
const getPublicAllContent = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const cacheKey = `media:public:all-content:${request.query.mood || "default"}`;
        // Cache for 5 minutes (300 seconds)
        const result = yield cache_service_1.default.getOrSet(cacheKey, () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const mediaResult = yield media_service_1.mediaService.getAllContentForAllTab();
            // Public endpoint can still include non-personalized recommendations
            let recommendations = undefined;
            try {
                recommendations = yield media_service_1.mediaService.getRecommendationsForAllContent(undefined, {
                    limitPerSection: 12,
                    mood: ((_a = request.query) === null || _a === void 0 ? void 0 : _a.mood) || undefined,
                });
            }
            catch (err) {
                recommendations = undefined;
            }
            return {
                success: true,
                media: mediaResult.media,
                total: mediaResult.total,
                recommendations,
            };
        }), 300 // 5 minutes cache
        );
        response.status(200).json(result);
    }
    catch (error) {
        console.error("Fetch public all content error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to retrieve all content",
        });
    }
});
exports.getPublicAllContent = getPublicAllContent;
const getPublicMediaByIdentifier = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = request.params;
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            response.status(400).json({
                success: false,
                message: "Invalid media identifier",
            });
            return;
        }
        const cacheKey = `media:public:${id}`;
        // Cache for 10 minutes (600 seconds)
        const result = yield cache_service_1.default.getOrSet(cacheKey, () => __awaiter(void 0, void 0, void 0, function* () {
            const media = yield media_service_1.mediaService.getMediaByIdentifier(id);
            if (!media) {
                return {
                    success: false,
                    message: "Media not found",
                };
            }
            return {
                success: true,
                media: media.toObject(),
            };
        }), 600 // 10 minutes cache
        );
        if (!result.success) {
            response.status(404).json(result);
            return;
        }
        response.status(200).json(result);
    }
    catch (error) {
        console.error("Fetch public media by ID error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to retrieve media",
        });
    }
});
exports.getPublicMediaByIdentifier = getPublicMediaByIdentifier;
const searchPublicMedia = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { search, contentType, category, topics, sort, page, limit, creator, duration, startDate, endDate, } = request.query;
        if (page && isNaN(parseInt(page))) {
            response.status(400).json({
                success: false,
                message: "Invalid page number",
            });
            return;
        }
        if (limit && isNaN(parseInt(limit))) {
            response.status(400).json({
                success: false,
                message: "Invalid limit",
            });
            return;
        }
        const filters = {};
        if (search)
            filters.search = search;
        if (contentType)
            filters.contentType = contentType;
        if (category)
            filters.category = category;
        if (topics)
            filters.topics = topics;
        if (sort)
            filters.sort = sort;
        if (page)
            filters.page = page;
        if (limit)
            filters.limit = limit;
        if (creator)
            filters.creator = creator;
        if (duration)
            filters.duration = duration;
        if (startDate)
            filters.startDate = startDate;
        if (endDate)
            filters.endDate = endDate;
        const result = yield media_service_1.mediaService.getAllMedia(filters);
        response.status(200).json({
            success: true,
            message: "Media search completed",
            media: result.media,
            pagination: result.pagination,
        });
    }
    catch (error) {
        console.error("Search public media error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to search media",
        });
    }
});
exports.searchPublicMedia = searchPublicMedia;
const getDefaultContent = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { contentType, limit = "10", page = "1" } = request.query;
        const limitNum = parseInt(limit) || 10;
        const pageNum = parseInt(page) || 1;
        const skip = (pageNum - 1) * limitNum;
        // Build filter for default content
        const filter = {
            isDefaultContent: true,
            isOnboardingContent: true,
        };
        // Add contentType filter if provided
        if (contentType && contentType !== "all") {
            filter.contentType = contentType;
        }
        // Get total count for pagination
        const total = yield media_model_1.Media.countDocuments(filter);
        // Get default content with pagination
        const defaultContentRaw = yield media_model_1.Media.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate("uploadedBy", "firstName lastName username email avatar")
            .lean();
        // Use direct public URLs - no need for signed URL generation
        const content = defaultContentRaw.map((item) => {
            var _a, _b, _c, _d;
            // Transform to frontend-expected format
            return {
                _id: item._id,
                title: item.title || "Untitled",
                description: item.description || "",
                mediaUrl: item.fileUrl, // Use direct public URL
                thumbnailUrl: item.thumbnailUrl || item.fileUrl, // Use direct public URL
                contentType: mapContentType(item.contentType),
                duration: item.duration || null,
                author: {
                    _id: ((_a = item.uploadedBy) === null || _a === void 0 ? void 0 : _a._id) || item.uploadedBy,
                    firstName: ((_b = item.uploadedBy) === null || _b === void 0 ? void 0 : _b.firstName) || "Unknown",
                    lastName: ((_c = item.uploadedBy) === null || _c === void 0 ? void 0 : _c.lastName) || "User",
                    avatar: ((_d = item.uploadedBy) === null || _d === void 0 ? void 0 : _d.avatar) || null,
                },
                likeCount: item.likeCount || 0,
                commentCount: item.commentCount || 0,
                shareCount: item.shareCount || 0,
                viewCount: item.viewCount || 0,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
            };
        });
        response.status(200).json({
            success: true,
            data: {
                content,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    pages: Math.ceil(total / limitNum),
                },
            },
        });
    }
    catch (error) {
        console.error("Get default content error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to retrieve default content",
        });
    }
});
exports.getDefaultContent = getDefaultContent;
// Video URL refresh endpoint for seamless playback
const refreshVideoUrl = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { mediaId } = request.params;
        const userIdentifier = request.userId;
        if (!mediaId || !mongoose_1.Types.ObjectId.isValid(mediaId)) {
            response.status(400).json({
                success: false,
                message: "Invalid media ID",
            });
            return;
        }
        // Find the media
        const media = yield media_model_1.Media.findById(mediaId);
        if (!media) {
            response.status(404).json({
                success: false,
                message: "Media not found",
            });
            return;
        }
        // Check if media is public or user has access
        if (!media.isPublic && media.uploadedBy.toString() !== userIdentifier) {
            response.status(403).json({
                success: false,
                message: "Access denied",
            });
            return;
        }
        // Import file upload service
        const { default: fileUploadService } = yield Promise.resolve().then(() => __importStar(require("../service/fileUpload.service")));
        // Extract object key from fileUrl
        const objectKey = extractObjectKeyFromUrl(media.fileUrl);
        if (!objectKey) {
            response.status(400).json({
                success: false,
                message: "Invalid media file URL",
            });
            return;
        }
        // Since we use public URLs, just return the existing public URL
        // No need to generate signed URLs as they're permanent public URLs
        const publicUrl = media.fileUrl; // This is already a permanent public URL
        response.status(200).json({
            success: true,
            data: {
                mediaId: media._id,
                newUrl: publicUrl, // Return the same public URL (it doesn't expire)
                expiresIn: null, // Public URLs don't expire
                expiresAt: null, // Public URLs don't expire
                isPublicUrl: true, // Indicate this is a permanent public URL
            },
            message: "Video URL refreshed successfully (using permanent public URL)",
        });
    }
    catch (error) {
        console.error("Refresh video URL error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to refresh video URL",
        });
    }
});
exports.refreshVideoUrl = refreshVideoUrl;
// Helper function to extract object key from URL
const extractObjectKeyFromUrl = (url) => {
    try {
        if (url.includes("/")) {
            const parts = url.split("/");
            return parts.slice(3).join("/"); // Remove domain parts
        }
        return url;
    }
    catch (error) {
        return null;
    }
};
// Helper function to map content types
const mapContentType = (contentType) => {
    switch (contentType) {
        case "videos":
        case "sermon":
            return "video";
        case "audio":
        case "music":
        case "devotional":
            return "audio";
        case "ebook":
        case "books":
            return "image";
        default:
            return "video";
    }
};
const getOnboardingContent = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userIdentifier = request.userId;
        if (!userIdentifier) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        // Get a curated selection of onboarding content
        const onboardingContent = yield media_model_1.Media.find({
            isOnboardingContent: true,
            isDefaultContent: true,
        })
            .sort({ createdAt: -1 })
            .limit(15) // Show 15 items for onboarding
            .populate("uploadedBy", "firstName lastName username email avatar")
            .lean();
        // Create onboarding experience with different sections
        const onboardingExperience = {
            welcome: {
                title: "Welcome to Jevah",
                subtitle: "Your spiritual journey starts here",
                content: onboardingContent.slice(0, 3), // First 3 items
            },
            quickStart: {
                title: "Quick Start",
                subtitle: "Short content to get you started",
                content: onboardingContent
                    .filter(item => item.contentType === "audio" &&
                    item.duration &&
                    item.duration <= 300)
                    .slice(0, 3),
            },
            featured: {
                title: "Featured Content",
                subtitle: "Popular gospel content",
                content: onboardingContent
                    .filter(item => item.contentType === "music" || item.contentType === "sermon")
                    .slice(0, 3),
            },
            devotionals: {
                title: "Daily Devotionals",
                subtitle: "Start your day with prayer",
                content: onboardingContent
                    .filter(item => item.contentType === "devotional")
                    .slice(0, 2),
            },
        };
        response.status(200).json({
            success: true,
            message: "Onboarding content retrieved successfully",
            data: onboardingExperience,
        });
    }
    catch (error) {
        console.error("Get onboarding content error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to retrieve onboarding content",
        });
    }
});
exports.getOnboardingContent = getOnboardingContent;
// Get user's offline downloads
const getOfflineDownloads = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = request.userId;
        const page = parseInt(request.query.page) || 1;
        const limit = parseInt(request.query.limit) || 20;
        if (!userId) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        const result = yield media_service_1.mediaService.getUserOfflineDownloads(userId, page, limit);
        response.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        console.error("Get offline downloads error:", error);
        if (error.message.includes("not found")) {
            response.status(404).json({
                success: false,
                message: error.message,
            });
            return;
        }
        response.status(500).json({
            success: false,
            message: "Failed to get offline downloads",
        });
    }
});
exports.getOfflineDownloads = getOfflineDownloads;
// Remove media from offline downloads
const removeFromOfflineDownloads = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { mediaId } = request.params;
        const userId = request.userId;
        if (!userId) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!mediaId || !mongoose_1.Types.ObjectId.isValid(mediaId)) {
            response.status(400).json({
                success: false,
                message: "Invalid media ID",
            });
            return;
        }
        yield media_service_1.mediaService.removeFromOfflineDownloads(userId, mediaId);
        response.status(200).json({
            success: true,
            message: "Media removed from offline downloads",
        });
    }
    catch (error) {
        console.error("Remove from offline downloads error:", error);
        if (error.message.includes("not found")) {
            response.status(404).json({
                success: false,
                message: error.message,
            });
            return;
        }
        response.status(500).json({
            success: false,
            message: "Failed to remove from offline downloads",
        });
    }
});
exports.removeFromOfflineDownloads = removeFromOfflineDownloads;
/**
 * Extract text from PDF buffer for moderation
 */
function extractTextFromPDF(pdfBuffer) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Dynamic import for pdf-parse (uses ES Module pdfjs-dist)
            const pdfParseModule = yield new Function('return import("pdf-parse")')();
            const { PDFParse } = pdfParseModule;
            // Create PDFParse instance
            const pdfParser = new PDFParse({ data: pdfBuffer });
            // Get text result
            const textResult = yield pdfParser.getText();
            // Clean up
            yield pdfParser.destroy();
            // Extract all text from pages
            let fullText = "";
            if (textResult.pages && textResult.pages.length > 0) {
                // Use per-page text if available
                fullText = textResult.pages
                    .map((pageData) => pageData.text || "")
                    .join("\n");
            }
            else if (textResult.text) {
                // Fallback: use full text
                fullText = textResult.text;
            }
            // Clean up text (remove excessive whitespace)
            fullText = fullText.replace(/\s+/g, " ").trim();
            // Limit text length for moderation (first 10000 characters should be enough)
            return fullText.substring(0, 10000);
        }
        catch (error) {
            logger_1.default.error("Failed to extract text from PDF", { error: error.message });
            throw new Error("Failed to extract text from PDF");
        }
    });
}
/**
 * Extract text from EPUB buffer for moderation
 * EPUB is a ZIP archive containing HTML/XHTML files
 * Note: For now, EPUB extraction is limited - we'll use basic moderation
 * TODO: Add proper EPUB parsing library (e.g., epub2 or jszip)
 */
function extractTextFromEPUB(epubBuffer) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            // Try to use jszip if available, otherwise fall back to basic extraction
            let JSZip;
            try {
                // Dynamic import with type assertion to handle optional dependency
                JSZip = yield Promise.resolve(`${"jszip"}`).then(s => __importStar(require(s))).catch(() => null);
                if (!JSZip) {
                    throw new Error("JSZip not available");
                }
            }
            catch (importError) {
                logger_1.default.warn("JSZip not available, EPUB text extraction will be limited");
                // Return empty string - will fall back to title/description moderation
                return "";
            }
            const zip = new JSZip.default();
            const zipData = yield zip.loadAsync(epubBuffer);
            let fullText = "";
            // EPUB structure: content is usually in OEBPS/ or OPS/ folder
            // Look for .html, .xhtml, or .htm files
            const contentFiles = [];
            zipData.forEach((relativePath, file) => {
                if (!file.dir &&
                    (relativePath.endsWith(".html") ||
                        relativePath.endsWith(".xhtml") ||
                        relativePath.endsWith(".htm")) &&
                    !relativePath.includes("META-INF") &&
                    !relativePath.includes("mimetype")) {
                    contentFiles.push(relativePath);
                }
            });
            // Extract text from content files (limit to first 10 files)
            for (const filePath of contentFiles.slice(0, 10)) {
                try {
                    const fileContent = yield ((_a = zipData.file(filePath)) === null || _a === void 0 ? void 0 : _a.async("string"));
                    if (fileContent) {
                        // Remove HTML tags and extract text
                        const textContent = fileContent
                            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "") // Remove scripts
                            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "") // Remove styles
                            .replace(/<[^>]+>/g, " ") // Remove HTML tags
                            .replace(/\s+/g, " ") // Normalize whitespace
                            .trim();
                        if (textContent) {
                            fullText += textContent + "\n";
                        }
                    }
                }
                catch (error) {
                    logger_1.default.warn(`Failed to extract text from EPUB file: ${filePath}`, error);
                }
            }
            // Clean up text
            fullText = fullText.trim();
            if (!fullText) {
                logger_1.default.warn("No text extracted from EPUB, will use basic moderation");
                return "";
            }
            // Limit text length for moderation (first 10000 characters should be enough)
            return fullText.substring(0, 10000);
        }
        catch (error) {
            logger_1.default.error("Failed to extract text from EPUB", { error: error.message });
            // Return empty string - will fall back to title/description moderation
            return "";
        }
    });
}
/**
 * Pre-upload content verification
 * Processes files in memory, extracts audio/frames, transcribes, and runs moderation
 * Returns moderation result before upload to storage
 */
function verifyContentBeforeUpload(file, fileMimeType, contentType, title, description) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.default.info("Starting pre-upload content verification", {
            contentType,
            fileSize: file.length,
            fileMimeType,
        });
        let transcript = "";
        let videoFrames = [];
        // For video content, extract audio and frames
        if (contentType === "videos" && fileMimeType.startsWith("video")) {
            try {
                logger_1.default.info("Processing video: extracting audio and frames");
                // Extract audio for transcription
                const audioResult = yield mediaProcessing_service_1.mediaProcessingService.extractAudio(file, fileMimeType);
                // Transcribe audio
                const transcriptionResult = yield transcription_service_1.transcriptionService.transcribeAudio(audioResult.audioBuffer, "audio/mp3");
                transcript = transcriptionResult.transcript;
                logger_1.default.info("Video transcription completed", {
                    transcriptLength: transcript.length,
                });
                // Extract video frames
                const framesResult = yield mediaProcessing_service_1.mediaProcessingService.extractVideoFrames(file, fileMimeType, 3 // Extract 3 key frames
                );
                videoFrames = framesResult.frames;
                logger_1.default.info("Video frames extracted", { frameCount: videoFrames.length });
            }
            catch (error) {
                logger_1.default.warn("Media processing failed, continuing with basic moderation:", error);
                // Continue with basic moderation (title/description only)
            }
        }
        // For audio/music content, transcribe
        if ((contentType === "music" || contentType === "audio") &&
            fileMimeType.startsWith("audio")) {
            try {
                logger_1.default.info("Processing audio: transcribing");
                const transcriptionResult = yield transcription_service_1.transcriptionService.transcribeAudio(file, fileMimeType);
                transcript = transcriptionResult.transcript;
                logger_1.default.info("Audio transcription completed", {
                    transcriptLength: transcript.length,
                });
            }
            catch (error) {
                logger_1.default.warn("Transcription failed, continuing with basic moderation:", error);
                // Continue with basic moderation (title/description only)
            }
        }
        // For books/ebooks, extract text from PDF or EPUB
        if (contentType === "books") {
            try {
                logger_1.default.info("Processing book: extracting text");
                if (fileMimeType === "application/pdf") {
                    // Extract text from PDF
                    const pdfText = yield extractTextFromPDF(file);
                    transcript = pdfText;
                    logger_1.default.info("PDF text extraction completed", {
                        textLength: transcript.length,
                    });
                }
                else if (fileMimeType === "application/epub+zip") {
                    // Extract text from EPUB
                    const epubText = yield extractTextFromEPUB(file);
                    transcript = epubText;
                    logger_1.default.info("EPUB text extraction completed", {
                        textLength: transcript.length,
                    });
                }
                else {
                    logger_1.default.warn("Unsupported book file type, continuing with basic moderation");
                }
            }
            catch (error) {
                logger_1.default.warn("Book text extraction failed, continuing with basic moderation:", error);
                // Continue with basic moderation (title/description only)
            }
        }
        // Run moderation
        logger_1.default.info("Running AI moderation");
        const moderationResult = yield contentModeration_service_1.contentModerationService.moderateContent({
            transcript: transcript || undefined,
            videoFrames: videoFrames.length > 0 ? videoFrames : undefined,
            title,
            description,
            contentType,
        });
        logger_1.default.info("Pre-upload verification completed", {
            isApproved: moderationResult.isApproved,
            requiresReview: moderationResult.requiresReview,
            confidence: moderationResult.confidence,
        });
        return {
            isApproved: moderationResult.isApproved,
            moderationResult,
            transcript: transcript || undefined,
            videoFrames: videoFrames.length > 0 ? videoFrames : undefined,
        };
    });
}
/**
 * Generate AI-powered description for media creation
 * This endpoint helps users generate engaging descriptions for their media content
 */
/**
 * Async function to moderate content after upload
 * This runs in the background and updates the media's moderation status
 * NOTE: This is kept for backward compatibility but is no longer used for new uploads
 */
function moderateContentAsync(mediaId, mediaData) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            logger_1.default.info("Starting content moderation", { mediaId });
            let transcript = "";
            let videoFrames = [];
            // For video content, extract audio and frames
            if (mediaData.contentType === "videos" && mediaData.fileMimeType.startsWith("video")) {
                try {
                    // Extract audio for transcription
                    const audioResult = yield mediaProcessing_service_1.mediaProcessingService.extractAudio(mediaData.file, mediaData.fileMimeType);
                    // Transcribe audio
                    const transcriptionResult = yield transcription_service_1.transcriptionService.transcribeAudio(audioResult.audioBuffer, "audio/mp3");
                    transcript = transcriptionResult.transcript;
                    // Extract video frames
                    const framesResult = yield mediaProcessing_service_1.mediaProcessingService.extractVideoFrames(mediaData.file, mediaData.fileMimeType, 3 // Extract 3 key frames
                    );
                    videoFrames = framesResult.frames;
                }
                catch (error) {
                    logger_1.default.warn("Media processing failed, continuing with basic moderation:", error);
                }
            }
            // For audio/music content, transcribe
            if ((mediaData.contentType === "music" || mediaData.contentType === "audio") &&
                mediaData.fileMimeType.startsWith("audio")) {
                try {
                    const transcriptionResult = yield transcription_service_1.transcriptionService.transcribeAudio(mediaData.file, mediaData.fileMimeType);
                    transcript = transcriptionResult.transcript;
                }
                catch (error) {
                    logger_1.default.warn("Transcription failed, continuing with basic moderation:", error);
                }
            }
            // Run moderation
            const moderationResult = yield contentModeration_service_1.contentModerationService.moderateContent({
                transcript: transcript || undefined,
                videoFrames: videoFrames.length > 0 ? videoFrames : undefined,
                title: mediaData.title,
                description: mediaData.description,
                contentType: mediaData.contentType,
            });
            // Update media with moderation result
            const updateData = {
                moderationStatus: moderationResult.isApproved
                    ? "approved"
                    : moderationResult.requiresReview
                        ? "under_review"
                        : "rejected",
                moderationResult: Object.assign(Object.assign({}, moderationResult), { moderatedAt: new Date() }),
                isHidden: !moderationResult.isApproved && !moderationResult.requiresReview,
            };
            const media = yield media_model_1.Media.findByIdAndUpdate(mediaId, updateData).populate("uploadedBy", "firstName lastName email");
            if (!media) {
                logger_1.default.error("Media not found after moderation", { mediaId });
                return;
            }
            // Get report count
            const reportCount = yield mediaReport_model_1.MediaReport.countDocuments({
                mediaId: new mongoose_1.Types.ObjectId(mediaId),
                status: "pending",
            });
            // Send notifications
            try {
                // Notify admins if content is rejected or needs review
                if (!moderationResult.isApproved || moderationResult.requiresReview || reportCount > 0) {
                    const admins = yield user_model_1.User.find({ role: "admin" }).select("email");
                    const adminEmails = admins.map(admin => admin.email).filter(Boolean);
                    if (adminEmails.length > 0) {
                        yield resendEmail_service_1.default.sendAdminModerationAlert(adminEmails, media.title, media.contentType, ((_a = media.uploadedBy) === null || _a === void 0 ? void 0 : _a.email) || "Unknown", moderationResult, reportCount);
                    }
                    // Also send in-app notification to admins
                    for (const admin of admins) {
                        yield notification_service_1.NotificationService.createNotification({
                            userId: admin._id.toString(),
                            type: "moderation_alert",
                            title: "Content Moderation Alert",
                            message: `Content "${media.title}" requires review`,
                            metadata: {
                                mediaId: mediaId,
                                contentType: media.contentType,
                                moderationStatus: updateData.moderationStatus,
                                reportCount,
                            },
                            priority: "high",
                            relatedId: mediaId,
                        });
                    }
                }
                // Notify user if content is rejected
                if (!moderationResult.isApproved && !moderationResult.requiresReview) {
                    const uploader = media.uploadedBy;
                    if (uploader && uploader.email) {
                        yield resendEmail_service_1.default.sendContentRemovedEmail(uploader.email, uploader.firstName || "User", media.title, moderationResult.reason || "Content violates community guidelines", moderationResult.flags || []);
                        // Send in-app notification
                        yield notification_service_1.NotificationService.createNotification({
                            userId: uploader._id.toString(),
                            type: "content_removed",
                            title: "Content Removed",
                            message: `Your content "${media.title}" has been removed`,
                            metadata: {
                                mediaId: mediaId,
                                reason: moderationResult.reason,
                                flags: moderationResult.flags,
                            },
                            priority: "high",
                            relatedId: mediaId,
                        });
                    }
                }
            }
            catch (emailError) {
                logger_1.default.error("Failed to send moderation notifications:", emailError);
                // Don't fail moderation if email fails
            }
            logger_1.default.info("Content moderation completed", {
                mediaId,
                isApproved: moderationResult.isApproved,
                requiresReview: moderationResult.requiresReview,
            });
        }
        catch (error) {
            logger_1.default.error("Content moderation error:", error);
            // On error, set to under_review for manual review
            yield media_model_1.Media.findByIdAndUpdate(mediaId, {
                moderationStatus: "under_review",
                isHidden: false,
            });
        }
    });
}
const generateMediaDescription = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { title, contentType, category, topics } = request.body;
        // Validate required fields
        if (!title || typeof title !== "string" || title.trim().length === 0) {
            response.status(400).json({
                success: false,
                message: "Title is required",
            });
            return;
        }
        if (!contentType ||
            !["music", "videos", "books", "live", "audio", "sermon", "devotional", "ebook", "podcast"].includes(contentType)) {
            response.status(400).json({
                success: false,
                message: "Valid contentType is required (music, videos, books, live, audio, sermon, devotional, ebook, podcast)",
            });
            return;
        }
        // Get user info if authenticated (optional for this endpoint)
        let authorInfo = undefined;
        if (request.userId) {
            try {
                const user = yield user_model_1.User.findById(request.userId).select("firstName lastName username avatar");
                if (user) {
                    authorInfo = {
                        _id: user._id.toString(),
                        firstName: user.firstName || "",
                        lastName: user.lastName || "",
                        fullName: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown Author",
                        avatar: user.avatar || undefined,
                    };
                }
            }
            catch (userError) {
                // Non-blocking - continue without author info
                console.log("Could not fetch user info for AI description:", userError);
            }
        }
        // Prepare media content object for AI service
        const mediaContent = {
            _id: "temp-id", // Not needed for generation
            title: title.trim(),
            description: undefined, // No existing description
            contentType: contentType,
            category: category || undefined,
            topics: Array.isArray(topics) ? topics : typeof topics === "string" ? [topics] : undefined,
            authorInfo: authorInfo,
        };
        // Generate description using AI service
        const aiResponse = yield aiContentDescription_service_1.aiContentDescriptionService.generateContentDescription(mediaContent);
        if (!aiResponse.success) {
            // Return fallback description if AI fails
            response.status(200).json({
                success: true,
                description: aiResponse.description || aiContentDescription_service_1.aiContentDescriptionService.getFallbackDescription(mediaContent),
                bibleVerses: aiResponse.bibleVerses || [],
                message: "Description generated (using fallback)",
            });
            return;
        }
        // Return successful AI-generated description
        response.status(200).json({
            success: true,
            description: aiResponse.description,
            bibleVerses: aiResponse.bibleVerses || [],
            enhancedDescription: aiResponse.enhancedDescription,
            message: "Description generated successfully",
        });
    }
    catch (error) {
        console.error("Generate media description error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to generate description",
            error: error.message,
        });
    }
});
exports.generateMediaDescription = generateMediaDescription;
