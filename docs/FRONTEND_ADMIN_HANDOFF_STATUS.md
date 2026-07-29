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

**Verdict:** Web admin APIs are isolated behind `requireAdmin`. Mobile feeds/likes/comments/auth contracts are unchanged except additive fields and kill-switch gates.

---

## Status vs your handoff

### P0 — DONE
- Master ban / demote / delete protected (`MASTER_ADMIN_PROTECTED`)
- Only master changes roles / ban·unban·delete other admins (`MASTER_ADMIN_REQUIRED`)
- Seed: `npm run seed:super-admin` · `SUPER_ADMIN_EMAIL`
- `/me` returns `role`, `email`, `id`, `isBanned`, `isMasterAdmin`
- Banned login `403` + `banReason` / `banUntil`
- Audits on sensitive mutations; `GET /api/admin/activity?scope=all` (master)

### P1 — DONE
- Bulk moderation + bulk report review (same side effects as single)
- `POST …/preview-refresh`
- Enriched `GET …/users/:id`
- Ban `revokeSessions` (default true)
- Warn user
- Comment report `GET …/comments/:commentId`
- Report detail `sla` + `history`
- AI `POST …/moderation/:id/rerun`
- Assign `PATCH …/moderation/:id/assign`
- Notes thread `GET/POST …/moderation/:id/notes`
- Analytics `moderation`: `pending`, `under_review`, `rejected`, `approvedToday`, `byFlag` (`avgReviewMinutes` null for now)
- Queue / detail / recent / report use `AdminMediaCard` (+ `assignee`)

### P2 — DONE (core)
- `GET/PATCH /api/admin/config` + public `GET /api/app/config` (enforced on register/upload)
- `GET …/media/search`
- `GET …/dashboard/timeseries`
- `GET …/audio/copyright-free` (admin list)
- `GET …/notifications` + `POST …/notifications/read`
- `GET …/system/health`

### P2 / P3 — STILL OPEN (not blocking)
- Announcements broadcast
- Categories CRUD
- Church GET-by-id / branch edit under `/api/admin` (list/create/patch/delete churches already exist)
- Email dryRun / email log
- Admin Socket.IO rooms
- Job list/retry
- Full OpenAPI collection (use `docs/ADMIN.md` for now)

---

## FE consume efficiently

1. Paint engagement from feed payload (mobile already); admin paints from `AdminMediaCard.preview`.
2. When `preview.signed === true`, call `preview-refresh` before expiry (~3600s).
3. Prefer `{ success, data }` unwrap; list keys may be `items` **and** `media` / `users` aliases.
4. Master UI: gate role/ban-admin using `user.isMasterAdmin` from login/`/me`.
5. Poll health + notifications every 30–60s until sockets land.

## Seed reminder

```powershell
$env:SUPER_ADMIN_PASSWORD='your-strong-password-here'
npm run seed:super-admin
```
