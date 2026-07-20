/**
 * Canonical notification event → push preference mapping.
 * Queue jobs pass event types; user prefs use camelCase keys.
 */

export type NotificationEventType =
  | "follow"
  | "like"
  | "comment"
  | "share"
  | "mention"
  | "download"
  | "bookmark"
  | "milestone"
  | "public_activity"
  | "system"
  | "security"
  | "live_stream"
  | "merch_purchase"
  | "content_report"
  | "content_moderation"
  | "moderation_alert"
  | "message"
  | "reengagement";

export type PushPreferenceKey =
  | "newFollowers"
  | "mediaLikes"
  | "mediaComments"
  | "mediaShares"
  | "merchPurchases"
  | "songDownloads"
  | "subscriptionUpdates"
  | "securityAlerts"
  | "liveStreams"
  | "newMessages"
  | "mentions"
  | "milestones"
  | "publicActivity"
  | "viralContent"
  | "bookmarks"
  | "moderationAlerts"
  | "systemAlerts"
  | "reengagement";

/** Events that always deliver even if preference toggles are off. */
export const MANDATORY_PUSH_EVENTS = new Set<NotificationEventType>([
  "security",
  "content_moderation",
  "content_report",
  "moderation_alert",
]);

export const EVENT_TO_PREFERENCE: Record<
  NotificationEventType,
  PushPreferenceKey | null
> = {
  follow: "newFollowers",
  like: "mediaLikes",
  comment: "mediaComments",
  share: "mediaShares",
  mention: "mentions",
  download: "songDownloads",
  bookmark: "bookmarks",
  milestone: "milestones",
  public_activity: "publicActivity",
  system: "systemAlerts",
  security: "securityAlerts",
  live_stream: "liveStreams",
  merch_purchase: "merchPurchases",
  content_report: "moderationAlerts",
  content_moderation: "moderationAlerts",
  moderation_alert: "moderationAlerts",
  message: "newMessages",
  reengagement: "reengagement",
};

export function resolvePushPreferenceKey(
  eventType?: string | null
): PushPreferenceKey | null {
  if (!eventType) return null;
  const mapped = EVENT_TO_PREFERENCE[eventType as NotificationEventType];
  if (mapped !== undefined) return mapped;
  // Already a preference key
  if (
    Object.values(EVENT_TO_PREFERENCE).includes(eventType as PushPreferenceKey)
  ) {
    return eventType as PushPreferenceKey;
  }
  return null;
}

export function isPushAllowedByPreferences(
  eventType: string | undefined,
  preferences: Record<string, boolean | undefined> | undefined,
  opts?: { mandatoryOverride?: boolean }
): boolean {
  if (!eventType) return true;
  if (
    opts?.mandatoryOverride !== false &&
    MANDATORY_PUSH_EVENTS.has(eventType as NotificationEventType)
  ) {
    return true;
  }
  const key = resolvePushPreferenceKey(eventType);
  if (!key) return true;
  if (!preferences) return true;
  return preferences[key] !== false;
}

/** BullMQ v5 rejects ":" in custom job IDs. */
export function toSafeBullJobId(raw: string, prefix = "notify"): string {
  const cleaned = String(raw || "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${prefix}-${cleaned || "job"}`;
}
