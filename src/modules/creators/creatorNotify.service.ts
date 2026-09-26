import { User } from "../../models/user.model";
import { Media } from "../../models/media.model";
import resendEmailService from "../../service/resendEmail.service";
import { createNotification } from "../../service/notification/create";
import { generateCreatorLifecycleEmail } from "../../service/email/templates/creatorLifecycleEmail";
import logger from "../../utils/logger";
import {
  creatorNotifyCopy,
  viewMilestoneEvent,
  type CreatorNotifyEvent,
} from "./creatorNotify.catalog";
import {
  creatorFacingModerationReason,
  type CreatorFacingOutcome,
} from "./creatorFacingReason";

function publicWebBase(): string {
  return (
    process.env.PUBLIC_WEB_URL ||
    process.env.FRONTEND_URL ||
    process.env.APP_PUBLIC_URL ||
    "https://www.jevahapp.com"
  ).replace(/\/$/, "");
}

export interface NotifyCreatorInput {
  userId: string;
  event: CreatorNotifyEvent;
  contentTitle?: string;
  reason?: string;
  count?: number;
  relatedId?: string;
  contentType?: string;
}

/**
 * Transactional creator mail + inbox. Fire-and-forget from product hooks.
 * Does not honor marketing opt-out (same idea as verify / artist welcome).
 */
export async function notifyCreator(input: NotifyCreatorInput): Promise<void> {
  try {
    if (!input.userId) return;
    const user = await User.findById(input.userId)
      .select("email firstName isBanned")
      .lean();
    if (!user || (user as any).isBanned) return;

    const copy = creatorNotifyCopy(input.event, {
      firstName: (user as any).firstName,
      contentTitle: input.contentTitle,
      reason: input.reason,
      count: input.count,
    });
    const dedupeKey = [
      "creator",
      input.event,
      input.userId,
      input.relatedId || "none",
      input.count != null ? String(input.count) : "x",
    ].join(":");

    const inbox = await createNotification({
      userId: input.userId,
      type: copy.inboxType,
      title: copy.inboxTitle,
      message: copy.inboxMessage,
      metadata: {
        creatorEvent: input.event,
        contentTitle: input.contentTitle,
        contentType: input.contentType,
        reason: input.reason || copy.reasonHighlight,
        count: input.count,
      },
      priority:
        input.event === "application_suspended" ||
        input.event === "media_rejected" ||
        input.event === "music_rejected"
          ? "high"
          : "medium",
      relatedId: input.relatedId,
      dedupeKey,
    });
    if (!inbox) return;

    const email = String((user as any).email || "");
    if (!email.includes("@")) return;

    const html = generateCreatorLifecycleEmail({
      title: copy.title,
      body: copy.body,
      ctaUrl: `${publicWebBase()}${copy.ctaPath}`,
      ctaLabel: copy.ctaLabel,
      reason: copy.reasonHighlight,
    });
    await resendEmailService.sendEmail({
      to: email,
      subject: copy.subject,
      html,
    });
  } catch (error: any) {
    logger.warn("Creator notify failed", {
      event: input.event,
      userId: input.userId,
      error: error?.message,
    });
  }
}

export function notifyCreatorSafe(input: NotifyCreatorInput): void {
  void notifyCreator(input);
}

export function mediaDecisionEvent(
  status: string,
  contentType?: string
): CreatorNotifyEvent | null {
  const isMusic = ["music", "audio"].includes(
    String(contentType || "").toLowerCase()
  );
  if (status === "approved") return isMusic ? "music_approved" : "media_approved";
  if (status === "rejected") return isMusic ? "music_rejected" : "media_rejected";
  if (status === "under_review" || status === "pending") {
    return "media_under_review";
  }
  return null;
}

/** Email + inbox after AI or admin decides on an upload. */
export function notifyMediaModerationOutcomeSafe(input: {
  userId: string;
  mediaId: string;
  title?: string;
  contentType?: string;
  status: string;
  adminNotes?: string;
  flags?: string[];
  internalReason?: string;
}): string {
  const outcome = input.status as CreatorFacingOutcome;
  const reason = creatorFacingModerationReason({
    outcome:
      outcome === "approved" ||
      outcome === "rejected" ||
      outcome === "under_review" ||
      outcome === "pending"
        ? outcome
        : "under_review",
    adminNotes: input.adminNotes,
    flags: input.flags,
    internalReason: input.internalReason,
  });
  const event = mediaDecisionEvent(input.status, input.contentType);
  if (event && input.userId) {
    notifyCreatorSafe({
      userId: input.userId,
      event,
      contentTitle: input.title,
      reason: reason || undefined,
      relatedId: input.mediaId,
      contentType: input.contentType,
    });
  }
  return reason;
}

export async function maybeNotifyViewMilestone(input: {
  contentId: string;
  contentType: string;
  viewCount: number;
}): Promise<void> {
  const event = viewMilestoneEvent(input.viewCount);
  if (!event) return;
  if (!["media", "ebook", "podcast", "merch"].includes(input.contentType)) {
    return;
  }

  const media = await Media.findById(input.contentId)
    .select("title uploadedBy")
    .lean();
  if (!media || !(media as any).uploadedBy) return;

  await notifyCreator({
    userId: String((media as any).uploadedBy),
    event,
    contentTitle: (media as any).title,
    count: input.viewCount,
    relatedId: input.contentId,
    contentType: input.contentType,
  });
}

export function maybeNotifyViewMilestoneSafe(input: {
  contentId: string;
  contentType: string;
  viewCount: number;
}): void {
  void maybeNotifyViewMilestone(input).catch((error) => {
    logger.warn("View milestone notify failed", {
      contentId: input.contentId,
      error: error?.message,
    });
  });
}
