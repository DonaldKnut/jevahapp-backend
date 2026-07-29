# Performance Update (Shareholder Brief)

**Date:** July 2026  
**Scope:** Jevah API backend — response times, resource usage, external APIs, video upload, and content verification  
**Audience:** Leadership / shareholders (technical detail kept practical)

---

## 1. Executive summary

| Area | Before (legacy path) | Now (current architecture) | Still to do |
|------|----------------------|----------------------------|-------------|
| **Likes (feed heart toggle)** | Easy to feel “lost” under retries; Redis-as-truth risk; double-taps | **Durable Mongo first** (~100–400 ms), then Redis + sockets; idempotency + rate limits | Measure Contabo p95; optional desired-state PUT/DELETE API |
| **API interactive calls** (login, feed, admin) | Mixed; feed hit Mongo heavily | Redis feed cache + flags; most UX calls target **&lt; 300–500 ms** | Formal load test + p95 dashboards |
| **Video upload (user wait for “accepted”)** | Server buffered whole file (often **2–15+ min** on large sermons; API CPU/RAM spiked) | Client uploads **direct to Cloudflare R2**; API returns in **&lt; 1–3 s** for intent + finalize | Migrate all clients off legacy `POST /upload` |
| **Content verification / moderation** | Often blocked the upload HTTP request (minutes) | Async worker: sample frames/audio → Gemini → optional admin review | Production latency baselines; scale workers under load |
| **Playback readiness (HLS)** | Limited / blocking | Separate FFmpeg transcode job (minutes, background) | Multi-rendition tuning + CDN cache hit metrics |
| **CPU / memory on API** | Spiked on every large upload | API stays light; **worker** absorbs FFmpeg + AI | Horizontal worker scale + alerting |

**Bottom line:** Interactive product speed is designed for sub-second UX. Heavy work (upload bytes, AI moderation, transcoding) no longer sits on the API request path. The remaining gap is **measured production SLOs** (p50/p95) and finishing client migration + monitoring — not inventing a new architecture.

---

## 2. How we observe performance today

| Endpoint | Who | What it reports |
|----------|-----|-----------------|
| `GET /api/health` / `GET /api/health/full` | Ops | Uptime, Mongo ping **responseTime (ms)**, process **memory (MB)**, host **CPU %** + core count |
| `GET /api/health/database` | Ops | Mongo ping latency |
| `GET /api/metrics` | **Admin JWT** | Process RSS/heap MB, Redis cache hit stats, engagement counters, BullMQ queue depths, Gemini budget, FFmpeg present |
| Media status poll | Client | `GET /upload/:mediaId/status` — processing / moderation state without blocking |

These are **live process + dependency checks**, not yet a full APM (Datadog/New Relic) time-series. Numbers below mix **configured targets**, **architecture estimates**, and **timeouts already coded**. Where we lack long-run production samples, we say so.

---

## 3. API response time

### 3.1 Target bands (product UX)

| Class | Examples | Target (happy path) | Notes |
|-------|----------|---------------------|--------|
| **Instant / hot** | Health warmup, cache hit feed flags | **&lt; 50–100 ms** | Redis + local process |
| **Fast interactive** | Login, like toggle, save, comment write, metadata | **&lt; 200–500 ms** | Mongo write + Redis refresh; likes are durable-before-200 |
| **List / admin reads** | Feed page, admin reports, moderation queue | **&lt; 500–1500 ms** | Depends on page size + Atlas latency |
| **Accepted async** | Upload finalize, enqueue processing | **&lt; 1–3 s** HTTP, then **202** | Work continues in worker |
| **Background only** | AI moderation, FFmpeg HLS | **Not** on HTTP budget | User polls status / admin queue |

**Slow-path logging already exists** for some public media reads (warn when duration &gt; 1 s). Feed personalization uses a **~500 ms** soft budget for recommendation overlay.

### 3.2 Typical endpoint expectations

