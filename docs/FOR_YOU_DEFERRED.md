# For You ranking

## Status (2026-08-09)

**Algorithmic For You shipped** (Contabo-safe — no Torch/TF on the API host):

| Piece | Endpoint / module |
|-------|-------------------|
| Events ingest | `POST /api/feed/events` → `FeedEvent` |
| Video / mixed For You | `GET /api/feed/for-you` |
| Artist music For You | `GET /api/feed/music-for-you` · alias `GET /api/music/for-you` |
| Affinity | Genres, artists, topics, likes/skips/watch from FeedEvent + CF interactions |
| Scoring | Engagement + recency + affinity + fatigue + diversification |
| Optional sidecar | `FEED_RANKER_URL` (lite FastAPI, **off by default**) |

Chronological feeds remain available:

- `GET /api/media/all-content`
- `GET /api/music/tracks?lane=artist`

## Still deferred (heavy ML)

- Sentence-transformers / TensorFlow / large embedding models on Contabo  
- Dual Kafka analytics paths  
- Redis counters as ranking authority  

See [FEED_RANKER.md](./FEED_RANKER.md).

## FE contract

See [FRONTEND_TIKTOK_FEED_HANDOFF.md](./FRONTEND_TIKTOK_FEED_HANDOFF.md) · [FEED_RANKER.md](./FEED_RANKER.md).
