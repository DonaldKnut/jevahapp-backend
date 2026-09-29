# Frontend handoff — Web ebooks: list, display, and read

**Audience:** Jevah web (browser).  
**Goal:** Fetch the public ebook catalog, show covers/titles, and let visitors **read** PDFs (and optionally extract text / listen via TTS).

Related: [FRONTEND_SERMON_EBOOK_TABS_HANDOFF.md](./FRONTEND_SERMON_EBOOK_TABS_HANDOFF.md), [FRONTEND_WEB_SERMONS_AND_LATEST_VIDEOS_HANDOFF.md](./FRONTEND_WEB_SERMONS_AND_LATEST_VIDEOS_HANDOFF.md).

---

## What an ebook is

Ebooks live in the **Media** collection with `contentType: "ebook"` or `"books"`.  
Public catalog: **`GET /api/ebooks`** (approved + playable PDF only).

**Never** put `fileUrl` / `pdfUrl` into a `<video>` player. Use a PDF viewer or extracted text UI.

---

## 1. List ebooks (catalog grid)

**No auth required** (optional Bearer for likes/saves elsewhere).

```http
GET /api/ebooks?page=1&limit=20
GET /api/ebooks?search=fasting&topic=prayer&page=1&limit=12
```

| Query | Notes |
|-------|--------|
| `page`, `limit` | `limit` max **50**, default 20 |
| `search` | Title / description (≥2 chars) |
| `topic` / `topics` | Facet filter |

