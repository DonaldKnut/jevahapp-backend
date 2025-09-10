# Zoho Email Configuration for Jevah Production

## Overview

This guide explains how to configure Zoho SMTP for sending emails from `support@jevahapp.com` in production.

## Zoho SMTP Settings

### SMTP Configuration

- **SMTP Host**: `smtp.zoho.com`
- **SMTP Port**: `587` (TLS) or `465` (SSL)
- **Security**: TLS/SSL
- **Authentication**: Required

### Environment Variables

Add these environment variables to your production environment (Render.com):

```bash
# Zoho SMTP Configuration
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=support@jevahapp.com
SMTP_PASS=your-zoho-app-password
```

## Setting Up Zoho Email

### Step 1: Create Zoho Account

1. Go to [Zoho Mail](https://mail.zoho.com)
2. Sign up for a business email account
3. Choose the domain: `jevahapp.com`
4. Create the email: `support@jevahapp.com`

### Step 2: Enable SMTP Access

1. Log into your Zoho Mail account
2. Go to **Settings** → **Mail Accounts**
3. Select `support@jevahapp.com`
4. Go to **Security** tab
5. Enable **SMTP Access**
6. Generate an **App Password** (not your regular password)

### Step 3: Configure App Password

1. In Zoho Mail settings, go to **Security**
2. Click **Generate App Password**
3. Give it a name like "Jevah App"
4. Copy the generated password
5. Use this password in your `SMTP_PASS` environment variable

### Step 4: Test Configuration

You can test the email configuration using this script:

```javascript
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.zoho.com",
  port: 587,
  secure: false,
  auth: {
    user: "support@jevahapp.com",
    pass: "your-app-password",
  },
});

async function testEmail() {
  try {
    const info = await transporter.sendMail({
      from: '"Jevah Support" <support@jevahapp.com>',
      to: "test@example.com",
      subject: "Test Email from Jevah",
      text: "This is a test email from Jevah using Zoho SMTP",
      html: "<h1>Test Email</h1><p>This is a test email from Jevah using Zoho SMTP</p>",
    });

    console.log("Email sent successfully:", info.messageId);
  } catch (error) {
    console.error("Email failed:", error);
  }
}

testEmail();
```

## Render.com Configuration

### Environment Variables in Render

1. Go to your Render dashboard
2. Select your Jevah backend service
3. Go to **Environment** tab
4. Add these variables:

```
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=support@jevahapp.com
SMTP_PASS=your-zoho-app-password
```

### Important Notes

- Set `SMTP_SECURE=false` for port 587 (TLS)
- Set `SMTP_SECURE=true` for port 465 (SSL)
- Use the **App Password**, not your regular Zoho password
- Keep the app password secure and don't commit it to version control

## Email Templates

The application uses these email templates:

1. **Welcome Email**: Sent to new users
2. **Verification Email**: Email verification codes
3. **Password Reset**: Password reset links
4. **Media Notifications**: When content is liked/shared
5. **Follower Notifications**: New followers

All emails will be sent from `support@jevahapp.com` with the sender name "Jevah Support".

## Troubleshooting

### Common Issues

1. **Authentication Failed**

   - Ensure you're using the App Password, not your regular password
   - Check that SMTP access is enabled in Zoho settings

2. **Connection Timeout**

   - Verify the SMTP host is correct: `smtp.zoho.com`
   - Check if port 587 is blocked by firewall

3. **SSL/TLS Issues**

   - For port 587: Set `SMTP_SECURE=false`
   - For port 465: Set `SMTP_SECURE=true`

4. **Rate Limiting**
   - Zoho has rate limits for SMTP
   - Monitor email sending volume

### Testing in Development

Add these to your local `.env` file:

```bash
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=support@jevahapp.com
SMTP_PASS=your-zoho-app-password
```

### Monitoring

Monitor email delivery in:

1. Zoho Mail dashboard
2. Application logs
3. Email delivery reports

## Security Best Practices

1. **App Passwords**: Use app-specific passwords, not your main password
2. **Environment Variables**: Store credentials securely in environment variables
3. **Rate Limiting**: Implement rate limiting for email sending
4. **Monitoring**: Monitor email delivery and bounce rates
5. **Backup**: Consider having a backup email service

## Alternative Email Services

If Zoho doesn't work for your needs, consider:

1. **SendGrid**: Popular email service with good deliverability
2. **Mailgun**: Developer-friendly email service
3. **Amazon SES**: Cost-effective for high volume
4. **Resend**: Modern email API (already configured in the app)

## Code Changes Made

The following files were updated to support Zoho SMTP:

1. `src/config/email.config.ts` - Updated default SMTP host to Zoho
2. `src/utils/mailer.tsx` - Updated transporter configuration
3. `ZOHO_EMAIL_SETUP.md` - This documentation file

## Next Steps

1. Set up your Zoho account and create `support@jevahapp.com`
2. Generate an App Password
3. Update your Render environment variables
4. Test email sending
5. Monitor email delivery in production

## Support

If you encounter issues:

1. Check Zoho Mail documentation
2. Review application logs
3. Test with the provided test script
4. Contact Zoho support if needed



















