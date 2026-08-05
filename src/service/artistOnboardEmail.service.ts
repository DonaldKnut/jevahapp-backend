import { Types } from "mongoose";
import { Artist } from "../models/artist.model";
import { User } from "../models/user.model";
import { AdminEmailLog } from "../models/adminEmailLog.model";
import resendEmailService from "./resendEmail.service";
import logger from "../utils/logger";
import { AuditService } from "./audit.service";
import {
  buildArtistOnboardEmailHtml,
  plainTextToHtmlParagraphs,
} from "./email/templates/artistOnboardEmail";

export type ArtistOnboardSegment =
  | "artistIds"
  | "userIds"
  | "emails"
  | "pending"
  | "active_missing_onboard"
  | "active";

export interface ArtistOnboardRecipient {
  email: string;
  artistId?: string;
  userId?: string;
  artistName: string;
  firstName?: string;
}

export interface ResolveArtistOnboardInput {
  segment: ArtistOnboardSegment;
  artistIds?: string[];
  userIds?: string[];
  emails?: string[];
  /** Cap recipients (default 100, max 100). */
  limit?: number;
}

export interface SendArtistOnboardInput extends ResolveArtistOnboardInput {
  adminId: string;
  /** Optional override; default subject uses artist welcome copy. */
  subject?: string;
  /** Optional personal note from admin (plain text). */
  message?: string;
  dryRun?: boolean;
}

const MAX_RECIPIENTS = 100;
const SEND_PACE_MS = 75;
const DEFAULT_SUBJECT = "You're invited to create on Jevah";

function publicWebBase(): string {
  return (
    process.env.PUBLIC_WEB_URL ||
    process.env.FRONTEND_URL ||
    process.env.APP_PUBLIC_URL ||
    "https://jevahapp.com"
  ).replace(/\/$/, "");
}

export function artistOnboardCtaUrl(status?: string): {
  url: string;
  label: string;
} {
  const base = publicWebBase();
  if (status === "active") {
    return { url: `${base}/creators`, label: "Open creator studio" };
  }
  return { url: `${base}/creators/apply`, label: "Start creator application" };
}

