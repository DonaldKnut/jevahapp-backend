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
        border: 1px solid rgba(255, 107, 53, 0.2);
      }

      .header {
        padding: 40px 40px 20px;
        text-align: center;
        border-bottom: 1px solid rgba(255, 107, 53, 0.1);
      }

      .logo-container {
        margin-bottom: 24px;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .logo {
        height: 120px;
        width: auto;
        display: block;
        margin: 0 auto;
      }

      .verify-title {
        font-size: 28px;
        font-weight: 600;
        color: #ff6b35;
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
        color: #ff6b35;
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
        border: 1px solid #ff6b35;
        border-radius: 8px;
        padding: 24px;
        margin: 32px 0;
        text-align: center;
      }

      .code-text {
        font-size: 32px;
        font-weight: 600;
        color: #ff6b35;
        letter-spacing: 4px;
        font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
      }

      .expiry-notice {
        background: rgba(255, 107, 53, 0.08);
        border-left: 3px solid #ff6b35;
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
        background: rgba(255, 107, 53, 0.2);
        margin: 32px 0;
      }

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
        font-weight: 400;
      }

      .help-links {
        display: flex;
        justify-content: center;
        gap: 24px;
        flex-wrap: wrap;
      }

      .help-link {
        color: #ff6b35;
        text-decoration: none;
        font-size: 13px;
        font-weight: 500;
        transition: color 0.2s ease;
      }

      .help-link:hover {
        color: #ff8c42;
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
        border: 1px solid rgba(255, 107, 53, 0.2);
      }

      .header {
        padding: 40px 40px 20px;
        text-align: center;
        border-bottom: 1px solid rgba(255, 107, 53, 0.1);
      }

      .logo-container {
        margin-bottom: 24px;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .logo {
        height: 120px;
        width: auto;
        display: block;
        margin: 0 auto;
      }

      .reset-title {
        font-size: 28px;
        font-weight: 600;
        color: #ff6b35;
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
        color: #ff6b35;
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
        border: 1px solid #ff6b35;
        border-radius: 8px;
        padding: 24px;
        margin: 32px 0;
        text-align: center;
      }

      .code-text {
        font-size: 32px;
        font-weight: 600;
        color: #ff6b35;
        letter-spacing: 4px;
        font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
      }

      .expiry-notice {
        background: rgba(255, 107, 53, 0.08);
        border-left: 3px solid #ff6b35;
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
        background: rgba(255, 107, 53, 0.2);
        margin: 32px 0;
      }

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
        font-weight: 400;
      }

      .help-links {
        display: flex;
        justify-content: center;
        gap: 24px;
        flex-wrap: wrap;
      }

      .help-link {
        color: #ff6b35;
        text-decoration: none;
        font-size: 13px;
        font-weight: 500;
        transition: color 0.2s ease;
      }

      .help-link:hover {
        color: #ff8c42;
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
        border: 1px solid rgba(255, 107, 53, 0.2);
      }

      .header {
        padding: 40px 40px 20px;
        text-align: center;
        border-bottom: 1px solid rgba(255, 107, 53, 0.1);
      }

      .logo-container {
        margin-bottom: 24px;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .logo {
        height: 120px;
        width: auto;
        display: block;
        margin: 0 auto;
      }

      .welcome-title {
        font-size: 28px;
        font-weight: 600;
        color: #ff6b35;
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
        color: #ff6b35;
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
        border-left: 3px solid #ff6b35;
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
        background: #ff6b35;
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
        background: #ff8c42;
      }

      .divider {
        height: 1px;
        background: rgba(255, 107, 53, 0.2);
        margin: 32px 0;
      }

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
        font-weight: 400;
      }

      .help-links {
        display: flex;
        justify-content: center;
        gap: 24px;
        flex-wrap: wrap;
      }

      .help-link {
        color: #ff6b35;
        text-decoration: none;
        font-size: 13px;
        font-weight: 500;
        transition: color 0.2s ease;
      }

      .help-link:hover {
        color: #ff8c42;
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
    /**
     * Generate content removed email HTML
     */
    generateContentRemovedEmail(firstName, contentTitle, reason, flags) {
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
    generateAdminModerationAlertEmail(mediaTitle, contentType, uploadedBy, moderationResult, reportCount) {
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
            ${moderationResult.flags.map((flag) => `<span style="display: inline-block; background: rgba(255, 107, 53, 0.15); color: #ff6b35; padding: 4px 8px; border-radius: 4px; font-size: 11px; margin: 2px;">${flag}</span>`).join('')}
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
    sendContentRemovedEmail(email, firstName, contentTitle, reason, flags) {
        return __awaiter(this, void 0, void 0, function* () {
            const html = this.generateContentRemovedEmail(firstName, contentTitle, reason, flags);
            return this.sendEmail({
                to: email,
                subject: "Content Removed from Jevah Platform",
                html,
            });
        });
    }
    /**
     * Send moderation alert to admins
     */
    sendAdminModerationAlert(adminEmails, mediaTitle, contentType, uploadedBy, moderationResult, reportCount) {
        return __awaiter(this, void 0, void 0, function* () {
            const html = this.generateAdminModerationAlertEmail(mediaTitle, contentType, uploadedBy, moderationResult, reportCount);
            // Send to all admins
            const results = yield Promise.allSettled(adminEmails.map(email => this.sendEmail({
                to: email,
                subject: `⚠️ Content Moderation Alert: ${mediaTitle}`,
                html,
            })));
            return results;
        });
    }
    /**
     * Generate admin report notification email HTML
     */
    generateAdminReportNotificationEmail(mediaTitle, contentType, uploadedBy, reporterName, reportReason, reportDescription, mediaId, reportCount) {
        const reasonLabels = {
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
    sendAdminReportNotification(adminEmails, mediaTitle, contentType, uploadedBy, reporterName, reportReason, reportDescription, mediaId, reportCount) {
        return __awaiter(this, void 0, void 0, function* () {
            const html = this.generateAdminReportNotificationEmail(mediaTitle, contentType, uploadedBy, reporterName, reportReason, reportDescription, mediaId, reportCount);
            // Send to all admins
            const results = yield Promise.allSettled(adminEmails.map(email => this.sendEmail({
                to: email,
                subject: `📋 New Report: ${mediaTitle} (${reportCount} ${reportCount === 1 ? 'report' : 'reports'})`,
                html,
            })));
            return results;
        });
    }
}
exports.default = new ResendEmailService();
