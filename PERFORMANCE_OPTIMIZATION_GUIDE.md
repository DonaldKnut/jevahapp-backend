# Backend Performance Optimization Guide

**Comprehensive guide to significantly improve backend performance**

---

## 🎯 Quick Wins (Implement First)

### 1. **Database Connection Pooling** ⚡ (30-50% improvement)

**Current Issue:** Basic Mongoose connection without pooling options.

**Fix:**

```typescript
// src/index.ts
mongoose
  .connect(process.env.MONGODB_URI!, {
    maxPoolSize: 10, // Maintain up to 10 socket connections
    minPoolSize: 2, // Maintain at least 2 socket connections
    serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    family: 4, // Use IPv4, skip trying IPv6
    bufferMaxEntries: 0, // Disable mongoose buffering
    bufferCommands: false, // Disable mongoose buffering
  })
  .then(() => {
    logger.info("✅ MongoDB connected with connection pooling");
    // ... rest of code
  });
```

**Expected Impact:** 30-50% faster database queries, better connection reuse.

---

### 2. **Redis Caching Layer** ⚡ (50-80% improvement for cached endpoints)

**Current Issue:** No caching layer - every request hits the database.

**Implementation:**

```bash
npm install redis ioredis
npm install --save-dev @types/redis
```

**Create Redis Service:**

```typescript
// src/service/cache.service.ts
import Redis from "ioredis";
import logger from "../utils/logger";

class CacheService {
  private client: Redis;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    this.client.on("connect", () => {
      logger.info("✅ Redis connected");
    });

    this.client.on("error", (err) => {
      logger.error("❌ Redis error:", err);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error("Cache get error:", error);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    try {
      await this.client.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      logger.error("Cache set error:", error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error("Cache delete error:", error);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      logger.error("Cache delete pattern error:", error);
    }
  }

  // Cache middleware helper
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = 3600
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached) {
      return cached;
    }

    const data = await fetchFn();
    await this.set(key, data, ttl);
    return data;
  }
}

export const cacheService = new CacheService();
export default cacheService;
```

**Use in Controllers:**

```typescript
// src/controllers/media.controller.ts
import cacheService from "../service/cache.service";

export const getAllMedia = async (req: Request, res: Response) => {
  const cacheKey = `media:all:${req.query.page || 1}:${req.query.limit || 20}`;
  
  const result = await cacheService.getOrSet(
    cacheKey,
    async () => {
      return await mediaService.getAllMedia(req.query);
    },
    300 // 5 minutes cache
  );

  res.json(result);
};
```

**Expected Impact:** 50-80% faster response times for frequently accessed data.

---

### 3. **Database Indexing Improvements** ⚡ (40-60% improvement)

**Current Issue:** Missing indexes on frequently queried fields.

**Add Comprehensive Indexes:**

```typescript
// src/models/media.model.ts
// Add these indexes:

// For search queries
mediaSchema.index({ title: "text", description: "text" }); // Text search
mediaSchema.index({ contentType: 1, category: 1, createdAt: -1 });
mediaSchema.index({ uploadedBy: 1, createdAt: -1 }); // User's media
mediaSchema.index({ isLive: 1, liveStreamStatus: 1, createdAt: -1 });

// For trending/popular queries
mediaSchema.index({ viewCount: -1, likeCount: -1, createdAt: -1 });
mediaSchema.index({ totalViews: -1, totalLikes: -1 });

// For filtering
mediaSchema.index({ category: 1, contentType: 1, isActive: 1 });
mediaSchema.index({ topics: 1, contentType: 1 });

// Compound indexes for common queries
mediaSchema.index({ contentType: 1, category: 1, createdAt: -1 });
mediaSchema.index({ uploadedBy: 1, contentType: 1, createdAt: -1 });
```

**Create Index Migration Script:**

