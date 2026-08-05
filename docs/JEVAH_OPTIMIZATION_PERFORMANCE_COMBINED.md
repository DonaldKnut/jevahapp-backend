# Jevah Optimization & Performance Report (Combined)

**Date:** 31 July 2026  
**Audience:** Stakeholders, product, engineering  
**Scope:** Backend achievements, what we enforce, before/after speed (especially video), and the optimization lifecycle  
**Status:** Architecture largely shipped; Contabo multi-day p50/p95 and full frontend timings still to be filled from production/device runs

This document **combines** the Optimization Lifecycle (Phases 1–6), Technical Audit, Performance Baseline, and progress narrative into one place.

---

## 1. Executive summary

Jevah’s backend moved from a **slow, API-heavy** model (server holds big videos, waits on AI, struggles under likes/feed load) to a **split, production-oriented** model:

| Then | Now |
|------|-----|
| Upload bytes through the API | Upload **direct to Cloudflare R2** |
| Moderation / encode on the request | **Background workers** |
| Likes easy to lose or drift | **Mongo durable** then Redis cache |
| Video scrub often broken (no duration / bad stream) | **Faststart MP4 + VOD HLS + stored `duration`** |
| Shelves mixed risk | **Hard rules**: CF ≠ Artists ≠ video feed |

**Headline speed:** “Upload accepted” went from often **2–15+ minutes** on the API to about **1–3 seconds** for intent + finalize. Likes target **100–400 ms**. Warm feed target **100–600 ms**. Long encode/moderation still take **minutes**—but **in the background**, so the rest of the app stays usable.

---

## 2. The optimization lifecycle (where we are)

| Phase | Name | Goal | Our status |
|-------|------|------|------------|
| **1** | Audit & Discovery | Know systems & risks | **Done** (see §3–4) |
| **2** | Performance Analysis | Measure baselines | **Partial** — design baselines done; Contabo p95 + FE device tables open (§6–7) |
| **3** | Architecture Improvement | Fix structure | **Largely done** (§5) |
| **4** | Code Optimization | Hot-path tighten | Ongoing (indexes, duration edge cases, projections) |
| **5** | Testing & Validation | Prove on Contabo + devices | Contabo smoke exists; full pack open |
| **6** | Production Monitoring | Dashboards & alerts | Health/metrics exist; formal APM open |

```text
Audit → Measure → Architecture → Code → Validate → Monitor → (repeat)
```

---

## 3. What we already have (platform inventory)

| Component | What it does |
|-----------|----------------|
| **API** | Auth, feed, engagement, admin, upload intent/finalize, enqueue jobs |
| **Worker** | AI moderation (Gemini), FFmpeg transcode, publish live media |
| **MongoDB Atlas** | Source of truth (users, media, likes, comments, tracks, sermons) |
| **Redis (Contabo)** | Feed cache, like hot path, sessions, rate limits, BullMQ — `127.0.0.1` |
| **Cloudflare R2** | Video/audio/image bytes + public CDN URLs |
| **Socket.IO** | Realtime likes/comments/presence |
| **Admin APIs** | Moderation, bans, reports, analytics hooks |
| **Product APIs** | All-content feed, Artists/Tracks, copyright-free shelf, public sermons |

**Important:** Laptop + **Upstash** Redis can look “slow” (timeouts). **Contabo local Redis** is the real production path—measure SLOs there, not on flaky WAN Redis.

### 3.1 Who we build for (first-party clients of this API)

| Client | Typical base | Uses |
|--------|--------------|------|
| **Jevah mobile (Expo)** | Contabo HTTPS or LAN `:4000` in dev | Feed, upload, likes, comments, creators, music, push |
| **Web admin dashboard** | Same API + `/api/admin/*` | Moderation, users, bans, reports, analytics |
| **Marketing / sermons web** | Same API | Public `/api/sermons`, catalogs |
| **Production API (Contabo)** | Public Contabo HTTPS / `API_BASE_URL` | Feed, upload, likes, admin, catalogs |

Mobile must **not** call `/api/admin/*`. Admin is web-console only.

### 3.2 External vendors & endpoints (who we depend on)

These are **third-party / hosted** systems outside the Node process. Secrets stay in `.env` — never commit them.

