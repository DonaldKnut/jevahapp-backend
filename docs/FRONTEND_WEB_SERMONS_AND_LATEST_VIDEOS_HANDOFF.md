# Frontend handoff — Web sermons catalog + watch + latest videos

**Audience:** Jevah web (browser).  
**Goal:** List sermons, let visitors watch/listen, and show **latest public uploads** — without confusing that with the **admin** console.

Related (do not replace): [FRONTEND_SERMONS.md](./FRONTEND_SERMONS.md), [FRONTEND_SERMON_EBOOK_TABS_HANDOFF.md](./FRONTEND_SERMON_EBOOK_TABS_HANDOFF.md), [FRONTEND_MODERATION.md](./FRONTEND_MODERATION.md), [FRONTEND_ADMIN.md](./FRONTEND_ADMIN.md).

---

## Product split (read this first)

| Surface | Who | Sees | API |
|---------|-----|------|-----|
| **Public web — Sermons** | Anyone (browser) | Only **approved + playable** sermons | `/api/sermons*` |
| **Public web — Latest / explore** | Anyone | Only **live** gospel media (videos, sermons, …) | `/api/media/public/all-content` |
| **Admin — Moderation** | Staff | Held / gray / rejected uploads + AI evidence | `/api/admin/moderation/*` |
| **Admin — All media library** | Staff | **Everything** (pending, under_review, approved, rejected) | `/api/admin/media/*` |

**Recommendation:** keep both.

1. **Public pages** (`/sermons`, `/watch/:id`, `/explore` or home “Latest”) — marketing + discovery. Never show pending/rejected.
2. **Admin** — ops. Separate login. Use for review queue **and** a “All platform media” library (search/filter by status). Do **not** put pending AI holds on the public site.

Admin already has:

- Queue: `GET /api/admin/moderation/queue`
- Recent: `GET /api/admin/media/recent`
- Search: `GET /api/admin/media/search?…`

Public “latest videos” is **not** a duplicate of admin — it is the visitor-facing feed of what is already live.

---

## 1. List sermons (browser catalog)

**No auth required.**

```http
GET /api/sermons?page=1&limit=20
GET /api/sermons?search=faith&series=Faith%20Under%20Fire&topic=prayer&language=en
GET /api/sermons?cursor=<nextCursor>&limit=20
```

| Query | Notes |
|-------|--------|
| `page`, `limit` | `limit` max **50**. Prefer `cursor` for infinite scroll |
| `search` | Title, speaker, church, series, scripture, description (≥2 chars) |
| `series`, `topic` / `topics`, `language` | Facet filters |
| `cursor` | Opaque; when set, `page` is ignored |

### Response

```json
{
  "success": true,
  "data": {
    "items": [ /* SermonCard — only rows with playbackUrl */ ],
    "total": 42,
    "limit": 20,
    "nextCursor": "…",
    "hasMore": true,
    "pagination": { "page": 1, "limit": 20, "total": 42, "pages": 3 }
  }
}
```

Empty catalog → `items: []`, `success: true` (not an error).

### Featured + facets

```http
GET /api/sermons/featured
GET /api/sermons/topics
```

Use featured for the hero shelf; topics for filter chips.

---

## 2. Sermon card shape (watch UI)

```ts
type SermonCard = {
  id: string;
  title: string;
  speaker: string | null;
  church: string | null;
  description: string | null;
  scripture: string | null;
  series: string | null;
  duration: number | null;      // seconds
  durationSec: number | null;   // same
  thumbnailUrl: string | null;
  playbackUrl: string | null;   // MP4 or audio — prefer for <video>/<audio>
  hlsUrl: string | null;        // optional HLS
  mediaType: "audio" | "video";
  category: string | null;
  language: string | null;
  topics: string[];
  publishedAt: string | null;
  playCount: number;
  likeCount: number;
  processingStatus: string;
  moderationStatus: string;     // public list is always approved-class
  contentType: "sermon";
};
```

### Detail

```http
GET /api/sermons/:id
```

Same card shape (or 404 if not public/playable).

---

## 3. Watch / listen in the browser

