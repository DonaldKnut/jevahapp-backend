# Frontend handoff — TikTok-standard feed (corroborate backend)

**Date:** 2026-08-02  
**Backend:** `jevahapp-backend`  
**Audience:** Mobile / Expo (`AllContentTikTok`, Library, engagement helpers)  
**Goal:** Corroborate what backend now ships so FE can drop retries/workarounds and wire For You + ranking signals.

---

## 0. Executive summary

| Capability | Status | FE action |
|------------|--------|-----------|
| Chronological feed with **same-paint** engagement | Shipped (enhanced) | Paint icons from card fields; do **not** gate on `batch-metadata` |
| `bookmarkCount` / `saves` on feed cards | **New** | Show save count; stop fetching metadata just for saves |
| `engagementContentType: "media"` | **New** (additive) | Prefer for `/api/content/...` + `/api/bookmark` calls; keep `contentType` (`videos`/`sermon`) for shelves |
| Bookmark toggle same Media resolver as likes | Shipped | `{ "contentType": "media" }` (aliases still accepted) |
| Share count sockets | **New** | Listen `content-share-count-updated` |
| `POST /api/feed/events` | **New** | Send impression / watch_time / skip (and optional like/save/share mirrors) |
| `GET /api/feed/for-you` | **New MVP** | Optional list source; **same card shape** as all-content |
| Server ranking (full TikTok) | MVP only | Keep client `rankFeedForYou` until events volume is healthy; then prefer For You |

**Does not break:** `/api/media/all-content`, legacy aliases, existing like/view/comment contracts.

---

## 1. Feed card contract (source of truth for first paint)

### Endpoints

```http
GET /api/media/all-content?page=1&limit=20
Authorization: Bearer <JWT>

GET /api/media/public/all-content?page=1&limit=20
Authorization: Bearer <JWT>   # optional; overlays when present

GET /api/feed/for-you?cursor=1&limit=20
Authorization: Bearer <JWT>   # required
```

### Card fields (each item)

| Field | Meaning |
|-------|---------|
| `_id` / `id` | Media ObjectId |
| `contentType` | **Media kind** for UI shelves: `videos`, `music`, `sermon`, `audio`, … |
| `engagementContentType` | **Always `"media"`** for engagement path segments / bookmark body |
| `fileUrl`, `playbackUrl`, `hlsUrl`, `thumbnailUrl`, `videoUrl` | Playback |
| `duration`, `processingStatus` | Scrubber / seek |
| `likeCount`, `commentCount`, `viewCount`, `shareCount` | Counts |
| `bookmarkCount`, `saves`, `totalSaves` | Save count (aliases) |
| `hasLiked`, `hasBookmarked` | Per-user flags |
| `bookmarked`, `isBookmarked` | Aliases of `hasBookmarked` |
| `userInteractions.liked` / `.saved` | Same flags |

### Copy-paste mapper

```ts
function engagementFromFeedItem(item: any) {
  return {
    contentId: String(item._id ?? item.id),
    // shelves / filters
    mediaKind: item.contentType, // "videos" | "sermon" | …
    // API calls
    engagementType: item.engagementContentType ?? "media",
    likeCount: Number(item.likeCount ?? 0),
    commentCount: Number(item.commentCount ?? 0),
    viewCount: Number(item.viewCount ?? 0),
    shareCount: Number(item.shareCount ?? 0),
    bookmarkCount: Number(item.bookmarkCount ?? item.saves ?? 0),
    liked: Boolean(item.hasLiked ?? item.userInteractions?.liked),
    saved: Boolean(
      item.hasBookmarked ?? item.isBookmarked ?? item.userInteractions?.saved
    ),
    duration: item.duration ?? null,
  };
}
```

**Anti-pattern:** wait for `POST /api/content/batch-metadata` before rendering hearts/bookmarks.

---

## 2. Mutations (canonical)

Prefer `engagementContentType` / `"media"` — **stop alias retry loops** once this build is live.

| Action | Request |
|--------|---------|
| Like | `POST /api/content/media/:id/like` |
| Save | `POST /api/bookmark/:id/toggle` body `{ "contentType": "media" }` |
| Share analytics | `POST /api/content/media/:id/share` body `{ "platform": "internal" }` |
| View (counted) | `POST /api/content/media/:id/view` body `{ durationMs, progressPct, isComplete, source }` |
| Comments | `GET/POST /api/content/media/:id/comments` |

### Save response

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

Library: `GET /api/bookmark/user` → `data.bookmarks`.

Legacy fallback (same handler): `POST /api/media/interactions/:id/save`.

---

## 3. Ranking signals — `POST /api/feed/events`

```http
POST /api/feed/events
Authorization: Bearer <JWT>
Content-Type: application/json
```

```json
{
  "events": [
    {
      "contentId": "69abf4886aef561f683a1a32",
      "contentType": "media",
      "eventType": "impression",
      "sessionId": "optional-uuid",
      "source": "feed"
    },
    {
      "contentId": "69abf4886aef561f683a1a32",
      "contentType": "media",
      "eventType": "watch_time",
      "watchMs": 5200,
      "progressPct": 0.35,
      "sessionId": "optional-uuid",
      "source": "feed"
    },
    {
      "contentId": "…",
      "eventType": "skip",
      "watchMs": 800,
      "source": "feed"
    }
  ]
}
```

Also accepted as a **single** event object (no `events` wrapper).

