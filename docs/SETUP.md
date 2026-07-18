# Production Setup

## Required services

| Service | Env var | Purpose |
|---------|---------|---------|
| MongoDB Atlas | `MONGODB_URI` | Primary database |
| Redis | `REDIS_URL` | Fast-path likes/views, sessions, BullMQ |
| API process | — | `npm run start` or `npm run dev` |
| Worker process | — | `npm run worker:start` (required for analytics/Kafka) |

## Environment variables

```bash
# Core
MONGODB_URI=mongodb+srv://...
JWT_SECRET=...
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://your-frontend.com

# Redis (authoritative for likes / rate limits / idempotency — Contabo ioredis)
REDIS_URL=redis://127.0.0.1:6379

# PM2 cluster / multi-instance only:
# SOCKET_REDIS_ADAPTER=true

# Optional: Kafka event bus (BullMQ still runs without it)
KAFKA_BROKERS=localhost:9092
KAFKA_ENGAGEMENT_TOPIC=jevah.engagement.events
KAFKA_CONSUMER_GROUP=jevah-engagement-workers

# Pool tuning under load
MONGODB_POOL_SIZE=30
```

## Startup checklist

```bash
npm install
npm run build
npm run indexes:create
npm run migrate:likes:dry    # review first
npm run migrate:likes        # if legacy Interaction likes exist
npm run migrate:like-indexes:dry   # Atlas Like unique index migration
npm run migrate:like-indexes
npm run cleanup:notification-dedupe:dry
npm run cleanup:notification-dedupe
npm run start                # API
npm run worker:start         # separate process
```

See [REDIS_OPS.md](./REDIS_OPS.md) for Contabo Redis binding, Socket.IO adapter, engagement metrics, and integration-test commands.

## Docker (Kafka optional)

```bash
docker compose up -d kafka   # if using KAFKA_BROKERS
```

## Health checks

```bash
GET /api/health
node scripts/test-mongo-connect.js
node scripts/test-redis-connection.js
```

## Smoke test

```bash
AUTH_TOKEN=<jwt> BASE_URL=https://api.yourapp.com npm run smoke:engagement
```

Optional: `MEDIA_ID=...`, `COPYRIGHT_FREE_SONG_ID=...`

## Seeds

```bash
npm run seed:copyright-free
npm run seed:forums
```

## Horizontal scaling notes

- Run **one worker fleet** (or scale workers with same `KAFKA_CONSUMER_GROUP`)
- Like route uses **Redis-backed per-user rate limiting** + `Idempotency-Key` (works across PM2 workers)
- Raise `MONGODB_POOL_SIZE` when running multiple API instances
- Socket.IO: set `SOCKET_REDIS_ADAPTER=true` for PM2 cluster / multi-node

## Monitoring

- BullMQ queue depth (analytics jobs)
- Kafka consumer lag (if enabled)
- MongoDB connection pool utilization
- Redis connectivity (fail-open without Redis; Mongo remains source of truth)
- Engagement counters on `GET /api/metrics` (`idempotencyHits`, `rateLimitRejections`, …)
