# Frontend handoff — Admin UI for creator song review

**Date:** 2026-09-27  
**Audience:** Admin web (`admin.jevahapp.com`)  
**Build this screen:** `/admin/audio/artist-review` (or a **Creator songs** tab on `/admin/moderation`)  
**Auth:** same admin JWT as the rest of `/api/admin/*` (`Authorization: Bearer <token>`)  
**Base:** `https://api.jevahapp.com/api`

This is **not** the video queue (`/api/admin/moderation/*`). Creator songs live in a different collection. Use only the endpoints below.

Related: [FRONTEND_MODERATION.md](./FRONTEND_MODERATION.md) §7 · [FRONTEND_CREATOR_RIGHTS_HANDOFF.md](./FRONTEND_CREATOR_RIGHTS_HANDOFF.md) · [R2_CORS.md](./R2_CORS.md)

---

## What the screen is

A listen-then-decide inbox for **every creator upload**.

1. List all artist-lane tracks (start on **In review**).
2. Play the mp3 in `<audio>` (never `<video>`).
3. Approve only after the admin has heard it (`heardConfirmed: true`).
4. Or reject / keep on hold.

Creator songs **do not appear** on `GET /api/music/tracks?lane=artist` until you approve. Studio still sees the row as draft / in review.

---

## 1. List all creator uploads

```http
GET /api/admin/audio/tracks?lane=artist&moderationStatus=under_review&page=1&limit=20
```

**`lane=artist` is required.** If you omit it, the API defaults to `curated` (copyright-free beds) and the queue looks empty.

| Query | Values | UI |
|--------|--------|-----|
| `lane` | **`artist`** | Hard-code on this screen |
| `moderationStatus` | `under_review` \| `rejected` \| `approved` \| `pending` | Tabs |
| `search` | title / artist name | Search box |
| `visibility` | `draft` \| `published` \| `public` | Optional filter |
| `page` `limit` | `limit` max 100 | Pagination |

Suggested tabs (each is the same URL, different `moderationStatus`):

| Tab | Query |
|-----|--------|
| In review | `lane=artist&moderationStatus=under_review` |
| Rejected | `lane=artist&moderationStatus=rejected` |
| Live | `lane=artist&moderationStatus=approved` |
| All creator songs | `lane=artist` (no status) |

### Response

```json
{
  "success": true,
  "data": {
    "items": [ { "id": "…", "title": "…", "playbackUrl": "https://…" } ],
    "pagination": { "page": 1, "limit": 20, "total": 4, "pages": 1 }
  }
}
```

Use `data.items` (same cards as `GET /api/admin/audio/tracks/:id`).

### Row fields you will paint

| Field | UI |
|--------|-----|
| `title` | Song title |
| `artistName` / `artist` / `singer` | Same string |
| `artistSlug` | Link to public profile if you have one |
| `thumbnailUrl` / `coverUrl` / `artwork` | Cover |
| `playbackUrl` / `audioUrl` / `fileUrl` | **Same playable URL** — use any one |
| `durationSec` | Length (may be null) |
| `moderationStatus` | Badge: `under_review` / `rejected` / `approved` / `pending` |
| `visibility` | FE: `public` \| `draft` \| `archived` |
| `visibilityDb` | Raw: `published` \| `draft` |
| `copyrightStatus` | `original` \| `licensed` \| `copyright_free` |
| `licenseNote` | Show if licensed |
| `genre` `category` `language` | Meta |
| `createdAt` | Uploaded at |
| `processingStatus` | If not `ready`, disable play |

If `playbackUrl` is null, the PUT never finished (`pending://`). Show “File not uploaded” — do not enable Approve.

---

## 2. Open one track

```http
GET /api/admin/audio/tracks/:id
```

Same card shape as a list row. Open this when they click a row (or reuse the list item).

---

## 3. Player (required before Approve)

