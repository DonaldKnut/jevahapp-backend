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
const QUALIFY_DURATION_MS = 3000; // 3s
const QUALIFY_PROGRESS = 25; // 25%
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
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
            if (!mongoose_1.Types.ObjectId.isValid(contentId)) {
                throw new Error("Invalid content ID");
            }
            const exists = yield verifyContentExists(contentId, contentType);
            if (!exists)
                throw new Error("Content not found");
            const qualifies = isComplete ||
                durationMs >= QUALIFY_DURATION_MS ||
                progressPct >= QUALIFY_PROGRESS;
            const now = new Date();
            const windowStart = new Date(now.getTime() - DEDUPE_WINDOW_MS);
            let hasViewed = false;
            let shouldIncrement = false;
            // We only track per-user views for dedupe if we have a userId
            if (userId && mongoose_1.Types.ObjectId.isValid(userId)) {
                const existing = yield mediaInteraction_model_1.MediaInteraction.findOne({
                    user: new mongoose_1.Types.ObjectId(userId),
                    media: new mongoose_1.Types.ObjectId(contentId),
                    interactionType: "view",
                    isRemoved: { $ne: true },
                });
                if (!existing) {
                    yield mediaInteraction_model_1.MediaInteraction.create({
                        user: new mongoose_1.Types.ObjectId(userId),
                        media: new mongoose_1.Types.ObjectId(contentId),
                        interactionType: "view",
                        lastInteraction: now,
                        count: qualifies ? 1 : 0,
                        interactions: [
                            { timestamp: now, duration: durationMs, isComplete, progressPct },
                        ],
                    });
                    hasViewed = qualifies;
                    shouldIncrement = qualifies;
                }
                else {
                    // Append interaction sample
                    yield mediaInteraction_model_1.MediaInteraction.findByIdAndUpdate(existing._id, {
                        $set: { lastInteraction: now },
                        $push: {
                            interactions: {
                                timestamp: now,
                                duration: durationMs,
                                isComplete,
                                progressPct,
                            },
                        },
                    });
                    hasViewed = existing.count > 0 || qualifies;
                    // Increment once per 24h if qualifies and last qualified older than window
                    if (qualifies) {
                        const lastQualified = existing.lastInteraction || existing.createdAt;
                        if (!lastQualified || lastQualified < windowStart) {
                            yield mediaInteraction_model_1.MediaInteraction.findByIdAndUpdate(existing._id, {
                                $inc: { count: 1 },
                                $set: { lastInteraction: now },
                            });
                            shouldIncrement = true;
                        }
                    }
                }
            }
            else {
                // Anonymous: coarse increment if qualifies (no strong dedupe)
                shouldIncrement = qualifies;
            }
            if (shouldIncrement) {
                yield incrementViewCount(contentId, contentType);
            }
            const viewCount = yield getViewCount(contentId, contentType);
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
