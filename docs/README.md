# Jevah API Documentation

Last updated: July 2026 (post-modularization refactor)

## Index

1. **[CREATED_SO_FAR.md](./CREATED_SO_FAR.md)** — Inventory of everything built toward launch
2. **[API.md](./API.md)** — All REST endpoints by domain
3. **[ENGAGEMENT.md](./ENGAGEMENT.md)** — Feed media vs copyright-free; request/response contracts
4. **[FRONTEND_ENGAGEMENT.md](./FRONTEND_ENGAGEMENT.md)** — How to consume engagement in the UI (likes, views, shares, comments)
5. **[ADMIN.md](./ADMIN.md)** — Admin dashboard API (reports, moderation, verification, bans)
6. **[FRONTEND_ADMIN.md](./FRONTEND_ADMIN.md)** — Admin UI screen recipes and action maps
7. **[FRONTEND_MODERATION.md](./FRONTEND_MODERATION.md)** — Moderation + reports handoff for the web admin team (card shapes, P1 wiring)
8. **[SUPER_ADMIN.md](./SUPER_ADMIN.md)** — Master admin seed (`support@jevahapp.com`) + API protections
9. **[SETUP.md](./SETUP.md)** — Production checklist, env vars, workers
10. **[PERFORMANCE.md](./PERFORMANCE.md)** — Shareholder performance brief (API latency, CPU/RAM, upload & verification)
11. **[PUSH_NOTIFICATIONS.md](./PUSH_NOTIFICATIONS.md)** — Expo mobile push contract
12. **[REDIS_OPS.md](./REDIS_OPS.md)** — Contabo Redis binding, like hot path, Socket.IO adapter, metrics
13. **[WEBSOCKETS.md](./WEBSOCKETS.md)** — Real-time events
14. **[DEPRECATED.md](./DEPRECATED.md)** — Routes to stop using

## Authentication

Most protected routes require:

```http
Authorization: Bearer <access_token>
```

Obtain tokens via `POST /api/auth/login`, `POST /api/auth/clerk-login`, or `POST /api/auth/oauth-login`.

Optional auth (`verifyTokenOptional`) is used on some read endpoints (metadata, public feed) — pass a token when available for personalized `isLiked` / `hasViewed` fields.

## Response convention

```json
{
  "success": true,
  "data": { }
}
```

Errors:

```json
{
  "success": false,
  "message": "Human-readable error",
  "code": "BAD_REQUEST"
}
```

## Module map

| Prefix | Module | Source |
|--------|--------|--------|
| `/api/auth` | Auth | `src/modules/auth` |
| `/api/users` | Users | `src/modules/users` |
| `/api/media` | Media | `src/modules/media` |
| `/api/content` | Engagement | `src/modules/engagement` |
| `/api/bookmark` | Saves | `src/modules/engagement` |
| `/api/audio` | Copyright-free + playback | `src/modules/audio` |
| `/api/playlists` | Playlists | `src/modules/playlists` |
| `/api/devotionals` | Devotionals | `src/modules/devotionals` |
| `/api/community` | Forum, prayer | `src/modules/community` |
| `/api/bible` | Bible | `src/modules/bible` |
| `/api/games` | Games | `src/modules/games` |
| `/api/health` | Health | `src/modules/health` |