| Endpoint pattern | Expected latency | Driver |
|------------------|------------------|--------|
| `POST /api/auth/login` | 200–800 ms | Password hash + Mongo + JWT |
| `POST /api/content/.../like` | 100–400 ms | Mongo Like + count, then Redis |
| `POST /api/content/batch-metadata` | 150–800 ms | Batch size + Redis/Mongo |
| `GET /api/media/all-content` (cached) | 100–600 ms | Redis feed + per-user flag overlay |
| `GET /api/admin/dashboard/analytics` | 500–2000 ms | Aggregations across collections |
| `POST /upload/intent` | 200–1000 ms | Mongo create + R2 presign |
| `POST /upload/:id/finalize` | 300–2000 ms | HeadObject verify + enqueue job |
| Legacy `POST /upload` (multipart) | **Seconds to many minutes** | **Avoid** — buffers file in API |

### 3.3 What “good” looks like for shareholders

- Users feel **likes, scroll, login** as immediate.
- Uploading a sermon feels like **choose file → progress bar to cloud → done uploading**, not “app frozen while server digests a 200 MB file.”
- “Is my video approved?” is a **status / notification** problem, not a stuck spinner on the upload button.

---

## 3A. Likes — performance & correctness (feed)

Likes are one of the highest-frequency taps in the app. We optimized for **correct counts under retries** and **sub-second HTTP**, not for “fake instant” that drifts from the database.

### Before vs now

| | Before (risk / legacy feel) | Now |
|--|-----------------------------|-----|
| **Write authority** | Easy to lean on Redis/counters that could drift | **Mongo `Like` row + `Media.likeCount` commit before HTTP 200** (“durable-before-200”) |
| **Redis role** | Could be treated as source of truth | **Post-commit cache** (counters + feed flags); refresh after Mongo succeeds |
| **Double-tap / flaky network** | Duplicate toggles or lost likes | Optional `Idempotency-Key` (UUID): **replay same response**, no second mutation |
| **Abuse / spam taps** | Weak or local-only limits | Contabo Redis: **~4 toggles / 10s / content / user**, **60 / min / user** → `429 LIKE_RATE_LIMITED` |
| **Realtime UI** | Inconsistent | Socket emit after commit; other clients see count/like updates |
| **User-perceived speed** | Optimistic UI helped, but server truth unclear | Client optimistic flip + server confirms in **~100–400 ms** typical |

### Request path (what the clock is doing)

```text
POST /api/content/:contentType/:contentId/like
  → rate limit (Redis)           ~1–5 ms
  → optional idempotency check   ~1–10 ms (replay → return immediately)
  → verify Media exists (Mongo)
  → toggle Like + update likeCount (Mongo)   ← must finish before 200
  → refresh Redis counters / feed flags
  → emit Socket.IO
  → 200 { liked, likeCount, updatedAt }
```

| Stage | Target |
|-------|--------|
| Full HTTP like toggle | **100–400 ms** happy path (Atlas + localhost Redis) |
| Idempotent **replay** | Often **&lt; 50–100 ms** (no second write) |
| Rate-limited rejection | Fast **429** + `Retry-After` (no mutation) |
| Redis down + client sent `Idempotency-Key` | **Fail open** — process like without idempotency (log warning); Mongo remains source of truth |

### Two stacks (do not mix)

| Product | Endpoint | Storage | Perf note |
|---------|----------|---------|-----------|
| **Feed / sermons / videos** | `POST /api/content/.../like` | `Like` + Media count + Redis | Path above |
| **Copyright-free music** | `POST /api/audio/copyright-free/:songId/like` | Song interaction doc | Separate; still interactive (&lt; ~500 ms target) |

Canonical contracts: [ENGAGEMENT.md](./ENGAGEMENT.md) · UI wiring: [FRONTEND_ENGAGEMENT.md](./FRONTEND_ENGAGEMENT.md).

