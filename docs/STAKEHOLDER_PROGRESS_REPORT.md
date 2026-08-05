# Jevah Backend Progress Report — Stakeholder Edition

**Date:** 1 August 2026 (updated)  
**Audience:** Executives, investors, and non-technical stakeholders  
**One-line takeaway:** The backend was rebuilt so the app stays fast while videos upload and process in the background—and we are ready to prove that on Contabo (our production server), not on the old Render host.

---

## Plain-English glossary (read this first)

| Term | What it means for Jevah |
|------|-------------------------|
| **Backend / API** | The brain of the product: login, feed, likes, uploads, admin tools. Phones and websites talk to it. |
| **Worker** | A second process that does heavy jobs (AI safety checks, video encoding) **without freezing** the app. |
| **Contabo** | Our **production server** (VPS). This is where the live API and worker run. |
| **Cloudflare R2** | Cloud hard drive + CDN for videos, audio, and images. |
| **MongoDB Atlas** | Cloud database—the permanent record of users, posts, likes, comments, music, sermons. |
| **Redis** | Fast short-term memory on Contabo (caches, queues). Makes feed and likes feel instant. |
| **Gemini (Google AI)** | AI used to help moderate unsafe uploads. |
| **Duration** | Length of a video in seconds. Needed so users can scrub (drag) the timeline like TikTok. |
| **Faststart MP4** | A video file format that starts and seeks quickly (scrubber works). |

---

## 1. Executive summary

This report explains **what the backend team changed**, **why it matters for the business**, and **what is left**—in language meant for leadership.

**The problem we solved:**  
Older designs made the main server **hold huge video files**, wait for AI checks, and sometimes encode video **while the user stared at a spinner**. That made the whole product feel slow and fragile under growth.

**What we do now:**

1. The **app stays responsive** for everyday actions (login, scroll, like, comment).  
2. **Large videos go straight to cloud storage** (R2)—the API only “accepts” the job in seconds.  
3. **AI moderation and video processing** run on a **background worker**.  
4. **Likes and feed data** are stored reliably and cached for speed.  
5. **Gospel products** (Artists / Tracks / Sermons) have clear shelves so content does not mix wrongly.  
6. **Video scrubbing** is supported by storing each video’s **duration** and producing seekable playback files.  
7. **Production hosting is Contabo**—we no longer rely on Render.com.

**Result:** Faster felt experience, better ability to grow, clearer path to launch. Next focus: **measure Contabo live**, finish **mobile/web migration** to the new upload flow, and close **playback** on devices.

---

## 2. Core platform (what Jevah runs on)

Think of the product as layers. Stakeholders should know these **core pieces**:

### 2.1 Who uses the backend

| Who | What they use it for |
|-----|----------------------|
| **Mobile app (Expo)** | Feed, upload, likes, comments, music, creators, notifications |
| **Web admin** | Moderation, bans, reports, user management, analytics |
| **Marketing / sermons website** | Public sermon catalog and discovery |

### 2.2 Core building blocks

| Core piece | Role (simple) | Why it matters |
|------------|---------------|----------------|
| **API on Contabo** | Answers every app/web request quickly | Without it, the product is offline |
| **Worker on Contabo** | Processes videos & safety checks in the background | Keeps uploads from freezing the app |
| **MongoDB Atlas** | Permanent storage of accounts & content | Source of truth |
| **Redis on Contabo** | Speed layer (cache + job queues) | Snappy feed and likes |
| **Cloudflare R2** | Stores and delivers media files | Video watch & upload |
| **Google Gemini** | Helps flag unsafe content | Trust & safety at scale |
| **Expo Push** | Notifies phones when something matters | Retention / engagement |
| **Email (Resend / SMTP)** | Verify account, reset password, welcome | Onboarding |
| **Optional: Clerk, Azure TTS** | Social login; ebook “read aloud” | Extra product features |

### 2.3 How a video upload works now (story)

```text
  User picks a video
        ↓
  App asks API for permission (seconds)
        ↓
  File goes UP TO THE CLOUD (R2) — progress bar is real
        ↓
  App tells API “I’m done” (seconds) → job queued
        ↓
  Worker: safety check → encode seekable video → save duration
        ↓
  When approved: appears in feed; scrubber can work
```

**Meanwhile** other users can still scroll and like—the API is not stuck on that one file.

---

## 3. Key achievements (self-explanatory)

### 3.1 Modern cloud upload

| | Before | After |
|--|--------|-------|
| What happened | Video passed through our server | Video goes **direct to R2** |
| User wait for “accepted” | Often **2–15+ minutes** for big sermons | About **1–3 seconds** for the API steps |
| Server load | Memory/CPU spiked | API stays light; worker does heavy work |

**In plain words:** Uploading a long sermon no longer locks up the backend for everyone else.

### 3.2 Background workers (AI + video processing)

| Job | What it does | When the user waits |
|-----|--------------|---------------------|
| **AI moderation** | Reviews content for policy risks | User does **not** wait on the upload button; status updates later |
| **Video processing** | Creates fast-start MP4 (+ optional streaming playlist), measures length | Happens in background; can still take minutes for long files—**that is normal**—but the app stays usable |

### 3.3 Engagement (likes, comments, views)

