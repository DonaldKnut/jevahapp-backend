"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enqueueMediaPostUpload = enqueueMediaPostUpload;
exports.enqueueAnalyticsEvent = enqueueAnalyticsEvent;
const logger_1 = __importDefault(require("../utils/logger"));
const queues_1 = require("./queues");
/**
 * Enqueue helpers (never throw).
 * These are intentionally "fire-and-forget" so API requests don't block.
 */
function enqueueMediaPostUpload(params) {
    const { mediaId, userId, contentType, fileUrl, requestId } = params;
    // Only enqueue when we have something to work on
    if (!fileUrl)
        return;
    const jobs = [];
    if (contentType === "videos") {
        jobs.push({
            name: "transcode",
            data: { type: "transcode", mediaId, inputUrl: fileUrl },
        });
    }
    if (contentType === "music") {
        jobs.push({
            name: "waveform",
            data: { type: "waveform", mediaId, inputUrl: fileUrl },
        });
    }
    for (const j of jobs) {
        queues_1.mediaProcessingQueue
            .add(j.name, j.data, {
            attempts: 3,
            backoff: { type: "exponential", delay: 1000 },
            removeOnComplete: 1000,
            removeOnFail: 1000,
        })
            .catch(err => {
            logger_1.default.warn("Failed to enqueue media-processing job", {
                requestId,
                mediaId,
                userId,
                job: j.name,
                error: err === null || err === void 0 ? void 0 : err.message,
            });
        });
    }
}
function enqueueAnalyticsEvent(params) {
    const { name, payload, requestId } = params;
    const job = {
        type: "event",
        name,
        payload,
    };
    queues_1.analyticsQueue
        .add("event", job, {
        attempts: 5,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: 5000,
        removeOnFail: 5000,
    })
        .catch(err => {
        logger_1.default.warn("Failed to enqueue analytics job", {
            requestId,
            name,
            error: err === null || err === void 0 ? void 0 : err.message,
        });
    });
}