### Feed list (seeing hearts already filled)

Authenticated feed does **not** re-query likes naively per row after a cache hit:

1. Redis serves the feed list (~600 s TTL generation cache).
2. Per-user `hasLiked` / `hasBookmarked` overlaid from Redis/Mongo flags **after** the list read.

So scrolling stays fast while hearts stay **correct for that JWT**.

### Metrics to quote for likes

`GET /api/metrics` (admin) → `engagementRedis.metrics`:

| Field | Meaning |
|-------|---------|
| `idempotencyHits` | Safe retries (good under flaky mobile networks) |
| `idempotencyConflicts` | Same key, different request body (client bug) |
| `rateLimitRejections` | Users tapping too fast / bots |
| `cacheFailures` | Redis issues on engagement path |

Structured logs also include `like_toggle_completed`, `like_rate_limited`, `idempotency_replay`.

### Still to do (likes)

| Item | Effort |
|------|--------|
| Contabo **p50/p95** on like endpoint under load | **1–2 days** (with Week 1 latency pack) |
| Client always send `Idempotency-Key` on like | Mobile/web **1–2 days** |
| Deferred: desired-state `PUT`/`DELETE` like API | Separate; not required for launch speed |
| Periodic `reconcile:like-counts` in ops | Cron; already scripted |

### Shareholder one-liner

**Likes feel instant in the UI, commit durably in a few hundred milliseconds, survive retries without double-counting, and no longer depend on Redis alone for truth.**

---

## 4. CPU usage

| Process | Role | CPU profile |
|---------|------|-------------|
| **`jevah-api` (PM2)** | HTTP, auth, engagement, admin | Usually **low–moderate** (I/O bound: Mongo, Redis, R2 signed URLs). Spikes only on CPU-heavy in-request work (legacy multipart, large JSON). |
| **`jevah-worker` (PM2)** | Moderation + FFmpeg + push | **High during jobs** — frame extract, audio clip, HLS/MP4 encode. This is **expected** and intentional. |
| **Redis** (localhost Contabo) | Cache / queues | Typically **low** CPU; watch memory and connection count. |
| **MongoDB Atlas** | Source of truth | Managed; watch connection pool (`MONGODB_POOL_SIZE`, default tuning ~30). |

**Architecture win:** Moving upload bytes and FFmpeg off the API means one busy upload no longer starves login/likes for everyone else on the same Node process.

**Health signal:** `GET /api/health/full` → `services.cpu.usage` (host-level % since boot — useful as a pulse, not a precise 1-second gauge).

**Plan:** Keep API at 1+ fork instances; scale **workers** first when queue depth (`mediaProcessing.waiting`) grows. Optional later: PM2 cluster on API + `SOCKET_REDIS_ADAPTER=true`.

---

## 5. Memory usage

| Component | What we track | Guidance |
|-----------|---------------|----------|
| API Node heap | `GET /api/metrics` → `process.heapUsedMB` / `rssMB` | Watch for steady climb (leak) vs sawtooth (GC). Legacy multipart could hold **tens–hundreds of MB** per concurrent upload. |
| Worker | Same metrics on worker process + OS temp files | FFmpeg workdirs under `/tmp`; jobs clean up after publish/reject. |
| Redis | Feed keys TTL ~600 s; auth snapshots ~120 s | Contabo box must size RAM for cache + BullMQ. |
| Staged upload limit | Up to **300 MB** video (sermon staged) | Bytes live in **R2**, not API RAM. Legacy soft ceiling was **~100 MB** buffered. |

**Before:** Large video in API memory → risk of OOM / swap / process restart under a few concurrent uploads.  
**Now:** API holds metadata + checksum; worker streams/downloads for sampling only (evidence caps frames/clips — see §7).

---

## 6. External APIs — speed now & plan