```tsx
<audio
  controls
  src={track.playbackUrl || track.audioUrl || track.fileUrl || ""}
  onEnded={() => setHeard(true)}
  onTimeUpdate={(e) => {
    const el = e.currentTarget;
    if (el.duration && el.currentTime / el.duration >= 0.2) setHeard(true);
  }}
/>
```

Rules:

- Use **`<audio>`**, never `<video>`.
- No Bearer token on the file URL. If it 403s, that is **R2 CORS / bucket**, not admin auth. See [R2_CORS.md](./R2_CORS.md) (admin origin must be allowed).
- Disable **Approve** until `heard === true` (played ~20% or `ended`).
- Reject does **not** require listen (safety / stolen claim).

---

## 4. Actions

```http
PATCH /api/admin/audio/tracks/:id/moderation
Content-Type: application/json
```

### Approve (after listen)

```json
{
  "status": "approved",
  "heardConfirmed": true,
  "reason": "Worship track, names Jesus"
}
```

This sets `visibility` to published and puts the song on the public Artists shelf.

Without `heardConfirmed: true` → **400**

```json
{
  "success": false,
  "code": "ADMIN_MUST_HEAR_TRACK",
  "message": "Play the song first, then send heardConfirmed: true. Creator tracks do not go live from a click alone."
}
```

Show that under the Approve button.

### Reject

```json
{ "status": "rejected", "reason": "Not the creator’s recording / not Christ-centered" }
```

Creator gets the usual inbox/email. Song stays off the public shelf (`draft`).

### Keep on hold

```json
{ "status": "under_review", "reason": "Need a second listen" }
```

### Delete (optional, destructive)

```http
DELETE /api/admin/audio/tracks/:id
```

Confirm first. Purges the track + R2 object.

---

## 5. Suggested layout

```
┌─────────────────────────────────────────────────────────┐
│  Creator songs                                          │
│  [In review 4] [Rejected] [Live] [All]     [Search   ]  │
├──────────────────┬──────────────────────────────────────┤
│ cover  Title     │  ◀ cover                             │
│        Artist    │  Title · Artist                      │
│        In review │  original · worship                  │
│                  │  ┌────────────────────────────────┐  │
│ cover  Title     │  │  <audio controls>              │  │
│        …         │  └────────────────────────────────┘  │
│                  │  [Reject]              [Approve]     │
│                  │  Approve disabled until heard        │
└──────────────────┴──────────────────────────────────────┘
```

Empty In-review: “No creator songs waiting. New uploads land here after they finish the PUT.”

---

## 6. Status badges

| `moderationStatus` | Badge | Public shelf |
|--------------------|--------|----------------|
| `pending` | Uploading | No |
| `under_review` | In review | No |
| `rejected` | Rejected | No |
| `approved` | Live | Yes, if they approved with `heardConfirmed` |

Do not treat FE `visibility: "public"` as live if status is still `under_review`. After this backend, in-review stays `draft`.

---

## 7. What this screen is not

| Screen | Endpoint | Audience |
|--------|----------|----------|
| Video / sermon queue | `/api/admin/moderation/queue` | Media, not tracks |
| Creator Studio | `GET /api/creators/me/tracks` | The artist sees **only their** songs |
| Public Artists shelf | `GET /api/music/tracks?lane=artist` | Listeners; approved only |

Do not send a track `id` to `PATCH /api/admin/moderation/:id`. That route is Media only.

---

## 8. Smoke

1. Admin JWT → `GET …/audio/tracks?lane=artist&moderationStatus=under_review` returns the song you just uploaded as a creator.
2. `<audio src={playbackUrl}>` plays.
3. Approve **without** play → 400 `ADMIN_MUST_HEAR_TRACK`.
4. Play, then approve with `heardConfirmed: true` → 200, song shows on `GET /api/music/tracks?lane=artist`.
5. Reject a secular / stolen upload → gone from public, creator notified.

If the list is empty, you forgot `lane=artist`.
