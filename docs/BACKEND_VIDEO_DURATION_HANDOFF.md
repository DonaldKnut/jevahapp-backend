# Backend ↔ Mobile — Video duration + seekable playback

**Date:** 30 Jul 2026  
**Why:** TikTok-style scrub needs `duration` (seconds) on every ready video. Incomplete HLS without duration → player `duration = 0` → seek broken.

## Contract

### Ready media (feed / get-by-id / upload status)

```json
{
  "_id": "...",
  "fileUrl": "https://…/playback.mp4",
  "playbackUrl": "https://…/playback.mp4",
  "hlsUrl": "https://…/master.m3u8",
  "duration": 142.5,
  "processingStatus": "ready"
}
```

| Field | Meaning |
|-------|---------|
| `duration` | Seconds (float ok). Set when processing completes. Prefer this over player-reported length. |
| `processingStatus` | `ready` \| `processing` \| `pending` \| `failed` |
| `fileUrl` / `playbackUrl` | Progressive **faststart** MP4 (moov at start) after transcode |
| `hlsUrl` | VOD HLS (`#EXT-X-PLAYLIST-TYPE:VOD`) when available |

### While processing

- `processingStatus` is `pending` / `processing`
- Playback URLs may be omitted on upload status until ready
- Poll status / detail until `ready` **and** `duration > 0`

### Client guidance (already on FE)

1. Prefer progressive `.mp4` over HLS when both exist.
2. Enable scrub only after `duration > 0` (API or player).
3. Seek = `% of duration → absolute time`.

## Backend behavior

1. **Transcode** every video upload → H.264/AAC MP4 with `-movflags +faststart` **and** VOD HLS.
2. **ffprobe** output MP4 → persist `duration` + `processingMetadata.durationSeconds`.
3. Feed aggregation / list / `GET /api/media/:id` / public detail enrich with `duration` + `processingStatus`.
4. Fallback: if top-level `duration` missing, use `processingMetadata.durationSeconds`.

## Smoke

```bash
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/media/<id>" \
  | jq '{duration, fileUrl, playbackUrl, hlsUrl, processingStatus}'

# Ready video: duration > 0, processingStatus == "ready"
```

Feed cards:

```bash
curl -s "$BASE/api/media/public/all-content?limit=10" \
  | jq '.data.media[] | {id: ._id, duration, processingStatus, fileUrl}'
```

## Heal existing rows

```bash
npm run heal:media-duration:dry
npm run heal:media-duration
# optional: --limit=50
```

Requires `ffprobe` on PATH and reachable `fileUrl`/`playbackUrl`.

## Pass criteria

| Check | Pass |
|-------|------|
| Ready video has `duration > 0` | Yes (after transcode / heal) |
| MP4 is seekable (faststart) | Yes (`+faststart` in transcoder) |
| HLS is VOD | Yes (`-hls_playlist_type vod`) |
| Feed cards include `duration` | Yes |
| `processingStatus` on detail/feed/status | Yes |
