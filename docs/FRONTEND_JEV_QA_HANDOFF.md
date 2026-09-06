## Admin approve → mobile feed (critical)

`PATCH /api/admin/moderation/:id/status` with `{ "status": "approved" }`:

- Writes the **same** `Media` collection mobile feeds query.
- When a playable `http(s)` URL already exists → `moderationStatus=approved`, `isHidden=false`, `publicationState=live` (feed-visible).
- When still staging / no playable URL → stays `publishing` + hidden until pipeline finishes; response `message` and `data.publishable` reflect that.
- `rejected` → `isHidden=true`, `publicationState=tombstoned`.
- `pending` / `under_review` / `flagged` → staged + hidden.

Public feed filter: `moderationStatus=approved` AND `isHidden≠true` AND `publicationState` not in `draft|staged|publishing|tombstoned`.

---

# Frontend handoff — Backend QA (JEV-001…010)

## What shipped (backend)

| Ticket | Backend change | FE action |
|--------|----------------|-----------|
| **JEV-003** | Videos cannot auto-approve on gospel **title alone**. Need Christian visual corroboration and/or transcript/body gospel. Gemini parse no longer force-publishes from gospel flags. Redeploy **Content Guardian** with API. | Show under_review state; do not assume title edit re-approves. |
| **JEV-001** | `DELETE /api/media/:id` → **401** `AUTH_REQUIRED`, **403** `FORBIDDEN`, **404** `NOT_FOUND` | Map **401→login**, **403→forbidden** (stop “Login to delete” on ownership errors). Always send `Authorization: Bearer`. |
| **JEV-002** | Owners may delete **under_review** (and any status). `GET` my-content includes `moderationStatus`, `publicationState`, `canDelete: true` | Show delete for own under-review items using `canDelete`. |
| **JEV-007** | Progress coalesced + ownership; stream uses `playbackUrl`; last-position from Library | Keep progress polling ≥5–8s; no need to block UI on progress response body. |
| **JEV-008** | Atomic add (`$nor`+`$push`); `songId` alias; cache invalidate; owner check after populate; duplicate returns **200** + `alreadyExists: true` + populated `data` | On add: render `data.tracks` even when `alreadyExists`. Prefer `copyrightFreeSongId`; `songId` still works. |
| **JEV-009** | Thumbnail optional; `pending://auto-thumbnail` or HTTP default for music/books; poster or `DEFAULT_MEDIA_THUMBNAIL_URL` after transcode | Do not require thumbnail upload. Treat `pending://*` as “generating”. |
| **JEV-010** | Same ObjectId scope for list/stats/unread; `GET /api/notifications/unread-count`; mark-read returns `unreadCount` | Prefer `/unread-count` or list `unreadCount`; invalidate badge after mark-read / mark-all. |

## Auth / delete contract

```http
DELETE /api/media/:id
Authorization: Bearer <access>
```

| Status | `code` | Meaning |
|--------|--------|---------|
| 200 | — | Deleted |
| 401 | `AUTH_REQUIRED` | Missing/invalid session → login |
| 403 | `FORBIDDEN` | Not owner |
| 404 | `NOT_FOUND` | Gone |

## Playlist add contract

```http
POST /api/audio/playlists/:playlistId/songs
{ "songId": "<id>" }   // or copyrightFreeSongId / mediaId
```

Success (new or duplicate):

```json
{
  "success": true,
  "alreadyExists": false,
  "data": { "tracks": [ /* populated */ ] }
}
```

## Notifications

- `GET /api/notifications` → `{ notifications, total, unreadCount }` (`?unreadOnly=true` supported)
- `GET /api/notifications/unread-count` → `{ unreadCount }`
- `PATCH /api/notifications/:id/read` → `{ unreadCount }`
- `PATCH /api/notifications/mark-all-read` → `{ count, unreadCount }`

## Moderation note (title change bug)

Secular video rejected, then **approved after gospel title** = title-weighted bypass. Fixed so videos need visual/transcript corroboration; title-only gospel is **under_review**, not approved. Ops must redeploy Content Guardian sidecar with this backend.

## Env (optional)

- `DEFAULT_MEDIA_THUMBNAIL_URL` — HTTP image when FFmpeg poster fails / music-books lack thumb
