# Mobile handoff — Bible (Expo / Lite)

**Date:** 2026-08-16  
**Audience:** `jevahapp-frontend` (`bibleApiService.ts`, `bibleCache.ts`, `bibleTranslations.ts`, `BibleTranslationPicker.tsx`, `BibleReaderScreen.tsx`)  
**API:** `https://api.jevahapp.com/api`  
**Status:** Phase 1 is done on both sides. Phase 2 pack **code** is on the API; the WEB file is on CDN only after Contabo runs `npm run bible:pack`. Until then catalog is `offline: false` and pack routes 404 — that is expected.

---

## Do you need to change mobile?

**Phase 1 — no.** Keep what you already shipped:

- Picker reads `data.defaultId` + `data.translations[]` (not a `{ code, name }` array).
- Cache + last-read keyed by `translationId`.
- `?translation=` only after catalog 200. Catalog 404/500 → hide picker, omit the query (corpus is still WEB).
- Manifest 404 → stay on live chapter APIs. No download UI while `offline: false`.

**Phase 2 — yes, one feature.** Implement pack download + local chapter reads when `offline: true`. Do **not** wait for a second catalog shape; the catalog you already parse is the signal.

Ship the download path now. While the pack job has not run, `offline` stays false and nothing downloads. After the job, the same picker grows a download affordance.

Do **not** change: SQLite, local FTS, NIV packs, or downloading through the API process.

---

## Signal: when to download

From `GET /api/bible/translations`:

| Field | Mobile |
|-------|--------|
| `offline: false` / `packBytes: null` | Hide download. Reader stays on `GET .../verses?translation={id}`. |
| `offline: true` + `packBytes` | Show “Download ~X MB”. |
| `license: "licensed"` | Never download. NIV/ESV/NLT stay online-only (or hidden). |
| Lite + `packBytes > 12_000_000` | Do not download. Backend also 400s if you try. |

Lite: **one pack on disk**. A new download deletes the previous translation’s pack.

---

## Download flow (Phase 2)

```text
catalog 200, item.offline === true
  → GET /api/bible/translations/{id}/manifest
  → if 404 Pack unavailable: stay live (same as today)
  → if 403 Translation requires license: no pack UI
  → if 200: compare data.packVersion / contentHash to disk
  → if newer or missing: GET data.packUrl (CDN). Follow 302 from
    GET /api/bible/translations/{id}/pack if you must; prefer packUrl
    so Contabo is not in the byte path.
  → gunzip → JSON
  → verify schema === "jevah-bible-pack-v1"
  → sha256(uncompressed utf8) === contentHash without the "sha256-" prefix
      (or compare to the full "sha256-" + hex string)
  → persist gzip or inflated JSON keyed by translationId + packVersion
```

Hash mismatch → delete local pack, fall back to live verses, toast “Download again”.

Do not `GET` the pack endpoint expecting a gzip body from Node. It **302s** to R2.

Lite header on pack/manifest (optional; FE size check is enough):

```http
X-Jevah-Client: lite
```

---

## Read path after install

Chapter key is **`{bookName}:{chapterNumber}`** — same spelling as the live API (`"Song of Solomon"`, `"John"`, `"Genesis:1"`).

```ts
const rows = pack.chapters[`${bookName}:${chapterNumber}`]; // [{ v, t }]
```

| Event | Read from |
|-------|-----------|
| Pack installed for this `translationId` | `chapters["John:3"]` — no verse API |
| No pack / hash fail / `offline: false` | `GET /api/bible/books/John/chapters/3/verses?translation=web` |
| Switch translation | Swap cache/pack. Last-read is per id. |
| Search | Still `GET /api/bible/search?q=…&translation=web`. Do not FTS the pack on Lite. |
| Online SWR | Optional: re-fetch manifest; if `packVersion` bumped, re-download. |

Listen / TTS stays `expo-speech`. No audio in the pack.

---

## Errors (copy these strings)

| Status | `error` | FE |
|--------|---------|-----|
| 404 | `Unknown translation` | Only send ids from catalog |
| 404 | `Pack unavailable` | Live APIs |
| 403 | `Translation requires license` | No download |
| 400 | `Pack too large for lite` | Skip pack on Lite |

---

## Checklist

- [x] Cache + last-read by `translationId`
- [x] Picker: `data.defaultId` + `data.translations[]`
- [x] `?translation=` only after catalog 200
- [x] Manifest 404 → live verse API
- [ ] When `offline: true`: download `packUrl`, inflate, verify `contentHash`
- [ ] Reader uses `chapters["Book:n"]` when pack is present
- [ ] Lite: one pack; skip if `packBytes > 12e6`
- [ ] Never pack `license: "licensed"`

KJV in the catalog does **not** mean a KJV pack exists. Only download rows with `offline: true`. WEB is the first pack; KJV is a later `bible:pack` run.
