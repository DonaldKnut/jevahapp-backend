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
const mongoose_1 = require("mongoose");
const media_model_1 = require("../models/media.model");
const devotional_model_1 = require("../models/devotional.model");
const mediaInteraction_model_1 = require("../models/mediaInteraction.model");
const logger_1 = __importDefault(require("../utils/logger"));
const QUALIFY_DURATION_MS = 3000; // 3s for video/audio
const QUALIFY_PROGRESS = 25; // 25% for video/audio
const EBOOK_QUALIFY_DURATION_MS = 5000; // 5s for ebook/PDF
function verifyContentExists(contentId, contentType) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            switch (contentType) {
                case "media":
                case "ebook":
                case "podcast":
                case "merch":
                    return !!(yield media_model_1.Media.findById(contentId).select("_id"));
                case "devotional":
                    return !!(yield devotional_model_1.Devotional.findById(contentId).select("_id"));
                default:
                    return false;
            }
        }
        catch (e) {
            return false;
        }
    });
}
function incrementViewCount(contentId, contentType, session) {
    return __awaiter(this, void 0, void 0, function* () {
        if (contentType === "media" ||
            contentType === "ebook" ||
            contentType === "podcast" ||
            contentType === "merch") {
            yield media_model_1.Media.findByIdAndUpdate(contentId, { $inc: { viewCount: 1 } }, { session });
        }
        else if (contentType === "devotional") {
            yield devotional_model_1.Devotional.findByIdAndUpdate(contentId, { $inc: { viewCount: 1 } }, { session });
        }
    });
}
function getViewCount(contentId, contentType) {
    return __awaiter(this, void 0, void 0, function* () {
        if (contentType === "media" ||
            contentType === "ebook" ||
            contentType === "podcast" ||
            contentType === "merch") {
            const m = yield media_model_1.Media.findById(contentId).select("viewCount");
            return (m === null || m === void 0 ? void 0 : m.viewCount) || 0;
        }
        else if (contentType === "devotional") {
            const d = yield devotional_model_1.Devotional.findById(contentId).select("viewCount");
            return (d === null || d === void 0 ? void 0 : d.viewCount) || 0;
        }
        return 0;
    });
}
exports.default = {
    recordView(input) {
        return __awaiter(this, void 0, void 0, function* () {
            const { userId, contentId, contentType, durationMs = 0, progressPct = 0, isComplete = false, } = input;
            // Require authentication - views are user-scoped
            if (!userId || !mongoose_1.Types.ObjectId.isValid(userId)) {
                throw new Error("Authentication required for view tracking");
            }
            if (!mongoose_1.Types.ObjectId.isValid(contentId)) {
                throw new Error("Invalid content ID");
            }
            const exists = yield verifyContentExists(contentId, contentType);
            if (!exists)
                throw new Error("Content not found");
            // Determine qualification thresholds based on content type
            const qualifies = isComplete ||
                durationMs >= (contentType === "ebook" ? EBOOK_QUALIFY_DURATION_MS : QUALIFY_DURATION_MS) ||
                progressPct >= QUALIFY_PROGRESS;
            const now = new Date();
            const userIdObj = new mongoose_1.Types.ObjectId(userId);
            const contentIdObj = new mongoose_1.Types.ObjectId(contentId);
            // Check if user already viewed this content (ONE view per user per content)
            const existingView = yield mediaInteraction_model_1.MediaInteraction.findOne({
                user: userIdObj,
                media: contentIdObj,
                interactionType: "view",
                isRemoved: { $ne: true },
            });
            let hasViewed = false;
            let shouldIncrement = false;
            if (!existingView) {
                // First view - create record and increment count if qualifies
                if (qualifies) {
                    try {
                        // Create view record with engagement metrics
                        yield mediaInteraction_model_1.MediaInteraction.create({
                            user: userIdObj,
                            media: contentIdObj,
                            interactionType: "view",
                            lastInteraction: now,
                            count: 1, // Track number of times this user viewed (for analytics)
                            interactions: [
                                {
                                    timestamp: now,
                                    duration: durationMs,
                                    isComplete,
                                    progressPct
                                },
                            ],
                        });
                        // Increment content view count (one-time per user)
                        yield incrementViewCount(contentId, contentType);
                        hasViewed = true;
                    }
                    catch (error) {
                        // Handle race condition - view might have been created by concurrent request
                        if (error.code === 11000 || error.message.includes("duplicate")) {
                            // View already exists - fetch it and update engagement metrics only
                            const existing = yield mediaInteraction_model_1.MediaInteraction.findOne({
                                user: userIdObj,
                                media: contentIdObj,
                                interactionType: "view",
                                isRemoved: { $ne: true },
                            });
                            if (existing) {
                                hasViewed = true;
                                // Update engagement metrics but don't increment count
                                yield mediaInteraction_model_1.MediaInteraction.findByIdAndUpdate(existing._id, {
                                    $set: { lastInteraction: now },
                                    $inc: { count: 1 },
                                    $push: {
                                        interactions: {
                                            timestamp: now,
                                            duration: durationMs,
                                            isComplete,
                                            progressPct,
                                        },
                                    },
                                });
                            }
                            else {
                                // Re-throw if it's a different error
                                throw error;
                            }
                        }
                        else {
                            throw error;
                        }
                    }
                }
                else {
                    // View doesn't qualify yet - don't record or increment
                    // Frontend will call again when thresholds are met
                    const viewCount = yield getViewCount(contentId, contentType);
                    return { viewCount, hasViewed: false };
                }
            }
            else {
                // User already viewed - update engagement metrics but DON'T increment count
                hasViewed = true;
                // Get existing metrics to update to maximum values
                const existingInteractions = existingView.interactions || [];
                const maxDuration = Math.max(durationMs, ...existingInteractions.map((i) => i.duration || 0));
                const maxProgress = Math.max(progressPct, ...existingInteractions.map((i) => i.progressPct || 0));
                const wasComplete = existingInteractions.some((i) => i.isComplete) || isComplete;
                // Update engagement metrics (duration, progress, completion)
                yield mediaInteraction_model_1.MediaInteraction.findByIdAndUpdate(existingView._id, {
                    $set: {
                        lastInteraction: now,
                    },
                    $inc: { count: 1 }, // Increment user's personal view count (analytics)
                    $push: {
                        interactions: {
                            timestamp: now,
                            duration: durationMs,
                            isComplete,
                            progressPct,
                        },
                    },
                });
            }
            const viewCount = yield getViewCount(contentId, contentType);
            // Emit real-time update via socket
            try {
                const io = require("../socket/socketManager").getIO();
                if (io)
                    io.to(`content:${contentId}`).emit("view-updated", {
                        contentId,
                        viewCount,
                        timestamp: new Date().toISOString(),
                    });
            }
            catch (e) {
                logger_1.default.warn("Failed to emit view-updated", {
                    contentId,
                    error: e === null || e === void 0 ? void 0 : e.message,
                });
            }
            return { viewCount, hasViewed };
        });
    },
};
