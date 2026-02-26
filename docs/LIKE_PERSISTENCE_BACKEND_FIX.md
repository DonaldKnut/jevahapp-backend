# Backend: How to Fix Like Persistence (Logout/Login)

**Problem:** User likes an item, logs out, logs back in — the heart icon reverts to unliked. Likes do not persist.

**Cause:** One or more of: (1) like not persisted to DB, (2) batch-metadata not returning `userInteractions.liked`, (3) auth token not used for metadata.

This doc tells the backend what must be implemented and how to verify it.

---

## 1. Like Toggle – Must Persist

### Endpoint
```
POST /api/content/:contentType/:contentId/like
Authorization: Bearer <JWT>   (required)
```

**contentType:** `media` | `artist` | `merch` | `ebook` | `podcast`  
For videos/audio/music, use `media`.

### Required Behavior
1. Resolve user from JWT.
2. Persist like to DB (e.g. `MediaInteraction` with `deletedAt: null` for liked, soft-delete on unlike).
3. Update Redis (or equivalent) immediately for reads before DB sync.
4. Return 200 with:

```json
{
  "success": true,
  "data": {
    "contentId": "6942c8061c42444751a5029f",
    "liked": true,
    "likeCount": 42
  }
}
```

### Verification
```bash
# Like
curl -X POST "https://api.jevahapp.com/api/content/media/6942c8061c42444751a5029f/like" \
  -H "Authorization: Bearer YOUR_JWT"
# Expect: { "success": true, "data": { "liked": true, "likeCount": N } }

# Unlike
curl -X POST "https://api.jevahapp.com/api/content/media/6942c8061c42444751a5029f/like" \
  -H "Authorization: Bearer YOUR_JWT"
# Expect: { "success": true, "data": { "liked": false, "likeCount": N-1 } }
```

Then log out, get a new token, and check batch-metadata (below). Liked items must show `userInteractions.liked: true`.

---

## 2. Batch Metadata – Must Return hasLiked When Authenticated

### Endpoint
```
POST /api/content/batch-metadata
Authorization: Bearer <JWT>   (optional but REQUIRED for hasLiked)
Content-Type: application/json

Body: { "contentIds": ["id1", "id2", ...], "contentType": "media" }
```

### Required Behavior
1. Use `verifyTokenOptional` (or similar): if no token → all `userInteractions.liked` = `false`.
2. If token present, resolve user and for each contentId:
   - Check DB (MediaInteraction) or Redis for this user's like.
   - Set `userInteractions.liked: true` only if user has liked.
3. Return **object** keyed by contentId (not array):

```json
{
  "success": true,
  "data": {
    "6942c8061c42444751a5029f": {
      "contentId": "6942c8061c42444751a5029f",
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
    }
  }
}
```

### Common Backend Bugs
| Bug | Symptom | Fix |
|-----|---------|-----|
| Ignoring Authorization header | All hasLiked = false | Use `req.user` from JWT middleware and pass to metadata logic |
| Returning array instead of object | Frontend can't map by id | Return `{ "id1": {...}, "id2": {...} }` |
| Only checking DB, not Redis | Likes missing before background sync | Check Redis when DB has no row (for race mitigation) |
| Wrong user scope | Wrong user's likes shown | Use `req.user._id` from token, not any other id |

### Verification
```bash
# With token – expect userInteractions.liked per content
curl -X POST "https://api.jevahapp.com/api/content/batch-metadata" \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"contentIds":["6942c8061c42444751a5029f"],"contentType":"media"}'

# Without token – expect all userInteractions.liked = false
curl -X POST "https://api.jevahapp.com/api/content/batch-metadata" \
  -H "Content-Type: application/json" \
  -d '{"contentIds":["6942c8061c42444751a5029f"],"contentType":"media"}'
```

---

## 3. Single Metadata (Optional but Useful)

```
GET /api/content/media/:contentId/metadata
Authorization: Bearer <JWT>   (optional but required for hasLiked)
```

Same shape as batch item: `data.userInteractions.liked` must reflect current user's like when token is sent.

---

## 4. Feed (Optional Improvement)

`GET /api/media/all-content` (or auth variant) does **not** include `hasLiked` today.

If you add `hasLiked` (or `userInteractions.liked`) to each item when the user is authenticated, the frontend can hydrate faster. This is **optional**; batch-metadata is sufficient.

---

## 5. Checklist for Backend Team

- [ ] `POST /api/content/media/:id/like` persists to DB and Redis.
- [ ] `POST /api/content/batch-metadata`:
  - [ ] Accepts `Authorization: Bearer <JWT>`.
  - [ ] Returns `data` as **object** keyed by contentId.
  - [ ] Sets `userInteractions.liked` per content using `req.user` when token is present.
  - [ ] Returns `userInteractions.liked: false` for all when no token.
- [ ] MediaInteraction (or equivalent) stores `userId`, `contentId`, `deletedAt`; like = `deletedAt === null`.
- [ ] Redis/DB race: when DB has no row, check Redis so recent likes are visible before background sync.

---

## 6. Quick Test Scenario

1. Login → get JWT.
2. Call `POST /api/content/media/CONTENT_ID/like` → expect `liked: true`.
3. Logout.
4. Login again → get new JWT.
5. Call `POST /api/content/batch-metadata` with `[CONTENT_ID]` and `Authorization: Bearer <NEW_JWT>`.
6. Expect: `data[CONTENT_ID].userInteractions.liked === true`.

If step 6 fails, the problem is either:
- Like not persisted (step 2 / DB or Redis), or
- Batch-metadata not using token or not querying user's likes correctly.

---

## 7. Related Docs

- `docs/LIKE_UNLIKE_FRONTEND_CONTRACT.md` – Full frontend/backend contract
- `docs/LIKE_PERSISTENCE_FIX.md` – Frontend flow
- `docs/likes-unlikes.md` – API spec, errors, Socket.IO
