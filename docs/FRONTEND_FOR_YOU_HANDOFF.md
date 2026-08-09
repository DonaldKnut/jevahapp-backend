# Frontend handoff — For You + Artists Music algorithm

**Date:** 2026-08-09  
**Audience:** Mobile (Expo) + web player  
**Backend:** `jevahapp-backend` (live after Contabo pull)  
**Related:** [FEED_RANKER.md](./FEED_RANKER.md) · [FRONTEND_TIKTOK_FEED_HANDOFF.md](./FRONTEND_TIKTOK_FEED_HANDOFF.md) · [FRONTEND_CF_MUSIC_PLAYER_HANDOFF.md](./FRONTEND_CF_MUSIC_PLAYER_HANDOFF.md) · [FRONTEND_WEB_LOGIN_API_BASE_HANDOFF.md](./FRONTEND_WEB_LOGIN_API_BASE_HANDOFF.md)

---

## 0. Product intent

| Surface | Feel | Backend source |
|---------|------|----------------|
| **For You** (vertical video) | TikTok / Reels — endless, personal, no chrome noise | `GET /api/feed/for-you` |
| **Artists For You** (gospel tracks) | Spotify / YTM Discover — sleek shelf that learns listens | `GET /api/feed/music-for-you?lane=artist` or `GET /api/music/for-you` |
| **Browse / search** | Explicit catalog | Keep `GET /api/music/tracks?lane=artist` chronological |

Ranking learns from **`POST /api/feed/events`**. Without events, For You stays cold (engagement + recency only).

---

## 1. API base (must be seamless)

```env
# Mobile / Vite / Next — base MUST include /api
EXPO_PUBLIC_API_URL=https://api.jevahapp.com/api
VITE_API_URL=https://api.jevahapp.com/api
NEXT_PUBLIC_API_URL=https://api.jevahapp.com/api
```

All calls below are relative to that base (`/feed/for-you`, not `/api/feed/for-you` twice).

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

Auth required on for-you + events. On 401 → refresh token once, then fall back to chronological feeds (never blank screen).

---

## 2. Copy-paste client (seamless backend talk)

One small module. Soft-fail everything ranking-related; never block playback.

```ts
// lib/feedRanker.ts
const API = process.env.EXPO_PUBLIC_API_URL!; // …/api

type FeedEvent = {
  contentId: string;
  contentType?: string; // "media" | "videos" | "music" | …
  eventType: "impression" | "watch_time" | "skip" | "like" | "save" | "share";
  watchMs?: number;
  progressPct?: number; // 0–1 or 0–100 (server normalizes)
  sessionId?: string;
  source?: string; // "for_you" | "music_for_you" | "artists"
};

const queue: FeedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export function resetFeedSession() {
  sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function enqueueFeedEvent(e: FeedEvent) {
  queue.push({ ...e, sessionId: e.sessionId ?? sessionId });
  if (queue.length >= 12) void flushFeedEvents();
  else if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flushFeedEvents();
    }, 2500);
  }
}

export async function flushFeedEvents(token: string) {
  if (!queue.length) return;
  const batch = queue.splice(0, 50);
  try {
    await fetch(`${API}/feed/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ events: batch }),
    });
  } catch {
    // soft-fail: drop or re-queue once; never toast
  }
}

