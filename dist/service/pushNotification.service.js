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
exports.PushNotificationService = void 0;
const expo_server_sdk_1 = require("expo-server-sdk");
const user_model_1 = require("../models/user.model");
const logger_1 = __importDefault(require("../utils/logger"));
class PushNotificationService {
    constructor() {
        this.expo = new expo_server_sdk_1.Expo({
            accessToken: process.env.EXPO_ACCESS_TOKEN,
            useFcmV1: true, // Use FCM v1 API for better reliability
        });
    }
    /**
     * Register a device token for a user
     */
    registerDeviceToken(userId, deviceToken) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                // Validate token format
                if (!expo_server_sdk_1.Expo.isExpoPushToken(deviceToken)) {
                    logger_1.default.error("Invalid Expo push token format", { deviceToken });
                    return false;
                }
                const user = yield user_model_1.User.findById(userId);
                if (!user) {
                    logger_1.default.error("User not found for device token registration", {
                        userId,
                    });
                    return false;
                }
                // Initialize push notifications if not exists
                if (!user.pushNotifications) {
                    user.pushNotifications = {
                        enabled: true,
                        deviceTokens: [],
                        preferences: {
                            newFollowers: true,
                            mediaLikes: true,
                            mediaComments: true,
                            mediaShares: true,
                            merchPurchases: true,
                            songDownloads: true,
                            subscriptionUpdates: true,
                            securityAlerts: true,
                            liveStreams: true,
                            newMessages: true,
                        },
                    };
                }
                // Add token if not already present
                if (!((_a = user.pushNotifications.deviceTokens) === null || _a === void 0 ? void 0 : _a.includes(deviceToken))) {
                    user.pushNotifications.deviceTokens =
                        user.pushNotifications.deviceTokens || [];
                    user.pushNotifications.deviceTokens.push(deviceToken);
                    yield user.save();
                    logger_1.default.info("Device token registered successfully", {
                        userId,
                        deviceToken: deviceToken.substring(0, 20) + "...",
                    });
                }
                return true;
            }
            catch (error) {
                logger_1.default.error("Failed to register device token", {
                    userId,
                    error: error.message,
                });
                return false;
            }
        });
    }
    /**
     * Unregister a device token for a user
     */
    unregisterDeviceToken(userId, deviceToken) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const user = yield user_model_1.User.findById(userId);
                if (!user || !((_a = user.pushNotifications) === null || _a === void 0 ? void 0 : _a.deviceTokens)) {
                    return false;
                }
                // Remove token from array
                user.pushNotifications.deviceTokens =
                    user.pushNotifications.deviceTokens.filter((token) => token !== deviceToken);
                yield user.save();
                logger_1.default.info("Device token unregistered successfully", {
                    userId,
                    deviceToken: deviceToken.substring(0, 20) + "...",
                });
                return true;
            }
            catch (error) {
                logger_1.default.error("Failed to unregister device token", {
                    userId,
                    error: error.message,
                });
                return false;
            }
        });
    }
    /**
     * Update push notification preferences for a user
     */
    updatePreferences(userId, preferences) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const user = yield user_model_1.User.findById(userId);
                if (!user) {
                    return false;
                }
                // Initialize push notifications if not exists
                if (!user.pushNotifications) {
                    user.pushNotifications = {
                        enabled: true,
                        deviceTokens: [],
                        preferences: {},
                    };
                }
                // Update preferences
                user.pushNotifications.preferences = Object.assign(Object.assign({}, user.pushNotifications.preferences), preferences);
                yield user.save();
                logger_1.default.info("Push notification preferences updated", {
                    userId,
                    preferences,
                });
                return true;
            }
            catch (error) {
                logger_1.default.error("Failed to update push notification preferences", {
                    userId,
                    error: error.message,
                });
                return false;
            }
        });
    }
    /**
     * Enable/disable push notifications for a user
     */
    setEnabled(userId, enabled) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const user = yield user_model_1.User.findById(userId);
                if (!user) {
                    return false;
                }
                // Initialize push notifications if not exists
                if (!user.pushNotifications) {
                    user.pushNotifications = {
                        enabled,
                        deviceTokens: [],
                        preferences: {},
                    };
                }
                else {
                    user.pushNotifications.enabled = enabled;
                }
                yield user.save();
                logger_1.default.info("Push notifications enabled/disabled", {
                    userId,
                    enabled,
                });
                return true;
            }
            catch (error) {
                logger_1.default.error("Failed to set push notification enabled status", {
                    userId,
                    error: error.message,
                });
                return false;
            }
        });
    }
    /**
     * Send push notification to a single user
     */
    sendToUser(userId, notification, notificationType) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                const user = yield user_model_1.User.findById(userId);
                if (!user ||
                    !((_a = user.pushNotifications) === null || _a === void 0 ? void 0 : _a.enabled) ||
                    !((_b = user.pushNotifications.deviceTokens) === null || _b === void 0 ? void 0 : _b.length)) {
                    return false;
                }
                // Check if user has enabled this type of notification
                if (notificationType &&
                    ((_c = user.pushNotifications.preferences) === null || _c === void 0 ? void 0 : _c[notificationType]) === false) {
                    logger_1.default.debug("User has disabled this notification type", {
                        userId,
                        notificationType,
                    });
                    return false;
                }
                // Filter valid tokens
                const validTokens = user.pushNotifications.deviceTokens.filter((token) => expo_server_sdk_1.Expo.isExpoPushToken(token));
                if (validTokens.length === 0) {
                    logger_1.default.warn("No valid push tokens found for user", { userId });
                    return false;
                }
                // Create push messages
                const messages = validTokens.map((token) => ({
                    to: token,
                    title: notification.title,
                    body: notification.body,
                    data: notification.data || {},
                    sound: notification.sound || "default",
                    badge: notification.badge,
                    priority: notification.priority || "high",
                    channelId: notification.channelId,
                }));
                // Send notifications
                const chunks = this.expo.chunkPushNotifications(messages);
                const tickets = [];
                for (const chunk of chunks) {
                    try {
                        const ticketChunk = yield this.expo.sendPushNotificationsAsync(chunk);
                        tickets.push(...ticketChunk);
                    }
                    catch (error) {
                        logger_1.default.error("Error sending push notification chunk", {
                            error: error.message,
                            chunkSize: chunk.length,
                        });
                    }
                }
                // Log results
                const successCount = tickets.filter(ticket => ticket.status === "ok").length;
                const errorCount = tickets.filter(ticket => ticket.status === "error").length;
                logger_1.default.info("Push notifications sent", {
                    userId,
                    totalTokens: validTokens.length,
                    successCount,
                    errorCount,
                    notificationType,
                });
                return successCount > 0;
            }
            catch (error) {
                logger_1.default.error("Failed to send push notification to user", {
                    userId,
                    error: error.message,
                });
                return false;
            }
        });
    }
    /**
     * Send push notification to multiple users
     */
    sendToUsers(userIds, notification, notificationType) {
        return __awaiter(this, void 0, void 0, function* () {
            let successCount = 0;
            let errorCount = 0;
            for (const userId of userIds) {
                const success = yield this.sendToUser(userId, notification, notificationType);
                if (success) {
                    successCount++;
                }
                else {
                    errorCount++;
                }
            }
            logger_1.default.info("Bulk push notifications sent", {
                totalUsers: userIds.length,
                successCount,
                errorCount,
                notificationType,
            });
            return { successCount, errorCount };
        });
    }
    /**
     * Send push notification to all users with a specific role
     */
    sendToRole(role, notification, notificationType) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const users = yield user_model_1.User.find({
                    role,
                    "pushNotifications.enabled": true,
                    "pushNotifications.deviceTokens": { $exists: true, $not: { $size: 0 } },
                }).select("_id");
                const userIds = users.map(user => user._id.toString());
                return yield this.sendToUsers(userIds, notification, notificationType);
            }
            catch (error) {
                logger_1.default.error("Failed to send push notification to role", {
                    role,
                    error: error.message,
                });
                return { successCount: 0, errorCount: 0 };
            }
        });
    }
    /**
     * Send push notification to all users
     */
    sendToAll(notification, notificationType) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const users = yield user_model_1.User.find({
                    "pushNotifications.enabled": true,
                    "pushNotifications.deviceTokens": { $exists: true, $not: { $size: 0 } },
                }).select("_id");
                const userIds = users.map(user => user._id.toString());
                return yield this.sendToUsers(userIds, notification, notificationType);
            }
            catch (error) {
                logger_1.default.error("Failed to send push notification to all users", {
                    error: error.message,
                });
                return { successCount: 0, errorCount: 0 };
            }
        });
    }
    /**
     * Clean up invalid device tokens
     */
    cleanupInvalidTokens() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const users = yield user_model_1.User.find({
                    "pushNotifications.deviceTokens": { $exists: true, $not: { $size: 0 } },
                });
                for (const user of users) {
                    if ((_a = user.pushNotifications) === null || _a === void 0 ? void 0 : _a.deviceTokens) {
                        const validTokens = user.pushNotifications.deviceTokens.filter((token) => expo_server_sdk_1.Expo.isExpoPushToken(token));
                        if (validTokens.length !== user.pushNotifications.deviceTokens.length) {
                            user.pushNotifications.deviceTokens = validTokens;
                            yield user.save();
                            logger_1.default.info("Cleaned up invalid device tokens", {
                                userId: user._id,
                                removedCount: user.pushNotifications.deviceTokens.length - validTokens.length,
                            });
                        }
                    }
                }
            }
            catch (error) {
                logger_1.default.error("Failed to cleanup invalid device tokens", {
                    error: error.message,
                });
            }
        });
    }
    /**
     * Get push notification statistics
     */
    getStats() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [totalUsers, usersWithPushEnabled, usersWithTokens] = yield Promise.all([
                    user_model_1.User.countDocuments(),
                    user_model_1.User.countDocuments({ "pushNotifications.enabled": true }),
                    user_model_1.User.countDocuments({
                        "pushNotifications.deviceTokens": {
                            $exists: true,
                            $not: { $size: 0 },
                        },
                    }),
                ]);
                const usersWithTokensData = yield user_model_1.User.find({
                    "pushNotifications.deviceTokens": { $exists: true, $not: { $size: 0 } },
                }).select("pushNotifications.deviceTokens");
                const totalDeviceTokens = usersWithTokensData.reduce((total, user) => { var _a, _b; return total + (((_b = (_a = user.pushNotifications) === null || _a === void 0 ? void 0 : _a.deviceTokens) === null || _b === void 0 ? void 0 : _b.length) || 0); }, 0);
                return {
                    totalUsers,
                    usersWithPushEnabled,
                    totalDeviceTokens,
                    usersWithTokens,
                };
            }
            catch (error) {
                logger_1.default.error("Failed to get push notification stats", {
                    error: error.message,
                });
                return {
                    totalUsers: 0,
                    usersWithPushEnabled: 0,
                    totalDeviceTokens: 0,
                    usersWithTokens: 0,
                };
            }
        });
    }
}
exports.PushNotificationService = PushNotificationService;
exports.default = new PushNotificationService();
