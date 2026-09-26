# Frontend handoff — Sermon / Music / E-book tabs

**Symptom (QA screenshot):** red text  
`Missing queryFn: '["default-content",1,12,"sermon"]'`

**Owner:** mobile/web client (TanStack Query). The request never hit the API.

---

## What the issue is

The Sermon tab (and likely Music / E-book if they share the same hook) registers a React Query key:

```ts
["default-content", page, limit, contentType]
// e.g. ["default-content", 1, 12, "sermon"]
```

but does **not** pass a `queryFn`. TanStack Query then throws `Missing queryFn` and renders that string instead of a list.

This is not a 404, auth, or empty-catalog problem. No network call is made.

Typical causes:

1. `useQuery({ queryKey })` with no `queryFn`.
2. A `queryOptions` / `queryFn` map that handles `videos` but not `sermon` / `music` / `ebook`.
3. Prefetch / `ensureQueryData` with the same key and no fetcher.

---

## How to resolve

Prefer the **typed catalog endpoints** (recommended). They return playable cards with `contentType` already set.

| Tab | Call | List path |
|-----|------|-----------|
| **Sermon** | `GET /api/sermons?page=1&limit=12` | `data.items` |
| **E-book** | `GET /api/ebooks?page=1&limit=12` | `data.items` |
| **Music** | `GET /api/music/tracks?page=1&limit=12` | `data` / `data.tracks` (existing music browse) |

Fallback (legacy default/onboarding list):

```http
GET /api/media/default?contentType=sermon&page=1&limit=12
```

Same for `music` and `ebook` / `books`. List path: **`data.content`**.

`contentType` aliases the backend already accepts: `sermon`/`sermons`, `ebook`/`books`, `music`/`audio`.

### Example — Sermon tab

```ts
useQuery({
  queryKey: ["sermons", page, limit],
  queryFn: async () => {
    const res = await api.get("/api/sermons", { params: { page, limit } });
    return res.data.data; // { items, total, pagination }
  },
});
```

Render `data.items`. Play with `playbackUrl` (video or audio — see `mediaType`).

### Example — E-book tab

```ts
useQuery({
  queryKey: ["ebooks", page, limit],
  queryFn: async () => {
    const res = await api.get("/api/ebooks", { params: { page, limit } });
    return res.data.data; // { items, total, pagination }
  },
});
```

Render `data.items`. Open PDF via `fileUrl` / `pdfUrl`. **Do not** pass those URLs into the video player.

### If you keep the `default-content` key

You must attach a fetcher for every tab type:

```ts
useQuery({
  queryKey: ["default-content", page, limit, tab], // tab = "sermon" | "music" | "ebook"
  queryFn: async () => {
    const res = await api.get("/api/media/default", {
      params: { contentType: tab, page, limit },
    });
    return res.data.data.content;
  },
});
```

Do not `useQuery({ queryKey })` without `queryFn`.

---

## Response shapes (prod, live)

### `GET /api/sermons`

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "…",
        "title": "Control Your Thoughts - Pastor Chris",
        "contentType": "sermon",
        "mediaType": "audio",
        "playbackUrl": "https://…/….mp3",
        "hlsUrl": null,
        "thumbnailUrl": "https://…",
        "duration": 2597.2,
        "processingStatus": "ready",
        "moderationStatus": "approved"
      }
    ],
    "total": 6,
    "pagination": { "page": 1, "limit": 12, "total": 6, "pages": 1 }
  }
}
```

`mediaType` is `"audio"` or `"video"`. Use audio player vs video player from that field — not from the tab name alone.

### `GET /api/ebooks`

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "…",
        "title": "Fasting - Jentezen Franklin",
        "contentType": "ebook",
        "fileUrl": "https://…/….pdf",
        "pdfUrl": "https://…/….pdf",
        "thumbnailUrl": "https://…",
        "processingStatus": "ready",
        "moderationStatus": "approved"
      }
    ],
    "total": 3,
    "pagination": { "page": 1, "limit": 12, "total": 3, "pages": 1 }
  }
}
```

### `GET /api/media/default?contentType=sermon`

```json
{
  "success": true,
  "data": {
    "content": [ /* cards */ ],
    "pagination": { "page": 1, "limit": 12, "total": n, "pages": n }
  }
}
```

**Gotcha:** this endpoint maps `contentType` through `mapContentType()`:

| Mongo type | Field on `data.content[]` |
|------------|---------------------------|
| `sermon` / `videos` | `"video"` |
| `music` / `audio` | `"audio"` |
| `ebook` / `books` | `"image"` |

Do **not** client-filter `item.contentType === "sermon"` after this call — it will never match. Prefer `/api/sermons` and `/api/ebooks`, where `contentType` stays `"sermon"` / `"ebook"`.

---

## Visibility / empty states

Public catalogs only return approved (or HQ default) playable items.

| Field | Show card if |
|-------|----------------|
| `moderationStatus` | `"approved"` (missing key used to hide cards — backend now always emits it) |
| `processingStatus` | `"ready"` for playback; HQ files are seeded ready |
| `playbackUrl` / `fileUrl` | http(s) URL present |

Empty list ⇒ empty state, not `Missing queryFn`. If you still see `Missing queryFn`, the fetcher is still undefined.

---

## Checklist

- [ ] Sermon tab: `queryFn` → `GET /api/sermons` → render `data.items`
- [ ] E-book tab: `queryFn` → `GET /api/ebooks` → render `data.items` as PDF, not video
- [ ] Music tab: existing music browse `queryFn` (do not reuse a videos-only fetcher)
- [ ] Do not put ebook `fileUrl` / sermon MP3 into `videoUrl` / Expo video
- [ ] Prefetch / infinite-query keys for these tabs also include `queryFn`
- [ ] QA: Sermon / Music / E-book each show a list; no red `Missing queryFn`

Auth is optional on these GETs. Send `Authorization: Bearer` when logged in so likes/saves overlay if the client uses the same cards elsewhere.