| Vendor / product | Role for Jevah | Typical endpoint / host pattern | Env keys (names only) |
|------------------|----------------|----------------------------------|------------------------|
| **MongoDB Atlas** | Primary database | `mongodb+srv://…mongodb.net/…` | `MONGODB_URI` |
| **Contabo (VPS)** | Production API + worker host; optional live RTMP/HLS | Your Contabo public IP/domain; RTMP/HLS if configured | Hosting; `CONTABO_RTMP_SERVER`, `CONTABO_HLS_SERVER`, `CONTABO_DASH_SERVER` |
| **Redis (on Contabo)** | Cache, sessions, queues, likes hot path | `redis://127.0.0.1:6379` (localhost on server) | `REDIS_URL` |
| **Upstash Redis** | Optional cloud Redis / REST for **dev** only (not Contabo prod hot path) | `*.upstash.io:6379` (`rediss://…`); REST URL | `REDIS_URL` (if pointed at Upstash), `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| **Cloudflare R2** | Media object storage + CDN delivery | S3 API: `https://<accountid>.r2.cloudflarestorage.com`; public: custom domain or `pub-….r2.dev` | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`, `R2_CUSTOM_DOMAIN`, … |
| **Google Gemini (Google AI)** | Content moderation, transcription, track metadata review | `https://generativelanguage.googleapis.com/v1beta/models/…:generateContent` | `GOOGLE_AI_API_KEY`, `GEMINI_*` |
| **Expo** | Mobile push notifications | Expo Push API (`expo.dev` access token) | `EXPO_ACCESS_TOKEN` |
| **Clerk** | Optional OAuth / social identity | `https://clerk.dev` JWKS / issuer (or project-specific Clerk URLs) | `CLERK_JWKS_URI`, `CLERK_ISSUER_URL`, `CLERK_AUDIENCE`, Clerk secret keys if used |
| **Azure Cognitive Services (TTS)** | Ebook / speech synthesis | Azure TTS regional endpoint | `AZURE_TTS_KEY`, `AZURE_TTS_REGION`, `AZURE_TTS_ENDPOINT` |
| **Resend / SMTP** | Transactional email (verify, reset, welcome) | Resend API and/or SMTP host | Configured in email service env (see SETUP) |
| **Public DNS (optional)** | Fix Windows `mongodb+srv` resolution | e.g. `8.8.8.8`, `1.1.1.1` | `DNS_SERVERS` |

**Cost / risk notes for stakeholders**

| Vendor | Scales with | Risk if down |
|--------|-------------|--------------|
| Atlas | Reads/writes, aggregations | App cannot load data |
| R2 | Storage + egress (video watch) | Uploads/playback fail |
| Gemini | Upload volume × frames/audio | Moderation delayed/failed |
| Contabo Redis | Cache + queues | Slower feeds; queue backlog |
| Expo | Notification volume | Silent push until restored |
| Azure TTS | Ebook listen usage | TTS features degrade |
| Upstash (dev) | Dev laptop only | Local demos look “broken” — use Contabo Redis in prod |

### 3.3 Data flow (who talks to whom)

```text
  [Mobile / Web Admin / Marketing]
              │
              ▼
     Jevah API (Contabo) ──────► MongoDB Atlas
              │                ► Redis (localhost on Contabo)
              │                ► Cloudflare R2 (presign + public CDN)
              │                ► Clerk (optional auth)
              │                ► Resend/SMTP (email)
              │                ► Expo (push)
              ▼
     Jevah Worker (Contabo) ───► Gemini (moderation / AI)
              │                ► FFmpeg (local) → writes back to R2
              │                ► Azure TTS (ebook paths)
              └──────────────► Mongo + Redis (job state)
```

---

## 4. What we have done (achievements)

### 4.1 Upload & processing

- **Staged upload:** intent → client PUT to R2 → finalize → queue.  
- **Workers:** moderation then transcode/publish—not on the upload HTTP path.  
- **Legacy multipart** still exists but is the old, slow path clients should leave.

### 4.2 Engagement

