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
exports.getCreatorAnalytics = exports.getMediaAnalytics = void 0;
const mediaAnalytics_service_1 = __importDefault(require("../service/mediaAnalytics.service"));
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Get detailed analytics for a specific media item
 * Similar to Twitter/X post analytics - shows views, likes, shares, engagement rate, etc.
 */
const getMediaAnalytics = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
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
        if (!mediaId) {
            response.status(400).json({
                success: false,
                message: "Media ID is required",
            });
            return;
        }
        // Parse optional time range from query params
        const startDate = request.query.startDate
            ? new Date(request.query.startDate)
            : undefined;
        const endDate = request.query.endDate
            ? new Date(request.query.endDate)
            : undefined;
        const timeRange = startDate && endDate
            ? { startDate, endDate }
            : undefined;
        const analytics = yield mediaAnalytics_service_1.default.getMediaAnalytics(mediaId, userId, timeRange);
        response.status(200).json({
            success: true,
            data: analytics,
        });
    }
    catch (error) {
        logger_1.default.error("Get media analytics error:", error);
        if (error.message === "Media not found") {
            response.status(404).json({
                success: false,
                message: "Media not found",
            });
            return;
        }
        if (error.message.includes("Unauthorized")) {
            response.status(403).json({
                success: false,
                message: error.message,
            });
            return;
        }
        response.status(500).json({
            success: false,
            message: "Failed to retrieve media analytics",
            error: error.message,
        });
    }
});
exports.getMediaAnalytics = getMediaAnalytics;
/**
 * Get comprehensive analytics for all media by a creator
 * Similar to Twitter/X creator analytics dashboard
 */
const getCreatorAnalytics = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = request.userId;
        if (!userId) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        // Parse optional time range from query params
        const startDate = request.query.startDate
            ? new Date(request.query.startDate)
            : undefined;
        const endDate = request.query.endDate
            ? new Date(request.query.endDate)
            : undefined;
        const timeRange = startDate && endDate
            ? { startDate, endDate }
            : undefined;
        const analytics = yield mediaAnalytics_service_1.default.getCreatorAnalytics(userId, timeRange);
        response.status(200).json({
            success: true,
            data: analytics,
        });
    }
    catch (error) {
        logger_1.default.error("Get creator analytics error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to retrieve creator analytics",
            error: error.message,
        });
    }
});
exports.getCreatorAnalytics = getCreatorAnalytics;
