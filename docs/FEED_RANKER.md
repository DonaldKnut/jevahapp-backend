# Algorithmic For You + Music For You (Contabo-safe)

**Date:** 2026-08-09  
**Audience:** mobile + web FE, Contabo ops  

## Design (senior / RAM-safe)

| Layer | What | Contabo impact |
|-------|------|----------------|
| **Node local ranker** (default ON) | Affinity from `FeedEvent` + CF likes/views + engagement + recency + fatigue | **Zero extra RAM** |
| **Python feed-ranker** (optional OFF) | Tiny FastAPI, **no Torch/TF** — same features | Only if you set `FEED_RANKER_URL` |
| Chronological fallback | `/api/media/all-content`, `/api/music/tracks` | Unchanged |

We do **not** load TensorFlow or sentence-transformers on Contabo.

## Endpoints

| Surface | Method | Path | Auth |
|---------|--------|------|------|
| Video / mixed TikTok feed | GET | `/api/feed/for-you?cursor=&limit=` | Required |
| Artist gospel music | GET | `/api/feed/music-for-you?lane=artist&cursor=&limit=` | Required |
| Alias | GET | `/api/music/for-you` | Required |
| Training signals | POST | `/api/feed/events` | Required |

### Events FE must send (or ranking stays cold)

```json
{
  "events": [
    { "contentId": "…", "contentType": "videos", "eventType": "impression", "sessionId": "…" },
    { "contentId": "…", "contentType": "videos", "eventType": "watch_time", "watchMs": 4500, "progressPct": 40 },
    { "contentId": "…", "contentType": "music", "eventType": "like" },
    { "contentId": "…", "contentType": "music", "eventType": "skip" }
  ]
}
```

Types: `impression`, `watch_time`, `skip`, `like`, `save`, `share`.

Music plays also flow from existing `POST /api/music/tracks/:id/view|like` into CF interactions (genres/artists).

## Ranking signals

1. **Trends / quality** — likes, views, comments, saves, shares, plays  
2. **History** — recent impressions (fatigue), watch_time, skips  
3. **Will like** — preferred genres, artists, topics, content types from last 30–45 days  

Diversification: avoid 3 identical `contentType` (video) or `artistId` (music) in a row.

## Contabo ops

```bash
# Default — nothing extra. After deploy:
pm2 restart backend --update-env
# optional worker already running

# DO NOT start feed-ranker unless experimenting:
# FEED_RANKER_URL=   (leave unset)
```

Optional sidecar (only if you have spare RAM and want it):

```bash
cd /var/www/backend/services/feed-ranker
# python -m venv .venv && pip install -r requirements.txt
# uvicorn app.main:app --host 127.0.0.1 --port 8092
# FEED_RANKER_URL=http://127.0.0.1:8092
# FEED_RANKER_TIMEOUT_MS=120
```

If sidecar is slow/down → Node local ranker continues (circuit opens after 3 failures).

## FE checklist

- [ ] Wire `POST /api/feed/events` on swipe / watch / skip / like  
- [ ] Prefer `GET /api/feed/for-you` for vertical video For You  
- [ ] Prefer `GET /api/music/for-you` or `/api/feed/music-for-you` for Artists shelf discovery  
- [ ] Keep chronological `/api/music/tracks?lane=artist` for browse/search  

## Related

- [FRONTEND_FOR_YOU_HANDOFF.md](./FRONTEND_FOR_YOU_HANDOFF.md) — **primary FE handoff** (wire + UI)  
- [FRONTEND_TIKTOK_FEED_HANDOFF.md](./FRONTEND_TIKTOK_FEED_HANDOFF.md)  
- [FOR_YOU_DEFERRED.md](./FOR_YOU_DEFERRED.md)  
- [ENGAGEMENT_TIKTOK_STANDARD.md](./ENGAGEMENT_TIKTOK_STANDARD.md)  
