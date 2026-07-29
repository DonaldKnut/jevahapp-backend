# Admin handoff status (backend → web FE)

**Date:** 29 July 2026  
**Repo:** `jevahapp-backend` (`main`)  
**Audience:** Vite/React admin console

## Mobile safety (read this first)

| Change | Mobile impact |
|--------|----------------|
| Banned login `403` | Same as `verifyToken` — correct; banned users must not get tokens |
| `/me` + login add `isBanned` / `isMasterAdmin` | **Additive** — ignore if unused |
| Platform gates on register/upload | Only when admin turns off registration/uploads/maintenance — intentional |
| Public `GET /api/app/config` | New optional — mobile can poll for maintenance / min version |
| All new `/api/admin/*` | **Admin-only** — mobile never hits these |
| Media fields `moderationAssignee`, `moderationNoteThread` | Optional schema additions — feed serializers ignore them |
| Track fields on copyright-free songs | Additive; public list filters drafts / pending |

**Verdict:** Web admin APIs are isolated behind `requireAdmin`. Mobile feeds/likes/comments/auth contracts are unchanged except additive fields and kill-switch gates. Curated music still uses `GET /api/audio/copyright-free`.

---

## Status vs your handoff

### P0 — DONE
- Master ban / demote / delete protected
- Seed: `npm run seed:super-admin`
- `/me` + banned login + audits

### P1 — DONE
- Bulk moderation/reports, preview-refresh, warn, assign, notes, rerun, enriched user

### P2 — DONE
- Config + public app config, media search, timeseries, notifications, health
- **Announcements** admin + `GET /api/app/announcements`
- **Categories** CRUD
- **Church** GET-by-id + branch patch/delete
- **Email** `dryRun` + `GET /api/admin/email/log`
- **Audio Track** presigned upload (`FRONTEND_AUDIO_TRACKS.md`)
- **Artists** admin CRUD + `POST /api/creators/apply`

### Still open (non-blocking)
- Admin Socket.IO rooms
- Job list/retry UI APIs
- Full OpenAPI collection

---

## FE consume efficiently

1. Audio library: switch to upload-intent → PUT → finalize (URL paste still works).
2. Prefer `{ success, data }` unwrap; list keys may be `items` **and** aliases.
3. Master UI: gate with `user.isMasterAdmin`.
4. Poll health + notifications every 30–60s until sockets land.
5. Creator onboarding: apply → pending → admin activate (see audio tracks doc).

## Seed reminder

```powershell
$env:SUPER_ADMIN_PASSWORD='your-strong-password-here'
npm run seed:super-admin
```
