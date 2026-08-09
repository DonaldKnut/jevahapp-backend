# Jevah API Documentation

Last updated: July 2026 (post-modularization refactor)

## Index

1. **[CREATED_SO_FAR.md](./CREATED_SO_FAR.md)** — Inventory of everything built toward launch
2. **[API.md](./API.md)** — All REST endpoints by domain
3. **[ENGAGEMENT.md](./ENGAGEMENT.md)** — Feed media vs copyright-free; request/response contracts
4. **[FRONTEND_ENGAGEMENT.md](./FRONTEND_ENGAGEMENT.md)** — How to consume engagement in the UI (likes, views, shares, comments)
5. **[FRONTEND_BOOKMARK_HANDOFF.md](./FRONTEND_BOOKMARK_HANDOFF.md)** — Save/bookmark toggle contract + 404 fix
6. **[FRONTEND_TIKTOK_FEED_HANDOFF.md](./FRONTEND_TIKTOK_FEED_HANDOFF.md)** — TikTok feed cards, events, For You MVP (FE corroboration)
7. **[FRONTEND_LIKES.md](./FRONTEND_LIKES.md)** — Instagram / TikTok-style like & unlike (optimistic UI, double-tap, sockets)
8. **[FRONTEND_COMMENTS.md](./FRONTEND_COMMENTS.md)** — Comment sheet: badge vs list, mapping, FE mistakes
9. **[FRONTEND_COMMENT_EDIT_HANDOFF.md](./FRONTEND_COMMENT_EDIT_HANDOFF.md)** — Edit / delete / Edited badge / image replace
10. **[FRONTEND_FEED_ENGAGEMENT_HANDOFF.md](./FRONTEND_FEED_ENGAGEMENT_HANDOFF.md)** — Feed card engagement icons (same paint as media)
11. **[FRONTEND_VIEW_HANDOFF.md](./FRONTEND_VIEW_HANDOFF.md)** — Media views (thresholds, `counted`, sockets)
12. **[ADMIN.md](./ADMIN.md)** — Admin dashboard API (reports, moderation, verification, bans)
11. **[FRONTEND_ADMIN.md](./FRONTEND_ADMIN.md)** — Admin UI screen recipes and action maps
11b. **[FRONTEND_ADMIN_HANDOFF_STATUS.md](./FRONTEND_ADMIN_HANDOFF_STATUS.md)** — Done/partial/missing vs web FE handoff
11b2. **[FRONTEND_NEXT_ADMIN_HANDOFF.md](./FRONTEND_NEXT_ADMIN_HANDOFF.md)** — Next.js admin/marketing: point at shared API + path/shape corrections
11c. **[FRONTEND_AUDIO_TRACKS.md](./FRONTEND_AUDIO_TRACKS.md)** — Curated Track upload + Artists foundation
11c2. **[FRONTEND_CF_MUSIC_PLAYER_HANDOFF.md](./FRONTEND_CF_MUSIC_PLAYER_HANDOFF.md)** — Spotify/YTM-style CF player: share/views/library/playlist/artist upload
11d. **[FRONTEND_CREATORS.md](./FRONTEND_CREATORS.md)** — Mobile + web creator UI, apply/studio, gospel catalog shelves
11d0. **[FRONTEND_CREATOR_APPLY_HANDOFF.md](./FRONTEND_CREATOR_APPLY_HANDOFF.md)** — Spotify-for-Artists apply UI + Zod + `POST /creators/apply`
11d0b. **[FRONTEND_ARTIST_EMAIL_VERIFICATION_HANDOFF.md](./FRONTEND_ARTIST_EMAIL_VERIFICATION_HANDOFF.md)** — Artists verify email; welcome after verify; admin mail always reaches
11d0c. **[FRONTEND_CREATOR_ANALYTICS_HANDOFF.md](./FRONTEND_CREATOR_ANALYTICS_HANDOFF.md)** — Studio analytics `GET /creators/me/analytics`
11d2. **[FRONTEND_ARTIST_RELEASES_HANDOFF.md](./FRONTEND_ARTIST_RELEASES_HANDOFF.md)** — Albums/EPs/mixtapes/singles (Release + Track on R2)
11e. **[BACKEND_CREATORS_GOSPEL_MOBILE_HANDOFF.md](./BACKEND_CREATORS_GOSPEL_MOBILE_HANDOFF.md)** — Mobile FE contract corroboration
11f. **[R2_CORS.md](./R2_CORS.md)** — Bucket CORS for presigned Track uploads
11g. **[FRONTEND_SERMONS.md](./FRONTEND_SERMONS.md)** — Public `/api/sermons` for web marketing catalog
11h. **[BACKEND_VIDEO_DURATION_HANDOFF.md](./BACKEND_VIDEO_DURATION_HANDOFF.md)** — Video `duration` + seekable MP4/HLS for mobile scrubber
11i. **[FRONTEND_VIDEO_DURATION_HANDOFF.md](./FRONTEND_VIDEO_DURATION_HANDOFF.md)** — Mobile scrubber: poll ready, prefer MP4, gate seek on `duration`
11i2. **[FRONTEND_AUDIO_SEEK_VIEWS_HANDOFF.md](./FRONTEND_AUDIO_SEEK_VIEWS_HANDOFF.md)** — Feed/CF audio seek duration + dual view stacks (`counted`)
11j. **[FRONTEND_UPLOAD_PROGRESS_HANDOFF.md](./FRONTEND_UPLOAD_PROGRESS_HANDOFF.md)** — Upload detect/verify + `X-Upload-ID` progress + password reset for admin/creators
11k. **[FRONTEND_MARKETING_EMAIL_HANDOFF.md](./FRONTEND_MARKETING_EMAIL_HANDOFF.md)** — Admin marketing blasts, opt-out, public unsubscribe
12. **[FRONTEND_MODERATION.md](./FRONTEND_MODERATION.md)** — Moderation + reports handoff for the web admin team (card shapes, P1 wiring)
12b. **[CONTENT_GUARDIAN.md](./CONTENT_GUARDIAN.md)** — Python Content Guardian (Whisper/NudeNet/CLIP) + Node fusion; Gemini gray-zone only
12b2. **[CONTENT_VERIFICATION_ADVANCED.md](./CONTENT_VERIFICATION_ADVANCED.md)** — Fail-soft harden + ebook full-sample + creator audio STT
12c. **[ENGAGEMENT_TIKTOK_STANDARD.md](./ENGAGEMENT_TIKTOK_STANDARD.md)** — Lifetime vs live counts, CF view/like rate limits, FE fire-and-forget rules
12d. **[FRONTEND_CF_MUSIC_PLAYER_HANDOFF.md](./FRONTEND_CF_MUSIC_PLAYER_HANDOFF.md)** — CF player: views (`counted`), likes, share, library, sockets
12e. **[FRONTEND_WEB_LOGIN_API_BASE_HANDOFF.md](./FRONTEND_WEB_LOGIN_API_BASE_HANDOFF.md)** — Fix www login 404: API base must include `/api`
12f. **[FEED_RANKER.md](./FEED_RANKER.md)** — Algorithmic For You + music For You (Contabo-safe, no Torch)
12g. **[FRONTEND_FOR_YOU_HANDOFF.md](./FRONTEND_FOR_YOU_HANDOFF.md)** — FE: for-you + Artists music algorithm, events queue, premium UI
12h. **[FRONTEND_AUTH_SESSION_HANDOFF.md](./FRONTEND_AUTH_SESSION_HANDOFF.md)** — Backend JWT is the only session; Clerk is OAuth shell only
13. **[SUPER_ADMIN.md](./SUPER_ADMIN.md)** — Master admin seed (`support@jevahapp.com`) + API protections
14. **[SETUP.md](./SETUP.md)** — Production checklist, env vars, workers
15. **[PERFORMANCE.md](./PERFORMANCE.md)** — Shareholder performance brief (API latency, CPU/RAM, upload & verification)
15b. **[JEVAH_OPTIMIZATION_PERFORMANCE_COMBINED.md](./JEVAH_OPTIMIZATION_PERFORMANCE_COMBINED.md)** — **Canonical** combined audit + baselines + before/after + video + lifecycle
15c. **[STAKEHOLDER_PROGRESS_REPORT.md](./STAKEHOLDER_PROGRESS_REPORT.md)** — Executive narrative (subset)
15d. **[OPTIMIZATION_LIFECYCLE.md](./OPTIMIZATION_LIFECYCLE.md)** — Pointer to combined report
15e. **[PHASE1_TECHNICAL_AUDIT_REPORT.md](./PHASE1_TECHNICAL_AUDIT_REPORT.md)** — Phase 1 draft (superseded by combined)
15f. **[PHASE2_PERFORMANCE_BASELINE_REPORT.md](./PHASE2_PERFORMANCE_BASELINE_REPORT.md)** — Phase 2 draft (superseded by combined)
15g. **[PROGRESS_PERFORMANCE_NEXT_BUILD.md](./PROGRESS_PERFORMANCE_NEXT_BUILD.md)** — Engineering next-build detail
16. **[PUSH_NOTIFICATIONS.md](./PUSH_NOTIFICATIONS.md)** — Expo mobile push contract
17. **[REDIS_OPS.md](./REDIS_OPS.md)** — Contabo Redis binding, like hot path, Socket.IO adapter, metrics
18. **[WEBSOCKETS.md](./WEBSOCKETS.md)** — Real-time events
19. **[DEPRECATED.md](./DEPRECATED.md)** — Routes to stop using

## Authentication

Most protected routes require:

```http
Authorization: Bearer <access_token>
```

Obtain tokens via `POST /api/auth/login`, `POST /api/auth/clerk-login`, or `POST /api/auth/oauth-login`.

**Session rule:** backend JWT is the only app session. Clerk is an OAuth shell only — see [FRONTEND_AUTH_SESSION_HANDOFF.md](./FRONTEND_AUTH_SESSION_HANDOFF.md).

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
