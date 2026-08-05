# Backend ↔ Frontend — Feed audio seek + views (corroboration)

**Date:** 2026-08-02  
**Audience:** `jevahapp-frontend` feed / MusicCard / copyright-free  
**From:** `jevahapp-backend`  
**Re:** Your *Feed Audio Seek + Views* handoff

**Related:** [BACKEND_VIDEO_DURATION_HANDOFF.md](./BACKEND_VIDEO_DURATION_HANDOFF.md) · [FRONTEND_VIEW_HANDOFF.md](./FRONTEND_VIEW_HANDOFF.md) · [ENGAGEMENT.md](./ENGAGEMENT.md)

---

## 0. Verdict

| Ask | Status |
|-----|--------|
| CF list/search/single/playlist: `duration` seconds + `audioUrl`/`fileUrl` | **Yes** — via `shapePublicSong` / `shapeTrackCard` / playlist populate |
| Feed music/podcast/sermon: `duration` + `processingStatus` | **Yes** — `enrichMediaPlaybackFields` on media list/detail/feed |
| Feed `POST /api/content/:type/:id/view` always returns `counted` + `viewCount` | **Already matched** |
| CF `POST /api/audio/copyright-free/:id/view` always returns `counted` | **Fixed 2026-08-02** (`counted` + `isNewView` + `hasViewed` + `viewCount`) |
| Dual thresholds (video 3s/25%, feed audio 10s/20%, CF 3s/25%) | **Yes** — sermon treated as **audio** (was incorrectly video) |
| CF `viewCount` on list + `viewCount >= likeCount` | **Yes** |
| Socket `copyright-free-song-interaction-updated` | **Yes** after counted view/like |
| Rows with `duration` null/0 | **Data/heal** — FE still cannot invent length; run media heal / backfill CF |

---

## 1. Seek / duration

### Feed / uploaded media

```json
{
  "_id": "...",
  "fileUrl": "https://…",
  "playbackUrl": "https://…",
  "duration": 180.5,
  "processingStatus": "ready"
}
```

- `duration` is **seconds** (from top-level or `processingMetadata.durationSeconds`).
- Prefer progressive URLs for scrub; same rules as video handoff for artist uploads.
- Heal missing media durations: `npm run heal:media-duration:dry` then `npm run heal:media-duration`.

### Copyright-free

List / search / get-by-id / public shelves return:

```json
{
  "id": "...",
  "audioUrl": "https://…",
  "fileUrl": "https://…",
  "playbackUrl": "https://…",
  "duration": 210,
  "durationSec": 210,
  "processingStatus": "ready",
  "viewCount": 12,
  "likeCount": 3
}
```

Playlist track `content` includes `duration` (and `audioUrl`) for both media and CF entries.

**Ops:** Prefer R2/CDN objects with `Accept-Ranges: bytes` and correct `Content-Type`. Backend does not wrap CF files in strip-length redirects.

---

## 2. Views

### Feed media (unchanged contract)

```http
POST /api/content/:contentType/:contentId/view
```

Always:

```json
{ "success": true, "data": { "viewCount": 42, "hasViewed": true, "counted": true } }
```

| Family | Threshold (BE re-validates) |
|--------|------------------------------|
| Video / reels / live / recording | ≥ **3s** OR ≥ **25%** OR complete |
| Music / audio / podcast | ≥ **10s** OR ≥ **20%** OR complete |
| Sermon **audio** (`mediaType: audio` / `audio/*`) | Same as music (10s / 20%) |
| Sermon **video** | Same as video (3s / 25%) |
| Ebook / devotionals | ≥ **10s** OR ≥ **10%** OR complete |

- `progressPct`: 0–100 or 0–1 (normalized).
- Dedup: user **or** (`deviceId` / `sessionId`) within 1h window.
- `counted: true` only when **this** request incremented.

### Copyright-free

```http
POST /api/audio/copyright-free/:songId/view
Authorization: Bearer <required>
```

```json
{
  "success": true,
  "data": {
    "viewCount": 12,
    "hasViewed": true,
    "counted": true,
    "isNewView": true
  }
}
```

| Field | Rule |
|-------|------|
| `counted` | **Always present.** `true` iff this request incremented song `viewCount` |
| `hasViewed` | User already has a counted view (this or prior) |
| `isNewView` | Alias of `counted` (legacy) |
| Qualify | ≥ **3s** OR ≥ **25%** OR `isComplete` (`progressPct` 0–100) |

Do **not** treat missing `counted` as true (field is always sent now).

Realtime: `copyright-free-song-interaction-updated` on `content:audio:{songId}` with `{ songId, viewCount, likeCount }`.

---

## 3. ± skip

No BE endpoint. FE ±10s / ±15s only need `duration` seconds + seekable URL — provided when data is populated.

---

## 4. Checklist (BE)

- [x] CF list/search/single shaped with `duration` / `durationSec`
- [x] Playlist CF/media tracks expose `duration`
- [x] Feed media enriched with `duration` + `processingStatus`
- [x] Feed view returns `counted` + `viewCount`
- [x] CF view returns `counted` + `viewCount`
- [x] Thresholds match §2 (sermon → audio)
- [x] CF list `viewCount` + invariant ≥ likes
- [x] CF interaction socket
- [x] Sermon catalog cards expose `duration` (+ `durationSec`)
- [x] Playlist CF tracks include `processingStatus`
- [ ] Catalog rows with null duration — backfill / re-seed (ops); `ready` may still appear without duration (FE soft-disables seek)

---

## 5. Smoke

```bash
# CF list duration
curl -s "$BASE/api/audio/copyright-free?limit=5" \
  | jq '.data.songs[] | {id, duration, audioUrl, viewCount}'

# CF view counted
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"durationMs":4000,"progressPct":30}' \
  "$BASE/api/audio/copyright-free/$SONG_ID/view" \
  | jq '.data | {viewCount, counted, hasViewed}'

# Feed music view (10s rule)
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"durationMs":10000,"progressPct":20,"source":"feed"}' \
  "$BASE/api/content/media/$MEDIA_ID/view" \
  | jq '.data | {viewCount, counted, hasViewed}'
```
