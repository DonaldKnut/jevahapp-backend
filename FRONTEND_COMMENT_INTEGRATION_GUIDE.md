### Frontend Comment Integration Guide (High‑End Comment System)

This guide explains how the frontend should integrate with the updated, unified comment system: threading with reply counts, sorting, reactions, moderation, and real‑time events.

### What changed (TL;DR)

- **Unified comments**: Use `api/content` routes for create/list/delete, plus new replies, edit, report, hide.
- **Threading**: Top‑level comments only are returned in the list; fetch replies per parent. Each comment includes `replyCount`.
- **Sorting**: `newest` (default), `oldest`, `top` (replyCount + reactions).
- **Reactions**: Stored per‑user; reaction counts are lengths of arrays. Use interactions route for react/unreact.
- **Moderation**: Report, and moderator hide available.
- **Real‑time**: Events for new, edited, removed comments and reply‐count changes.
- **Safety**: Backend sanitizes URLs and masks configured profanity.

### Supported content types

- Comments: `media`, `devotional`

### Base path

- All routes below assume base `API_BASE_URL` and include JWT `Authorization: Bearer <token>` where marked Protected.

### Endpoints

- Add comment (Protected)

  - POST `/api/content/:contentType/:contentId/comment`
  - Body: `{ content: string, parentCommentId?: string }`
  - Notes: Provide `parentCommentId` to post a reply. Returns populated comment (with user info).

- List top‑level comments (Public)

  - GET `/api/content/:contentType/:contentId/comments?page=1&limit=20&sortBy=newest|oldest|top`
  - Returns only top‑level comments with `replyCount`.
  - Use `sortBy` to change ordering. Default: `newest`.

- List replies for a comment (Public)

  - GET `/api/content/comments/:commentId/replies?page=1&limit=20`
  - Returns the chronological list of replies.

- Edit comment (Protected, owner only)

  - PATCH `/api/content/comments/:commentId`
  - Body: `{ content: string }`

- Delete comment (Protected, owner only)

  - DELETE `/api/content/comments/:commentId`
  - Soft‑deletes and decrements `commentCount`. If reply: decrements parent `replyCount`.

- Report comment (Protected)

  - POST `/api/content/comments/:commentId/report`
  - Body: `{ reason?: string }`

- Hide comment (Protected, moderator/admin)

  - POST `/api/content/comments/:commentId/hide`
  - Body: `{ reason?: string }`

- React to comment (Protected)
  - POST `/api/interactions/comments/:commentId/reaction`
  - Body: `{ reactionType: string }` (e.g., `"heart"`, `"thumbsUp"`)
  - Toggles the user’s reaction and returns updated count for that reaction.

### Response shapes (examples)

- List comments

```json
{
  "success": true,
  "data": {
    "comments": [
      {
        "_id": "c1",
        "content": "Great!",
        "user": { "firstName": "John", "lastName": "Doe", "avatar": "..." },
        "replyCount": 2,
        "createdAt": "2025-09-20T12:34:56.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 1, "pages": 1 }
  }
}
```

- List replies

```json
{
  "success": true,
  "data": {
    "replies": [
      {
        "_id": "r1",
        "content": "Reply text",
        "user": { "firstName": "Jane", "lastName": "Roe", "avatar": "..." },
        "createdAt": "2025-09-20T12:40:00.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 2, "pages": 1 }
  }
}
```

### Frontend API examples

