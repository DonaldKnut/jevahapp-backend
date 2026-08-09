# Creator apply — Spotify for Artists style handoff

**Date:** 2026-08-09  
**Surface:** [https://www.jevahapp.com/creators/apply](https://www.jevahapp.com/creators/apply)  
**Audience:** Web FE + product / backend reviewers  
**Goal:** Match the *feel* of Spotify for Artists access: fixed promo + scrollable apply form, clear required vs optional, Zod-validated payload.

**Related:** [FRONTEND_CREATORS.md](./FRONTEND_CREATORS.md) · `GET /api/creators/me` · Admin Artists queue

---

## 1. Product analogy (Spotify → Jevah)

| Spotify for Artists | Jevah Creators |
|---------------------|----------------|
| “Get access” / claim profile | `/creators/apply` |
| Artist name | `displayName` |
| Primary role / type | `creatorTypes[]` (artist / minister / podcaster) |
| Genre tags | `genres[]` (at least one) |
| Social / streaming links | `socials.instagram \| youtube \| spotify` |
| Avatar / image (often later) | `avatarUrl` optional at apply |
| Pitch / verification notes | `applicationNote` optional |
| Review → dashboard | Artists queue → `/creators/studio` |

Spotify does **not** ask for everything up front. Name + identity signals are required; polish fields stay optional. Jevah follows that.

---

## 2. Desktop layout (shipped FE)

```
┌────────────────────┬──────────────────────────────┐
│  Promo panel       │  Scrollable form column      │
│  (fixed, ~40%)     │  (overflow-y: auto)          │
│  Brand + 3 steps   │  Required / Optional labels  │
│  Full-bleed image  │  Sticky submit footer        │
└────────────────────┴──────────────────────────────┘
```

- **Desktop (`lg+`):** split like login / Spotify for Artists onboarding.
- **Mobile:** promo collapses to a compact strip; form + sticky submit remain.
- **Viewport:** `h-dvh` + independent scroll on the form side only (promo stays put).

Components (web FE):

- `ApplyPromoAside` — left brand panel  
- `ApplyFormFields` — field UI + Required/Optional badges  
- `schemas/creatorApply.ts` — Zod source of truth  
- `CreatorApply` — page shell + submit

---

## 3. Field contract (required vs optional)

### Required (must pass Zod + backend)

| Field | Rules | UI |
|-------|--------|----|
| `creatorTypes` | ≥ 1 of `artist` \| `minister` \| `podcaster` | Chip / card toggles |
| `displayName` | trim, 2–80 chars | Text input |
| `genres` | ≥ 1 from allowed enum | Chip toggles |

**Allowed genres (backend source of truth — align Zod):**

`gospel` · `contemporary_christian` · `afro_gospel` · `hymn` · `choir` · `rap_gospel` · `highlife_gospel` · `other`

> Do **not** send `worship` as a genre — that is a **track category**, not an apply genre.

### Optional (empty → omit)

| Field | Rules | UI |
|-------|--------|----|
| `bio` | ≤ 500 chars | Textarea + counter |
| `instagram` / `youtube` / `spotify` | trim, ≤ 200 | Grouped “Social proof” |
| `avatarUrl` | if set, must be `http(s)://…` | Text |
| `applicationNote` | ≤ 1000 chars | Textarea |

HTML `required` attributes are **not** the source of truth. Use `noValidate` + Zod so errors match Spotify-style inline messages.

---

## 4. API payload (Option A base includes `/api`)

```http
POST /api/creators/apply
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "displayName": "Grace Collective",
  "creatorTypes": ["artist"],
  "genres": ["gospel", "afro_gospel"],
  "bio": "Gospel worship from Lagos",
  "socials": {
    "instagram": "@gracecollective",
    "youtube": "https://youtube.com/@grace",
    "spotify": "https://open.spotify.com/artist/…"
  },
  "avatarUrl": "https://…",
  "applicationNote": "We lead youth worship…"
}
```

Omit keys that are empty. Do not send `""` for optional fields.

### Responses

| Status | When |
|--------|------|
| `201` | New application (`status: pending`) |
| `200` | Already applied — returns existing `CreatorMe` (`message: "Application already exists"`) |
| `400` | Validation — `{ success:false, code:"VALIDATION_ERROR", message, fieldErrors }` |
| `401` | Missing / bad Bearer |

`fieldErrors` example:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Select at least one genre (gospel, …)",
  "fieldErrors": {
    "genres": "Select at least one genre (gospel, contemporary_christian, …)"
  }
}
```

Map `fieldErrors` onto Zod-style UI highlights when the client skipped validation.

Success body is the same `CreatorMe` shape as `GET /api/creators/me` (`artist` + `capabilities`).

---

## 5. Zod (frontend)

Schema lives in `src/pages/creators/schemas/creatorApply.ts`.

```ts
creatorApplySchema.safeParse(values)
// → { success, data } | { success: false, error }
// fieldErrorsFromZod(error) → { displayName?: string, … }
```

On submit failure: highlight fields, focus messaging on the first error, keep the sticky CTA enabled until request starts.

---

## 6. Session / Studio routing (backend flags)

Drive UI from `GET /api/creators/me` → `data.capabilities`:

| Flag | Apply page behavior |
|------|---------------------|
| `canApply: true` | Show form |
| `showPendingBanner: true` | Pending banner; do not re-submit |
| `showCreatorHub: true` && approved (`canUploadTracks`) | Redirect `/creators/studio` |
| `nextStep: "wait_review"` | Soft lock apply |
| `statusMessage` | Banner copy — do not invent strings |

Apply **never** auto-approves. Admin Artists queue activates the profile.

---

## 7. UX rules (Spotify parity checklist)

- [x] Left promo tells the story; right side is the only scroll region  
- [x] Every field shows **Required** or **Optional**  
- [x] Socials are one section (“Social proof”), not three equal required columns  
- [x] Sticky bottom bar with primary CTA (like Spotify’s always-visible Continue)  
- [x] Pending banner if `capabilities.showPendingBanner`  
- [x] Redirect to Studio when already approved (`!canApply && showCreatorHub`)  
- [ ] Future: image upload instead of avatar URL (Spotify uses file picker)  
- [ ] Future: multi-step wizard (Name → Role → Genre → Socials) if form grows  

---

## 8. Backend expectations (corroborated 2026-08-09)

1. Auth gate: `verifyToken` on `POST /api/creators/apply` (same as mobile).  
2. Persists `creatorTypes`, `genres`, `socials`, `applicationNote`, optional `bio` / `avatarUrl`.  
3. Required fields enforced server-side (no silent default to empty genres / fake name).  
4. Empty optional strings normalized away; social keys omitted when blank.  
5. Pending surfaces via `capabilities.showPendingBanner` + `statusMessage` on Studio and re-entry.  
6. Admin Artists queue remains the only approval path.

---

## 9. Definition of done

1. Desktop apply shows promo + independently scrollable form.  
2. Required fields block submit via Zod; optional fields never block when empty.  
3. Network tab shows `POST …/api/creators/apply` with trimmed body (genres from allowed list).  
4. After success → `/creators/studio` with toast (pending banner from `capabilities`).  
5. Mobile remains usable without the left panel.  
6. Invalid body returns `400` + `fieldErrors` (backend + FE agree).

Questions on path shapes: prefer [FRONTEND_CREATORS.md](./FRONTEND_CREATORS.md) over inventing new routes.
