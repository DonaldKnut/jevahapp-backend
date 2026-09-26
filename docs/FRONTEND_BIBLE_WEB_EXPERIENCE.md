# Web Bible — translations + reader experience

**Date:** 2026-09-25  
**Audience:** Web (`https://www.jevahapp.com/bible`)  
**API:** `VITE_API_URL` already includes `/api` (prod: `https://api.jevahapp.com/api`)  
**Auth:** Scripture routes are **public**. No Bearer token.  
**Related:** [FRONTEND_BIBLE_WEB_HANDOFF.md](./FRONTEND_BIBLE_WEB_HANDOFF.md) (older reader notes) · [FRONTEND_BIBLE_TRANSLATIONS_HANDOFF.md](./FRONTEND_BIBLE_TRANSLATIONS_HANDOFF.md) (shared contract) · [FRONTEND_BIBLE_MOBILE_HANDOFF.md](./FRONTEND_BIBLE_MOBILE_HANDOFF.md) (packs — **not** for web)

This is the source of truth for **switching translations on the web** and for building a Bible reader people compare to YouVersion — calm, fast, and honest about what we legally have.

Web must **not** download the mobile gzip pack. Read live chapter APIs. Keep the tab light.

---

## 0. Product rule

One reader. Many translations. The **place** stays put when the version changes.

```
John 3:16 in WEB  →  user taps KJV  →  still John 3:16, new words
```

Do not bounce them to Genesis 1. Do not remount the whole page. Swap the verse column, keep scroll intent, highlight the same verse.

Default translation is **`web`** (World English Bible). Always send `?translation=` in lowercase after the catalog loads.

---

## 1. Translations we have now

The picker is **not** a hardcoded list. Call the catalog. Only show rows the API returns with a real `verseCount`.

### 1.1 What the API can serve today (public domain)

These ids are first-class. If they are imported in Mongo, they appear in `GET /api/bible/translations` and every scripture route accepts them.

| `id` (send this) | Chip | Full name | Voice | Why it is on Jevah |
|------------------|------|-----------|-------|--------------------|
| `web` | WEB | World English Bible | Modern public-domain English | **Default.** Clean default for new users. |
| `kjv` | KJV | King James Version | Classic “thee / thou” | People search for this by name. |
| `bsb` | BSB | Berean Standard Bible | Contemporary, readable | Closest “modern study” feel we can ship without a license. |
| `asv` | ASV | American Standard Version | Formal, early 20th c. | Precision readers. |
| `ylt` | YLT | Young's Literal Translation | Very literal | Word-study crowd. |
| `darby` | DARBY | Darby Translation | Formal | Historical / study. |
| `drb` | DRB | Douay-Rheims Bible | Catholic English (66 shared books) | Catholic users who want a historic text. |

`web` is `isDefault: true`. Sort the picker: default first, then abbreviation.

### 1.2 What you may see but must not treat as live text

These exist in metadata as **`license: "licensed"`**. We do **not** have a full-text grant yet. If they appear in the catalog with `verseCount: 0`, **hide the chip**. If someone deep-links `?translation=niv` and the corpus is missing, the API returns **404** `UNKNOWN_TRANSLATION`.

| `id` | Name | UI |
|------|------|----|
| `niv` | New International Version | “Coming soon” only if you want a teaser — never fetch chapters |
| `esv` | English Standard Version | Same |
| `nlt` | New Living Translation | Same |
| `amp` | Amplified Bible | Same |
| `nasb` | New American Standard Bible | Same |

Do not scrape Bible Gateway or YouVersion to fill these. The reader stays legal.

### 1.3 License field

| `license` | Meaning for web |
|-----------|-----------------|
| `public-domain` | Full text. Show in picker. Cache hard. |
| `permissive` | Full text if `verseCount > 0`. Same UX as public-domain. |
| `licensed` | Do not read verses unless `verseCount > 0` (it will not be, today). |

Ignore `offline` and `packBytes` on web. Those are mobile pack flags.

---

## 2. How to consume translations

### 2.1 Boot the picker

```http
GET /api/bible/translations
```

```json
{
  "success": true,
  "count": 7,
  "data": {
    "defaultId": "web",
    "translations": [
      {
        "id": "web",
        "abbreviation": "WEB",
        "name": "World English Bible",
        "language": "en",
        "languageName": "English",
        "license": "public-domain",
        "offline": false,
        "packBytes": null,
        "verseCount": 31102,
        "isDefault": true,
        "corpusVersion": "a1b2c3d4e5f6",
        "code": "WEB",
        "count": 31102
      }
    ]
  }
}
```

- `data` is an **object**, not an array. Read `data.defaultId` and `data.translations[]`.
- Persist `id` in `localStorage` (e.g. `jevah.bible.translation`).
- First visit: use `defaultId` (`web`).
- Catalog 500 → hide the picker, omit `?translation=`, WEB still serves.
- Filter: `license !== "licensed" && verseCount > 0`.

`corpusVersion` is an opaque fingerprint. Append it as `?v=` on scripture reads so the CDN can cache a year. When we re-import a corpus, `v` changes and stale edges die.

