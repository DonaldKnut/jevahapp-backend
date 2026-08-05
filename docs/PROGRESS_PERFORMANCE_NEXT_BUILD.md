# Progress & Performance Report — July 2026

**Audience:** Product, engineering, leadership  
**Date:** 31 Jul 2026  
**Scope:** Backend achievements, hardenings, performance before/after, and the next build

Related: [PERFORMANCE.md](./PERFORMANCE.md) (shareholder latency brief) · [REDIS_OPS.md](./REDIS_OPS.md) · [CONTABO_SMOKE.md](./CONTABO_SMOKE.md) · [FRONTEND_VIDEO_DURATION_HANDOFF.md](./FRONTEND_VIDEO_DURATION_HANDOFF.md)

---

## 1. Executive summary

We moved Jevah’s backend from a **monolithic request path** (API buffers uploads, blocks on moderation, weak feed/auth edge cases) to a **split architecture**: thin API + R2 direct upload + BullMQ workers + Contabo Redis + durable Mongo engagement.

| Theme | Outcome |
|-------|---------|
| **Interactive UX** | Likes, views, comments, feed reads designed for sub-second on Contabo |
| **Heavy work** | Upload bytes, AI moderation, FFmpeg off the HTTP path |
| **Product shelves** | Gospel **Artists / Tracks**, **Sermons** catalog, admin console hardened |
| **Playback** | Faststart MP4 + VOD HLS; **`duration`** persisted and returned for TikTok-style scrub |
| **Ops truth** | Local laptop + Upstash ≠ Contabo + localhost Redis — measure prod on Contabo |

**Bottom line:** Architecture for launch speed is largely in place. Next build is **measure on Contabo**, finish FE migrations (scrubber, staged upload, Artists), and close remaining “ready without duration / stale cache / auth edge” gaps.

---

## 2. What we have achieved

### 2.1 Platform & ops

| Deliverable | Status |
|-------------|--------|
| Staged upload (intent → R2 PUT → finalize → queue) | Shipped |
| Media worker: moderate → transcode / publish | Shipped |
| PM2 layout (`jevah-api` + `jevah-worker`) | Documented / Contabo-ready |
| Contabo Redis (`REDIS_URL=redis://127.0.0.1:6379`) | Documented + installed on server |
| Docker FFmpeg for workers | Shipped |
| Health / metrics endpoints | Shipped |
| Feed cache generation bump (no stale resurrect on SCAN race) | Shipped |

### 2.2 Engagement (feed)

| Deliverable | Status |
|-------------|--------|
| Durable likes (Mongo before HTTP 200) | Shipped |
| Idempotency-Key + rate limits on like | Shipped |
| Views with content-type thresholds + dedupe | Shipped |
| Comments (create / edit / image / mentions) | Shipped |
| Feed card engagement same-paint contracts | Handoffs shipped |
| Batch metadata + user flags overlay | Shipped |

### 2.3 Admin & moderation

| Deliverable | Status |
|-------------|--------|
| Admin console APIs (users, bans, reports, queue) | P0–P2 largely shipped |
| Master admin protections | Shipped |
| Async AI moderation (Gemini) in worker | Shipped |
| Preview / assign / notes / rerun paths | Shipped |

### 2.4 Gospel product surfaces

| Deliverable | Status |
|-------------|--------|
| Track catalog (copyright-free shelf vs Artists lane) | Shipped |
| Creator apply / studio / me/tracks | Shipped |
| Hard shelf filters (no artist bleed into CF / video feed) | Shipped + tests |
| Public `/api/sermons` for marketing web | Shipped |
| R2 CORS docs for mobile/web upload | Shipped |

### 2.5 Video playback (Jul 30 push)

| Deliverable | Status |
|-------------|--------|
| Transcode → **faststart MP4** (`+faststart`) | Shipped |
| Adaptive **VOD HLS** (`-hls_playlist_type vod`) | Shipped (MP4-only fallback if HLS fails) |
| ffprobe **duration** on output MP4 → Media.duration | Shipped |
| `duration` + `processingStatus` on feed / detail / status | Shipped |
| Heal script for missing durations (17 rows updated once) | Ran |
| Owner/admin can GET under-review media (auth passed through) | Fixed |
| FE scrubber handoff | [FRONTEND_VIDEO_DURATION_HANDOFF.md](./FRONTEND_VIDEO_DURATION_HANDOFF.md) |

---

## 3. What we tightened

Security, correctness, and “don’t lie to the client” work:

| Area | Before | After (tightened) |
|------|--------|-------------------|
| **Likes** | Easy counter drift / Redis-as-truth feel | Mongo commit first; Redis post-commit; idempotent replay |
| **Feed visibility** | Draft/staged could appear then 404 on like | `PUBLIC_MEDIA_FILTER` + publication state on feed |
| **Delete cascade** | Primary file only risk | Collect staging + derivativeKeys + versioned keys |
| **GET media by id** | Ignored JWT → owner saw “under review” as 400 | Passes `actingUserId` / role; cache varies by user |
| **Admin** | Weak master-admin / ban edges | Hardened gates, bulk mod, health |
| **Music shelves** | Risk of mixing CF ↔ Artists ↔ TikTok feed | Hard filters + unit tests |
| **Duration** | Often missing on new uploads; scrub broken | Persist + expose; heal historical gaps |
| **Upload HTTP** | Multipart buffer on API | Prefer staged R2; legacy path deprecated |
| **Moderation** | Could block upload request | Async worker; reject NSFW after enqueue |

---

## 4. Performance analysis

### 4.1 Architecture (why latency changed)

```text
BEFORE (legacy feel)
  Client ──multipart──► API (buffer file + maybe AI + maybe encode) ──► Mongo/R2
                         ▲ CPU/RAM spike, minutes on large sermons

AFTER (current)
  Client ──presign──► R2 (bytes)
  Client ──finalize──► API (~1–3 s) ──enqueue──► Worker (Gemini + FFmpeg)
  Client ──like/feed──► API + Contabo Redis + Mongo (interactive path)
```

Interactive product speed is no longer coupled to upload size or transcode length.

### 4.2 Before vs after (by class)

| Class | Before | After (design / observed pattern) | Contabo expectation |
|-------|--------|-----------------------------------|---------------------|
| **Like toggle** | Flaky under retry; unclear truth | Durable Mongo **~100–400 ms**; Redis refresh after | Same order with localhost Redis |
| **Feed page (cached)** | Heavy Mongo every scroll | Redis generation cache + flag overlay **~100–600 ms** | Best case on Contabo |
| **Feed page (miss)** | Multi-second aggregations | Still Mongo aggregation; warn if &gt; 1–8 s | Tune indexes + warm cache |
| **Upload “accepted”** | **2–15+ min** API hold on large files | Intent + finalize **&lt; 1–3 s**; bytes to R2 | Stable |
| **Moderation** | On request path | Background; poll status | Worker CPU bound |
| **Playback ready** | Blocking / unclear | Background transcode; MP4 + HLS + **duration** | Minutes for long sermons |
| **API RAM under upload** | Spiked with file size | Stays light; worker absorbs FFmpeg | Predictable API box |

### 4.3 What local laptop logs are *not* measuring

Recent mobile-vs-laptop sessions showed **5–80 s** calls, Redis `ETIMEDOUT` / `ECONNRESET` to **Upstash**, Mongo `secureConnect` timeouts, and **401 Invalid token** on upload.

| Symptom | Cause | Contabo? |
|---------|--------|----------|
| Redis timeout storm | Laptop → Upstash over WAN | **No** — Contabo uses `127.0.0.1:6379` |
| Upload 401 | Expired/invalid JWT | Token hygiene (any env) |
| Metadata 80 s / 500 | Redis + Mongo pile-up under flaky WAN | Unlikely with local Redis + healthy Atlas |
| Wrong LAN IP timeouts | Phone → stale `192.168.x.x` | N/A on production HTTPS |

**Do not use Upstash-on-laptop p95 as Contabo SLOs.** Re-measure on Contabo with [CONTABO_SMOKE.md](./CONTABO_SMOKE.md) + `GET /api/metrics`.

### 4.4 Target bands (still the contract)

| Band | Examples | Target |
|------|----------|--------|
| Hot | Cache hit flags, health | &lt; 50–100 ms |
| Interactive | Like, login, comment write | &lt; 200–500 ms |
| List | Feed, admin lists | &lt; 500–1500 ms |
| Accepted async | Finalize | &lt; 1–3 s HTTP |
| Background | Gemini, FFmpeg | Not on HTTP budget |

Full tables: [PERFORMANCE.md](./PERFORMANCE.md).

### 4.5 Resource model

| Process | Role | Scales with |
|---------|------|-------------|
| **API** | Auth, CRUD, enqueue, cache | Concurrent HTTP clients |
| **Worker** | Moderation + transcode | Queue depth + video minutes |
| **Redis (Contabo)** | Feed cache, likes hot path, sessions, BullMQ | Hit rate + memory |
| **Mongo Atlas** | Source of truth | Indexes + aggregation shape |
| **R2** | Bytes + public CDN URLs | Bandwidth / egress |

---

## 5. Gaps still open (honest)

