import crypto from "crypto";
import { Types } from "mongoose";
import { User } from "../models/user.model";
import { AdminEmailLog } from "../models/adminEmailLog.model";
import resendEmailService from "./resendEmail.service";
import logger from "../utils/logger";
import {
  buildMarketingEmailHtml,
  plainTextToMarketingHtml,
} from "./email/templates/marketingEmails";
import { AuditService } from "./audit.service";

export type MarketingSegment = "all_opted_in" | "role" | "userIds" | "emails";

export interface MarketingRecipient {
  userId: string;
  email: string;
  firstName?: string;
  unsubscribeToken: string;
}

export interface ResolveSegmentInput {
  segment: MarketingSegment;
  roles?: string[];
  userIds?: string[];
  emails?: string[];
  /** When true, allow raw emails not linked to users (still uncommon for marketing). Default false. */
  allowRawEmails?: boolean;
  limit?: number;
}

export interface SendMarketingInput extends ResolveSegmentInput {
  adminId: string;
  subject: string;
  message?: string;
  html?: string;
  dryRun?: boolean;
}

const MAX_RECIPIENTS = 500;
const SEND_PACE_MS = 75;

function publicWebBase(): string {
  return (
    process.env.PUBLIC_WEB_URL ||
    process.env.FRONTEND_URL ||
    process.env.APP_PUBLIC_URL ||
    "https://jevahapp.com"
  ).replace(/\/$/, "");
}

function apiPublicBase(): string {
  return (
    process.env.API_BASE_URL ||
    process.env.PUBLIC_API_URL ||
    ""
  ).replace(/\/$/, "");
}

export function newUnsubscribeToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