| Dependency | Used for | Timeout / bound (coded) | Typical / planned latency | Notes |
|------------|----------|-------------------------|---------------------------|--------|
| **MongoDB Atlas** | Almost all reads/writes | Health ping measured live | **~20–150 ms** ping; queries vary | Pool size tunable |
| **Redis (Contabo)** | Likes cache, rate limits, idempotency, BullMQ, feed cache | Fail-closed for idempotency if down | **&lt; 5–20 ms** localhost | Authoritative for hot path |
| **Cloudflare R2** | Staging PUT, publish, CDN delivery | Presign ~1 h intent TTL | Presign **&lt; 1 s**; client PUT = **network-bound** (user bandwidth); CDN GET often **&lt; 100–300 ms** edge | Custom domain + cache rules for HLS/MP4 |
| **Google Gemini** | Content moderation / transcription | **`GEMINI_REQUEST_TIMEOUT_MS=60000`** (15–120 s clamp); retries ≤ 2; max concurrent **3** | Single call often **2–20 s**; full video evidence pack **tens of seconds–few minutes** | Daily request/token budgets; Tier 1 recommended for launch |
| **Resend** | Auth + admin emails | Provider SLA | Usually **&lt; 1–3 s** send accept | Not on critical UX path |
| **Expo Push** | Mobile push | Worker + receipt poll (~60 s optional) | Enqueue fast; delivery async | Ticket/receipt processors on worker |
| **FFmpeg / ffprobe** (local binaries) | Evidence + HLS | ffprobe **60 s**; encode jobs up to **~10–15 min** timeouts | Probe seconds; transcode **1–15+ min** by length/resolution | Required in Docker/`apk add ffmpeg` |

### Plan to make external paths faster / more reliable

1. **Gemini:** Stay on `gemini-2.5-flash`; keep concurrency + budgets; reuse moderation **decision by content hash** (skip repeat AI for identical bytes).  
2. **R2:** Immutable CDN cache for `/media-hls/*`, `/media-videos/*`; never cache `/staging/*`.  
3. **Mongo:** Indexes + feed cache generation bump (already in Redis ops).  
4. **Observability (next):** Log p50/p95 per route and per Gemini/`label`; alert on queue wait time.

---

## 7. Video upload — before vs now

### 7.1 Before (legacy `POST /upload`)

```text
Phone/Web ──multipart bytes──► API (buffers file in RAM)
                                │
                                ├─ optional sync verification (minutes)
                                ├─ write storage
                                └─ finally HTTP 200
```

| Pain | Impact |
|------|--------|
| API holds entire file | High RAM/CPU; poor concurrency |
| Verification on request | User stares at spinner **several minutes** |
| Soft size ~100 MB | Larger sermons awkward or failing |
| One slow upload | Can degrade whole API process |

**User-perceived “upload a sermon”:** often **5–20+ minutes** end-to-end on large files / weak networks, with high failure risk if the HTTP connection drops mid-buffer.

### 7.2 Now (staged intent → R2 → finalize → worker)

```text
Client                API                         R2 / Worker
  │  POST /upload/intent (~1s)                      │
  │◄──── presigned PUT ─────────────────────────────│
  │  PUT file bytes ────────────────────────────────►│  (progress = user’s bandwidth)
  │  POST /finalize (~1–2s) → 202 queued            │
  │  poll GET …/status                              │
  │                                                 ├─ moderate (AI)
  │                                                 └─ transcode / publish CDN
```

| Stage | Who waits | Typical duration |
|-------|-----------|------------------|
| Create intent | User | **&lt; 1–3 s** |
| Upload bytes to R2 | User (progress UI) | **Network only** — e.g. ~100 MB on good 4G/Wi‑Fi often **~30 s–3 min**; not limited by API RAM |
| Finalize + enqueue | User | **&lt; 1–3 s** → **202** |
| AI moderation | Background | **~30 s–5 min** typical (content-dependent); hash reuse can be **seconds** |
| HLS / MP4 publish | Background | **~1–15+ min** by length & quality |
| Admin human review (if flagged) | Admin SLA | Minutes to hours (ops process, not API) |

