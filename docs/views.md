## Content Views API (Plays / Reads / Watches)

This document defines how the frontend should record and consume **view events** (plays, reads, watches) for any content in Jevah, and what to expect from the backend.

There are two patterns:
- A **universal view endpoint** for all content types (`/api/content/:contentType/:contentId/view`) – preferred.
- A **legacy media-specific endpoint** (`/api/media/:id/track-view`) – still supported, but not recommended for new features.

---

### 1. Universal View Endpoint (Recommended)

- **Method**: `POST`
- **URL**: `/api/content/:contentType/:contentId/view`
- **Auth**: Optional (**supports anonymous + authenticated**)
- **Rate limiting**: 10 interaction requests / minute / IP (via `interactionRateLimiter`)

#### Allowed `contentType` values

- `media`
- `devotional`
- `artist`
- `merch`
- `ebook`
- `podcast`

Internally, some values (ebook/podcast/merch) map back to `Media` but the frontend should still use the most accurate type.

#### URL parameters

- `:contentType` – one of the values above.
- `:contentId` – MongoDB ObjectId string (same as used in likes/comments).

---

### 2. Request Contract (Universal View)

#### Headers

- `Authorization: Bearer <JWT>` – optional; anonymous views are allowed.

#### Body

All body fields are optional but strongly recommended when you have them:

```json
{
  "durationMs": 120000,
  "progressPct": 75,
  "isComplete": false,
  "source": "home_feed",
  "sessionId": "device-session-or-playback-session-id",
  "deviceId": "ios-uuid-or-android-id"
}
```

Fields:
- `durationMs` – total milliseconds watched/listened/read in this session.
- `progressPct` – how far through the content the user got (0–100).
- `isComplete` – whether the play reached your definition of “complete”.
- `source` – string label e.g. `"home_feed"`, `"search"`, `"artist_page"`.
- `sessionId` – your playback session identifier (helps link multiple pings).
- `deviceId` – optional stable device identifier (helps dedup across logins).

> ✅ The backend applies **deduping + threshold logic** and may decide **not** to count every ping as a new view.

---

### 3. Response Contract (Universal View)

#### Success (200)

```json
{
  "success": true,
  "data": {
    "contentId": "65fdc8302e90f973cb0b1234",
    "viewCount": 101,
    "hasViewed": true,
    "counted": true
  }
}
```

Fields:
- `data.contentId` – echo of the content ID.
- `data.viewCount` – **authoritative total view count** for this content.
- `data.hasViewed` – whether this user has at least one counted view.
- `data.counted` – whether THIS call actually incremented the view counter (dedupe aware).

> ✅ **Client rule:** treat `viewCount` as the new truth for the UI, regardless of how many times you pinged the endpoint.

#### Common errors

- **400 – invalid ID or content type**

```json
{ "success": false, "message": "Invalid content ID" }
```

or

```json
{ "success": false, "message": "Invalid content type" }
```

- **404 – content not found**

```json
{ "success": false, "message": "Content not found" }
```

- **500 – generic**

```json
{ "success": false, "message": "Failed to record view" }
```

---

### 4. Legacy Media View Endpoint

This exists for older clients; new clients should prefer the universal endpoint. It is useful where you track **duration-based thresholds** at the media layer.

- **Method**: `POST`
- **URL**: `/api/media/:id/track-view`
- **Auth**: Required (authenticated only)

#### Request body

```json
{
  "duration": 45,
  "isComplete": true
}
```

Fields:
- `duration` – seconds watched/listened/read.
- `isComplete` – optional; whether playback completed.

The backend:
- Looks up the media’s `viewThreshold` (default **30 seconds**).
- If `duration >= viewThreshold`:
  - Increments `Media.viewCount` by 1.
  - Creates/updates a `MediaInteraction` record for `interactionType: "view"`.
  - Adds to user’s `UserViewedMedia` list for recommendations.

#### Response

```json
{
  "success": true,
  "message": "OK",
  "countedAsView": true,
  "duration": 45
}
```

> `countedAsView` indicates whether this request actually incremented the view counter.

---

### 5. Frontend Playback Flow (Recommended)

#### 5.1. When to send view events

For a single piece of content, we recommend:

- On **playback end** or when the user **navigates away / closes the player**:
  - Compute:
    - `durationMs` = total time played (not just wall-clock).
    - `progressPct` = last known progress.
    - `isComplete` = `progressPct >= 90` (or your definition).
  - Send **one** `POST /api/content/:contentType/:contentId/view` with those fields.

You can also implement **mid-session pings** (e.g. every 30–60s) but you should:
- Reuse the same `sessionId`.
- Understand that dedupe logic may mark many of these as `counted: false`.

#### 5.2. UI updates

- On success, update displayed views:
  - `views = response.data.viewCount`.
- Also merge with metadata:
  - `GET /api/content/:contentType/:contentId/metadata` returns `views` and `userInteractions.viewed`.

Example unified state shape on the frontend:

```ts
type ContentEngagement = {
  likes: number;
  views: number;
  comments: number;
  user: {
    liked: boolean;
    viewed: boolean;
  };
};
```

Populate this from metadata and update `views` from the view endpoint as needed.

---

### 6. Batch and Metadata Integration

For feeds and grids, **do not call the view endpoint for each tile on screen**. Instead:

- Use `POST /api/content/batch-metadata` with all visible IDs.
- That response includes:

```json
{
  "<contentId>": {
    "contentId": "<contentId>",
    "views": 101,
    "userInteractions": {
      "viewed": true
    }
  }
}
```

Use this to:
- Render accurate counters for many items.
- Render whether the user has ever viewed a given item.

Only call the **view endpoint** when:
- The user has actually consumed the content for some meaningful duration (e.g. watched > 5s, read > 1 page, etc.).

---

### 7. Quick Frontend Checklist

- [ ] Use `POST /api/content/:contentType/:contentId/view` for new features.
- [ ] Include `durationMs`, `progressPct`, and `isComplete` where possible.
- [ ] Trust `viewCount`, `hasViewed`, and `counted` from responses instead of trying to compute them.
- [ ] For lists, use `batch-metadata` to populate view counts instead of firing per-item view calls.
- [ ] For legacy flows, only use `/api/media/:id/track-view` when required; plan to migrate to the universal endpoint over time.

