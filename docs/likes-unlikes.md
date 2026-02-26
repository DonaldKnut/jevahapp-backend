## Universal Likes / Unlikes API (Content Interactions)

This document defines the **canonical contract** for all like/unlike interactions between the frontend and the Jevah backend. It is written for frontend engineers so they can wire up UI and state management with full confidence.

The same API powers likes for:
- Media (videos, music, books, sermons, live VOD)
- Artists
- Merch
- Ebooks, podcasts (normalized internally to `media`)

---

### 1. Endpoint Overview

- **Method**: `POST`
- **URL (base)**: `/api/content/:contentType/:contentId/like`
- **Auth**: **Required**
- **Rate limiting**: 10 interaction requests / minute / IP (via `interactionRateLimiter`)

#### Allowed `contentType` values

At the **HTTP level** (what frontend sends):
- `media`
- `artist`
- `merch`
- `ebook`
- `podcast`

At the **service level**, `ebook` and `podcast` are normalized to `media`, but the frontend should still send `ebook` / `podcast` where that better represents the UI.

> ❗ **Do NOT send** `devotional` to this endpoint. Devotional likes are intentionally excluded and will be handled by a separate system.

#### URL parameters

- `:contentType` – one of the values above.
- `:contentId` – MongoDB ObjectId string for the underlying record:
  - For `media`, `ebook`, `podcast`, `merch`: `_id` from the `Media` collection.
  - For `artist`: `_id` from the `User` collection (artist user).

---

### 2. Request Contract

#### Headers

- `Authorization: Bearer <JWT>`
- Usual mobile headers (User-Agent, etc.) are optional but helpful for logging.

#### Body

No JSON body is required.

- **Frontend should send an **empty body** (or `{}`)**
- If you later need additional context, we will extend the body but keep backwards compatibility.

Example:

```http
POST /api/content/media/65fdc8302e90f973cb0b1234/like HTTP/1.1
Host: api.jevahapp.com
Authorization: Bearer <JWT>
Content-Type: application/json

{}
```

---

### 3. Response Contract

#### Success (200)

```json
{
  "success": true,
  "message": "Like toggled successfully",
  "data": {
    "liked": true,
    "likeCount": 42
  }
}
```

Fields:
- `success` – always `true` on 200.
- `message` – human readable, stable enough for logs / toasts.
- `data.liked` – **authoritative, current like state for this user** after the toggle.
- `data.likeCount` – **authoritative, approximate global like count** (Redis + DB synced).

> ✅ **Client rule:** Always trust and apply `data.liked` and `data.likeCount` as your new UI state, even if you already toggled optimistically.

#### Common error responses

- **401 – unauthenticated**

```json
{
  "success": false,
  "message": "Authentication required",
  "data": null
}
```

- **400 – invalid IDs or content type**

```json
{
  "success": false,
  "message": "Invalid content ID: <id>",
  "data": {
    "contentId": "<id>"
  }
}
```

or

```json
{
  "success": false,
  "message": "Invalid content type: <contentType>",
  "data": {
    "contentType": "<contentType>",
    "validTypes": ["media", "artist", "merch", "ebook", "podcast"]
  }
}
```

- **404 – content not found**

```json
{
  "success": false,
  "message": "Content not found: <contentId> (type: <contentType>)",
  "data": {
    "contentId": "<contentId>",
    "contentType": "<contentType>",
    "exists": false
  }
}
```

- **500 – generic server error**

```json
{
  "success": false,
  "message": "Internal server error",
  "data": {
    "error": "<message>",
    "requestId": "<uuid-optional>"
  }
}
```

---

### 4. Frontend UX / State Management Flow

This is the **recommended pattern** for like buttons in the app.

#### 4.1. Initial state

Fetch one of:
- `GET /api/content/:contentType/:contentId/metadata`
- or `POST /api/content/batch-metadata` with multiple IDs.

These responses include:

```json
{
  "likes": 42,
  "userInteractions": {
    "liked": true
  }
}
```

Use these values to render:
- Heart icon filled vs outline.
- Initial like count text.

#### 4.2. User taps like button

1. **Optimistically update UI**:
   - If currently `liked === true`, set to `false` and decrement count by 1.
   - If currently `liked === false`, set to `true` and increment count by 1.
2. Immediately **fire API call** to `POST /api/content/:contentType/:contentId/like`.
3. When response arrives:
   - Overwrite local state with `response.data.liked` and `response.data.likeCount`.
   - If API failed:
     - Option A (strict): revert UI back to last known good state.
     - Option B (gentle): show toast, fetch fresh metadata, and reconcile.

This pattern avoids the “like disappears” glitch caused by:
- Local state diverging from backend reality (e.g., due to Redis fast path).
- Multiple toggles in a short time (user double-tap).

#### 4.3. Handling rapid taps / race conditions

To avoid flicker:

- **Ignore older in-flight responses**:
  - Track a `likeRequestId` or incrementing counter per content item.
  - When a request is sent, store its ID; only apply its response if it still matches the latest request ID.
- Optionally **throttle** taps:
  - Disable the button or debounce taps for ~500ms after each toggle.

---

### 5. Real-time Like Updates (Socket.IO)

The backend emits real-time events so that multiple clients viewing the same content stay in sync.

#### 5.1. Events

- **Global broadcast**: `content-like-update`
- **Room-scoped**: `like-updated` to room `content:<normalizedContentType>:<contentId>`

Payload:

```json
{
  "contentId": "<id>",
  "contentType": "media",      // normalized contentType
  "likeCount": 42,
  "userLiked": true,
  "userId": "<userId-who-toggled>",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

> Note: `contentType` is the **normalized** type: `ebook` / `podcast` will appear as `media`.

#### 5.2. Client subscription pattern

1. When entering a content detail screen (or feed item in focus):
   - Join room `content:<normalizedContentType>:<contentId>`.
2. Listen for:
   - `socket.on("content-like-update", handler)`
   - or `socket.on("like-updated", handler)` if you prefer room-scoped events only.
3. On each event:
   - If `payload.contentId` matches the item:
     - Update displayed like count to `payload.likeCount`.
     - Optionally, if `payload.userId === currentUserId`, also sync `liked` state to `payload.userLiked`.

This keeps likes stable across:
- Multiple user devices.
- Multiple viewers on the same content.

---

### 6. Edge Cases & Gotchas

- **Own content likes**  
  Users *can* like their own content (the service just logs this for analytics).

- **Devotional likes**  
  Not supported by this endpoint. If the app needs devotional likes, they will come from a different API contract.

- **Ebook / podcast**  
  Treat them as **content types** that map to `Media` under the hood:
  - In URLs, use `/api/content/ebook/:id/like` or `/api/content/podcast/:id/like`.
  - In real-time payloads you will see `contentType: "media"`.

- **Redis vs DB counts**  
  - Frontend should *never* compute counts itself; always trust:
    - `data.likeCount` from the toggle endpoint,
    - or `likes` from metadata/batch metadata.

---

### 7. Quick Frontend Checklist

- [ ] Use `POST /api/content/:contentType/:contentId/like` for all like/unlike actions.
- [ ] Initialize UI from `metadata` / `batch-metadata`.
- [ ] Optimistically update the like icon and count, **then** reconcile with API response.
- [ ] Handle rapid taps with either throttling or request IDs.
- [ ] Subscribe to `content-like-update` / `like-updated` via Socket.IO for live sync.
- [ ] Do **not** send `devotional` to this endpoint.