/** Prefer web page URL; API fallback for clients that hit the backend directly. */
export function buildUnsubscribeUrl(token: string): string {
  const web = publicWebBase();
  const api = apiPublicBase();
  if (web) {
    return `${web}/email/unsubscribe?token=${encodeURIComponent(token)}`;
  }
  if (api) {
    return `${api}/api/email/unsubscribe?token=${encodeURIComponent(token)}`;
  }
  return `https://jevahapp.com/email/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** Opted-in = enabled !== false (missing field counts as opted-in). */
export function marketingOptedInFilter(): Record<string, any> {
  return {
    email: { $exists: true, $nin: [null, ""] },
    isBanned: { $ne: true },
    $or: [
      { "marketingEmails.enabled": { $exists: false } },
      { "marketingEmails.enabled": true },
    ],
  };
}

export async function ensureUnsubscribeToken(userId: string): Promise<string> {
  const user = await User.findById(userId).select("marketingEmails");
  if (!user) throw new Error("User not found");
  const existing = (user as any).marketingEmails?.unsubscribeToken;
  if (existing) return String(existing);

  const token = newUnsubscribeToken();
  await User.findByIdAndUpdate(userId, {
    $set: {
      "marketingEmails.unsubscribeToken": token,
      "marketingEmails.enabled":
        (user as any).marketingEmails?.enabled !== false,
    },
  });
  return token;
}

export async function setMarketingEmailEnabled(
  userId: string,
  enabled: boolean
): Promise<{ enabled: boolean; unsubscribedAt: Date | null }> {
  const token = await ensureUnsubscribeToken(userId);
  const update: Record<string, any> = {
    "marketingEmails.enabled": enabled,
    "marketingEmails.unsubscribeToken": token,
  };
  if (!enabled) {
    update["marketingEmails.unsubscribedAt"] = new Date();
  } else {
    update["marketingEmails.unsubscribedAt"] = null;
  }
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: update },
    { new: true }
  ).select("marketingEmails");
  return {
    enabled: (user as any)?.marketingEmails?.enabled !== false,
    unsubscribedAt: (user as any)?.marketingEmails?.unsubscribedAt || null,
  };
}

export async function unsubscribeByToken(token: string): Promise<{
  ok: boolean;
  emailMasked?: string;
  alreadyUnsubscribed?: boolean;
}> {
  if (!token || typeof token !== "string" || token.length < 16) {
    return { ok: false };
  }
  const user = await User.findOne({
    "marketingEmails.unsubscribeToken": token,
  }).select("email marketingEmails");
  if (!user) return { ok: false };

  const already =
    (user as any).marketingEmails?.enabled === false &&
    Boolean((user as any).marketingEmails?.unsubscribedAt);

  if (!already) {
    (user as any).marketingEmails = {
      ...(user as any).marketingEmails,
      enabled: false,
      unsubscribedAt: new Date(),
      unsubscribeToken: token,
    };
    await user.save();
  }

  const email = String(user.email || "");
  const masked = email
    ? email.replace(/(^.).*(@.*$)/, (_, a, b) => `${a}***${b}`)
    : undefined;

  return { ok: true, emailMasked: masked, alreadyUnsubscribed: already };
}

export async function getUnsubscribeStatus(token: string): Promise<{
  ok: boolean;
  enabled?: boolean;
  emailMasked?: string;
}> {
  if (!token || typeof token !== "string") return { ok: false };
  const user = await User.findOne({
    "marketingEmails.unsubscribeToken": token,
  }).select("email marketingEmails");
  if (!user) return { ok: false };
  const email = String(user.email || "");
  return {
    ok: true,
    enabled: (user as any).marketingEmails?.enabled !== false,
    emailMasked: email
      ? email.replace(/(^.).*(@.*$)/, (_, a, b) => `${a}***${b}`)
      : undefined,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function resolveSegment(
  input: ResolveSegmentInput
): Promise<MarketingRecipient[]> {
  const limit = Math.min(
    Math.max(input.limit || MAX_RECIPIENTS, 1),
    MAX_RECIPIENTS
  );
  const base = marketingOptedInFilter();
  let query: Record<string, any> = { ...base };

  if (input.segment === "role") {
    const roles = (input.roles || []).map((r) => String(r).toLowerCase());
    if (!roles.length) {
      throw new Error("roles is required when segment is 'role'");
    }
    query.role = { $in: roles };
  } else if (input.segment === "userIds") {
    const ids = (input.userIds || []).filter((id) => Types.ObjectId.isValid(id));
    if (!ids.length) {
      throw new Error("userIds is required when segment is 'userIds'");
    }
    query._id = { $in: ids.map((id) => new Types.ObjectId(id)) };
  } else if (input.segment === "emails") {
    const emails = (input.emails || [])
      .filter((e) => typeof e === "string" && e.includes("@"))
      .map((e) => e.trim().toLowerCase());
    if (!emails.length) {
      throw new Error("emails is required when segment is 'emails'");
    }
    query.email = { $in: emails };
  } else if (input.segment !== "all_opted_in") {
    throw new Error(
      "segment must be one of: all_opted_in, role, userIds, emails"
    );
  }

  // Optional role filter also applies to all_opted_in / emails when provided
  if (
    input.segment !== "role" &&
    Array.isArray(input.roles) &&
    input.roles.length > 0
  ) {
    query.role = {
      $in: input.roles.map((r) => String(r).toLowerCase()),
    };
  }

  const users = await User.find(query)
    .select("email firstName marketingEmails")
    .limit(limit)
    .lean();

  const recipients: MarketingRecipient[] = [];
  for (const u of users as any[]) {
    if (!u.email) continue;
    let token = u.marketingEmails?.unsubscribeToken;
    if (!token) {
      token = await ensureUnsubscribeToken(String(u._id));
    }
    recipients.push({
      userId: String(u._id),
      email: String(u.email).toLowerCase(),
      firstName: u.firstName || undefined,
      unsubscribeToken: token,
    });
  }

  // Raw emails only when explicitly allowed and segment is emails
  if (
    input.segment === "emails" &&
    input.allowRawEmails === true &&
    Array.isArray(input.emails)
  ) {
    const known = new Set(recipients.map((r) => r.email));
    for (const raw of input.emails) {
      if (recipients.length >= limit) break;
      const email = String(raw || "")
        .trim()
        .toLowerCase();
      if (!email.includes("@") || known.has(email)) continue;
      // Cannot unsubscribe raw non-users via token — skip for compliance
      logger.warn("Skipping raw marketing email without user record", {
        email,
      });
    }
  }

  return recipients;
}

export async function previewMarketingCount(
  input: ResolveSegmentInput
): Promise<{ count: number; sample: string[] }> {
  const recipients = await resolveSegment(input);
  return {
    count: recipients.length,
    sample: recipients.slice(0, 20).map((r) => r.email),
  };
}

export async function sendMarketingCampaign(input: SendMarketingInput): Promise<{
  dryRun: boolean;
  sent: number;
  failed: number;
  recipientCount: number;
  recipients: string[];
  results?: Array<{ email: string; ok: boolean; error?: string }>;
}> {
  const subject = String(input.subject || "").trim();
  if (!subject) throw new Error("subject is required");

  const hasMessage =
    typeof input.message === "string" && input.message.trim().length > 0;
  const hasHtml =
    typeof input.html === "string" && input.html.trim().length > 0;
  if (!hasMessage && !hasHtml) {
    throw new Error("message or html body is required");
  }

  const recipients = await resolveSegment(input);
  if (recipients.length === 0) {
    throw new Error("No opted-in recipients matched this segment");
  }
  if (recipients.length > MAX_RECIPIENTS) {
    throw new Error(`Maximum ${MAX_RECIPIENTS} recipients per request`);
  }

  const dryRun = input.dryRun === true;
  const bodyInner = hasHtml
    ? String(input.html)
    : plainTextToMarketingHtml(String(input.message));

  if (dryRun) {
    await AdminEmailLog.create({
      adminId: new Types.ObjectId(input.adminId),
      subject,
      recipientCount: recipients.length,
      recipientsSample: recipients.slice(0, 20).map((r) => r.email),
      dryRun: true,
      sent: 0,
      failed: 0,
      meta: {
        kind: "marketing",
        segment: input.segment,
        roles: input.roles,
      },
    });
    await AuditService.logAdminAction(
      input.adminId,
      "send_marketing_email_dry_run",
      undefined,
      {
        subject,
        recipientCount: recipients.length,
        segment: input.segment,
      }
    );
    return {
      dryRun: true,
      sent: 0,
      failed: 0,
      recipientCount: recipients.length,
      recipients: recipients.slice(0, 50).map((r) => r.email),
    };
  }

  const results: Array<{ email: string; ok: boolean; error?: string }> = [];
  for (const r of recipients) {
    try {
      const html = buildMarketingEmailHtml({
        subject,
        bodyHtml: bodyInner,
        firstName: r.firstName,
        unsubscribeUrl: buildUnsubscribeUrl(r.unsubscribeToken),
      });
      await resendEmailService.sendEmail({
        to: r.email,
        subject,
        html,
      });
      results.push({ email: r.email, ok: true });
    } catch (err: any) {
      results.push({
        email: r.email,
        ok: false,
        error: err?.message || "send failed",
      });
    }
    await sleep(SEND_PACE_MS);
  }

  const sent = results.filter((x) => x.ok).length;
  const failed = results.length - sent;

  await AdminEmailLog.create({
    adminId: new Types.ObjectId(input.adminId),
    subject,
    recipientCount: recipients.length,
    recipientsSample: recipients.slice(0, 20).map((r) => r.email),
    dryRun: false,
    sent,
    failed,
    meta: {
      kind: "marketing",
      segment: input.segment,
      roles: input.roles,
    },
  });

  await AuditService.logAdminAction(
    input.adminId,
    "send_marketing_email",
    undefined,
    {
      subject,
      recipientCount: recipients.length,
      sent,
      failed,
      segment: input.segment,
    }
  );

  return {
    dryRun: false,
    sent,
    failed,
    recipientCount: recipients.length,
    recipients: recipients.slice(0, 50).map((r) => r.email),
    results,
  };
}

export const MARKETING_EMAIL_MAX_RECIPIENTS = MAX_RECIPIENTS;
