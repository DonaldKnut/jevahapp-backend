# Frontend Likes — Instagram / TikTok Style

How mobile and web clients should wire **like / unlike** so it feels like Instagram Reels or TikTok: instant heart, correct counts, no double-taps, live updates while scrolling.

**API contracts:** [ENGAGEMENT.md](./ENGAGEMENT.md) · **Sockets:** [WEBSOCKETS.md](./WEBSOCKETS.md) · **Broader engagement:** [FRONTEND_ENGAGEMENT.md](./FRONTEND_ENGAGEMENT.md)

---

## 1. Product rules (match IG / TikTok)

| UX rule | Backend reality | Frontend must |
|---------|-----------------|---------------|
| Heart flips **instantly** | Write is durable Mongo (~100–400 ms) | **Optimistic UI** — never wait for network to animate |
| Same control likes **and** unlikes | One toggle endpoint | One tap → like; tap again → unlike |
| Double-tap video = like | No special double-tap API | Client maps double-tap → same toggle (only if not already liked, or always toggle — product choice below) |
| Count next to heart is global | `likeCount` is total likes | Show `likeCount`; never derive “I liked” from count alone |
| My heart stays filled after refresh | `liked` / `hasLiked` from JWT | Hydrate per-user flags after login |
| Rapid spam taps don’t break counts | Rate limit + idempotency | Debounce + `Idempotency-Key` per gesture |
| Other viewers see count rise | Socket `count-update` / `content-reaction` | Join content room; update **count** from sockets; don’t flip **my** heart from others’ likes |

**Canonical mental model**

```text
liked     = “Did *I* like this?”     ← boolean for this JWT user
likeCount = “How many people liked?” ← global integer
```

Unliking can leave `likeCount > 0` (other people still liked it). That is correct — same as IG.

---

## 2. Which API to call

### Feed / sermons / videos / ebooks (main app)

```http
POST /api/content/:contentType/:contentId/like
Authorization: Bearer <accessToken>
Content-Type: application/json
Idempotency-Key: <uuid-v4>          # strongly recommended every tap
```

No body required.

| Content on screen | `:contentType` in URL |
|-------------------|------------------------|
| Video / sermon / feed clip | `media` (aliases `video`, `videos`, `sermon`, `audio`, `music` also work) |
| Ebook | `ebook` or `media` |
| Podcast | `podcast` or `media` |
| Merch | `merch` |
| Devotional | Prefer `POST /api/devotionals/:id/like` |

### Copyright-free music library (separate product)

```http
POST /api/audio/copyright-free/:songId/like
Authorization: Bearer <accessToken>
```

Do **not** mix stacks. Copyright-free never uses `/api/content/.../like`.

---

## 3. Success response (source of truth after network)

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

| Field | Use in UI |
|-------|-----------|
| `data.liked` | Set heart filled / empty to this value (authoritative for **me**) |
| `data.likeCount` | Set the number under the heart |
| `data.contentId` | Confirm you updated the right card |

Unlike returns the same shape with `"liked": false` and a decremented (or unchanged if already unliked) count.

There is **no** separate `DELETE /like` yet — toggle only.

---

## 4. Hydrate hearts when the feed loads (critical)

### Instant paint (required for feed cards)

The media card and the icon row under it must appear together. Feed endpoints already ship counts + your like/save state — **use them on the first render**.

Do **not**:

- Hide or delay the engagement row until `batch-metadata` returns
- Mount icons in a child that only hydrates after a second network call
- Show `0` / hollow icons while waiting when the feed already had real numbers

```ts
// Same paint as the video box
liked: item.hasLiked ?? item.userInteractions?.liked ?? false
saved: item.hasBookmarked ?? item.userInteractions?.saved ?? false
likeCount: item.likeCount ?? 0
commentCount: item.commentCount ?? 0
viewCount: item.viewCount ?? 0
shareCount: item.shareCount ?? 0
```

### Option A — Feed already includes flags (preferred)

Authenticated:

```http
GET /api/media/all-content?page=1&limit=20
Authorization: Bearer <accessToken>
```

Public (optional Bearer still overlays flags):

```http
GET /api/media/public/all-content?page=1&limit=20
Authorization: Bearer <accessToken>
```

Each item can include:

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

### Option B — Batch metadata after list load (background only)

Use only if the list endpoint did not include engagement fields (rare). Never block first paint on this.

