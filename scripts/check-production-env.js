#!/usr/bin/env node

/**
 * Production Environment Variables Checker
 *
 * Verifies required env vars for Contabo (API + worker) deployment.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking Production Environment Variables...\n');

// Required environment variables for production
const requiredEnvVars = {
  // Core Application
  'NODE_ENV': 'Should be "production"',
  'PORT': 'Server port (usually 4000)',
  'MONGODB_URI': 'MongoDB connection string',
  'JWT_SECRET': 'JWT signing secret',
  
  // Authentication
  'CLERK_SECRET_KEY': 'Clerk authentication secret',
  'CLERK_PUBLISHABLE_KEY': 'Clerk publishable key',
  
  // Email Configuration
  'SMTP_HOST': 'SMTP server host (smtp.zoho.com)',
  'SMTP_PORT': 'SMTP port (587)',
  'SMTP_USER': 'SMTP username (support@jevahapp.com)',
  'SMTP_PASS': 'SMTP password',
  
  // Cloudflare R2 Configuration (CRITICAL for avatar uploads)
  'R2_ENDPOINT': 'Cloudflare R2 endpoint URL',
  'R2_ACCESS_KEY_ID': 'R2 access key ID',
  'R2_SECRET_ACCESS_KEY': 'R2 secret access key',
  'R2_BUCKET': 'R2 bucket name (jevah)',
  'R2_ACCOUNT_ID': 'Cloudflare account ID',
  'R2_ENDPOINT': 'R2 S3 API endpoint',
  'R2_CUSTOM_DOMAIN': 'Public CDN domain (required in production; no r2.dev)',
  
  // External Services
  'GOOGLE_AI_API_KEY': 'Google AI Studio API key (gemini-2.5-flash)',
  'GEMINI_MODERATION_MODEL': 'Optional; defaults to gemini-2.5-flash',
  'REDIS_URL': 'Contabo/local Redis for budgets, likes, queues',
  'EXPO_ACCESS_TOKEN': 'Expo access token for push + receipt API (API + worker)',
  'CLOUDINARY_CLOUD_NAME': 'Cloudinary cloud name',
  'CLOUDINARY_API_KEY': 'Cloudinary API key',
  'CLOUDINARY_API_SECRET': 'Cloudinary API secret',
  'MUX_TOKEN_ID': 'Mux video streaming token ID',
  'MUX_TOKEN_SECRET': 'Mux video streaming secret',
  'RESEND_API_KEY': 'Resend email service API key',
  
  // Frontend URLs
  'FRONTEND_URL': 'Frontend application URL',
  'API_BASE_URL': 'Backend API base URL',
  'CORS_ORIGIN': 'CORS allowed origin'
};

// Check local .env file
if (fs.existsSync('.env')) {
  console.log('✅ Local .env file found');
  
  // Load and check .env variables
  require('dotenv').config();
  
  console.log('\n📋 Local Environment Variables Status:');
  
  const missingVars = [];
  const presentVars = [];
  
  for (const [varName, description] of Object.entries(requiredEnvVars)) {
    const value = process.env[varName];
    if (value && value.trim() !== '') {
      presentVars.push(varName);
      console.log(`✅ ${varName}: Set (${description})`);
    } else {
      missingVars.push(varName);
      console.log(`❌ ${varName}: Missing (${description})`);
    }
  }
  
  console.log(`\n📊 Summary: ${presentVars.length}/${Object.keys(requiredEnvVars).length} variables set locally`);
  
  if (missingVars.length > 0) {
    console.log('\n⚠️  Missing Variables:');
    missingVars.forEach(varName => {
      console.log(`   - ${varName}: ${requiredEnvVars[varName]}`);
    });
  }
  
} else {
  console.log('❌ No .env file found in current directory');
}

console.log("\n🎯 Next steps for Contabo production:");
console.log("1. Set required variables in the Contabo server .env (never commit secrets)");
console.log("2. REDIS_URL=redis://127.0.0.1:6379 (local Redis on the VPS)");
console.log("3. API_BASE_URL=https://your-contabo-api-host (public HTTPS)");
console.log("4. SELF_PING_ENABLED=false unless you intentionally want keepalive");
console.log("5. npm run build && pm2 start ecosystem.config.cjs (API + worker)");
console.log("6. See docs/CONTABO_SMOKE.md after deploy");
console.log("\n❌ Render.com is no longer used — ignore any old onrender.com URLs.");