- **Likes:** write Mongo first, then Redis; idempotency + rate limits.  
- **Views:** thresholds + dedupe so vanity inflation is controlled.  
- **Comments:** create/edit/images/mentions with FE handoffs.  
- **Feed cache:** generation bump so structural changes don’t resurrect stale lists.

### 4.3 Gospel product surfaces

- **Copyright-free** vs **Artists** lanes (hard filters + tests).  
- **Creator** apply / studio / me tracks.  
- **Public sermons** catalog for marketing web.  
- Admin console hardened (P0–P2 style gates).

### 4.4 Video playback (scrubber)

- Transcode to **progressive faststart MP4** (`moov` at start).  
- **VOD HLS** when encode succeeds (`PLAYLIST-TYPE:VOD`).  
- **ffprobe `duration`** persisted on Media; returned on feed / detail / status.  
- Heal ran once for **17** videos missing duration.  
- FE handoff: prefer MP4; poll until `duration > 0`.

### 4.5 Correctness fixes

- Feed only shows publicly live content (no draft tease → 404 on like).  
- Delete cascades staging + derivative R2 keys.  
- GET-by-id passes owner/admin auth (under-review no longer looks “missing”).  

---

## 5. What we enforce (rules the backend now holds)

| Rule | Why |
|------|-----|
| **Public feed = approved + live + not hidden** | Users don’t like ghosts |
| **Likes durable before HTTP 200** | Counts survive retries |
| **Like rate limits + optional Idempotency-Key** | Abuse and double-tap safety |
| **CF shelf ≠ artist lane ≠ All Content video dump** | Clean Gospel product story |
| **Mobile never calls `/api/admin/*`** | Security boundary |
| **Heavy AI/FFmpeg off API process** | API stays responsive |
| **Ready videos should expose `duration` + seekable MP4** | TikTok-style scrub |
| **Contabo Redis on localhost** | Stable cache/queues (not Upstash-for-prod) |

---

## 6. How much faster we are now

Numbers are **engineering baselines / architecture targets**. Formal Contabo **p50/p95** over days = next measurement step.

### 6.1 Headline table

| What users feel | Before | Now | What changed |
|-----------------|--------|-----|--------------|
| **Upload “done uploading / accepted”** | Often **2–15+ minutes** (API held the whole file) | **~1–3 seconds** intent + finalize; bytes to R2 | Direct cloud upload + async queue |
| **Like / unlike** | Easy to feel lost under bad network | **~100–400 ms** durable | Mongo-first + Redis + sockets |
| **Feed (warm cache)** | Heavy DB on many scrolls | **~100–600 ms** target | Redis generation cache + flag overlay |
| **Feed (cold miss)** | Multi-second | Still **~1–8 s** possible until warm | Better when cached; still tune |
| **Login** | Mixed | **~200–800 ms** | Standard interactive path |
| **AI moderation** | Could block the upload tap for minutes | **Background** (minutes of worker time) | Worker pipeline |
| **API memory on big upload** | Spiked with file size | Stays comparatively light | No big buffer on API |

### 6.2 Video specifically — slower before, faster / better now

Video was the worst offender for both **waiting** and **playback quality**.

| Video concern | Before | Now | What we did differently |
|---------------|--------|-----|-------------------------|
| **Time until “upload accepted”** | Minutes on API for large sermons | Seconds for API accept; cloud transfer is the progress bar | R2 staged upload |
| **Time until playable derivatives** | Often unclear / blocked on request | Background FFmpeg (still minutes for long files—**expected**) | Worker transcode job |
| **First play / seek** | Incomplete HLS or unknown length → player `duration = 0`, scrub broken | Prefer **faststart MP4**; API returns **`duration` seconds** | Probe + persist duration; `+faststart`; VOD HLS |
| **Feed cards** | Duration often missing on new uploads | `duration` + `processingStatus` on feed/detail/status | Serializer + aggregation enrich |
| **Old videos missing length** | Scrub failed | Batch heal filled **17** rows | `heal:media-duration` |
| **While processing** | Clients guessed | `processing` / `pending` vs `ready` | Status contract for FE poll |

**Plain language:**  
- **Upload waiting** is dramatically faster for the *app* (no more “server digesting 200 MB”).  
- **Encoding** is not instant—it moved to the background so scrolling/liking stay fast.  
- **Watching & scrubbing** is better because the file is seekable and the length is known—once the client uses MP4 + `duration` (FE still finishing that wiring).

