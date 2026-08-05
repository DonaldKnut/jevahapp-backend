# TikTok-class engagement standard (Jevah)

**Date:** 2026-08-05  
**Audience:** backend ops + mobile/web FE  
**Related:** [FRONTEND_CF_MUSIC_PLAYER_HANDOFF.md](./FRONTEND_CF_MUSIC_PLAYER_HANDOFF.md) · [FRONTEND_VIEW_HANDOFF.md](./FRONTEND_VIEW_HANDOFF.md) · [CONTENT_GUARDIAN.md](./CONTENT_GUARDIAN.md)

This is the bar we hold for “instant feel” without fake numbers.

---

## 1. Two numbers that must never mix

| Metric | Source | Meaning | UI use |
|--------|--------|---------|--------|
| `viewCount` / `likeCount` / `shareCount` | Mongo (durable) | Lifetime totals | Badge under heart / play |
| `viewerCount` | Socket room size | People in room *right now* | Optional “listening now” chip |

Socket event `viewer-count-update` includes `kind: "live_presence"`.  
Socket event `copyright-free-song-interaction-updated` carries **lifetime** counters.

**Never** write `viewerCount` into the same state field as `viewCount`.

---

## 2. Security (backend, shipped)

| Rule | Status |
|------|--------|
| Auth on every CF engagement write (`view` / `like` / `share` / `save` / `play`) | Required JWT |
| Redis rate limit per user + per song (anti-farming) | `viewRateLimiter`, `likeRateLimiter`, `shareRateLimiter`, `bookmarkRateLimiter` |
| Ignore client-sent `viewCount` / `likeCount` / `counted` in body | Stripped in controller |
| Only bump UI when `data.counted === true` | FE contract |
| Upload moderation: Guardian → fusion → Gemini gray → offline | See CONTENT_GUARDIAN.md |
| Secrets in env only; R2 staging not public CDN | Ops |

### CF rate limits (defaults, env-tunable)

| Action | Per song / user | Global / user |
|--------|-----------------|---------------|
| View | 20 / 60s | 120 / 60s |
| Like | 4 / 10s | 60 / 60s |
| Share | 10 / 60s | 30 / 60s |
| Save | 4 / 10s | 60 / 60s |

429 responses include `Retry-After` and `code` (`VIEW_RATE_LIMITED`, `LIKE_RATE_LIMITED`, …).  
**Views:** treat 429 as soft — do not pause playback or show a toast.

---

## 3. Performance (TikTok-feel)

| Layer | Design |
|-------|--------|
| Hot path | Redis rate limits + Socket.IO presence |
| Durable path | Mongo CF interaction + song counters |
| Views | Fire-and-forget after qualify; UI never blocks on view POST |
| Feed | Cursor pagination; CDN URLs; moderation/transcode on worker |
| Processes | API ≠ worker ≠ Content Guardian |

---

## 4. FE view algorithm (copyright-free)

```text
onPlayStart → join room content:audio:{songId}
onProgress → if (durationMs >= 3000 || progressPct >= 25 || isComplete)
               POST /api/audio/copyright-free/:id/view  (fire-and-forget)
               if response.ok && data.counted === true
                 setViewCount(data.viewCount)   // server value only
onSocket copyright-free-song-interaction-updated
  → setViewCount / likeCount / shareCount from payload (server truth)
onSocket viewer-count-update
  → setLiveListeners(viewerCount)  // separate state
onUnmount → leave room
```

### Body (numbers only)

```json
{ "durationMs": 3100, "progressPct": 17, "isComplete": false }
```

`progressPct` is **0–100**, not 0–1.

### Do not

- Call view on card mount / modal open  
- `viewCount++` on HTTP 200 alone  
- Merge `viewerCount` into `viewCount`  
- Block player UI waiting for view/like network  

### Do

- Optimistic like heart, then reconcile `liked` + `likeCount` from response  
- Prefer first qualified view fire; heartbeats OK within rate limit  
- On 5xx / network error for view: ignore (retry next heartbeat)  

---

## 5. Like / share

- Like: toggle; response `liked` + `likeCount` is truth  
- Share: every successful share increments `shareCount` (analytics-style)  
- Use `shareUrl` from detail or share response for native sheets  

---

## 6. Ops checklist (prod)

- [ ] `ALLOWED_ORIGINS` includes www / apex / admin (CORS never throws — see cors.config)  
- [ ] Redis up for rate limits + Socket adapter  
- [ ] Worker running for media pipeline  
- [ ] `CONTENT_GUARDIAN_URL` on Contabo (not laptop Docker if disk-full)  
- [ ] `VITE_API_URL` / `NEXT_PUBLIC_API_URL` = `https://api.jevahapp.com/api`  

---

## 7. Acceptance smoke

1. Play CF track ≥3s → `POST …/view` → `200` + `counted: true` first time; second user session same song → `counted: false`, `hasViewed: true`  
2. Spam view 30×/min → eventually `429 VIEW_RATE_LIMITED`, playback uninterrupted  
3. Join room → `viewer-count-update` with `kind: "live_presence"`; badge lifetime unchanged  
4. Like → optimistic UI; response `likeCount` matches socket  
5. Upload clear gospel → Guardian approve → feed without admin (when Guardian deployed)  
