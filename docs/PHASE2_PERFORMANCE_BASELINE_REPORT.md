# Phase 2 Deliverable — Performance Baseline Report

**Project:** Jevah (mobile + backend + web)  
**Phase:** 2 — Performance Analysis  
**Date:** 31 July 2026  
**Objective:** Measure actual performance and establish baselines for Phases 3–6.

**How to read this document**

| Label | Meaning |
|-------|---------|
| **Baseline (design)** | Engineering target / architecture expectation |
| **Observed (lab)** | Seen in development or short probes — not Contabo SLO |
| **TBD Contabo** | Must be filled from Contabo production/staging |
| **TBD FE** | Frontend team must measure on device/browser |

---

## 1. Scope

### Frontend metrics (required)

- App startup time  
- Page / screen load time  
- Screen transition speed  
- Ebook load time  
- Video load time  

### Backend metrics (required)

- API response time  
- Database response time  
- CPU usage  
- Memory usage  

---

## 2. Measurement methods

### 2.1 Backend (available today)

| Metric | Method | Command / endpoint |
|--------|--------|-------------------|
| API response time | Server access log `responseTime` | Watch Contabo / PM2 logs; optional Artillery |
| Database response time | Health ping | `GET /api/health/database` → `responseTime` ms |
| CPU / memory (snapshot) | Health full | `GET /api/health/full` |
| Process memory + queues | Admin metrics | `GET /api/metrics` (admin JWT) |
| Redis | Ping + error rate | `redis-cli ping`; connection logs |
| Smoke | Checklist | [CONTABO_SMOKE.md](./CONTABO_SMOKE.md) |

### 2.2 Frontend (owners: mobile / web)

| Metric | Suggested method | Notes |
|--------|------------------|-------|
| App startup | Cold start timestamp → first interactive | Median of 10 runs, mid-tier Android + iOS |
| Page / screen load | Navigation start → data ready + first paint | Feed, profile, music, sermons |
| Screen transition | Interaction → next screen settled | Target feel &lt; 300 ms animation + data |
| Ebook load | Open → first page readable | Network + parse |
| Video load | Play intent → first frame | Separate CDN time vs player ready; log `duration` from API |

---

## 3. Backend baselines

### 3.1 API response time

| Endpoint / class | Baseline (design) | Legacy before | Observed (lab) | Contabo p50 | Contabo p95 |
|------------------|-------------------|---------------|----------------|-------------|-------------|
| `POST .../like` | 100–400 ms | Unreliable / unclear | Often sub-second when Redis healthy | TBD Contabo | TBD Contabo |
| `GET .../all-content` (cached) | 100–600 ms | Heavy Mongo often | Cache hit path designed | TBD Contabo | TBD Contabo |
| `GET .../all-content` (miss) | 500–8000 ms | Multi-second | Slow-feed warnings seen in lab | TBD Contabo | TBD Contabo |
| `POST /auth/login` | 200–800 ms | Mixed | — | TBD Contabo | TBD Contabo |
| Upload intent | 200–1000 ms | N/A (legacy multipart) | — | TBD Contabo | TBD Contabo |
| Upload finalize | 300–2000 ms | **2–15+ min** API hold on large files | — | TBD Contabo | TBD Contabo |
| Legacy multipart upload | Avoid | Seconds–minutes | Still possible if FE uses it | Must be ~0 traffic | — |
| Metadata / comments | &lt; 500–1500 ms | — | Lab: can spike to **10–80 s** when Upstash/Mongo WAN fails | TBD Contabo | TBD Contabo |

**Interpretation:** The largest architectural win is **upload accepted**: from **minutes on the API** to **~1–3 seconds** for intent/finalize, with bytes on R2 and processing in the worker.

### 3.2 Database response time

| Check | Baseline (design) | Contabo |
|-------|-------------------|---------|
| Mongo ping (`/api/health/database`) | Typically &lt; 50–200 ms to Atlas | TBD Contabo (record 20 samples) |
| Aggregation-heavy feed miss | Up to several seconds | TBD Contabo |

### 3.3 CPU usage

| Process | Before (legacy upload on API) | After (design) | Contabo baseline |
|---------|-------------------------------|----------------|------------------|
| API | Spiked with every large upload | Relatively flat under staged upload | TBD Contabo (`health/full`, `top`) |
| Worker | N/A or coupled | Spikes during FFmpeg + AI | TBD Contabo |

### 3.4 Memory usage

| Process | Before | After (design) | Contabo baseline |
|---------|--------|----------------|------------------|
| API RSS | Grew with in-memory file buffers | Should stay comparatively stable | TBD Contabo (`/api/metrics` heap/RSS) |
| Worker | — | Grows with concurrent transcodes | Cap concurrency; TBD Contabo |

---