```http
POST /api/content/batch-metadata
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "items": [
    { "contentType": "media", "contentId": "…" },
    { "contentType": "media", "contentId": "…" }
  ]
}
```

Response item:

```json
{
  "id": "…",
  "likes": 10,
  "userInteraction": { "liked": true, "saved": false, "shared": false, "viewed": true }
}
```

### After login / token refresh

Re-run batch metadata (or refetch feed) so hearts fill for the new user. Guest users: show counts, hollow heart; tap → login sheet.

---

## 5. Instagram / TikTok interaction design

### 5.1 Single tap on heart (sidebar)

Same as TikTok right-rail heart:

1. If not logged in → open login; do not change heart.
2. Optimistic: flip `liked`, `likeCount += liked ? 1 : -1` (floor at 0).
3. Scale/pop animation (~200–300 ms).
4. Fire `POST …/like` with a **new** `Idempotency-Key` for this gesture.
5. On success → apply `data.liked` + `data.likeCount` (may correct race).
6. On error → revert optimistic state + light haptic/toast.

### 5.2 Double-tap on video (IG Reels style)

Recommended product behavior:

| Current state | Double-tap does |
|---------------|-----------------|
| Not liked | Like only (don’t unlike on double-tap) |
| Already liked | Show heart burst animation; **no** second API call |

```ts
function onDoubleTapVideo(card: LikeCardState) {
  if (!isLoggedIn) return openLogin();
  showBigHeartBurst(); // pure UI
  if (card.liked) return; // already liked — IG behavior
  void toggleLike(card);  // same pipeline as heart tap
}
```

Single tap on hollow/filled heart still toggles unlike (TikTok sidebar behavior).

### 5.3 While request is in flight

- Ignore extra taps **or** queue at most one flip (debounce 300–400 ms).
- Do not fire 10 POSTs for 10 rage-taps.
- Keep heart interactive visually; sync when response returns.

### 5.4 Formatting counts (IG-like)

```ts
function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}
```

---

## 6. Reference client implementation

```ts
import { randomUUID } from "crypto"; // or expo-crypto / uuid lib

type LikeCardState = {
  contentId: string;
  contentType: "media" | "ebook" | "podcast" | "merch";
  liked: boolean;
  likeCount: number;
  likePending: boolean;
};

type LikeApiData = {
  liked: boolean;
  likeCount: number;
  contentId: string;
  contentType: string;
  updatedAt?: string;
};

async function toggleLike(
  card: LikeCardState,
  api: { post: (url: string, opts?: any) => Promise<{ data: LikeApiData }> }
) {
  if (card.likePending) return;
  card.likePending = true;

  const snapshot = { liked: card.liked, likeCount: card.likeCount };

  // 1) Optimistic — IG/TikTok feel
  card.liked = !card.liked;
  card.likeCount = Math.max(0, card.likeCount + (card.liked ? 1 : -1));

  const idempotencyKey = randomUUID(); // ONE key per user gesture

  try {
    // 2) Durable toggle on server
    const res = await api.post(
      `/api/content/${card.contentType}/${card.contentId}/like`,
      {
        headers: { "Idempotency-Key": idempotencyKey },
      }
    );

    // 3) Reconcile with server (never invent liked from likeCount)
    card.liked = res.data.liked;
    card.likeCount = res.data.likeCount;
  } catch (err: any) {
    const status = err?.status ?? err?.response?.status;
    if (status === 401) {
      card.liked = snapshot.liked;
      card.likeCount = snapshot.likeCount;
      openLogin();
    } else if (status === 429) {
      // Rate limited — revert and optionally read Retry-After
      card.liked = snapshot.liked;
      card.likeCount = snapshot.likeCount;
      toast("Slow down");
    } else {
      card.liked = snapshot.liked;
      card.likeCount = snapshot.likeCount;
      toast("Couldn’t update like");
    }
  } finally {
    card.likePending = false;
  }
}
```

### Idempotency (flaky mobile networks)

- Generate a **new UUID per tap gesture**.
- If the client retries the **same** tap (timeout → retry), reuse the **same** UUID → server returns the stored response (no double unlike).
- Never reuse yesterday’s key for a new tap.
- If Redis is down and you sent `Idempotency-Key`, the API **fails open** (processes the like without idempotency). Duplicate-tap protection is best-effort until Redis recovers.

---

## 7. Realtime (other people’s likes on the open video)

When a feed item is **focused / on screen**:

