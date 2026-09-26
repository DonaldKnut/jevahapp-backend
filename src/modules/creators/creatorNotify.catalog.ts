import { JEVAH_GOSPEL_STANDARD } from "./creatorFacingReason";

export type CreatorNotifyEvent =
  | "application_received"
  | "application_accepted"
  | "application_rejected"
  | "application_suspended"
  | "media_uploaded"
  | "media_under_review"
  | "media_approved"
  | "media_rejected"
  | "media_reported"
  | "music_approved"
  | "music_rejected"
  | "view_milestone"
  | "buzzing";

export type CreatorInboxType =
  | "system"
  | "content_moderation"
  | "content_report"
  | "milestone";

export const VIEW_MILESTONES = [100, 500, 5000, 10000] as const;
export const BUZZING_THRESHOLD = 1000;

export interface CreatorNotifyCopy {
  subject: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaPath: string;
  inboxType: CreatorInboxType;
  inboxTitle: string;
  inboxMessage: string;
  /** Highlighted in email for hold / reject. */
  reasonHighlight?: string;
}

export interface CreatorNotifyCopyInput {
  firstName?: string;
  contentTitle?: string;
  reason?: string;
  count?: number;
}

function name(input: CreatorNotifyCopyInput): string {
  return input.firstName || "there";
}

function work(input: CreatorNotifyCopyInput, fallback = "your upload"): string {
  return input.contentTitle?.trim() || fallback;
}

