# Frontend handoff — Marketing email (admin + unsubscribe)

**Date:** 2026-08-03  
**Backend:** `jevahapp-backend`  
**Delivery:** Resend (same stack as verify / reset)

---

## 0. Model

| Kind | Endpoint | Consent |
|------|----------|---------|
| Ops / 1:1 blast | `POST /api/admin/email` | No marketing filter (unchanged) |
| Marketing | `POST /api/admin/email/marketing` | **Only** users with marketing enabled (default **on**) |

Every marketing email includes an **Unsubscribe** footer link.

---

## 1. Admin — send marketing

```http
POST /api/admin/email/marketing
Authorization: Bearer <admin>
Content-Type: application/json
```

```json
{
  "subject": "New on Jevah this week",
  "message": "Plain text body…",
  "segment": "all_opted_in",
  "roles": ["learner", "artist"],
  "dryRun": true
}
```

| Field | Notes |
|-------|--------|
| `subject` | Required |
| `message` **or** `html` | Required (html wins if both set) |
| `segment` | `all_opted_in` \| `role` \| `userIds` \| `emails` |
| `roles` | Optional filter / required when `segment=role` |
| `userIds` | When `segment=userIds` |
| `emails` | When `segment=emails` (must match platform users; raw emails skipped unless `allowRawEmails: true`) |
| `dryRun` | Count + log without sending |
| `limit` | Cap ≤ **500** |

### Preview count

```http
GET /api/admin/email/marketing/preview-count?segment=all_opted_in&roles=learner,artist
Authorization: Bearer <admin>
```

### Logs

`GET /api/admin/email/log` — marketing rows include `meta.kind: "marketing"`.

---

## 2. User settings (app)

```http
GET /api/me/marketing-email
Authorization: Bearer <user>
```

```json
{ "success": true, "data": { "enabled": true, "unsubscribedAt": null, "hasUnsubscribeToken": true } }
```

```http
PATCH /api/me/marketing-email
{ "enabled": false }
```

Wire a Settings toggle: “Product & marketing emails”.

---

## 3. Public unsubscribe

Web page (recommended): `{PUBLIC_WEB_URL}/email/unsubscribe?token=…`  
API (always available):

```http
GET  /api/email/unsubscribe?token=…
POST /api/email/unsubscribe
{ "token": "…" }
```

Next/marketing site should:

1. Read `token` from query
2. Optionally `GET` status
3. `POST` to confirm unsubscribe
4. Show success copy

Env: set `PUBLIC_WEB_URL` or `FRONTEND_URL` so email links point at your web app.

---

## 4. Admin — artist onboard email (ops invite)

**Not** marketing opt-out. Use this after activating a creator so they know how to upload to **Music → Artists**.

```http
POST /api/admin/email/artist-onboard
Authorization: Bearer <admin>
Content-Type: application/json
```

```json
{
  "segment": "active_missing_onboard",
  "dryRun": true,
  "message": "Optional personal note from admin…"
}
```

| Field | Notes |
|-------|--------|
| `segment` | `artistIds` \| `userIds` \| `emails` \| `pending` \| `active` \| `active_missing_onboard` (default) |
| `artistIds` / `userIds` / `emails` | Required for the matching segment |
| `subject` | Optional (default: You're invited to create on Jevah) |
| `message` | Optional plain-text note injected into the template |
| `dryRun` | Count + log without sending |
| `limit` | Cap ≤ **100** |

### Preview

```http
GET /api/admin/email/artist-onboard/preview-count?segment=active_missing_onboard
```

### Activate + remind / send in one step

```http
PATCH /api/admin/artists/:id
{ "status": "active", "sendOnboardEmail": true, "onboardMessage": "Congrats — you're live!" }
```

If you activate **without** `sendOnboardEmail`, the response includes `reminders[]` telling the admin to send the onboard email.

### Dashboard reminders

`GET /api/admin/dashboard/analytics` → `data.reminders[]` and:

- `verification.pendingCreatorApplications`
- `verification.activeArtistsMissingOnboardEmail`

Show a persistent banner: **“Send artist onboard emails”** when `activeArtistsMissingOnboardEmail > 0`.

Email log: `meta.kind === "artist_onboard"`. Artist cards include `onboardEmailSentAt`.

---

## 5. FE checklist

- [ ] Admin: dry-run → preview count → send (marketing)
- [ ] Admin: show `meta.kind === "marketing"` in email log
- [ ] Admin: **Artist onboard** compose + banner from `data.reminders`
- [ ] Admin: on artist activate, show reminder or use `sendOnboardEmail: true`
- [ ] App settings: GET/PATCH `/api/me/marketing-email`
- [ ] Web: `/email/unsubscribe` page calling public API
- [ ] Do **not** use marketing endpoint for password/security mail
- [ ] Do **not** use marketing endpoint for artist onboard (use `/email/artist-onboard`)
