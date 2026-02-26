## Comments API (Create, List, Reply, Edit, Delete, Report)

This document describes exactly how the frontend should consume the **comments system** for Jevah content (media/devotionals/ebooks/podcasts), including payload shapes, pagination, and real-time behavior.

The API is centralized under **universal content interaction** routes.

---

### 1. High-Level Concepts

- Comments live in `MediaInteraction` documents with `interactionType: "comment"`.
- The API supports:
  - Top-level comments.
  - Nested replies (one level, via `parentCommentId`).
  - Per-comment reactions (likes) via a **separate reaction API** (not documented here).
  - Pagination and multiple sort orders (`newest`, `oldest`, `top`).
  - Real-time updates via Socket.IO.

Supported content types for comments:
- `media` (includes ebooks/podcasts as Media documents)
- `devotional`
- `ebook` (normalized to `media` internally)
- `podcast` (normalized to `media` internally)

---

### 2. Endpoints Overview

#### Add comment

- **Method**: `POST`
- **URL**: `/api/content/:contentType/:contentId/comment`
- **Auth**: Required (authenticated user)

#### List comments (with replies)

- **Method**: `GET`
- **URL**: `/api/content/:contentType/:contentId/comments`
- **Auth**: Optional (public + optional user context)

#### Get replies for a comment

- **Method**: `GET`
- **URL**: `/api/content/comments/:commentId/replies`
- **Auth**: Public

#### Edit comment

- **Method**: `PATCH`
- **URL**: `/api/content/comments/:commentId`
- **Auth**: Required (owner only)

#### Delete comment

- **Method**: `DELETE`
- **URL**: `/api/content/comments/:commentId`
- **Auth**: Required (owner only)

#### Report comment

- **Method**: `POST`
- **URL**: `/api/content/comments/:commentId/report`
- **Auth**: Required

#### Hide comment (moderator/admin)

- **Method**: `POST`
- **URL**: `/api/content/comments/:commentId/hide`
- **Auth**: Required, role: `admin` or `moderator`

---

### 3. Add Comment

**URL**: `POST /api/content/:contentType/:contentId/comment`

#### URL params

- `:contentType` – allowed: `media`, `devotional`, `ebook`, `podcast`.
- `:contentId` – MongoDB ObjectId for the content.

#### Body

```json
{
  "content": "This blessed me so much!",
  "parentCommentId": "65fdc8302e90f973cb0c5678" // optional
}
```

Rules:
- `content` must be non-empty after trimming.
- `parentCommentId` (if provided) must be a valid ObjectId; when present, the comment is treated as a **reply**.
- Profanity and URLs may be sanitized server-side.

#### Success response (201)

```json
{
  "success": true,
  "message": "Comment added successfully",
  "data": {
    "id": "65fdc8302e90f973cb0d1234",
    "content": "This blessed me so much!",
    "comment": "This blessed me so much!",
    "authorId": "65f...",
    "userId": "65f...",
    "user": {
      "id": "65f...",
      "firstName": "John",
      "lastName": "Doe",
      "username": "john_doe",
      "avatar": "https://..."
    },
    "author": {
      "firstName": "John",
      "lastName": "Doe",
      "avatar": "https://..."
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "likes": 0,
    "likesCount": 0,
    "replyCount": 0,
    "parentCommentId": null,
    "replies": [],
    "isLiked": false
  }
}
```

> The backend ensures the shape is **frontend-friendly**, with both `content` and `comment` fields, plus `user` and `author` objects.

#### Common errors

- 401 – unauthenticated.
- 400 – invalid content ID or unsupported content type.
- 404 – content not found.
- 500 – `Failed to add comment`.

---

### 4. List Comments (With Nested Replies)

**URL**: `GET /api/content/:contentType/:contentId/comments`

#### Query parameters

- `page` – default `1`.
- `limit` – default `20`.
- `sortBy` – `"newest" | "oldest" | "top"`; default `"newest"`.

