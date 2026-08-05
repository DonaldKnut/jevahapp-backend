# Phase 1 Deliverable — Technical Audit Report

**Project:** Jevah Backend (shared by mobile, web admin, marketing web)  
**Phase:** 1 — Audit & Discovery  
**Date:** 31 July 2026  
**Status:** Complete for current backend architecture (update after Contabo deploy)

---

## 1. Purpose

Document what systems exist, how traffic flows, where risk and technical debt remain, and what was already fixed—so Phase 2 measurement and Phase 3+ work are grounded in reality.

---

## 2. System inventory

| Component | Role | Notes |
|-----------|------|-------|
| **API (Node/Express)** | Auth, CRUD, feed, engagement, admin, enqueue jobs | Prefer thin request path |
| **Worker (BullMQ)** | Moderation (Gemini), FFmpeg transcode, publish | Needs `ffmpeg` / `ffprobe` |
| **MongoDB Atlas** | Source of truth (users, media, likes, comments, tracks) | |
| **Redis** | Cache, sessions, rate limits, idempotency, BullMQ | **Contabo: `127.0.0.1`**; laptop often Upstash (flaky) |
| **Cloudflare R2** | Media objects + public URLs | Staged upload destination |
| **Socket.IO** | Realtime like/comment/presence | Optional Redis adapter for multi-instance |
| **Resend / SMTP** | Transactional email | |

**Process layout (Contabo):** `jevah-api` + `jevah-worker` (PM2) — see [REDIS_OPS.md](./REDIS_OPS.md).

---

## 3. Critical user journeys (discovered)

| Journey | Path | Risk if wrong |
|---------|------|---------------|
| Feed scroll | `GET /api/media/all-content` (+ flags) | Slow or stale likes/views |
| Like | `POST /api/content/.../like` | Lost/duplicated counts |
| Staged upload | Intent → R2 PUT → finalize → worker | Legacy multipart still exists |
| Playback / scrub | Feed/detail `duration` + MP4/HLS | Seek broken if duration missing |
| Gospel music | CF shelf vs Artists lane | Wrong content on wrong shelf |
| Sermons | `GET /api/sermons*` | Marketing web dependency |
| Admin moderation | Queue + case APIs | Unsafe content live too long |

---

## 4. Architecture findings

### 4.1 Strengths (already improved)

| Finding | Detail |
|---------|--------|
| Upload offloaded | Direct-to-R2 staged pipeline; API no longer buffers large files on the happy path |
| Async heavy work | Moderation + transcode in worker |
| Durable engagement | Likes commit in Mongo before HTTP 200 |
| Feed cache | Generation-scoped Redis cache; structural invalidation |
| Product separation | Artists / CF / sermons / video feed rules documented + partially tested |
| Playback pipeline | Faststart MP4 + VOD HLS + persisted `duration` |

### 4.2 Risks & debt

| ID | Finding | Severity | Recommendation |
|----|---------|----------|----------------|
| A1 | Legacy `POST /api/media/upload` multipart still available | High (perf) | FE migrate 100%; deprecate/remove later |
| A2 | Laptop demos use Upstash Redis → timeouts misread as “app slow” | High (ops clarity) | Local Redis for laptop; Contabo localhost only in prod |
| A3 | FE may not poll `duration` / may prefer incomplete HLS | High (UX) | [FRONTEND_VIDEO_DURATION_HANDOFF.md](./FRONTEND_VIDEO_DURATION_HANDOFF.md) |
| A4 | `processingStatus: ready` can rare-case lack `duration` | Medium | Re-probe or block ready without duration |
| A5 | No multi-day Contabo p50/p95 dashboards yet | Medium | Phase 2 + Phase 6 |
| A6 | GET media by id previously ignored auth for under-review items | Fixed | Keep auth + vary-by-user cache |
| A7 | Worker must run or new uploads never get duration/MP4 | High | Contabo smoke includes worker |

---

## 5. Environment split (important)

| Environment | Redis | Typical API host | Audit note |
|-------------|-------|------------------|------------|
| Contabo production | `redis://127.0.0.1:6379` | Public HTTPS | **Source of truth for Phase 2 numbers** |
| Laptop + Upstash | Cloud TLS Redis | LAN IP `:4000` | DNS/timeout noise; not SLO |
| Laptop + local Redis | `127.0.0.1` | LAN IP `:4000` | Acceptable for mobile LAN testing |

---

## 6. Security & correctness audit (summary)

| Area | Status |
|------|--------|
| Master admin / ban gates | Hardened |
| Feed public visibility filter | Enforced on all-content |
| Delete media R2 cascade | Staging + derivatives collected |
| Shelf bleed (music) | Hard filters + tests |
| NSFW moderation | Async worker (requires valid auth to reach upload) |

---

## 7. Discovery backlog → next phases

| From audit | Feeds into |
|------------|------------|
| Measure Contabo API/DB/CPU/RAM | Phase 2 |
| FE startup / video / ebook timings | Phase 2 (FE) |
| Kill legacy multipart | Phase 3 |
| Duration edge cases | Phase 3–4 |
| Dashboards & alerts | Phase 6 |

---

## 8. Sign-off

| Role | Status |
|------|--------|
| Backend engineering | Audit complete for Jul 2026 codebase |
| Frontend | Must confirm client metric collection plan (Phase 2) |
| Ops / Contabo | Confirm Redis bind + PM2 both processes |

**Deliverable:** This Technical Audit Report (Phase 1 complete for backend scope).
