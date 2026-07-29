# Engagement API — Frontend Contract

Canonical engagement for **feed media** uses `/api/content/*`.  
**Copyright-free music** uses `/api/audio/copyright-free/*` (separate stack).

**Frontend integration (UI patterns, optimistic updates, player wiring):** [FRONTEND_ENGAGEMENT.md](./FRONTEND_ENGAGEMENT.md)  
**Likes specifically (IG / TikTok heart, double-tap, idempotency):** [FRONTEND_LIKES.md](./FRONTEND_LIKES.md)

---

## Feed media (video, audio, ebooks in main feed)

### Content types

Canonical like types: `media`, `artist`, `merch`, `ebook`, `podcast`, `devotional`.

Feed path aliases normalize to `media` for likes/metadata: `video`, `videos`, `audio`, `music`, `live`, `sermon`, `sermons`, `teachings` (plus transitional `ebook`/`podcast` → Media collection). Exact `devotional` stays on the Devotional collection (also available at `/api/devotionals/:id/like`).

### Endpoints

| Action | Method | Endpoint | Auth |
|--------|--------|----------|------|
| Like toggle | POST | `/api/content/:contentType/:contentId/like` | Required |
| Share | POST | `/api/content/:contentType/:contentId/share` | Required |
| View | POST | `/api/content/:contentType/:contentId/view` | Optional |
| Metadata | GET | `/api/content/:contentType/:contentId/metadata` | Optional |
| Batch metadata | POST | `/api/content/batch-metadata` | Optional |
| Save | POST | `/api/bookmark/:contentId/toggle` | Required |
| Add comment | POST | `/api/content/:contentType/:contentId/comment` | Required |
| List comments | GET | `/api/content/:contentType/:contentId/comments` | Optional (public read) |
| Upload comment image | POST | `/api/content/comments/upload-image` | Required (multipart `image`) |
| Delete comment | DELETE | `/api/content/comments/:commentId` | Required |
| Edit comment | PATCH | `/api/content/comments/:commentId` | Required |
| Report comment | POST | `/api/content/comments/:commentId/report` | Required |
| Comment like | POST | `/api/content/comments/:commentId/reaction` | Required |
| User search (mentions) | GET | `/api/users/search?q=&limit=` | Optional |

**Rich comments:** JSON body supports `mentions[]` + `imageUrl`; multipart supports `image` (JPEG/PNG/WebP ≤5MB) with optional empty `content`. `imageUrl` must be on the CDN allowlist (`R2_CUSTOM_DOMAIN` / `*.r2.dev` / `R2_ALLOWED_CDN_HOSTS`) — arbitrary https is rejected (`INVALID_IMAGE_URL`). List items return `imageUrl` (+ aliases), `mentions`, and `isEdited` / `editedAt`; list also persists healed CDN URLs. Public R2 URLs use `toPublicR2Url` (prefix: unset+custom domain → none; unset+r2.dev → `jevah`). Edit: `PATCH /api/content/comments/:id` with optional image replace/`clearImage`/`mentions` (new mentions notified); default 24h window (`COMMENT_EDIT_WINDOW_MS`). Delete soft-deletes and best-effort removes the R2 image. FE: [FRONTEND_COMMENT_EDIT_HANDOFF.md](./FRONTEND_COMMENT_EDIT_HANDOFF.md).

**Comments list contract:** `200` + `data.comments` + `data.total` (empty thread is not 404). `total` matches live comment docs; feed `commentCount` is healed on list. Path aliases: `video`/`audio`/`sermon`/… → media.

**Fallbacks (same handlers):** `GET/POST /api/content/:id/comment(s)`, `GET/POST /api/media/:id/comment(s)`, `GET /api/interactions/:type/:id/comments`, `POST /api/interactions/comments/:id/reaction` (legacy reaction alias).

**Mounting:** all comment routes registered via `bindContentComments` / `bindMediaCommentShims` / `bindInteractionsCommentAliases` in `modules/engagement/shared/routeAdapters.ts`. Public GET uses optional auth that fail-opens on expired tokens.

### View body (feed)

```json
{
  "durationMs": 5000,
  "progressPct": 30,
  "isComplete": false,
  "source": "feed",
  "sessionId": "optional-uuid",
  "deviceId": "optional"
}
```

**Thresholds:** video — 3s or 25% progress; audio — 10s or 20% progress; ebook — 10s or 10% progress. Dedupe window: 1 hour per user/device. FE align: [FRONTEND_VIEW_HANDOFF.md](./FRONTEND_VIEW_HANDOFF.md).

### View response

```json
{
  "success": true,
  "data": {
    "viewCount": 42,
    "hasViewed": true,
    "counted": true
  }
}
```

### Like response

Media likes are **durable-before-200**: the handler awaits the Mongo Like row + `Media.likeCount` commit, then refreshes Redis and emits sockets. Redis is a post-commit cache, not the write authority.

```json
{
  "success": true,
  "message": "Content liked",
  "data": {
    "contentId": "69abf4886aef561f683a1a32",
    "contentType": "media",
    "liked": true,
    "likeCount": 10,
    "updatedAt": "2026-07-18T06:40:00.000Z"
  }
}
```

