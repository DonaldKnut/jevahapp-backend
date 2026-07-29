# Frontend Comments — How to Process (TikTok / IG Sheet)

**Audience:** `jevahapp-frontend`  
**Related:** [ENGAGEMENT.md](./ENGAGEMENT.md) · [FRONTEND_ENGAGEMENT.md](./FRONTEND_ENGAGEMENT.md) (§6) · Backend handoff: comment count ↔ list corroboration  

This doc is the **frontend processing guide**: how to treat badge vs list, the correct request flow, and what the app typically does wrong when the badge says `5` but the sheet is empty / `404`.

---

## 0. One rule

**`commentCount` on the feed card is a hint. The list endpoint is the source of truth for the sheet.**

```text
Feed / metadata  →  badge (hint)
GET …/comments   →  sheet rows + total (truth)
```

Never invent comment rows from the badge. Never treat a list `404` as “0 comments.”

---

## 1. Correct processing pipeline

### 1.1 Open sheet (snappy UX — keep this)

1. Set sheet visible **immediately** (≤180ms animation; no spring bounce).
2. Paint **memory cache** for this `contentId` if present (`peekCachedComments` / last-sheet ref).
3. Kick off network **after** open (do not block open on fetch).

Media under the sheet should keep playing (peek + shift). That is UI-only; backend does not care.

### 1.2 List fetch (required)

**Primary (only path you need if backend is current):**

```http
GET /api/content/{mappedType}/{contentId}/comments?page=1&limit=12&sortBy=newest
Authorization: Bearer <optional>
```

| Input | Rule |
|-------|------|
| `contentId` | Exact feed item `_id` / `id` used for like/view |
| `mappedType` | See §2 — feed `video` / `audio` / `sermon` → **`media`** |
| Auth | Omit Bearer when logged out; send Bearer when logged in (`isLiked`) |
| Empty thread | Expect **200** + `comments: []` + `total: 0` |
| Missing content | Expect **404** `CONTENT_NOT_FOUND` only |

**Canonical success body:**

```json
{
  "success": true,
  "data": {
    "comments": [ /* … */ ],
    "total": 5,
    "totalComments": 5,
    "hasMore": false,
    "page": 1,
    "limit": 12
  }
}
```

**After a successful list:**

1. Replace sheet list with `data.comments` (merge pages on load-more).
2. Set badge / store `commentCount` from `data.total` (or `totalComments`).
3. Write memory cache for this `contentId`.
4. On reopen, show cache instantly, then soft-refresh in background.

### 1.3 Create / reply / like

| Action | Request |
|--------|---------|
| Post | `POST /api/content/{mappedType}/{contentId}/comment` + Bearer — JSON `{ content, parentCommentId?, mentions?, imageUrl? }` **or** multipart (`content`, `mentions` JSON string, `image` file ≤5MB). Image-only allowed (`content` may be `""`). |
| Upload image first | `POST /api/content/comments/upload-image` multipart `image` → `{ data: { url } }` then JSON create with `imageUrl` |
| Reply | Same POST with `parentCommentId` = parent `_id` |
| Edit | `PATCH /api/content/comments/{commentId}` — JSON `{ content?, imageUrl?, clearImage? }` or multipart (`content`, `image`, `clearImage`). Owner only; default **24h** window; response `isEdited` / `editedAt`. Full handoff: [FRONTEND_COMMENT_EDIT_HANDOFF.md](./FRONTEND_COMMENT_EDIT_HANDOFF.md) |
| Delete | `DELETE /api/content/comments/{commentId}` |
| Heart | `POST /api/content/comments/{commentId}/reaction` body `{ "reactionType": "like" }` (legacy alias: `/api/interactions/comments/…/reaction`) |

Optimistic UI is fine; on failure roll back. On success, bump local `commentCount` only for **top-level** creates if you also show replies nested (backend increments count for top-level and replies today — keep badge in sync with list `total` after refresh).

### 1.4 Guest vs logged-in

| | Guest | Logged in |
|--|-------|-----------|
| Open sheet / read list | Yes | Yes |
| Post / reply / edit / delete / react | Prompt login | Allowed |

Do **not** skip the list GET when there is no token. Public read is intentional.

---

## 2. Content-type mapping (critical)

Backend path segment for feed videos/audio/sermons is **`media`**.

| UI / feed `contentType` | Path segment |
|-------------------------|--------------|
| `video`, `videos`, `audio`, `music`, `live`, `sermon`, `sermons`, `teachings`, `recording`, `image`, … | **`media`** |
| `ebook`, `podcast` | Prefer **`media`** (also accepted as aliases) |
| `devotional` | `devotional` |
| `artist`, `merch` | Not commentable — hide comment affordance |

**Wrong:** `GET /api/content/video/{id}/comments` on an old backend that only allowed a narrow whitelist (current backend accepts aliases, but still prefer `media`).

**Right:**

```ts
const mappedType = mapContentTypeForBackend(item.contentType); // → "media" for video/audio/sermon
await fetch(`${API}/api/content/${mappedType}/${item.id}/comments?page=1&limit=12&sortBy=newest`);
```

