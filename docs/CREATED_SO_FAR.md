# Created so far

Inventory of work shipped on this branch toward production launch (July 2026). Use this as a high-level map; detailed contracts live in the linked docs.

---

## Documentation

| Doc | What it covers |
|-----|----------------|
| [ADMIN.md](./ADMIN.md) | Admin dashboard API — reports, moderation, verification, bans |
| [FRONTEND_ADMIN.md](./FRONTEND_ADMIN.md) | Admin UI screens, login gate, KPI → deep links |
| [FRONTEND_MODERATION.md](./FRONTEND_MODERATION.md) | Moderation queue + reports handoff (card shapes, preview URLs, P1 wiring) |
| [SUPER_ADMIN.md](./SUPER_ADMIN.md) | Master admin seed + role/ban protections |
| [ENGAGEMENT.md](./ENGAGEMENT.md) | Feed vs copyright-free engagement contracts |
| [FRONTEND_ENGAGEMENT.md](./FRONTEND_ENGAGEMENT.md) | Optimistic likes/views/shares/comments for mobile/web |
| [FRONTEND_LIKES.md](./FRONTEND_LIKES.md) | IG / TikTok-style like & unlike (heart, double-tap, sockets) |
| [FRONTEND_COMMENTS.md](./FRONTEND_COMMENTS.md) | Comment sheet — badge vs list corroboration + FE mistakes |
| [FRONTEND_COMMENT_EDIT_HANDOFF.md](./FRONTEND_COMMENT_EDIT_HANDOFF.md) | Edit / delete / Edited badge / image replace / mentions on edit |
| [FRONTEND_FEED_ENGAGEMENT_HANDOFF.md](./FRONTEND_FEED_ENGAGEMENT_HANDOFF.md) | Feed card icons — same-paint as video (no batch gate) |
| [FRONTEND_VIEW_HANDOFF.md](./FRONTEND_VIEW_HANDOFF.md) | Views — BE sign-off + FE threshold align |
| [API.md](./API.md) | Full REST reference (incl. staged upload + admin) |
| [SETUP.md](./SETUP.md) | Env vars, Redis, workers, R2, Gemini, Expo |
| [PERFORMANCE.md](./PERFORMANCE.md) | Shareholder performance brief — latency, CPU/RAM, upload & verification |
| [PROGRESS_PERFORMANCE_NEXT_BUILD.md](./PROGRESS_PERFORMANCE_NEXT_BUILD.md) | Achievements, hardenings, before/after performance, next-build plan |
| [REDIS_OPS.md](./REDIS_OPS.md) | Contabo Redis binding, like hot path, Socket.IO adapter |
| [PUSH_NOTIFICATIONS.md](./PUSH_NOTIFICATIONS.md) | Expo device register / unregister / deep-link payload |
| [CONTABO_SMOKE.md](./CONTABO_SMOKE.md) | Post-deploy smoke checklist on Contabo |
| [SOCKET_TYPING.md](./SOCKET_TYPING.md) | Typing indicators (ephemeral) |
| [FOR_YOU_DEFERRED.md](./FOR_YOU_DEFERRED.md) | Explicit deferral of server For You ranking |
| [WEBSOCKETS.md](./WEBSOCKETS.md) | Realtime rooms/events |
| [DEPRECATED.md](./DEPRECATED.md) | Legacy routes to avoid |

---

## Infrastructure & ops

| Item | Status |
|------|--------|
| Docker: FFmpeg in image | Done — workers need `ffmpeg`/`ffprobe` |
| `docker-compose`: Redis + BullMQ `worker` service | Done |
| `REDIS_URL` wired for API/worker | Done |
| `ecosystem.config.cjs` (PM2: `jevah-api` + `jevah-worker`) | Done |
| Contabo Redis ops notes | Done ([REDIS_OPS.md](./REDIS_OPS.md)) |
| Production env checks / index scripts | Updated |

---

## Admin dashboard