| Feature | Improvement in plain words |
|---------|----------------------------|
| **Likes** | Heart is saved for real before we say “success”—retries don’t invent fake counts |
| **Views** | Counted with rules so accidental scrolls don’t inflate vanity metrics |
| **Comments** | Create, edit, images, mentions—with clear contracts for the mobile team |
| **Feed** | Cached smartly so scrolling doesn’t hammer the database every time |

### 3.4 Gospel product experiences

| Product surface | What it is | Guardrail |
|-----------------|------------|-----------|
| **All Content feed** | Vertical / TikTok-style media | Not a dump of all music tracks |
| **Copyright-free music** | Curated listening shelf | **Not** mixed with artist uploads |
| **Artists / Tracks** | Creator apply, studio, public artist pages | Separate lane from copyright-free |
| **Sermons** | Public catalog for the marketing site | Own APIs and fields |
| **Admin console** | Human review, bans, reports | Mobile app does not call admin APIs |

### 3.5 Video playback & scrubbing

| Need | Before | After |
|------|--------|-------|
| Know video length | Often missing → scrubber stuck at 0:00 | Length stored and returned on feed/detail |
| Seek mid-video | Unreliable / incomplete streams | Prefer **seekable MP4**; VOD-style streaming when available |
| Old videos without length | Broken scrub | One-time heal updated missing lengths |

**In plain words:** We fixed the **server side** of TikTok-style scrubbing. The mobile app must finish using those fields (prefer MP4, wait until length is known).

### 3.6 Hosting cleanup

- **Render.com retired** as our host.  
- **Contabo** is the production home for API + worker + Redis.  
- Old Render URLs and cold-start “self-ping” noise removed from the default setup.

---

## 4. Business impact

| Impact | What it means for the company |
|--------|-------------------------------|
| **Faster user experience** | Login, scroll, like feel immediate; upload no longer freezes the product |
| **Scalability without crushing the API** | More uploads ≠ linearly more API memory; workers and R2 absorb load |
| **Reliability at peak** | Caches, durable likes, queues reduce “everyone taps at once” failures |
| **Cleaner roadmap** | Music, sermons, feed, admin can grow without tangling |
| **Closer to production** | Architecture ready; remaining work is measure, migrate clients, polish |
| **Trust & safety** | AI + admin tools can review content without blocking the whole app |
| **Investor-ready story** | Clear “before → after” speeds and a defined Contabo production path |

---

## 5. How much faster (numbers leadership can quote)

These are **engineering baselines** (how the system is designed and observed in healthy setups). A formal multi-day Contabo scorecard is still a next-step deliverable.

| User journey | Before | Now |
|--------------|--------|-----|
| “Upload accepted” (API done) | **2–15+ minutes** holding the file on the server | **~1–3 seconds** for intent + finalize |
| Like / unlike | Unreliable under bad network | **~0.1–0.4 seconds** with durable save |
| Feed (when cache is warm) | Often heavy | **~0.1–0.6 seconds** target |
| AI / encode | Could block the upload tap | **Background** (minutes OK; app stays usable) |

**Honest caveat:** Encoding a 2-hour sermon still takes time. The win is **users are not stuck waiting on the API** for that entire time, and scrubbing works once processing finishes and the app uses duration + MP4.

---

## 6. Current challenges (and why they matter)

| Challenge | Why it matters | Status |
|-----------|----------------|--------|
| **Finish frontend migration to new upload** | Some clients may still use the old “send file through API” path | Backend ready; FE must finish |
| **Measure Contabo live performance** | Investors need measured proof, not only design targets | Next release |
| **Finish playback on devices** | Server has duration/MP4; app must prefer them and poll until ready | FE handoff delivered |
| **Performance dashboards** | Ongoing visibility for ops and leadership | Health endpoints exist; full dashboards TBD |
| **Creator workflow polish** | Apply → upload → review → live must feel simple | In progress |

None of these require throwing away the new architecture.

---

## 7. Next release priorities

1. **Deploy & validate on Contabo** — API + worker + local Redis; run smoke tests.  
2. **Capture real speed numbers** — likes, feed, upload finalize over several days.  
3. **Close video scrubbing on mobile** — use duration + MP4; poll after upload.  
4. **Finish client migration** — no primary flow on legacy multipart upload.  
5. **Monitoring** — simple dashboards and alerts (API health, queue backlog, Redis).  
6. **Creator workflows** — clearer “processing / under review / live” status for artists.

---

## 8. Overall assessment

**The backend foundation is largely production-ready.**

Future releases should emphasize:

- **Measurement** on Contabo,  
- **Client adoption** of the new upload and playback contracts,  
- **Optimization and monitoring**,  

—not a brand-new architecture.

For stakeholders: Jevah moved from “can the server survive growth?” to “prove Contabo numbers and finish the last mile on the apps.” That is the right place for a gospel media platform preparing to scale.

---

## 9. Where to go deeper (optional)

| Document | Best for |
|----------|----------|
| [JEVAH_OPTIMIZATION_PERFORMANCE_COMBINED.md](./JEVAH_OPTIMIZATION_PERFORMANCE_COMBINED.md) | Full technical + lifecycle + vendor table |
| [PERFORMANCE.md](./PERFORMANCE.md) | Detailed latency bands |
| [CONTABO_SMOKE.md](./CONTABO_SMOKE.md) | Post-deploy checklist |
| [FRONTEND_VIDEO_DURATION_HANDOFF.md](./FRONTEND_VIDEO_DURATION_HANDOFF.md) | Mobile scrubber wiring |

---

*End of stakeholder report.*
