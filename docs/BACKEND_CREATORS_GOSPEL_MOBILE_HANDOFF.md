# Backend ↔ Mobile — Creators / Gospel Artists corroboration

**Date:** 30 July 2026  
**Mobile FE:** shipped (`feature/feed-playback-engagement`)  
**Backend:** `main` (this doc)

## Verdict on FE architecture

**Yes — correct.** Keep Music → **Copyright-free | Artists**; mount Music from AllContentTikTok MUSIC chip; never mix artist uploads into CF or the vertical video feed. Creator studio is separate. That matches long-term Spotify-for-gospel (one Track, two shelves).

## Contracts corroborated (backend)

| FE expectation | Backend |
|----------------|---------|
| `GET /api/creators/me` + `capabilities.nextStep` | Yes |
| Intent → `uploadUrl` / `uploadHeaders` / `coverUploadUrl` / `expiresInSec` | Yes (+ nested `audio` kept) |
| Finalize `{ publish }` → TrackCard `lane: artist`, `artistSlug`, `playbackUrl` when ready | Yes |
| `visibility: public\|draft` on cards; PATCH `{ publish }` / `{ visibility: "public" }` | Yes (DB stores `published`) |
| CF list never artist-lane | Hard filter |
| `/api/music/tracks?lane=artist` never curated | Hard filter |
| `{ tracks, total }` on me/tracks + music browse | Yes (`items` alias too) |
| `{ artist }` + `{ tracks }` on artist profile | Yes |
| `playCount` increment | `POST …/play` (music or CF path) |
| Like/view/share/save on artist tracks | Same collection; use CF paths **or** `/api/music/tracks/:id/{like\|view\|share\|save\|play}` |

## Smoke

```bash
# Shelves
curl -s "$BASE/api/audio/copyright-free?limit=5" | jq '.data.songs[].lane'
curl -s "$BASE/api/music/tracks?lane=artist&limit=5" | jq '.data.tracks[].lane'

# Session
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/creators/me" | jq '.data.capabilities'

# Intent shape
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  "$BASE/api/creators/tracks/upload-intent" \
  -d '{"title":"Smoke","contentType":"audio/mpeg","fileName":"x.mp3","fileSizeBytes":1000}' \
  | jq '.data | {trackId, uploadUrl, uploadHeaders, coverUploadUrl, expiresInSec}'
```

**R2 CORS:** Bucket must allow `PUT` from the app / Expo origins with `Content-Type` header (presign binds Content-Type).

## Related

- [FRONTEND_CREATORS.md](./FRONTEND_CREATORS.md) — full UI map  
- [FRONTEND_AUDIO_TRACKS.md](./FRONTEND_AUDIO_TRACKS.md) — admin curated upload  