Use the **same** `mappedType` + `id` for like, view, metadata, and comments.

---

## 3. Parse rules

Prefer:

```ts
const comments = data?.comments ?? data?.items ?? data?.results ?? data?.docs
  ?? (Array.isArray(data) ? data : []);
const total = data?.total ?? data?.totalComments ?? comments.length;
```

Bind UI text to `comment.content` (alias `comment.comment` exists). Author: `comment.user.firstName` / `avatar`.

---

## 4. What frontend is doing wrong (typical)

These cause **badge 5 + empty sheet / “HTTP error! status: 404”** even when backend is fixed.

### 4.1 Treating badge as the list

| Wrong | Right |
|-------|--------|
| “Feed says 5, so sheet must show 5 without a successful list” | Sheet shows rows only from list (or cache of a prior successful list) |
| Hiding retry / showing blank as “no comments” on 404 | Show “Couldn't load / tap retry” |

### 4.2 Hitting the wrong host or stale process

| Wrong | Right |
|-------|--------|
| App → local `:4000` while comments were posted on **prod** (or reverse) | Same `BASE_URL` for feed + comments + OTP |
| Metro still talking to an API **not restarted** after backend mount fixes | Restart backend; confirm curl §5 is 200 |

### 4.3 Wrong id or type in the URL

| Wrong | Right |
|-------|--------|
| Using slug / firebase id / nested `media.id` instead of Mongo `_id` | Same id as `POST …/like` |
| Path `…/video/…` or `…/sermon/…` only, never trying `media` | Map to `media` first |
| Fallback chain that never hits `/api/content/media/{id}/comments` | Primary path is that URL |

Fallback order (optional; primary should already work):

1. `/api/content/{mappedType}/{id}/comments` ← **use this**
2. `/api/media/{id}/comments`
3. `/api/content/{id}/comments`
4. `/api/interactions/{mappedType}/{id}/comments`

If **all** return 404 → wrong base URL or API not running the engagement mounts — not an empty thread.

### 4.4 Auth mistakes

| Wrong | Right |
|-------|--------|
| Skipping GET when logged out | Always GET for read |
| Treating 401 on list as empty | List is public; 401 means middleware misconfig (report backend) |
| Sending expired Bearer and aborting the whole open | Backend fail-opens to guest; FE should still parse 200 |

### 4.5 Response handling mistakes

| Wrong | Right |
|-------|--------|
| Only reading `data` as array; ignoring `data.comments` | Prefer `data.comments` |
| Ignoring `total` and keeping stale badge `5` after `total: 0` | Sync badge from list `total` on success |
| Caching a failed/empty response forever | Cache only successful 200 bodies |
| Calling 404 “no comments” | 404 = content missing or route miss; empty = 200 + `total: 0` |

### 4.6 Post body mistakes

| Wrong | Right |
|-------|--------|
| `{ text: "…" }` | `{ content: "…" }` |
| Omitting auth on POST | Bearer required for create |
| Expecting list to update without refetch / socket | Optimistic append **or** refetch page 1 |

---

## 5. Diagnose in 30 seconds

Same `BASE` and `ID` as the card:

```bash
BASE=http://127.0.0.1:4000   # must match app config
ID=<feed contentId>
TYPE=media

curl -i "$BASE/api/content/$TYPE/$ID/comments?page=1&limit=20&sortBy=newest"
```

| Curl | Frontend should |
|------|-----------------|
| `200` + `total: 5` + items | Render rows; badge ← `total` |
| `200` + `total: 0` | Empty state (honest); badge ← 0 |
| `404` | Retry UI — **not** “0 comments”; check BASE / id / server restart |
| Connection refused | App pointing at dead local API |

Metro signals:

```text
📥 Comments OK (n/total) via …     → FE path good
⚠️ Comments 404, trying next path  → keep fallbacks; fix primary type/id if all fail
⚠️ All comment list paths failed   → BASE / mount / wrong env
Couldn't load comments             → correct UX for hard failure
```

---

## 6. Acceptance (frontend)

- [ ] Sheet opens &lt;200ms with cache or skeleton; network does not gate open  
- [ ] Guest can read; post prompts login  
- [ ] Primary URL uses `media` (or `devotional`) + feed `_id`  
- [ ] On list **200**, badge updates to `data.total`  
- [ ] On list **404**, retry UI — never fake empty from badge  
- [ ] Same API host as feed/likes  
- [ ] Media keeps playing under peek  

---

## 7. Backend contract (already implemented)

Backend mounts list/create/edit/delete/reaction under `/api/content/…`, heals `commentCount` toward list `total` on GET, accepts feed type aliases, and returns 200 for empty threads. Details: [ENGAGEMENT.md](./ENGAGEMENT.md), [FRONTEND_ENGAGEMENT.md](./FRONTEND_ENGAGEMENT.md) §6.

If curl §5 is green and the sheet is still empty, the bug is in parse/cache/open orchestration on the client — file a FE bug with the JSON body and Metro log line.
