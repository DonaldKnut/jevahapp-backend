# Next.js admin / marketing — frontend correction handoff

**Date:** 2026-08-02  
**From:** `jevahapp-backend`  
**Audience:** Next.js 15 admin + marketing (`lib/admin/api.ts`, `lib/admin/types.ts`)  
**Goal:** Stop using Next `/api/*` stubs. Point at this API and fix path/shape mismatches.

**Related:** [ADMIN.md](./ADMIN.md) · [FRONTEND_ADMIN.md](./FRONTEND_ADMIN.md) · [FRONTEND_MODERATION.md](./FRONTEND_MODERATION.md)

---

## 0. Executive summary

| Assumption in your handoff | Reality on this backend |
|----------------------------|-------------------------|
| Media / moderation / reports are stubs to build | **Already shipped** — real Mongo models + `/api/admin/*` |
| Churches = `church_admin` users | **Church entity** exists (`/api/admin/churches*`) |
| Soft-delete missing | **Now default** on `DELETE /api/admin/media/:id` (`deletedAt` + hide + tombstone). `?hard=true` for permanent |
| Auth incomplete (forgot/verify) | **Shipped** under `/api/auth/*` (+ aliases below) |

**Do this first**

1. Set `NEXT_PUBLIC_API_URL` so login hits `/api/auth/login`.
   - **Recommended:** `NEXT_PUBLIC_API_URL=https://api.jevahapp.com/api` and call `${API}/auth/login`
   - **Alt:** `NEXT_PUBLIC_API_URL=https://api.jevahapp.com` and call `${API}/api/auth/login`
   - Do **not** use origin-only base with paths that omit `/api` (that produces `https://api.jevahapp.com/auth/login` → 404 “Route not found”).
2. Ensure backend `JWT_SECRET` + `MONGODB_URI` match the Next app (same User collection).
3. Add your Next origin to backend `ALLOWED_ORIGINS` (e.g. `https://www.jevahapp.com`, `http://localhost:3000`).
4. Remap `lib/admin/api.ts` using the tables below — **do not reimplement** Media/Report on Next.

See also: [FRONTEND_WEB_LOGIN_API_BASE_HANDOFF.md](./FRONTEND_WEB_LOGIN_API_BASE_HANDOFF.md) (incident fix for www login).

---

## 1. Env contract

```env
# Next (.env) — pick ONE style
# A) base includes /api  → fetch(`${API}/auth/login`)
NEXT_PUBLIC_API_URL=https://api.jevahapp.com/api
# B) origin only         → fetch(`${API}/api/auth/login`)
# NEXT_PUBLIC_API_URL=https://api.jevahapp.com

# empty NEXT_PUBLIC_API_URL = keep calling Next /api stubs (wrong for production)

# Backend (must match mobile + Next)
MONGODB_URI=
JWT_SECRET=
JWT_REFRESH_SECRET=
RESEND_API_KEY=
RESEND_FROM_EMAIL=Jevah <noreply@jevahapp.com>
# ADMIN_EMAIL_FROM=…   # accepted as alias of RESEND_FROM_EMAIL
ALLOWED_ORIGINS=http://localhost:3000,https://your-next-host
FRONTEND_URL=http://localhost:3000
```

Auth header for all admin calls:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

On **401**, clear admin session (same as today). Banned users get **403**.

---

## 2. Auth — use these paths

| Your path | Use on shared API | Notes |
|-----------|-------------------|--------|
| `POST /api/auth/login` | **Same** | `{ email, password, rememberMe? }` → `{ success, token, accessToken, tokenType, expiresIn, user }` |
| `GET /api/auth/me` | **Same** | Prefer this for admin boot. User includes verification flags + `isBanned` / `isMasterAdmin` |
| `POST /api/auth/refresh` | **Same** | Re-loads user from DB; rejects if banned; returns top-level `token`/`accessToken`/`user` **and** `data.*` |
| `POST /api/auth/logout` | **Same** | Clears refresh cookie when present |
| `POST /api/register` | **Same (alias)** | Also `POST /api/auth/register`. Does **not** return JWT. Sends verification email when Resend configured |
| `POST /api/auth/forgot-password` | **Same** | All roles (admin, creators, …). Never reveals if email exists |
| `POST /api/auth/reset-password` | **Same** | Token path; also code flow: `verify-reset-code` → `reset-password-with-code` |
| `POST /api/auth/change-password` | **New** | Logged-in user: `{ currentPassword, newPassword }` |
| Admin reset user | `POST /api/admin/users/:id/reset-password` | `{ newPassword }` or email reset; master-only for other admins |
| `POST /api/auth/verify-email` | **Same** | |
| `POST /api/auth/resend-verification` | **Same (alias)** | Canonical: `…/resend-verification-email` |
| `GET/PATCH /api/me` | **Same (alias)** | Canonical: `GET/PATCH /api/users/me` |
| `POST /api/me/avatar` | **Same (alias)** | Canonical: `POST /api/auth/avatar` (`multipart` field `avatar`) |