```javascript
// scripts/create-performance-indexes.js
const mongoose = require("mongoose");
require("dotenv").config();

async function createIndexes() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const db = mongoose.connection.db;
  
  // Media collection indexes
  await db.collection("media").createIndexes([
    { key: { title: "text", description: "text" } },
    { key: { contentType: 1, category: 1, createdAt: -1 } },
    { key: { uploadedBy: 1, createdAt: -1 } },
    { key: { viewCount: -1, likeCount: -1, createdAt: -1 } },
    { key: { category: 1, contentType: 1, isActive: 1 } },
  ]);
  
  // Users collection indexes
  await db.collection("users").createIndexes([
    { key: { email: 1 }, unique: true },
    { key: { role: 1, createdAt: -1 } },
  ]);
  
  // Polls collection indexes
  await db.collection("polls").createIndexes([
    { key: { isActive: 1, closesAt: -1 } },
    { key: { authorId: 1, createdAt: -1 } },
  ]);
  
  console.log("✅ Indexes created successfully");
  await mongoose.connection.close();
}

createIndexes();
```

**Expected Impact:** 40-60% faster database queries, especially for filtered searches.

---

### 4. **Response Caching Middleware** ⚡ (30-50% improvement)

**Create Caching Middleware:**

```typescript
// src/middleware/cache.middleware.ts
import { Request, Response, NextFunction } from "express";
import cacheService from "../service/cache.service";

export const cacheMiddleware = (ttl: number = 300) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    // Skip cache for authenticated user-specific data
    if (req.userId) {
      return next();
    }

    const cacheKey = `cache:${req.originalUrl}:${JSON.stringify(req.query)}`;

    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        return res.json(cached);
      }

      // Store original json method
      const originalJson = res.json.bind(res);
      res.json = function (data: any) {
        cacheService.set(cacheKey, data, ttl).catch(() => {
          // Ignore cache errors
        });
        res.setHeader("X-Cache", "MISS");
        return originalJson(data);
      };

      next();
    } catch (error) {
      next();
    }
  };
};
```

**Use in Routes:**

```typescript
// src/routes/media.route.ts
import { cacheMiddleware } from "../middleware/cache.middleware";

// Cache public media for 5 minutes
router.get("/public", cacheMiddleware(300), apiRateLimiter, getPublicMedia);
router.get("/public/:id", cacheMiddleware(600), apiRateLimiter, getPublicMediaByIdentifier);
```

**Expected Impact:** 30-50% faster response times for public endpoints.

---

### 5. **Query Optimization - Use Lean() and Select()** ⚡ (20-40% improvement)

**Current Issue:** Using full Mongoose documents with all methods.

**Optimize Queries:**

```typescript
// Before (slow)
const media = await Media.find(query).populate("uploadedBy");

// After (fast)
const media = await Media.find(query)
  .select("title description contentType thumbnailUrl uploadedBy createdAt")
  .populate("uploadedBy", "firstName lastName avatar")
  .lean(); // Returns plain JavaScript objects, not Mongoose documents
```

**Update Media Service:**

```typescript
// src/service/media.service.ts
async getAllMedia(filters: any = {}) {
  // ... query building ...

  const [mediaList, total] = await Promise.all([
    Media.find(query)
      .select("title description contentType category thumbnailUrl uploadedBy createdAt viewCount likeCount")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("uploadedBy", "firstName lastName avatar")
      .lean(), // ⚡ Use lean() for 20-40% faster queries
    Media.countDocuments(query),
  ]);

  return {
    media: mediaList,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}
```

**Expected Impact:** 20-40% faster queries, less memory usage.

---

## 🚀 Major Optimizations

### 6. **Database Aggregation Pipeline Optimization** ⚡ (50-70% improvement)

**Current Issue:** Multiple queries instead of single aggregation.

**Optimize with Aggregation:**

