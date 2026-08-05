# Admin handoff status (backend → web FE)

**Date:** 2026-08-02 (updated)  
**Repo:** `jevahapp-backend` (`main`)  
**Audience:** Vite/React admin console **and** Next.js admin/marketing  

**Next.js correction handoff (send to FE):** [FRONTEND_NEXT_ADMIN_HANDOFF.md](./FRONTEND_NEXT_ADMIN_HANDOFF.md)

## Mobile safety (read this first)

| Change | Mobile impact |
|--------|----------------|
| Banned login `403` | Same as `verifyToken` — correct; banned users must not get tokens |
| `/me` + login add `isBanned` / `isMasterAdmin` + verification flags | **Additive** — ignore if unused |
| Platform gates on register/upload | Only when admin turns off registration/uploads/maintenance — intentional |
| Public `GET /api/app/config` | New optional — mobile can poll for maintenance / min version |
| All new `/api/admin/*` | **Admin-only** — mobile never hits these |
| Media fields `moderationAssignee`, `moderationNoteThread`, `deletedAt` | Optional schema additions — feed serializers ignore them; soft-delete uses tombstone + hide |
| Track fields on copyright-free songs | Additive; public list filters drafts / pending |
| Aliases `/api/register`, `/api/me`, `/api/auth/resend-verification`, `POST /api/admin/reports/:id/:action` | Additive; canonical paths unchanged |

**Verdict:** Web admin APIs are isolated behind `requireAdmin`. Mobile feeds/likes/comments/auth contracts are unchanged except additive fields and kill-switch gates. Curated music still uses `GET /api/audio/copyright-free`.

---

## Status vs your handoff

### P0 — DONE
- Master ban / demote / delete protected
- Seed: `npm run seed:super-admin`
- `/me` + banned login + audits
- Soft-delete default for admin media delete (`?hard=true` for permanent)

### P1 — DONE
- Bulk moderation/reports, preview-refresh, warn, assign, notes, rerun, enriched user
- Next-compat report action alias + moderation `pending` / `flagged` aliases

### P2 — DONE
- Config + public app config, media search, timeseries, notifications, health
- **Announcements** admin + `GET /api/app/announcements`
- **Categories** CRUD
- **Church** GET-by-id + branch patch/delete
- **Email** `dryRun` + `GET /api/admin/email/log`
- **Artist onboard email** `POST /api/admin/email/artist-onboard` + dashboard `reminders[]` ([FRONTEND_MARKETING_EMAIL_HANDOFF.md](./FRONTEND_MARKETING_EMAIL_HANDOFF.md) §4)
- **Audio Track** presigned upload (`FRONTEND_AUDIO_TRACKS.md`)
- **Artists** admin CRUD + `POST /api/creators/apply`

### Still open (non-blocking)
- Admin Socket.IO rooms
- Job list/retry UI APIs
- Full OpenAPI collection

---

## FE consume efficiently

1. Audio library: switch to upload-intent → PUT → finalize (URL paste still works).
2. Prefer `{ success, data }` unwrap; list keys may be `items` **and** aliases — see Next handoff §3.
3. Master UI: gate with `user.isMasterAdmin`.
4. Poll health + notifications every 30–60s until sockets land.
5. Creator onboarding: apply → pending → admin activate (see audio tracks doc).
6. Next app: set `NEXT_PUBLIC_API_URL`; do not rebuild Media/Report on Next.

## Seed reminder

```powershell
$env:SUPER_ADMIN_PASSWORD='your-strong-password-here'
npm run seed:super-admin
```
