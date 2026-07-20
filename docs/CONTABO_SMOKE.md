# Contabo smoke checklist

Run on the Contabo box (not local Upstash `.env`). Mongo remains write authority.

## 1. Redis

```bash
redis-cli -h 127.0.0.1 ping
# → PONG
```

Confirm `REDIS_URL=redis://127.0.0.1:6379` and `KAFKA_BROKERS` unset.

## 2. Build + processes

```bash
npm ci && npm run build
pm2 start ecosystem.config.cjs
# or:
# npm start                 # terminal 1 — API
# npm run worker:start      # terminal 2 — worker
pm2 logs jevah-worker --lines 50
# Expect: BullMQ workers started … notifications
```

## 3. Like → feed flags

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -X POST "$API/api/content/media/$MEDIA_ID/like"

curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/api/media/all-content?page=1&limit=10"
# Expect that media: hasLiked true and likeCount matches
```

## 4. Comment live room

```bash
curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"content":"smoke test"}' \
  -X POST "$API/api/content/media/$MEDIA_ID/comment"
```

With a second client joined to `join-media` / `join-content`, expect `content-comment` / `new-comment` and owner in-app/push (worker).

## 5. Typing

Two clients in the same room:

1. Client A: `emit("typing-start", { contentId, contentType: "media" })`
2. Client B: receives `user-typing` with `isTyping: true`, then auto-clear (~3s) or `typing-stop`

## 6. Worker health

```bash
pm2 status
# jevah-api + jevah-worker online
# After a like/comment: worker logs show analytics / notifications jobs
```

## 7. Latency baseline (shareholder numbers)

From a laptop or the Contabo host (against the public API URL):

```bash
AUTH_TOKEN=<user_or_admin_jwt> \
BASE_URL=https://api.yourhost.com \
SAMPLES=20 \
MEDIA_ID=<optional> \
npm run measure:latency
```

Prints a markdown table (warmup, health, feed, metadata, **like**, idempotency replay, metrics) with **min / p50 / p95 / max**. Paste into [PERFORMANCE.md](./PERFORMANCE.md) §11.

`SKIP_LIKE=1` if you only want read-path timings.

See also: [REDIS_OPS.md](./REDIS_OPS.md), [SOCKET_TYPING.md](./SOCKET_TYPING.md), [PERFORMANCE.md](./PERFORMANCE.md).
