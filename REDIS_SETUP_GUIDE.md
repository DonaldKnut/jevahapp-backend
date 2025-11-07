# Redis Setup Guide - How to Get Redis URL

**Complete guide for setting up Redis locally and in production**

---

## 🚀 Quick Setup

### Option 1: Local Development (macOS)

```bash
# Install Redis
brew install redis

# Start Redis
brew services start redis

# Verify it's running
redis-cli ping
# Should return: PONG

# Your Redis URL:
REDIS_URL=redis://localhost:6379
```

### Option 2: Local Development (Docker)

```bash
# Run Redis in Docker
docker run -d -p 6379:6379 --name redis redis:alpine

# Verify it's running
docker ps
redis-cli ping

# Your Redis URL:
REDIS_URL=redis://localhost:6379
```

### Option 3: Local Development (Windows)

```bash
# Download Redis from: https://github.com/microsoftarchive/redis/releases
# Or use WSL2 with Linux instructions

# Your Redis URL:
REDIS_URL=redis://localhost:6379
```

---

## ☁️ Production Setup

### Option 1: Render (Recommended)

1. **Go to Render Dashboard:** https://dashboard.render.com
2. **Create New Redis Instance:**

   - Click "New +" → "Redis"
   - Choose a name (e.g., `jevah-redis`)
   - Select region (e.g., `Oregon`)
   - Choose plan (Starter is fine for development)
   - Click "Create Redis"

3. **Get Redis URL:**

   - After creation, click on your Redis instance
   - Copy the "Internal Redis URL" (for same service)
   - Or "External Redis URL" (for external access)
   - Format: `redis://red-xxxxx:6379` or `redis://red-xxxxx:6379?password=xxxxx`

4. **Add to Environment Variables:**
   ```env
   REDIS_URL=redis://red-xxxxx:6379
   # Or with password:
   REDIS_URL=redis://red-xxxxx:6379?password=xxxxx
   ```

### Option 2: Redis Cloud (Free Tier Available)

1. **Sign up:** https://redis.com/try-free/
2. **Create Database:**

   - Choose cloud provider (AWS, GCP, Azure)
   - Choose region
   - Create database

3. **Get Redis URL:**

   - Go to database details
   - Copy "Public endpoint" or "Private endpoint"
   - Format: `redis://default:password@host:port`

4. **Add to Environment Variables:**
   ```env
   REDIS_URL=redis://default:password@host:port
   ```

### Option 3: AWS ElastiCache

1. **Create ElastiCache Cluster:**

   - Go to AWS Console → ElastiCache
   - Create Redis cluster
   - Get endpoint URL

2. **Redis URL Format:**
   ```env
   REDIS_URL=redis://your-cluster-endpoint:6379
   ```

### Option 4: Railway

1. **Create Redis Service:**

   - Go to Railway dashboard
   - Create new service → Redis
   - Get connection URL

2. **Redis URL Format:**
   ```env
   REDIS_URL=redis://default:password@host:port
   ```

---

## 🔍 How to Find Your Redis URL

### Local Development

**Default Redis URL:**

```
redis://localhost:6379
```

**With Password:**

```
redis://:password@localhost:6379
```

**With Username and Password:**

```
redis://username:password@localhost:6379
```

### Production

**Check Your Hosting Provider:**

1. **Render:**

   - Dashboard → Your Redis Service → "Info" tab
   - Look for "Internal Redis URL" or "External Redis URL"

2. **Heroku:**

   - Dashboard → Your App → Resources → Redis addon
   - Click on Redis addon → "Info" tab
   - Copy "REDIS_URL"

3. **DigitalOcean:**

   - Dashboard → Databases → Your Redis Database
   - Copy "Connection Details" → "URI"

4. **AWS ElastiCache:**
   - AWS Console → ElastiCache → Your Cluster
   - Copy "Primary Endpoint"

---

## ✅ Verify Redis Connection

### Test Locally

```bash
# Test Redis connection
redis-cli ping
# Should return: PONG

# Test with URL
redis-cli -u redis://localhost:6379 ping
```

### Test from Node.js

```javascript
// test-redis.js
const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

redis
  .ping()
  .then(() => console.log("✅ Redis connected!"))
  .catch(err => console.error("❌ Redis error:", err))
  .finally(() => redis.quit());
```

```bash
node test-redis.js
```

---

## 📝 Add to .env File

```env
# Local Development
REDIS_URL=redis://localhost:6379

# Production (Render)
REDIS_URL=redis://red-xxxxx:6379

# Production (with password)
REDIS_URL=redis://default:password@host:port
```

---

## 🐛 Troubleshooting

### Redis Not Connecting

**Error:** `ECONNREFUSED` or `Connection refused`

**Solutions:**

1. Check if Redis is running: `redis-cli ping`
2. Check Redis URL format
3. Check firewall/network settings
4. Verify port 6379 is open

### Redis URL Format Issues

**Common Formats:**

```
✅ redis://localhost:6379
✅ redis://:password@localhost:6379
✅ redis://username:password@host:6379
✅ redis://host:6379?password=xxxxx
```

**Invalid Formats:**

```
❌ redis://localhost (missing port)
❌ localhost:6379 (missing protocol)
❌ http://localhost:6379 (wrong protocol)
```

### Redis Password Issues

**If Redis has password:**

```env
# Format 1: In URL
REDIS_URL=redis://:password@localhost:6379

# Format 2: Query parameter
REDIS_URL=redis://localhost:6379?password=xxxxx
```

---

## 🎯 Quick Start Checklist

- [ ] Install Redis locally OR set up cloud Redis
- [ ] Get Redis URL from your provider
- [ ] Add `REDIS_URL` to `.env` file
- [ ] Test connection: `redis-cli ping`
- [ ] Start your backend server
- [ ] Check logs for "✅ Redis connected"

---

## 📊 Redis URL Examples

### Local Development

```env
REDIS_URL=redis://localhost:6379
```

### Render (Internal)

```env
REDIS_URL=redis://red-xxxxx:6379
```

### Render (External with Password)

```env
REDIS_URL=redis://red-xxxxx:6379?password=xxxxx
```

### Redis Cloud

```env
REDIS_URL=redis://default:password@host:port
```

### AWS ElastiCache

```env
REDIS_URL=redis://your-cluster-endpoint.cache.amazonaws.com:6379
```

---

## 🚀 Next Steps

1. **Get your Redis URL** (see options above)
2. **Add to `.env` file:**
   ```env
   REDIS_URL=your-redis-url-here
   ```
3. **Start your server:**
   ```bash
   npm run dev
   ```
4. **Check logs for:**
   ```
   ✅ Redis connected successfully
   ```

---

**Last Updated:** 2024-01-15  
**Status:** Ready to Use ✅