function clampLimit(limit?: number): number {
  if (limit == null || Number.isNaN(limit)) return MAX_RECIPIENTS;
  return Math.min(Math.max(1, Math.floor(limit)), MAX_RECIPIENTS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function usersByIds(
  ids: string[]
): Promise<Map<string, { email: string; firstName?: string; fullName?: string }>> {
  const valid = ids.filter((id) => Types.ObjectId.isValid(id));
  const rows = await User.find({ _id: { $in: valid } })
    .select("email firstName fullName")
    .lean();
  const map = new Map<
    string,
    { email: string; firstName?: string; fullName?: string }
  >();
  for (const u of rows as any[]) {
    if (!u?.email) continue;
    map.set(String(u._id), {
      email: String(u.email).toLowerCase(),
      firstName: u.firstName || undefined,
      fullName: u.fullName || undefined,
    });
  }
  return map;
}

/**
 * Resolve who gets the onboard email.
 * Ops invite: raw emails allowed (not marketing opt-in).
 */
export async function resolveArtistOnboardRecipients(
  input: ResolveArtistOnboardInput
): Promise<ArtistOnboardRecipient[]> {
  const limit = clampLimit(input.limit);
  const byEmail = new Map<string, ArtistOnboardRecipient>();

  const push = (r: ArtistOnboardRecipient) => {
    const key = r.email.toLowerCase();
    if (!key.includes("@")) return;
    if (byEmail.size >= limit && !byEmail.has(key)) return;
    const existing = byEmail.get(key);
    if (existing) {
      byEmail.set(key, {
        ...existing,
        artistId: existing.artistId || r.artistId,
        userId: existing.userId || r.userId,
        artistName: existing.artistName || r.artistName,
        firstName: existing.firstName || r.firstName,
      });
      return;
    }
    byEmail.set(key, { ...r, email: key });
  };

  if (input.segment === "emails") {
    const emails = (input.emails || [])
      .filter((e) => typeof e === "string" && e.includes("@"))
      .map((e) => e.trim().toLowerCase());
    if (!emails.length) {
      throw new Error("emails is required when segment=emails");
    }
    const users = await User.find({ email: { $in: emails } })
      .select("email firstName fullName")
      .lean();
    const userByEmail = new Map(
      (users as any[]).map((u) => [String(u.email).toLowerCase(), u])
    );
    const artists = await Artist.find({
      userId: { $in: (users as any[]).map((u) => u._id) },
    })
      .select("displayName userId status")
      .lean();
    const artistByUser = new Map(
      (artists as any[]).map((a) => [String(a.userId), a])
    );

    for (const email of emails.slice(0, limit)) {
      const u = userByEmail.get(email);
      const a = u ? artistByUser.get(String(u._id)) : undefined;
      push({
        email,
        userId: u?._id?.toString?.(),
        artistId: a?._id?.toString?.(),
        artistName: a?.displayName || u?.fullName || email.split("@")[0],
        firstName: u?.firstName || undefined,
      });
    }
    return Array.from(byEmail.values());
  }

  if (input.segment === "userIds") {
    const ids = (input.userIds || []).filter((id) => Types.ObjectId.isValid(id));
    if (!ids.length) throw new Error("userIds is required when segment=userIds");
    const users = await usersByIds(ids);
    const artists = await Artist.find({
      userId: { $in: ids.filter((id) => users.has(id)) },
    })
      .select("displayName userId")
      .lean();
    const artistByUser = new Map(
      (artists as any[]).map((a) => [String(a.userId), a])
    );
    for (const id of ids) {
      const u = users.get(id);
      if (!u) continue;
      const a = artistByUser.get(id);
      push({
        email: u.email,
        userId: id,
        artistId: a?._id?.toString?.(),
        artistName: a?.displayName || u.fullName || u.firstName || "Creator",
        firstName: u.firstName,
      });
    }
    return Array.from(byEmail.values()).slice(0, limit);
  }

  // artistIds | pending | active_missing_onboard | active
  const query: Record<string, unknown> = {};
  if (input.segment === "artistIds") {
    const ids = (input.artistIds || []).filter((id) =>
      Types.ObjectId.isValid(id)
    );
    if (!ids.length) {
      throw new Error("artistIds is required when segment=artistIds");
    }
    query._id = { $in: ids };
  } else if (input.segment === "pending") {
    query.status = "pending";
  } else if (input.segment === "active") {
    query.status = "active";
  } else if (input.segment === "active_missing_onboard") {
    query.status = "active";
    query.$or = [
      { onboardEmailSentAt: null },
      { onboardEmailSentAt: { $exists: false } },
    ];
  } else {
    throw new Error(
      "segment must be one of: artistIds, userIds, emails, pending, active, active_missing_onboard"
    );
  }

  const artists = await Artist.find(query)
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  const userIds = (artists as any[])
    .map((a) => a.userId)
    .filter(Boolean)
    .map((id: any) => String(id));
  const users = await usersByIds(userIds);

  for (const a of artists as any[]) {
    const uid = a.userId ? String(a.userId) : null;
    const u = uid ? users.get(uid) : undefined;
    if (!u?.email) {
      continue;
    }
    push({
      email: u.email,
      artistId: String(a._id),
      userId: uid || undefined,
      artistName: a.displayName || "Creator",
      firstName: u.firstName,
    });
  }

  return Array.from(byEmail.values());
}

export async function previewArtistOnboardCount(
  input: ResolveArtistOnboardInput
): Promise<{ recipientCount: number; sample: ArtistOnboardRecipient[] }> {
  const recipients = await resolveArtistOnboardRecipients(input);
  return {
    recipientCount: recipients.length,
    sample: recipients.slice(0, 10),
  };
}

export async function countArtistsNeedingOnboardEmail(): Promise<{
  pendingApplications: number;
  activeMissingOnboardEmail: number;
}> {
  const [pendingApplications, activeMissingOnboardEmail] = await Promise.all([
    Artist.countDocuments({ status: "pending" }),
    Artist.countDocuments({
      status: "active",
      userId: { $ne: null },
      $or: [
        { onboardEmailSentAt: null },
        { onboardEmailSentAt: { $exists: false } },
      ],
    }),
  ]);
  return { pendingApplications, activeMissingOnboardEmail };
}

export async function sendArtistOnboardCampaign(
  input: SendArtistOnboardInput
): Promise<{
  dryRun: boolean;
  recipientCount: number;
  sent: number;
  failed: number;
  failures: Array<{ email: string; error: string }>;
  subject: string;
}> {
  const recipients = await resolveArtistOnboardRecipients(input);
  if (!recipients.length) {
    throw new Error(
      "No recipients found. Artists need a linked user with an email, or use segment=emails."
    );
  }

  const subject = (input.subject || DEFAULT_SUBJECT).trim();
  const customHtml = input.message?.trim()
    ? plainTextToHtmlParagraphs(input.message.trim())
    : undefined;

  if (input.dryRun) {
    await AdminEmailLog.create({
      adminId: input.adminId,
      subject,
      recipientCount: recipients.length,
      recipientsSample: recipients.slice(0, 20).map((r) => r.email),
      dryRun: true,
      sent: 0,
      failed: 0,
      meta: {
        kind: "artist_onboard",
        segment: input.segment,
        sampleArtistIds: recipients
          .map((r) => r.artistId)
          .filter(Boolean)
          .slice(0, 20),
      },
    });
    return {
      dryRun: true,
      recipientCount: recipients.length,
      sent: 0,
      failed: 0,
      failures: [],
      subject,
    };
  }

  let sent = 0;
  let failed = 0;
  const failures: Array<{ email: string; error: string }> = [];
  const sentArtistIds: string[] = [];

  for (const r of recipients) {
    try {
      let status: string | undefined;
      if (r.artistId) {
        const a = await Artist.findById(r.artistId).select("status").lean();
        status = (a as any)?.status;
      }
      const cta = artistOnboardCtaUrl(status);
      const html = buildArtistOnboardEmailHtml({
        artistName: r.artistName,
        firstName: r.firstName,
        customMessageHtml: customHtml,
        ctaUrl: cta.url,
        ctaLabel: cta.label,
      });
      await resendEmailService.sendEmail({
        to: r.email,
        subject,
        html,
      });
      sent += 1;
      if (r.artistId) sentArtistIds.push(r.artistId);
    } catch (err: any) {
      failed += 1;
      failures.push({
        email: r.email,
        error: err?.message || "send failed",
      });
      logger.error("Artist onboard email failed", {
        email: r.email,
        error: err?.message,
      });
    }
    await sleep(SEND_PACE_MS);
  }

  if (sentArtistIds.length) {
    await Artist.updateMany(
      { _id: { $in: sentArtistIds } },
      { $set: { onboardEmailSentAt: new Date() } }
    );
  }

  await AdminEmailLog.create({
    adminId: input.adminId,
    subject,
    recipientCount: recipients.length,
    recipientsSample: recipients.slice(0, 20).map((r) => r.email),
    dryRun: false,
    sent,
    failed,
    meta: {
      kind: "artist_onboard",
      segment: input.segment,
      artistIds: sentArtistIds.slice(0, 50),
    },
  });

  try {
    await AuditService.logAdminAction(
      input.adminId,
      "send_artist_onboard_email",
      sentArtistIds[0] || input.adminId,
      { sent, failed, recipientCount: recipients.length, segment: input.segment }
    );
  } catch {
    /* non-fatal */
  }

  return {
    dryRun: false,
    recipientCount: recipients.length,
    sent,
    failed,
    failures: failures.slice(0, 25),
    subject,
  };
}

export const ARTIST_ONBOARD_EMAIL_MAX_RECIPIENTS = MAX_RECIPIENTS;
