# Jevah Backend

Gospel media platform API — feed, copyright-free audio, live streaming, community, Bible, games, and engagement.

**Version:** 2.0.0  
**Base URL:** `https://<your-api-host>/api` (local: `http://localhost:4000/api`)

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/README.md](docs/README.md) | Documentation index |
| [docs/CREATED_SO_FAR.md](docs/CREATED_SO_FAR.md) | Inventory of everything built toward launch |
| [docs/API.md](docs/API.md) | Full endpoint reference |
| [docs/ENGAGEMENT.md](docs/ENGAGEMENT.md) | Likes, views, shares, saves, comments (feed + copyright-free) |
| [docs/FRONTEND_ENGAGEMENT.md](docs/FRONTEND_ENGAGEMENT.md) | Frontend UI integration — optimistic updates, player wiring, screen recipes |
| [docs/ADMIN.md](docs/ADMIN.md) | Admin dashboard API — reports, moderation, verification, bans |
| [docs/FRONTEND_ADMIN.md](docs/FRONTEND_ADMIN.md) | Admin UI — screen recipes, reports inbox, action maps |
| [docs/FRONTEND_MODERATION.md](docs/FRONTEND_MODERATION.md) | Moderation + reports handoff for web admin (preview cards, P1 actions) |
| [docs/SUPER_ADMIN.md](docs/SUPER_ADMIN.md) | Master admin seed + protections (`support@jevahapp.com`) |
| [docs/SETUP.md](docs/SETUP.md) | Environment, workers, Redis, Kafka, deployment |
| [docs/PERFORMANCE.md](docs/PERFORMANCE.md) | Shareholder performance brief — API latency, CPU/RAM, upload & verification |
| [docs/WEBSOCKETS.md](docs/WEBSOCKETS.md) | Socket.IO events and rooms |
| [docs/DEPRECATED.md](docs/DEPRECATED.md) | Legacy routes — do not use in new code |

## Quick start

```bash
npm install
cp .env.example .env   # configure MONGODB_URI, JWT_SECRET, REDIS_URL
npm run dev            # API server
npm run worker:dev     # BullMQ + optional Kafka consumer (separate terminal)
```

## Smoke test

```bash
AUTH_TOKEN=<jwt> BASE_URL=http://localhost:4000 npm run smoke:engagement
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run build` | TypeScript compile |
| `npm run test:engagement` | Engagement unit tests |
| `npm run migrate:likes:dry` | Preview like migration |
| `npm run indexes:create` | MongoDB performance indexes |
| `npm run smoke:engagement` | E2E engagement smoke test |

## Architecture

Routes are registered via `src/modules/index.ts`. Engagement lives in `src/modules/engagement/`. Interactive docs available at `/api-docs` when the server is running.