**Hard limits now:** staged sermon/video up to **300 MB**; music **50 MB**; books **100 MB**. Checksum SHA-256 required so worker rejects tampered objects.

### 7.3 Shareholder takeaway on upload

| Metric | Before | Now |
|--------|--------|-----|
| Time until “upload accepted” | Tied to full file + often AI | **Seconds** after bytes land in R2 |
| API risk under concurrent uploads | High | Low (bytes bypass API) |
| Max practical video size | ~100 MB buffered | **300 MB** direct-to-object-store |
| Time until playable in feed | Coupled / unclear | Explicit pipeline: approve → transcode → `ready` |

---

## 8. Verification — two different meanings

### 8.A Content verification (AI moderation of uploads)

**What it is:** Automated check that media is appropriate for a Christian gospel platform (frames + audio samples + transcript signals via Gemini), then optional admin queue.

| | Before | Now |
|--|--------|-----|
| When it runs | Often **inside** upload HTTP | **Worker job** after finalize |
| Sampling | Risk of heavy / front-loaded processing | **Budgeted evidence profile**: up to ~10 frames, distributed audio clips (~40–45 s each), transcribed-seconds caps (~180–240 s), full-timeline offsets (not “first minute only”) |
| AI timeout | Unbounded / painful UX | **60 s** per Gemini call (+ retries), concurrency capped |
| Identical re-upload | Full cost again | **Decision reuse by content hash** (policy/prompt versioned) |
| User wait | Minutes on spinner | Upload done; status / notification later |
| Failure mode | Failed upload | Quarantine / `under_review` / reject without killing API |

**Rough durations (architecture-based, not yet multi-week p95 from Contabo):**

| Content | AI verification window (worker) |
|---------|----------------------------------|
| Short clip / known hash reuse | **Seconds – ~1 min** |
| Typical sermon video | **~1–5 min** moderation stage |
| Long / escalated evidence | Toward **upper single-digit minutes** + possible human review |
| Plus HLS encode | **Additional** 1–15+ min in parallel pipeline after approve path |

### 8.B Creator / artist / church **account** verification

**What it is:** Admin flags (`isVerifiedCreator`, `isVerifiedArtist`, etc.) via `PATCH /api/admin/users/:id/verification`.

| | Reality |
|--|---------|
| API latency | **&lt; 500 ms** typical (Mongo update) |
| End-to-end “how long to get verified” | **Human process** (review documents / trust) — product/ops SLA, not compute |
| Improvement vs before | Unified admin APIs + dashboard queue; same Mongo users for mobile + admin web |

Do not conflate “AI moderated my video in 3 minutes” with “artist badge approved by admin.”

---

## 9. What we still need to do

| Priority | Item | Why it matters | Est. effort |
|----------|------|----------------|-------------|
| **P0** | Finish **client migration** to staged upload (drop legacy multipart for production video) | Realizes RAM/CPU and UX gains | **3–7 days** (mobile + web + QA) |
| **P0** | Capture **baseline p50/p95** on Contabo via `npm run measure:latency` (+ upload/moderation timings separately) | Shareholder-grade numbers, not estimates | **Script ready** — run on Contabo (~30 min including paste into this doc) |
| **P0** | Alerts: BullMQ `mediaProcessing` waiting/failed, Gemini budget blocks, Redis down, API RSS | Prevent silent backlog | **1–3 days** |
| **P1** | Worker scale playbook (2nd worker when queue &gt; N) | Launch traffic | **1–2 days** docs + config |
| **P1** | CDN cache-hit / R2 egress dashboard | Playback cost & speed | **2–5 days** (Cloudflare analytics wiring) |
| **P1** | Gemini Tier 1 + production budget tuning | Avoid free-tier throttling at onboarding | **0.5–1 day** + billing |
| **P2** | Optional APM (OpenTelemetry / vendor) | Continuous shareholder reporting | **1–2 weeks** |
| **P2** | Further encode presets (faster 360p-first publish) | “Watch sooner” while 1080p finishes | **3–7 days** engineering |
| **Deferred** | Server “For You” ranking | Explicitly deferred; not a latency blocker for launch | Separate track |

