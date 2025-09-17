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
          return true;
        }
      }

      if (this.fallbackEnabled) {
        logger.info("Testing SMTP fallback connection...");
        const { testEmailConnection } = await import("../utils/mailer");
        const smtpConnected = await testEmailConnection();
        if (smtpConnected) {
          logger.info("✅ SMTP fallback connection successful");
          return true;
        }
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
    // Try Resend first
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
          logger.info("Trying SMTP fallback for verification email...");
          return this.sendVerificationEmailSMTP(email, firstName, code);
        } else {
          throw error;
        }
      }
    }

    // Use SMTP directly if Resend not configured
    return this.sendVerificationEmailSMTP(email, firstName, code);
  }

  /**
   * Send verification email via SMTP
   */
  private async sendVerificationEmailSMTP(
    email: string,
    firstName: string,
    code: string
  ): Promise<EmailResult> {
    try {
      const { sendVerificationEmail } = await import("../utils/mailer");
      const result = await sendVerificationEmail(email, firstName, code);

      logger.info("✅ Verification email sent via SMTP", {
        email,
        messageId: result.messageId,
      });

      return {
        success: true,
        messageId: result.messageId,
        service: "smtp",
      };
    } catch (error) {
      logger.error("❌ SMTP verification email failed:", error);
      return {
        success: false,
        service: "smtp",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Send password reset email with fallback
   */
  async sendPasswordResetEmail(
    email: string,
    firstName: string,
    resetCode: string
  ): Promise<EmailResult> {
    // Try Resend first
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
          logger.info("Trying SMTP fallback for password reset email...");
          return this.sendPasswordResetEmailSMTP(email, firstName, resetCode);
        } else {
          throw error;
        }
      }
    }

    // Use SMTP directly if Resend not configured
    return this.sendPasswordResetEmailSMTP(email, firstName, resetCode);
  }

  /**
   * Send password reset email via SMTP
   */
  private async sendPasswordResetEmailSMTP(
    email: string,
    firstName: string,
    resetCode: string
  ): Promise<EmailResult> {
    try {
      const { sendResetPasswordEmail } = await import("../utils/mailer");
      const result = await sendResetPasswordEmail(email, firstName, resetCode);

      logger.info("✅ Password reset email sent via SMTP", {
        email,
        messageId: result.messageId,
      });

      return {
        success: true,
        messageId: result.messageId,
        service: "smtp",
      };
    } catch (error) {
      logger.error("❌ SMTP password reset email failed:", error);
      return {
        success: false,
        service: "smtp",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Send welcome email with fallback
   */
  async sendWelcomeEmail(
    email: string,
    firstName: string
  ): Promise<EmailResult> {
    // Try Resend first
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
          logger.info("Trying SMTP fallback for welcome email...");
          return this.sendWelcomeEmailSMTP(email, firstName);
        } else {
          throw error;
        }
      }
    }

    // Use SMTP directly if Resend not configured
    return this.sendWelcomeEmailSMTP(email, firstName);
  }

  /**
   * Send welcome email via SMTP
   */
  private async sendWelcomeEmailSMTP(
    email: string,
    firstName: string
  ): Promise<EmailResult> {
    try {
      const { sendWelcomeEmail } = await import("../utils/mailer");
      const result = await sendWelcomeEmail(email, firstName);

      logger.info("✅ Welcome email sent via SMTP", {
        email,
        messageId: result.messageId,
      });

      return {
        success: true,
        messageId: result.messageId,
        service: "smtp",
      };
    } catch (error) {
      logger.error("❌ SMTP welcome email failed:", error);
      return {
        success: false,
        service: "smtp",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get email service status
   */
  getServiceStatus() {
    return {
      resendConfigured: this.useResend,
      fallbackEnabled: this.fallbackEnabled,
      primaryService: this.useResend ? "resend" : "smtp",
      resendApiKey: this.useResend ? "configured" : "not configured",
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
