# Frontend Handoff — Video duration + seekable scrubber

**Date:** 30 Jul 2026  
**Backend:** set on this branch (transcode faststart MP4 + VOD HLS, persist `duration`, expose on feed/detail/status). Heal ran once for 17 missing rows.  
**Owner now:** Mobile FE

## BE contract (use this)

| Field | Meaning |
|-------|---------|
| `duration` | Seconds (float). Scrubber source of truth when `> 0`. |
| `processingStatus` | `ready` \| `processing` \| `pending` \| `failed` |
| `fileUrl` / `playbackUrl` | Progressive **faststart MP4** after ready (prefer these for seek) |
| `hlsUrl` | VOD HLS when present — fallback only |

### When values appear

| Moment | What you get |
|--------|----------------|
| Upload **finalize** | `{ status: "queued", … }` — **no** `duration`, **no** playable URLs yet |
| Status poll / `GET /api/media/:id` / feed card | After ready: `duration`, `processingStatus`, MP4 (+ optional `hlsUrl`) |

```bash
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/media/<id>" \
  | jq '{duration, fileUrl, playbackUrl, hlsUrl, processingStatus}'
```

**Ready + seekable:** `processingStatus === "ready"` **and** `duration > 0` (use `>= 0.5` if you already gate at 500ms).

## What FE must do

1. **Point API at the live PC LAN IP** when developing locally (today: `http://192.168.18.10:4000`, not an old `.63` address). Timeouts ≠ missing duration.
2. **After finalize, poll** upload status / media detail until `processingStatus === "ready"` and `duration > 0` before treating the item as scrubbable.
3. **Prefer `fileUrl` / `playbackUrl` (MP4)** over `hlsUrl` for on-demand posts. Only use HLS if no MP4.
4. **Do not enable absolute seek** until duration is known (API field, session cache, or player ≥ ~500ms). Visual scrubber OK; seek-to-time only when length is known.
5. **Optimistic upload:** optional local probe at pick → seed feed item `duration`; replace with API `duration` when status/detail returns.
6. **Session cache** by media id: once length is known, keep across remounts.
7. **Auto-loop only on true `playToEnd`** — never treat a short buffer window as end (that caused snap-to `0:00`).
8. If card is `ready` but `duration` is still null/0 (rare probe miss): keep MP4 playback, soft-disable absolute seek, or re-fetch detail once — do not fall back to incomplete HLS as primary.

## What FE should not expect

- Finalize body shaped like the “ready” sample with `duration` already set — that is **async**.
- Every historical row magically updated without heal/redeploy — we healed missing durations once; new uploads need the **media worker** running.
- Stale Redis feed forever — after heals/deploys, hard-refresh / wait for cache generation; prefer reading `duration` from detail if feed looks stale.

## Pass criteria (mobile)

| Check | FE action |
|-------|-----------|
| Ready card has `duration > 0` | Bind scrubber max to API `duration` |
| Seek works mid-clip | Prefer MP4; seek only when duration known |
| New upload | Poll until ready + duration; then enable seek |
| Processing | Show processing UI; don’t treat as seekable VOD yet |

## Smoke on device

1. Open feed → log `{ id, duration, processingStatus, fileUrl, hlsUrl }` for 3 cards.  
2. Upload a short video → poll status → when ready, confirm `duration > 0` and MP4 URL.  
3. Scrub to ~50% → playback should jump, not reset to start.

Backend handoff detail: [`BACKEND_VIDEO_DURATION_HANDOFF.md`](./BACKEND_VIDEO_DURATION_HANDOFF.md).