### `AdminUser` fields from `/me` / login / refresh

`id`, `email`, `firstName`, `lastName`, `avatar`, `role`, `isEmailVerified`, `isBanned`, ban fields when banned, `isMasterAdmin`, `isVerifiedArtist`, `isVerifiedChurch`, `isVerifiedCreator`, `isVerifiedVendor`, `lastSeenAt` (on `/me`).

Gate dashboard: `user.role === "admin"` (and not banned). Master-only actions: `user.isMasterAdmin === true`.

---

## 3. List envelope — **adapt your unwrap**

Your expected shape:

```ts
{ success: true, data: T[], page, limit, total, onlineCount? }
```

**Actual shape** (do not “fix” by inventing Next stubs):

```ts
{
  success: true,
  data: {
    users?: T[],      // or media / items / reports / churches…
    items?: T[],      // often aliased
    onlineCount?: number,
    pagination: { page, limit, total, pages }
  }
}
```

**Copy-paste helper for `lib/admin/api.ts`:**

```ts
function unwrapList<T>(json: any): {
  items: T[];
  page: number;
  limit: number;
  total: number;
  onlineCount?: number;
} {
  const nested = json?.data && !Array.isArray(json.data) ? json.data : null;
  const items: T[] = Array.isArray(json?.data)
    ? json.data
    : nested?.items ??
      nested?.users ??
      nested?.media ??
      nested?.reports ??
      nested?.churches ??
      nested?.songs ??
      [];
  const pagination = nested?.pagination ?? {};
  return {
    items,
    page: pagination.page ?? json.page ?? 1,
    limit: pagination.limit ?? json.limit ?? items.length,
    total: pagination.total ?? json.total ?? items.length,
    onlineCount: nested?.onlineCount ?? json.onlineCount,
  };
}
```

Errors: `{ success: false, message }` (sometimes `error`). Use HTTP status.

---

## 4. Admin routes — map stubs → live API

All require `role === "admin"` + Bearer JWT.

| Your stub | Live path | Unwrap / body notes |
|-----------|-----------|---------------------|
| `GET /api/admin/dashboard/analytics` | **Same** | Real counts (not `0`). Nested under `data` |
| `GET /api/admin/dashboard/feed` | **Same** | Includes `onlineCount` |
| `GET /api/admin/users` | **Same** | Query: `page`, `limit`, `search`, `role`, `banned`. List in `data.users` |
| `GET /api/admin/users/presence` | **Same** | Heuristic + connected sockets when available |
| `POST /api/admin/users/:id/ban` | **Same** | `{ reason?, until? }` |
| `POST /api/admin/users/:id/unban` | **Same** | |
| `PATCH /api/admin/users/:id/role` | **Same** | Master-gated |
| `PATCH /api/admin/users/:id/verification` | **Same** | Artist/church/creator/vendor flags |
| `GET /api/admin/churches` | **Same** | **Church docs**, not mapped `church_admin` users |
| `PATCH /api/admin/churches/:id/verification` | **Same** | `{ isVerified }` |
| `POST /api/admin/email` | **Same** | Resend; optional `dryRun: true` |
| `POST /api/admin/email/artist-onboard` | **New** | Creator onboard invite; see [FRONTEND_MARKETING_EMAIL_HANDOFF.md](./FRONTEND_MARKETING_EMAIL_HANDOFF.md) §4. Dashboard `reminders[]` flags missing sends. |
| `GET /api/admin/activity` | **Same** | Paginated audit |
| `GET /api/admin/media/recent` | **Same** | `data.media` **and** `data.items` |
| `DELETE /api/admin/media/:mediaId` | `DELETE /api/admin/media/:id` | Soft-delete by default. `?hard=true` permanent |
| `GET /api/admin/moderation/queue` | **Same** | Pending / under_review cards |
| `PATCH /api/admin/moderation/:mediaId/status` | `PATCH /api/admin/moderation/:id/status` | Body `{ status, adminNotes? }`. Statuses: `approved` \| `rejected` \| `under_review` \| `pending`. Alias: `flagged` → `under_review` |
| `GET /api/admin/reports` | **Same** | Query `type=media\|comment\|all`, `status`, `page`, `limit` |
| `POST /api/admin/reports/:id/:action` | **Same (alias)** | `resolve` \| `dismiss` \| `reviewed`. Prefer canonical `POST /api/admin/reports/media/:reportId/review` with `{ status: "resolved"\|"dismissed"\|"reviewed" }` |
| `GET/POST /api/audio/copyright-free` | Live CRUD | Admin list also: `GET /api/admin/audio/copyright-free`. Prefer Track upload flow in [FRONTEND_AUDIO_TRACKS.md](./FRONTEND_AUDIO_TRACKS.md) |