## 4. Frontend baselines (templates)

*Fill after instrumented runs. Do not invent numbers.*

### 4.1 App startup time

| Device | Network | Cold start (ms) | Warm start (ms) | Date |
|--------|---------|-----------------|-----------------|------|
| Android mid-tier | Wi‑Fi | TBD FE | TBD FE | |
| iOS | Wi‑Fi | TBD FE | TBD FE | |

**Target (product):** Cold start interactive under **3–5 s** on mid-tier (adjust after first real samples).

### 4.2 Page / screen load time

| Screen | First load (ms) | Cached / revisit (ms) | Date |
|--------|-----------------|----------------------|------|
| All Content feed | TBD FE | TBD FE | |
| Profile | TBD FE | TBD FE | |
| Music (CF / Artists) | TBD FE | TBD FE | |
| Sermons list | TBD FE | TBD FE | |
| Admin dashboard (web) | TBD FE | TBD FE | |

### 4.3 Screen transition speed

| Transition | Duration (ms) | Notes |
|------------|---------------|-------|
| Tab switch | TBD FE | |
| Feed → comments sheet | TBD FE | |
| Feed → profile | TBD FE | |

**Target (feel):** Animation + local state &lt; **300 ms**; network-bound overlays may take longer but should not block chrome.

### 4.4 Ebook load time

| Asset size | Time to first page (ms) | Date |
|------------|-------------------------|------|
| Small | TBD FE | |
| Large | TBD FE | |

### 4.5 Video load time

| Scenario | Time to first frame (ms) | API `duration` present? | Source (MP4 vs HLS) | Date |
|----------|--------------------------|-------------------------|---------------------|------|
| Feed card, warm CDN | TBD FE | Yes / No | Prefer MP4 | |
| New upload after ready | TBD FE | Must be Yes | MP4 | |
| Long sermon | TBD FE | Yes | MP4 then HLS optional | |

**Backend contract for video:** Prefer `fileUrl`/`playbackUrl` MP4; enable scrub when `duration > 0`. See [FRONTEND_VIDEO_DURATION_HANDOFF.md](./FRONTEND_VIDEO_DURATION_HANDOFF.md).

---

## 5. Before vs after (backend — stakeholder summary)

| Metric | Before | After (current architecture) |
|--------|--------|------------------------------|
| Upload “accepted” | **2–15+ minutes** API-bound | **~1–3 seconds** API; cloud upload parallel |
| Like toggle | Fragile under retry | **~100–400 ms** durable |
| Feed (warm) | Often heavy | **~100–600 ms** target |
| Moderation on upload tap | Could block minutes | Background worker |
| API RAM on big upload | Spiked | Light (worker encodes) |

Full narrative: [STAKEHOLDER_PROGRESS_REPORT.md](./STAKEHOLDER_PROGRESS_REPORT.md) §5.

---

## 6. Lab noise to exclude from Contabo baseline

Do **not** mix these into production baselines:

| Lab symptom | Cause |
|-------------|--------|
| Redis `ETIMEDOUT` / `ECONNRESET` to Upstash | WAN Redis from laptop |
| API calls 5–80 s then 500 | Redis/Mongo pile-up under flaky network |
| Upload 401 | Invalid JWT — not performance |
| Wrong LAN IP timeouts | Device pointing at stale `192.168.x.x` |

---

## 7. Contabo capture checklist (fill Phase 2 completely)

Run on Contabo after [CONTABO_SMOKE.md](./CONTABO_SMOKE.md):

```bash
# Database
curl -s "$API/api/health/database" | jq .

# Full health (CPU/memory snapshot)
curl -s "$API/api/health/full" | jq .

# Metrics (admin token)
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$API/api/metrics" | jq .

# Timed interactive calls (example)
curl -s -o /dev/null -w "%{time_total}\n" -H "Authorization: Bearer $TOKEN" \
  "$API/api/media/all-content?page=1&limit=12"
```

Record **20+ samples** over peak and off-peak → compute p50/p95 → paste into §3 tables.

---

## 8. Exit criteria for Phase 2

| Criterion | Status |
|-----------|--------|
| Backend design baselines documented | **Done** |
| Contabo API p50/p95 filled | **Open** |
| Contabo DB/CPU/memory snapshots recorded | **Open** |
| FE startup / screens / ebook / video tables filled | **Open (FE)** |
| Baseline Report shared with stakeholders | This document (partial until Contabo + FE) |

---

## 9. Sign-off

| Role | Action |
|------|--------|
| Backend | Maintain §3; complete Contabo columns |
| Mobile FE | Complete §4 |
| Web FE | Complete admin/sermons rows in §4 |
| Product | Accept targets after first Contabo + device week |

**Deliverable:** Performance Baseline Report (living document — Contabo and FE cells TBD until measured).
