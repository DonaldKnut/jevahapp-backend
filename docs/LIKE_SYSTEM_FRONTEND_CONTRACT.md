# Like/Unlike System – Frontend Contract

**Purpose:** Single source of truth for frontend integration with the backend like system. Use this doc to ensure likes persist correctly across reload, logout, and re-login.

---

## Backend Guarantees

The backend fulfills all requirements for like/unlike:

| Requirement | Status | Implementation |
|-------------|--------|-----------------|
| **Like save** | ✅ | `POST /api/content/:contentType/:contentId/like` persists to DB (MediaInteraction, soft-delete on unlike). Redis updated immediately; DB write runs in background. |
| **hasLiked on metadata** | ✅ | `GET /api/content/:contentType/:contentId/metadata` returns `userInteractions.liked` when authenticated. |
| **hasLiked on batch metadata** | ✅ | `POST /api/content/batch-metadata` returns `userInteractions.liked` per content ID when authenticated. |
| **Feed hasLiked** | ⚠️ | Feed (`GET /api/media/all-content`) does **not** include `hasLiked`. Frontend **must** call batch-metadata after feed load. |
| **Redis/DB race mitigation** | ✅ | Metadata and batch-metadata check Redis when DB has no like (handles reload before background sync). |

---

## Endpoints

### 1. Toggle Like (write)

```
POST /api/content/:contentType/:contentId/like
Authorization: Bearer <JWT>   (required)
```

**Path params:** `contentType` ∈ { `media`, `artist`, `merch`, `ebook`, `podcast` }  
**Body:** Empty `{}` or omit.

**Response (200):**
```json
{
  "success": true,
  "message": "Like toggled successfully",
  "data": {
    "contentId": "66a0f5f7d8e2b2c2a7e2b111",
    "liked": true,
    "likeCount": 42
  }
}
```

- `data.liked` = current like state (use as source of truth)
- `data.likeCount` = updated global count
- `data.contentId` = for reconciliation (match request)

---

### 2. Single Content Metadata (read)

```
GET /api/content/:contentType/:contentId/metadata
Authorization: Bearer <JWT>   (optional but required for hasLiked)
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "contentId": "66a0f5f7d8e2b2c2a7e2b111",
    "likes": 42,
    "saves": 10,
    "shares": 3,
    "views": 123,
    "comments": 5,
    "userInteractions": {
      "liked": true,
      "saved": false,
      "shared": false,
      "viewed": true
    }
  }
}
```

If no auth token: `userInteractions.liked` is always `false`.

---

### 3. Batch Metadata (read for lists/feeds)

```
POST /api/content/batch-metadata
Authorization: Bearer <JWT>   (optional but required for hasLiked)
Content-Type: application/json

{
  "contentIds": ["id1", "id2", "id3"],
  "contentType": "media"
}
```

**Response (200):** Object map keyed by content ID (not array).

```json
{
  "success": true,
  "data": {
    "id1": {
      "contentId": "id1",
      "likes": 42,
      "saves": 0,
      "shares": 1,
      "views": 100,
      "comments": 5,
      "userInteractions": {
        "liked": true,
        "saved": false,
        "shared": false,
        "viewed": true
      }
    },
    "id2": { ... }
  }
}
```

Access: `response.data[contentId].userInteractions.liked`

---

## Frontend Requirements (must do)

### 1. Feed / List Flow

The feed does **not** include `hasLiked`. After loading the feed:

1. Call `POST /api/content/batch-metadata` with all visible content IDs.
2. Send `Authorization: Bearer <JWT>` when the user is logged in.
3. Populate `contentStats` / interaction cache from the batch response.

```
Feed load → Extract content IDs → POST batch-metadata (with auth) → Merge into store
```

### 2. Toggle Like Flow

1. Optimistic update: flip icon, adjust count.
2. Call `POST /api/content/:contentType/:contentId/like` with auth.
3. On success: set `liked = response.data.liked`, `likeCount = response.data.likeCount`.
4. On error: revert optimistic update.

### 3. Logout

Clear the interaction cache (`contentStats`, etc.) on logout. After re-login/reload, state comes from:

- Feed response (if any) – does **not** have hasLiked.
- `POST /api/content/batch-metadata` – **does** have hasLiked when auth token is sent.

So: after login, when the feed (or any list) loads, **always** call batch-metadata with auth to restore like state.

### 4. Auth Token

Metadata and batch-metadata use `verifyTokenOptional`. To get `hasLiked`:

- Include `Authorization: Bearer <JWT>` when the user is authenticated.
- Without token: `userInteractions.liked` is always `false`.

---

## Content Type Mapping

| Frontend type | Backend contentType |
|---------------|---------------------|
| video, audio, music, live | `media` |
| ebook, e-books, books | `ebook` |
| podcast | `podcast` |
| merch | `merch` |
| artist | `artist` |

Do **not** use `devotional` for the like endpoint; devotional likes use a separate system.

---

## Common Pitfalls

1. **Feed used as source of hasLiked**  
   Feed has no `hasLiked`. Use batch-metadata.

2. **batch-metadata without auth**  
   Without token, all `userInteractions.liked` are false.

3. **Not reconciling with toggle response**  
   Always overwrite local state with `response.data.liked` and `response.data.likeCount` after a successful toggle.

4. **Clearing cache on logout but not repopulating**  
   After login, repopulate from batch-metadata (with auth) when lists load.

---

## Related Docs

- `docs/likes-unlikes.md` – Full API spec, error codes, Socket.IO events
- `LIKE_STATE_PERSISTENCE_FRONTEND_GUIDE.md` – Detailed flow and code examples
