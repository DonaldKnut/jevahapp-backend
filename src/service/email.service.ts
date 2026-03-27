import nodemailer from "nodemailer";
import resendEmailService from "./resendEmail.service";
import logger from "../utils/logger";

interface EmailResult {
  success: boolean;
  messageId?: string;
  service: "resend" | "smtp";
  error?: string;
}

class EmailService {
  private useResend = !!process.env.RESEND_API_KEY;
  private fallbackEnabled = true;
  private smtpTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.zoho.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER || "support@jevahapp.com",
      pass: process.env.SMTP_PASS || "",
    },
  });
  private smtpFromName = process.env.SMTP_FROM_NAME || "Jevah Support";
  private smtpFromEmail = process.env.SMTP_USER || "support@jevahapp.com";

  /**
   * Test email connection
   */
  async testConnection(): Promise<boolean> {
    try {
      if (this.useResend) {
        logger.info("Testing Resend connection...");
        const resendConnected = await resendEmailService.testConnection();
        if (resendConnected) {
          logger.info("✅ Resend connection successful");
          return true; // Primary provider healthy
        }
      }

      if (this.fallbackEnabled) {
        logger.info("Testing SMTP connection...");
        await this.smtpTransporter.verify();
        logger.info("✅ SMTP connection successful");
        return true;
      }

      logger.error("❌ All email connections failed");
      return false;
    } catch (error) {
      logger.error("❌ Email connection test failed:", error);
      return false;
    }
  }

  /**
   * Send verification email with fallback
   */
  async sendVerificationEmail(
    email: string,
    firstName: string,
    code: string
  ): Promise<EmailResult> {
    if (this.useResend) {
      try {
        logger.info("Sending verification email via Resend...", { email });
        const result = await resendEmailService.sendVerificationEmail(
          email,
          firstName,
          code
        );

        logger.info("✅ Verification email sent via Resend", {
          email,
          messageId: result.data?.id,
        });

        return {
          success: true,
          messageId: result.data?.id,
          service: "resend",
        };
      } catch (error) {
        logger.error("❌ Resend verification email failed:", error);
        if (this.fallbackEnabled) {
          logger.warn("Retrying verification email via SMTP fallback...", {
            email,
          });
          return this.sendVerificationEmailSMTP(email, firstName, code);
        }
        throw error;
      }
    }

    if (this.fallbackEnabled) {
      return this.sendVerificationEmailSMTP(email, firstName, code);
    }

    throw new Error("No email provider configured");
  }

  /**
   * Send verification email via SMTP
   */
  private async sendVerificationEmailSMTP(
    email: string,
    firstName: string,
    code: string
  ): Promise<EmailResult> {
    const html = resendEmailService.generateVerificationEmail(firstName, code);
    const info = await this.smtpTransporter.sendMail({
      from: `"${this.smtpFromName}" <${this.smtpFromEmail}>`,
      to: email,
      subject: "Verify Your Email Address - Jevah",
      html,
    });
    logger.info("✅ Verification email sent via SMTP", {
      email,
      messageId: info.messageId,
    });
    return {
      success: true,
      messageId: info.messageId,
      service: "smtp",
    };
  }

  /**
   * Send password reset email with fallback
   */
  async sendPasswordResetEmail(
    email: string,
    firstName: string,
    resetCode: string
  ): Promise<EmailResult> {
    if (this.useResend) {
      try {
        logger.info("Sending password reset email via Resend...", { email });
        const result = await resendEmailService.sendPasswordResetEmail(
          email,
          firstName,
          resetCode
        );

        logger.info("✅ Password reset email sent via Resend", {
          email,
          messageId: result.data?.id,
        });

        return {
          success: true,
          messageId: result.data?.id,
          service: "resend",
        };
      } catch (error) {
        logger.error("❌ Resend password reset email failed:", error);
        if (this.fallbackEnabled) {
          logger.warn("Retrying password reset email via SMTP fallback...", {
            email,
          });
          return this.sendPasswordResetEmailSMTP(email, firstName, resetCode);
        }
        throw error;
      }
    }

    if (this.fallbackEnabled) {
      return this.sendPasswordResetEmailSMTP(email, firstName, resetCode);
    }

    throw new Error("No email provider configured");
  }

  /**
   * Send password reset email via SMTP
   */
  private async sendPasswordResetEmailSMTP(
    email: string,
    firstName: string,
    resetCode: string
  ): Promise<EmailResult> {
    const html = resendEmailService.generatePasswordResetEmail(
      firstName,
      resetCode
    );
    const info = await this.smtpTransporter.sendMail({
      from: `"${this.smtpFromName}" <${this.smtpFromEmail}>`,
      to: email,
      subject: "Reset Your Password - Verification Code",
      html,
    });
    logger.info("✅ Password reset email sent via SMTP", {
      email,
      messageId: info.messageId,
    });
    return {
      success: true,
      messageId: info.messageId,
      service: "smtp",
    };
  }

  /**
   * Send welcome email with fallback
   */
  async sendWelcomeEmail(
    email: string,
    firstName: string
  ): Promise<EmailResult> {
    if (this.useResend) {
      try {
        logger.info("Sending welcome email via Resend...", { email });
        const result = await resendEmailService.sendWelcomeEmail(
          email,
          firstName
        );

        logger.info("✅ Welcome email sent via Resend", {
          email,
          messageId: result.data?.id,
        });

        return {
          success: true,
          messageId: result.data?.id,
          service: "resend",
        };
      } catch (error) {
        logger.error("❌ Resend welcome email failed:", error);
        if (this.fallbackEnabled) {
          logger.warn("Retrying welcome email via SMTP fallback...", { email });
          return this.sendWelcomeEmailSMTP(email, firstName);
        }
        throw error;
      }
    }

    if (this.fallbackEnabled) {
      return this.sendWelcomeEmailSMTP(email, firstName);
    }

    throw new Error("No email provider configured");
  }

  /**
   * Send welcome email via SMTP
   */
  private async sendWelcomeEmailSMTP(
    email: string,
    firstName: string
  ): Promise<EmailResult> {
    const html = resendEmailService.generateWelcomeEmail(firstName);
    const info = await this.smtpTransporter.sendMail({
      from: `"${this.smtpFromName}" <${this.smtpFromEmail}>`,
      to: email,
      subject: "Welcome to Jevah! 🎉",
      html,
    });
    logger.info("✅ Welcome email sent via SMTP", {
      email,
      messageId: info.messageId,
    });
    return {
      success: true,
      messageId: info.messageId,
      service: "smtp",
    };
  }

  /**
   * Get email service status
   */
  getServiceStatus() {
    return {
      resendConfigured: this.useResend,
      fallbackEnabled: this.fallbackEnabled,
      primaryService: "resend",
      resendApiKey: this.useResend ? "configured" : "not configured",
      smtpConfigured: !!process.env.SMTP_USER && !!process.env.SMTP_PASS,
    };
  }

  /**
   * Enable/disable fallback
   */
  setFallbackEnabled(enabled: boolean) {
    this.fallbackEnabled = enabled;
    logger.info(`Email fallback ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Force use specific service
   */
  async forceService(service: "resend" | "smtp") {
    if (service === "resend" && !this.useResend) {
      throw new Error("Resend is not configured");
    }

    const originalUseResend = this.useResend;
    const originalFallback = this.fallbackEnabled;

    if (service === "resend") {
      this.useResend = true;
      this.fallbackEnabled = false;
    } else {
      this.useResend = false;
      this.fallbackEnabled = false;
    }

    logger.info(`Forced email service to: ${service}`);

    return () => {
      this.useResend = originalUseResend;
      this.fallbackEnabled = originalFallback;
      logger.info("Restored original email service configuration");
    };
  }
}

export default new EmailService();
