# Backend handoff — Creator Studio (web desk)

**Date:** 2026-08-14  
**Status:** Shipped on this branch — stop using `POST /creators/apply` as a profile PATCH fallback.  
**Auth:** same JWT as `GET /api/creators/me`. 403 if banned. 404 `NOT_A_CREATOR` if no artist profile.

Errors: `{ success, message, code, error: { code, message } }`.

---

## Keep / hardened

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/creators/me` | `artist.avatarUrl`, `bannerUrl`, `location`, `genres[]`, `socials` (incl. tiktok/website), `bio`, `slug`, `isVerified`, `followers`, `monthlyListeners` |
| PATCH | `/api/creators/me` | **Implemented.** Active + pending artists. Accepts `displayName`, `bio`, `genres[]`, `socials{instagram,youtube,website,tiktok,spotify,twitter}`, `location`, `bannerUrl`, `avatarUrl`. Ignores `monthlyListeners`. |
| GET | `/api/creators/me/tracks` | `q`, `visibility`, `sort=recent\|plays\|title\|duration`, `page`, `limit` (default 50). Always `durationSec`, `thumbnailUrl`/`coverUrl`/`artwork`, `genre`, `release`, `playCount`, `createdAt`, `visibility` (`public` FE / `visibilityDb` published), `processingStatus`, `likes`/`saves`, `uniqueListeners`, `isrc`, `explicit` |
| PATCH | `/api/creators/tracks/:id` | `title`, `artistName`, `genre`, `visibility`, plus `isrc`, `lyrics`, `explicit`, `language`, `trackNumber` |
| DELETE | `/api/creators/tracks/:id` | |
| GET/POST/PATCH/DELETE | `/api/creators/releases…` | Cover intent/finalize, reorder, unlink (`?deleteTrack=`), publish (`scheduledAt`, `skipTypeHints`) already live |

---

## Analytics

```http
GET /api/creators/me/analytics?rangeDays=7|28|90
```

Default `rangeDays=28` (still accepts 1–90, including legacy 30).

Adds `monthlyListeners` (unique listeners **last 28 days**, regardless of range), `followers`, `sources[]`, `topTracks[].coverUrl`, `topTracks[].skipRate`.

`studio_preview` / `admin` / `inspect` FeedEvent sources are excluded from timeseries, sources, and skip rates. Catalog `playCount` is not incremented for those play sources.

404 `NOT_A_CREATOR` if no artist — FE may still soft-fail.

---

## Audience

```http
GET /api/creators/me/audience?rangeDays=28
```

```json
{ "followers": 880, "followersDelta": 0, "monthlyListeners": 4102, "playlistAdds": 19 }
```

`followersDelta` is `0` until follow snapshots exist. `playlistAdds` is catalog `saveCount` sum.

Public `GET /api/artists/:slug` now includes `followers` + `monthlyListeners`.

---

## Studio preview plays

```http
POST /api/music/plays
Authorization: Bearer <jwt>
{ "trackId": "…", "source": "studio_preview", "positionSec": 12, "completed": false }
```

Also honored on `POST /api/music/tracks/:songId/play` via body/query `source`.

| `source` | Counts toward `playCount` / analytics |
|----------|----------------------------------------|
| omitted / listener | Yes |
| `studio_preview` | **No** (`data.counted: false`) |
| `admin` / `inspect` | **No** |

`positionSec` and `completed` are accepted and ignored (progress still belongs on `/view`). **Do not call `/view` or `/like` from Studio preview** if you want stats clean.

---

## Artist imagery

Same presign pattern as release cover:

```http
POST /api/creators/me/avatar/upload-intent
POST /api/creators/me/avatar/finalize
POST /api/creators/me/banner/upload-intent
POST /api/creators/me/banner/finalize
```

Body for intent: `{ contentType, fileName?, fileSizeBytes? }`. Then PUT to `data.putUrl`. Then finalize. Echoed on `GET /me` as `artist.avatarUrl` / `artist.bannerUrl`.

---

## Useful error codes

- `NOT_A_CREATOR`
- `TRACK_NOT_READY`
- `TYPE_HINT_MISMATCH` (publish; FE “publish anyway” via `skipTypeHints`)
- `COVER_REQUIRED` (optional policy — not enforced yet)
- `CREATOR_SUSPENDED` / `ACCOUNT_BANNED`
