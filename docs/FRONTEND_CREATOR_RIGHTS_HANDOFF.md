# Frontend handoff — Creator song rights + gospel gate

**Date:** 2026-09-27  
**Audience:** Creator Studio (web + mobile)  
**Why:** Signing up as a creator and uploading someone else’s secular song used to work. The API stamped `copyrightStatus: original` and `licenseNote: "Artist original / licensed to Jevah"` with no checkbox. We cannot prove ownership from audio. We **can** refuse the upload unless they attest, then hear the track and keep non-gospel songs off the public shelf.

This does **not** replace a lawyer or Content ID. It creates a dated legal record and blocks the easy “upload Drake” path.

---

## What Studio must show before Publish

Two required checkboxes plus a rights type. Copy comes from `GET /api/creators/me` → `uploadPolicy` (always render that text, do not hardcode forever):

| Field | UI |
|--------|-----|
| `rightsAttested` | Checkbox. Label = `uploadPolicy.rightsCopy` |
| `gospelAttested` | Checkbox. Label = `uploadPolicy.gospelCopy` |
| `rightsType` | Required select: `original` \| `licensed` \| `public_domain` |
| `licenseNote` | Required **only** when `rightsType=licensed` (who licensed it / license name) |

Do **not** enable **Publish songs** until both boxes are checked and `rightsType` is set. Do **not** send a fake `copyrightStatus: "original"` default.

---

## Intent body (breaking)

`POST /api/creators/tracks/upload-intent`

```json
{
  "title": "Still Waters",
  "artistName": "Grace Collective",
  "genre": "gospel",
  "category": "worship",
  "language": "en",
  "contentType": "audio/mpeg",
  "fileName": "still-waters.mp3",
  "fileSizeBytes": 5242880,
  "rightsAttested": true,
  "gospelAttested": true,
  "rightsType": "original",
  "licenseNote": null
}
```

Missing attestation → **400**, no `putUrl`:

| `code` | Meaning |
|--------|---------|
| `RIGHTS_ATTESTATION_REQUIRED` | Rights box not checked |
| `GOSPEL_ATTESTATION_REQUIRED` | Gospel box not checked |
| `INVALID_RIGHTS_TYPE` | Not `original` / `licensed` / `public_domain` |
| `LICENSE_NOTE_REQUIRED` | Licensed without a note |

Show `message` under the checkboxes.

Admin curated upload-intent is unchanged (no checkboxes).

---

## After finalize (product)

Same idea as video: creator PUT → we hear it → it does **not** appear on the public shelf until a human accepts.

1. Guardian **hears** the file (Whisper). Title alone cannot approve.
2. Heard but **not** gospel / off-theme → `rejected`. Studio stays `draft`.
3. Heard as possible gospel, or could not hear / gray → `under_review`, stays **`draft`**. **Admin must play the song** then `PATCH /admin/audio/tracks/:id/moderation` with `heardConfirmed: true`.
4. Creator AI never sets `approved`. Songs do not “just appear.”

| `moderationStatus` | Public catalog | Studio |
|--------------------|----------------|--------|
| `approved` | Yes if they asked to publish | Live |
| `under_review` | No | “In review” |
| `rejected` | No | “Not published” + creator-facing reason |
| `pending` | No | Still uploading |

Creator-facing reject/hold copy is unchanged: *Jevah publishes worship, Scripture, and teaching centered on Jesus Christ.*

---

## What this does **not** do

- Fingerprint Billboard / YouTube Content ID. A liar can still check the box.
- We store `rightsAttestation` (who, when, policy version) for takedowns and admin.

If a published track is reported as stolen, admin rejects + takedown as today (`copyright` report reason).

---

## Smoke

1. Creator with boxes **unchecked** → intent 400, no R2 PUT.
2. Boxes checked, secular mp3 → finalize `rejected` or `under_review`, not on `GET /api/music/tracks?lane=artist`.
3. Own worship song that names Jesus → still `under_review` until admin listens and approves. Then public.