| Feature | Notes |
|---------|--------|
| Analytics KPIs | Users, content, moderation, reports, verification |
| Activity feed | Uploads, review, reports, admin actions + `onlineCount` |
| Users list + presence | Online = active Socket.IO JWT connection |
| Ban / unban / role | Admin-only |
| Verification flags | Creator / vendor / church / artist |
| Email users (Resend) | By `userIds` and/or `emails` |
| Unified reports inbox | Media + comment reports (shaped detail + actions) |
| Moderation queue | Approve / reject / under_review + preview URLs |
| Moderation detail / AI case | `GET …/moderation/:id` + `…/case` |
| Admin media metadata edit | `PATCH /api/admin/media/:id` |
| Force-delete media | Admin path |
| Church catalog CRUD | Add/edit/delete + `isListed` for onboarding |
| Email churches | `POST /api/admin/email` `{ churchIds }` |
| Onboarding church pick | `places/suggest` + `churchId` on complete-profile |

See [ADMIN.md](./ADMIN.md) · [FRONTEND_ADMIN.md](./FRONTEND_ADMIN.md) · [FRONTEND_MODERATION.md](./FRONTEND_MODERATION.md).

---

## Engagement (feed + copyright-free)

| Feature | Notes |
|---------|--------|
| Durable likes (media) | Mongo commit before 200; Redis is post-commit cache |
| Idempotency-Key on like | UUID; Redis-backed replay; fail-closed if Redis down |
| Like rate limits | Per user / content (Contabo Redis) |
| Content-type aliases | `video`, `audio`, `sermon`, etc. → `media` |
| Saves / bookmarks | Canonical `/api/content` + library list |
| Views | Thresholds + hourly dedupe (feed); lifetime (copyright-free) |
| Shares | Record-on-action + rate limiter |
| Comments | Create/read, hide/report, realtime rooms |
| Feed user flags | `hasLiked` / `hasBookmarked` after cache read |
| Batch / single metadata | For hydrating UI counts |
| Socket like/view/comment updates | HTTP remains write path |

Deferred: server **For You** ranking ([FOR_YOU_DEFERRED.md](./FOR_YOU_DEFERRED.md)).

---

## Media upload & processing pipeline

| Feature | Notes |
|---------|--------|
| Staged upload intent | `POST /upload/intent` → private staging + presigned PUT |
| Finalize | Verify object + enqueue processing (`202`) |
| Abort / status poll | `DELETE` / `GET …/status` |
| SHA-256 checksum binding | Intent + S3 PUT + worker verify |
| Private until ready | `isHidden` / not `approved` until moderation + processing |
| Decision reuse by content hash | Reuses prior moderation **decision**, not another user’s object |
| Legacy multipart `/upload` | Still available during migration |

### Workers

| Worker | Role |
|--------|------|
| `mediaModerate.ts` | AI / policy moderation on staged media |
| `mediaTranscode.ts` | FFmpeg transcode / HLS variants |
| `mediaPipeline.ts` | Orchestrates processing stages |
| `publishStagedOriginal.ts` | Promote staged object → live keys |
| `workers/index.ts` | BullMQ bootstrap (media + analytics + notifications) |

### Moderation services

| Module | Role |
|--------|------|
| `contentModeration.service.ts` | Orchestration |
| `service/moderation/geminiClient.ts` | Gemini calls |
| `service/moderation/geminiConfig.ts` | Model / timeout config |
| `service/moderation/aiBudget.service.ts` | Daily request/token budgets |
| `service/moderation/evidenceProfile.ts` | Evidence for review |
| `service/moderation/contentHashDedup.ts` | Hash-based decision reuse |
| `service/moderation/persistDecision.ts` | Persist outcomes |
| `models/moderationCase.model.ts` | Case records |
| Blocklist + multilingual tests | Nigerian gospel–oriented hardening |

### Delivery

| Module | Role |
|--------|------|
| `service/media/delivery/*` | Live key layout, publish helpers |
| `publicMediaVisibility.ts` | What is safe to show publicly |
| Cloudflare R2 + HLS guidance | In [SETUP.md](./SETUP.md) |

---

## Notifications & push

