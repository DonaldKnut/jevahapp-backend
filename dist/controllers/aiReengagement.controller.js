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
exports.getUserReEngagementStatus = exports.trackUserReturn = exports.triggerReEngagement = exports.getReEngagementAnalytics = void 0;
const aiReengagement_service_1 = __importDefault(require("../service/aiReengagement.service"));
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Get re-engagement analytics (Admin only)
 */
const getReEngagementAnalytics = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const analytics = yield aiReengagement_service_1.default.getReEngagementAnalytics();
        response.status(200).json({
            success: true,
            data: analytics,
        });
    }
    catch (error) {
        logger_1.default.error("Get re-engagement analytics error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to get re-engagement analytics",
        });
    }
});
exports.getReEngagementAnalytics = getReEngagementAnalytics;
/**
 * Manually trigger re-engagement for a user (Admin only)
 */
const triggerReEngagement = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = request.params;
        if (!userId) {
            response.status(400).json({
                success: false,
                message: "User ID is required",
            });
            return;
        }
        yield aiReengagement_service_1.default.trackUserSignout(userId);
        response.status(200).json({
            success: true,
            message: "Re-engagement campaign triggered successfully",
        });
    }
    catch (error) {
        logger_1.default.error("Trigger re-engagement error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to trigger re-engagement",
        });
    }
});
exports.triggerReEngagement = triggerReEngagement;
/**
 * Track user return manually (for testing)
 */
const trackUserReturn = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = request.userId;
        if (!userId) {
            response.status(401).json({
                success: false,
                message: "User ID not found",
            });
            return;
        }
        yield aiReengagement_service_1.default.trackUserReturn(userId);
        response.status(200).json({
            success: true,
            message: "User return tracked successfully",
        });
    }
    catch (error) {
        logger_1.default.error("Track user return error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to track user return",
        });
    }
});
exports.trackUserReturn = trackUserReturn;
/**
 * Get user's re-engagement status
 */
const getUserReEngagementStatus = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = request.userId;
        // This would typically come from a separate re-engagement campaigns collection
        // For now, we'll return basic info from user model
        const user = yield Promise.resolve().then(() => __importStar(require("../models/user.model"))).then(m => m.User.findById(userId));
        if (!user) {
            response.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }
        const status = {
            lastSignOutAt: user.lastSignOutAt,
            lastReturnAt: user.lastReturnAt,
            totalSessions: user.totalSessions,
            returnCount: user.returnCount,
            hasActiveReEngagement: user.lastSignOutAt &&
                (!user.lastReturnAt || user.lastSignOutAt > user.lastReturnAt),
        };
        response.status(200).json({
            success: true,
            data: status,
        });
    }
    catch (error) {
        logger_1.default.error("Get user re-engagement status error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to get re-engagement status",
        });
    }
});
exports.getUserReEngagementStatus = getUserReEngagementStatus;
