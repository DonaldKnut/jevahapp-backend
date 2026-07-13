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

# Redis (required for production engagement performance)
REDIS_URL=redis://...

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
npm run start                # API
npm run worker:start         # separate process
```

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
- Use **Redis-backed rate limiting** before scaling API to multiple pods (in-memory limits are per-instance)
- Raise `MONGODB_POOL_SIZE` when running multiple API instances
- Socket.IO: use Redis adapter for multi-node (not configured by default)

## Monitoring

- BullMQ queue depth (analytics jobs)
- Kafka consumer lag (if enabled)
- MongoDB connection pool utilization
- Redis connectivity (fail-open without Redis, but likes slow down)
