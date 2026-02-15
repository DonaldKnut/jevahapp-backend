/**
 * Notifications module: in-app notifications, push notifications
 */
import { Router } from "express";
import notificationRoutes from "../../routes/notification.routes";
import pushNotificationRoutes from "../../routes/pushNotification.routes";

export interface Mount {
  path: string;
  router: Router;
}

export const mounts: Mount[] = [
  { path: "/api/notifications", router: notificationRoutes },
  { path: "/api/push-notifications", router: pushNotificationRoutes },
];

export default { mounts };