export function creatorNotifyCopy(
  event: CreatorNotifyEvent,
  input: CreatorNotifyCopyInput = {}
): CreatorNotifyCopy {
  const who = name(input);
  const piece = work(input);
  const reason = input.reason?.trim();
  const count = input.count || 0;

  switch (event) {
    case "application_received":
      return {
        subject: "We received your Jevah creator application",
        title: "Application received",
        body: `Hi ${who}, your creator application is in. Our team is reviewing it now. We’ll email you when you’re approved or if we need anything else.`,
        ctaLabel: "Open creator hub",
        ctaPath: "/creators/studio",
        inboxType: "system",
        inboxTitle: "Application under review",
        inboxMessage:
          "Your creator application is being reviewed. We’ll notify you when there’s a decision.",
      };
    case "application_accepted":
      return {
        subject: "You’re approved — welcome to Jevah Studio",
        title: "You’re in",
        body: `Hi ${who}, your creator application was approved. You can upload music, sermons, and videos to Studio.`,
        ctaLabel: "Open Studio",
        ctaPath: "/creators/studio",
        inboxType: "system",
        inboxTitle: "Creator application approved",
        inboxMessage: "You’re an approved Jevah creator. Upload your first track in Studio.",
      };
    case "application_rejected":
      return {
        subject: "Update on your Jevah creator application",
        title: "Application not approved",
        body: `Hi ${who}, we couldn’t approve your creator application at this time.${reason ? ` ${reason}` : ""} You can update your profile and apply again later.`,
        ctaLabel: "Review application",
        ctaPath: "/creators/apply",
        inboxType: "system",
        inboxTitle: "Creator application not approved",
        inboxMessage: reason || "Your creator application was not approved.",
      };
    case "application_suspended":
      return {
        subject: "Your Jevah creator account was suspended",
        title: "Account suspended",
        body: `Hi ${who}, your creator account has been suspended.${reason ? ` ${reason}` : " Contact support if you believe this is a mistake."}`,
        ctaLabel: "Contact support",
        ctaPath: "/creators/studio",
        inboxType: "system",
        inboxTitle: "Creator account suspended",
        inboxMessage: reason || "Your creator account is suspended.",
      };
    case "media_uploaded":
      return {
        subject: `We got your upload: ${piece}`,
        title: "Upload received",
        body: `Hi ${who}, “${piece}” is on Jevah. It’s processing now and will appear in your library when ready.`,
        ctaLabel: "View in Studio",
        ctaPath: "/creators/studio",
        inboxType: "system",
        inboxTitle: "Upload received",
        inboxMessage: `“${piece}” was uploaded successfully.`,
      };
    case "media_under_review":
      return {
        subject: `“${piece}” is under review`,
        title: "Under review",
        body: `Hi ${who}, “${piece}” is being reviewed before it can go live. We’ll email you when it’s approved or if it can’t be published.`,
        ctaLabel: "Check status",
        ctaPath: "/creators/studio",
        inboxType: "content_moderation",
        inboxTitle: "Upload under review",
        inboxMessage:
          reason ||
          `“${piece}” is hidden until review finishes. ${JEVAH_GOSPEL_STANDARD}`,
        reasonHighlight: reason || JEVAH_GOSPEL_STANDARD,
      };
    case "media_approved":
      return {
        subject: `“${piece}” is live on Jevah`,
        title: "Your video is live",
        body: `Hi ${who}, “${piece}” was approved and is now live on Jevah.`,
        ctaLabel: "Open Studio",
        ctaPath: "/creators/studio",
        inboxType: "content_moderation",
        inboxTitle: "Upload approved",
        inboxMessage: `“${piece}” is live on Jevah.`,
      };
    case "media_rejected":
      return {
        subject: `“${piece}” could not be published`,
        title: "Upload not published",
        body: `Hi ${who}, “${piece}” was not approved and is not live on Jevah. You can replace it or upload something new.`,
        ctaLabel: "Open Studio",
        ctaPath: "/creators/studio",
        inboxType: "content_moderation",
        inboxTitle: "Upload rejected",
        inboxMessage:
          reason ||
          `“${piece}” was not published. ${JEVAH_GOSPEL_STANDARD}`,
        reasonHighlight: reason || JEVAH_GOSPEL_STANDARD,
      };
    case "media_reported":
      return {
        subject: `Someone reported “${piece}”`,
        title: "Your content was reported",
        body: `Hi ${who}, a viewer reported “${piece}”. Our team will review it. You don’t need to do anything unless we follow up.${reason ? ` Reason: ${reason}.` : ""}`,
        ctaLabel: "Open Studio",
        ctaPath: "/creators/studio",
        inboxType: "content_report",
        inboxTitle: "Your content was reported",
        inboxMessage: `“${piece}” was reported${reason ? ` (${reason})` : ""}. We’re reviewing it.`,
      };
    case "music_approved":
      return {
        subject: `“${piece}” is live on Artists`,
        title: "Your music is approved",
        body: `Hi ${who}, “${piece}” passed review and is on the Artists shelf.`,
        ctaLabel: "Open Studio",
        ctaPath: "/creators/studio",
        inboxType: "content_moderation",
        inboxTitle: "Music approved",
        inboxMessage: `“${piece}” is live on Artists.`,
      };
    case "music_rejected":
      return {
        subject: `“${piece}” was not approved`,
        title: "Music not published",
        body: `Hi ${who}, “${piece}” did not pass review. Update the track or upload a new one.`,
        ctaLabel: "Open Studio",
        ctaPath: "/creators/studio",
        inboxType: "content_moderation",
        inboxTitle: "Music rejected",
        inboxMessage:
          reason ||
          `“${piece}” was not approved. ${JEVAH_GOSPEL_STANDARD}`,
        reasonHighlight: reason || JEVAH_GOSPEL_STANDARD,
      };
    case "view_milestone":
      return {
        subject: `“${piece}” just hit ${count.toLocaleString()} views`,
        title: "Milestone",
        body: `Hi ${who}, “${piece}” reached ${count.toLocaleString()} views. Keep sharing it.`,
        ctaLabel: "See analytics",
        ctaPath: "/creators/studio",
        inboxType: "milestone",
        inboxTitle: "View milestone",
        inboxMessage: `“${piece}” reached ${count.toLocaleString()} views.`,
      };
    case "buzzing":
      return {
        subject: `“${piece}” is buzzing on Jevah`,
        title: "You’re buzzing",
        body: `Hi ${who}, “${piece}” just crossed ${count.toLocaleString()} views and is picking up. Share it while it’s moving.`,
        ctaLabel: "See analytics",
        ctaPath: "/creators/studio",
        inboxType: "milestone",
        inboxTitle: "Your upload is buzzing",
        inboxMessage: `“${piece}” is taking off — ${count.toLocaleString()} views.`,
      };
  }
}

export function viewMilestoneEvent(
  count: number
): CreatorNotifyEvent | null {
  if (count === BUZZING_THRESHOLD) return "buzzing";
  if ((VIEW_MILESTONES as readonly number[]).includes(count)) {
    return "view_milestone";
  }
  return null;
}
