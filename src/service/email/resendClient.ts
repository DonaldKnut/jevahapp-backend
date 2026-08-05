import { Resend } from "resend";
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
      from: from || `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      html,
    });
    if (response.error) {
      throw new Error(
        `Resend rejected email: ${response.error.message || "Unknown error"}`
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
        from: from || `"${smtpFromName}" <${smtpFromEmail}>`,
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
        `Failed to send email via Resend and SMTP fallback: ${smtpError}`
      );
    }
  }
}
