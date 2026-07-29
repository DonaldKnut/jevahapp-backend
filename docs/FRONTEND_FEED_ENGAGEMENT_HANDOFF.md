# Frontend handoff — feed engagement icons feel late

**Audience:** Mobile / Expo feed team  
**Problem:** Video/thumbnail box paints first; views / like / comment / share / bookmark icons appear much later.  
**Root cause:** Icons wait on a second request (`POST /api/content/batch-metadata`) instead of using fields already on the feed item.  
**Backend status:** Counts + liked/saved already ship on the feed response. No new API required for first paint.

**Related:** [FRONTEND_ENGAGEMENT.md](./FRONTEND_ENGAGEMENT.md) · [FRONTEND_LIKES.md](./FRONTEND_LIKES.md)

---

## 1. What to fix (exact)

### Broken pattern (remove)

```
1. Feed loads → render media box
2. For visible IDs → await POST /api/content/batch-metadata
3. Only then → render engagement icon row
```

Or any variant that does:

```ts
if (!engagementById[id]) return null; // or skeleton until batch returns
```

### Correct pattern (required)

```
1. Feed loads → render media box AND icon row in the same paint
2. Seed icon state from the feed item fields (below)
3. Optional: batch-metadata in background only if a field was missing — never gate UI
```

---

## 2. Which feed endpoint

Prefer authenticated:

```http
GET /api/media/all-content?page=1&limit=20
Authorization: Bearer <accessToken>
```

Also fine (same overlays when Bearer is sent):

```http
GET /api/media/public/all-content?page=1&limit=20
Authorization: Bearer <accessToken>
```

Each `data.media[]` item already includes engagement:

| Field | Use for |
|-------|---------|
| `likeCount` | Heart count |
| `commentCount` | Comment badge |
| `viewCount` | Views |
| `shareCount` | Share count |
| `hasLiked` / `userInteractions.liked` | Filled vs hollow heart |
| `hasBookmarked` / `userInteractions.saved` | Bookmark filled state |

---

## 3. Copy-paste mapping

```ts
type CardEngagement = {
  likeCount: number;
  commentCount: number;
  viewCount: number;
  shareCount: number;
  liked: boolean;
  saved: boolean;
};

function engagementFromFeedItem(item: any): CardEngagement {
  return {
    likeCount: Number(item.likeCount ?? item.totalLikes ?? 0) || 0,
    commentCount: Number(item.commentCount ?? 0) || 0,
    viewCount: Number(item.viewCount ?? item.totalViews ?? 0) || 0,
    shareCount: Number(item.shareCount ?? item.totalShares ?? 0) || 0,
    liked: Boolean(item.hasLiked ?? item.userInteractions?.liked ?? false),
    saved: Boolean(item.hasBookmarked ?? item.userInteractions?.saved ?? false),
  };
}

// When building the FlatList / FlashList row:
const engagement = engagementFromFeedItem(item);
// Pass into MediaCard — render icons immediately with `engagement`
```

**Do not** leave counts at `0` / hollow icons while a second request is in flight when the feed already had real values.

---

## 4. Where `batch-metadata` still belongs

| Use | Don’t use |
|-----|-----------|
| Background reconcile if feed omitted a field | Gate first paint of the icon row |
| After login without refetching the feed | Copyright-free songs (use song GET) |
| Non-feed screens (search cards, deep links without list payload) | As the only source of like/comment counts on the home feed |

```http
POST /api/content/batch-metadata
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "items": [{ "contentType": "media", "contentId": "…" }] }
```

If you keep a background call, merge into existing card state — never unmount / hide the row until it returns.

---

## 5. After paint — mutations stay the same

| Icon | Action |
|------|--------|
| Like | Optimistic flip → `POST /api/content/media/:id/like` (+ `Idempotency-Key`) |
| Comment | Open sheet → list uses `GET /api/content/media/:id/comments` |
| Share | Native share → `POST /api/content/media/:id/share` |
| Bookmark | Optimistic → `POST /api/bookmark/:id/toggle` |
| Views | Player threshold → `POST /api/content/media/:id/view` |

Full like UX: [FRONTEND_LIKES.md](./FRONTEND_LIKES.md). Comments sheet: [FRONTEND_COMMENTS.md](./FRONTEND_COMMENTS.md).

---

## 6. QA checklist

- [ ] On cold feed open, icons appear in the **same frame** as the video box (no empty gap then pop-in).
- [ ] Network tab: feed request returns; **no required** `batch-metadata` before icons show.
- [ ] Heart fill matches `hasLiked` without a second round-trip.
- [ ] Comment badge matches `commentCount` from feed (sheet list can refine later).
- [ ] After like toggle, count/fill update from mutation response (optimistic OK).
- [ ] Guest: counts show; heart hollow; tap → login.
- [ ] Logged-in on `public/all-content`: still send Bearer so `hasLiked` / `hasBookmarked` fill.

---

## 7. If icons are still late after this

Then the bug is **UI architecture**, not API latency — e.g.:

- Engagement row in a child that mounts only after `useEffect` + fetch
- Separate React Query key that blocks render
- Skeleton that waits on `engagementLoading === true`

Fix: initialize engagement state from the feed item **synchronously** when the list item is created.
