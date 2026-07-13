# Jevah API Documentation

Last updated: July 2026 (post-modularization refactor)

## Index

1. **[API.md](./API.md)** — All REST endpoints by domain
2. **[ENGAGEMENT.md](./ENGAGEMENT.md)** — Feed media vs copyright-free; request/response contracts
3. **[SETUP.md](./SETUP.md)** — Production checklist, env vars, workers
4. **[WEBSOCKETS.md](./WEBSOCKETS.md)** — Real-time events
5. **[DEPRECATED.md](./DEPRECATED.md)** — Routes to stop using

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