```
GET /api/bible/books/John/chapters/3/verses?translation=kjv&v=a1b2c3d4e5f6
```

If `corpusVersion` is `null`, omit `v`.

### 2.2 Every scripture call takes the same query

`?translation=kjv` (lowercase). Omitted → `web`. Unknown / not imported → **404**

```json
{
  "success": false,
  "error": "Unknown translation",
  "message": "Unknown translation",
  "code": "UNKNOWN_TRANSLATION"
}
```

UI: toast “That version isn’t available”, fall back to `defaultId`, rewrite the URL.

| Action | Request |
|--------|---------|
| Chapter (the reader) | `GET /api/bible/books/John/chapters/3/verses?translation=kjv` |
| Whole book (prefetch optional) | `GET /api/bible/books/John/verses?translation=kjv` |
| One verse (share card) | `GET /api/bible/books/John/chapters/3/verses/16?translation=kjv` |
| Range (copy Romans 8:28–30) | `GET /api/bible/verses/range/Romans%208:28-30?translation=kjv` |
| Search | `GET /api/bible/search?q=love&limit=50&offset=0&translation=kjv` |
| Verse of the day | `GET /api/bible/verses/daily?translation=kjv` |
| Random | `GET /api/bible/verses/random?translation=kjv` |
| Popular | `GET /api/bible/verses/popular?limit=10&translation=kjv` |

Verse JSON always includes `"translation": "kjv"` (public id). Render that; do not trust a stale store.

Books / chapter **lists** do not need `?translation=` (66-book shape is shared). The chapter **body** does.

Book names in the URL must match the API: `Psalms` not `Psalm`, `Song of Solomon`, `1 Corinthians`. Encode spaces.

### 2.3 Change-translation algorithm (do this exactly)

User is on `/bible/John/3?verse=16&translation=web` and picks KJV.

1. Write `kjv` to `localStorage`.
2. Replace the query: `?translation=kjv&verse=16` (keep book + chapter).
3. Fetch `.../John/chapters/3/verses?translation=kjv` (and `v=` if you have it).
4. Keep a skeleton of the old verses until the new JSON lands (no blank flash).
5. Re-highlight verse 16. Scroll it into view if it left the viewport.
6. If KJV 404s, revert to previous id and show the error code.

Compare mode (best-in-class, v1.5): split pane WEB \| BSB on the same reference. Two fetches, same `book` / `chapter` / `verse`. Do not invent a compare API.

### 2.4 Client sketch

```ts
const API = import.meta.env.VITE_API_URL

type Translation = {
  id: string
  abbreviation: string
  name: string
  license: "public-domain" | "permissive" | "licensed"
  verseCount: number
  isDefault: boolean
  corpusVersion: string | null
}

function usable(t: Translation) {
  return t.license !== "licensed" && t.verseCount > 0
}

async function loadCatalog(): Promise<{ defaultId: string; translations: Translation[] }> {
  const r = await fetch(`${API}/bible/translations`)
  const body = await r.json()
  const data = body.data as { defaultId: string; translations: Translation[] }
  return {
    defaultId: data.defaultId,
    translations: data.translations.filter(usable),
  }
}

function scriptureQs(translation: string, corpusVersion?: string | null) {
  const q = new URLSearchParams({ translation })
  if (corpusVersion) q.set("v", corpusVersion)
  return q.toString()
}

async function getChapter(book: string, chapter: number, translation: string, v?: string | null) {
  const path = `/bible/books/${encodeURIComponent(book)}/chapters/${chapter}/verses`
  const r = await fetch(`${API}${path}?${scriptureQs(translation, v)}`)
  const body = await r.json()
  if (!r.ok) throw body
  return body.data as Array<{ verseNumber: number; text: string; translation: string }>
}
```

CORS is already open for `https://www.jevahapp.com` and Vite. `credentials` not required for these GETs.

---

## 3. Routes the web should ship

| Route | Job |
|-------|-----|
| `/bible` | Today’s verse, continue reading, OT/NT book grid, translation chip |
| `/bible/:book/:chapter` | The reader |
| `/bible/:book/:chapter/:verse` | Same reader, verse highlighted |
| `/bible/search?q=` | Hits that jump to a chapter |
| `/bible/compare/:book/:chapter` | Optional: two translations |

Share URL must carry the version:

```
https://www.jevahapp.com/bible/John/3?verse=16&translation=kjv
```

Copy-as-text:

```
John 3:16 (KJV)
For God so loved the world…
```

Always append the abbreviation. Never paste a verse without saying which Bible it is.

---

## 4. How to give a best-in-class Bible experience

This is the product, not the fetch. YouVersion wins on **place, type, and stillness**. Match that.

### 4.1 The reader chrome (cinematic, not a CMS)

- **One header:** book · chapter · translation chip. Three taps, not a settings dump.
- **Translation chip** shows `WEB` / `KJV` / `BSB`. Tap → sheet: abbreviation, full name, one-line voice (“Modern English”, “Classic 1611”). Checkmark on the current id.
- **Verse column** is the hero. Large measure (`max-w-[42rem]`), generous leading (1.7–1.85), warm off-white or Jevah dark (`#0a1f1c`) with `#e4ebe9` text. Verse numbers are quiet superscripts, not shouting badges.
- **No ads, no related videos, no “upgrade to NIV” modal** in the column. A licensed teaser belongs in the picker footer, once.