> `sortBy="top"` orders by a score combining reply count and reactions.

#### Example response

```json
{
  "success": true,
  "data": {
    "comments": [
      {
        "id": "65fdc8302e90f973cb0d1234",
        "content": "This blessed me so much!",
        "comment": "This blessed me so much!",
        "authorId": "65f...",
        "userId": "65f...",
        "user": {
          "id": "65f...",
          "firstName": "John",
          "lastName": "Doe",
          "username": "john_doe",
          "avatar": "https://..."
        },
        "author": {
          "firstName": "John",
          "lastName": "Doe",
          "avatar": "https://..."
        },
        "createdAt": "2024-01-01T00:00:00.000Z",
        "timestamp": "2024-01-01T00:00:00.000Z",
        "likes": 3,
        "likesCount": 3,
        "replyCount": 1,
        "parentCommentId": null,
        "isLiked": false,
        "replies": [
          {
            "id": "65fdc8302e90f973cb0d5678",
            "content": "Same here!",
            "comment": "Same here!",
            "authorId": "65g...",
            "userId": "65g...",
            "createdAt": "2024-01-01T01:00:00.000Z",
            "likes": 1,
            "likesCount": 1,
            "replyCount": 0,
            "parentCommentId": "65fdc8302e90f973cb0d1234",
            "isLiked": false
          }
        ]
      }
    ],
    "total": 10,
    "totalComments": 10,
    "hasMore": true,
    "page": 1,
    "limit": 20
  }
}
```

Notes:
- `total` / `totalComments` include **both top-level comments and replies**.
- `hasMore` is based on **top-level comments** relative to `(page * limit)`.
- Each comment + reply includes `isLiked`, which is computed per user when authenticated.

#### Caching & ETags

The endpoint sets:
- `ETag` based on `contentId`, `page`, `limit`, `sortBy`.
- `Cache-Control`:
  - `private, max-age=10, stale-while-revalidate=30` for authenticated users.
  - `public, max-age=15, stale-while-revalidate=60` for anonymous.

If the client sends `If-None-Match` with a matching `ETag`, the server returns **304 Not Modified** with an empty body.

> ✅ **Client recommendation:**  
> For static lists (e.g. user scrolls away and back), send `If-None-Match` to avoid re-downloading unchanged data.

---

### 5. Replies API

**URL**: `GET /api/content/comments/:commentId/replies`

#### Query params

- `page` – default `1`.
- `limit` – default `20`.

#### Response

```json
{
  "success": true,
  "data": {
    "replies": [ /* array of reply comments, same shape as comment */ ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "pages": 1
    }
  }
}
```

This endpoint is useful when you want to **lazy-load replies** on demand instead of loading them all as part of the main comment list.

---

### 6. Edit Comment

**URL**: `PATCH /api/content/comments/:commentId`

#### Body

```json
{
  "content": "Updated comment text"
}
```

Rules:
- User must be the original author.
- `content` must be non-empty after trimming.

#### Response

```json
{
  "success": true,
  "message": "Comment updated",
  "data": {
    /* updated comment object */
  }
}
```

The server also emits a real-time event:

```json
{
  "event": "comment-edited",
  "payload": {
    "commentId": "<id>",
    "content": "Updated comment text"
  }
}
```

The frontend should respond by updating the specific comment’s text in-place.

---

### 7. Delete Comment (Owner)

**URL**: `DELETE /api/content/comments/:commentId`

Behavior:
- Soft-deletes the comment:
  - Sets `isRemoved: true`.
  - Replaces `content` with `"[Comment removed]"`.
- Decrements:
  - `Media.commentCount` by 1.
  - Parent’s `replyCount` by 1 (if it was a reply).
- Recomputes and emits updated `commentCount` for the content.

#### Response

```json
{
  "success": true,
  "message": "Comment removed successfully"
}
```

