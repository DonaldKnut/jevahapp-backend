# Backend Performance Optimization Plan

## Critical Performance Issues Identified

### 1. ⚠️ **EXPENSIVE AGGREGATION PIPELINE** (CRITICAL)
**Problem**: The `getAllContentForAllTab` method uses `$lookup` on `mediauseractions` and `mediainteractions` collections for EVERY media item. This is extremely expensive.

**Current Code**:
```typescript
{
  $lookup: {
    from: "mediauseractions",
    localField: "_id",
    foreignField: "media",
    as: "userActions",
  },
},
{
  $lookup: {
    from: "mediainteractions",
    localField: "_id",
    foreignField: "media",
    as: "interactions",
  },
}
```

**Impact**: 
- For 50 items, this does 100+ lookups
- Each lookup scans potentially thousands of documents
- Response time: 1-3 seconds (should be < 500ms)

**Solution**: Use pre-calculated fields (`likeCount`, `viewCount`, `shareCount`) that are already in the Media model instead of recalculating.

### 2. ⚠️ **INEFFICIENT COUNT CALCULATION** (CRITICAL)
**Problem**: Calculating `totalLikes`, `totalShares`, `totalViews` by filtering arrays in aggregation instead of using indexed fields.

**Current Code**:
```typescript
totalLikes: {
  $size: {
    $filter: {
      input: "$userActions",
      as: "action",
      cond: { $eq: ["$$action.actionType", "like"] },
    },
  },
}
```

**Solution**: Use `likeCount`, `viewCount`, `shareCount` fields directly from Media document.

### 3. ⚠️ **MISSING DATABASE INDEXES** (HIGH PRIORITY)
**Problem**: Queries may not be using optimal indexes.

**Required Indexes**:
- `{ contentType: 1, createdAt: -1 }`
- `{ category: 1, createdAt: -1 }`
- `{ viewCount: -1 }`
- `{ likeCount: -1 }`
- `{ title: 'text', description: 'text' }`

### 4. ⚠️ **CACHE KEY NOT INCLUDING FILTERS** (MEDIUM)
**Problem**: Cache key doesn't include all filter parameters, causing cache misses.

**Current**: `media:all-content:page=1:limit=50`
**Should be**: Include all filter params in cache key

### 5. ⚠️ **REDUNDANT FIELD PROJECTION** (LOW)
**Problem**: Projecting both calculated fields (`totalLikes`) and stored fields (`likeCount`).

---

## Optimization Implementation

### Phase 1: Fix Aggregation Pipeline (CRITICAL - Immediate Impact)

**Before** (Slow - 1-3 seconds):
```typescript
// Does $lookup for every media item
$lookup: { from: "mediauseractions", ... }
$lookup: { from: "mediainteractions", ... }
// Then filters arrays to count
totalLikes: { $size: { $filter: { ... } } }
```

**After** (Fast - < 500ms):
```typescript
// Use pre-calculated fields directly
$project: {
  likeCount: 1,      // Already stored in Media
  viewCount: 1,      // Already stored in Media
  shareCount: 1,     // Already stored in Media
  // No $lookup needed!
}
```

**Expected Improvement**: 5-10x faster (from 1-3s to 200-500ms)

### Phase 2: Optimize Database Queries

1. **Add Missing Indexes**:
```javascript
db.media.createIndex({ contentType: 1, createdAt: -1 });
db.media.createIndex({ category: 1, createdAt: -1 });
db.media.createIndex({ viewCount: -1 });
db.media.createIndex({ likeCount: -1 });
db.media.createIndex({ title: 'text', description: 'text' });
```

2. **Use Lean Queries**: Already using `.lean()` ✅

3. **Limit Fields**: Already optimized ✅

### Phase 3: Improve Caching Strategy

1. **Include All Filters in Cache Key**
2. **Increase Cache TTL** for stable queries
3. **Cache Invalidation** on media updates

### Phase 4: Connection Pool Optimization

Current: `maxPoolSize: 10`
Recommended: `maxPoolSize: 20-50` (depending on server capacity)

---

## Implementation Priority

1. **🔴 CRITICAL** - Fix aggregation pipeline (remove $lookup)
2. **🟡 HIGH** - Add database indexes
3. **🟡 HIGH** - Fix cache key generation
4. **🟢 MEDIUM** - Optimize connection pool
5. **🟢 LOW** - Remove redundant fields

---

## Expected Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Response Time (p95) | 1-3s | 200-500ms | **5-10x faster** |
| Database Queries | 100+ | 1-2 | **50-100x reduction** |
| Memory Usage | High | Low | **Significant reduction** |
| CPU Usage | High | Low | **Significant reduction** |

---

## Frontend Optimizations (Separate)

These are frontend-only and don't require backend changes:

1. **Lazy Loading**: Load images/videos on scroll
2. **Virtual Scrolling**: Only render visible items
3. **Request Debouncing**: Debounce rapid page changes
4. **Optimistic Updates**: Update UI before server response
5. **Prefetching**: Prefetch next page while user scrolls
6. **Image Optimization**: Use WebP, lazy load thumbnails

---

## Testing Plan

1. **Load Testing**: Test with 10,000+ media items
2. **Concurrent Requests**: Test with 100+ simultaneous requests
3. **Response Time Monitoring**: Track p50, p95, p99
4. **Database Query Analysis**: Use `explain()` to verify index usage
5. **Memory Profiling**: Monitor memory usage under load

---

## Success Criteria

✅ Response time < 500ms (p95)
✅ Database queries < 5 per request
✅ Memory usage stable (no leaks)
✅ CPU usage < 50% under normal load
✅ Cache hit rate > 70%

