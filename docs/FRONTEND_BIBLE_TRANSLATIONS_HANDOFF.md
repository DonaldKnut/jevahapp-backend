# Bible API — shared contract

**Date:** 2026-08-16  
**Backend:** `defaultId` is **`web`** (Mongo `WEB`)  
**Packs:** WEB gzip on R2 after `npm run bible:pack`. Until then `offline: false` and pack routes 404.

Platform how-tos (use these, not this file, to implement UI):

- **Mobile (Expo / Lite, including Phase 2 pack):** [FRONTEND_BIBLE_MOBILE_HANDOFF.md](./FRONTEND_BIBLE_MOBILE_HANDOFF.md)
- **Web (jevahapp.com online reader, no pack):** [FRONTEND_BIBLE_WEB_HANDOFF.md](./FRONTEND_BIBLE_WEB_HANDOFF.md)

---

## Catalog

`GET /api/bible/translations` → `{ success, data: { defaultId, translations[] } }`.

Do not treat `data` as an array.

---

## Scripture

`?translation=web` after catalog 200. Omitted → WEB. Unknown id → 404 `{ "error": "Unknown translation" }`. Verses include `"translation": "web"`.

---

## Pack (mobile only)

`GET /api/bible/translations/:id/manifest`  
`GET /api/bible/translations/:id/pack` → **302** to CDN `packUrl`. Schema `jevah-bible-pack-v1`. Hash is `sha256-` of **uncompressed** JSON.

| Case | Status | `error` |
|------|--------|---------|
| Unknown translation | 404 | `Unknown translation` |
| Pack not built | 404 | `Pack unavailable` |
| Licensed | 403 | `Translation requires license` |
| Lite gzip &gt; 12MB | 400 | `Pack too large for lite` |

Web must not download packs. Search stays `GET /api/bible/search` on both clients.
