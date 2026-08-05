# Frontend handoff — Artist releases (albums / EPs / mixtapes / singles)

**Date:** 2026-08-04  
**Backend:** `jevahapp-backend`  
**Audience:** Creator studio + Music → Artists  
**Storage:** Cloudflare R2 (same as track audio)

**Related:** [FRONTEND_CREATORS.md](./FRONTEND_CREATORS.md) · [FRONTEND_AUDIO_TRACKS.md](./FRONTEND_AUDIO_TRACKS.md) · [R2_CORS.md](./R2_CORS.md)

---

## 0. Model

| Entity | Meaning |
|--------|---------|
| **Release** | Single / EP / album / mixtape — cover + ordered tracklist + publish state |
| **Track** | Existing `CopyrightFreeSong` — one audio file on R2 |
| **Playlist** | Listener library only — **not** an album |

**Types:** `single` (1 track) · `ep` (2–6) · `album` / `mixtape` (7–40 soft hints)  
**Status:** `draft` → `scheduled` → `published` → `archived`

**Slugs:** **global** unique among all releases. Auto from title on create; optional `PATCH` `slug`.

Out of scope: DSP export to Spotify/Apple (Amuse). In-app only.

---

## 1. Studio flow

```text
POST /releases (draft)
  → POST /releases/:id/cover/upload-intent → PUT R2 → cover/finalize
  → for each song:
      POST /tracks/upload-intent { releaseId, trackNumber? }
      → PUT audio to R2 (or multipart — §8)
      → POST /tracks/:id/finalize  (listen socket / poll status — §7)
  → DELETE /releases/:id/tracks/:trackId  (unlink; ?deleteTrack=true to hard-delete)
  → POST /releases/:id/tracks/reorder (optional)
  → POST /releases/:id/publish  ({ scheduledAt?, skipTypeHints? })
```

All studio routes need Bearer + **active** creator (`status: active`).

---

## 2. Creator APIs

| Method | Path | Body / notes |
|--------|------|----------------|
| POST | `/api/creators/releases` | `{ title, type?, description?, label?, upc?, releaseDate? }` |
| GET | `/api/creators/releases` | `?status=&page=&limit=` |
| GET | `/api/creators/releases/:id` | Includes ordered `tracks[]` |
| PATCH | `/api/creators/releases/:id` | Metadata + optional `slug` (`[a-z0-9]+(?:-[a-z0-9]+)*`, 3–80) |
| DELETE | `/api/creators/releases/:id` | Draft = hard delete; else archive |
| POST | `/api/creators/releases/:id/cover/upload-intent` | `{ contentType, fileName?, fileSizeBytes? }` |
| POST | `/api/creators/releases/:id/cover/finalize` | After R2 PUT |
| POST | `/api/creators/releases/:id/tracks/reorder` | `{ orderedTrackIds: string[] }` |
| DELETE | `/api/creators/releases/:id/tracks/:trackId` | Unlink; `?deleteTrack=true` hard-deletes song |
| POST | `/api/creators/releases/:id/publish` | `{ scheduledAt?, skipTypeHints? }` → `{ data: { release } }` |

### Unlink track

```http
DELETE /api/creators/releases/:id/tracks/:trackId
DELETE /api/creators/releases/:id/tracks/:trackId?deleteTrack=true
```

- Clears `releaseId` / `albumId` / `trackNumber` / `discNumber`; renumbers remaining.
- Keeps audio unless `deleteTrack=true`.
- Allowed on `draft` + `scheduled`. On `published` → auto-unpublish to `draft` (re-publish required).

### Replace audio (same track id)

```http
POST /api/creators/tracks/:trackId/replace-upload-intent
```

Then PUT R2 → existing `POST …/tracks/:trackId/finalize`. Does **not** change release membership.

### Track upload (attach to release)

```http
POST /api/creators/tracks/upload-intent
```

```json
{
  "title": "Track 1",
  "contentType": "audio/mpeg",
  "fileName": "t1.mp3",
  "fileSizeBytes": 5000000,
  "releaseId": "<releaseObjectId>",
  "trackNumber": 1
}
```

---

## 3. Publish

**200** — no re-GET needed:

```json
{
  "success": true,
  "data": {
    "release": {
      "id": "...",
      "slug": "...",
      "title": "...",
      "type": "ep",
      "status": "published",
      "coverUrl": "https://...",
      "scheduledAt": null,
      "publishedAt": "2026-08-04T21:00:00.000Z",
      "trackCount": 4,
      "tracks": [ /* TrackCard[] with nested release */ ]
    }
  }
}
```

Future `scheduledAt` → `status: "scheduled"`, `publishedAt: null` until scheduler.

**Errors (4xx, not 500):**

| code | data |
|------|------|
| `TRACKS_NOT_READY` | `{ blockingTrackIds, reasons }` |
| `TRACKS_REJECTED` | `{ blockingTrackIds, reasons }` |
| `TYPE_HINT_MISMATCH` | `{ expected: { min, max }, actual, type }` |

FE: on `TYPE_HINT_MISMATCH` confirm → retry `skipTypeHints: true`.

---

## 4. Nested `release` on track cards

Every artist-lane TrackCard (list, detail, finalize, release tracks):

```json
"release": {
  "id": "...",
  "title": "Kingdom EP",
  "coverUrl": "https://...",
  "type": "ep",
  "slug": "kingdom-ep"
}
```

Plus flat: `releaseId`, `albumId`, `trackNumber`, `discNumber`.

Player: `Playing from {release.title}` — zero extra GET.

---

## 5. Cover inheritance (singles)

| Case | Behavior |
|------|----------|
| Release has `coverUrl` | Used on release + inherited onto tracks missing cover |
| Release cover missing, type `single`, track has cover | Public/studio GET resolves release `coverUrl` from first track (`coverResolved: true`) |
| Studio | Still allow release cover upload; hint “Single can use track art” |

---

## 6. Public surfaces

| Method | Path | Use |
|--------|------|-----|
| GET | `/api/music/releases/:idOrSlug` | ObjectId **or** global slug |
| GET | `/api/artists/:slug/releases` | Discography |
| GET | `/api/music/tracks?lane=artist&releaseId=` | Optional shelf filter |

**Do not** put releases on Copyright-free.

---

## 7. Admin

```http
GET /api/admin/releases?status=&search=&page=&limit=
```

Columns: `creatorId`, `artistSlug`, `artistDisplayName`, `trackCount`, `status`, `updatedAt`, plus release card fields.

---

## 8. Finalize progress / multipart

See prior §§ — `uploadId: track_{id}`, `GET /tracks/:id/status`, multipart ≥20MB / max 200MB.

---

## 9. FE checklist

- [ ] Studio: create → cover → tracks → unlink/reorder → publish
- [ ] Publish uses `data.release` (no re-GET); handle `TYPE_HINT_MISMATCH` / `TRACKS_NOT_READY`
- [ ] Track normalizer reads nested `release` for player
- [ ] Single cover inherit / `coverResolved`
- [ ] Optional slug on PATCH; public `idOrSlug`
- [ ] Replace audio via `replace-upload-intent` + finalize
- [ ] Never mix release tracks into CF shelf
- [ ] Admin table last