```ts
socket.emit("join-content", { contentId, contentType: "media" });

socket.on("count-update", (payload) => {
  // payload may include likeCount, commentCount, …
  if (payload.contentId && payload.contentId !== contentId) return;
  if (typeof payload.likeCount === "number") {
    card.likeCount = payload.likeCount;
    // Do NOT set card.liked from this event
  }
});

socket.on("content-reaction", (payload) => {
  // Optional: bump animation for others; still don’t flip *my* heart
  if (typeof payload.likeCount === "number") {
    card.likeCount = payload.likeCount;
  }
});
```

On blur / scroll away:

```ts
socket.emit("leave-content", { contentId, contentType: "media" });
```

**Persistence rule:** sockets are for live counts only. **Always** like/unlike via HTTP `POST …/like`.

Connect with the same JWT:

```ts
io(API_URL, { auth: { token: accessToken }, path: "/socket.io/" });
```

---

## 8. Errors the UI must handle

| Status | Code | UI |
|--------|------|-----|
| 200 | — | Apply `liked` + `likeCount` |
| 401 | — | Revert optimistic; open login |
| 404 | `CONTENT_NOT_FOUND` | Revert; refresh feed (stale card) |
| 400 | `INVALID_CONTENT_ID` / `INVALID_CONTENT_TYPE` | Fix URL mapping (use `media` for videos) |
| 400 | `INVALID_IDEMPOTENCY_KEY` | Send a real UUID |
| 409 | `IDEMPOTENCY_CONFLICT` | New key for new gesture |
| 429 | `LIKE_RATE_LIMITED` | Revert; respect `Retry-After`; toast “Slow down” |
| 5xx | unexpected | Revert; toast error (idempotency store outages no longer return 503) |

---

## 9. Screen recipes

### For You / Reels vertical pager

```
┌─────────────────────────┐
│                         │
│     VIDEO (full bleed)  │  ← double-tap → like if not liked + burst
│                         │
│              ♥ 12.4K    │  ← tap heart → toggle like/unlike
│              💬 820     │
│              ➤ Share    │
└─────────────────────────┘
```

Per page mount:

1. Bind `liked` / `likeCount` from feed or batch-metadata.
2. `join-content` for that `mediaId`.
3. Wire heart + double-tap to `toggleLike`.
4. On page unmount → `leave-content`.

### Grid / profile posts (IG grid → detail)

- Grid: show `likeCount` only (optional).
- Detail: full heart + count + same toggle endpoint.

### Offline

- If offline: either disable heart or queue one mutation and flush when online **with the same Idempotency-Key**.
- Do not apply unlimited optimistic flips offline without a queue.

---

## 10. QA checklist (ship bar)

- [ ] Logged-out tap opens login; heart unchanged  
- [ ] Like → heart fills, count +1, survives app kill + reopen  
- [ ] Unlike → heart empties; count can stay &gt; 0 if others liked  
- [ ] Double-tap likes once; second double-tap does not unlike  
- [ ] Heart tap unlikes when already liked  
- [ ] Rage-tap does not desync heart vs count  
- [ ] Airplane mode → revert or queued single retry with same key  
- [ ] Two devices: device A like updates device B **count** via socket; B’s heart only changes if B liked  
- [ ] Video uses `contentType: "media"` (not a random string)  
- [ ] Copyright-free player uses `/api/audio/copyright-free/:id/like` only  

---

## 11. What not to do

| Don’t | Do instead |
|-------|------------|
| `PUT` / `DELETE` like (not shipped) | `POST …/like` toggle |
| Infer `liked` from `likeCount === 0` | Use `liked` / `hasLiked` |
| Wait for API before animating heart | Optimistic then reconcile |
| Fire like over socket only | HTTP for write; socket for live counts |
| Call `/api/content` for copyright-free songs | Copyright-free like path |
| Share one `Idempotency-Key` across different taps | New UUID per gesture |
| Run two like stores for the same card | One `LikeCardState` object |

---

## 12. Minimal wiring summary for frontend leads

```text
1. Auth JWT on all like calls
2. Hydrate hasLiked + likeCount on feed
3. Optimistic toggle + POST /api/content/media/:id/like
4. Header Idempotency-Key: <uuid>
5. Reconcile with data.liked + data.likeCount
6. join-content + listen count-update for live numbers
7. Double-tap = like-if-needed; heart = full toggle
```

That’s the Instagram / TikTok corroboration path against the current Contabo backend.
