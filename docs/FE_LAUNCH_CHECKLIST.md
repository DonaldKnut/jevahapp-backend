# FE launch checklist — Lite + feed events + auth session

**Date:** 2026-08-10  
**Audience:** Mobile Expo + web  
**Backend:** live after Contabo pull (see [CONTABO_DEPLOY_CHECKLIST.md](./CONTABO_DEPLOY_CHECKLIST.md))

This is the **FE workstream** that unlocks ranking, Lite, and OAuth. Backend contracts are already shipped.

---

## A. Auth session (must)

Doc: [FRONTEND_AUTH_SESSION_HANDOFF.md](./FRONTEND_AUTH_SESSION_HANDOFF.md)

- [ ] After email login → store `accessToken` / `token` via `TokenUtils.storeAuthToken`
- [ ] After Google/Apple → `Clerk.getToken` → `POST /api/auth/clerk-login` → store **backend** JWT (not Clerk token)
- [ ] Boot: `hasBackendSession()` → Home; Clerk alone never grants Home
- [ ] Logout: clear backend session first, then Clerk `signOut`
- [ ] API base includes `/api` (`https://api.jevahapp.com/api`)

Smoke: Google login → `GET /api/feed/for-you` returns 200 (not 401).

---

## B. Feed events (must for ranking)

Doc: [FRONTEND_FOR_YOU_HANDOFF.md](./FRONTEND_FOR_YOU_HANDOFF.md)

- [ ] Event queue + `POST /api/feed/events` (impression / watch_time / skip)
- [ ] Soft-fail only; flush on background
- [ ] Prefer `GET /api/feed/for-you` and `GET /api/feed/music-for-you`
- [ ] Fallback chronological `GET /api/media/all-content` on 5xx

---

## C. Lite mode (2GB Android)

Doc: [FRONTEND_LITE_ANDROID_HANDOFF.md](./FRONTEND_LITE_ANDROID_HANDOFF.md)

- [ ] Heuristic + Settings toggle → `X-Jevah-Client: lite` + `?profile=lite&limit=8`
- [ ] Use on: for-you, music-for-you, **all-content** (now compact too)
- [ ] Prefer HLS; max ~360p; ≤2 video surfaces; image cache capped
- [ ] Honor `item.lite` hints from API

---

## D. Creators / Studio (when touching artists)

- [ ] Email verify before apply ([FRONTEND_ARTIST_EMAIL_VERIFICATION_HANDOFF.md](./FRONTEND_ARTIST_EMAIL_VERIFICATION_HANDOFF.md))
- [ ] Apply Zod genres = TRACK_GENRES ([FRONTEND_CREATOR_APPLY_HANDOFF.md](./FRONTEND_CREATOR_APPLY_HANDOFF.md))
- [ ] Studio analytics `GET /creators/me/analytics` + optional track detail  
  `GET /creators/me/analytics/tracks/:trackId`

---

## E. Smoke (FE + live API)

1. Email login + Google login → backend JWT stored  
2. For You `profile=lite`  
3. Music For You `profile=lite`  
4. All-content `profile=lite`  
5. Scroll → events accepted (`accepted` > 0)  
6. Creator analytics (if artist account)  
7. Admin report detail → `preview.mediaUrl` opens  

---

**Backend cannot implement Expo screens in this repo.** Use the docs above as the FE ticket list. Contabo deploy is independent — ops can run [CONTABO_DEPLOY_CHECKLIST.md](./CONTABO_DEPLOY_CHECKLIST.md) as soon as `main` is pulled.
