#!/usr/bin/env node

/**
 * Email Configuration Test Script
 * 
 * This script tests the email configuration to ensure emails can be sent
 * from the Jevah backend. It tests both SMTP connection and actual email sending.
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('🔍 Testing Email Configuration...\n');

// Check environment variables
console.log('📋 Environment Variables:');
console.log(`  SMTP_HOST: ${process.env.SMTP_HOST || 'NOT SET'}`);
console.log(`  SMTP_PORT: ${process.env.SMTP_PORT || 'NOT SET'}`);
console.log(`  SMTP_SECURE: ${process.env.SMTP_SECURE || 'NOT SET'}`);
console.log(`  SMTP_USER: ${process.env.SMTP_USER || 'NOT SET'}`);
console.log(`  SMTP_PASS: ${process.env.SMTP_PASS ? '***SET***' : 'NOT SET'}`);

// Validate required environment variables
const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.log('\n❌ Missing required environment variables:');
  missingVars.forEach(varName => console.log(`  - ${varName}`));
  console.log('\n💡 Please set these variables in your .env file');
  process.exit(1);
}

console.log('\n✅ All required environment variables are set');

// Test email configuration
async function testEmailConfiguration() {
  try {
    console.log('\n🔧 Creating email transporter...');
    
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // Add connection timeout and other settings for better reliability
      connectionTimeout: 60000, // 60 seconds
      greetingTimeout: 30000, // 30 seconds
      socketTimeout: 60000, // 60 seconds
      // Enable debug logging in development
      debug: process.env.NODE_ENV === 'development',
      logger: process.env.NODE_ENV === 'development',
    });

    console.log('✅ Transporter created successfully');

    // Test connection
    console.log('\n🔗 Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully');

    // Test sending a simple email
    console.log('\n📧 Testing email sending...');
    
    const testEmail = {
      from: `"Jevah Test" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER, // Send to ourselves for testing
      subject: '🧪 Jevah Email Configuration Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a4a4a;">Jevah Email Test</h2>
          <p>This is a test email to verify that the Jevah backend email configuration is working correctly.</p>
          <p><strong>Test Details:</strong></p>
          <ul>
            <li>SMTP Host: ${process.env.SMTP_HOST}</li>
            <li>SMTP Port: ${process.env.SMTP_PORT}</li>
            <li>SMTP User: ${process.env.SMTP_USER}</li>
            <li>Test Time: ${new Date().toISOString()}</li>
          </ul>
          <p style="color: #FF6B35; font-weight: bold;">✅ If you receive this email, the email configuration is working!</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(testEmail);
    console.log('✅ Test email sent successfully!');
    console.log(`📧 Message ID: ${info.messageId}`);
    console.log(`📧 Response: ${info.response}`);

    console.log('\n🎉 Email configuration test completed successfully!');
    console.log('📧 Check your email inbox for the test message.');

  } catch (error) {
    console.error('\n❌ Email configuration test failed:');
    console.error('Error:', error.message);
    
    // Provide specific troubleshooting advice
    if (error.code === 'EAUTH') {
      console.log('\n🔧 Troubleshooting - Authentication Error:');
      console.log('1. Check your SMTP_USER and SMTP_PASS credentials');
      console.log('2. Ensure your Zoho account has SMTP access enabled');
      console.log('3. Verify that the password is correct (not an app password)');
      console.log('4. Check if your Zoho account has any security restrictions');
    } else if (error.code === 'ECONNECTION') {
      console.log('\n🔧 Troubleshooting - Connection Error:');
      console.log('1. Check your internet connection');
      console.log('2. Verify SMTP_HOST and SMTP_PORT are correct');
      console.log('3. Check if your firewall is blocking the connection');
      console.log('4. Try using port 465 with secure: true');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('\n🔧 Troubleshooting - Timeout Error:');
      console.log('1. Check your internet connection');
      console.log('2. Try increasing connection timeout settings');
      console.log('3. Check if Zoho SMTP servers are experiencing issues');
    }
    
    console.log('\n📚 For more help, check the ZOHO_EMAIL_SETUP.md file');
    process.exit(1);
  }
}

// Run the test
testEmailConfiguration();
