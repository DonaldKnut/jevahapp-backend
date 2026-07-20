# Redis Ops (Engagement)

## Authoritative store

| Store | Env | Used for |
|-------|-----|----------|
| **Contabo / local ioredis** | `REDIS_URL` | **All app cache** via `CacheService`: feed lists (`feed:user:*` / `feed:global:*`), auth user snapshots (`auth:user:*`), like counters, rate limits, Idempotency-Key, sessions, BullMQ, optional Socket.IO adapter |
| Upstash REST (optional) | `UPSTASH_REDIS_REST_*` | Legacy/non-critical only — **not** feed, auth, or like hot path |

Do **not** split feed cache writes and invalidation across two Redis instances. Feed get/set and `invalidateFeedCaches` both use Contabo `REDIS_URL` (SCAN via `cacheService.delPattern`, never `KEYS`).

### Feed + auth keys

| Pattern | TTL | Notes |
|---------|-----|--------|
| `feed:user:{userId}:{hash}` / `feed:global:{hash}` | 600s | List payload without per-JWT flags; flags overlaid after hit |
| `auth:user:{userId}` | 120s | Ban/role/verification — deleted on admin mutations |

`flushAll` is blocked in production unless `ALLOW_REDIS_FLUSH=true`.

### Analytics ingest (no double path)

`publishEngagementEvent` uses **Kafka XOR BullMQ** — never both. If `KAFKA_BROKERS` is set and the producer connects, events go to Kafka only; otherwise they enqueue to BullMQ. Deploy a worker (`npm run worker:start` / docker-compose `worker`) so jobs process.

Leave `KAFKA_BROKERS` **unset** on Contabo unless Kafka is intentional (Kafka XOR BullMQ for analytics).

### Notifications queue

After Mongo notification insert, the API enqueues a `notifications` BullMQ job (`push`) with deterministic `jobId` (`notify:{dedupeKey|notificationId}`). The **worker** delivers Expo/push with retries. Do not rely on in-request push for durability.

## Contabo PM2 layout (API + worker)

Two processes share localhost Redis and Mongo Atlas:

```text
API (npm start)  →  Redis 127.0.0.1  →  Worker (npm run worker:start)
Mongo Atlas (authoritative writes)
```

```bash
# .env on Contabo
REDIS_URL=redis://127.0.0.1:6379
# Do not set KAFKA_BROKERS unless you run Kafka

# ecosystem (see ecosystem.config.cjs)
pm2 start ecosystem.config.cjs
pm2 status
```

Queues the worker consumes: `media-processing`, `analytics`, `notifications`.

## Contabo binding (recommended)

App and Redis on the same box:

```conf
# /etc/redis/redis.conf
bind 127.0.0.1
protected-mode yes
# Optional if Redis must be reachable from other hosts:
# requirepass <strong-password>
# Then: REDIS_URL=redis://:password@127.0.0.1:6379
```

Firewall: do not expose `6379` publicly. Prefer localhost-only bind.

## Socket.IO multi-worker

Single PM2 process (fork): leave adapter off.

PM2 cluster / multiple API instances:

```bash
SOCKET_REDIS_ADAPTER=true
REDIS_URL=redis://127.0.0.1:6379
```

## Metrics

`GET /api/metrics` includes:

```json
{
  "engagementRedis": {
    "connected": true,
    "metrics": {
      "idempotencyHits": 0,
      "idempotencyConflicts": 0,
      "rateLimitRejections": 0,
      "cacheFailures": 0
    }
  },
  "redisCache": {
    "feed": {
      "freshHits": 0,
      "staleHits": 0,
      "misses": 0,
      "coalesced": 0
    }
  },
  "moderation": {
    "providerAvailable": true,
    "aiBudget": {
      "day": "2026-07-19",
      "requests": 0,
      "budgetBlocks": 0,
      "quarantines": 0
    }
  }
}
```

### Feed cache keys (v2)

| Pattern | Notes |
|---------|--------|
| `feed:gen` | Generation counter — bump on publish/removal |
| `feed:global:v2:{gen}:{sha256}` | Shared public list cache (collision-safe hash) |
| `feed:userflags:{userId}:{mediaId}` | Tri-state like/bookmark flags |
| `post:counters:{mediaId}` | Like/view/comment/share overlay |

Structured logs: `idempotency_replay`, `like_rate_limited`, `like_toggle_completed`.

## Migrations / reconciliation

```bash
# Staging first, then production
npm run migrate:like-indexes:dry
npm run migrate:like-indexes

# Remove legacy permanent like/follow notification dedupeKeys
npm run cleanup:notification-dedupe:dry
npm run cleanup:notification-dedupe

# Cron-able counter repair (Media-driven — includes stale positive zero-like rows)
npm run reconcile:like-counts:dry
npm run reconcile:like-counts
```

## Integration tests (local only — never production data)

```bash
# Optional: docker compose up -d mongo redis
RUN_INTEGRATION=1 \
  TEST_MONGODB_URI=mongodb://127.0.0.1:27017/jevah_like_test \
  TEST_REDIS_URL=redis://127.0.0.1:6379 \
  JWT_SECRET=integration-test-secret \
  npm run test:integration
```

When `RUN_INTEGRATION=1`, missing/unreachable Mongo or Redis **fails** the suite (no silent skip).

## Rollback note (like indexes)

If you must restore the legacy unique index:

```js
db.likes.createIndex({ contentId: 1, userId: 1 }, { unique: true })
```

Only after dropping `unique_user_content_like` if it conflicts.
