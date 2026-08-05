import fs from "fs";
import path from "path";

const root = process.cwd();
const bakPath = path.join(root, "src/service/resendEmail.service.ts.bak");
const srcPath = path.join(root, "src/service/resendEmail.service.ts");

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

function findMethod(name) {
  const re = new RegExp(`^\\s*(async\\s+)?${name}\\(`);
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) return i + 1;
  }
  throw new Error("method not found: " + name);
}

/** Extract a class method by brace matching (1-indexed start line of method). */
function extractMethod(name) {
  const start = findMethod(name);
  let depth = 0;
  let started = false;
  let end = start;
  for (let i = start - 1; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === "{") {
        depth++;
        started = true;
      } else if (ch === "}") {
        depth--;
      }
    }
    if (started && depth === 0) {
      end = i + 1;
      break;
    }
  }
  const block = lines.slice(start - 1, end).join("\n");
  // dedent 2 spaces, export
  let out = block
    .split("\n")
    .map(l => (l.startsWith("  ") ? l.slice(2) : l))
    .join("\n")
    .trim();
  if (!out.startsWith("export ")) out = "export " + out;
  return out + "\n";
}

write(
  "src/service/email/types.ts",
  `export interface EmailTemplate {
  subject: string;
  html: string;
}

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  from?: string;
}
`
);

write(
  "src/service/email/resendClient.ts",
  `import { Resend } from "resend";
import nodemailer from "nodemailer";
import type { EmailData } from "./types";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

function resolveResendFromEmail(): string {
  const raw =
    process.env.RESEND_FROM_EMAIL ||
    process.env.ADMIN_EMAIL_FROM ||
    "support@jevahapp.com";
  return raw.trim();
}

const fromEmail = resolveResendFromEmail();
const fromName = "Jevah Support";
const smtpTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.zoho.com",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER || "support@jevahapp.com",
    pass: process.env.SMTP_PASS || "",
  },
});
const smtpFromName = process.env.SMTP_FROM_NAME || "Jevah Support";
const smtpFromEmail = process.env.SMTP_USER || "support@jevahapp.com";

export async function testConnection(): Promise<boolean> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.log(
        "⚠️ RESEND_API_KEY is not configured - Resend service disabled"
      );
      return false;
    }
    if (!resend) {
      console.log("⚠️ Resend client not initialized");
      return false;
    }
    await resend.domains.list();
    console.log("✅ Resend connection verified successfully");
    return true;
  } catch (error) {
    console.error("❌ Resend connection failed:", error);
    return false;
  }
}

export async function sendEmail({ to, subject, html, from }: EmailData) {
  try {
    if (!resend) {
      throw new Error("Resend client not initialized - API key missing");
    }
    const response = await resend.emails.send({
      from: from || \`\${fromName} <\${fromEmail}>\`,
      to: [to],
      subject,
      html,
    });
    if (response.error) {
      throw new Error(
        \`Resend rejected email: \${response.error.message || "Unknown error"}\`
      );
    }
    console.log("✅ Email sent successfully via Resend:", {
      id: response.data?.id,
      to,
      subject,
    });
    return response;
  } catch (error) {
    console.error("❌ Resend email send failed:", error);
    try {
      console.warn("⚠️ Retrying email via SMTP fallback...", { to, subject });
      const smtpInfo = await smtpTransporter.sendMail({
        from: from || \`"\${smtpFromName}" <\${smtpFromEmail}>\`,
        to,
        subject,
        html,
      });
      console.log("✅ Email sent successfully via SMTP fallback:", {
        id: smtpInfo.messageId,
        to,
        subject,
      });
      return { data: { id: smtpInfo.messageId }, error: null };
    } catch (smtpError) {
      console.error("❌ SMTP fallback email send failed:", smtpError);
      throw new Error(
        \`Failed to send email via Resend and SMTP fallback: \${smtpError}\`
      );
    }
  }
}
`
);

write(
  "src/service/email/templates/authEmails.ts",
  `import { renderEmailTemplate } from "../../../emails/render";

export function generateVerificationEmail(firstName: string, code: string): string {
  return renderEmailTemplate("verify", { firstName, code });
}

export function generatePasswordResetEmail(firstName: string, resetCode: string): string {
  return renderEmailTemplate("reset", { firstName, resetCode });
}

export function generateWelcomeEmail(firstName: string): string {
  return renderEmailTemplate("welcome", { firstName });
}
`
);

write(
  "src/service/email/templates/moderationEmails.ts",
  extractMethod("generateContentRemovedEmail") +
    "\n" +
    extractMethod("generateAdminModerationAlertEmail")
);

write(
  "src/service/email/templates/reportEmails.ts",
  extractMethod("generateAdminReportNotificationEmail") +
    "\n" +
    extractMethod("generateAdminCommentReportNotificationEmail")
);

