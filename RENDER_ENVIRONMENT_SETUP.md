# 🚀 Render Environment Variables Setup Guide

## ⚠️ CRITICAL: Avatar Upload Fix

**The avatar upload functionality was failing because the R2 environment variables were not configured in production.** This guide ensures all required environment variables are properly set on Render.

## 📋 Required Environment Variables

You need to add these environment variables to your Render service dashboard:

### 🔐 Core Application Variables
```bash
NODE_ENV=production
PORT=4000
MONGODB_URI=mongodb+srv://tevahapp:z4AGZU26ZLM1dg8A@tevahdb.cerc7kk.mongodb.net/tevahdb
JWT_SECRET=9be9d057725020b38287773b920c416c2d1b89bdac3080cbe1df9182a75cef5f66e715ebf744d4c1086b364648309d0a9e4c571ba5851100152627d97a8a8adc
```

### 🔑 Authentication
```bash
CLERK_SECRET_KEY=sk_test_DUdljAMc2BY6aT7x8Q1BmYDrrSP4403FxE64CpHhMG
CLERK_PUBLISHABLE_KEY=pk_test_Y2FzdWFsLXJheS0zNi5jbGVyay5hY2NvdW50cy5kZXYk
```

### 📧 Email Configuration (CRITICAL for user registration)
```bash
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=support@jevahapp.com
SMTP_PASS=JRynT5k4cXc6
```

### ☁️ Cloudflare R2 Configuration (CRITICAL for avatar uploads)
```bash
R2_ENDPOINT=https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah
R2_ACCESS_KEY_ID=92dafeb76f86a6bb3e5dbcc37f4c1a1c
R2_SECRET_ACCESS_KEY=60c8095a9b6e7ac35b240ce3da1e2398a6a54e9f76e285796441abc10d87e857
R2_BUCKET=jevah
R2_ACCOUNT_ID=870e0e55f75d0d9434531d7518f57e92
R2_CUSTOM_DOMAIN=bDp9npjM_CVBCOUtyrsgKjLle3shpuJ64W_y7DYY
```

### 🤖 AI & External Services
```bash
GOOGLE_AI_API_KEY=AIzaSyA8JM8Xwwi_8WCzS2OolkNkuHJ6B3Qb4u8
CLOUDINARY_CLOUD_NAME=dv70tsyz2
CLOUDINARY_API_KEY=412472972821942
CLOUDINARY_API_SECRET=csFQf-YmiSBwvJe6g3UH5TMLM0w
MUX_TOKEN_ID=4d2cdf9c-df35-4a75-8894-a4515fcfc3a3
MUX_TOKEN_SECRET=DZ4RM1bP+IP/cc9gEUkCd1NGgVS3tLCqhkRomru4wdxI8C9wnrJgJk3zKqPqURvcGm1BgUg8FwQ
RESEND_API_KEY=re_ZBNvE2Pb_7gE6T8aEunA816YG8SkWUAto
```

### 🌐 URLs & CORS
```bash
FRONTEND_URL=https://jevah-app.vercel.app
API_BASE_URL=https://jevahapp-backend.onrender.com
CORS_ORIGIN=https://jevah-app.vercel.app
```

## 🛠️ Step-by-Step Setup Instructions

### 1. Access Render Dashboard
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Sign in to your account
3. Navigate to your `jevah-backend` service

### 2. Add Environment Variables
1. Click on your service name
2. Go to the **"Environment"** tab
3. Click **"Add Environment Variable"**
4. Add each variable from the lists above:
   - **Key**: Variable name (e.g., `R2_BUCKET`)
   - **Value**: Variable value (e.g., `jevah`)

### 3. Critical Variables to Verify
Make sure these are set correctly (they're essential for core functionality):

#### ✅ For Avatar Uploads:
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID` 
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_ACCOUNT_ID`

#### ✅ For Email Verification:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

#### ✅ For Authentication:
- `JWT_SECRET`
- `CLERK_SECRET_KEY`
- `CLERK_PUBLISHABLE_KEY`

### 4. Deploy and Test
1. After adding all variables, Render will automatically redeploy
2. Wait for deployment to complete
3. Test the following functionality:
   - User registration with email verification
   - Avatar upload
   - Login/logout

## 🧪 Testing Avatar Upload in Production

Once deployed, test with this curl command:

```bash
# 1. Register a user
curl -X POST https://jevahapp-backend.onrender.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "firstName": "Test"
  }'

# 2. Login to get JWT token
curl -X POST https://jevahapp-backend.onrender.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'

# 3. Upload avatar (replace YOUR_JWT_TOKEN with actual token)
curl -X POST https://jevahapp-backend.onrender.com/auth/avatar \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "avatar=@path/to/test-image.jpg"
```

## 🔧 Troubleshooting

### Avatar Upload Fails
- **Error**: "No value provided for input HTTP label: Bucket"
- **Solution**: Verify all R2 environment variables are set correctly

### Email Verification Fails
- **Error**: "Unable to send verification email"
- **Solution**: Check SMTP environment variables

### Authentication Issues
- **Error**: "Invalid token" or "Unauthorized"
- **Solution**: Verify JWT_SECRET and Clerk variables

## ✅ Verification Checklist

- [ ] All 25 environment variables added to Render
- [ ] Service redeployed successfully
- [ ] User registration works (email sent)
- [ ] User login works (JWT token received)
- [ ] Avatar upload works (file uploaded to R2)
- [ ] Email templates display correctly with Jevah branding

## 🚨 Security Notes

- Never commit these environment variables to git
- Keep your .env file in .gitignore
- Regularly rotate sensitive keys like JWT_SECRET
- Monitor R2 and Cloudinary usage for unexpected charges

## 📞 Support

If you encounter issues:
1. Check Render service logs for specific error messages
2. Verify environment variables match exactly (no extra spaces)
3. Test locally first to isolate production-specific issues
4. Check R2 and email service dashboards for any service outages
