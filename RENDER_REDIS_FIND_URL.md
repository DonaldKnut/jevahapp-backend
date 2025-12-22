# How to Find Redis URL in Render Dashboard

## 🎯 Quick Answer

**Where to find Redis URL in Render:**

1. **Dashboard** → **Services** → Click on your **Redis service** (`jevah-redis`)
2. **Look for "Info" tab** or scroll down to **"Connection Information"**
3. **Copy "Internal Redis URL"** (looks like: `redis://red-xxxxx:6379`)
4. **Add it to your web service** as `REDIS_URL` environment variable

---

## 📸 Step-by-Step with Visual Guide

### Step 1: Find Your Redis Service

**Path A:**
```
Render Dashboard → Left Sidebar → "Services" → Look for Redis icon
```

**Path B:**
```
Render Dashboard → Top Menu → "Services" → Filter by "Redis"
```

**Path C:**
```
Render Dashboard → Search Bar → Type "jevah-redis"
```

**What you're looking for:**
- Service type: **Redis** (red icon/logo)
- Service name: `jevah-redis` (or whatever you named it)
- Status: Should be **"Live"** or **"Running"**

---

### Step 2: Click on Redis Service

Once you find it, **click on the service name** to open it.

---

### Step 3: Find the Connection URL

**On the Redis service page, look for:**

#### Option A: "Info" Tab (Most Common)
1. Click **"Info"** tab at the top
2. Scroll down to **"Connection Information"** section
3. Look for:
   - **"Internal Redis URL"** ← **Use this one!**
   - **"External Redis URL"** (if you need external access)
   - **"Host"** and **"Port"** (you can construct URL: `redis://host:port`)

#### Option B: Main Page
Sometimes the URL is shown directly on the main page:
- Look for a section called **"Connection Details"**
- Or **"Redis URL"** field
- Copy the full URL (starts with `redis://`)

#### Option C: "Settings" Tab
1. Click **"Settings"** tab
2. Look for connection information here

---

### Step 4: Copy the URL

**The URL format will be one of these:**

```
redis://red-xxxxx:6379
```

or with password:
```
redis://red-xxxxx:6379?password=xxxxx
```

or:
```
redis://:password@red-xxxxx:6379
```

**Copy the ENTIRE URL** (everything starting with `redis://`)

---

### Step 5: Add to Web Service Environment

1. **Go back to Dashboard**
2. **Click on your Web Service** (`jevah-backend`)
3. **Click "Environment"** in left sidebar
4. **Click "Add Environment Variable"** or **"+"** button
5. **Enter:**
   - **Key:** `REDIS_URL`
   - **Value:** Paste the URL you copied
6. **Click "Save"** or **"Add"**

---

### Step 6: Restart Your Service

After adding `REDIS_URL`:

1. **Go to "Events" or "Manual Deploy"**
2. **Click "Deploy latest commit"** or **"Restart"**
3. **Wait for deployment** (1-2 minutes)
4. **Check logs** for: `✅ Redis connected successfully`

---

## 🔍 If You Can't Find Redis Service

**Your `render.yaml` defines Redis, but it might not be created yet:**

### Create Redis Service Manually:

1. **Dashboard** → **"New +"** button (top right)
2. **Select "Redis"**
3. **Fill in:**
   - **Name:** `jevah-redis`
   - **Region:** `Oregon` (same as your web service)
   - **Plan:** `Starter` (free tier)
   - **Max Memory Policy:** `allkeys-lru` (default)
4. **Click "Create Redis"**
5. **Wait for it to start** (status: "Live")
6. **Then follow Step 3 above** to get the URL

---

## 🔍 If You Can't Find the URL

**Try these locations:**

1. **"Info" tab** → Scroll to bottom → "Connection Information"
2. **Main page** → Look for "Redis URL" or "Connection String"
3. **"Settings" tab** → Connection details
4. **"Overview" tab** → Connection information section

**Still can't find it?**

- Check Render documentation: https://render.com/docs/redis
- Contact Render support (they can help you find it)
- Try creating a new Redis service and see where the URL appears

---

## ✅ Verification

**After adding `REDIS_URL` to your web service:**

1. **Check logs:**
   ```
   ✅ Redis connected successfully
   ✅ Redis ready to accept commands
   ```

2. **Test metrics endpoint:**
   ```bash
   curl https://jevahapp-backend.onrender.com/api/metrics
   ```
   
   Look for:
   ```json
   {
     "redisCache": {
       "connected": true,
       ...
     }
   }
   ```

3. **Check cache is working:**
   - Make a request to a cached endpoint
   - Check response headers for `X-Cache: HIT` or `X-Cache: MISS`

---

## 🎯 Quick Checklist

- [ ] Found Redis service in Render dashboard
- [ ] Redis service is running (status: "Live")
- [ ] Found "Internal Redis URL" in Info tab
- [ ] Copied the full URL (starts with `redis://`)
- [ ] Added `REDIS_URL` to web service environment variables
- [ ] Web service restarted/redeployed
- [ ] Logs show: `✅ Redis connected successfully`
- [ ] Metrics endpoint shows: `"connected": true"`

---

## 💡 Pro Tips

1. **Use "Internal Redis URL"** - It's faster and more secure (services on same network)
2. **Keep URL secret** - Don't commit it to git (use `sync: false` in render.yaml)
3. **Same region** - Make sure Redis and web service are in same region (Oregon)
4. **Free tier limits** - Render free Redis has memory limits, but it's fine for caching

---

**Once connected, you'll get:**
- ⚡ 10-100x faster cached responses
- 🔄 AI chat sessions persist across instances
- 📊 Background job queues working
- 🚀 Much better performance!