**Richer admin surfaces** (optional for your UI): moderation case/notes/assign/rerun/bulk, report detail, media search, timeseries, system health, announcements, categories — see [ADMIN.md](./ADMIN.md).

---

## 5. Media / visibility model (do not invent `visibility`)

| Concept in your handoff | Backend field |
|-------------------------|---------------|
| `moderationStatus` | `pending` \| `approved` \| `rejected` \| `under_review` |
| `visibility: public\|…` | **No field** — public = `approved` + not hidden + `publicationState` not draft/staged/publishing/tombstoned |
| Soft delete | `deletedAt` + `isHidden: true` + `publicationState: "tombstoned"` |
| Hard delete | `DELETE …?hard=true` (removes DB + R2) |

Public catalog / stream never returns rejected, hidden, or tombstoned media.

Creator upload (mobile/web creators): staged upload under `/api/media/upload/*` — not required for admin stub replacement.

---

## 6. Corrections checklist for Next `lib/admin/*`

- [ ] Point `NEXT_PUBLIC_API_URL` at this API; remove or thin-proxy Next `/api/admin/media|moderation|reports|audio` stubs
- [ ] Login → store `accessToken` (or `token`); send Bearer on every admin call
- [ ] Boot with `GET /api/auth/me`; reject non-admin / banned
- [ ] Replace list unwrap with nested `data.*` + `pagination` helper (§3)
- [ ] Map MediaItem from admin cards (`id`/`_id`, `title`, `moderationStatus`, `preview.mediaUrl`, uploader, counts) — see [FRONTEND_MODERATION.md](./FRONTEND_MODERATION.md)
- [ ] Report actions: use `:action` alias **or** `…/media/:id/review` with `status`
- [ ] Moderation status: send `approved` / `rejected` / `pending` / `under_review` (or `flagged`)
- [ ] Churches UI: treat rows as Church entities (name, verification), not only users
- [ ] Audio library: stop expecting 501; wire GET/POST to copyright-free or Tracks API
- [ ] Dashboard analytics: stop hardcoding `0` for reports/moderation — read API `data`
- [ ] Creator dashboard: call real media APIs when ready; until then keep UI mock **or** hide — do not invent a second Media store on Next
- [ ] CORS: if browser blocks, ask backend to allow your Origin (do not disable JWT)

---

## 7. What you should **not** build on Next

- Media / Report / Playlist Mongo models  
- Duplicate JWT auth against a second secret  
- Stub admin empty lists once `NEXT_PUBLIC_API_URL` is set  
- Dating / drivers / Bible as part of this admin wiring pass  

Dating, Bible, hire/drivers remain separate product surfaces (some routes exist on this API; they are not required for the admin spine).

---

## 8. Smoke test (10 minutes)

1. `POST /api/auth/login` as seeded admin (`npm run seed:super-admin` on backend if needed).  
2. `GET /api/auth/me` → `role: "admin"`.  
3. `GET /api/admin/dashboard/analytics` → non-stub numbers.  
4. `GET /api/admin/media/recent` → list or empty array (not 501).  
5. `GET /api/admin/moderation/queue` → works.  
6. `GET /api/admin/reports` → works.  
7. Soft-delete one media (if any) → disappears from public feeds; still findable in admin until hard-delete.

---

## 9. Definition of done (web)

1. Admin UI talks only to shared API for users, media, moderation, reports, churches, email, activity, audio.  
2. Upload → pending → approve → public browse works end-to-end against this backend.  
3. Auth: register → verify email → login → forgot/reset → ban blocks refresh/me.  
4. Next stubs for those areas removed or unused.

Questions / contract details: prefer [ADMIN.md](./ADMIN.md) over inventing new paths.