```typescript
// src/service/media.service.ts
async getTrendingMedia(limit: number = 20) {
  const pipeline = [
    {
      $match: {
        isActive: true,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
      },
    },
    {
      $addFields: {
        trendingScore: {
          $add: [
            { $multiply: ["$viewCount", 1] },
            { $multiply: ["$likeCount", 2] },
            { $multiply: ["$shareCount", 3] },
          ],
        },
      },
    },
    { $sort: { trendingScore: -1, createdAt: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "users",
        localField: "uploadedBy",
        foreignField: "_id",
        as: "creator",
        pipeline: [
          { $project: { firstName: 1, lastName: 1, avatar: 1 } },
        ],
      },
    },
    { $unwind: { path: "$creator", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        title: 1,
        description: 1,
        contentType: 1,
        thumbnailUrl: 1,
        viewCount: 1,
        likeCount: 1,
        creator: 1,
        createdAt: 1,
      },
    },
  ];

  return await Media.aggregate(pipeline);
}
```

**Expected Impact:** 50-70% faster complex queries, single database round trip.

---

### 7. **Background Job Processing** ⚡ (Eliminates blocking operations)

**Current Issue:** Heavy operations block API responses.

**Implement with Bull Queue:**

```bash
npm install bull
```

```typescript
// src/service/queue.service.ts
import Queue from "bull";
import logger from "../utils/logger";

export const mediaProcessingQueue = new Queue("media-processing", {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  },
});

// Process jobs
mediaProcessingQueue.process("process-video", async (job) => {
  const { mediaId } = job.data;
  // Process video in background
  logger.info(`Processing video ${mediaId}`);
  // ... processing logic
});

// Add job
export const addMediaProcessingJob = async (mediaId: string) => {
  await mediaProcessingQueue.add("process-video", { mediaId });
};
```

**Use in Controllers:**

```typescript
// src/controllers/media.controller.ts
export const uploadMedia = async (req: Request, res: Response) => {
  // ... upload logic ...
  
  // Return immediately, process in background
  res.status(201).json({ success: true, media });
  
  // Process in background
  await addMediaProcessingJob(media._id.toString());
};
```

**Expected Impact:** API responses 10x faster, no blocking operations.

---

### 8. **API Response Compression** ⚡ (Already implemented, but optimize)

**Current:** Basic compression enabled.

**Optimize Compression:**

```typescript
// src/app.ts
import compression from "compression";

app.use(
  compression({
    level: 6, // Balance between speed and compression (1-9)
    threshold: 1024, // Only compress responses > 1KB
    filter: (req, res) => {
      // Don't compress if client doesn't support it
      if (req.headers["x-no-compression"]) {
        return false;
      }
      return compression.filter(req, res);
    },
  })
);
```

**Expected Impact:** 30-50% smaller response sizes, faster transfers.

---

### 9. **Pagination Optimization** ⚡ (20-30% improvement)

**Current Issue:** Using skip() which gets slower with large offsets.

**Use Cursor-Based Pagination:**

```typescript
// src/service/media.service.ts
async getAllMediaCursor(cursor?: string, limit: number = 20) {
  const query: any = { isActive: true };
  
  if (cursor) {
    query._id = { $gt: new Types.ObjectId(cursor) };
  }

  const media = await Media.find(query)
    .select("title description contentType thumbnailUrl")
    .sort({ _id: 1 }) // Sort by _id for cursor
    .limit(limit + 1) // Fetch one extra to check if there's more
    .lean();

  const hasMore = media.length > limit;
  const items = hasMore ? media.slice(0, limit) : media;
  const nextCursor = hasMore ? items[items.length - 1]._id.toString() : null;

  return {
    media: items,
    nextCursor,
    hasMore,
  };
}
```

**Expected Impact:** 20-30% faster pagination, especially for large datasets.

---

### 10. **Database Query Result Caching** ⚡ (60-80% improvement)

**Cache Frequently Accessed Data:**