Real-time payload (room-scoped):

```json
{
  "event": "content:comment",
  "payload": {
    "contentId": "<mediaId>",
    "contentType": "media" | "devotional",
    "commentId": "<removedCommentId>",
    "action": "deleted",
    "commentCount": 9
  }
}
```

Legacy events also exist (`comment-removed`, `reply-count-updated`) for older clients.

---

### 8. Report & Hide Comment

#### Report comment

**URL**: `POST /api/content/comments/:commentId/report`

Body:

```json
{
  "reason": "spam",
  "description": "This looks like spam"
}
```

`reason` is optional, but if provided must be one of:

```text
inappropriate_content
non_gospel_content
explicit_language
violence
sexual_content
blasphemy
spam
copyright
other
```

Key rules:
- Users **cannot report their own comments**.
- Users **cannot report the same comment twice**.

Backend returns:

```json
{
  "success": true,
  "message": "Comment reported successfully",
  "data": {
    "reportCount": 3,
    "commentId": "<id>"
  }
}
```

When `reportCount >= 3`, the system also sends additional moderation alerts via email + notifications (handled server-side; no client action required).

#### Hide comment (admin/moderator)

**URL**: `POST /api/content/comments/:commentId/hide`

Body:

```json
{
  "reason": "Contains explicit language"
}
```

Sets `isHidden: true` and persists `hiddenBy`, `hiddenReason`. Counts are **not** adjusted; this is a moderation-only operation.

---

### 9. Real-time Comment Events (Socket.IO)

Room key convention:
- `room = content:<normalizedContentType>:<contentId>`
  - `normalizedContentType` is typically `"media"` or `"devotional"`.

#### Events

1. **Comment created**

Room event:

```json
{
  "event": "content:comment",
  "payload": {
    "contentId": "<id>",
    "contentType": "media",
    "commentId": "<newCommentId>",
    "action": "created",
    "commentCount": 11
  }
}
```

Plus a `new-comment` event with the full comment object:

```json
{
  "event": "new-comment",
  "payload": { /* full comment object, same shape as in list */ }
}
```

2. **Comment deleted**

As described above, `content:comment` with `action: "deleted"` and updated `commentCount`.

3. **Comment edited**

Global event:

```json
{
  "event": "comment-edited",
  "payload": {
    "commentId": "<id>",
    "content": "Updated text"
  }
}
```

#### Client subscription pattern

1. When opening a content detail screen:
   - Join `content:<normalizedContentType>:<contentId>`.
2. Listen for:
   - `content:comment` → update comment count and optionally reload.
   - `new-comment` → append the comment to the list.
   - `comment-edited` / `comment-removed` → update or hide the specific comment.

---

### 10. Frontend UX Recommendations

- Use **infinite scroll** or paging on `GET /comments` with `page` and `limit` rather than loading the entire thread.
- For **fast UX**:
  - Optimistically add the new comment to the list after `POST` returns 201.
  - Optionally also accept `new-comment` socket events to show comments from other users immediately.
- For **reply threads**:
  - Either use the replies in the main `comments` response, or lazy-load with `GET /api/content/comments/:commentId/replies` when the user expands a thread.
- For **like/heart on comments**:
  - Use the separate comment reaction API (not detailed here) which toggles reaction in `comment.reactions["like"]` and maintains `likes` / `likesCount` and `isLiked`.

---

### 11. Quick Frontend Checklist

- [ ] Use `POST /api/content/:contentType/:contentId/comment` for new comments and replies.
- [ ] Use `GET /api/content/:contentType/:contentId/comments` for paginated thread display.
- [ ] Respect `page`, `limit`, `sortBy` and `hasMore` for pagination.
- [ ] Rely on the comment shape in responses (do not infer field names).
- [ ] Join `content:<contentType>:<contentId>` rooms for real-time comment updates.
- [ ] Use the report/hide endpoints for moderation UX where applicable.

