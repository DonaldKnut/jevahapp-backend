#!/usr/bin/env node

/**
 * Resend Email Setup Test Script
 *
 * This script tests the Resend email service configuration and sends test emails.
 *
 * Usage: node test-resend-setup.js [--test-email=email@example.com]
 */

require("dotenv").config();

async function testResendSetup() {
  console.log("🧪 TESTING RESEND EMAIL SETUP");
  console.log("==============================");

  // Check environment variables
  console.log("\n📋 Environment Check:");
  console.log(
    `RESEND_API_KEY: ${process.env.RESEND_API_KEY ? "✅ Configured" : "❌ Missing"}`
  );
  console.log(
    `RESEND_FROM_EMAIL: ${process.env.RESEND_FROM_EMAIL || "support@jevahapp.com"}`
  );
  console.log(
    `SMTP_USER: ${process.env.SMTP_USER ? "✅ Configured" : "❌ Missing"}`
  );

  if (!process.env.RESEND_API_KEY) {
    console.log("\n❌ RESEND_API_KEY is not configured!");
    console.log("Please add RESEND_API_KEY to your .env file");
    return;
  }

  try {
    // Import the email service
    const emailService = require("./dist/service/email.service").default;

    console.log("\n🔗 Testing Email Service Connection...");
    const isConnected = await emailService.testConnection();

    if (!isConnected) {
      console.log("❌ Email service connection failed");
      return;
    }

    console.log("\n📊 Email Service Status:");
    const status = emailService.getServiceStatus();
    console.log(`Primary Service: ${status.primaryService}`);
    console.log(`Resend Configured: ${status.resendConfigured ? "✅" : "❌"}`);
    console.log(`Fallback Enabled: ${status.fallbackEnabled ? "✅" : "❌"}`);

    // Get test email from command line arguments
    const testEmail = process.argv
      .find(arg => arg.startsWith("--test-email="))
      ?.split("=")[1];

    if (!testEmail) {
      console.log(
        "\n⚠️  No test email provided. Use --test-email=your@email.com to send test emails"
      );
      console.log("✅ Setup test completed successfully!");
      return;
    }

    console.log(`\n📧 Sending test emails to: ${testEmail}`);

    // Test verification email
    console.log("\n1️⃣ Testing verification email...");
    try {
      const verificationResult = await emailService.sendVerificationEmail(
        testEmail,
        "Test User",
        "123456"
      );

      if (verificationResult.success) {
        console.log(
          `✅ Verification email sent via ${verificationResult.service}`
        );
        console.log(`   Message ID: ${verificationResult.messageId}`);
      } else {
        console.log(
          `❌ Verification email failed: ${verificationResult.error}`
        );
      }
    } catch (error) {
      console.log(`❌ Verification email error: ${error.message}`);
    }

    // Wait a bit between emails
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test password reset email
    console.log("\n2️⃣ Testing password reset email...");
    try {
      const resetResult = await emailService.sendPasswordResetEmail(
        testEmail,
        "Test User",
        "789012"
      );

      if (resetResult.success) {
        console.log(`✅ Password reset email sent via ${resetResult.service}`);
        console.log(`   Message ID: ${resetResult.messageId}`);
      } else {
        console.log(`❌ Password reset email failed: ${resetResult.error}`);
      }
    } catch (error) {
      console.log(`❌ Password reset email error: ${error.message}`);
    }

    // Wait a bit between emails
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test welcome email
    console.log("\n3️⃣ Testing welcome email...");
    try {
      const welcomeResult = await emailService.sendWelcomeEmail(
        testEmail,
        "Test User"
      );

      if (welcomeResult.success) {
        console.log(`✅ Welcome email sent via ${welcomeResult.service}`);
        console.log(`   Message ID: ${welcomeResult.messageId}`);
      } else {
        console.log(`❌ Welcome email failed: ${welcomeResult.error}`);
      }
    } catch (error) {
      console.log(`❌ Welcome email error: ${error.message}`);
    }

    console.log("\n🎉 Email setup test completed!");
    console.log("Check your email inbox for the test messages.");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
  }
}

// Run the test
testResendSetup().catch(console.error);