```typescript
// src/service/media.service.ts
import cacheService from "./cache.service";

async getMediaByIdentifier(id: string) {
  const cacheKey = `media:${id}`;
  
  return await cacheService.getOrSet(
    cacheKey,
    async () => {
      const media = await Media.findById(id)
        .populate("uploadedBy", "firstName lastName avatar")
        .lean();
      return media;
    },
    1800 // 30 minutes cache
  );
}

// Invalidate cache on update
async updateMedia(id: string, data: any) {
  const media = await Media.findByIdAndUpdate(id, data, { new: true });
  await cacheService.del(`media:${id}`);
  await cacheService.delPattern("media:all:*"); // Clear list caches
  return media;
}
```

**Expected Impact:** 60-80% faster for frequently accessed items.

---

## 📊 Performance Monitoring

### Add Performance Monitoring:

```typescript
// src/middleware/performance.middleware.ts
import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";

export const performanceMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    
    if (duration > 1000) {
      logger.warn("Slow request detected", {
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`,
        userId: req.userId || "anonymous",
      });
    }

    // Log all requests for monitoring
    logger.info("Request completed", {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
    });
  });

  next();
};
```

---

## 🎯 Implementation Priority

### Phase 1 (Quick Wins - Do First):
1. ✅ Database Connection Pooling
2. ✅ Query Optimization (lean(), select())
3. ✅ Response Caching Middleware
4. ✅ Database Indexing

**Expected Improvement:** 50-70% faster overall

### Phase 2 (Major Optimizations):
5. ✅ Redis Caching Layer
6. ✅ Database Aggregation Optimization
7. ✅ Cursor-Based Pagination
8. ✅ Query Result Caching

**Expected Improvement:** Additional 40-60% faster

### Phase 3 (Advanced):
9. ✅ Background Job Processing
10. ✅ Advanced Caching Strategies

**Expected Improvement:** Additional 30-50% faster, eliminates blocking

---

## 📈 Expected Overall Impact

**Before Optimization:**
- Average API response: 200-500ms
- Database queries: 50-200ms
- Complex queries: 500-2000ms

**After Phase 1:**
- Average API response: 100-250ms (50% faster)
- Database queries: 25-100ms (50% faster)
- Complex queries: 250-1000ms (50% faster)

**After Phase 2:**
- Average API response: 50-150ms (75% faster)
- Database queries: 10-50ms (80% faster)
- Complex queries: 100-400ms (80% faster)

**After Phase 3:**
- Average API response: 30-100ms (85% faster)
- No blocking operations
- Background processing for heavy tasks

---

## 🔧 Environment Variables Needed

Add to `.env`:

```env
# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# Database Connection Pool
MONGODB_POOL_SIZE=10
MONGODB_MIN_POOL_SIZE=2

# Cache TTLs (in seconds)
CACHE_TTL_SHORT=300      # 5 minutes
CACHE_TTL_MEDIUM=1800    # 30 minutes
CACHE_TTL_LONG=3600      # 1 hour
```

---

## 🚀 Quick Start

1. **Install Redis:**
   ```bash
   # macOS
   brew install redis
   brew services start redis
   
   # Or use Docker
   docker run -d -p 6379:6379 redis:alpine
   ```

2. **Install Dependencies:**
   ```bash
   npm install redis ioredis bull
   npm install --save-dev @types/redis
   ```

3. **Run Index Migration:**
   ```bash
   node scripts/create-performance-indexes.js
   ```

4. **Update Connection:**
   - Update `src/index.ts` with connection pooling
   - Add Redis service
   - Add caching middleware

5. **Test Performance:**
   ```bash
   # Use Apache Bench or similar
   ab -n 1000 -c 10 http://localhost:4000/api/media/public
   ```

---

## 📝 Summary

**Top 3 Most Impactful Optimizations:**

1. **Redis Caching** - 50-80% improvement for cached endpoints
2. **Database Indexing** - 40-60% faster queries
3. **Connection Pooling** - 30-50% faster database operations

**Total Expected Improvement:** 70-85% faster overall performance

---

**Last Updated:** 2024-01-15  
**Status:** Ready for Implementation ✅

