# Redis Usage Locations in Codebase

This document highlights **where Redis is being used** in the codebase, making it easy to understand the integration points and swap to cloud Redis later.

## 🔍 Quick Reference: Redis Usage Map

### Core Redis Infrastructure

| File | Purpose | Redis Usage |
|------|---------|-------------|
| `src/lib/redisClient.ts` | **Unified Redis client** | Main ioredis connection - **THIS IS WHERE TO CHANGE REDIS_URL** |
| `src/config/session.config.ts` | Session store | Uses `redisClient` for session storage |
| `src/service/cache.service.ts` | General caching | Uses `redisClient` for all cache operations |

### Session Management

| File | Purpose | Redis Keys |
|------|---------|------------|
| `src/config/session.config.ts` | Session middleware | `session:*` (prefixed) |
| `src/app.ts` (line ~207) | Session middleware setup | Uses `sessionMiddleware` |

### Caching

| File | Purpose | Redis Keys |
|------|---------|------------|
| `src/controllers/media.controller.ts` (line ~731) | Feed caching | `feed:user:{userId}:{hash}` or `feed:global:{hash}` |
| `src/service/cache.service.ts` | General cache service | `cache:*` (various patterns) |
| `src/middleware/cache.middleware.ts` | HTTP response caching | Uses `cacheService` |

### Counters & State

| File | Purpose | Redis Keys |
|------|---------|------------|
| `src/lib/redisCounters.ts` | Like/view counters | `post:{postId}:likes`, `post:{postId}:views`, `post:{postId}:comments` |
| `src/lib/redisCounters.ts` | User like state | `user:{userId}:like:{contentId}` |
| `src/service/contentInteraction.service.ts` | Like operations | Uses `redisCounters` |

### Authentication

| File | Purpose | Redis Usage |
|------|---------|-------------|
| `src/middleware/auth.middleware.ts` (line ~118) | User cache | `auth:user:{userId}` |

### Queues (if using BullMQ)

| File | Purpose | Redis Usage |
|------|---------|-------------|
| `src/queues/queueConnection.ts` | Queue connection | Uses separate Redis connection for queues |

---

## 🔄 How to Switch to Cloud Redis

### Step 1: Update Environment Variable

**File**: `.env` (or server environment)

```bash
# Change from:
REDIS_URL=redis://127.0.0.1:6379

# To (example - Redis Cloud):
REDIS_URL=redis://default:password@redis-12345.c1.us-east-1-1.ec2.cloud.redislabs.com:12345
```

### Step 2: Restart Backend

```bash
npm run build
npm start
```

**That's it!** All Redis operations will automatically use the new URL.

---

## 📝 Detailed File Breakdown

### 1. `src/lib/redisClient.ts` ⭐ **MOST IMPORTANT**

**Purpose**: Unified Redis client - single source of truth

**Key Code**:
```typescript
// Line ~15: Redis URL from environment
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

// Line ~30: Creates Redis client
export const redisClient = new Redis(redisOptions);
```

**To Switch Redis**: Update `REDIS_URL` in `.env` - no code changes needed!

**Used By**:
- Session store (`session.config.ts`)
- Cache service (`cache.service.ts`)
- Any direct Redis operations

---

### 2. `src/config/session.config.ts`

**Purpose**: Express session store using Redis

**Key Code**:
```typescript
// Line ~24: Creates Redis store
const redisStore = new RedisStore({
  client: redisClient, // Uses unified client
  prefix: "session:",
});
```

**Redis Keys**: `session:sess:{sessionId}`

**To Switch**: Already uses `redisClient`, so just update `REDIS_URL`

---

### 3. `src/service/cache.service.ts`

**Purpose**: General-purpose caching service

**Key Code**:
```typescript
// Line ~5: Imports unified client
import { redisClient, isRedisConnected } from "../lib/redisClient";

// Line ~33: Uses unified client
const data = await redisClient.get(key);
```

**Redis Keys**: Various patterns (cache keys, feed keys, etc.)

**To Switch**: Already uses `redisClient`, so just update `REDIS_URL`

---

### 4. `src/controllers/media.controller.ts`

**Purpose**: Feed endpoint caching

**Key Code** (line ~731):
```typescript
// Uses redisSafe wrapper (from lib/redis.ts - Upstash REST)
// OR uses redisClient directly for ioredis operations
```

**Redis Keys**: `feed:user:{userId}:{hash}`

**Note**: This file uses both Upstash REST API (`lib/redis.ts`) and ioredis (`lib/redisClient.ts`)

---

### 5. `src/lib/redisCounters.ts`

**Purpose**: Fast counters (likes, views, comments)

**Key Code**:
```typescript
// Uses redisSafe from lib/redis.ts (Upstash REST)
// Can be migrated to use redisClient if needed
```

**Redis Keys**:
- `post:{postId}:likes`
- `post:{postId}:views`
- `post:{postId}:comments`
- `user:{userId}:like:{contentId}`

---

## 🔧 Migration Notes

### Current Setup

The codebase uses **two Redis clients**:

1. **ioredis** (`lib/redisClient.ts`) - For sessions, caching, queues
2. **Upstash REST** (`lib/redis.ts`) - For some counters and feed operations

### Future Consolidation

To fully consolidate on ioredis:

1. Update `src/lib/redisCounters.ts` to use `redisClient` instead of Upstash REST
2. Update `src/controllers/media.controller.ts` feed caching to use `redisClient`
3. Remove `lib/redis.ts` (Upstash REST) if no longer needed

**For now**: Both work, and you can switch `REDIS_URL` to use cloud Redis with ioredis.

---

## ✅ Summary

**To switch to cloud Redis**:
1. Update `REDIS_URL` in `.env`
2. Restart backend
3. Done!

**All Redis operations go through**:
- `src/lib/redisClient.ts` (ioredis) - **Primary**
- `src/lib/redis.ts` (Upstash REST) - **Secondary** (can be migrated)

**Key locations**:
- ✅ Session: `src/config/session.config.ts`
- ✅ Cache: `src/service/cache.service.ts`
- ✅ Feed: `src/controllers/media.controller.ts`
- ✅ Counters: `src/lib/redisCounters.ts`

