# Redis Integration Guide

This guide explains how Redis is integrated into the backend, how to configure it, and how to deploy updates.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Redis Usage in Codebase](#redis-usage-in-codebase)
3. [Environment Configuration](#environment-configuration)
4. [Local Development Setup](#local-development-setup)
5. [Production Deployment](#production-deployment)
6. [Switching to Cloud Redis](#switching-to-cloud-redis)
7. [Updating Backend on Server](#updating-backend-on-server)

---

## Overview

Redis is used for:
- **Session Management**: User sessions stored in Redis (scalable across multiple servers)
- **Caching**: Fast response times for frequently accessed data (feeds, posts, counts)
- **Queue Management**: Background job processing (if using BullMQ)

### Architecture

```
┌─────────────┐
│   Express   │
│   Server    │
└──────┬──────┘
       │
       ├─── Session Store (connect-redis)
       ├─── Cache Service (lib/redisClient.ts)
       ├─── Rate Limiting (if implemented)
       └─── Queue Workers (BullMQ)
       │
       ▼
┌─────────────┐
│    Redis    │
│  (ioredis)  │
└─────────────┘
```

---

## Redis Usage in Codebase

### 1. Unified Redis Client (`src/lib/redisClient.ts`)

**Location**: `src/lib/redisClient.ts`

This is the **single source of truth** for Redis connections. All Redis operations should use this client.

```typescript
import { redisClient, isRedisConnected, redisSafe } from "../lib/redisClient";

// Direct access
await redisClient.set("key", "value");

// Safe wrapper (returns fallback on error)
const value = await redisSafe("getKey", async (client) => {
  return await client.get("key");
}, null);
```

**Key Functions**:
- `redisClient`: Direct Redis client instance
- `isRedisConnected()`: Check connection status
- `connectRedis()`: Explicitly connect
- `disconnectRedis()`: Graceful shutdown
- `redisSafe()`: Safe operation wrapper

### 2. Session Management (`src/config/session.config.ts`)

**Location**: `src/config/session.config.ts`

Sessions are stored in Redis using `connect-redis`. Sessions are prefixed with `session:` in Redis.

```typescript
// Sessions are automatically stored in Redis
// Access via req.session in route handlers
app.get("/profile", (req, res) => {
  req.session.userId = "123";
  req.session.save();
});
```

**Session Configuration**:
- Cookie name: `jevah.sid`
- Max age: 24 hours
- Secure: Only HTTPS in production
- HttpOnly: Prevents XSS
- SameSite: Strict in production

### 3. Cache Service (`src/service/cache.service.ts`)

**Location**: `src/service/cache.service.ts`

Uses the unified Redis client for caching.

```typescript
import cacheService from "./service/cache.service";

// Get from cache
const data = await cacheService.get("cache:key");

// Set in cache (TTL in seconds)
await cacheService.set("cache:key", data, 3600);

// Get or set pattern
const result = await cacheService.getOrSet(
  "cache:key",
  async () => {
    // Fetch from DB
    return await fetchFromDatabase();
  },
  3600 // TTL
);
```

### 4. Feed Caching (`src/controllers/media.controller.ts`)

**Location**: `src/controllers/media.controller.ts` (line ~731)

Feed endpoints cache full responses in Redis:
- Key pattern: `feed:user:{userId}:{hash}` or `feed:global:{hash}`
- TTL: 10 minutes (600 seconds)

### 5. Like/View Counters (`src/lib/redisCounters.ts`)

**Location**: `src/lib/redisCounters.ts`

Fast counters stored in Redis:
- `post:{postId}:likes`
- `post:{postId}:views`
- `post:{postId}:comments`
- `user:{userId}:like:{contentId}` (user like state)

---

## Environment Configuration

### Required Environment Variables

Add to your `.env` file:

```bash
# Redis Configuration
REDIS_URL=redis://127.0.0.1:6379

# Session Secret (can use JWT_SECRET if already set)
SESSION_SECRET=your-session-secret-here
```

### Environment Variable Details

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `REDIS_URL` | Redis connection URL | `redis://127.0.0.1:6379` | `redis://user:pass@host:6379` |
| `SESSION_SECRET` | Secret for session encryption | Uses `JWT_SECRET` | `my-secret-key` |

---

## Local Development Setup

### 1. Install Redis Locally

**macOS (Homebrew)**:
```bash
brew install redis
brew services start redis
```

**Linux (Ubuntu/Debian)**:
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
```

**Docker**:
```bash
docker run -d -p 6379:6379 --name redis redis:latest
```

### 2. Configure `.env`

Create/update `.env` file in project root:

```bash
# Redis (local)
REDIS_URL=redis://127.0.0.1:6379

# Session
SESSION_SECRET=dev-session-secret-change-in-production
```

### 3. Verify Redis Connection

Start your backend:
```bash
npm run dev
```

You should see:
```
✅ Redis connected and ready
✅ Redis session store ready
```

### 4. Test Redis

```bash
# Connect to Redis CLI
redis-cli

# Check if keys exist
KEYS *

# Check session keys
KEYS session:*

# Check feed cache
KEYS feed:*
```

---

## Production Deployment

### Contabo VPS Setup

1. **Install Redis on Server**:
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Verify
redis-cli ping
# Should return: PONG
```

2. **Configure Redis for Production**:
```bash
sudo nano /etc/redis/redis.conf
```

Update:
```conf
# Bind to localhost only (use firewall for external access)
bind 127.0.0.1

# Require password (recommended)
requirepass your-strong-password-here

# Persistence
save 900 1
save 300 10
save 60 10000
```

Restart Redis:
```bash
sudo systemctl restart redis-server
```

3. **Set Environment Variables**:

On your Contabo server, update `.env`:
```bash
REDIS_URL=redis://:your-strong-password-here@127.0.0.1:6379
SESSION_SECRET=your-production-session-secret
```

Or if Redis has no password:
```bash
REDIS_URL=redis://127.0.0.1:6379
```

4. **Firewall Configuration** (if accessing Redis from external):

```bash
# Allow Redis port (only if needed)
sudo ufw allow 6379/tcp

# Better: Use SSH tunnel for external access
ssh -L 6379:localhost:6379 user@your-server-ip
```

---

## Switching to Cloud Redis

### Option 1: Redis Cloud (Recommended)

1. **Sign up**: https://redis.com/try-free/
2. **Create database**: Get connection URL
3. **Update `.env`**:
```bash
REDIS_URL=redis://default:password@redis-12345.c1.us-east-1-1.ec2.cloud.redislabs.com:12345
```

### Option 2: AWS ElastiCache

1. **Create ElastiCache cluster** in AWS Console
2. **Get endpoint**: `your-cluster.cache.amazonaws.com:6379`
3. **Update `.env`**:
```bash
REDIS_URL=redis://your-cluster.cache.amazonaws.com:6379
```

### Option 3: Upstash (Serverless)

1. **Create database** in Upstash Console
2. **Get REST URL** (for REST API) or **Redis URL** (for ioredis)
3. **Update `.env`**:
```bash
# For ioredis (direct connection)
REDIS_URL=redis://default:password@host:port
```

**Note**: The codebase also supports Upstash REST API via `src/lib/redis.ts` (separate from ioredis).

### After Switching

1. **No code changes needed** - just update `REDIS_URL`
2. **Restart backend**:
```bash
npm run build
npm start
```

3. **Verify connection**:
```bash
# Check logs
tail -f logs/app.log

# Should see:
✅ Redis connected and ready
```

---

## Updating Backend on Server

### Method 1: Git Pull (Recommended)

```bash
# SSH into your Contabo server
ssh user@your-server-ip

# Navigate to project directory
cd /path/to/jevahapp-backend

# Pull latest changes
git pull origin main

# Install new dependencies (if any)
npm install

# Build TypeScript
npm run build

# Restart backend (using PM2 or systemd)
pm2 restart jevahapp-backend
# OR
sudo systemctl restart jevahapp-backend
```

### Method 2: Manual Upload

1. **Build locally**:
```bash
npm run build
```

2. **Upload to server**:
```bash
# Using SCP
scp -r dist/ user@server:/path/to/jevahapp-backend/
scp package.json user@server:/path/to/jevahapp-backend/
```

3. **On server**:
```bash
cd /path/to/jevahapp-backend
npm install --production
pm2 restart jevahapp-backend
```

### Method 3: CI/CD (Advanced)

Set up GitHub Actions or similar to automatically deploy on push.

### Post-Deployment Checklist

- [ ] Verify Redis connection in logs
- [ ] Test session persistence (login, check session)
- [ ] Test cache functionality (feed endpoint)
- [ ] Monitor Redis memory usage
- [ ] Check for errors in logs

---

## Troubleshooting

### Redis Connection Failed

**Error**: `❌ Redis connection error`

**Solutions**:
1. Check Redis is running: `redis-cli ping`
2. Verify `REDIS_URL` in `.env`
3. Check firewall rules
4. Verify Redis password (if set)

### Session Not Persisting

**Issue**: Sessions lost on server restart

**Solutions**:
1. Verify Redis persistence is enabled
2. Check session store connection
3. Verify `SESSION_SECRET` is set

### Cache Not Working

**Issue**: Cache always returns null

**Solutions**:
1. Check `isRedisConnected()` returns `true`
2. Verify Redis keys: `redis-cli KEYS cache:*`
3. Check TTL values (keys may have expired)

---

## Redis Key Patterns

| Pattern | Purpose | Example |
|---------|---------|---------|
| `session:*` | User sessions | `session:sess:abc123` |
| `feed:*` | Cached feeds | `feed:user:123:hash` |
| `cache:*` | General cache | `cache:media:456` |
| `post:*:likes` | Like counters | `post:789:likes` |
| `user:*:like:*` | User like state | `user:123:like:789` |

---

## Performance Tips

1. **Use TTLs**: Always set expiration on cache keys
2. **Monitor Memory**: Use `redis-cli INFO memory`
3. **Connection Pooling**: Already configured in `redisClient.ts`
4. **Pipeline Operations**: Use pipelines for bulk operations
5. **Avoid KEYS**: Use SCAN for pattern matching (already implemented)

---

## Security Best Practices

1. **Use Password**: Set `requirepass` in Redis config
2. **Bind to Localhost**: Only allow local connections
3. **Use TLS**: For cloud Redis, use `rediss://` (SSL)
4. **Rotate Secrets**: Change `SESSION_SECRET` periodically
5. **Monitor Access**: Log Redis access patterns

---

## Additional Resources

- [ioredis Documentation](https://github.com/redis/ioredis)
- [express-session Documentation](https://github.com/expressjs/session)
- [connect-redis Documentation](https://github.com/tj/connect-redis)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)

---

## Summary

✅ **Redis is integrated** via `src/lib/redisClient.ts`  
✅ **Sessions use Redis** via `connect-redis`  
✅ **Caching uses Redis** via unified client  
✅ **Easy to switch** - just update `REDIS_URL`  
✅ **Production ready** - handles connection failures gracefully  

**To switch to cloud Redis**: Simply update `REDIS_URL` in `.env` and restart!

