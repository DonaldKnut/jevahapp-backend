# Frontend Like System (Professional Contract + Persistence)

## Goals

- **Correctness**: the “red heart” must represent the **server truth** (`hasLiked`) for the current user.
- **Persistence**: if I like something, then **logout → login again**, it must still show as liked.
- **Great UX**: instant feedback (optimistic), but always reconciled with backend.
- **No cross-user leakage**: likes from User A must never appear for User B on the same device.

---

## The backend model (how likes actually work)

There is a single universal “toggle like” endpoint that applies to multiple content types:

- **`media` / `ebook` / `podcast`**: stored in `MediaInteraction` with `interactionType: "like"` and `isRemoved` soft-delete semantics.
- **`devotional`**: stored in `DevotionalLike` (hard delete on unlike).
- **`artist`**: “like” actually means **follow/unfollow** (count becomes follower count).
- **`merch`**: “like” actually means **favorite/unfavorite** (count becomes favoriteCount).

This is implemented in:
- `src/routes/contentInteraction.routes.ts`
- `src/controllers/contentInteraction.controller.ts`
- `src/service/contentInteraction.service.ts`

---

## Canonical endpoints the frontend must use

### 1) Toggle Like (authoritative write)

- **POST** ` /api/content/:contentType/:contentId/like`
- **Auth**: required
- **Rate limited**: yes

Response shape (current backend):

```json
{
  "success": true,
  "message": "Like toggled",
  "data": {
    "contentId": "66a0f5f7d8e2b2c2a7e2b111",
    "liked": true,
    "likeCount": 42
  }
}
```

### 2) Single Content Metadata (authoritative read for one item)

- **GET** `/api/content/:contentType/:contentId/metadata`
- **Auth**: optional, but **send `Authorization` whenever logged in** so you get `hasLiked`

Response shape (current backend):

```json
{
  "success": true,
  "data": {
    "contentId": "66a0f5f7d8e2b2c2a7e2b111",
    "likeCount": 42,
    "hasLiked": true,
    "viewCount": 123,
    "hasViewed": false
  }
}
```

### 3) Batch Metadata (authoritative read for lists)

- **POST** `/api/content/batch-metadata`
- **Auth**: optional, but **send `Authorization` whenever logged in**
- **Body**:

```json
{
  "contentIds": ["id1", "id2", "id3"],
  "contentType": "media"
}
```

Response shape (current backend):

```json
{
  "success": true,
  "data": [
    { "id": "id1", "likeCount": 10, "hasLiked": true,  "viewCount": 100, "hasViewed": false },
    { "id": "id2", "likeCount": 0,  "hasLiked": false, "viewCount": 2,   "hasViewed": false }
  ]
}
```

### 4) Likers list (optional UI)

- **GET** `/api/content/:contentType/:contentId/likers?page=1&limit=20`
- **Auth**: public
- **Use case**: “Liked by …” modal / screen

---

## Content types (strict)

Backend accepts these `contentType` values on the universal like endpoint:

- `media`, `devotional`, `artist`, `merch`, `ebook`, `podcast`

**Important**: `contentId` must be a real Mongo ObjectId string (24 hex). Do not send synthetic IDs.

---

## Frontend state model (what to store)

### Key concept: `likeKey`

Always key interaction state by:

- **`likeKey = "${contentType}:${contentId}"`**

Example: `media:66a0f5f7d8e2b2c2a7e2b111`

This avoids collisions when different collections reuse ids (or when you mix types).

### What the UI needs per item

Minimum:

- `hasLiked: boolean` (controls red state)
- `likeCount: number`
- `lastSyncedAt: number` (ms) — for staleness decisions

Nice-to-have:

- `pending: boolean` (in-flight toggle)
- `optimisticVersion: number` (to ignore out-of-order responses)

---

## Persistence requirements (logout/login proof)

### Rule 1 — Server is the source of truth after login

On every app start and every login success:

- Hydrate visible items using **batch metadata** (preferred) or single metadata.
- The values returned (`hasLiked`, `likeCount`) overwrite any cached/optimistic state.

This is what makes “logout → login → still red” guaranteed (because likes are stored server-side per user).

### Rule 2 — Persist cache *per user*, not globally

To keep UX fast (instant red heart on list screens), you can persist a local cache, but it must be **scoped**:

- Persist under a namespace: `likesCache:{userId}` (or `likesCache:{userId}:{env}`).
- On logout, clear **in-memory** state. You may keep the persisted cache for that user, but **do not apply it** unless that same user is logged in again.
- If a different user logs in, use their own cache key.

This prevents:
- User A likes bleeding into User B after device shared.

### Rule 3 — Never “trust” cache when logged in and online

Cache is for fast paint only. Always reconcile quickly:

- After list fetch, call **`POST /api/content/batch-metadata`** for those ids.
- After opening detail, call **`GET /metadata`** for that id.

---

## Professional UI logic (recommended flow)

### List screens (feeds, grids, search results)

1. Fetch list items (content objects).
2. Immediately render using cached state (if present for the current user).
3. Call batch metadata with the IDs that are visible:
   - `POST /api/content/batch-metadata`
   - Use the correct `contentType` for the list (don’t mix types in a single call; split by type).
4. Merge response into store:
   - `hasLiked` overwrites red state
   - `likeCount` overwrites count
5. As user scrolls/paginates, repeat for newly visible items.

### Detail screen

1. Render with cached state.
2. Call `GET /api/content/:contentType/:contentId/metadata` with auth (if logged in).
3. Overwrite local state with response.

---

## Toggle Like behavior (optimistic but safe)

### Requirements

- Only allow **one in-flight toggle per `likeKey`** (disable button / debounce).
- Do an optimistic UI update immediately.
- Always reconcile with backend response.
- If request fails, rollback or re-fetch metadata.

### Suggested algorithm

For a given `likeKey`:

1. If `pending === true`, ignore additional taps.
2. Optimistic:
   - `hasLiked = !hasLiked`
   - `likeCount = max(0, likeCount + (hasLiked ? +1 : -1))`
   - `pending = true`
3. Call `POST /api/content/:contentType/:contentId/like`
4. On success:
   - set `hasLiked = data.liked`
   - set `likeCount = data.likeCount`
   - set `pending = false`
   - persist to `likesCache:{userId}`
5. On failure:
   - set `pending = false`
   - either rollback to previous values **or** call `GET /metadata` to re-sync (preferred for correctness).

---

## Realtime updates (optional)

Backend emits Socket.IO events after toggles:

- Global: `content-like-update`
- Room-scoped: `like-updated` to room `content:${contentType}:${contentId}`

Recommended usage:

- Use realtime to update `likeCount` while users watch the same item.
- Do **not** use realtime as the only source for `hasLiked` (because that is user-specific and depends on the current user’s action).

---

## Edge cases you must handle

- **401 Unauthorized** on toggle:
  - Don’t keep the heart red; revert and prompt login.
- **404 Content not found**:
  - Remove item from UI or show “Content unavailable”.
- **Double-tap / racing requests**:
  - Must be prevented by `pending` lock per `likeKey`.
- **Offline**:
  - Either disallow toggling (recommended) or queue actions; if you queue, you must re-sync with metadata after reconnect.

---

## Minimal “persistence checklist” (what makes it professional)

- **Per-user local cache** keyed by `userId`
- **Hydrate after login** via batch metadata for visible content
- **Lock per item** to prevent accidental double toggles
- **Reconcile always** with `liked` + `likeCount` from the toggle response
- **Re-fetch on focus** (detail screens) to prevent drift


