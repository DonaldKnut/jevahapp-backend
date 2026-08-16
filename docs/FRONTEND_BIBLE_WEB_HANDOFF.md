# Web handoff — Bible reader on jevahapp.com

**Date:** 2026-08-16  
**Audience:** Web app (`https://www.jevahapp.com`) — Vite or Next  
**API base:** `https://api.jevahapp.com/api` (must include `/api`; see [FRONTEND_WEB_LOGIN_API_BASE_HANDOFF.md](./FRONTEND_WEB_LOGIN_API_BASE_HANDOFF.md))  
**Auth:** Bible scripture routes are **public**. No Bearer token required.

Web should **not** download the mobile gzip pack. Inflating ~31k verses in the tab is the wrong RAM/UX trade. Use live chapter APIs + a translation picker. Offline packs stay on Expo.

---

## What to build

A YouVersion-lite **online** reader:

1. Header chip: translation (WEB today).
2. Two-pane or stacked: book list → chapter grid → verse column.
3. Search bar → hit list that jumps to a chapter.
4. Home strip: verse of the day + a few popular verses.
5. Optional: reading plans list, Bible facts, share URL `?book=John&chapter=3&verse=16&translation=web`.

Default translation is **`web`** (World English Bible). Omit `?translation=` only if catalog failed; otherwise always send the selected id (lowercase).

---

## Suggested page map

| Route | Purpose |
|-------|---------|
| `/bible` | Today’s verse + continue reading + book grid |
| `/bible/:book/:chapter` | Reader (`/bible/John/3`) |
| `/bible/:book/:chapter/:verse` | Same reader, verse scrolled/highlighted |
| `/bible/search?q=` | Search results |
| `/bible/plans` | Reading plans (static list from API) |

Keep book names in the URL **as the API spells them** (`Song of Solomon`, `1 Corinthians`). Encode spaces.

---

## 1. Boot: catalog

```http
GET /api/bible/translations
```

```json
{
  "success": true,
  "data": {
    "defaultId": "web",
    "translations": [
      {
        "id": "web",
        "abbreviation": "WEB",
        "name": "World English Bible",
        "language": "en",
        "license": "public-domain",
        "offline": false,
        "packBytes": null,
        "verseCount": 31102,
        "isDefault": true
      }
    ]
  }
}
```

- Read **`data.defaultId`** and **`data.translations[]`**. `data` is not an array.
- Persist selected `id` in `localStorage`.
- Catalog 404/500 → hide picker, omit `?translation=`, still read WEB.
- `license: "licensed"` → you may show the chip later; there is no public full text pack. If that id is not in Mongo yet, scripture GETs 404 `Unknown translation`.
- Ignore `offline` / `packBytes` on web (mobile-only).

---

## 2. Navigation: books and chapters (no translation query needed)

Metadata is the same for every translation.

```http
GET /api/bible/books
GET /api/bible/books/testament/old
GET /api/bible/books/testament/new
GET /api/bible/books/John
GET /api/bible/books/John/chapters
GET /api/bible/books/John/chapters/3
```

`GET .../chapters/3` **does** take `?translation=` and returns `actualVerseCount` for that corpus.

Sidebar: split `testament: "old" | "new"`. Use `book.name` as the path segment and `book.chapters` (or chapter list length) for the chapter grid.

404 `{ "message": "Book not found" }` → show a not-found state; do not guess aliases (`Psalm` vs `Psalms` — API is **Psalms**).

---

## 3. Reader: verses (this is the product)

```http
GET /api/bible/books/John/chapters/3/verses?translation=web
```

```json
{
  "success": true,
  "translation": "web",
  "count": 36,
  "data": [
    {
      "_id": "...",
      "bookName": "John",
      "chapterNumber": 3,
      "verseNumber": 16,
      "text": "For God so loved the world...",
      "translation": "web"
    }
  ]
}
```

UI:

- Render `verseNumber` as a quiet superscript + `text`.
- Prev/next chapter: if `chapter === 1`, previous book last chapter; if past last chapter, next book. Book order from `GET /api/bible/books` (`order` field).
- Highlight `?verse=` from the URL.
- Cache the JSON in memory (React Query / SWR). TTL can be hours; scripture does not churn.