```tsx
function SermonPlayer({ item }: { item: SermonCard }) {
  if (item.mediaType === "audio") {
    return (
      <audio controls preload="metadata" src={item.playbackUrl ?? undefined} />
    );
  }
  // Prefer progressive MP4 for simple web; use hls.js only if you already ship it
  const src = item.playbackUrl || item.hlsUrl;
  return (
    <video
      controls
      playsInline
      preload="metadata"
      poster={item.thumbnailUrl ?? undefined}
      src={src ?? undefined}
    />
  );
}
```

Rules:

- Branch on **`mediaType`**, not the tab name.
- Prefer **`playbackUrl`** (MP4/audio). Use `hlsUrl` only with an HLS player.
- If `playbackUrl` is null, do not render a broken player — hide or show “Processing”.
- Signed URLs can expire: on media error, re-fetch `GET /api/sermons/:id` and swap `src`.

Optional engagement (auth Bearer): likes / views / comments from [FRONTEND_ENGAGEMENT.md](./FRONTEND_ENGAGEMENT.md) — map sermon → content type **`media`**.

---

## 4. Example: `/sermons` page

```ts
// list
const res = await fetch(
  `${API_BASE}/api/sermons?page=${page}&limit=20`
).then((r) => r.json());
const items = res.data.items as SermonCard[];

// infinite scroll
const next = await fetch(
  `${API_BASE}/api/sermons?cursor=${encodeURIComponent(res.data.nextCursor)}&limit=20`
).then((r) => r.json());
```

Suggested layout:

1. Hero: `GET /api/sermons/featured`
2. Grid/list: `GET /api/sermons`
3. Click card → `/sermons/[id]` → `GET /api/sermons/:id` + player
4. Filters: series / topic / language from `GET /api/sermons/topics`

---

## 5. Public “Latest on Jevah” (all live media, not sermons-only)

For a home / explore “Latest uploads” shelf that includes **videos + sermons** (anything live):

```http
GET /api/media/public/all-content?page=1&limit=20
GET /api/media/public/all-content?profile=lite&limit=12
```

- Recency-ordered global feed.
- Only content that passed moderation and is publication-live.
- Optional Bearer overlays `isLiked` / save flags.

Sermons-only catalog stays on `/api/sermons`. Do not mix admin pending items into this shelf.

Also useful:

```http
GET /api/media/public/search?q=grace&contentType=videos
GET /api/media/default?contentType=sermon&page=1&limit=12
```

---

## 6. Admin: see everything (including non-public)

Staff JWT + admin role.

| Need | Call |
|------|------|
| AI / human review queue | `GET /api/admin/moderation/queue` |
| One item + AI case | `GET /api/admin/moderation/:id` |
| Latest uploads (any status) | `GET /api/admin/media/recent` |
| Search all platform media | `GET /api/admin/media/search?q=…&moderationStatus=…&contentType=…` |
| Decide | `PATCH /api/admin/moderation/:id/status` |

Public web **must not** call these. Keep `/admin/*` on the admin app (or gated route).

---

## 7. What appears where (visibility)

A sermon/video is on **public** `/api/sermons` or public feed only when roughly:

- `moderationStatus === "approved"`
- not hidden
- publication live (not draft/staged/tombstoned)
- has a playable URL

Under review / rejected / staging → **admin only**. That is intentional so the AI regulator can auto-reject secular/unsafe uploads without them leaking onto the marketing site.

---

## 8. Web checklist

- [ ] `/sermons` lists from `GET /api/sermons` (`data.items`)
- [ ] Detail + player from `GET /api/sermons/:id`
- [ ] `mediaType === "audio"` → `<audio>`; else `<video>`
- [ ] Featured shelf from `/api/sermons/featured`
- [ ] Optional home “Latest” from `/api/media/public/all-content`
- [ ] Admin “All media” uses `/api/admin/media/*` — separate from public
- [ ] Never render pending/rejected on public pages

---

## 9. Upload note (creators → catalog)

Sermons use Media staged upload with `contentType: "sermon"`. After AI/admin **approve** + processing ready, they appear on `/api/sermons`. Details: [FRONTEND_SERMONS.md](./FRONTEND_SERMONS.md) ingest section + [FRONTEND_UPLOAD_PROGRESS_HANDOFF.md](./FRONTEND_UPLOAD_PROGRESS_HANDOFF.md).
