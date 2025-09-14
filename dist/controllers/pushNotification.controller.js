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
exports.sendToAll = exports.sendToUsers = exports.cleanupInvalidTokens = exports.getStats = exports.sendTestNotification = exports.setEnabled = exports.updatePreferences = exports.unregisterDeviceToken = exports.registerDeviceToken = void 0;
const pushNotification_service_1 = __importDefault(require("../service/pushNotification.service"));
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Register a device token for push notifications
 */
const registerDeviceToken = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = request.userId;
        if (!userId) {
            response.status(401).json({
                success: false,
                message: "User ID not found",
            });
            return;
        }
        const { deviceToken } = request.body;
        if (!deviceToken) {
            response.status(400).json({
                success: false,
                message: "Device token is required",
            });
            return;
        }
        const success = yield pushNotification_service_1.default.registerDeviceToken(userId, deviceToken);
        if (success) {
            response.status(200).json({
                success: true,
                message: "Device token registered successfully",
            });
        }
        else {
            response.status(400).json({
                success: false,
                message: "Failed to register device token",
            });
        }
    }
    catch (error) {
        logger_1.default.error("Register device token error:", error);
        response.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
exports.registerDeviceToken = registerDeviceToken;
/**
 * Unregister a device token
 */
const unregisterDeviceToken = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = request.userId;
        if (!userId) {
            response.status(401).json({
                success: false,
                message: "User ID not found",
            });
            return;
        }
        const { deviceToken } = request.body;
        if (!deviceToken) {
            response.status(400).json({
                success: false,
                message: "Device token is required",
            });
            return;
        }
        const success = yield pushNotification_service_1.default.unregisterDeviceToken(userId, deviceToken);
        if (success) {
            response.status(200).json({
                success: true,
                message: "Device token unregistered successfully",
            });
        }
        else {
            response.status(400).json({
                success: false,
                message: "Failed to unregister device token",
            });
        }
    }
    catch (error) {
        logger_1.default.error("Unregister device token error:", error);
        response.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
exports.unregisterDeviceToken = unregisterDeviceToken;
/**
 * Update push notification preferences
 */
const updatePreferences = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = request.userId;
        if (!userId) {
            response.status(401).json({
                success: false,
                message: "User ID not found",
            });
            return;
        }
        const preferences = request.body;
        const success = yield pushNotification_service_1.default.updatePreferences(userId, preferences);
        if (success) {
            response.status(200).json({
                success: true,
                message: "Push notification preferences updated successfully",
            });
        }
        else {
            response.status(400).json({
                success: false,
                message: "Failed to update preferences",
            });
        }
    }
    catch (error) {
        logger_1.default.error("Update preferences error:", error);
        response.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
exports.updatePreferences = updatePreferences;
/**
 * Enable/disable push notifications
 */
const setEnabled = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = request.userId;
        if (!userId) {
            response.status(401).json({
                success: false,
                message: "User ID not found",
            });
            return;
        }
        const { enabled } = request.body;
        if (typeof enabled !== "boolean") {
            response.status(400).json({
                success: false,
                message: "Enabled status must be a boolean",
            });
            return;
        }
        const success = yield pushNotification_service_1.default.setEnabled(userId, enabled);
        if (success) {
            response.status(200).json({
                success: true,
                message: `Push notifications ${enabled ? "enabled" : "disabled"} successfully`,
            });
        }
        else {
            response.status(400).json({
                success: false,
                message: "Failed to update push notification status",
            });
        }
    }
    catch (error) {
        logger_1.default.error("Set enabled error:", error);
        response.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
exports.setEnabled = setEnabled;
/**
 * Send test push notification to current user
 */
const sendTestNotification = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = request.userId;
        if (!userId) {
            response.status(401).json({
                success: false,
                message: "User ID not found",
            });
            return;
        }
        const { title, body, data } = request.body;
        const notification = {
            title: title || "Test Notification",
            body: body || "This is a test push notification from Jevah App",
            data: data || { test: true },
            sound: "default",
            priority: "high",
        };
        const success = yield pushNotification_service_1.default.sendToUser(userId, notification);
        if (success) {
            response.status(200).json({
                success: true,
                message: "Test notification sent successfully",
            });
        }
        else {
            response.status(400).json({
                success: false,
                message: "Failed to send test notification",
            });
        }
    }
    catch (error) {
        logger_1.default.error("Send test notification error:", error);
        response.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
exports.sendTestNotification = sendTestNotification;
/**
 * Get push notification statistics (Admin only)
 */
const getStats = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const stats = yield pushNotification_service_1.default.getStats();
        response.status(200).json({
            success: true,
            data: stats,
        });
    }
    catch (error) {
        logger_1.default.error("Get stats error:", error);
        response.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
exports.getStats = getStats;
/**
 * Clean up invalid device tokens (Admin only)
 */
const cleanupInvalidTokens = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield pushNotification_service_1.default.cleanupInvalidTokens();
        response.status(200).json({
            success: true,
            message: "Invalid device tokens cleaned up successfully",
        });
    }
    catch (error) {
        logger_1.default.error("Cleanup invalid tokens error:", error);
        response.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
exports.cleanupInvalidTokens = cleanupInvalidTokens;
/**
 * Send push notification to specific users (Admin only)
 */
const sendToUsers = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userIds, notification } = request.body;
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            response.status(400).json({
                success: false,
                message: "User IDs array is required",
            });
            return;
        }
        if (!notification || !notification.title || !notification.body) {
            response.status(400).json({
                success: false,
                message: "Notification title and body are required",
            });
            return;
        }
        const result = yield pushNotification_service_1.default.sendToUsers(userIds, notification, notification.type);
        response.status(200).json({
            success: true,
            message: "Push notifications sent",
            data: result,
        });
    }
    catch (error) {
        logger_1.default.error("Send to users error:", error);
        response.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
exports.sendToUsers = sendToUsers;
/**
 * Send push notification to all users (Admin only)
 */
const sendToAll = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { notification } = request.body;
        if (!notification || !notification.title || !notification.body) {
            response.status(400).json({
                success: false,
                message: "Notification title and body are required",
            });
            return;
        }
        const result = yield pushNotification_service_1.default.sendToAll(notification, notification.type);
        response.status(200).json({
            success: true,
            message: "Push notifications sent to all users",
            data: result,
        });
    }
    catch (error) {
        logger_1.default.error("Send to all error:", error);
        response.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
exports.sendToAll = sendToAll;
