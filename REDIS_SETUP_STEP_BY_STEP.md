# Redis Setup: Step-by-Step Guide

## 🎯 What You Need

- **Local**: Redis running on your Mac
- **Production**: Redis URL from Render dashboard
- **No API keys needed** - just a connection URL!

---

## 📱 PART 1: Local Setup (macOS)

### Step 1: Install Redis

```bash
# Install Redis using Homebrew
brew install redis
```

**Expected output:**
```
==> Downloading redis...
==> Pouring redis...
✅ redis successfully installed!
```

### Step 2: Start Redis

```bash
# Start Redis as a background service
brew services start redis
```

**Expected output:**
```
==> Successfully started `redis` (label: homebrew.mxcl.redis)
```

### Step 3: Verify Redis is Running

```bash
# Test Redis connection
redis-cli ping
```

**Expected output:**
```
PONG
```

✅ **If you see `PONG`, Redis is working!**

### Step 4: Add to Your `.env` File

Open your `.env` file in the project root and add:

```env
REDIS_URL=redis://localhost:6379
```

**Full `.env` example:**
```env
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
PORT=4000
REDIS_URL=redis://localhost:6379
```

### Step 5: Test Your App

```bash
# Start your backend
npm run dev
```

**Look for these log messages:**
```
✅ Redis connected successfully
✅ Redis ready to accept commands
```

**If you see:**
```
⚠️ Redis connection failed (will retry)
```

**Troubleshooting:**
1. Check Redis is running: `redis-cli ping` (should return `PONG`)
2. Check your `.env` has `REDIS_URL=redis://localhost:6379`
3. Restart your app: `npm run dev`

---

## ☁️ PART 2: Production Setup (Render.com)

### Step 1: Find Your Redis Service in Render Dashboard

1. **Go to Render Dashboard:** https://dashboard.render.com
2. **Look for your Redis service:**
   - In the left sidebar, you should see **"Redis"** section
   - Or click **"Services"** in the top menu
   - Look for a service named `jevah-redis` (from your `render.yaml`)

**If you don't see a Redis service:**
- Your `render.yaml` defines it, but it might not be created yet
- Go to **"New +"** → **"Redis"** → Create it manually
- Name it: `jevah-redis`
- Region: `Oregon` (same as your web service)
- Plan: `Starter` (free tier)

### Step 2: Get Your Redis URL

Once you're on your Redis service page:

1. **Click on the Redis service** (`jevah-redis`)
2. **Look for "Info" or "Connection" tab**
3. **Find one of these:**
   - **"Internal Redis URL"** ← Use this one! (for services on same network)
   - **"External Redis URL"** (if you need external access)
   - **"Redis URL"** (general connection string)

**The URL will look like:**
```
redis://red-xxxxx:6379
```

or with password:
```
redis://red-xxxxx:6379?password=xxxxx
```

**📸 Where to find it:**
- Scroll down on the Redis service page
- Look for a section called **"Connection Information"** or **"Info"**
- You'll see fields like:
  - `Host:` red-xxxxx.render.com
  - `Port:` 6379
  - `Internal Redis URL:` redis://red-xxxxx:6379

**If you can't find it:**
- Click **"Info"** tab at the top
- Or look for **"Connection Details"** section
- Copy the full URL (starts with `redis://`)

### Step 3: Add Redis URL to Your Web Service

1. **Go to your Web Service** (`jevah-backend`)
   - Click on it in the dashboard
   
2. **Go to "Environment" tab**
   - Click **"Environment"** in the left sidebar
   - Or look for **"Environment Variables"** section

3. **Add the Redis URL:**
   - Click **"Add Environment Variable"** or **"Add"** button
   - **Key:** `REDIS_URL`
   - **Value:** Paste the Redis URL you copied (e.g., `redis://red-xxxxx:6379`)
   - Click **"Save Changes"**

**📸 Visual Guide:**
```
Environment Variables
├── NODE_ENV = production
├── PORT = 4000
├── MONGODB_URI = [hidden]
├── JWT_SECRET = [hidden]
└── REDIS_URL = redis://red-xxxxx:6379  ← ADD THIS
```

### Step 4: Restart Your Web Service

After adding `REDIS_URL`:

1. **Go to "Events" or "Logs" tab** in your web service
2. **Click "Manual Deploy"** → **"Deploy latest commit"**
   - OR wait for auto-deploy (if enabled)
   - OR click **"Restart"** button if available

**Wait for deployment to complete** (usually 1-2 minutes)

### Step 5: Verify Redis is Connected

1. **Go to "Logs" tab** in your web service
2. **Look for these messages:**
   ```
   ✅ Redis connected successfully
   ✅ Redis ready to accept commands
   ```

**If you see:**
```
⚠️ Redis connection failed (will retry)
```

**Troubleshooting:**
1. Double-check `REDIS_URL` is correct (starts with `redis://`)
2. Make sure Redis service is running (check Redis service status)
3. Verify both services are in the same region (Oregon)
4. Try using "Internal Redis URL" instead of "External"

### Step 6: Test Redis is Working

