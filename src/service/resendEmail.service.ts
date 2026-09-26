import type { EmailData, EmailTemplate } from "./email/types";
import {
  sendEmail as sendEmailCore,
  testConnection as testConnectionCore,
} from "./email/resendClient";
import {
  generateVerificationEmail as genVerify,
  generatePasswordResetEmail as genReset,
  generateWelcomeEmail as genWelcome,
  type WelcomeEmailVariant,
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

  generateVerificationEmail(
    firstName: string,
    code: string,
    verifyLink?: string
  ): string {
    return genVerify(firstName, code, verifyLink);
  }

  generatePasswordResetEmail(
    firstName: string,
    resetCode: string,
    resetUrl?: string
  ): string {
    return genReset(firstName, resetCode, resetUrl);
  }

  generateWelcomeEmail(
    firstName: string,
    variant: WelcomeEmailVariant = "default"
  ): string {
    return genWelcome(firstName, variant);
  }

  async sendVerificationEmail(
    email: string,
    firstName: string,
    code: string,
    verifyLink?: string
  ) {
    const html = this.generateVerificationEmail(firstName, code, verifyLink);
    return this.sendEmail({
      to: email,
      subject: "Verify your Jevah account",
      html,
    });
  }

  async sendPasswordResetEmail(
    email: string,
    firstName: string,
    resetCode: string,
    resetUrl?: string
  ) {
    const html = this.generatePasswordResetEmail(firstName, resetCode, resetUrl);
    return this.sendEmail({
      to: email,
      subject: "Reset your Jevah password",
      html,
    });
  }

  async sendWelcomeEmail(
    email: string,
    firstName: string,
    variant: WelcomeEmailVariant = "default"
  ) {
    const html = this.generateWelcomeEmail(firstName, variant);
    const subject =
      variant === "artist"
        ? "You're in — apply as a creator"
        : "Welcome to Jevah! 🎉";
    return this.sendEmail({
      to: email,
      subject,
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
          subject: `⚠️ Content Moderation Alert: ${mediaTitle}`,
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
          subject: `📋 New Report: ${mediaTitle} (${reportCount} ${
            reportCount === 1 ? "report" : "reports"
          })`,
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
          subject: `💬 New Comment Report: ${mediaTitle} (${reportCount} ${
            reportCount === 1 ? "report" : "reports"
          })`,
          html,
        })
      )
    );
  }
}

export default new ResendEmailService();
