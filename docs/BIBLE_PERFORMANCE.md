# Bible Performance — Backend Response

Answers the frontend performance handoff. Application-level items are shipped;
the remaining items are VPS/CDN configuration and are listed with exact steps.

---

## 1. Whole-book endpoint — shipped

```
GET /api/bible/books/:bookName/verses?translation=web
```

```jsonc
{
  "success": true,
  "data": {
    "bookName": "John",
    "translation": "web",
    "chapters": [
      { "chapterNumber": 1, "verses": [{ "verseNumber": 1, "text": "..." }] }
    ]
  }
}
```

- Unknown book → `404 { "success": false, "message": "Book not found" }`.
- Unknown translation → `404 { "success": false, "error": "Unknown translation" }`.
- One indexed Mongo read, grouped in memory. Chapters and verses are sorted
  ascending.
- Deliberately **not** stored in Redis: a whole book is up to ~1.5 MB
  uncompressed, so repeat traffic is meant to be absorbed by the CDN via the
  immutable headers below rather than by application memory.

The per-chapter route (`/books/:book/chapters/:n/verses`) still works and is
unchanged for older clients.

## 2. Cache headers + ETag — shipped, with one change to the ask

**Please read this section — it needs a small client change to get the full win.**

`max-age=31536000, immutable` is only honest when the URL changes whenever the
content does. `/books/John/verses?translation=web` does not. The premise
"scripture text never changes" is true of the text but not of the rows behind
it: a re-import, an encoding fix, a corrected verse, or a translation reloaded
under the same code all change the response at a fixed URL. Under `immutable` a
browser will not revalidate even on reload, and a Cloudflare edge would pin the
wrong verse for a year with no lever except a manual purge.

So the freeze is attached to the URL rather than to the endpoint:

| Request | Headers returned |
|---|---|
| `?v=<corpusVersion>` present | `Cache-Control: public, max-age=31536000, immutable` |
| no `v` | `Cache-Control: public, max-age=86400, stale-while-revalidate=604800` |

Both always include:

```
ETag: "<sha1 of the response body, base64>"
Vary: Accept-Encoding
```

`If-None-Match` is honoured and returns `304 Not Modified` with no body. Both
strong and `W/`-prefixed tags are accepted.

### What the client needs to do

`GET /api/bible/translations` now returns `corpusVersion` on every catalog item:

```jsonc
{ "id": "web", "abbreviation": "WEB", "corpusVersion": "9f2a1c04b7e3", /* ... */ }
```

Append it as `?v=` to scripture reads to opt into year-long immutable caching:

```
GET /api/bible/books/John/verses?translation=web&v=9f2a1c04b7e3
```

- `v` is a **cache key only** and never selects data. A request carrying a stale
  `v` still returns current text; it just lands on a cache entry that will be
  abandoned once the client refreshes the catalog.
- `corpusVersion` is an opaque string — do not parse it. It is derived from the
  translation's verse count and newest verse mtime, so any re-import or
  correction moves it.
- It may be `null` if it cannot be computed. Omit `v` in that case and take the
  one-day revalidating behaviour.
- The catalog itself is cached for only 120 s, so a corpus change reaches
  clients within roughly two minutes.

Sending no `v` is perfectly safe and still gets edge hits and `304`s — you just
revalidate daily instead of never. The ETag is derived from the response body
rather than `<translation>-<book>-<hash>` as proposed, so it cannot drift out of
sync with what was actually serialised.

Non-immutable endpoints keep short TTLs, since their content genuinely changes:
`/verses/daily` (24 h), `/verses/random` and `/verses/popular` (5 min),
`/search` (60 s), `/translations` (120 s).

## 3. Compression — confirmed on

`compression` is enabled globally in `src/app.ts` at level 6 with a 512-byte
threshold and a filter that includes `application/json`. Bible responses are
gzipped today. Brotli would require an Nginx-level `brotli` module; gzip at
level 6 already gets ~75% on verse text, so this is optional.

Clients must send `Accept-Encoding: gzip` and must not send
`x-no-compression`.

## 4. Database index — shipped

Added to `BibleVerse`:

```
{ translation: 1, bookName: 1, chapterNumber: 1, verseNumber: 1 }
{ translation: 1, updatedAt: -1 }
```

The reader filters on exactly the first prefix. The second lets the corpus
fingerprint in section 2 read the newest verse mtime without a blocking sort.
Mongoose builds both on connect.

Equally important: chapter and book verse lookups previously filtered
`bookName` with a case-insensitive regex (`/^John$/i`), which **cannot** use an
index and forced a collection scan on every chapter open. Book names are now
resolved through a process-cached name/abbreviation map and queried by exact
string, so the index is actually used.

Verify in production:

```js
db.bibleverses.find({ translation: "WEB", bookName: "John" }).explain("executionStats")
// expect stage IXSCAN, not COLLSCAN
```

## 5. Pack manifest — shipped

```
GET /api/bible/packs?translation=web
```

```jsonc
{
  "success": true,
  "data": {
    "translation": "web",
    "version": "3",
    "url": "https://<cdn>/bible/web-3.json.gz",
    "sizeBytes": 4812345,
    "sha256": "<hex digest of the UNCOMPRESSED json>",
    "license": "Public Domain"
  }
}
```

- `sha256` is over the **uncompressed** JSON, hex, no `sha256-` prefix.
- `version` is the monotonic integer pack version as a string; it is bumped by
  the pack build, so a client can compare it to detect staleness.
- The pack itself is hosted on R2, not the app server. `url` points at the CDN.
- Licensed translations → `403 { "error": "Translation requires license" }`.
  Pack not built → `404 { "error": "Pack unavailable" }`.
- The existing `/translations/:id/manifest` and `/translations/:id/pack`
  (302 to R2) routes are unchanged.

Only public-domain translations are packed. WEB and KJV are cleared for
redistribution.

## 5b. Cache correctness fixes found while doing the above

Two bugs in the shared response cache, both of which affected the pack routes:

- **Error bodies were cached and replayed as `200`.** `cacheMiddleware` stored
  whatever passed through `res.json` regardless of status, and served hits with
  a default `200`. A `404 { "success": false, "error": "Pack unavailable" }`
  therefore became an HTTP 200 with a failure body for the next 60 s, which any
  client checking `response.ok` before reading `success` would accept. Only 2xx
  responses are cached now; anything else gets `X-Cache: BYPASS` and
  `Cache-Control: no-store`.
- **Pack gating leaked across client profiles.** Lite has a pack size cap and
  the profile arrives in `X-Jevah-Client` / `X-Client-Profile`, but the cache key
  used only the URL and query. A Lite client's `400 Pack too large for lite`
  could be served to a full client, and vice versa. `cacheMiddleware` now takes
  `varyByHeaders`, which joins those headers to the key and echoes them in
  `Vary`; `/packs` and `/translations/:id/manifest` use it.

If you put these routes behind a CDN, the `Vary` header must be respected.
Better: leave `/packs`, `/translations/:id/manifest`, and
`/translations/:id/pack` uncached at the edge entirely.

## 6. Smaller items

- `chapterCount` is now returned on every book from `/books`,
  `/books/testament/:testament`, and `/books/:bookName`, alongside the existing
  `chapters` field. It is always populated (required, min 1 in the schema).
- `/search` now returns `total` and `hasMore` plus the echoed `limit`/`offset`,
  so results page instead of loading everything. The per-result chapter lookup
  was also collapsed from one query per verse into one query per page.
- `GET /books/:book/chapters/:n` is marked deprecated in the routes and can be
  removed once traffic reaches zero.

---

## Remaining: VPS and CDN configuration

These need doing on the Contabo box / Cloudflare dashboard; there is no
application code left to change.

### Cloudflare in front of `/api/bible/**`

Proxy the API hostname through Cloudflare (orange cloud) and add a cache rule:

- Match: `URI Path starts with /api/bible/`
- Cache eligibility: Eligible for cache
- Edge TTL: **Use cache-control header from origin**
- Browser TTL: Respect origin

Leave the cache key including the full query string (Cloudflare's default). Both
`translation` and `v` must be part of the key, or translations would collide and
the `v` cache-buster would do nothing.

The headers from section 2 then let the edge serve scripture from a node near
the user. Do **not** cache `/api/bible/packs`,
`/translations/:id/pack`, `/verses/daily`, or `/search` aggressively — the pack
route is a 302 and sends `Cache-Control: no-store`.

### Nginx

```nginx
http {
  gzip on;
  gzip_comp_level 5;
  gzip_min_length 512;
  gzip_proxied any;
  gzip_vary on;
  gzip_types application/json application/javascript text/plain text/css;

  upstream jevah_backend {
    server 127.0.0.1:4000;
    keepalive 64;              # keep-alive to Node
  }

  server {
    listen 443 ssl http2;      # HTTP/2
    # listen 443 quic reuseport;  # optional HTTP/3

    location / {
      proxy_pass http://jevah_backend;
      proxy_http_version 1.1;  # required for keepalive
      proxy_set_header Connection "";
    }
  }
}
```

Confirm with:

```bash
curl -sI -H 'Accept-Encoding: gzip' https://<host>/api/bible/books | \
  grep -Ei 'HTTP/|content-encoding|cache-control|etag'
```

### Client timeout

Agreed: 30 s with no retry is too long now that the host never sleeps. 8–10 s
with a single retry on GET is a better fit and surfaces backend problems
instead of hiding them behind a spinner.