| Feature | Notes |
|---------|--------|
| Expo push register/unregister | Mobile contract documented |
| Device / delivery / outbox models | `modules/notifications/models/*` |
| Event catalog | Domain event → push mapping |
| Ticket + receipt processors | Worker-side Expo delivery + polling |
| In-app notifications | Reports, moderation, content actions |
| Admin report email | Resend (+ SMTP fallback in email path) |

See [PUSH_NOTIFICATIONS.md](./PUSH_NOTIFICATIONS.md).

---

## Auth, cache, Redis

| Feature | Notes |
|---------|--------|
| Auth user cache invalidation | On profile / role / ban changes |
| Feed cache invalidation | On like/unlike and related mutations |
| Cache keys helper | `lib/cacheKeys.ts` |
| Redis counters | Engagement hot path |
| Session config updates | Redis-aware sessions |
| Metrics routes | Ops visibility |

---

## Realtime (Socket.IO)

| Feature | Notes |
|---------|--------|
| Content rooms | `join-content` for likes/comments |
| Like / view / count events | Documented in engagement + websockets docs |
| Typing indicators | Ephemeral TTL (~3s) — [SOCKET_TYPING.md](./SOCKET_TYPING.md) |
| Presence for admin | Online users via connected JWT sockets |

---

## Rate limiting & hardening

| Middleware / control | Protects |
|----------------------|----------|
| Like rate limiter | Like toggles |
| Bookmark rate limiter | Saves |
| Comment rate limiter | Comment writes |
| Share rate limiter | Share records |
| Idempotency middleware | Safe retries |
| Moderation upload budgets | Per-user daily uploads |

---

## New / thin modules

| Path | Purpose |
|------|---------|
| `src/modules/feed/` | Feed façade (For You deferred) |
| `src/modules/media-delivery/` | Delivery module entry |
| `src/modules/notifications/` | Push domain + infra |
| `src/controllers/media/staged/` | Staged upload HTTP |
| `src/service/media/upload/` | Staged upload service |
| `src/service/media/query/` | Split query helpers |
| `src/service/media/download/` | Download helpers |
| `src/service/notification/` | Notification application helpers |

---

## Tests added / extended (sampling)

- Engagement: like durable, comments, share, view dedupe, metadata batch
- Moderation: evidence/hash, multilingual, blocklist
- Cache service, bookmark, media delivery keys
- Notifications: event catalog, Expo ticket processor
- Workers / socket handler tests under `__tests__`

---

## Still deferred / not shipped

| Item | Note |
|------|------|
| `GET /api/feed/for-you` | Explicitly deferred |
| Desired-state `PUT`/`DELETE` like API | Deferred |
| Full artist/merch engagement rewrite | Deferred |
| Report websocket push | Dashboard polls reports |

---

## How to navigate

1. **Ops / deploy** → [SETUP.md](./SETUP.md) → [CONTABO_SMOKE.md](./CONTABO_SMOKE.md) → [REDIS_OPS.md](./REDIS_OPS.md) → [PERFORMANCE.md](./PERFORMANCE.md)
2. **Mobile engagement** → [FRONTEND_ENGAGEMENT.md](./FRONTEND_ENGAGEMENT.md) · **Likes (IG/TikTok)** → [FRONTEND_LIKES.md](./FRONTEND_LIKES.md) · **Comments** → [FRONTEND_COMMENTS.md](./FRONTEND_COMMENTS.md) · **Edit/delete** → [FRONTEND_COMMENT_EDIT_HANDOFF.md](./FRONTEND_COMMENT_EDIT_HANDOFF.md) · **Feed icons** → [FRONTEND_FEED_ENGAGEMENT_HANDOFF.md](./FRONTEND_FEED_ENGAGEMENT_HANDOFF.md) · **Views** → [FRONTEND_VIEW_HANDOFF.md](./FRONTEND_VIEW_HANDOFF.md)
3. **Admin web** → [FRONTEND_ADMIN.md](./FRONTEND_ADMIN.md) → [FRONTEND_MODERATION.md](./FRONTEND_MODERATION.md)
4. **Upload pipeline** → [API.md](./API.md) (upload intent / finalize / status) + workers above
5. **Push** → [PUSH_NOTIFICATIONS.md](./PUSH_NOTIFICATIONS.md)