### 6.3 Target bands (Contabo healthy)

| Class | Target |
|-------|--------|
| Hot (health, cache hits) | &lt; 100 ms |
| Interactive (like, comment, login) | &lt; 500 ms |
| Lists (feed, admin) | 0.5–1.5 s |
| Upload finalize | 1–3 s HTTP |
| Background AI / FFmpeg | Not on tap latency |

---

## 7. What we did differently (architecture)

```text
BEFORE
  Phone ──whole file──► API (buffer + maybe AI + maybe encode) ──► storage
                         ▲ freezes UX, burns RAM/CPU for minutes

AFTER
  Phone ──presign──► R2 (bytes)
  Phone ──finalize──► API (~1–3 s) ──queue──► Worker (Gemini + FFmpeg → MP4/HLS + duration)
  Phone ──like/feed──► API + Contabo Redis + Mongo
```

| Layer | Different approach |
|-------|-------------------|
| **Bytes** | Client → R2, not API RAM |
| **Safety** | Async moderation |
| **Playback** | Always aim for progressive MP4 + known duration; HLS as VOD add-on |
| **Truth** | Mongo for likes/media; Redis as accelerator |
| **Products** | Explicit shelves and filters |

---

## 8. Performance baseline templates (Phase 2)

### 8.1 Backend — Contabo fill-in

| Metric | How to capture | p50 | p95 | Date |
|--------|----------------|-----|-----|------|
| Like | Timed Contabo curl / logs | TBD | TBD | |
| Feed cached | Timed Contabo | TBD | TBD | |
| Feed miss | Timed Contabo | TBD | TBD | |
| Mongo ping | `GET /api/health/database` | TBD | TBD | |
| API RSS / CPU | `GET /api/health/full`, `/api/metrics` | TBD | TBD | |

### 8.2 Frontend — device fill-in (FE owns)

| Metric | Mid Android | iOS | Date |
|--------|-------------|-----|------|
| App cold start | TBD | TBD | |
| Feed screen load | TBD | TBD | |
| Screen transition | TBD | TBD | |
| Ebook first page | TBD | TBD | |
| Video time-to-first-frame | TBD | TBD | |

**Video FE contract:** Prefer `fileUrl`/`playbackUrl` MP4; scrub only when `duration > 0`; poll after finalize until `processingStatus === "ready"`.

---

## 9. Gaps & next build

| Gap | Owner |
|-----|--------|
| Contabo p50/p95 week of data | Ops / backend |
| FE migrate fully off legacy multipart | Mobile / web |
| FE scrubber uses duration + MP4 | Mobile |
| Refuse or re-probe `ready` without duration | Backend |
| Formal dashboards / alerts | Ops (Phase 6) |
| Don’t demo prod UX over Upstash laptop | Everyone |

**Next build theme:** Prove Contabo numbers → close playback loop → finish client migration → monitor—not rewrite the architecture.

---

## 10. Overall assessment

- **Foundation:** Production-ready architecture for scale.  
- **Speed:** Order-of-magnitude win on upload accept; interactive taps designed sub-second; video seek fixed at the source (duration + faststart).  
- **Enforcement:** Visibility, likes durability, shelf separation, async heavy work.  
- **Remaining:** Measure Contabo, finish FE adoption, polish edge cases and monitoring.

---

## 11. Related deep-dives (optional)

| Topic | Doc |
|-------|-----|
| Shareholder latency detail | [PERFORMANCE.md](./PERFORMANCE.md) |
| Contabo Redis | [REDIS_OPS.md](./REDIS_OPS.md) |
| Contabo smoke | [CONTABO_SMOKE.md](./CONTABO_SMOKE.md) |
| Video scrub FE | [FRONTEND_VIDEO_DURATION_HANDOFF.md](./FRONTEND_VIDEO_DURATION_HANDOFF.md) |
| Gospel Artists | [BACKEND_CREATORS_GOSPEL_MOBILE_HANDOFF.md](./BACKEND_CREATORS_GOSPEL_MOBILE_HANDOFF.md) |

---

*End of combined report.*