**Option 1: Check Metrics Endpoint**

```bash
curl https://jevahapp-backend.onrender.com/api/metrics
```

**Look for:**
```json
{
  "redisCache": {
    "connected": true,
    "keys": 0,
    "counters": {
      "hits": 0,
      "misses": 0,
      ...
    }
  }
}
```

**Option 2: Check Logs**

In Render dashboard → Your web service → Logs:
- Look for cache HIT/MISS messages
- Look for "✅ Redis connected successfully"

---

## 🔍 Detailed Render Dashboard Navigation

### Finding Redis Service:

**Path 1:**
```
Dashboard → Services → [Look for Redis icon/type]
```

**Path 2:**
```
Dashboard → Left Sidebar → "Redis" section
```

**Path 3:**
```
Dashboard → Search bar → Type "jevah-redis"
```

### Finding Redis URL:

**On Redis Service Page:**
1. **"Info" tab** (most common)
   - Scroll down
   - Look for "Connection Information"
   - Copy "Internal Redis URL"

2. **"Settings" tab**
   - Sometimes URL is here

3. **Main page**
   - Some Render layouts show URL at the top

**The URL format:**
- ✅ `redis://red-xxxxx:6379` (no password)
- ✅ `redis://red-xxxxx:6379?password=xxxxx` (with password)
- ✅ `redis://:password@red-xxxxx:6379` (alternative format)

### Adding to Web Service:

**Path:**
```
Dashboard → Your Web Service (jevah-backend) → Environment → Add Variable
```

**Steps:**
1. Click your web service
2. Click **"Environment"** in left sidebar
3. Scroll to see existing variables
4. Click **"Add Environment Variable"** or **"+"** button
5. Enter:
   - **Key:** `REDIS_URL`
   - **Value:** `redis://red-xxxxx:6379` (your actual URL)
6. Click **"Save"** or **"Add"**

---

## ✅ Verification Checklist

### Local:
- [ ] Redis installed: `brew list | grep redis`
- [ ] Redis running: `redis-cli ping` returns `PONG`
- [ ] `.env` has `REDIS_URL=redis://localhost:6379`
- [ ] App logs show: `✅ Redis connected successfully`

### Production:
- [ ] Redis service exists in Render dashboard
- [ ] Redis service is running (status: "Live")
- [ ] Found Redis URL (Internal or External)
- [ ] Added `REDIS_URL` to web service environment variables
- [ ] Web service restarted/redeployed
- [ ] Logs show: `✅ Redis connected successfully`
- [ ] Metrics endpoint shows: `"connected": true`

---

## 🐛 Common Issues & Fixes

### Issue 1: "Can't find Redis service in Render"

**Solution:**
- Your `render.yaml` defines it, but it might not be created
- Go to **"New +"** → **"Redis"** → Create manually
- Name: `jevah-redis`, Region: `Oregon`, Plan: `Starter`

### Issue 2: "Can't find Redis URL in dashboard"

**Solution:**
- Click on Redis service
- Look for **"Info"** tab
- Scroll down to **"Connection Information"**
- Copy **"Internal Redis URL"**
- If still not found, check **"Settings"** tab

### Issue 3: "Redis connection failed" in logs

**Check:**
1. Redis URL format is correct (`redis://...`)
2. Redis service is running (check status)
3. Both services in same region
4. Using "Internal Redis URL" (not External)

### Issue 4: "Environment variable not saving"

**Solution:**
- Make sure you're editing the **web service** (not Redis service)
- Click **"Save"** or **"Add"** button
- Wait a few seconds
- Refresh page to verify it's there

### Issue 5: "Redis works locally but not in production"

**Check:**
1. Production `REDIS_URL` is different from local
2. Using correct URL format
3. Redis service is in same region as web service
4. Web service has been restarted after adding variable

---

## 🎯 Quick Reference

### Local Redis URL:
```env
REDIS_URL=redis://localhost:6379
```

### Production Redis URL (Render):
```env
REDIS_URL=redis://red-xxxxx:6379
```

### Test Redis Connection:
```bash
# Local
redis-cli ping

# From Node.js
node -e "const Redis = require('ioredis'); const r = new Redis(process.env.REDIS_URL); r.ping().then(() => console.log('✅ Connected')).catch(e => console.error('❌', e)).finally(() => r.quit());"
```

---

## 📞 Still Stuck?

**If you can't find Redis URL in Render:**

1. **Check Redis service exists:**
   - Dashboard → Services → Look for Redis type
   - If missing, create it: "New +" → "Redis"

2. **Check Redis service is running:**
   - Click on Redis service
   - Status should be "Live" or "Running"

3. **Try alternative:**
   - Use Render's "Internal Redis URL" (recommended)
   - Or use "External Redis URL" if you need external access

4. **Contact Render support:**
   - They can help you find the connection URL
   - Or check their docs: https://render.com/docs/redis

---

**Once Redis is connected, you'll see:**
- ✅ 10-100x faster cached responses
- ✅ AI chat sessions persist across instances  
- ✅ Background job queues working
- ✅ Better performance overall!
