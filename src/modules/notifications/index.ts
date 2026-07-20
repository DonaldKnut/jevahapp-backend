/**
 * Notifications module: in-app notifications, push notifications
 * Application facade — routes preserved; domain/infra re-exported for SOLID boundaries.
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

export * from "./domain/eventCatalog";
export {
  registerDevice,
  unregisterDevice,
  upsertDevice,
} from "./application/device.service";
export { PushDevice } from "./models/pushDevice.model";
export type {
  IPushDevice,
  PushDevicePlatform,
  PushDeviceStatus,
} from "./models/pushDevice.model";
export { PushDelivery } from "./models/pushDelivery.model";
export type { IPushDelivery } from "./models/pushDelivery.model";
export { NotificationOutbox } from "./models/notificationOutbox.model";
export type { INotificationOutbox } from "./models/notificationOutbox.model";
export { persistPushTickets } from "./infrastructure/expoTicket.processor";
export {
  pollExpoReceipts,
  startExpoReceiptPoller,
  deactivateDeviceToken,
} from "./infrastructure/expoReceipt.processor";

export default { mounts };
