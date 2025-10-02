## Frontend Profile Tabs Consumption Guide

Author: Backend Team
Audience: Mobile/Web Frontend
Auth: All endpoints require `Authorization: Bearer <token>`

### Goal

Render a fully dynamic Profile screen. Backend controls tabs and counts; frontend lists content per tab and can fetch a single item view.

---

### Endpoints

- GET `/api/user/tabs`

  - Query: `userId?` (optional; defaults to current user)
  - Response:
    ```json
    {
      "success": true,
      "user": {
        "id": "u_123",
        "displayName": "Ada Lovelace",
        "avatarUrl": "https://..."
      },
      "tabs": [
        { "key": "photos", "label": "Photos", "count": 124 },
        { "key": "posts", "label": "Posts", "count": 32 },
        { "key": "videos", "label": "Videos", "count": 18 },
        { "key": "audios", "label": "Audios", "count": 12 }
      ]
    }
    ```

- GET `/api/user/photos`
- GET `/api/user/posts`
- GET `/api/user/videos`
- GET `/api/user/audios`

  - Common query params: `userId?`, `page=1`, `limit=20`, `sort?` (`recent|popular`)
  - Paginated response shape:
    ```json
    {
      "success": true,
      "items": [
        /* array for the tab */
      ],
      "page": 1,
      "pageSize": 20,
      "total": 132
    }
    ```

- GET `/api/user/content/:id`
  - Response: `{ success: true, item }` where `item` matches the tab item shape with additional metadata (e.g., `description`, `tags`).

---

### Item Shapes (Normalized)

- Photo

  ```json
  {
    "id": "ph_1",
    "type": "photo",
    "url": "https://.../image.jpg",
    "thumbnailUrl": "https://.../thumb.jpg",
    "createdAt": "2025-10-01T00:00:00Z",
    "likes": 12,
    "comments": 3
  }
  ```

- Post

  ```json
  {
    "id": "po_1",
    "type": "post",
    "title": "Sunday reflections",
    "body": "...",
    "imageUrl": "https://...",
    "createdAt": "...",
    "likes": 5,
    "comments": 1
  }
  ```

- Video

  ```json
  {
    "id": "vi_1",
    "type": "video",
    "title": "Worship Set",
    "fileUrl": "https://.../video.mp4",
    "thumbnailUrl": "https://.../video.jpg",
    "durationSec": 210,
    "createdAt": "...",
    "views": 1020,
    "likes": 88,
    "comments": 14
  }
  ```

- Audio
  ```json
  {
    "id": "au_1",
    "type": "audio",
    "title": "Morning Devotional",
    "fileUrl": "https://.../audio.mp3",
    "durationSec": 600,
    "createdAt": "...",
    "plays": 504,
    "likes": 31,
    "comments": 6
  }
  ```

---

### TypeScript Types (Frontend)

```ts
export type ProfileTabKey = "photos" | "posts" | "videos" | "audios";

export interface ProfileTabDescriptor {
  key: ProfileTabKey;
  label: string;
  count: number;
}

export interface ProfileTabsResponse {
  success: true;
  user: { id: string; displayName?: string; avatarUrl?: string };
  tabs: ProfileTabDescriptor[];
}

export interface PhotoItem {
  id: string;
  type: "photo";
  url: string;
  thumbnailUrl?: string;
  createdAt: string;
  likes: number;
  comments: number;
}
export interface PostItem {
  id: string;
  type: "post";
  title: string;
  body?: string;
  imageUrl?: string;
  createdAt: string;
  likes: number;
  comments: number;
}
export interface VideoItem {
  id: string;
  type: "video";
  title: string;
  fileUrl: string;
  thumbnailUrl?: string;
  durationSec?: number;
  createdAt: string;
  views: number;
  likes: number;
  comments: number;
}
export interface AudioItem {
  id: string;
  type: "audio";
  title: string;
  fileUrl: string;
  durationSec?: number;
  createdAt: string;
  plays: number;
  likes: number;
  comments: number;
}

export type TabItem = PhotoItem | PostItem | VideoItem | AudioItem;

export interface PaginatedResponse<T> {
  success: true;
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
```

---

### Fetch Patterns (React/TS)

```ts
async function fetchTabs(token: string, userId?: string) {
  const url = `/api/user/tabs` + (userId ? `?userId=${userId}` : "");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return (await res.json()) as ProfileTabsResponse;
}

async function fetchTabItems(
  token: string,
  key: ProfileTabKey,
  opts: {
    userId?: string;
    page?: number;
    limit?: number;
    sort?: "recent" | "popular";
  } = {}
) {
  const { userId, page = 1, limit = 20, sort = "recent" } = opts;
  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sort,
  });
  if (userId) qs.set("userId", userId);
  const res = await fetch(`/api/user/${key}?` + qs.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return (await res.json()) as PaginatedResponse<TabItem>;
}

async function fetchItem(token: string, id: string) {
  const res = await fetch(`/api/user/content/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return (await res.json()) as {
    success: true;
    item: TabItem & Record<string, any>;
  };
}
```

---

### Rendering Flow

1. On profile load, call `/api/user/tabs` → render tabs in given order.
2. When a tab is active, call `/api/user/{tab}?page&limit&sort` → render grid/list.
3. On item tap, call `/api/user/content/:id` for details (if needed), else navigate with the item payload.

---

### Postman Quick Tests

```
GET {{API_BASE}}/api/user/tabs
Authorization: Bearer {{JWT}}

GET {{API_BASE}}/api/user/videos?page=1&limit=20&sort=recent
Authorization: Bearer {{JWT}}

GET {{API_BASE}}/api/user/content/{{MEDIA_ID}}
Authorization: Bearer {{JWT}}
```

---

### Notes & Recommendations

- Tabs may be omitted when counts are zero; hide empty tabs gracefully.
- Use `thumbnailUrl` for fast grids; defer loading heavy media until playback.
- `popular` sorting uses like/views; `recent` uses `createdAt`.
- Respect `429` by brief backoff (e.g., 1–2s).