export async function fetchForYou(token: string, cursor?: string | null, limit = 20) {
  const q = new URLSearchParams({ limit: String(limit) });
  if (cursor) q.set("cursor", cursor);
  const res = await fetch(`${API}/feed/for-you?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`for-you ${res.status}`);
  const json = await res.json();
  return json.data as {
    items: any[];
    media: any[];
    cursor: string | null;
    hasMore: boolean;
  };
}

export async function fetchMusicForYou(
  token: string,
  opts?: { cursor?: string | null; limit?: number; lane?: "artist" | "curated" }
) {
  const q = new URLSearchParams({
    limit: String(opts?.limit ?? 20),
    lane: opts?.lane ?? "artist",
  });
  if (opts?.cursor) q.set("cursor", opts.cursor);
  const res = await fetch(`${API}/feed/music-for-you?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  // alias also works: `${API}/music/for-you?${q}`
  if (!res.ok) throw new Error(`music-for-you ${res.status}`);
  const json = await res.json();
  return json.data as {
    tracks: any[];
    items: any[];
    cursor: string | null;
    hasMore: boolean;
    lane: string;
  };
}
```

**Rules**

- Flush on app background / tab hide / logout.
- Cap 50 events per POST (server rejects larger).
- Impression + `sessionId` is idempotent — safe to retry.
- Keep existing like/view/share mutations; optionally mirror `like`/`save`/`share` into events for ranking (additive).

---

## 3. Video For You — wire + UI

### Load

```ts
// Prefer ranked; fallback chronological
try {
  page = await fetchForYou(token, cursor);
} catch {
  page = await fetchAllContent(token, cursor); // existing /media/all-content
}
```

Card shape is **identical** to `GET /api/media/all-content` (`items` + `media` alias). Reuse `AllContentTikTok` / existing feed card — do not invent a second renderer.

### Signals (when to fire)

| Moment | Event |
|--------|--------|
| Card ≥50% visible ≥300ms | `impression` |
| Playing, every ~5s + on pause | `watch_time` + `watchMs` + `progressPct` |
| Swipe away under ~1.5s watch | `skip` |
| Heart / save / share | Keep existing APIs; optional event mirror |

Counted views stay on `POST /api/content/media/:id/view` — events do **not** replace them.

### Premium UI (video)

- Full-bleed vertical video; one composition per viewport.
- Brand mark tiny (corner watermark), not a dashboard header.
- Controls: heart, comment, save, share — glass / thin stroke, no fat pill rows.
- Progress: thin bottom scrub only; no overlay badges on the media plane.
- Loading: soft skeleton or hold previous frame — never a spinner wall.
- Empty / error: one calm line + “Browse latest” → chronological fallback.

Motion (2–3 intentional):

1. Crossfade next clip on settle.
2. Heart scale on like (optimistic).
3. Subtle parallax on swipe settle — no glow spam.

---

## 4. Artists music For You — wire + UI

### Load

```http
GET /api/feed/music-for-you?lane=artist&cursor=1&limit=20
Authorization: Bearer <JWT>
```

Alias: `GET /api/music/for-you` (same handler).

```json
{
  "success": true,
  "data": {
    "tracks": [ /* same CF track cards as /api/music/tracks */ ],
    "items": [ /* alias of tracks */ ],
    "cursor": "2",
    "hasMore": true,
    "lane": "artist"
  }
}
```

Reuse CF track card / player from [FRONTEND_CF_MUSIC_PLAYER_HANDOFF.md](./FRONTEND_CF_MUSIC_PLAYER_HANDOFF.md) (`audioUrl`, `duration`, `isLiked`, counts).

| Shelf | Query |
|-------|--------|
| Artists Discover / For You | `lane=artist` (default) |
| Curated gospel playlist vibe | `lane=curated` |
| Search, genre browse, library | chronological `GET /api/music/tracks` |

### Signals

| Moment | Event `contentType` | Plus existing |
|--------|---------------------|---------------|
| Row / cover visible | `impression` + `"music"` | — |
| Qualified play | `watch_time` or rely on | `POST …/view` (`counted`) |
| Skip &lt; ~15s | `skip` + `"music"` | — |
| Like / save / share | optional event | `POST …/like|save|share` |

Prefer firing **both** CF engagement routes (counts + sockets) and feed events (ranking). Soft-fail events only.

### Premium UI (Artists)

- Hero shelf title: **For You** (or **Made for you**) under Artists — not a grid of promo cards.
- Horizontal rail or vertical list with large artwork, title, artist — sparse typography, generous spacing.
- Now-playing bar docked; one primary accent from brand palette (avoid purple-default AI look).
- No stat strips on the shelf (“trending!” chips). Counts live on the player sheet.
- Prefetch next 2–3 `audioUrl`s after rank response for instant tap-to-play.

Pagination: use `cursor` string from response (`"2"`, `"3"`…) until `hasMore: false`. Prefetch next page when user is ~5 items from the end.

---

## 5. Response contracts (quick)

### `POST /api/feed/events`

```json
{
  "events": [
    {
      "contentId": "665f…",
      "contentType": "media",
      "eventType": "impression",
      "sessionId": "s_…",
      "source": "for_you"
    },
    {
      "contentId": "665f…",
      "contentType": "music",
      "eventType": "skip",
      "source": "music_for_you"
    }
  ]
}
```

```json
{ "success": true, "data": { "accepted": 2, "skipped": 0, "errors": [] } }
```

Ignore `errors` in UI; log in debug builds only.

### Fallbacks

| Failure | FE behavior |
|---------|-------------|
| For You 5xx / timeout | `GET /api/media/all-content` |
| Music For You 5xx | `GET /api/music/tracks?lane=artist` |
| Events 4xx/5xx | Drop batch; keep playing |
| 401 | Refresh once; else send to login |

---

## 6. Feature flags (recommended)

```ts
const USE_SERVER_FOR_YOU = true;       // vertical feed list source
const USE_MUSIC_FOR_YOU = true;        // Artists Discover shelf
const CLIENT_RERANK = false;           // turn off local rankFeedForYou once events ship
```

Ship events first (even if still using chronological list) so affinity warms before flipping the flag.

---

## 7. FE checklist

### Seamless backend

- [ ] API base includes `/api`
- [ ] Bearer on for-you + music-for-you + events
- [ ] Event queue + flush on background
- [ ] Impression + watch_time + skip wired on both surfaces
- [ ] Cursor pagination; prefetch near end
- [ ] Soft fallback to chronological on error
- [ ] CF like/view/share still called for music counts

### Premium UI

- [ ] One feed renderer for for-you + all-content cards
- [ ] One track card for music-for-you + tracks shelf
- [ ] No ranking debug UI in production
- [ ] No blocking loaders for event POST
- [ ] Instant optimistic like; socket reconcile counts

### Smoke (curl)

```bash
BASE=https://api.jevahapp.com/api
TOKEN="<JWT>"

curl -s "$BASE/feed/for-you?limit=5" -H "Authorization: Bearer $TOKEN" | jq '.data|{hasMore,cursor,n:(.items|length)}'

curl -s "$BASE/feed/music-for-you?lane=artist&limit=5" -H "Authorization: Bearer $TOKEN" | jq '.data|{lane,hasMore,n:(.tracks|length),first:.tracks[0].title}'

curl -s -X POST "$BASE/feed/events" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"events":[{"contentId":"<id>","contentType":"music","eventType":"impression","sessionId":"fe-1","source":"music_for_you"}]}'
```

---

## 8. What backend does *not* need from FE

- No TensorFlow / ML on device.
- No `FEED_RANKER_URL` awareness — Contabo runs Node local ranker only.
- Do not send client-invented like/view totals; server owns counts.
