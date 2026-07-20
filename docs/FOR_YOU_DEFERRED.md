# For You ranking — deferred

Server-side For You (`watch_time` ingestion → candidate generation → scoring → `GET /api/feed/for-you`) is **explicitly deferred** until social correctness (likes, comments, follows, shares, views, notification durability) is stable on Contabo.

Until this ships:

- Clients may keep using local ranking helpers (e.g. `rankFeedForYou`).
- Do not treat Redis engagement counters as ranking authority.
- Feed list APIs remain chronological / existing query paths under `/api/media/*` and the thin Feed module façade.

When ready, implement in order: watch-time events → candidates → scorer → authenticated For You endpoint — without dual Kafka+BullMQ analytics paths on Contabo.
