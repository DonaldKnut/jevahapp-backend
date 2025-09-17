# 📧 Resend Email Setup Guide - Complete Migration from SMTP

## 🎯 **Overview**

This guide will help you migrate from SMTP (Zoho) to Resend API while maintaining your exact email design and functionality. Resend provides better deliverability, analytics, and is more reliable than SMTP.

## 🚀 **Step 1: Set Up Resend Account**

### **1.1 Create Resend Account**

1. Go to [resend.com](https://resend.com)
2. Sign up with your email
3. Verify your email address
4. Complete the onboarding process

### **1.2 Get API Key**

1. Go to **API Keys** in your Resend dashboard
2. Click **Create API Key**
3. Name it: `Jevah Production`
4. Copy the API key (starts with `re_`)

## 🔧 **Step 2: Configure Domain (Zoho)**

### **2.1 Add Domain to Resend**

1. In Resend dashboard, go to **Domains**
2. Click **Add Domain**
3. Enter: `jevahapp.com`
4. Click **Add Domain**

### **2.2 Configure DNS Records in Zoho**

You'll need to add these DNS records in your Zoho domain settings:

#### **SPF Record**

```
Type: TXT
Name: @
Value: v=spf1 include:_spf.resend.com ~all
TTL: 3600
```

#### **DKIM Record**

```
Type: CNAME
Name: resend._domainkey
Value: resend._domainkey.resend.com
TTL: 3600
```

#### **DMARC Record**

```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@jevahapp.com
TTL: 3600
```

### **2.3 Verify Domain**

1. After adding DNS records, go back to Resend
2. Click **Verify Domain** next to your domain
3. Wait for verification (can take up to 24 hours)
4. Status should show "Verified" ✅

## ⚙️ **Step 3: Environment Configuration**

### **3.1 Update Environment Variables**

Add these to your `.env` file:

```bash
# Resend Configuration
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=support@jevahapp.com
RESEND_FROM_NAME="Jevah Support"

# Keep SMTP as fallback (optional)
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=support@jevahapp.com
SMTP_PASS=your_zoho_password
```

### **3.2 Update Package.json**

Make sure you have Resend installed:

```bash
npm install resend
```

## 🔄 **Step 4: Update Email Service**

### **4.1 Create Hybrid Email Service**

Create a new service that uses Resend as primary and SMTP as fallback:

```typescript
// src/service/email.service.ts
import resendEmailService from "./resendEmail.service";
import { sendEmail as smtpSendEmail } from "../utils/mailer";

class EmailService {
  private useResend = process.env.RESEND_API_KEY ? true : false;

  async sendVerificationEmail(email: string, firstName: string, code: string) {
    try {
      if (this.useResend) {
        return await resendEmailService.sendVerificationEmail(
          email,
          firstName,
          code
        );
      } else {
        // Fallback to SMTP
        const { sendVerificationEmail } = await import("../utils/mailer");
        return await sendVerificationEmail(email, firstName, code);
      }
    } catch (error) {
      console.error("Primary email service failed, trying fallback:", error);

      // Try fallback
      if (this.useResend) {
        const { sendVerificationEmail } = await import("../utils/mailer");
        return await sendVerificationEmail(email, firstName, code);
      } else {
        throw error;
      }
    }
  }

  async sendPasswordResetEmail(
    email: string,
    firstName: string,
    resetCode: string
  ) {
    try {
      if (this.useResend) {
        return await resendEmailService.sendPasswordResetEmail(
          email,
          firstName,
          resetCode
        );
      } else {
        const { sendResetPasswordEmail } = await import("../utils/mailer");
        return await sendResetPasswordEmail(email, firstName, resetCode);
      }
    } catch (error) {
      console.error("Primary email service failed, trying fallback:", error);

      if (this.useResend) {
        const { sendResetPasswordEmail } = await import("../utils/mailer");
        return await sendResetPasswordEmail(email, firstName, resetCode);
      } else {
        throw error;
      }
    }
  }

  async sendWelcomeEmail(email: string, firstName: string) {
    try {
      if (this.useResend) {
        return await resendEmailService.sendWelcomeEmail(email, firstName);
      } else {
        const { sendWelcomeEmail } = await import("../utils/mailer");
        return await sendWelcomeEmail(email, firstName);
      }
    } catch (error) {
      console.error("Primary email service failed, trying fallback:", error);

      if (this.useResend) {
        const { sendWelcomeEmail } = await import("../utils/mailer");
        return await sendWelcomeEmail(email, firstName);
      } else {
        throw error;
      }
    }
  }

  async testConnection() {
    if (this.useResend) {
      return await resendEmailService.testConnection();
    } else {
      const { testEmailConnection } = await import("../utils/mailer");
      return await testEmailConnection();
    }
  }
}

export default new EmailService();
```

### **4.2 Update Auth Service**

Update your auth service to use the new email service:

```typescript
// src/service/auth.service.ts
import emailService from './email.service';

// Replace the old imports
// import { sendVerificationEmail, sendWelcomeEmail, sendResetPasswordEmail } from "../utils/mailer";

// Update the methods to use emailService
async sendVerificationCode(email: string, firstName: string, code: string) {
  return emailService.sendVerificationEmail(email, firstName, code);
}

async sendWelcomeMessage(email: string, firstName: string) {
  return emailService.sendWelcomeEmail(email, firstName);
}

async sendPasswordResetCode(email: string, firstName: string, resetCode: string) {
  return emailService.sendPasswordResetEmail(email, firstName, resetCode);
}
```

## 🧪 **Step 5: Testing**

### **5.1 Test Resend Connection**

Create a test script:

```typescript
// test-resend.js
const resendEmailService = require("./src/service/resendEmail.service");

async function testResend() {
  try {
    console.log("Testing Resend connection...");
    const isConnected = await resendEmailService.testConnection();

    if (isConnected) {
      console.log("✅ Resend connection successful");

      // Test sending an email
      console.log("Testing email send...");
      await resendEmailService.sendVerificationEmail(
        "test@example.com",
        "Test User",
        "123456"
      );

      console.log("✅ Test email sent successfully");
    } else {
      console.log("❌ Resend connection failed");
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testResend();
```

### **5.2 Run Test**

```bash
node test-resend.js
```

## 📊 **Step 6: Monitoring & Analytics**

### **6.1 Resend Dashboard Features**

Once set up, you'll have access to:

- **Email Analytics**: Open rates, click rates, bounce rates
- **Delivery Status**: Real-time delivery tracking
- **Domain Reputation**: Monitor your domain's sending reputation
- **Suppression Lists**: Manage bounced and unsubscribed emails
- **Webhooks**: Real-time delivery notifications

### **6.2 Set Up Webhooks (Optional)**

For advanced monitoring, set up webhooks:

1. Go to **Webhooks** in Resend dashboard
2. Add webhook URL: `https://your-api.com/api/webhooks/resend`
3. Select events: `email.sent`, `email.delivered`, `email.bounced`

## 🔒 **Step 7: Security Best Practices**

### **7.1 API Key Security**

- Store API key in environment variables only
- Never commit API keys to version control
- Use different keys for development/production
- Rotate keys regularly

### **7.2 Domain Security**

- Enable SPF, DKIM, and DMARC records
- Monitor domain reputation
- Use dedicated sending domains for different purposes

## 🚀 **Step 8: Migration Checklist**

### **Pre-Migration**

- [ ] Resend account created
- [ ] Domain added to Resend
- [ ] DNS records configured
- [ ] Domain verified
- [ ] API key obtained

### **Migration**

- [ ] Environment variables updated
- [ ] Resend service implemented
- [ ] Hybrid email service created
- [ ] Auth service updated
- [ ] Tests passing

### **Post-Migration**

- [ ] Monitor email delivery
- [ ] Check analytics dashboard
- [ ] Verify all email types working
- [ ] Update documentation
- [ ] Remove old SMTP code (optional)

## 📈 **Benefits of Resend Migration**

### **✅ Improved Deliverability**

- Better inbox placement rates
- Reduced spam folder delivery
- Professional email infrastructure

### **✅ Better Analytics**

- Real-time delivery tracking
- Open and click rate analytics
- Bounce and complaint monitoring

### **✅ Enhanced Reliability**

- 99.9% uptime SLA
- Automatic retry mechanisms
- Better error handling

### **✅ Cost Efficiency**

- No SMTP server maintenance
- Pay-per-email pricing
- Better scaling options

## 🆘 **Troubleshooting**

### **Common Issues**

#### **Domain Verification Failed**

- Check DNS propagation (can take 24-48 hours)
- Verify TXT records are correct
- Ensure no conflicting records

#### **Emails Not Delivering**

- Check domain reputation
- Verify SPF/DKIM records
- Check Resend dashboard for errors

#### **API Key Issues**

- Verify API key is correct
- Check environment variable loading
- Ensure key has proper permissions

### **Support Resources**

- [Resend Documentation](https://resend.com/docs)
- [Resend Support](https://resend.com/support)
- [DNS Checker Tools](https://dnschecker.org)

## 🎉 **Conclusion**

Your migration to Resend will provide:

- ✅ **Same beautiful email designs** (exact EJS templates converted)
- ✅ **Better deliverability** than SMTP
- ✅ **Real-time analytics** and monitoring
- ✅ **Professional email infrastructure**
- ✅ **Seamless fallback** to SMTP if needed

The migration maintains your exact brand colors, design, and functionality while providing a more robust email delivery system! 🚀