- `liked` = post-mutation state for the JWT user (never inferred from `likeCount`)
- `likeCount` = global active likes (may stay `> 0` when `liked: false`)
- Missing Media → `404` `CONTENT_NOT_FOUND` (no mutation)
- Invalid type/id → `400` with `INVALID_CONTENT_TYPE` / `INVALID_CONTENT_ID`
- Optional header `Idempotency-Key` (**UUID required** when present): retries replay the stored response (no double-toggle). Malformed key → `400 INVALID_IDEMPOTENCY_KEY`. Same key + different request → `409 IDEMPOTENCY_CONFLICT`. Redis down with key present → **fail open** (process the like, log a warning; duplicate-tap protection is best-effort until Redis recovers). Replays do not consume the rate-limit window.
- Distributed rate limit (Contabo Redis): ~4 toggles / 10s / content / user, 60 / min / user → `429 LIKE_RATE_LIMITED` + `Retry-After` (no mutation)
- Authoritative Redis for counters / idempotency / rate limits: `REDIS_URL` (ioredis). See [REDIS_OPS.md](./REDIS_OPS.md)

**Deferred:** desired-state `PUT`/`DELETE` like API, full artist/merch rewrite.

### Save (bookmark) response

```json
{
  "success": true,
  "data": {
    "contentId": "…",
    "bookmarked": true,
    "isBookmarked": true,
    "bookmarkCount": 4,
    "saves": 4
  }
}
```

`bookmarked` / `isBookmarked` and `bookmarkCount` / `saves` are aliases (post-toggle state + count).

Body (optional): `{ "contentType": "media" }` — aliases like `videos`, `video`, `sermon`, `audio` map to Media. Copyright-free must use `/api/audio/copyright-free/:songId/save`.

Legacy fallback (same handler): `POST /api/media/interactions/:id/save`.

**Library list:** `GET /api/bookmark/user` → `data.bookmarks`.

---

### Feed list user flags

Authenticated `GET /api/media/all-content` overlays per-user liked/saved **in the same response** as the media list (after Redis feed cache read).  
`GET /api/media/public/all-content` does the same when a Bearer token is sent (`verifyTokenOptional`).

```json
{
  "hasLiked": true,
  "hasBookmarked": false,
  "userInteractions": { "liked": true, "saved": false },
  "likeCount": 128,
  "commentCount": 12,
  "viewCount": 940,
  "shareCount": 3
}
```

**FE:** paint the engagement icon row from these fields on first render. Do not wait for `POST /api/content/batch-metadata` to show likes/comments/views.

---

### Bookmark vs like — important

Media likes and bookmarks both verify Media existence before mutating. If one returns `404` and the other does not, re-fetch the feed — the ID may be stale in a cached list, not a different collection.

---

### For You feed (`GET /api/feed/for-you`)

Not shipped yet. Client-side ranking (`rankFeedForYou`) remains source of truth until watch_time ingestion + server ranking land.

---

```json
{
  "items": [
    { "contentType": "media", "contentId": "507f1f77bcf86cd799439011" }
  ]
}
```

---

## Copyright-free music

Do **not** use `/api/content/*` for copyright-free songs.

| Action | Method | Endpoint | Auth |
|--------|--------|----------|------|
| List songs | GET | `/api/audio/copyright-free` | Public |
| Get song | GET | `/api/audio/copyright-free/:songId` | Public |
| Stream redirect | GET | `/api/audio/copyright-free/:songId/stream` | Public |
| Search | GET | `/api/audio/copyright-free/search?q=` | Public |
| Categories | GET | `/api/audio/copyright-free/categories` | Public |
| Like | POST | `/api/audio/copyright-free/:songId/like` | Required |
| View | POST | `/api/audio/copyright-free/:songId/view` | Required |
| Share | POST | `/api/audio/copyright-free/:songId/share` | Required |
| Save | POST | `/api/audio/copyright-free/:songId/save` | Required |
| Download | POST | `/api/audio/copyright-free/:songId/download` | Required |
| Audio library | GET | `/api/audio/library` | Required |

### View body (copyright-free)

```json
{
  "durationMs": 4000,
  "progressPct": 30,
  "isComplete": false
}
```

**Threshold:** 3s or 25% progress or complete. **Dedupe:** one view per user per song (lifetime).

### View response

```json
{
  "success": true,
  "data": {
    "viewCount": 42,
    "hasViewed": true
  }
}
```

### Save response

```json
{
  "success": true,
  "data": {
    "saved": true,
    "saveCount": 5,
    "bookmarked": true,
    "bookmarkCount": 5
  }
}
```

`bookmarked` / `bookmarkCount` are aliases for backward compatibility.

### Comments

Not supported for copyright-free songs.

---

## WebSocket (real-time)

Join room before listening for updates:

```js
socket.emit("join-content", { contentId: songId, contentType: "audio" });
// Room: content:audio:{songId}
```

Event: `copyright-free-song-interaction-updated` — payload includes `songId`, `likeCount`, `viewCount`, `liked`.

For feed media:

```js
socket.emit("join-content", { contentId: mediaId, contentType: "media" });
```

Events: `content-reaction`, `content-comment`, `count-update`.

See [WEBSOCKETS.md](./WEBSOCKETS.md).

---

## Rate limits (engagement)

| Route group | Limit |
|-------------|-------|
| `/api/content/*` like/share/view | 10 req/min per user |
| Comments | 5 req/min per user |
| General API | 100 req/15min per IP (production) |

---

## SDK

`packages/jevah-js-sdk` — `trackView` and `like` use `/api/content/*` for feed media.
