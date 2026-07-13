# Engagement API — Frontend Contract

Canonical engagement for **feed media** uses `/api/content/*`.  
**Copyright-free music** uses `/api/audio/copyright-free/*` (separate stack).

---

## Feed media (video, audio, ebooks in main feed)

### Content types

`media`, `artist`, `merch`, `ebook`, `podcast`, `devotional` (devotional likes use `/api/devotionals/:id/like`)

### Endpoints

| Action | Method | Endpoint | Auth |
|--------|--------|----------|------|
| Like toggle | POST | `/api/content/:contentType/:contentId/like` | Required |
| Share | POST | `/api/content/:contentType/:contentId/share` | Required |
| View | POST | `/api/content/:contentType/:contentId/view` | Optional |
| Metadata | GET | `/api/content/:contentType/:contentId/metadata` | Optional |
| Batch metadata | POST | `/api/content/batch-metadata` | Optional |
| Save | POST | `/api/bookmark/:contentId/toggle` | Required |
| Add comment | POST | `/api/content/:contentType/:contentId/comment` | Required |
| List comments | GET | `/api/content/:contentType/:contentId/comments` | Optional |
| Delete comment | DELETE | `/api/content/comments/:commentId` | Required |
| Edit comment | PATCH | `/api/content/comments/:commentId` | Required |
| Report comment | POST | `/api/content/comments/:commentId/report` | Required |

### View body (feed)

```json
{
  "durationMs": 5000,
  "progressPct": 30,
  "isComplete": false,
  "source": "feed",
  "sessionId": "optional-uuid",
  "deviceId": "optional"
}
```

**Thresholds:** video — 3s or 25% progress; audio — 10s or 20% progress. Dedupe window: 1 hour per user.

### View response

```json
{
  "success": true,
  "data": {
    "viewCount": 42,
    "hasViewed": true,
    "counted": true
  }
}
```

### Like response

```json
{
  "success": true,
  "data": {
    "liked": true,
    "likeCount": 10,
    "contentId": "..."
  }
}
```

### Metadata response

```json
{
  "success": true,
  "data": {
    "stats": { "likes": 10, "saves": 2, "shares": 1, "views": 42, "comments": 5 },
    "userInteraction": {
      "liked": true,
      "saved": false,
      "shared": false,
      "viewed": true
    }
  }
}
```

### Batch metadata body

```json
{
  "items": [
    { "contentType": "media", "contentId": "507f1f77bcf86cd799439011" }
  ]
}
```

---

## Copyright-free music

Do **not** use `/api/content/*` for copyright-free songs.

| Action | Method | Endpoint | Auth |
|--------|--------|----------|------|
| List songs | GET | `/api/audio/copyright-free` | Public |
| Get song | GET | `/api/audio/copyright-free/:songId` | Public |
| Stream redirect | GET | `/api/audio/copyright-free/:songId/stream` | Public |
| Search | GET | `/api/audio/copyright-free/search?q=` | Public |
| Categories | GET | `/api/audio/copyright-free/categories` | Public |
| Like | POST | `/api/audio/copyright-free/:songId/like` | Required |
| View | POST | `/api/audio/copyright-free/:songId/view` | Required |
| Share | POST | `/api/audio/copyright-free/:songId/share` | Required |
| Save | POST | `/api/audio/copyright-free/:songId/save` | Required |
| Download | POST | `/api/audio/copyright-free/:songId/download` | Required |
| Audio library | GET | `/api/audio/library` | Required |

### View body (copyright-free)

```json
{
  "durationMs": 4000,
  "progressPct": 30,
  "isComplete": false
}
```

**Threshold:** 3s or 25% progress or complete. **Dedupe:** one view per user per song (lifetime).

### View response

```json
{
  "success": true,
  "data": {
    "viewCount": 42,
    "hasViewed": true
  }
}
```

### Save response

```json
{
  "success": true,
  "data": {
    "saved": true,
    "saveCount": 5,
    "bookmarked": true,
    "bookmarkCount": 5
  }
}
```

`bookmarked` / `bookmarkCount` are aliases for backward compatibility.

### Comments

Not supported for copyright-free songs.

---

## WebSocket (real-time)

Join room before listening for updates:

```js
socket.emit("join-content", { contentId: songId, contentType: "audio" });
// Room: content:audio:{songId}
```

Event: `copyright-free-song-interaction-updated` — payload includes `songId`, `likeCount`, `viewCount`, `liked`.

For feed media:

```js
socket.emit("join-content", { contentId: mediaId, contentType: "media" });
```

Events: `content-reaction`, `content-comment`, `count-update`.

See [WEBSOCKETS.md](./WEBSOCKETS.md).

---

## Rate limits (engagement)

| Route group | Limit |
|-------------|-------|
| `/api/content/*` like/share/view | 10 req/min per user |
| Comments | 5 req/min per user |
| General API | 100 req/15min per IP (production) |

---

## SDK

`packages/jevah-js-sdk` — `trackView` and `like` use `/api/content/*` for feed media.
