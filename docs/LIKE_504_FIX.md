# Like POST 504 — write-path fix (2026-08-12)

**P0.** `POST /api/content/media/:id/like` hung until nginx returned HTML 504. Comments and views on the same id were fine.

## What was blocking

```
Phone → nginx → Node like handler → Mongo txn + Redis (awaited) → res.json
                                      ↑ hung here (often ~60s)
```

1. **Mongo multi-doc transaction** on every like. Server txn lifetime defaults to **60s** — same window as typical `proxy_read_timeout`. `startSession()` + `withTransaction` ran even when a unique index + `$inc` is enough.
2. **Redis awaited on the request.** Idempotency `res.json` waited for Redis SET. Cache refresh (`setPostCounter`, feed flags, metadata invalidate) ran **before** the HTTP body. `redisSafe` also **awaited reconnect** (`connectTimeout` 15s) when Redis was down. No command timeout.
3. Extra Mongo round-trips after commit (recount `likeCount`, re-fetch `likeId`) before responding.

nginx was healthy. Raising `proxy_read_timeout` would only hide this.

## What shipped

Write path for media likes:

1. Auth (fail fast)
2. Idempotency lookup (Redis, **100ms** cap, fail-open)
3. Indexed `findOneAndDelete` / `Like.create` + atomic `likeCount` `$inc`
4. `res.json({ success, data: { liked, likeCount } })`
5. After response: Redis idempotency persist, sockets, notifications, cache

- No Mongo transaction on likes
- Like queries `maxTimeMS(2000)`
- Unique index already: `{ userId, contentType, contentId }` (`unique_user_content_like`)
- Redis: skip if not ready; **100ms** timeout (`ENGAGEMENT_REDIS_TIMEOUT_MS`); persist must not block `res.json`
- In-progress idempotency lock TTL **8s** (was 60s) so a dead 504 retry is not stuck on `IDEMPOTENCY_IN_PROGRESS`

## nginx (Contabo)

Do **not** raise timeout to “fix” likes. Recommended:

```nginx
proxy_connect_timeout 5s;
proxy_send_timeout 15s;
proxy_read_timeout 15s;
```

Confirm with:

```bash
grep -R proxy_read_timeout /etc/nginx/sites-enabled /etc/nginx/conf.d
```

Access log after deploy: `POST /api/content/media/.../like` → **200**, not 504.

## Indexes

```
unique_user_content_like  { userId: 1, contentType: 1, contentId: 1 }  unique
content_likes             { contentType: 1, contentId: 1 }
user_likes                { userId: 1, createdAt: -1 }
```

Toggle query is the unique key. If prod is missing it: `npm run migrate:like-indexes`.

## Smoke (after Contabo pull)

```bash
BASE=https://api.jevahapp.com/api
TOKEN="<user JWT>"
CONTENT_ID="6929da46d4ec2df1331c8b6e"
KEY="$(uuidgen)"

time curl -sS -o /tmp/like.json -w "%{http_code} %{time_total}\n" -X POST \
  "$BASE/content/media/${CONTENT_ID}/like" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $KEY" \
  -d '{}'
# Expect: 200 and time_total < 1.0
cat /tmp/like.json | jq '.data|{liked,likeCount}'
```

Repeat same `Idempotency-Key` → same `liked` / `likeCount`. New key → toggle.

PM2: `like_toggle_completed` `durationMs` should be tens of ms; `like_toggle_slow` if > 500ms.

## ETA

p95 &lt; 300ms in production **after this commit is pulled and `pm2 restart backend --update-env`**. No nginx change required for the fix to work; 15s read timeout is a safety cap, not the cure.