### Response

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "…",
        "title": "Fasting - Jentezen Franklin",
        "description": "…",
        "thumbnailUrl": "https://…",
        "fileUrl": "https://…/….pdf",
        "pdfUrl": "https://…/….pdf",
        "authorName": "…",
        "category": "teachings",
        "topics": [],
        "publishedAt": "2026-…",
        "readCount": 12,
        "likeCount": 3,
        "processingStatus": "ready",
        "moderationStatus": "approved",
        "contentType": "ebook"
      }
    ],
    "total": 3,
    "page": 1,
    "limit": 20,
    "pagination": { "page": 1, "limit": 20, "total": 3, "pages": 1 }
  }
}
```

Empty catalog → `items: []`, `success: true` (not an error).

### Card type

```ts
type EbookCard = {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  fileUrl: string | null;   // PDF — use for reading
  pdfUrl: string | null;    // same URL as fileUrl
  authorName: string | null;
  category: string | null;
  topics: string[];
  publishedAt: string | null;
  readCount: number;
  likeCount: number;
  processingStatus: string;
  moderationStatus: string;
  contentType: "ebook";
};
```

`fileUrl` and `pdfUrl` are the **same PDF**. Prefer either; both are http(s) when listed.

### Example fetch

```ts
async function fetchEbooks(page = 1, limit = 20, search?: string) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (search?.trim()) params.set("search", search.trim());

  const res = await fetch(`${API_BASE}/api/ebooks?${params}`);
  const json = await res.json();
  return json.data as {
    items: EbookCard[];
    total: number;
    pagination: { page: number; limit: number; total: number; pages: number };
  };
}
```

Render `data.items` as a grid (cover = `thumbnailUrl`, title, author). Click → reader route `/ebooks/[id]`.

---

## 2. Read on the web (primary path: PDF viewer)

Best UX for browsers: open the PDF URL in an embedded viewer.

```tsx
function EbookReader({ ebook }: { ebook: EbookCard }) {
  const pdf = ebook.fileUrl || ebook.pdfUrl;
  if (!pdf) return <p>This book is not available yet.</p>;

  return (
    <iframe
      title={ebook.title}
      src={pdf}
      className="w-full min-h-[80vh] rounded border-0"
    />
  );
}
```

Alternatives:

| Approach | When |
|----------|------|
| `<iframe src={pdfUrl}>` | Simplest; works for most R2 public PDFs |
| `react-pdf` / PDF.js | Custom page UI, zoom, page numbers |
| `window.open(pdfUrl)` | “Open in new tab” fallback |

**CORS / download:** if the iframe is blank, R2 may block embedding — use “Open PDF” link, or proxy via text extract below. Prefer fixing bucket CORS/`Content-Disposition: inline` for PDFs.

Signed URLs expire: if load fails, re-fetch the list/detail card and swap `src`.

### Where to get the card for `/ebooks/[id]`

There is **no** dedicated `GET /api/ebooks/:id` catalog detail today. Options:

1. **From list cache** — navigate with the card you already loaded.  
2. **Re-list / search** — `GET /api/ebooks?search=…` and find by `id`.  
3. **Text API** — `GET /api/ebooks/text?contentId=:id` proves the id exists and yields pages (see §3).  
4. **Generic media** (auth/public as applicable) — `GET /api/media/public/:id` if your client already uses media detail for mixed content.

Recommended web flow: list → store card in route state / React Query → reader uses `fileUrl`.

---

## 3. Optional: paginated text reader (no PDF chrome)

Extract per-page text for an in-app reader (or TTS prep).

```http
GET /api/ebooks/text?contentId=<ebookId>
GET /api/ebooks/text?contentId=<ebookId>&normalize=true
GET /api/ebooks/text?url=https://…/book.pdf
```

| Param | Notes |
|-------|--------|
| `contentId` | Media id from catalog `items[].id` |
| `url` | Direct PDF URL (alternative to contentId) |
| `normalize` | `true` — Gemini cleanup for TTS (slower; needs API key on server) |

### Response

```json
{
  "success": true,
  "data": {
    "title": "…",
    "totalPages": 120,
    "pages": [
      { "page": 1, "text": "Chapter one…" },
      { "page": 2, "text": "…" }
    ]
  }
}
```

```tsx
function TextReader({ ebookId }: { ebookId: string }) {
  const [pages, setPages] = useState<{ page: number; text: string }[]>([]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch(`${API_BASE}/api/ebooks/text?contentId=${ebookId}`)
      .then((r) => r.json())
      .then((j) => setPages(j.data.pages || []));
  }, [ebookId]);

  const current = pages[page];
  if (!current) return <p>Loading…</p>;

  return (
    <article>
      <pre className="whitespace-pre-wrap font-serif text-lg">{current.text}</pre>
      <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
        Previous
      </button>
      <span>
        {page + 1} / {pages.length}
      </span>
      <button
        disabled={page >= pages.length - 1}
        onClick={() => setPage((p) => p + 1)}
      >
        Next
      </button>
    </article>
  );
}
```

Use **PDF iframe for default “Read”**; use text extract for lightweight / mobile-friendly reading or accessibility.

---

## 4. Optional: listen (TTS)

| Call | Auth | Purpose |
|------|------|---------|
| `GET /api/ebooks/tts/config` | No | Is TTS configured? |
| `GET /api/ebooks/:ebookId/tts?includeTimings=true` | No | Existing audio URL + timings |
| `POST /api/ebooks/:ebookId/tts/generate?voice=female` | No* | Generate listen audio |
| `POST /api/tts/render` | Bearer | Custom pages → render job |

\*Generate may return 503 if the TTS provider is not configured.

Typical flow: open book → `GET …/tts` → if 404, `POST …/tts/generate` → play `audioUrl`. Do not block the PDF reader on TTS.

---

## 5. Suggested web pages

| Route | Data |
|-------|------|
| `/ebooks` | `GET /api/ebooks` → grid of covers |
| `/ebooks/[id]` | PDF reader (`fileUrl`) + title/author from list cache |
| Optional “Read as text” | `GET /api/ebooks/text?contentId=` |
| Optional “Listen” | TTS endpoints above |

### React Query example

```ts
useQuery({
  queryKey: ["ebooks", page, limit, search],
  queryFn: async () => {
    const res = await api.get("/api/ebooks", {
      params: { page, limit, search: search || undefined },
    });
    return res.data.data; // { items, total, pagination }
  },
});
```

---

## 6. Do / don’t

| Do | Don’t |
|----|--------|
| Render PDF via `fileUrl` / `pdfUrl` | Stuff PDF URL into `<video>` |
| Prefer `/api/ebooks` for `contentType: "ebook"` | Filter `GET /api/media/default` for `"ebook"` only (legacy maps books → `"image"`) |
| Show empty state when `items.length === 0` | Treat empty as API failure |
| Re-fetch URL on media load error | Assume signed URLs live forever |

Legacy fallback (avoid if possible):

```http
GET /api/media/default?contentType=ebook&page=1&limit=12
```

List path: `data.content` — and `contentType` on those cards may appear as `"image"`. Prefer `/api/ebooks`.

---

## 7. Visibility

Public list only includes books that are catalog-visible (approved / live) and have a non-staging `fileUrl` or `pdfUrl`. Pending moderation never appears here.

---

## 8. Checklist

- [ ] `/ebooks` → `GET /api/ebooks` → render `data.items`
- [ ] Card shows `thumbnailUrl`, `title`, `authorName`
- [ ] Reader uses `fileUrl` / `pdfUrl` in iframe or PDF.js — **not** video
- [ ] Optional text mode → `GET /api/ebooks/text?contentId=`
- [ ] Optional listen → TTS only if `GET /api/ebooks/tts/config` says available
- [ ] Empty catalog → friendly empty UI

Auth is optional on list + text. Send `Authorization: Bearer` when logged in if you overlay likes/bookmarks via engagement APIs (`contentType: "ebook"`).
