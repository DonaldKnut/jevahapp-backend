# Frontend Copyright‑Free Audio (Fast + Reliable Playback Guide)

## Goals

- **Never “randomly fails”**: frontend always gets a valid URL to play.
- **Fast start**: avoid backend proxying; play from CDN directly.
- **Correct UX**: likes/saves/views stay consistent, realtime updates work, and offline downloads are tracked cleanly.

---

## Core principle

**Playback should use the CDN URL (`audioUrl`) directly.**  
The backend should be used for **metadata, search, likes/saves, analytics tracking, and offline download recording**.

---

## Canonical endpoints (copyright‑free)

### 1) List songs (Public)

- **GET** `/api/audio/copyright-free`
- Cached server-side (Redis) ~60s
- Returns `data.songs[]`

Frontend playback field:
- **Use `audioUrl`** (preferred)
- `fileUrl` is also returned for compatibility

### 2) Song detail (Public)

- **GET** `/api/audio/copyright-free/:songId`
- Cached server-side (Redis) ~120s
- Returns a single song plus:
  - `audioUrl`
  - `id`
  - `artist` (alias for singer)
  - `isLiked` (only if request is authenticated)

### 3) Stream redirect (Public, recommended for “play”)

- **GET** `/api/audio/copyright-free/:songId/stream`
- Returns **`302` redirect** to the CDN audio URL.
- Does **not** proxy bytes (keeps backend fast).

**Frontend usage options:**
- **Option A (recommended)**: use `audioUrl` directly from list/detail.
- **Option B (compatibility)**: set player URL to the redirect endpoint and let it follow the redirect.

### 4) Search (Public)

- **GET** `/api/audio/copyright-free/search?q=...`
- Cached server-side ~30s
- Returns `data.songs[]` and includes `audioUrl` for each item.

### 5) Like/unlike (Authenticated)

- **POST** `/api/audio/copyright-free/:songId/like`
- Requires `Authorization: Bearer <JWT>`
- Returns `{ liked, likeCount, viewCount, listenCount }`

### 6) Save/unsave (Authenticated)

- **POST** `/api/audio/copyright-free/:songId/save`
- Returns `{ bookmarked, bookmarkCount }`

### 7) View tracking (Authenticated)

- **POST** `/api/audio/copyright-free/:songId/view`
- Body (optional fields):
  - `durationMs?: number`
  - `progressPct?: number` (0–100)
  - `isComplete?: boolean`
- Returns: `{ viewCount, hasViewed }`

### 8) Playback threshold tracking (Authenticated)

- **POST** `/api/audio/copyright-free/:songId/playback/track`
- Body:
  - `playbackDuration: number` (seconds)
  - `thresholdSeconds?: number` (default 30)
- Use this when playback stops/ends to count “real” listens/views.

### 9) Offline download record (Authenticated)

- **POST** `/api/audio/copyright-free/:songId/download`
- Backend returns a `downloadUrl` (CDN URL) + metadata.
- Frontend should download the bytes directly from `downloadUrl`.

---

## Headers

### Public endpoints

- No auth required
- Recommended:
  - `Accept-Encoding: gzip, br` (handled automatically by most clients)

### Authenticated endpoints

- `Authorization: Bearer <JWT>`

---

## Recommended frontend playback flow (robust)

### List → play

1. Call `GET /api/audio/copyright-free`
2. For each item:
   - Use `audioUrl` as the playback URL
   - If `audioUrl` is missing (shouldn’t happen), fall back to:
     - `GET /api/audio/copyright-free/:songId/stream` (set that as the playback URL)

### Detail → play

1. Call `GET /api/audio/copyright-free/:songId`
2. Play `audioUrl`
3. If player has compatibility issues with long/encoded URLs, use the redirect endpoint:
   - Play `GET /api/audio/copyright-free/:songId/stream` (player follows 302)

---

## Caching strategy (frontend)

### What to cache locally

- Cache the **song objects** (id/title/thumbnail/audioUrl/likeCount) for fast UI.
- Do **not** cache audio bytes unless you’re implementing offline downloads.

### Offline downloads

- Use the backend endpoint to **record intent** and get `downloadUrl`:
  - `POST /api/audio/copyright-free/:songId/download`
- Download bytes from `downloadUrl` using a background downloader.
- Store locally and play from local file path when offline.

---

## Why audio can “sometimes fail” (and what we fixed)

Common causes:
- Frontend sometimes expects `audioUrl` but receives only `fileUrl` from another endpoint.
- URLs with spaces/unescaped characters.

Backend fixes now ensure:
- List and detail endpoints always include **`audioUrl`** and it’s **normalized**.
- A dedicated **stream redirect** endpoint exists for player compatibility.

---

## Realtime updates (optional)

If you use Socket.IO, when interactions change the backend emits:
- Room: `content:audio:{songId}`
- Event: `copyright-free-song-interaction-updated`

Frontend should:
- Join room when opening a song
- Update counts in UI when event arrives

---

## Minimal “do this and it won’t break” checklist

- Always play `audioUrl` (fallback to `/stream`).
- Never proxy audio through your backend.
- Call `/playback/track` when stopping to count real listens/views.
- Use `/download` to record offline downloads, then fetch bytes from returned `downloadUrl`.


