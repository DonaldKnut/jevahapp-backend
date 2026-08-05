# For You ranking

## Status (2026-08-02)

**MVP shipped** (additive):

| Piece | Endpoint / module |
|-------|-------------------|
| Events ingest | `POST /api/feed/events` → `FeedEvent` |
| For You list | `GET /api/feed/for-you` → same card shape as all-content |
| Fatigue | Demote impression / watch_time / skip from last 24h |
| Scoring | Engagement + recency + light exploration + type diversification |

Chronological feed **`GET /api/media/all-content` remains the stable default**. FE may keep `rankFeedForYou` until events are wired and For You is feature-flagged.

## Not yet (next iterations)

- Heavy candidate generation / embeddings
- Dual Kafka + BullMQ analytics paths (avoid on Contabo)
- Treating Redis counters as ranking authority

## FE contract

See [FRONTEND_TIKTOK_FEED_HANDOFF.md](./FRONTEND_TIKTOK_FEED_HANDOFF.md).