write(
  "src/service/resendEmail.service.ts",
  `import type { EmailData, EmailTemplate } from "./email/types";
import {
  sendEmail as sendEmailCore,
  testConnection as testConnectionCore,
} from "./email/resendClient";
import {
  generateVerificationEmail as genVerify,
  generatePasswordResetEmail as genReset,
  generateWelcomeEmail as genWelcome,
} from "./email/templates/authEmails";
import {
  generateContentRemovedEmail as genRemoved,
  generateAdminModerationAlertEmail as genModAlert,
} from "./email/templates/moderationEmails";
import {
  generateAdminReportNotificationEmail as genReport,
  generateAdminCommentReportNotificationEmail as genCommentReport,
} from "./email/templates/reportEmails";

export type { EmailData, EmailTemplate };

class ResendEmailService {
  async testConnection(): Promise<boolean> {
    return testConnectionCore();
  }

  async sendEmail(data: EmailData) {
    return sendEmailCore(data);
  }

  generateVerificationEmail(firstName: string, code: string): string {
    return genVerify(firstName, code);
  }

  generatePasswordResetEmail(firstName: string, resetCode: string): string {
    return genReset(firstName, resetCode);
  }

  generateWelcomeEmail(firstName: string): string {
    return genWelcome(firstName);
  }

  async sendVerificationEmail(email: string, firstName: string, code: string) {
    const html = this.generateVerificationEmail(firstName, code);
    return this.sendEmail({
      to: email,
      subject: "Verify Your Email Address - Jevah",
      html,
    });
  }

  async sendPasswordResetEmail(
    email: string,
    firstName: string,
    resetCode: string
  ) {
    const html = this.generatePasswordResetEmail(firstName, resetCode);
    return this.sendEmail({
      to: email,
      subject: "Reset Your Password - Verification Code",
      html,
    });
  }

  async sendWelcomeEmail(email: string, firstName: string) {
    const html = this.generateWelcomeEmail(firstName);
    return this.sendEmail({
      to: email,
      subject: "Welcome to Jevah! 🎉",
      html,
    });
  }

  generateContentRemovedEmail(
    firstName: string,
    contentTitle: string,
    reason: string,
    flags: string[]
  ): string {
    return genRemoved(firstName, contentTitle, reason, flags);
  }

  generateAdminModerationAlertEmail(
    mediaTitle: string,
    contentType: string,
    uploadedBy: string,
    moderationResult: any,
    reportCount?: number
  ): string {
    return genModAlert(
      mediaTitle,
      contentType,
      uploadedBy,
      moderationResult,
      reportCount
    );
  }

  async sendContentRemovedEmail(
    email: string,
    firstName: string,
    contentTitle: string,
    reason: string,
    flags: string[]
  ) {
    const html = this.generateContentRemovedEmail(
      firstName,
      contentTitle,
      reason,
      flags
    );
    return this.sendEmail({
      to: email,
      subject: "Content Removed from Jevah Platform",
      html,
    });
  }

  async sendAdminModerationAlert(
    adminEmails: string[],
    mediaTitle: string,
    contentType: string,
    uploadedBy: string,
    moderationResult: any,
    reportCount?: number
  ) {
    const html = this.generateAdminModerationAlertEmail(
      mediaTitle,
      contentType,
      uploadedBy,
      moderationResult,
      reportCount
    );
    return Promise.allSettled(
      adminEmails.map(email =>
        this.sendEmail({
          to: email,
          subject: \`⚠️ Content Moderation Alert: \${mediaTitle}\`,
          html,
        })
      )
    );
  }

  generateAdminReportNotificationEmail(
    mediaTitle: string,
    contentType: string,
    uploadedBy: string,
    reporterName: string,
    reportReason: string,
    reportDescription: string | undefined,
    mediaId: string,
    reportCount: number
  ): string {
    return genReport(
      mediaTitle,
      contentType,
      uploadedBy,
      reporterName,
      reportReason,
      reportDescription,
      mediaId,
      reportCount
    );
  }

  async sendAdminReportNotification(
    adminEmails: string[],
    mediaTitle: string,
    contentType: string,
    uploadedBy: string,
    reporterName: string,
    reportReason: string,
    reportDescription: string | undefined,
    mediaId: string,
    reportCount: number
  ) {
    const html = this.generateAdminReportNotificationEmail(
      mediaTitle,
      contentType,
      uploadedBy,
      reporterName,
      reportReason,
      reportDescription,
      mediaId,
      reportCount
    );
    return Promise.allSettled(
      adminEmails.map(email =>
        this.sendEmail({
          to: email,
          subject: \`📋 New Report: \${mediaTitle} (\${reportCount} \${
            reportCount === 1 ? "report" : "reports"
          })\`,
          html,
        })
      )
    );
  }

  generateAdminCommentReportNotificationEmail(
    commentContent: string,
    mediaTitle: string,
    contentType: string,
    commentAuthorEmail: string,
    commentAuthorName: string,
    reporterName: string,
    reportReason: string,
    reportDescription: string | undefined,
    commentId: string,
    mediaId: string,
    reportCount: number
  ): string {
    return genCommentReport(
      commentContent,
      mediaTitle,
      contentType,
      commentAuthorEmail,
      commentAuthorName,
      reporterName,
      reportReason,
      reportDescription,
      commentId,
      mediaId,
      reportCount
    );
  }

  async sendAdminCommentReportNotification(
    adminEmails: string[],
    commentContent: string,
    mediaTitle: string,
    contentType: string,
    commentAuthorEmail: string,
    commentAuthorName: string,
    reporterName: string,
    reportReason: string,
    reportDescription: string | undefined,
    commentId: string,
    mediaId: string,
    reportCount: number
  ) {
    const html = this.generateAdminCommentReportNotificationEmail(
      commentContent,
      mediaTitle,
      contentType,
      commentAuthorEmail,
      commentAuthorName,
      reporterName,
      reportReason,
      reportDescription,
      commentId,
      mediaId,
      reportCount
    );
    return Promise.allSettled(
      adminEmails.map(email =>
        this.sendEmail({
          to: email,
          subject: \`💬 New Comment Report: \${mediaTitle} (\${reportCount} \${
            reportCount === 1 ? "report" : "reports"
          })\`,
          html,
        })
      )
    );
  }
}

export default new ResendEmailService();
`
);

console.log("done resend");
