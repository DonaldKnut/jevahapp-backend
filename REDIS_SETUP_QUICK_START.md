# Redis Setup Quick Start

## Current Status

✅ **Code is ready** - Redis support is already implemented  
⚠️ **Redis not installed locally** (but app works fine without it)  
⚠️ **Production Redis not connected** (needs Render setup)

---

## How It Works Without Redis

The app **gracefully degrades** if Redis is unavailable:
- ✅ Caching is automatically disabled
- ✅ App continues working normally
- ✅ Logs show: `⚠️ Redis connection failed (will retry)`
- ✅ No crashes, no errors

**You can use the app right now without Redis!** It just won't have caching benefits.

---

## Local Development (Optional)

### macOS
```bash
brew install redis
brew services start redis

# Test it:
redis-cli ping
# Should return: PONG
```

### Add to `.env`:
```env
REDIS_URL=redis://localhost:6379
```

### Verify it's working:
```bash
# Start your app
npm run dev

# Check logs - you should see:
# ✅ Redis connected successfully
# ✅ Redis ready to accept commands
```

---

## Production (Render.com)

### Step 1: Connect Redis Service

Your `render.yaml` already defines Redis (lines 118-124), but it needs to be connected:

1. Go to Render Dashboard → Your Redis service (`jevah-redis`)
2. Copy the **Internal Redis URL** (looks like: `redis://red-xxxxx:6379`)
3. Or use the **Public Redis URL** if you need external access

### Step 2: Add to Environment Variables

In Render Dashboard → Your Web Service → Environment:
- Key: `REDIS_URL`
- Value: `redis://red-xxxxx:6379` (or the URL from step 1)

### Step 3: Restart Your Service

After adding `REDIS_URL`, restart your web service. Check logs:
```
✅ Redis connected successfully
✅ Redis ready to accept commands
```

---

## No API Keys Needed!

Redis doesn't use API keys like AWS/Cloudinary. It uses:
- **Connection URL**: `redis://host:port`
- **Password (optional)**: `redis://:password@host:port`

Most managed Redis services (like Render) provide the full URL with password included.

---

## Verify Redis is Working

### Check Metrics Endpoint:
```bash
curl http://localhost:4000/api/metrics
```

Look for:
```json
{
  "redisCache": {
    "connected": true,
    "keys": 42,
    "counters": {
      "hits": 150,
      "misses": 30,
      ...
    }
  }
}
```

### Check Logs:
- ✅ `Redis connected successfully` = Working
- ⚠️ `Redis connection failed` = Not connected (but app still works)

---

## What You Get With Redis

**Without Redis:**
- All requests hit database
- Trending endpoints: 500ms-2s per request
- No session persistence across instances

**With Redis:**
- Cached requests: 10-50ms (10-100x faster!)
- Trending endpoints cached 60-120s
- AI chat sessions persist across instances
- Background job queues work (BullMQ needs Redis)

---

## Troubleshooting

### "Redis connection failed"
- ✅ **This is OK!** App still works, just no caching
- Check if Redis is running: `redis-cli ping`
- Check `REDIS_URL` in `.env`

### "Connection refused"
- Redis not running locally
- Install: `brew install redis && brew services start redis`

### Production: "Timeout connecting to Redis"
- Check Render Redis service is running
- Verify `REDIS_URL` is correct
- Check firewall/network settings

---

## Quick Test

```bash
# 1. Install Redis (macOS)
brew install redis
brew services start redis

# 2. Add to .env
echo "REDIS_URL=redis://localhost:6379" >> .env

# 3. Restart app
npm run dev

# 4. Check logs for:
# ✅ Redis connected successfully

# 5. Test caching:
curl http://localhost:4000/api/enhanced-media/trending
# First request: slow (cache miss)
# Second request: fast (cache hit)
```

---

**Bottom line:** Redis is **optional but recommended** for production. The app works fine without it, but you'll get 10-100x speed improvements on cached endpoints when it's enabled.
