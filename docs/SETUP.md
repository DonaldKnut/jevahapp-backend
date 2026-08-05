# Production Setup

## Required services

| Service | Env var | Purpose |
|---------|---------|---------|
| MongoDB Atlas | `MONGODB_URI` | Primary database |
| Redis | `REDIS_URL` | Fast-path likes/views, sessions (`connect-redis@8` + ioredis), BullMQ |
| API process | — | `npm run start` or `npm run dev` |
| Worker process | — | `npm run worker:start` (required for analytics/Kafka) |
| FFmpeg + ffprobe | PATH | Video/audio pre-upload verification + workers |

### Local Windows: FFmpeg

Video uploads call `ffmpeg` during pre-upload moderation. If missing, the API returns **503** `FFMPEG_REQUIRED`.

```powershell
winget install --id Gyan.FFmpeg -e --accept-package-agreements --accept-source-agreements
# Restart the terminal (and API process) so PATH updates
ffmpeg -version
ffprobe -version
```

Docker / Contabo images already install `ffmpeg` via the Dockerfile.

## Environment variables

```bash
# Core
MONGODB_URI=mongodb+srv://...
JWT_SECRET=...
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://your-frontend.com

# Master admin (dashboard owner) — seed with:
#   SUPER_ADMIN_PASSWORD='strong-password-here' npm run seed:super-admin
SUPER_ADMIN_EMAIL=support@jevahapp.com
# SUPER_ADMIN_PASSWORD is only needed at seed time (never commit it)

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

# Gemini moderation / transcription (gemini-1.5 is shut down)
# One API key from https://aistudio.google.com/ — model IDs are not separate tokens
GOOGLE_AI_API_KEY=...
GEMINI_DEFAULT_MODEL=gemini-2.5-flash
GEMINI_MODERATION_MODEL=gemini-2.5-flash
GEMINI_MODERATION_ESCALATION_MODEL=gemini-2.5-flash
GEMINI_TRANSCRIPTION_MODEL=gemini-2.5-flash
# Free tier is OK for local/dev only — enable paid Tier 1 + budgets before public onboarding
GEMINI_DAILY_REQUEST_BUDGET=500
GEMINI_DAILY_INPUT_TOKEN_BUDGET=2000000
GEMINI_DAILY_OUTPUT_TOKEN_BUDGET=200000
GEMINI_REQUEST_TIMEOUT_MS=60000
GEMINI_MAX_RETRIES=2
GEMINI_MAX_CONCURRENT=3
MODERATION_DAILY_UPLOADS_PER_USER=30
MODERATION_MAX_VIDEO_FRAMES=10
VERIFICATION_MAX_AUDIO_SEGMENTS=5

# Content Guardian (primary gospel scoring; Gemini is gray-zone only)
# See docs/CONTENT_GUARDIAN.md — docker compose service content-guardian
CONTENT_GUARDIAN_URL=http://127.0.0.1:8091
MODERATION_FUSION_MODE=guardian_first
# Worker must also receive CONTENT_GUARDIAN_URL (+ GOOGLE_AI_API_KEY for gray-zone)

# Object storage (Cloudflare R2)
# Never use r2.dev in production. Set an R2 custom domain backed by Cloudflare CDN.
# Add a Cloudflare WAF rule blocking public requests to /staging/*; API/worker
# access uses the S3 endpoint and signed URLs, not the public custom domain.
# Worker must also receive GOOGLE_AI_API_KEY + R2_* for staged moderation

# Expo push (API + worker — closed-app delivery + receipt polling)
EXPO_ACCESS_TOKEN=...
# Optional worker poll interval (ms):
# EXPO_RECEIPT_POLL_MS=60000
```

See [PUSH_NOTIFICATIONS.md](./PUSH_NOTIFICATIONS.md) for the mobile registration contract.

### Cloudflare video delivery

- Configure `R2_CUSTOM_DOMAIN` (for example `media.example.com`) and disable the
  bucket's `r2.dev` public URL in production.
- WAF: block `http.request.uri.path starts_with "/staging/"`.
- R2 CORS: allow your app/web origins, methods `GET`/`HEAD`, request header
  `Range`, and expose `Content-Length`, `Content-Range`, `Accept-Ranges`,
  `Content-Type`, and `ETag`.
- Keep immutable cache rules for `/media-hls/*`, `/media-videos/*`, and
  `/media-thumbnails/*`. Do not cache `/staging/*`.
- Clients should prefer `hlsUrl` (adaptive 360p/720p/1080p, capped at source
  resolution) and fall back to `playbackUrl` MP4. Do not construct object URLs.

This provides a production baseline similar to short-video feeds: direct staged
uploads, moderation before publication, CDN delivery, adaptive HLS, MP4
fallback, poster images, and byte-range support. TikTok/Instagram additionally
operate proprietary multi-codec encoding, per-device/network rendition
selection, global multi-CDN routing, predictive prefetch, and much larger
observability systems; R2 alone does not provide those layers.

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