Single verse (share / embed):

```http
GET /api/bible/books/John/chapters/3/verses/16?translation=web
```

Range (copy “Romans 8:28–30”):

```http
GET /api/bible/verses/range/Romans%208:28-30?translation=web
```

Invalid reference → 400. Unknown translation → 404 `{ "error": "Unknown translation" }`.

---

## 4. Home widgets

```http
GET /api/bible/verses/daily?translation=web
GET /api/bible/verses/random?translation=web
GET /api/bible/verses/popular?limit=10&translation=web
GET /api/bible/stats
```

Daily payload includes `date` (`YYYY-MM-DD`) and a shaped verse. Cache daily for the calendar day.

`stats` is counts only (`totalBooks`, `totalVerses`, OT/NT splits) — a footer or empty-state line, not a dashboard.

---

## 5. Search

```http
GET /api/bible/search?q=love&limit=50&offset=0&translation=web
GET /api/bible/search?q=love&book=John&translation=web
GET /api/bible/search?q=love&testament=new&translation=web
```

`q` is required. Each hit has `verse` (shaped) plus book/chapter metadata. Click → `/bible/{book}/{chapter}?verse={n}&translation=web`.

Advanced (`GET /api/bible/search/advanced`) is optional AI sugar. Do not block the reader on it. It does **not** currently take `?translation=`.

---

## 6. Extra (nice, not required for v1)

| Endpoint | Use |
|----------|-----|
| `GET /api/bible/reading-plans` | List cards; plans are metadata, not a day-by-day engine |
| `GET /api/bible/books/John/chapters/3/verses/16/commentary` | Side panel (may be empty) |
| `GET /api/bible/books/John/chapters/3/verses/16/cross-references` | Side panel (may be empty) |
| `GET /api/bible-facts/daily` | Home “did you know” |
| `GET /api/bible-facts/random` | Refreshable fact |

Do not put commentary or facts inside the verse column by default.

---

## 7. Client sketch

```ts
const API = import.meta.env.VITE_API_URL; // https://api.jevahapp.com/api

type Catalog = {
  defaultId: string;
  translations: Array<{
    id: string;
    abbreviation: string;
    name: string;
    license: "public-domain" | "permissive" | "licensed";
    isDefault: boolean;
  }>;
};

async function getCatalog(): Promise<Catalog | null> {
  const r = await fetch(`${API}/bible/translations`);
  if (!r.ok) return null;
  const body = await r.json();
  return body.data; // { defaultId, translations }
}

async function getChapterVerses(
  book: string,
  chapter: number,
  translation: string | null
) {
  const q = translation ? `?translation=${encodeURIComponent(translation)}` : "";
  const r = await fetch(
    `${API}/bible/books/${encodeURIComponent(book)}/chapters/${chapter}/verses${q}`
  );
  const body = await r.json();
  if (!r.ok) throw body;
  return body.data as Array<{ verseNumber: number; text: string }>;
}
```

CORS: origin `https://www.jevahapp.com` is already allowed. `credentials` not required for these GETs.

---

## 8. Do not do on web

| Skip | Why |
|------|-----|
| `GET /api/bible/translations/:id/pack` | Mobile offline. ~4MB gzip in a tab is wasted. |
| Local FTS of a pack | Use `/api/bible/search`. |
| NIV/ESV/NLT full text | Licensed. Catalog may list them later as `license: licensed`. |
| Treating `data` as an array | Breaking vs old `{ code, name, count }` list. |
| Calling `/bible/...` without `/api` | 404 / fake CORS (same bug as login). |

---

## 9. Web checklist

- [ ] `VITE_API_URL` / `NEXT_PUBLIC_API_URL` = `https://api.jevahapp.com/api`
- [ ] Catalog → picker; persist `translationId`; hide picker on catalog failure
- [ ] Book list from `GET /api/bible/books` (OT/NT)
- [ ] Chapter reader from `.../verses?translation=`
- [ ] Deep link `/bible/:book/:chapter` + optional verse highlight
- [ ] Search + verse of the day
- [ ] Share copies a URL with `translation`, book, chapter, verse
- [ ] No pack download UI