| Gap | Impact | Owner |
|-----|--------|-------|
| FE scrubber still needs poll + prefer MP4 | Seek fails if FE uses incomplete HLS / ignores `duration` | Mobile |
| Finalize response has no `duration` (by design) | FE must poll status | Mobile |
| `ready` can still lack duration if ffprobe fails | Rare scrub miss | BE harden next |
| Heal did not bump feed generation | Stale cached cards until TTL/bump | Ops / BE |
| Legacy multipart upload still exists | Clients can still stress API | FE migrate |
| Formal Contabo p50/p95 dashboards | Shareholder proof incomplete | Ops |
| Local Upstash for laptop | Dev UX noise | Dev: local Redis |
| NSFW test never hit moderation when token invalid | Looks like “moderation broken” | Re-login + retry |

---

## 6. What the next build should look like

### Theme: **Prove Contabo + finish playback + close client migration**

Not a greenfield rewrite — a **measurement + finish line** build.

### 6.1 P0 — Contabo truth (1 sprint)

1. Deploy current `main` + worker with FFmpeg on Contabo.  
2. Confirm `REDIS_URL=redis://127.0.0.1:6379` (or passworded localhost).  
3. Run [CONTABO_SMOKE.md](./CONTABO_SMOKE.md): health, login, feed, like, staged upload, worker job.  
4. Capture **p50/p95** for: login, like, feed (cached/miss), finalize, metadata (1–2 days).  
5. Alert on Redis down, BullMQ depth, worker failures.

**Exit:** Written SLO sheet from Contabo numbers (not laptop Upstash).

### 6.2 P0 — Playback scrubber closed loop

| BE | FE |
|----|----|
| Refuse or re-probe if `ready` and `duration` missing | Prefer MP4; poll until `duration > 0` |
| Invalidate feed generation after duration heal | Session cache length by media id |
| Optional: include `duration` earlier when client probes on pick | Absolute seek only when length known |

**Exit:** New upload scrub seeks mid-clip on device against Contabo.

### 6.3 P1 — Client migration & hygiene

- 100% mobile/web off legacy `POST /api/media/upload` multipart → staged intent.  
- Artists / CF / sermons wired per handoffs (no shelf bleed).  
- Drop post-delete view noise; refresh feed on delete success.  
- Token refresh before upload (avoid false “moderation” failures).

### 6.4 P1 — Worker & media quality

- Multi-rendition HLS tuning + CDN cache hit notes.  
- Parallel worker concurrency caps by CPU.  
- Thumbnail / poster reliability.  
- Re-transcode admin action for bad historical assets.

### 6.5 P2 — Product / growth

- Creator verification auto-approve path already gated — expand carefully.  
- Sermons web SEO + CDN caching.  
- Push notification polish for “approved / rejected / ready”.  
- Optional desired-state like PUT/DELETE (PERFORMANCE.md).

### 6.6 Explicit non-goals for next build

- Server-side “For You” ranking (see [FOR_YOU_DEFERRED.md](./FOR_YOU_DEFERRED.md)).  
- Replacing Mongo or R2.  
- Making finalize synchronous with full transcode (would undo upload wins).

---

## 7. Suggested next-build checklist

```text
[ ] Contabo: API + worker + local Redis healthy
[ ] Smoke: login / feed / like / upload intent / finalize / status ready
[ ] Confirm duration > 0 on ready video from Contabo API
[ ] Mobile: scrub mid-clip on Contabo-backed build
[ ] p50/p95 sheet for interactive endpoints (1–2 days)
[ ] No Upstash required in Contabo .env
[ ] FE off legacy multipart upload for primary flows
[ ] NSFW reject path verified with valid JWT + worker logs
```

---

## 8. Doc map

| Doc | Use |
|-----|-----|
| This file | Progress + performance narrative + next build |
| [PERFORMANCE.md](./PERFORMANCE.md) | Shareholder latency / CPU detail |
| [CREATED_SO_FAR.md](./CREATED_SO_FAR.md) | Feature inventory |
| [REDIS_OPS.md](./REDIS_OPS.md) | Contabo Redis |
| [FRONTEND_VIDEO_DURATION_HANDOFF.md](./FRONTEND_VIDEO_DURATION_HANDOFF.md) | Mobile scrubber |
| [BACKEND_VIDEO_DURATION_HANDOFF.md](./BACKEND_VIDEO_DURATION_HANDOFF.md) | Duration BE contract |
| [BACKEND_CREATORS_GOSPEL_MOBILE_HANDOFF.md](./BACKEND_CREATORS_GOSPEL_MOBILE_HANDOFF.md) | Artists / gospel shelves |
