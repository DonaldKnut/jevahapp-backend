# Frontend handoff — Author name & avatar (stop “Unknown”)

**Date:** 2026-08-14  
**Audience:** `jevahapp-frontend` (Reels, all-content, For You, comments)  
**Backend:** shipped on `main` (`d2065bf`) — pull Contabo before testing  
**Related:** [FRONTEND_LITE_ANDROID_HANDOFF.md](./FRONTEND_LITE_ANDROID_HANDOFF.md) · [FRONTEND_TIKTOK_FEED_HANDOFF.md](./FRONTEND_TIKTOK_FEED_HANDOFF.md)

---

## 0. What was wrong

Feed cards often had `uploadedBy` as a **bare user id**. Lite `?profile=lite` then **stripped** `uploadedBy` / `author` / `authorInfo`, so the client:

1. Treated the author as missing or ID-only
2. Called `GET /api/users/:id` per card
3. Parsed the user from `data.user` / `data.data.user` — the API used to return `{ data: user }` (no nested `user`)
4. Painted **Unknown** for everyone except the current user

That N+1 is gone. **Read the author off the media card.** Do not resolve authors on the feed.

---

## 1. FE change (required)

| Do | Don’t |
|----|--------|
| Paint name/avatar from `item.uploadedBy` (object) | Call `GET /api/users/:id` while rendering a feed |
| Treat `uploadedBy` as an object if it has `firstName` / `lastName` / `name` / `avatar` | `String(uploadedBy)` or assume it is always an id |
| Keep a **profile tap** fetch if you open a user screen | Block first paint on user lookup |

Suggested helper (same field order you already use):

```ts
function authorFromCard(item: any) {
  const u =
    item?.uploadedBy && typeof item.uploadedBy === "object"
      ? item.uploadedBy
      : item?.author && typeof item.author === "object"
        ? item.author
        : item?.authorInfo;
  if (!u || typeof u !== "object") return null;
  const first = u.firstName || u.first_name || "";
  const last = u.lastName || u.last_name || "";
  const name = (u.name || u.fullName || `${first} ${last}`.trim() || "").trim();
  const avatar =
    u.avatar ||
    u.avatarUpload ||
    u.avatarUrl ||
    u.imageUrl ||
    u.profileImage ||
    u.profilePicture ||
    null;
  const id = u._id || u.id || null;
  if (!name && !first && !last) return null;
  return { id, firstName: first, lastName: last, name, avatar };
}
```

**Unknown** only if this helper returns `null` (deleted uploader). Not for “id string” and not for lite.

---

## 2. Card JSON (live)

Applies to **full and lite**:

- `GET /api/media/all-content`
- `GET /api/media/public/all-content` (`?profile=lite` included)
- `GET /api/feed/for-you?profile=lite`

`uploadedBy`, `author`, and `authorInfo` are the **same compact object**:

```json
{
  "_id": "media123",
  "title": "Video Title",
  "fileUrl": "https://…",
  "uploadedBy": {
    "_id": "674a1b2c3d4e5f6789012345",
    "id": "674a1b2c3d4e5f6789012345",
    "firstName": "John",
    "lastName": "Doe",
    "name": "John Doe",
    "avatar": "https://cdn.example.com/avatars/user456.jpg",
    "avatarUrl": "https://cdn.example.com/avatars/user456.jpg",
    "avatarUpload": "https://cdn.example.com/avatars/user456.jpg"
  },
  "author": { "firstName": "John", "lastName": "Doe", "avatar": "https://…" },
  "authorInfo": { "firstName": "John", "fullName": "John Doe", "avatar": "https://…" }
}
```

Lite still strips moderation blobs and fat media fields. **Author is kept.**

If `avatar` is `null`, show initials from `firstName`/`lastName`/`name` — that is not Unknown.

---

## 3. `GET /api/users/:userId` (profile only)

Auth: Bearer JWT. Use for **user profile screens**, not the feed.

```http
GET /api/users/674a1b2c3d4e5f6789012345
Authorization: Bearer <JWT>
```

```json
{
  "success": true,
  "user": {
    "_id": "674a1b2c3d4e5f6789012345",
    "id": "674a1b2c3d4e5f6789012345",
    "firstName": "John",
    "lastName": "Doe",
    "name": "John Doe",
    "avatar": "https://…",
    "avatarUrl": "https://…",
    "avatarUpload": "https://…",
    "email": "john@example.com"
  },
  "data": {
    "user": { "_id": "…", "firstName": "John", "lastName": "Doe", "avatar": "https://…" }
  }
}
```

Your existing picker still works:

```js
user = data.success && data.user ? data.user : data.data?.user;
```

Missing / bad id → **404** `{ code: "USER_NOT_FOUND" }`, not 500.

---

## 4. Comments

Comment rows already ship `user: { _id, firstName, lastName, avatar }`. Do not map comment authors through `uploadedBy` or `/api/users/:id`.

---

## 5. Checklist

- [ ] After Contabo pull of `d2065bf`, `uploadedBy.firstName` is set on lite all-content
- [ ] Reels / For You / all-content paint name + avatar from the card
- [ ] Feed path no longer calls `GET /api/users/:id` in a loop
- [ ] “Unknown” only when author object has no name fields
- [ ] Profile tap may still use `GET /api/users/:id`

Smoke:

```bash
curl -s "https://api.jevahapp.com/api/media/public/all-content?profile=lite&limit=2" \
  -H "X-Jevah-Client: lite" \
  | jq '.data.media[0]|{title,uploadedBy}'
```
