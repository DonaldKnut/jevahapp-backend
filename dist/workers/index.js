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
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const bullmq_1 = require("bullmq");
const child_process_1 = require("child_process");
const util_1 = require("util");
const logger_1 = __importDefault(require("../utils/logger"));
const queueConnection_1 = require("../queues/queueConnection");
const queues_1 = require("../queues/queues");
const bootstrap_1 = require("./bootstrap");
const analyticsEvent_model_1 = require("../models/analyticsEvent.model");
const media_model_1 = require("../models/media.model");
/**
 * BullMQ workers run in a separate process from the API server.
 * This prevents CPU-heavy or slow tasks from blocking request handling.
 *
 * Start locally:
 * - API:    npm run dev
 * - Worker: npm run worker:dev
 */
const connection = (0, queueConnection_1.createBullConnection)();
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
function hasBinary(cmd) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield execFileAsync(cmd, ["-version"]);
            return true;
        }
        catch (_a) {
            return false;
        }
    });
}
function markMediaProcessing(mediaId, data) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield media_model_1.Media.findByIdAndUpdate(mediaId, {
                processing: {
                    status: data.status,
                    jobType: data.jobType,
                    updatedAt: new Date(),
                    error: data.error,
                },
            });
        }
        catch (err) {
            logger_1.default.warn("Failed to update media processing state", {
                mediaId,
                status: data.status,
                error: err === null || err === void 0 ? void 0 : err.message,
            });
        }
    });
}
(() => __awaiter(void 0, void 0, void 0, function* () {
    // Workers need DB access for analytics aggregation / media status updates
    yield (0, bootstrap_1.connectWorkerMongo)();
    const ffprobeAvailable = yield hasBinary("ffprobe");
    const mediaWorker = new bullmq_1.Worker(queues_1.QUEUE_NAMES.MEDIA_PROCESSING, (job) => __awaiter(void 0, void 0, void 0, function* () {
        const jobType = job.data.type;
        logger_1.default.info("media-processing job started", {
            jobId: job.id,
            name: job.name,
            data: job.data,
        });
        yield markMediaProcessing(job.data.mediaId, {
            status: "processing",
            jobType,
        });
        if (job.data.type === "waveform") {
            // "Real" work: extract duration via ffprobe if available.
            // Waveform generation itself is typically done by ffmpeg and stored to CDN/S3;
            // this project doesn't yet have a destination for waveform assets, so we
            // start with metadata extraction (still CPU/IO) and keep a TODO.
            if (!ffprobeAvailable) {
                logger_1.default.warn("ffprobe not available; skipping duration extraction", {
                    mediaId: job.data.mediaId,
                });
            }
            else {
                try {
                    // Note: ffprobe can read HTTP URLs, but some signed URLs may block.
                    const { stdout } = yield execFileAsync("ffprobe", [
                        "-v",
                        "error",
                        "-show_entries",
                        "format=duration",
                        "-of",
                        "default=noprint_wrappers=1:nokey=1",
                        job.data.inputUrl,
                    ]);
                    const durationSeconds = Math.round(parseFloat(String(stdout).trim()));
                    if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
                        yield media_model_1.Media.findByIdAndUpdate(job.data.mediaId, {
                            $set: { duration: durationSeconds },
                        });
                    }
                }
                catch (err) {
                    logger_1.default.warn("ffprobe duration extraction failed", {
                        mediaId: job.data.mediaId,
                        error: err === null || err === void 0 ? void 0 : err.message,
                    });
                }
            }
            // TODO: waveform generation + store (Cloudinary/R2) and save waveform URL.
        }
        if (job.data.type === "transcode") {
            // TODO: hook into Mux/FFmpeg pipeline for transcoding.
            // For now, we only track processing state so ops can see it's queued/processed.
        }
        yield markMediaProcessing(job.data.mediaId, {
            status: "completed",
            jobType,
        });
        logger_1.default.info("media-processing job completed", {
            jobId: job.id,
            name: job.name,
        });
        return { ok: true };
    }), {
        connection,
        concurrency: parseInt(process.env.WORKER_CONCURRENCY || "4", 10),
    });
    const analyticsWorker = new bullmq_1.Worker(queues_1.QUEUE_NAMES.ANALYTICS, (job) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        logger_1.default.info("analytics job started", {
            jobId: job.id,
            name: job.name,
            data: job.data,
        });
        if (job.data.type === "event") {
            // Persist event (TTL prevents unbounded growth)
            yield analyticsEvent_model_1.AnalyticsEvent.create({
                name: job.data.name,
                payload: job.data.payload,
                requestId: (_a = job.data.payload) === null || _a === void 0 ? void 0 : _a.requestId,
                createdAt: new Date(),
            });
            // Lightweight aggregation updates to keep "total*" fields in sync for trending pipelines
            const p = job.data.payload || {};
            if (job.data.name === "media_interaction" && p.mediaId) {
                if (p.interactionType === "view") {
                    yield media_model_1.Media.findByIdAndUpdate(p.mediaId, { $inc: { totalViews: 1 } });
                }
                if (p.interactionType === "download") {
                    yield media_model_1.Media.findByIdAndUpdate(p.mediaId, { $inc: { totalDownloads: 1 } });
                }
            }
            if (job.data.name === "content_like_toggled" && p.contentType === "media" && p.contentId) {
                // Store canonical likeCount
                if (typeof p.likeCount === "number") {
                    yield media_model_1.Media.findByIdAndUpdate(p.contentId, { $set: { totalLikes: p.likeCount } });
                }
            }
            if (job.data.name === "content_shared" && p.contentType === "media" && p.contentId) {
                if (typeof p.shareCount === "number") {
                    yield media_model_1.Media.findByIdAndUpdate(p.contentId, { $set: { totalShares: p.shareCount } });
                }
            }
        }
        logger_1.default.info("analytics job completed", {
            jobId: job.id,
            name: job.name,
        });
        return { ok: true };
    }), {
        connection,
        concurrency: parseInt(process.env.WORKER_CONCURRENCY || "4", 10),
    });
    for (const w of [mediaWorker, analyticsWorker]) {
        w.on("failed", (job, err) => {
            logger_1.default.error("worker job failed", {
                queue: w.name,
                jobId: job === null || job === void 0 ? void 0 : job.id,
                error: err.message,
                stack: err.stack,
            });
        });
    }
    logger_1.default.info("✅ BullMQ workers started", {
        queues: [queues_1.QUEUE_NAMES.MEDIA_PROCESSING, queues_1.QUEUE_NAMES.ANALYTICS],
        ffprobeAvailable,
    });
}))().catch((err) => {
    logger_1.default.error("Worker bootstrap failed", { error: err === null || err === void 0 ? void 0 : err.message, stack: err === null || err === void 0 ? void 0 : err.stack });
    process.exit(1);
});
