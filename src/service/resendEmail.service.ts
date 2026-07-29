import { Resend } from "resend";
import nodemailer from "nodemailer";
import { renderEmailTemplate } from "../emails/render";

// Initialize Resend conditionally
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export interface EmailTemplate {
  subject: string;
  html: string;
}

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

class ResendEmailService {
  private readonly fromEmail =
    process.env.RESEND_FROM_EMAIL || "support@jevahapp.com";
  private readonly fromName = "Jevah Support";
  private readonly smtpTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.zoho.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER || "support@jevahapp.com",
      pass: process.env.SMTP_PASS || "",
    },
  });
  private readonly smtpFromName = process.env.SMTP_FROM_NAME || "Jevah Support";
  private readonly smtpFromEmail =
    process.env.SMTP_USER || "support@jevahapp.com";

  /**
   * Test Resend connection
   */
  async testConnection(): Promise<boolean> {
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

      // Test with a simple API call
      const response = await resend.domains.list();
      console.log("✅ Resend connection verified successfully");
      return true;
    } catch (error) {
      console.error("❌ Resend connection failed:", error);
      return false;
    }
  }

  /**
   * Send email using Resend
   */
  async sendEmail({ to, subject, html, from }: EmailData) {
    try {
      if (!resend) {
        throw new Error("Resend client not initialized - API key missing");
      }

      const response = await resend.emails.send({
        from: from || `${this.fromName} <${this.fromEmail}>`,
        to: [to],
        subject,
        html,
      });

      // Resend may return { error } without throwing.
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
        console.warn("⚠️ Retrying email via SMTP fallback...", {
          to,
          subject,
        });
        const smtpInfo = await this.smtpTransporter.sendMail({
          from:
            from || `"${this.smtpFromName}" <${this.smtpFromEmail}>`,
          to,
          subject,
          html,
        });

        console.log("✅ Email sent successfully via SMTP fallback:", {
          id: smtpInfo.messageId,
          to,
          subject,
        });

        // Keep the same response-like shape expected by existing callers.
        return {
          data: { id: smtpInfo.messageId },
          error: null,
        };
      } catch (smtpError) {
        console.error("❌ SMTP fallback email send failed:", smtpError);
        throw new Error(
          `Failed to send email via Resend and SMTP fallback: ${smtpError}`
        );
      }
    }
  }

  /**
   * Generate verification email HTML (EJS template)
   */
  generateVerificationEmail(firstName: string, code: string): string {
    return renderEmailTemplate("verify", { firstName, code });
  }

  /**
   * Generate password reset email HTML (EJS template)
   */
  generatePasswordResetEmail(firstName: string, resetCode: string): string {
    return renderEmailTemplate("reset", { firstName, resetCode });
  }

  /**
   * Generate welcome email HTML (EJS template)
   */
  generateWelcomeEmail(firstName: string): string {
    return renderEmailTemplate("welcome", { firstName });
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(email: string, firstName: string, code: string) {
    const html = this.generateVerificationEmail(firstName, code);

    return this.sendEmail({
      to: email,
      subject: "Verify Your Email Address - Jevah",
      html,
    });
  }

  /**
   * Send password reset email
   */
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

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email: string, firstName: string) {
    const html = this.generateWelcomeEmail(firstName);

    return this.sendEmail({
      to: email,
      subject: "Welcome to Jevah! 🎉",
      html,
    });
  }

  /**
   * Generate content removed email HTML
   */
  generateContentRemovedEmail(
    firstName: string,
    contentTitle: string,
    reason: string,
    flags: string[]
  ): string {
    return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Content Removed - Jevah</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        background: linear-gradient(135deg, #112e2a 0%, #0a1f1c 100%);
        color: #ffffff;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
        margin: 0;
        padding: 20px;
        min-height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .email-container {
        max-width: 600px;
        width: 100%;
        background: #0a1f1c;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid rgba(255, 107, 53, 0.2);
      }
      .header {
        padding: 40px 40px 20px;
        text-align: center;
        border-bottom: 1px solid rgba(255, 107, 53, 0.1);
      }
      .logo { height: 80px; width: auto; display: block; margin: 0 auto 20px; }
      .title {
        font-size: 24px;
        font-weight: 600;
        color: #ff6b35;
        margin-bottom: 8px;
      }
      .content { padding: 32px 40px; }
      .greeting { font-size: 18px; margin-bottom: 16px; color: #ffffff; font-weight: 500; }
      .highlight { color: #ff6b35; font-weight: 600; }
      .message { font-size: 16px; margin-bottom: 24px; color: #b8b8b8; line-height: 1.6; }
      .content-box {
        background: #112e2a;
        border: 1px solid #ff6b35;
        border-radius: 8px;
        padding: 20px;
        margin: 24px 0;
      }
      .content-title { color: #ff6b35; font-weight: 600; margin-bottom: 12px; }
      .reason-box {
        background: rgba(255, 107, 53, 0.08);
        border-left: 3px solid #ff6b35;
        padding: 16px 20px;
        margin: 20px 0;
        border-radius: 4px;
      }
      .reason-title { color: #e0e0e0; font-weight: 600; margin-bottom: 8px; }
      .reason-text { color: #b8b8b8; font-size: 14px; }
      .flags { margin-top: 16px; }
      .flag-item {
        display: inline-block;
        background: rgba(255, 107, 53, 0.15);
        color: #ff6b35;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 12px;
        margin: 4px 4px 4px 0;
      }
      .appeal-box {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        padding: 20px;
        margin: 24px 0;
        border-radius: 4px;
      }
      .appeal-text { color: #b8b8b8; font-size: 14px; line-height: 1.6; }
      .footer {
        padding: 24px 40px 32px;
        text-align: center;
        border-top: 1px solid rgba(255, 107, 53, 0.1);
      }
      .footer-address {
        color: #8a8a8a;
        font-size: 13px;
        margin-bottom: 16px;
        line-height: 1.5;
      }
      @media (max-width: 600px) {
        body { padding: 12px; }
        .header, .content, .footer { padding-left: 24px; padding-right: 24px; }
        .title { font-size: 20px; }
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="header">
        <img
          src="https://res.cloudinary.com/ddgzzjp4x/image/upload/v1755907362/jevah-hq-removebg-preview_tv9rtc.png"
          alt="Jevah Logo"
          class="logo"
        />
        <h1 class="title">Content Removed</h1>
      </div>
      <div class="content">
        <p class="greeting">Hi <span class="highlight">${firstName}</span>,</p>
        <p class="message">
          We wanted to inform you that one of your uploaded content items has been removed from the Jevah platform 
          after review by our content moderation system.
        </p>
        <div class="content-box">
          <div class="content-title">Content Title:</div>
          <div style="color: #e0e0e0;">${contentTitle}</div>
        </div>
        <div class="reason-box">
          <div class="reason-title">Reason for Removal:</div>
          <div class="reason-text">${reason}</div>
          ${flags.length > 0 ? `
          <div class="flags">
            <div style="color: #e0e0e0; font-size: 12px; margin-bottom: 8px;">Issues Detected:</div>
            ${flags.map(flag => `<span class="flag-item">${flag.replace(/_/g, ' ')}</span>`).join('')}
          </div>
          ` : ''}
        </div>
        <div class="appeal-box">
          <div class="appeal-text">
            <strong style="color: #e0e0e0;">Appeal Process:</strong><br/>
            If you believe this removal was made in error, you can appeal this decision by contacting our support team 
            at support@jevahapp.com. Please include the content title and any additional context that may help us review your case.
          </div>
        </div>
        <p class="message" style="margin-top: 24px;">
          We appreciate your understanding and commitment to maintaining a safe, gospel-focused community on Jevah.
        </p>
      </div>
      <div class="footer">
        <p class="footer-address">
          23A, Bashorun Okusanya Street, Off Admiralty Road, Off Admiralty Wy,<br />
          Lekki Phase 1, Lagos, Nigeria
        </p>
      </div>
    </div>
  </body>
</html>`;
  }

  /**
   * Generate admin moderation alert email HTML
   */
  generateAdminModerationAlertEmail(
    mediaTitle: string,
    contentType: string,
    uploadedBy: string,
    moderationResult: any,
    reportCount?: number
  ): string {
    return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Content Moderation Alert - Jevah Admin</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        background: linear-gradient(135deg, #112e2a 0%, #0a1f1c 100%);
        color: #ffffff;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
        margin: 0;
        padding: 20px;
      }
      .email-container {
        max-width: 700px;
        width: 100%;
        background: #0a1f1c;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid rgba(255, 107, 53, 0.2);
        margin: 0 auto;
      }
      .header {
        padding: 30px 40px 20px;
        text-align: center;
        border-bottom: 1px solid rgba(255, 107, 53, 0.1);
        background: rgba(255, 107, 53, 0.05);
      }
      .alert-badge {
        display: inline-block;
        background: #ff6b35;
        color: #0a1f1c;
        padding: 8px 16px;
        border-radius: 20px;
        font-weight: 600;
        font-size: 14px;
        margin-bottom: 16px;
      }
      .title {
        font-size: 24px;
        font-weight: 600;
        color: #ff6b35;
      }
      .content { padding: 32px 40px; }
      .info-row {
        display: flex;
        justify-content: space-between;
        padding: 12px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }
      .info-label { color: #b8b8b8; font-size: 14px; }
      .info-value { color: #ffffff; font-weight: 500; }
      .status-box {
        background: ${moderationResult.isApproved ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)'};
        border-left: 3px solid ${moderationResult.isApproved ? '#4caf50' : '#f44336'};
        padding: 16px 20px;
        margin: 20px 0;
        border-radius: 4px;
      }
      .status-text {
        color: ${moderationResult.isApproved ? '#4caf50' : '#f44336'};
        font-weight: 600;
        font-size: 16px;
      }
      .cta-button {
        display: inline-block;
        background: #ff6b35;
        color: #0a1f1c;
        padding: 12px 24px;
        border-radius: 6px;
        text-decoration: none;
        font-weight: 600;
        margin-top: 20px;
      }
      .footer {
        padding: 24px 40px;
        text-align: center;
        border-top: 1px solid rgba(255, 107, 53, 0.1);
        color: #8a8a8a;
        font-size: 13px;
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="header">
        <div class="alert-badge">⚠️ MODERATION ALERT</div>
        <h1 class="title">Content Requires Review</h1>
      </div>
      <div class="content">
        <div class="info-row">
          <span class="info-label">Content Title:</span>
          <span class="info-value">${mediaTitle}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Content Type:</span>
          <span class="info-value">${contentType}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Uploaded By:</span>
          <span class="info-value">${uploadedBy}</span>
        </div>
        ${reportCount ? `
        <div class="info-row">
          <span class="info-label">User Reports:</span>
          <span class="info-value" style="color: #ff6b35;">${reportCount}</span>
        </div>
        ` : ''}
        <div class="status-box">
          <div class="status-text">
            Status: ${moderationResult.isApproved ? 'APPROVED' : moderationResult.requiresReview ? 'UNDER REVIEW' : 'REJECTED'}
          </div>
          <div style="color: #b8b8b8; font-size: 14px; margin-top: 8px;">
            ${moderationResult.reason || 'No reason provided'}
          </div>
          ${moderationResult.flags && moderationResult.flags.length > 0 ? `
          <div style="margin-top: 12px;">
            <div style="color: #b8b8b8; font-size: 12px; margin-bottom: 6px;">Flags:</div>
            ${moderationResult.flags.map((flag: string) => `<span style="display: inline-block; background: rgba(255, 107, 53, 0.15); color: #ff6b35; padding: 4px 8px; border-radius: 4px; font-size: 11px; margin: 2px;">${flag}</span>`).join('')}
          </div>
          ` : ''}
        </div>
        <div style="text-align: center;">
          <a href="${process.env.ADMIN_DASHBOARD_URL || 'https://admin.jevahapp.com'}/moderation" class="cta-button">
            Review in Dashboard
          </a>
        </div>
      </div>
      <div class="footer">
        Jevah Admin Dashboard - Automated Moderation Alert
      </div>
    </div>
  </body>
</html>`;
  }

  /**
   * Send content removed email to user
   */
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

  /**
   * Send moderation alert to admins
   */
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

    // Send to all admins
    const results = await Promise.allSettled(
      adminEmails.map(email =>
        this.sendEmail({
          to: email,
          subject: `⚠️ Content Moderation Alert: ${mediaTitle}`,
          html,
        })
      )
    );

    return results;
  }

  /**
   * Generate admin report notification email HTML
   */
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
    const reasonLabels: { [key: string]: string } = {
      inappropriate_content: "Inappropriate Content",
      non_gospel_content: "Non-Gospel Content",
      explicit_language: "Explicit Language",
      violence: "Violence",
      sexual_content: "Sexual Content",
      blasphemy: "Blasphemy",
      spam: "Spam",
      copyright: "Copyright Violation",
      other: "Other",
    };

    const reasonLabel = reasonLabels[reportReason] || reportReason;

    return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New Content Report - Jevah Admin</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        background: linear-gradient(135deg, #112e2a 0%, #0a1f1c 100%);
        color: #ffffff;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
        margin: 0;
        padding: 20px;
      }
      .email-container {
        max-width: 700px;
        width: 100%;
        background: #0a1f1c;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid rgba(255, 107, 53, 0.2);
        margin: 0 auto;
      }
      .header {
        padding: 30px 40px 20px;
        text-align: center;
        border-bottom: 1px solid rgba(255, 107, 53, 0.1);
        background: rgba(255, 107, 53, 0.05);
      }
      .alert-badge {
        display: inline-block;
        background: #ff6b35;
        color: #0a1f1c;
        padding: 8px 16px;
        border-radius: 20px;
        font-weight: 600;
        font-size: 14px;
        margin-bottom: 16px;
      }
      .title {
        font-size: 24px;
        font-weight: 600;
        color: #ff6b35;
      }
      .content { padding: 32px 40px; }
      .info-row {
        display: flex;
        justify-content: space-between;
        padding: 12px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }
      .info-label { color: #b8b8b8; font-size: 14px; }
      .info-value { color: #ffffff; font-weight: 500; }
      .report-box {
        background: rgba(255, 107, 53, 0.1);
        border-left: 3px solid #ff6b35;
        padding: 16px 20px;
        margin: 20px 0;
        border-radius: 4px;
      }
      .report-reason {
        color: #ff6b35;
        font-weight: 600;
        font-size: 16px;
        margin-bottom: 8px;
      }
      .report-description {
        color: #b8b8b8;
        font-size: 14px;
        margin-top: 8px;
        white-space: pre-wrap;
      }
      .cta-button {
        display: inline-block;
        background: #ff6b35;
        color: #0a1f1c;
        padding: 12px 24px;
        border-radius: 6px;
        text-decoration: none;
        font-weight: 600;
        margin-top: 20px;
      }
      .footer {
        padding: 24px 40px;
        text-align: center;
        border-top: 1px solid rgba(255, 107, 53, 0.1);
        color: #8a8a8a;
        font-size: 13px;
      }
      .count-badge {
        display: inline-block;
        background: rgba(255, 107, 53, 0.2);
        color: #ff6b35;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
        margin-left: 8px;
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="header">
        <div class="alert-badge">📋 NEW REPORT</div>
        <h1 class="title">Content Reported by User</h1>
      </div>
      <div class="content">
        <div class="info-row">
          <span class="info-label">Content Title:</span>
          <span class="info-value">${mediaTitle}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Content Type:</span>
          <span class="info-value">${contentType}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Uploaded By:</span>
          <span class="info-value">${uploadedBy}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Reported By:</span>
          <span class="info-value">${reporterName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Total Reports:</span>
          <span class="info-value">${reportCount}<span class="count-badge">${reportCount === 1 ? 'NEW' : reportCount >= 3 ? 'URGENT' : 'MULTIPLE'}</span></span>
        </div>
        <div class="report-box">
          <div class="report-reason">Reason: ${reasonLabel}</div>
          ${reportDescription ? `
          <div class="report-description">
            <strong>Description:</strong><br/>
            ${reportDescription}
          </div>
          ` : '<div class="report-description" style="color: #8a8a8a; font-style: italic;">No additional description provided</div>'}
        </div>
        <div style="text-align: center;">
          <a href="${process.env.ADMIN_DASHBOARD_URL || 'https://admin.jevahapp.com'}/reports?mediaId=${mediaId}" class="cta-button">
            Review Report in Dashboard
          </a>
        </div>
      </div>
      <div class="footer">
        Jevah Admin Dashboard - Automated Report Notification
      </div>
    </div>
  </body>
</html>`;
  }

  /**
   * Send report notification to admins (called on every report)
   */
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

    // Send to all admins
    const results = await Promise.allSettled(
      adminEmails.map(email =>
        this.sendEmail({
          to: email,
          subject: `📋 New Report: ${mediaTitle} (${reportCount} ${reportCount === 1 ? 'report' : 'reports'})`,
          html,
        })
      )
    );

    return results;
  }

  /**
   * Generate admin comment report notification email HTML
   */
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
    const reasonLabels: { [key: string]: string } = {
      inappropriate_content: "Inappropriate Content",
      non_gospel_content: "Non-Gospel Content",
      explicit_language: "Explicit Language",
      violence: "Violence",
      sexual_content: "Sexual Content",
      blasphemy: "Blasphemy",
      spam: "Spam",
      copyright: "Copyright Violation",
      other: "Other",
    };

    const reasonLabel = reasonLabels[reportReason] || reportReason;
    const truncatedComment = commentContent.length > 200
      ? commentContent.substring(0, 200) + "..."
      : commentContent;

    return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New Comment Report - Jevah Admin</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        background: linear-gradient(135deg, #112e2a 0%, #0a1f1c 100%);
        color: #ffffff;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
        margin: 0;
        padding: 20px;
      }
      .email-container {
        max-width: 700px;
        width: 100%;
        background: #0a1f1c;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid rgba(255, 107, 53, 0.2);
        margin: 0 auto;
      }
      .header {
        padding: 30px 40px 20px;
        text-align: center;
        border-bottom: 1px solid rgba(255, 107, 53, 0.1);
        background: rgba(255, 107, 53, 0.05);
      }
      .alert-badge {
        display: inline-block;
        background: #ff6b35;
        color: #0a1f1c;
        padding: 8px 16px;
        border-radius: 20px;
        font-weight: 600;
        font-size: 14px;
        margin-bottom: 16px;
      }
      .title {
        font-size: 24px;
        font-weight: 600;
        color: #ff6b35;
      }
      .content { padding: 32px 40px; }
      .info-row {
        display: flex;
        justify-content: space-between;
        padding: 12px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }
      .info-label { color: #b8b8b8; font-size: 14px; }
      .info-value { color: #ffffff; font-weight: 500; }
      .comment-box {
        background: rgba(255, 255, 255, 0.05);
        border-left: 3px solid #4a9eff;
        padding: 16px 20px;
        margin: 20px 0;
        border-radius: 4px;
      }
      .comment-content {
        color: #ffffff;
        font-size: 15px;
        line-height: 1.6;
        white-space: pre-wrap;
        word-wrap: break-word;
      }
      .report-box {
        background: rgba(255, 107, 53, 0.1);
        border-left: 3px solid #ff6b35;
        padding: 16px 20px;
        margin: 20px 0;
        border-radius: 4px;
      }
      .report-reason {
        color: #ff6b35;
        font-weight: 600;
        font-size: 16px;
        margin-bottom: 8px;
      }
      .report-description {
        color: #b8b8b8;
        font-size: 14px;
        margin-top: 8px;
        white-space: pre-wrap;
      }
      .cta-button {
        display: inline-block;
        background: #ff6b35;
        color: #0a1f1c;
        padding: 12px 24px;
        border-radius: 6px;
        text-decoration: none;
        font-weight: 600;
        margin-top: 20px;
      }
      .footer {
        padding: 24px 40px;
        text-align: center;
        border-top: 1px solid rgba(255, 107, 53, 0.1);
        color: #8a8a8a;
        font-size: 13px;
      }
      .count-badge {
        display: inline-block;
        background: rgba(255, 107, 53, 0.2);
        color: #ff6b35;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
        margin-left: 8px;
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="header">
        <div class="alert-badge">💬 NEW COMMENT REPORT</div>
        <h1 class="title">Comment Reported by User</h1>
      </div>
      <div class="content">
        <div class="info-row">
          <span class="info-label">Media Title:</span>
          <span class="info-value">${mediaTitle}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Content Type:</span>
          <span class="info-value">${contentType}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Comment Author:</span>
          <span class="info-value">${commentAuthorName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Reported By:</span>
          <span class="info-value">${reporterName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Total Reports:</span>
          <span class="info-value">${reportCount}<span class="count-badge">${reportCount === 1 ? 'NEW' : reportCount >= 3 ? 'URGENT' : 'MULTIPLE'}</span></span>
        </div>
        <div class="comment-box">
          <div style="color: #4a9eff; font-weight: 600; margin-bottom: 8px; font-size: 14px;">REPORTED COMMENT:</div>
          <div class="comment-content">${truncatedComment}</div>
        </div>
        <div class="report-box">
          <div class="report-reason">Reason: ${reasonLabel}</div>
          ${reportDescription ? `
          <div class="report-description">
            <strong>Description:</strong><br/>
            ${reportDescription}
          </div>
          ` : '<div class="report-description" style="color: #8a8a8a; font-style: italic;">No additional description provided</div>'}
        </div>
        <div style="text-align: center;">
          <a href="${process.env.ADMIN_DASHBOARD_URL || 'https://admin.jevahapp.com'}/reports?commentId=${commentId}&mediaId=${mediaId}" class="cta-button">
            Review Comment Report in Dashboard
          </a>
        </div>
      </div>
      <div class="footer">
        Jevah Admin Dashboard - Automated Comment Report Notification
      </div>
    </div>
  </body>
</html>`;
  }

  /**
   * Send comment report notification to admins (called on every report)
   */
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

    // Send to all admins
    const results = await Promise.allSettled(
      adminEmails.map((email) =>
        this.sendEmail({
          to: email,
          subject: `💬 New Comment Report: ${mediaTitle} (${reportCount} ${reportCount === 1 ? 'report' : 'reports'})`,
          html,
        })
      )
    );

    return results;
  }
}

export default new ResendEmailService();
