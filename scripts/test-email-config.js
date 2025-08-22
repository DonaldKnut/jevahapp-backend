#!/usr/bin/env node

/**
 * Email Configuration Test Script
 *
 * This script helps diagnose email configuration issues, especially for Zoho SMTP.
 * Run this script to test your email setup before deploying to production.
 */

const nodemailer = require("nodemailer");
require("dotenv").config();

const testEmailConfiguration = async () => {
  console.log("🔍 Testing Email Configuration...\n");

  // Check environment variables
  console.log("📋 Environment Variables:");
  console.log(
    `  SMTP_HOST: ${process.env.SMTP_HOST || "smtp.zoho.com (default)"}`
  );
  console.log(`  SMTP_PORT: ${process.env.SMTP_PORT || "587 (default)"}`);
  console.log(`  SMTP_SECURE: ${process.env.SMTP_SECURE || "false (default)"}`);
  console.log(
    `  SMTP_USER: ${process.env.SMTP_USER || "support@jevahapp.com (default)"}`
  );
  console.log(
    `  SMTP_PASS: ${process.env.SMTP_PASS ? "***SET***" : "***NOT SET***"}`
  );
  console.log("");

  if (!process.env.SMTP_PASS) {
    console.error("❌ SMTP_PASS environment variable is not set!");
    console.log(
      "Please set your Zoho app password in the SMTP_PASS environment variable."
    );
    process.exit(1);
  }

  // Create transporter
  const transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST || "smtp.zoho.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER || "support@jevahapp.com",
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
    debug: true,
    logger: true,
  });

  try {
    console.log("🔌 Testing SMTP Connection...");

    // Test connection
    await transporter.verify();
    console.log("✅ SMTP connection successful!\n");

    // Test sending a simple email
    console.log("📧 Testing Email Sending...");

    const testEmail = {
      from: `"Jevah Support" <${process.env.SMTP_USER || "support@jevahapp.com"}>`,
      to: process.env.TEST_EMAIL || "test@example.com",
      subject: "Email Configuration Test - Jevah App",
      html: `
        <h1>Email Configuration Test</h1>
        <p>This is a test email to verify your Zoho SMTP configuration is working correctly.</p>
        <p><strong>Configuration Details:</strong></p>
        <ul>
          <li>Host: ${process.env.SMTP_HOST || "smtp.zoho.com"}</li>
          <li>Port: ${process.env.SMTP_PORT || "587"}</li>
          <li>Secure: ${process.env.SMTP_SECURE || "false"}</li>
          <li>User: ${process.env.SMTP_USER || "support@jevahapp.com"}</li>
        </ul>
        <p>If you received this email, your email configuration is working correctly!</p>
        <p>Sent at: ${new Date().toISOString()}</p>
      `,
    };

    const info = await transporter.sendMail(testEmail);
    console.log("✅ Test email sent successfully!");
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   To: ${testEmail.to}`);
    console.log("");

    console.log("🎉 Email configuration is working correctly!");
    console.log("");
    console.log("📝 Next Steps:");
    console.log("1. Deploy your application with these environment variables");
    console.log("2. Monitor email delivery in your Zoho Mail dashboard");
    console.log("3. Check application logs for any email-related errors");
  } catch (error) {
    console.error("❌ Email configuration test failed!");
    console.error("");
    console.error("Error Details:");
    console.error(`  Code: ${error.code}`);
    console.error(`  Message: ${error.message}`);
    console.error("");

    // Provide specific troubleshooting advice
    if (error.code === "EAUTH") {
      console.log("🔧 Troubleshooting - Authentication Failed:");
      console.log(
        "1. Check that SMTP_PASS is set to your Zoho App Password (not your regular password)"
      );
      console.log(
        "2. Verify that SMTP access is enabled in your Zoho Mail settings"
      );
      console.log("3. Ensure the email address exists in your Zoho account");
      console.log("4. Try generating a new App Password in Zoho");
    } else if (error.code === "ECONNECTION") {
      console.log("🔧 Troubleshooting - Connection Failed:");
      console.log("1. Check that SMTP_HOST is correct: smtp.zoho.com");
      console.log(
        "2. Verify that SMTP_PORT is correct: 587 for TLS, 465 for SSL"
      );
      console.log(
        "3. Ensure your firewall allows outbound connections on the SMTP port"
      );
      console.log("4. Check if Zoho services are experiencing downtime");
    } else if (error.code === "ETIMEDOUT") {
      console.log("🔧 Troubleshooting - Connection Timed Out:");
      console.log("1. Check your internet connection");
      console.log("2. Try increasing connection timeout values");
      console.log("3. Check if Zoho servers are responding slowly");
    } else {
      console.log("🔧 General Troubleshooting:");
      console.log("1. Verify all environment variables are set correctly");
      console.log("2. Check Zoho Mail documentation for any recent changes");
      console.log("3. Ensure your Zoho account is active and not suspended");
      console.log("4. Try testing with a different email client first");
    }

    console.log("");
    console.log("📚 Additional Resources:");
    console.log(
      "- Zoho Mail SMTP Settings: https://help.zoho.com/portal/en/kb/mail/smtp-settings"
    );
    console.log("- Nodemailer Documentation: https://nodemailer.com/smtp/");
    console.log("- Jevah Email Setup Guide: ZOHO_EMAIL_SETUP.md");

    process.exit(1);
  }
};

// Run the test
testEmailConfiguration().catch(console.error);
