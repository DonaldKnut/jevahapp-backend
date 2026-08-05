# Frontend handoff — CF / artist music player (Spotify · YouTube Music style)

**Date:** 2026-08-05 (tightened engagement + rate limits)  
**Audience:** `jevahapp-frontend` MusicCard / CF modal / creator studio  
**Backend:** `jevahapp-backend`

**Related:** [ENGAGEMENT_TIKTOK_STANDARD.md](./ENGAGEMENT_TIKTOK_STANDARD.md) · [FRONTEND_AUDIO_SEEK_VIEWS_HANDOFF.md](./FRONTEND_AUDIO_SEEK_VIEWS_HANDOFF.md) · [FRONTEND_AUDIO_TRACKS.md](./FRONTEND_AUDIO_TRACKS.md) · [ENGAGEMENT.md](./ENGAGEMENT.md)

---

## 0. Product model (what “standard” means here)

| Capability | Spotify / YTM pattern | Jevah CF API |
|------------|----------------------|--------------|
| Play + scrub | Needs duration + seekable URL | `duration` seconds + `audioUrl`/`fileUrl` |
| View / listen | Count qualified plays | `POST …/view` → `counted` + `viewCount` |
| Like | Heart toggle | `POST …/like` → `liked` + `likeCount` |
| Share | Each share sheets action counts | `POST …/share` → **always** bumps `shareCount` + `shareUrl` |
| Library | Liked Songs / Your Library | `POST …/save` + `GET /api/audio/library` |
| Playlist | Add to playlist | `POST /api/playlists/:id/tracks` `{ copyrightFreeSongId }` |
| Artist upload | Intent → PUT → finalize → ready | `POST /api/creators/tracks/upload-intent` → finalize |
| Live listeners | “Listening now” | Socket `viewer-count-update` (`kind: live_presence`) — **not** `viewCount` |

---

## 1. Track payload (list / search / detail)

With optional `Authorization: Bearer`, list & detail personalize:

```json
{
  "id": "…",
  "title": "…",
  "artistName": "…",
  "audioUrl": "https://…",
  "fileUrl": "https://…",
  "duration": 210,
  "durationSec": 210,
  "processingStatus": "ready",
  "viewCount": 120,
  "likeCount": 14,
  "shareCount": 8,
  "saveCount": 22,
  "playCount": 95,
  "isLiked": false,
  "isInLibrary": true,
  "isSaved": true,
  "shareUrl": "https://jevahapp.com/audio/copyright-free/…"
}
```

Detail always includes `shareUrl` for native share sheets.

---

## 2. Engagement endpoints

| Action | Method | Path | Auth | Rate limit |
|--------|--------|------|------|------------|
| View | POST | `/api/audio/copyright-free/:songId/view` | Required | Redis per user+song |
| Like | POST | `/api/audio/copyright-free/:songId/like` | Required | Redis per user+song |
| Share | POST | `/api/audio/copyright-free/:songId/share` | Required | Redis per user+song |
| Save / library | POST | `/api/audio/copyright-free/:songId/save` | Required | Redis per user+song |
| Library list | GET | `/api/audio/library` | Required | — |
| Play count | POST | `/api/audio/copyright-free/:songId/play` | Required | — |

API base for web: `https://api.jevahapp.com/api` (routes are under `/api/…`).

### Share body (optional)

```json
{ "platform": "instagram" }
```

### Share response

```json
{
  "success": true,
  "data": {
    "shared": true,
    "shareCount": 9,
    "likeCount": 14,
    "viewCount": 120,
    "shareUrl": "https://jevahapp.com/audio/copyright-free/…",
    "platform": "instagram"
  }
}
```

**Rule:** every successful share **increments** `shareCount` (repeat shares count — analytics style, not one-per-user).

### View request / response

**Body (server ignores any client `viewCount` / `likeCount` / `counted`):**

```json
{ "durationMs": 3100, "progressPct": 17, "isComplete": false }
```

```json
{
  "success": true,
  "data": {
    "viewCount": 121,
    "hasViewed": true,
    "counted": true,
    "isNewView": true,
    "metric": "lifetime_view"
  }
}
```

**Qualify (backend):** ≥3s (`durationMs >= 3000`) **OR** ≥25% (`progressPct` 0–100) **OR** `isComplete: true`.

