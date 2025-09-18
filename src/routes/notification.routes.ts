import express from "express";
import { NotificationController } from "../controllers/notification.controller";
import { verifyToken } from "../middleware/auth.middleware";

const router = express.Router();
const notificationController = new NotificationController();

// Get user notifications
router.get(
  "/",
  verifyToken,
  notificationController.getUserNotifications.bind(notificationController)
);

// Mark notification as read
router.patch(
  "/:notificationId/read",
  verifyToken,
  notificationController.markAsRead.bind(notificationController)
);

// Mark all notifications as read
router.patch(
  "/mark-all-read",
  verifyToken,
  notificationController.markAllAsRead.bind(notificationController)
);

// Get notification preferences
router.get(
  "/preferences",
  verifyToken,
  notificationController.getNotificationPreferences.bind(notificationController)
);

// Update notification preferences
router.put(
  "/preferences",
  verifyToken,
  notificationController.updateNotificationPreferences.bind(
    notificationController
  )
);

// Share content
router.post(
  "/share",
  verifyToken,
  notificationController.shareContent.bind(notificationController)
);

// Get trending content
router.get(
  "/trending",
  notificationController.getTrendingContent.bind(notificationController)
);

// Get mention suggestions
router.get(
  "/mentions/suggestions",
  notificationController.getMentionSuggestions.bind(notificationController)
);

// Get viral content statistics
router.get(
  "/viral-stats",
  notificationController.getViralStats.bind(notificationController)
);

// Get notification statistics
router.get(
  "/stats",
  verifyToken,
  notificationController.getNotificationStats.bind(notificationController)
);

export default router;
