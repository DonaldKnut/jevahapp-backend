#!/usr/bin/env node

/**
 * Resend DNS Configuration Helper
 *
 * This script helps you configure DNS records for Resend email delivery
 * with your Zoho domain (jevahapp.com)
 */

console.log("🌐 RESEND DNS CONFIGURATION HELPER");
console.log("==================================");
console.log("");

console.log("📋 DNS Records to Add in Zoho Domain Settings:");
console.log("");

console.log("1️⃣ SPF Record (TXT):");
console.log("   Type: TXT");
console.log("   Name: @");
console.log("   Value: v=spf1 include:_spf.resend.com ~all");
console.log("   TTL: 3600");
console.log("");

console.log("2️⃣ DKIM Record (CNAME):");
console.log("   Type: CNAME");
console.log("   Name: resend._domainkey");
console.log("   Value: resend._domainkey.resend.com");
console.log("   TTL: 3600");
console.log("");

console.log("3️⃣ DMARC Record (TXT):");
console.log("   Type: TXT");
console.log("   Name: _dmarc");
console.log("   Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@jevahapp.com");
console.log("   TTL: 3600");
console.log("");

console.log("📝 Step-by-Step Instructions:");
console.log("");
console.log("1. Log into your Zoho domain management panel");
console.log("2. Go to DNS Management or DNS Settings");
console.log("3. Add the three records above");
console.log("4. Wait for DNS propagation (up to 24 hours)");
console.log("5. Verify domain in Resend dashboard");
console.log("");

console.log("🔍 DNS Verification Commands:");
console.log("");
console.log("Check SPF record:");
console.log("nslookup -type=TXT jevahapp.com");
console.log("");
console.log("Check DKIM record:");
console.log("nslookup -type=CNAME resend._domainkey.jevahapp.com");
console.log("");
console.log("Check DMARC record:");
console.log("nslookup -type=TXT _dmarc.jevahapp.com");
console.log("");

console.log("🌍 Online DNS Checkers:");
console.log("");
console.log("• https://dnschecker.org");
console.log("• https://www.whatsmydns.net");
console.log("• https://mxtoolbox.com/dnscheck.aspx");
console.log("");

console.log("⚠️  Important Notes:");
console.log("");
console.log("• DNS changes can take up to 24-48 hours to propagate globally");
console.log("• Make sure to remove any conflicting SPF records");
console.log("• Test email delivery after DNS propagation");
console.log("• Monitor Resend dashboard for domain verification status");
console.log("");

console.log("✅ After DNS is configured:");
console.log("");
console.log("1. Add RESEND_API_KEY to your .env file");
console.log("2. Run: node test-resend-setup.js --test-email=your@email.com");
console.log("3. Check your email inbox for test messages");
console.log("");

console.log("🚀 Ready to configure DNS? Follow the steps above!");
