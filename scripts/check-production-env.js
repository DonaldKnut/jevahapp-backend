#!/usr/bin/env node

/**
 * Production Environment Variables Checker
 * 
 * This script helps verify that all required environment variables are set
 * for production deployment on Render.com
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
  
  // External Services
  'GOOGLE_AI_API_KEY': 'Google AI API key for chatbot',
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

// Check render.yaml configuration
console.log('\n🔍 Checking render.yaml configuration...');

if (fs.existsSync('render.yaml')) {
  const renderConfig = fs.readFileSync('render.yaml', 'utf8');
  console.log('✅ render.yaml file found');
  
  const configuredInRender = [];
  const missingInRender = [];
  
  for (const varName of Object.keys(requiredEnvVars)) {
    if (renderConfig.includes(`- key: ${varName}`)) {
      configuredInRender.push(varName);
    } else {
      missingInRender.push(varName);
    }
  }
  
  console.log(`\n📊 Render.yaml: ${configuredInRender.length}/${Object.keys(requiredEnvVars).length} variables configured`);
  
  if (missingInRender.length > 0) {
    console.log('\n❌ Variables missing from render.yaml:');
    missingInRender.forEach(varName => {
      console.log(`   - ${varName}: ${requiredEnvVars[varName]}`);
    });
  } else {
    console.log('\n✅ All required variables are configured in render.yaml');
  }
  
} else {
  console.log('❌ render.yaml file not found');
}

console.log('\n🎯 Next Steps for Production Deployment:');
console.log('1. Ensure all environment variables are set in your Render dashboard');
console.log('2. Go to your Render service → Environment tab');
console.log('3. Add each missing variable with its corresponding value from .env');
console.log('4. Pay special attention to R2 variables - they are CRITICAL for avatar uploads');
console.log('5. Deploy and test avatar upload functionality');

console.log('\n💡 Pro Tip: You can copy values from your local .env file to Render dashboard');
console.log('   The values should be exactly the same for consistency');

console.log('\n🔗 Render Dashboard: https://dashboard.render.com/');
