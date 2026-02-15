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
  // SMTP fallback is disabled to enforce Resend-only delivery
  private fallbackEnabled = false;

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

      // Resend-only mode: do not attempt SMTP fallback

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
    // Resend-only mode
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
        // Fallback disabled
        throw error;
      }
    }

    // Resend not configured and fallback disabled
    throw new Error(
      "Resend is not configured (RESEND_API_KEY missing) and SMTP fallback is disabled"
    );
  }

  /**
   * Send verification email via SMTP
   */
  private async sendVerificationEmailSMTP(
    email: string,
    firstName: string,
    code: string
  ): Promise<EmailResult> {
    // SMTP path disabled in Resend-only mode
    throw new Error(
      "SMTP (Zoho) is disabled. Resend is the only email provider in use."
    );
  }

  /**
   * Send password reset email with fallback
   */
  async sendPasswordResetEmail(
    email: string,
    firstName: string,
    resetCode: string
  ): Promise<EmailResult> {
    // Resend-only mode
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
        // Fallback disabled
        throw error;
      }
    }

    // Resend not configured and fallback disabled
    throw new Error(
      "Resend is not configured (RESEND_API_KEY missing) and SMTP fallback is disabled"
    );
  }

  /**
   * Send password reset email via SMTP
   */
  private async sendPasswordResetEmailSMTP(
    email: string,
    firstName: string,
    resetCode: string
  ): Promise<EmailResult> {
    // SMTP path disabled in Resend-only mode
    throw new Error(
      "SMTP (Zoho) is disabled. Resend is the only email provider in use."
    );
  }

  /**
   * Send welcome email with fallback
   */
  async sendWelcomeEmail(
    email: string,
    firstName: string
  ): Promise<EmailResult> {
    // Resend-only mode
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
        // Fallback disabled
        throw error;
      }
    }

    // Resend not configured and fallback disabled
    throw new Error(
      "Resend is not configured (RESEND_API_KEY missing) and SMTP fallback is disabled"
    );
  }

  /**
   * Send welcome email via SMTP
   */
  private async sendWelcomeEmailSMTP(
    email: string,
    firstName: string
  ): Promise<EmailResult> {
    // SMTP path disabled in Resend-only mode
    throw new Error(
      "SMTP (Zoho) is disabled. Resend is the only email provider in use."
    );
  }

  /**
   * Get email service status
   */
  getServiceStatus() {
    return {
      resendConfigured: this.useResend,
      fallbackEnabled: false,
      primaryService: "resend",
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
