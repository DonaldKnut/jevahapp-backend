"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const notification_controller_1 = require("../controllers/notification.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
const notificationController = new notification_controller_1.NotificationController();
// Get user notifications
router.get("/", auth_middleware_1.verifyToken, notificationController.getUserNotifications.bind(notificationController));
// Mark notification as read
router.patch("/:notificationId/read", auth_middleware_1.verifyToken, notificationController.markAsRead.bind(notificationController));
// Mark all notifications as read
router.patch("/mark-all-read", auth_middleware_1.verifyToken, notificationController.markAllAsRead.bind(notificationController));
// Get notification preferences
router.get("/preferences", auth_middleware_1.verifyToken, notificationController.getNotificationPreferences.bind(notificationController));
// Update notification preferences
router.put("/preferences", auth_middleware_1.verifyToken, notificationController.updateNotificationPreferences.bind(notificationController));
// Share content
router.post("/share", auth_middleware_1.verifyToken, notificationController.shareContent.bind(notificationController));
// Get trending content
router.get("/trending", notificationController.getTrendingContent.bind(notificationController));
// Get mention suggestions
router.get("/mentions/suggestions", notificationController.getMentionSuggestions.bind(notificationController));
// Get viral content statistics
router.get("/viral-stats", notificationController.getViralStats.bind(notificationController));
// Get notification statistics
router.get("/stats", auth_middleware_1.verifyToken, notificationController.getNotificationStats.bind(notificationController));
exports.default = router;
