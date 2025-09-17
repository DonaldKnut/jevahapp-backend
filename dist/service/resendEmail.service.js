"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const resend_1 = require("resend");
// Initialize Resend conditionally
const resend = process.env.RESEND_API_KEY
    ? new resend_1.Resend(process.env.RESEND_API_KEY)
    : null;
class ResendEmailService {
    constructor() {
        this.fromEmail = "support@jevahapp.com";
        this.fromName = "Jevah Support";
    }
    /**
     * Test Resend connection
     */
    testConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!process.env.RESEND_API_KEY) {
                    console.log("⚠️ RESEND_API_KEY is not configured - Resend service disabled");
                    return false;
                }
                if (!resend) {
                    console.log("⚠️ Resend client not initialized");
                    return false;
                }
                // Test with a simple API call
                const response = yield resend.domains.list();
                console.log("✅ Resend connection verified successfully");
                return true;
            }
            catch (error) {
                console.error("❌ Resend connection failed:", error);
                return false;
            }
        });
    }
    /**
     * Send email using Resend
     */
    sendEmail(_a) {
        return __awaiter(this, arguments, void 0, function* ({ to, subject, html, from }) {
            var _b;
            try {
                if (!resend) {
                    throw new Error("Resend client not initialized - API key missing");
                }
                const response = yield resend.emails.send({
                    from: from || `${this.fromName} <${this.fromEmail}>`,
                    to: [to],
                    subject,
                    html,
                });
                console.log("✅ Email sent successfully via Resend:", {
                    id: (_b = response.data) === null || _b === void 0 ? void 0 : _b.id,
                    to,
                    subject,
                });
                return response;
            }
            catch (error) {
                console.error("❌ Resend email send failed:", error);
                throw new Error(`Failed to send email via Resend: ${error}`);
            }
        });
    }
    /**
     * Generate verification email HTML
     */
    generateVerificationEmail(firstName, code) {
        return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Verify Your Email - Jevah</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

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
        border: 1px solid rgba(249, 200, 51, 0.2);
      }

      .header {
        padding: 40px 40px 20px;
        text-align: center;
        border-bottom: 1px solid rgba(249, 200, 51, 0.1);
      }

      .logo-container {
        margin-bottom: 24px;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .logo {
        height: 60px;
        width: auto;
      }

      .verify-title {
        font-size: 28px;
        font-weight: 600;
        color: #f9c833;
        letter-spacing: -0.5px;
      }

      .content {
        padding: 32px 40px;
      }

      .greeting {
        font-size: 18px;
        margin-bottom: 16px;
        color: #ffffff;
        font-weight: 500;
      }

      .highlight {
        color: #f9c833;
        font-weight: 600;
      }

      .instruction {
        font-size: 16px;
        margin-bottom: 32px;
        color: #b8b8b8;
        line-height: 1.6;
      }

      .verification-code {
        background: #112e2a;
        border: 1px solid #f9c833;
        border-radius: 8px;
        padding: 24px;
        margin: 32px 0;
        text-align: center;
      }

      .code-text {
        font-size: 32px;
        font-weight: 600;
        color: #f9c833;
        letter-spacing: 4px;
        font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
      }

      .expiry-notice {
        background: rgba(249, 200, 51, 0.08);
        border-left: 3px solid #f9c833;
        padding: 16px 20px;
        margin: 24px 0;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .expiry-icon {
        font-size: 18px;
      }

      .expiry-text {
        color: #e0e0e0;
        font-size: 14px;
        font-weight: 500;
      }

      .security-notice {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        padding: 16px 20px;
        margin: 24px 0;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .security-icon {
        font-size: 18px;
      }

      .security-text {
        color: #b8b8b8;
        font-size: 14px;
        font-weight: 500;
      }

      .divider {
        height: 1px;
        background: rgba(249, 200, 51, 0.2);
        margin: 32px 0;
      }

      .footer {
        padding: 24px 40px 32px;
        text-align: center;
        border-top: 1px solid rgba(249, 200, 51, 0.1);
      }

      .footer-address {
        color: #8a8a8a;
        font-size: 13px;
        margin-bottom: 16px;
        line-height: 1.5;
        font-weight: 400;
      }

      .help-links {
        display: flex;
        justify-content: center;
        gap: 24px;
        flex-wrap: wrap;
      }

      .help-link {
        color: #f9c833;
        text-decoration: none;
        font-size: 13px;
        font-weight: 500;
        transition: color 0.2s ease;
      }

      .help-link:hover {
        color: #ffd700;
      }

      @media (max-width: 600px) {
        body {
          padding: 12px;
        }

        .email-container {
          border-radius: 8px;
        }

        .header,
        .content,
        .footer {
          padding-left: 24px;
          padding-right: 24px;
        }

        .verify-title {
          font-size: 24px;
        }

        .code-text {
          font-size: 28px;
          letter-spacing: 3px;
        }
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="header">
        <div class="logo-container">
          <img
            src="https://res.cloudinary.com/ddgzzjp4x/image/upload/v1755907362/jevah-hq-removebg-preview_tv9rtc.png"
            alt="Jevah Logo"
            class="logo"
          />
        </div>

        <h1 class="verify-title">Email Verification</h1>
      </div>

      <div class="content">
        <p class="greeting">
          Hi <span class="highlight">${firstName}</span>,
        </p>
        <p class="instruction">
          To complete your account setup, please use the verification code below
          to verify your email address:
        </p>

        <div class="verification-code">
          <div class="code-text">${code}</div>
        </div>

        <div class="expiry-notice">
          <span class="expiry-icon">⏰</span>
          <span class="expiry-text">
            <strong>Code expires in 15 minutes</strong> for security purposes.
            If you don't verify within this time, you'll need to request a new
            code.
          </span>
        </div>

        <div class="security-notice">
          <span class="security-icon">🔒</span>
          <span class="security-text">
            <strong>Security Notice:</strong> If you didn't request this
            verification code, please ignore this email. Your account security
            is important to us.
          </span>
        </div>

        <div class="divider"></div>
      </div>

      <div class="footer">
        <p class="footer-address">
          23A, Bashorun Okusanya Street, Off Admiralty Road, Off Admiralty
          Wy,<br />
          Lekki Phase 1, Lagos, Nigeria
        </p>
        <div class="help-links">
          <a href="#" class="help-link">Need Help?</a>
          <a href="#" class="help-link">Contact Support</a>
          <a href="#" class="help-link">Privacy Policy</a>
        </div>
      </div>
    </div>
  </body>
</html>`;
    }
    /**
     * Generate password reset email HTML
     */
    generatePasswordResetEmail(firstName, resetCode) {
        return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reset Your Password - Jevah</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

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
        border: 1px solid rgba(249, 200, 51, 0.2);
      }

      .header {
        padding: 40px 40px 20px;
        text-align: center;
        border-bottom: 1px solid rgba(249, 200, 51, 0.1);
      }

      .logo-container {
        margin-bottom: 24px;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .logo {
        height: 60px;
        width: auto;
      }

      .reset-title {
        font-size: 28px;
        font-weight: 600;
        color: #f9c833;
        letter-spacing: -0.5px;
      }

      .content {
        padding: 32px 40px;
      }

      .greeting {
        font-size: 18px;
        margin-bottom: 16px;
        color: #ffffff;
        font-weight: 500;
      }

      .highlight {
        color: #f9c833;
        font-weight: 600;
      }

      .instruction {
        font-size: 16px;
        margin-bottom: 32px;
        color: #b8b8b8;
        line-height: 1.6;
      }

      .verification-code {
        background: #112e2a;
        border: 1px solid #f9c833;
        border-radius: 8px;
        padding: 24px;
        margin: 32px 0;
        text-align: center;
      }

      .code-text {
        font-size: 32px;
        font-weight: 600;
        color: #f9c833;
        letter-spacing: 4px;
        font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
      }

      .expiry-notice {
        background: rgba(249, 200, 51, 0.08);
        border-left: 3px solid #f9c833;
        padding: 16px 20px;
        margin: 24px 0;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .expiry-icon {
        font-size: 18px;
      }

      .expiry-text {
        color: #e0e0e0;
        font-size: 14px;
        font-weight: 500;
      }

      .security-notice {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        padding: 16px 20px;
        margin: 24px 0;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .security-icon {
        font-size: 18px;
      }

      .security-text {
        color: #b8b8b8;
        font-size: 14px;
        font-weight: 500;
      }

      .divider {
        height: 1px;
        background: rgba(249, 200, 51, 0.2);
        margin: 32px 0;
      }

      .footer {
        padding: 24px 40px 32px;
        text-align: center;
        border-top: 1px solid rgba(249, 200, 51, 0.1);
      }

      .footer-address {
        color: #8a8a8a;
        font-size: 13px;
        margin-bottom: 16px;
        line-height: 1.5;
        font-weight: 400;
      }

      .help-links {
        display: flex;
        justify-content: center;
        gap: 24px;
        flex-wrap: wrap;
      }

      .help-link {
        color: #f9c833;
        text-decoration: none;
        font-size: 13px;
        font-weight: 500;
        transition: color 0.2s ease;
      }

      .help-link:hover {
        color: #ffd700;
      }

      @media (max-width: 600px) {
        body {
          padding: 12px;
        }

        .email-container {
          border-radius: 8px;
        }

        .header,
        .content,
        .footer {
          padding-left: 24px;
          padding-right: 24px;
        }

        .reset-title {
          font-size: 24px;
        }

        .code-text {
          font-size: 28px;
          letter-spacing: 3px;
        }
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="header">
        <div class="logo-container">
          <img
            src="https://res.cloudinary.com/ddgzzjp4x/image/upload/v1755907362/jevah-hq-removebg-preview_tv9rtc.png"
            alt="Jevah Logo"
            class="logo"
          />
        </div>

        <h1 class="reset-title">Password Reset</h1>
      </div>

      <div class="content">
        <p class="greeting">
          Hi <span class="highlight">${firstName}</span>,
        </p>
        <p class="instruction">
          We received a request to reset your password. Use the verification
          code below to securely reset your password in your app:
        </p>

        <div class="verification-code">
          <div class="code-text">${resetCode}</div>
        </div>

        <div class="expiry-notice">
          <span class="expiry-icon">⏰</span>
          <span class="expiry-text">
            <strong>Code expires in 10 minutes</strong> for security purposes.
            If you don't reset your password within this time, you'll need to
            request a new code.
          </span>
        </div>

        <div class="security-notice">
          <span class="security-icon">🔒</span>
          <span class="security-text">
            <strong>Security Notice:</strong> If you didn't request this
            verification code, please ignore this email. Your account security
            is important to us.
          </span>
        </div>

        <div class="divider"></div>
      </div>

      <div class="footer">
        <p class="footer-address">
          23A, Bashorun Okusanya Street, Off Admiralty Road, Off Admiralty
          Wy,<br />
          Lekki Phase 1, Lagos, Nigeria
        </p>
        <div class="help-links">
          <a href="#" class="help-link">Need Help?</a>
          <a href="#" class="help-link">Contact Support</a>
          <a href="#" class="help-link">Security Center</a>
        </div>
      </div>
    </div>
  </body>
</html>`;
    }
    /**
     * Generate welcome email HTML
     */
    generateWelcomeEmail(firstName) {
        return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome to Jevah</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

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
        border: 1px solid rgba(249, 200, 51, 0.2);
      }

      .header {
        padding: 40px 40px 20px;
        text-align: center;
        border-bottom: 1px solid rgba(249, 200, 51, 0.1);
      }

      .logo-container {
        margin-bottom: 24px;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .logo {
        height: 60px;
        width: auto;
      }

      .welcome-title {
        font-size: 28px;
        font-weight: 600;
        color: #f9c833;
        letter-spacing: -0.5px;
      }

      .content {
        padding: 32px 40px;
      }

      .greeting {
        font-size: 18px;
        margin-bottom: 16px;
        color: #ffffff;
        font-weight: 500;
      }

      .highlight {
        color: #f9c833;
        font-weight: 600;
      }

      .welcome-message {
        font-size: 16px;
        margin-bottom: 32px;
        color: #b8b8b8;
        line-height: 1.6;
      }

      .features {
        margin: 32px 0;
      }

      .feature-item {
        display: flex;
        align-items: center;
        margin: 12px 0;
        padding: 16px;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 6px;
        border-left: 3px solid #f9c833;
      }

      .feature-icon {
        font-size: 20px;
        margin-right: 12px;
      }

      .feature-text {
        color: #e0e0e0;
        font-size: 14px;
        font-weight: 500;
      }

      .cta-button {
        display: inline-block;
        background: #f9c833;
        color: #0a1f1c;
        padding: 14px 28px;
        border-radius: 6px;
        text-decoration: none;
        font-weight: 600;
        font-size: 15px;
        margin: 24px 0;
        transition: background-color 0.2s ease;
      }

      .cta-button:hover {
        background: #ffd700;
      }

      .divider {
        height: 1px;
        background: rgba(249, 200, 51, 0.2);
        margin: 32px 0;
      }

      .footer {
        padding: 24px 40px 32px;
        text-align: center;
        border-top: 1px solid rgba(249, 200, 51, 0.1);
      }

      .footer-address {
        color: #8a8a8a;
        font-size: 13px;
        margin-bottom: 16px;
        line-height: 1.5;
        font-weight: 400;
      }

      .help-links {
        display: flex;
        justify-content: center;
        gap: 24px;
        flex-wrap: wrap;
      }

      .help-link {
        color: #f9c833;
        text-decoration: none;
        font-size: 13px;
        font-weight: 500;
        transition: color 0.2s ease;
      }

      .help-link:hover {
        color: #ffd700;
      }

      @media (max-width: 600px) {
        body {
          padding: 12px;
        }

        .email-container {
          border-radius: 8px;
        }

        .header,
        .content,
        .footer {
          padding-left: 24px;
          padding-right: 24px;
        }

        .welcome-title {
          font-size: 24px;
        }
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="header">
        <div class="logo-container">
          <img
            src="https://res.cloudinary.com/ddgzzjp4x/image/upload/v1755907362/jevah-hq-removebg-preview_tv9rtc.png"
            alt="Jevah Logo"
            class="logo"
          />
        </div>

        <h1 class="welcome-title">Welcome to Jevah! 🎉</h1>
      </div>

      <div class="content">
        <p class="greeting">
          Hi <span class="highlight">${firstName}</span>,
        </p>
        <p class="welcome-message">
          Welcome to Jevah! We're thrilled to have you join our community of believers. 
          Your spiritual journey starts here, and we're here to support you every step of the way.
        </p>

        <div class="features">
          <div class="feature-item">
            <span class="feature-icon">🎵</span>
            <span class="feature-text">Access thousands of gospel music and sermons</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">📖</span>
            <span class="feature-text">Read inspiring devotionals and Bible studies</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">👥</span>
            <span class="feature-text">Connect with fellow believers in our community</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">📱</span>
            <span class="feature-text">Download content for offline listening</span>
          </div>
        </div>

        <div style="text-align: center;">
          <a href="#" class="cta-button">Start Your Journey</a>
        </div>

        <div class="divider"></div>
      </div>

      <div class="footer">
        <p class="footer-address">
          23A, Bashorun Okusanya Street, Off Admiralty Road, Off Admiralty
          Wy,<br />
          Lekki Phase 1, Lagos, Nigeria
        </p>
        <div class="help-links">
          <a href="#" class="help-link">Need Help?</a>
          <a href="#" class="help-link">Contact Support</a>
          <a href="#" class="help-link">Privacy Policy</a>
        </div>
      </div>
    </div>
  </body>
</html>`;
    }
    /**
     * Send verification email
     */
    sendVerificationEmail(email, firstName, code) {
        return __awaiter(this, void 0, void 0, function* () {
            const html = this.generateVerificationEmail(firstName, code);
            return this.sendEmail({
                to: email,
                subject: "Verify Your Email Address - Jevah",
                html,
            });
        });
    }
    /**
     * Send password reset email
     */
    sendPasswordResetEmail(email, firstName, resetCode) {
        return __awaiter(this, void 0, void 0, function* () {
            const html = this.generatePasswordResetEmail(firstName, resetCode);
            return this.sendEmail({
                to: email,
                subject: "Reset Your Password - Verification Code",
                html,
            });
        });
    }
    /**
     * Send welcome email
     */
    sendWelcomeEmail(email, firstName) {
        return __awaiter(this, void 0, void 0, function* () {
            const html = this.generateWelcomeEmail(firstName);
            return this.sendEmail({
                to: email,
                subject: "Welcome to Jevah! 🎉",
                html,
            });
        });
    }
}
exports.default = new ResendEmailService();