```ts
// Add top-level comment
export async function addComment(
  contentType: "media" | "devotional",
  contentId: string,
  text: string,
  token: string
) {
  const res = await fetch(
    `${API_BASE_URL}/api/content/${contentType}/${contentId}/comment`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: text }),
    }
  );
  return res.json();
}

// Add reply
export async function addReply(
  contentType: "media" | "devotional",
  contentId: string,
  parentCommentId: string,
  text: string,
  token: string
) {
  const res = await fetch(
    `${API_BASE_URL}/api/content/${contentType}/${contentId}/comment`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: text, parentCommentId }),
    }
  );
  return res.json();
}

// List top-level comments (supports newest|oldest|top)
export async function getComments(
  contentType: "media" | "devotional",
  contentId: string,
  page = 1,
  limit = 20,
  sortBy: "newest" | "oldest" | "top" = "newest"
) {
  const res = await fetch(
    `${API_BASE_URL}/api/content/${contentType}/${contentId}/comments?page=${page}&limit=${limit}&sortBy=${sortBy}`
  );
  return res.json();
}

// List replies for a comment
export async function getReplies(commentId: string, page = 1, limit = 20) {
  const res = await fetch(
    `${API_BASE_URL}/api/content/comments/${commentId}/replies?page=${page}&limit=${limit}`
  );
  return res.json();
}

// Edit (owner only)
export async function editComment(
  commentId: string,
  content: string,
  token: string
) {
  const res = await fetch(`${API_BASE_URL}/api/content/comments/${commentId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });
  return res.json();
}

// Delete (owner only)
export async function deleteComment(commentId: string, token: string) {
  const res = await fetch(`${API_BASE_URL}/api/content/comments/${commentId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

// Report
export async function reportComment(
  commentId: string,
  token: string,
  reason?: string
) {
  const res = await fetch(
    `${API_BASE_URL}/api/content/comments/${commentId}/report`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason }),
    }
  );
  return res.json();
}

// Moderator hide
export async function hideComment(
  commentId: string,
  token: string,
  reason?: string
) {
  const res = await fetch(
    `${API_BASE_URL}/api/content/comments/${commentId}/hide`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason }),
    }
  );
  return res.json();
}

// React/unreact to a comment
export async function toggleCommentReaction(
  commentId: string,
  reactionType: string,
  token: string
) {
  const res = await fetch(
    `${API_BASE_URL}/api/interactions/comments/${commentId}/reaction`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reactionType }),
    }
  );
  return res.json();
}
```

### UI guidance

- **Top‑level + replies**: Show `replyCount` on each top‑level comment. When the user expands, call the replies endpoint.
- **Sorting**: Allow user to switch `newest`/`oldest`/`top`. When `top`, comments are ranked by activity (replies + reactions).
- **Optimistic UX**: For add/edit/delete, optimistically update UI, revert on failure.
- **Reactions**: Toggle UI state immediately; backend returns the new count. Avoid double‐taps by disabling briefly.

### Real‑time events (Socket.IO)

Emitted by backend:

- `content-comment` → payload: `{ contentId, contentType, comment }`
- `new-comment` (room `content:<contentId>`) → payload: `comment`
- `comment-edited` → payload: `{ commentId, content }`
- `comment-removed` → payload: `{ commentId }`
- `reply-count-updated` → payload: `{ commentId, delta }`

Example client wiring:

```ts
import { io } from "socket.io-client";

const socket = io(API_BASE_URL, {
  withCredentials: true,
  transports: ["websocket"],
});

export function joinContentRoom(contentId: string) {
  socket.emit("join-content", { contentId, contentType: "media" }); // or "devotional"
}

socket.on("content-comment", ({ contentId, contentType, comment }) => {
  // Prepend new comment if matches current content
});

socket.on("comment-edited", ({ commentId, content }) => {
  // Update comment content in UI
});

socket.on("comment-removed", ({ commentId }) => {
  // Remove or mark comment as removed
});

socket.on("reply-count-updated", ({ commentId, delta }) => {
  // Update parent comment's replyCount by delta
});
```

### Safety and content rules

- Backend removes URLs and masks profanity from `PROFANITY_BLOCK_LIST` (comma‑separated). Frontend should still trim inputs and can optionally implement local checks.
- On failures, show concise error to user and revert optimistic UI updates.

### Migration notes

- If your UI previously rendered deep nested trees in one call, update to:
  - Fetch top‑level only, show `replyCount`.
  - Fetch replies on demand per parent.
  - Respect `sortBy` query.

### Quick checklist

- Use new list + replies endpoints.
- Add sorting control.
- Show replyCount and fetch replies on expand.
- Wire up real‑time events for add/edit/remove and reply counts.
- Use reaction toggle endpoint for comment reactions.
- Handle edit/delete/report/hide flows based on user role.