---

## 10. Timeline (recommended)

```text
Week 1
  ├─ Client staged-upload only for video/sermon
  ├─ Contabo smoke + first latency spreadsheet (health, metrics, 20-sample timings)
  └─ Queue / Gemini / Redis alerts

Week 2
  ├─ Publish measured before/after one-pager (replace estimates with p50/p95)
  ├─ Worker scale test (parallel uploads)
  └─ CDN cache rules verified in production

Week 3–4 (optional stretch)
  ├─ APM or structured latency logs by route
  └─ Faster “first playable” encode ladder
```

**If we only do Week 1–2:** shareholders get **honest measured numbers** and launch risk on upload/moderation is controlled.  
**Week 3–4:** continuous reporting quality, not a new product architecture.

---

## 11. Resource snapshot (how to quote “current” live)

### 11.1 One-command latency baseline (do this)

```bash
AUTH_TOKEN=<jwt> BASE_URL=https://api.yourhost.com SAMPLES=20 npm run measure:latency
```

Script: `scripts/measure-latency.js` · also listed in [CONTABO_SMOKE.md](./CONTABO_SMOKE.md) §7.

It outputs a markdown table (warmup, health, feed, metadata, **like**, idempotency replay, metrics) with **min / p50 / p95 / max**. Paste that table below (replace the placeholder) for the board pack.

**Measured Contabo (fill after first run):**

| Endpoint | ok/n | min | p50 | p95 | max | avg |
|----------|------|-----|-----|-----|-----|-----|
| *(run `npm run measure:latency` and paste)* | | | | | | |

### 11.2 Live process / queue snapshot

```http
GET /api/health/full

GET /api/metrics
Authorization: Bearer <admin_access_token>
```

Paste into the board pack:

- `services.memory.heapUsed` / `rss` (MB)  
- `services.cpu.usage` / `cores`  
- `services.database.responseTime` (ms)  
- `queues.mediaProcessing` waiting / active / failed  
- `moderation.aiBudget` (requests vs daily budget)  
- `process.uptime`

Re-run weekly during launch ramp.

---

## 12. One-slide summary for the board

1. **Interactive API** designed for **sub-second** engagement; caches and Redis protect the hot path.  
2. **Likes** commit to Mongo first (**~100–400 ms**), then Redis + sockets — retries won’t double-count (`Idempotency-Key`).  
3. **Uploads** no longer crush the API — **direct-to-R2**; accept in **seconds**, process in the background.  
4. **Verification** of content is **async AI + optional human review**, with budgets and hash reuse — not a multi-minute HTTP hold.  
5. **CPU/RAM stress** moved to the **worker** (FFmpeg + Gemini), which we can scale independently.  
6. **Next 1–2 weeks:** finish client migration, measure real p95s (including likes), alert on queues — then replace this doc’s estimates with Contabo facts.

---

## Related docs

- [SETUP.md](./SETUP.md) — env, Gemini budgets, R2 CDN  
- [REDIS_OPS.md](./REDIS_OPS.md) — Redis / metrics fields  
- [ENGAGEMENT.md](./ENGAGEMENT.md) — like contracts, rate limits, idempotency  
- [API.md](./API.md) — staged upload contract  
- [CREATED_SO_FAR.md](./CREATED_SO_FAR.md) — shipped inventory  
- [FRONTEND_MODERATION.md](./FRONTEND_MODERATION.md) — admin review UX  
- [CONTABO_SMOKE.md](./CONTABO_SMOKE.md) — post-deploy checks  