| `eventType` | When to send |
|-------------|--------------|
| `impression` | Card ≥50% visible ≥1s |
| `watch_time` | Every ~5s while playing, and on pause/end |
| `skip` | Scroll away with &lt;3s watch |
| `like` / `save` / `share` | Optional mirrors after successful mutation (analytics) |

**Response:**

```json
{
  "success": true,
  "data": { "accepted": 2, "skipped": 0, "errors": [] }
}
```

**Rules for FE:**
- Soft-fail: never block playback/UI on events errors
- Batch up to **50** events / request
- `impression` + `sessionId` is idempotent server-side
- Still call **`/view`** for counted views (thresholds unchanged) — events are for ranking/fatigue, not viewCount

---

## 4. For You — `GET /api/feed/for-you`

```http
GET /api/feed/for-you?cursor=1&limit=20
Authorization: Bearer <JWT>
```

```json
{
  "success": true,
  "data": {
    "items": [ /* same card shape as all-content media[] */ ],
    "media": [ /* alias of items */ ],
    "cursor": "2",
    "hasMore": true
  }
}
```

**MVP behavior:**
1. Loads a pool from the same Media public feed query
2. Demotes IDs impressed / watched / skipped in last **24h** (from `/events`)
3. Scores: engagement + recency + light exploration
4. Diversifies so you don’t get 3 identical `contentType` kinds in a row

**FE migration path:**
1. Keep `GET /api/media/all-content` + client `rankFeedForYou` as fallback
2. Wire events in production
3. Feature-flag `GET /api/feed/for-you` as list source when ready
4. When For You is on, you can reduce client re-ranking (optional)

---

## 5. Sockets (live counts)

| Event | Fields |
|-------|--------|
| `content-like-count-updated` / `content-like-update` | `contentId`, `likeCount`, `liked` (actor room) |
| `content-bookmark-count-updated` / `content-bookmark-update` | `contentId`, `bookmarkCount` |
| `content-bookmark-state-updated` | actor room: `bookmarked` |
| `content-share-count-updated` / `content-share-update` | `contentId`, `shareCount`, `totalShares` |
| `view-updated` / `content:viewCountUpdated` | view counts when counted |

Join content rooms as you already do for likes.

---

## 6. Corroboration checklist (FE)

### Feed paint
- [ ] Icon row uses feed card fields on first render
- [ ] `bookmarkCount` / `saves` displayed (not stuck at 0 waiting for metadata)
- [ ] `engagementContentType === "media"` used for like/save/share/view paths
- [ ] `contentType` still used for “videos vs sermon” UI filters

### Save
- [ ] Single `POST /api/bookmark/:id/toggle` with `contentType: "media"` (no alias storm)
- [ ] Optimistic revert still on hard failure
- [ ] Library reads `data.bookmarks`

### Events
- [ ] Impressions fire in feed
- [ ] `watch_time` every ~5s / pause
- [ ] Soft-fail only
- [ ] `/view` still used for counted views

### For You
- [ ] Can load `/api/feed/for-you` and render with existing card component
- [ ] Falls back to all-content if 401/5xx
- [ ] After sending impressions, next For You page demotes those IDs

### Share
- [ ] Native sheet never blocked by analytics
- [ ] Optional: patch `shareCount` from socket

---

## 7. Curl smoke

```bash
BASE=http://127.0.0.1:4000
TOKEN="<JWT>"
ID="<media ObjectId from feed>"

# Feed card should include bookmarkCount + engagementContentType
curl -s "$BASE/api/media/all-content?limit=10" -H "Authorization: Bearer $TOKEN" | jq '.data.media[0] | {id:.id, contentType, engagementContentType, bookmarkCount, hasBookmarked, duration}'

# Bookmark
curl -i -X POST "$BASE/api/bookmark/$ID/toggle" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"contentType":"media"}'

# Events
curl -i -X POST "$BASE/api/feed/events" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"events\":[{\"contentId\":\"$ID\",\"contentType\":\"media\",\"eventType\":\"impression\",\"sessionId\":\"smoke-1\"},{\"contentId\":\"$ID\",\"eventType\":\"watch_time\",\"watchMs\":5000}]}"

# For You
curl -s "$BASE/api/feed/for-you?limit=10" -H "Authorization: Bearer $TOKEN" | jq '.data | {hasMore, cursor, n:(.items|length), first:.items[0].id}'
```

---

## 8. Deploy note (backend)

`npm start` serves `dist/`. After pull:

```bash
npm run build && npm start   # or PM2 restart after build
```

Local: `npm run dev` picks up `src/` via ts-node-dev.

---

## 9. Related docs

- [ENGAGEMENT.md](./ENGAGEMENT.md) — full engagement contract  
- [FRONTEND_FEED_ENGAGEMENT_HANDOFF.md](./FRONTEND_FEED_ENGAGEMENT_HANDOFF.md) — same-paint icons  
- [FRONTEND_BOOKMARK_HANDOFF.md](./FRONTEND_BOOKMARK_HANDOFF.md) — save 404 fix  
- [FRONTEND_VIDEO_DURATION_HANDOFF.md](./FRONTEND_VIDEO_DURATION_HANDOFF.md) — scrubber  
- [FRONTEND_VIEW_HANDOFF.md](./FRONTEND_VIEW_HANDOFF.md) — counted views  

---

*Backend TikTok MVP: complete cards + events + For You ranking scaffold. Full ML ranking is a later iteration once event volume exists on Contabo.*
