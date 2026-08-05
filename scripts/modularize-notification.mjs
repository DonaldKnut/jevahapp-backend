/**
 * Split notification.service.ts into src/service/notification/*
 * Facade preserves static method signatures via assignment.
 */
import fs from "fs";
import path from "path";
import { extractClassMethod } from "./extract-ts-method.mjs";

const root = process.cwd();
const srcPath = path.join(root, "src/service/notification.service.ts");
const bakPath = srcPath + ".bak";

function write(rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content.replace(/\r\n/g, "\n"));
  console.log("wrote", rel, content.split("\n").length);
}

if (!fs.existsSync(bakPath)) {
  fs.copyFileSync(srcPath, bakPath);
  console.log("backup created");
}

const lines = fs.readFileSync(bakPath, "utf8").split(/\r?\n/);

function toExportedFunction(name) {
  let body = extractClassMethod(lines, name).map(l =>
    l.startsWith("  ") ? l.slice(2) : l
  );
  let first = body[0]
    .replace(/^private\s+static\s+async\s+/, "export async function ")
    .replace(/^static\s+async\s+/, "export async function ")
    .replace(/^private\s+static\s+/, "export function ")
    .replace(/^static\s+/, "export function ");
  if (!first.startsWith("export ")) first = "export " + first;
  body[0] = first;

  let text = body.join("\n");
  text = text
    .replace(/this\.createNotification\(/g, "createNotification(")
    .replace(/this\.sendPushNotification\(/g, "sendPushNotification(")
    .replace(
      /NotificationService\.createNotification\(/g,
      "createNotification("
    );

  console.log("extracted", name, text.split("\n").length);
  return text + "\n";
}

function joinMethods(names) {
  return names.map(toExportedFunction).join("\n");
}

write(
  "src/service/notification/types.ts",
  `export interface CreateNotificationData {
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata?: any;
  priority?: "low" | "medium" | "high";
  relatedId?: string;
  /** When set, duplicate inserts (retries) are ignored via unique index */
  dedupeKey?: string;
}
`
);

write(
  "src/service/notification/create.ts",
  `import { Notification } from "../../models/notification.model";
import PushNotificationService from "../pushNotification.service";
import logger from "../../utils/logger";
import type { CreateNotificationData } from "./types";

${joinMethods(["createNotification", "sendPushNotification"])}`
);

write(
  "src/service/notification/social.ts",
  `import { User } from "../../models/user.model";
import { Media } from "../../models/media.model";
import { Devotional } from "../../models/devotional.model";
import logger from "../../utils/logger";
import { createNotification } from "./create";

${joinMethods([
  "notifyUserFollow",
  "notifyContentLike",
  "notifyContentComment",
  "notifyCommentReply",
  "notifyContentShare",
  "notifyContentMention",
])}`
);

write(
  "src/service/notification/contentEvents.ts",
  `import { User } from "../../models/user.model";
import { Media } from "../../models/media.model";
import logger from "../../utils/logger";
import { createNotification } from "./create";

${joinMethods([
  "notifyViralContent",
  "notifyPublicActivity",
  "notifyContentDownload",
  "notifyContentBookmark",
  "notifyMerchPurchase",
  "notifyMilestone",
])}`
);

write(
  "src/service/notification/inbox.ts",
  `import { Notification } from "../../models/notification.model";
import { User } from "../../models/user.model";
import mongoose, { Types } from "mongoose";
import logger from "../../utils/logger";

${joinMethods([
  "getNotificationPreferences",
  "updateNotificationPreferences",
  "getNotificationStats",
  "markAsRead",
  "markAllAsRead",
  "getUserNotifications",
])}`
);

write(
  "src/service/notification.service.ts",
  `import type { CreateNotificationData } from "./notification/types";
import {
  createNotification,
  sendPushNotification,
} from "./notification/create";
import {
  notifyUserFollow,
  notifyContentLike,
  notifyContentComment,
  notifyCommentReply,
  notifyContentShare,
  notifyContentMention,
} from "./notification/social";
import {
  notifyViralContent,
  notifyPublicActivity,
  notifyContentDownload,
  notifyContentBookmark,
  notifyMerchPurchase,
  notifyMilestone,
} from "./notification/contentEvents";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  getNotificationStats,
  markAsRead,
  markAllAsRead,
  getUserNotifications,
} from "./notification/inbox";

export type { CreateNotificationData };

/**
 * Static facade — method signatures match the pre-split NotificationService.
 */
export class NotificationService {
  static createNotification = createNotification;
  static notifyUserFollow = notifyUserFollow;
  static notifyContentLike = notifyContentLike;
  static notifyContentComment = notifyContentComment;
  static notifyCommentReply = notifyCommentReply;
  static notifyContentShare = notifyContentShare;
  static notifyContentMention = notifyContentMention;
  static notifyViralContent = notifyViralContent;
  static notifyPublicActivity = notifyPublicActivity;
  static getNotificationPreferences = getNotificationPreferences;
  static updateNotificationPreferences = updateNotificationPreferences;
  static getNotificationStats = getNotificationStats;
  static notifyContentDownload = notifyContentDownload;
  static notifyContentBookmark = notifyContentBookmark;
  static notifyMerchPurchase = notifyMerchPurchase;
  static notifyMilestone = notifyMilestone;
  static markAsRead = markAsRead;
  static markAllAsRead = markAllAsRead;
  static getUserNotifications = getUserNotifications;
  /** @internal retained for any direct callers */
  static sendPushNotification = sendPushNotification;
}

export default NotificationService;
`
);

console.log("done notification");
