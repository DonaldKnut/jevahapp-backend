# Frontend Handoff — Comment Edit / Delete / Rich Fields (TikTok-style)

**Audience:** `jevahapp-frontend`  
**Date:** 2026-07-26  
**Backend:** edit + delete already mounted; this doc covers the polished contract after the rich-composer + CDN + edit-slice work.

---

## Reply checklist (FE can wire now)

| Action | Ready? |
|--------|--------|
| Create text + emoji + mentions | yes |
| Create / upload image (`jevah/` CDN URLs) | yes |
| List `imageUrl` + `mentions` + `isEdited` | yes |
| Edit text | yes |
| Edit / replace / clear image | yes |
| Delete own comment | yes |
| Edit window (default 24h) | yes |
| `GET /api/users/search` mentions directory | yes |

---

## Delete

```http
DELETE /api/content/comments/{commentId}
Authorization: Bearer <required>
```

- **200** `{ success: true }`
- Owner only → else **403** `COMMENT_FORBIDDEN` / not found
- Soft-delete; badge `commentCount` decrements
- Comment image on R2 is deleted best-effort after soft-delete (orphans should not pile up)

Legacy: `DELETE /api/interactions/comments/{commentId}` (same handler).

---

## Edit (TikTok-style)

```http
PATCH /api/content/comments/{commentId}
Authorization: Bearer <required>
Content-Type: application/json
```

**JSON body (any combination):**

```json
{
  "content": "Updated text 🙏",
  "imageUrl": "https://…/jevah/comments/….jpg",
  "clearImage": false,
  "mentions": [{ "userId": "…", "displayName": "@ada" }]
}
```

| Field | Notes |
|-------|--------|
| `content` | Optional if image remains; may be `""` for image-only |
| `imageUrl` | Replace image — **must be our CDN host** (`R2_CUSTOM_DOMAIN` / `*.r2.dev` / `R2_ALLOWED_CDN_HOSTS`); arbitrary https → `INVALID_IMAGE_URL` |
| `clearImage` | `true` removes image; keep non-empty text |
| `mentions` | Optional; replaces mention list. **New** userIds get mention notifications (existing mentions are not re-notified) |

**Multipart** (same path):

| Part | Notes |
|------|--------|
| `content` | text |
| `clearImage` | `"true"` optional |
| `image` | file — replace attachment |
| `imageUrl` | text optional |

**Rules**

- Owner only
- Default edit window: **24 hours** from `createdAt` → **403** `COMMENT_EDIT_WINDOW_EXPIRED` after that (`COMMENT_EDIT_WINDOW_MS`, `0` = unlimited)
- Must leave at least text **or** image
- Response includes `isEdited: true`, `edited: true`, `editedAt`

**Success:**

```json
{
  "success": true,
  "data": {
    "_id": "…",
    "content": "Updated text 🙏",
    "imageUrl": "https://…/jevah/comments/….jpg",
    "isEdited": true,
    "edited": true,
    "editedAt": "2026-07-26T18:00:00.000Z",
    "mentions": [],
    "user": { "firstName": "…", "lastName": "…", "avatar": "…" }
  }
}
```

**UI recipe:** show a small “Edited” label when `isEdited` / `edited` is true (same as TikTok).

---

## Create (unchanged happy path)

```http
POST /api/content/{mappedType}/{contentId}/comment
```

JSON or multipart (`content`, `mentions`, `image`). Image URLs always include public prefix `…/jevah/comments/…`.

---

## List fields to read

| Field | Use |
|-------|-----|
| `content` | Text + emoji |
| `imageUrl` (or `image` / `mediaUrl` / `attachmentUrl`) | Photo |
| `mentions[]` | Highlight @chips |
| `isEdited` / `edited` / `editedAt` | “Edited” badge |
| `likesCount` / `isLiked` | Heart |

Empty thread: **200** + `comments: []` + `total: 0` (never 404 for “no comments”).

---

## Error codes (edit / create)

| Code | Status | Meaning |
|------|--------|---------|
| `COMMENT_CONTENT_REQUIRED` | 400 | No text and no image |
| `COMMENT_FORBIDDEN` | 403 | Not owner |
| `COMMENT_EDIT_WINDOW_EXPIRED` | 403 | Past edit window |
| `COMMENT_NOT_FOUND` | 404 | Missing / removed |
| `UPLOAD_FAILED` | 500 | Image put/head failed — do not invent URL |
| `INVALID_IMAGE_URL` | 400 | Bad / non-CDN `imageUrl` |
| `CANNOT_REPORT_OWN` | 400 | Self-report |
| `ALREADY_REPORTED` | 400 | Duplicate report |

---

## Mentions search

```http
GET /api/users/search?q=ada&limit=10
```

Until heavily used, FE can keep suggesting creator + thread authors.

---

## Ops notes

- **Prod CDN prefix:** if Contabo media already serves `https://media…/comments/…` without `jevah/`, leave `R2_PUBLIC_KEY_PREFIX` unset when `R2_CUSTOM_DOMAIN` is set (default = no prefix), or set `R2_PUBLIC_KEY_PREFIX=` empty. Smoke one avatar + one comment image after deploy.
- **Persist healed URLs:** list rewrites on the fly and persists; still run `npm run heal:comment-images` when Atlas DNS works.
- **Push for mentions:** notification worker + Redis must be up; otherwise in-app notifications only.

---

## Out of scope

- Editing someone else’s comment  
- Changing `parentCommentId` on edit  
