# Redis Ops (Engagement)

## Authoritative store

| Store | Env | Used for |
|-------|-----|----------|
| **Contabo / local ioredis** | `REDIS_URL` | Like counters, user like state, like rate limits, Idempotency-Key, Socket.IO adapter (optional), sessions/queues |
| Upstash REST (optional) | `UPSTASH_REDIS_REST_*` | Non-critical caches only — **not** the like hot path |

Do **not** split like counters across two Redis instances.

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
  }
}
```

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