### 4.2 Stay in the passage

- Prev / next chapter from `GET /api/bible/books` `order` + `chapterCount`.
- Swipe or `←` `→` on desktop.
- Remember `{ book, chapter, verse, translation }` as “continue reading” on `/bible`.
- Deep links open the same place on phone and laptop.

### 4.3 Translation as a teaching tool

- Picker helper copy, not just acronyms:

  | Chip | One line under the name |
  |------|-------------------------|
  | WEB | Clear modern English. Our default. |
  | BSB | Contemporary, close to today’s study Bibles. |
  | KJV | The classic English many churches still read. |
  | ASV | Formal, word-for-word. |
  | YLT | Extremely literal. Best beside another version. |
  | DARBY | 19th-century formal English. |
  | DRB | Historic Catholic English. |

- Optional **compare**: WEB beside BSB or KJV. Same verse highlight in both columns.
- Do not auto-play audio we do not have. No fake “listen in NIV”.

### 4.4 Search that feels like scripture, not a CMS grep

- Debounce 250ms. `GET /api/bible/search?q=&translation=`.
- Hits show **book chapter:verse**, snippet, and the chip of the active translation.
- Click → reader with highlight. Back returns to the hit list.
- Empty query → popular verses in that translation, not a blank page.

### 4.5 Home that invites opening the book

`GET /api/bible/verses/daily?translation=` (respect the saved version).

- Large verse, reference, chip, **Read chapter** CTA.
- Continue-reading card if they have a place.
- OT / NT book grid from `GET /api/bible/books` (`testament`, `name`, `chapterCount`).
- Optional fact: `GET /api/bible-facts/daily` — beside the first fold, never on top of John 3.

### 4.6 Performance (this is part of “best”)

- React Query / SWR. Scripture is immutable. `staleTime` can be hours.
- Prefetch next chapter after idle.
- `?v=corpusVersion` so repeat visits hit the CDN.
- Whole-book `.../books/John/verses` is large (~up to 1.5MB). Use it to prefetch, not for first paint. First paint = one chapter.
- Do not Redis-cache on the client by inventing a second store. Memory + HTTP cache is enough.

### 4.7 Accessibility and reverence

- `lang="en"`. Translation name in the document title: `John 3 (KJV) · Jevah`.
- Focus the verse when the URL has `verse=`.
- Respect `prefers-reduced-motion` (no verse-number animations).
- Contrast that works at 6am in bed and at noon in church.
- Tap a verse → select / share / copy. Do not open a noisy drawer on every tap.

### 4.8 Honesty

- If a version is not in the catalog, it does not exist in the product.
- If search in YLT feels sparse, that is the translation, not a bug — keep the empty state calm.
- DRB is the 66-book Protestant canon we store, not a full Catholic deuterocanon. Do not advertise “Catholic Bible complete” unless the catalog later says so.

---

## 5. What not to build on web

| Skip | Why |
|------|-----|
| `GET /api/bible/translations/:id/pack` | Mobile offline pack. Wastes RAM in a tab. |
| Hardcoded NIV / ESV chips that fetch chapters | 404 + legally wrong |
| A second Bible database in IndexedDB | Catalog + chapter cache is enough |
| Treating `data` as an array | It is `{ defaultId, translations[] }` |
| Calling `/bible` without `/api` | Same 404 as a broken login base URL |
| Auto-switching translation from the user’s OS locale | All current corpora are English |

---

## 6. Suggested UI build order

1. **Reader** — `/bible/:book/:chapter` + WEB verses + prev/next.  
2. **Catalog chip** — `GET /translations`, persist id, refetch same chapter.  
3. **Deep links + share** — `translation` + `verse` in the URL.  
4. **Home** — daily verse in the saved translation + book grid.  
5. **Search** — scoped to the active translation.  
6. **Compare** — WEB \| second version.  
7. Licensed “coming soon” row — only after legal says we may tease NIV/ESV.

---

## 7. Checklist against production

- [ ] Catalog → only `verseCount > 0` public-domain (or permissive) rows in the picker  
- [ ] Default `web`; localStorage remembers the last id  
- [ ] Changing translation does **not** change book/chapter/verse  
- [ ] Chapter, search, daily, range, and share all send `?translation=`  
- [ ] 404 `UNKNOWN_TRANSLATION` falls back to `web`  
- [ ] Share text includes `(KJV)` / `(WEB)` / …  
- [ ] `?v=corpusVersion` on chapter reads when the catalog provides it  
- [ ] No pack download, no licensed full text  
- [ ] Title, type, and stillness feel like a Bible — not an admin table  

The translations we can stand on today are WEB, KJV, BSB, ASV, YLT, DARBY, and DRB. The experience is keeping someone in John 3 while those words change — fast, legal, and quiet enough to read in the morning.
