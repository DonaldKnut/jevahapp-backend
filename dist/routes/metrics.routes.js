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
const express_1 = require("express");
const cache_service_1 = __importDefault(require("../service/cache.service"));
const asyncHandler_1 = require("../utils/asyncHandler");
const queues_1 = require("../queues/queues");
const router = (0, express_1.Router)();
/**
 * Basic metrics endpoint (lightweight).
 * Intended for internal monitoring, not public exposure.
 */
router.get("/", (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const mem = process.memoryUsage();
    const stats = yield cache_service_1.default.getStats();
    let queues = undefined;
    try {
        const [analyticsCounts, mediaCounts] = yield Promise.all([
            queues_1.analyticsQueue.getJobCounts("waiting", "active", "delayed", "failed"),
            queues_1.mediaProcessingQueue.getJobCounts("waiting", "active", "delayed", "failed"),
        ]);
        queues = {
            analytics: analyticsCounts,
            mediaProcessing: mediaCounts,
        };
    }
    catch (_a) {
        queues = { error: "Queue stats unavailable" };
    }
    res.status(200).json({
        success: true,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        requestId: req.requestId,
        process: {
            rssMB: Math.round(mem.rss / 1024 / 1024),
            heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
            heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
            externalMB: Math.round(mem.external / 1024 / 1024),
        },
        redisCache: stats,
        queues,
    });
})));
exports.default = router;
