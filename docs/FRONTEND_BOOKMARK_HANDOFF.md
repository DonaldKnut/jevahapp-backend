# Frontend handoff — Bookmark / save (404 + pending/under-review 500)

**Date:** 2026-08-04  
**Backend:** `jevahapp-backend`  
**Related FE:** `app/utils/contentInteraction/save.ts` · FE handoff *Bookmark/save 500 on pending / under-review media*

## Product rule

If the client can play the media, bookmark is allowed:

| `processingStatus` | `moderationStatus` | Bookmark |
|--------------------|--------------------|----------|
| `ready` / `pending` / `processing` | `approved` | **200** toggle |
| any playable | `under_review` / `pending` | **200** toggle |
| — | `rejected` | **400** `This content can’t be saved` |
| soft-deleted / missing | — | **404** |

Does **not** require `ready` or `approved`.

## What we fixed (2026-08-04)

1. `resolveBookmarkableMedia` — `Media.findById` (no public/approved-only filter); soft-deleted → null  
2. Rejected → `BookmarkToggleError` **400** (never uncaught **500**)  
3. Toggle is **non-transactional** (standalone Mongo txn failures were surfacing as opaque 500s)  
4. Controller maps `statusCode` / safe `error.message` (no `.includes` on undefined)  
5. Like `verifyContentExists` for media — also allows non-approved (aligned with views)  
6. Notification null-guards on missing `uploadedBy`

## Contract

```http
POST /api/bookmark/:contentId/toggle
Authorization: Bearer <JWT>
{ "contentType": "media" }
```

```json
{
  "success": true,
  "data": {
    "contentId": "…",
    "bookmarked": true,
    "isBookmarked": true,
    "bookmarkCount": 1,
    "saves": 1
  }
}
```

Aliases: `videos`, `video`, `sermon`, `audio`, … → Media.  
Library: `GET /api/bookmark/user` → `data.bookmarks`.  
Legacy: `POST /api/media/interactions/:id/save` → same handler.

## QA

```bash
curl -i -X POST "$BASE/api/bookmark/$ID/toggle" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contentType":"media"}'
```

Use an id with `processingStatus: pending` or `moderationStatus: under_review` → expect **200**.

**Fail if** playable feed id returns **500**.
