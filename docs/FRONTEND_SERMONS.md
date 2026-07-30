# Frontend Sermons API — Jevah Web `/sermons`

**Date:** 30 July 2026  
**Decision:** **Media `contentType: "sermon"`** (not music Tracks).  
Avoids mixing teaching into Copyright-free / Artists music shelves. Reuses video/audio Media upload, moderation, HLS/playback.

## Public endpoints (no auth)

Base: same API host as music.

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/sermons` | List published, ready, playable |
| GET | `/api/sermons/featured` | Top 3 by views |
| GET | `/api/sermons/topics` | Topics + series facets |
| GET | `/api/sermons/:id` | Detail |

### List query

`page`, `limit` (max 50), `search`, `series`, `topic`, `language`, `cursor`

### Item shape

```json
{
  "id": "…",
  "title": "Walking in Faith",
  "speaker": "Pastor …",
  "church": "Grace Community",
  "description": "…",
  "scripture": "James 1:2-4",
  "series": "Faith Under Fire",
  "durationSec": 2732,
  "thumbnailUrl": "https://…",
  "playbackUrl": "https://…",
  "hlsUrl": "https://…",
  "mediaType": "video",
  "category": "sermons",
  "language": "en",
  "publishedAt": "…",
  "playCount": 1250,
  "processingStatus": "ready",
  "contentType": "sermon"
}
```

Empty DB → `{ success: true, data: { items: [], total: 0 } }` (not 500).

## Ingest (admin / creators)

Use existing Media staged upload:

1. `POST /api/media/upload/intent` with `contentType: "sermon"` (+ optional `speaker`, `church`, `scripture`, `series`, `mediaType`, `language`; category defaults to `sermons`)
2. Client PUT to R2
3. `POST /api/media/upload/:mediaId/finalize`
4. After moderation approved + processing ready → appears on `/api/sermons`

Admin metadata: `PATCH /api/admin/media/:id` accepts `speaker`, `church`, `scripture`, `series`, `mediaType`, `language`.

## Categories

Ensure `sermons` in admin Categories (`POST /api/admin/categories` `{ "key": "sermons", "label": "Sermons", "kind": "media" }`). Defaults include it when the registry is empty.

## Web next steps

1. `fetchSermons()` / `fetchSermon(id)` mirroring music catalog client  
2. Replace marketing-only `/sermons` shelf with list + `<audio>` / `<video>` using `playbackUrl` (prefer `hlsUrl` for video when present)

## Not Option A (Tracks)

Music Tracks (`lane` curated/artist) stay for worship music. Sermons stay on Media so AllContentTikTok / feed / moderation stay consistent.