**FE must do this correctly (or counts stay wrong):**

1. Call `POST …/view` with Bearer auth only after the track has actually played — not on card mount / modal open.
2. Send numbers, not strings. Prefer fire-and-forget (do not await in the play UI path).
3. Prefer one **qualified** fire (e.g. first time `durationMs >= 3000` or `progressPct >= 25`), then optional heartbeats. Early fires with `durationMs: 500` return `counted: false` and do **not** bump.
4. **Only set local `viewCount` from `data.viewCount` when `data.counted === true`.** Never `viewCount++` on 200 alone. Repeat users get `counted: false`, `hasViewed: true`.
5. On network / 5xx / `VIEW_RATE_LIMITED` (429): **ignore** — do not toast, do not pause audio; retry on next heartbeat.
6. Socket `copyright-free-song-interaction-updated` may refresh lifetime `viewCount` — treat server value as source of truth.
7. Live room `viewer-count-update.viewerCount` ≠ lifetime `viewCount`. Separate state (`liveListeners` vs `viewCount`).

### Like response

```json
{
  "success": true,
  "data": {
    "liked": true,
    "likeCount": 15,
    "viewCount": 121,
    "listenCount": 0
  }
}
```

Optimistic heart OK → reconcile from `liked` + `likeCount`. On `LIKE_RATE_LIMITED` (429), revert optimistic UI.

### Save response

```json
{
  "success": true,
  "data": {
    "saved": true,
    "saveCount": 23,
    "bookmarked": true,
    "bookmarkCount": 23
  }
}
```

### Library

`GET /api/audio/library` returns **both**:

- CF songs the user saved (`source: "copyright-free"`)
- Bookmarked media music/audio/podcast/sermon (`source: "media"`)

```json
{ "success": true, "data": { "items": [ /* … */ ], "songs": [ /* same */ ], "total": 12 } }
```

### Playlist

```http
POST /api/playlists/:playlistId/tracks
{ "copyrightFreeSongId": "<id>" }
```

Mixed media + CF playlists supported. Track `content` includes `duration` + `audioUrl`.

---

## 3. Realtime (two channels)

### Lifetime counters (durable)

Room: `content:audio:{songId}`  
Event: `copyright-free-song-interaction-updated`

```json
{
  "songId": "…",
  "likeCount": 15,
  "viewCount": 121,
  "shareCount": 9,
  "liked": true,
  "saveCount": 23
}
```

Use these for badges.

### Live presence (ephemeral)

Event: `viewer-count-update`

```json
{
  "contentId": "…",
  "contentType": "audio",
  "viewerCount": 3,
  "kind": "live_presence"
}
```

Use only for “listening now”. Join on play / leave on pause-unmount.

---

## 4. Artist upload (smooth path)

1. `POST /api/creators/tracks/upload-intent` (active artist)
2. `PUT` audio (+ cover) to presigned URLs
3. `POST /api/creators/tracks/:trackId/finalize` `{ "publish": true }`
4. Poll `GET /api/creators/me/tracks` until `processingStatus === "ready"` and prefer `duration > 0` before enabling scrub

Finalize retries ffprobe up to 3 times for duration. If duration still null, track can be `ready` for play — FE soft-disables seek until duration heals.

Admin curated: `/api/admin/audio/tracks/…` (same pipeline).

---

## 5. FE wiring checklist

- [ ] Share sheet uses `shareUrl` from detail or share response; call `POST …/share` when user completes a share
- [ ] Update UI `shareCount` from response / socket (every share)
- [ ] Library screen uses `GET /api/audio/library` (not media bookmarks alone)
- [ ] Save toggle → `isInLibrary` on cards
- [ ] Add to playlist with `copyrightFreeSongId`
- [ ] Seed seek from `duration`; never wipe with player `0`
- [ ] Creator upload: intent → PUT → finalize → poll ready + duration
- [ ] CF view: fire only when qualified; bump UI only if `counted === true`
- [ ] CF view: fire-and-forget; ignore 429/5xx for playback UX
- [ ] CF like: optimistic UI, reconcile from `liked` + `likeCount` response / socket
- [ ] Separate state: `viewCount` (lifetime) vs `liveListeners` (socket `viewerCount`)
- [ ] API base includes `/api` (`…/api/auth/login`, `…/api/audio/copyright-free/…`)
