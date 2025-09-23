# Frontend Interaction Adjustments (Batch Metadata + Real‑time Likes)

This guide explains how the frontend should update to use the new batch metadata endpoint and room‑scoped real‑time like events.

## What changed

- New endpoint: `POST /api/content/batch-metadata`
  - Hydrate interaction state for many items at once (feed, grids, carousels).
- New Socket.IO event scope: `like-updated` emitted to room `content:<id>`
  - Precise, content‑scoped real‑time like updates.
- Bookmark flags/counts now included in batch responses.

## 1) Batch metadata endpoint

- Endpoint: `POST /api/content/batch-metadata`
- Auth: optional; include bearer token to get user flags (`hasLiked`, `hasBookmarked`, `hasShared`, `hasViewed`).

Request body

```json
{
  "contentIds": ["68cbaaa98149fd4ad4a77511", "68cb2e00573976c282832551"],
  "contentType": "media"
}
```

Success response

```json
{
  "success": true,
  "data": [
    {
      "id": "68cbaaa98149fd4ad4a77511",
      "likeCount": 1,
      "commentCount": 0,
      "shareCount": 0,
      "bookmarkCount": 0,
      "viewCount": 0,
      "hasLiked": false,
      "hasBookmarked": false,
      "hasShared": false,
      "hasViewed": false
    }
  ]
}
```

TypeScript types

```ts
export interface BatchMetadataItem {
  id: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  bookmarkCount: number;
  viewCount: number;
  hasLiked: boolean;
  hasBookmarked: boolean;
  hasShared: boolean;
  hasViewed: boolean;
}

export interface BatchMetadataResponse {
  success: boolean;
  data: BatchMetadataItem[];
}
```

Client helper

```ts
export async function fetchBatchMetadata(
  baseUrl: string,
  token: string | null,
  ids: string[],
  contentType: string = "media"
): Promise<BatchMetadataItem[]> {
  const res = await fetch(`${baseUrl}/api/content/batch-metadata`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ contentIds: ids, contentType }),
  });
  const json = (await res.json()) as BatchMetadataResponse;
  if (!res.ok || !json.success)
    throw new Error(json?.message || `HTTP ${res.status}`);
  return json.data;
}
```

Integrate into feed hydration (example)

```ts
// Pseudo-Zustand/Redux style
async function hydrateFeedInteractionState(items: { _id: string }[]) {
  const ids = Array.from(new Set(items.map(i => i._id))).filter(Boolean);
  if (ids.length === 0) return;
  const token = await AsyncStorage.getItem("token");
  const data = await fetchBatchMetadata(API_BASE_URL, token, ids, "media");
  // Merge per-id into your store (counts + user flags)
  data.forEach(d => {
    setState(prev => ({
      ...prev,
      contentStats: { ...(prev.contentStats || {}), [d.id]: d },
    }));
  });
}
```

Use in UI

- Initialize buttons and counters from `contentStats[id]`.
- Prefer `hasLiked`/`hasBookmarked` for initial states; use counts for badges.

## 2) Real‑time like updates (room‑scoped)

Server now emits `like-updated` to room `content:<id>` whenever likes change (also still emits global `content-like-update` for backward compatibility).

Join/leave rooms per card or when viewing details

```ts
import io from "socket.io-client";

const socket = io(API_BASE_URL, {
  auth: async cb => {
    const token = await AsyncStorage.getItem("token");
    cb({ token });
  },
});

export function subscribeContentLikes(
  contentId: string,
  onUpdate: (p: any) => void
) {
  if (!contentId) return () => {};
  socket.emit("join", { room: `content:${contentId}` });
  const handler = (payload: any) => {
    if (payload?.contentId === contentId) onUpdate(payload);
  };
  socket.on("like-updated", handler);
  // Optional: still listen to global for legacy
  // socket.on("content-like-update", handler);

  return () => {
    socket.off("like-updated", handler);
    // socket.off("content-like-update", handler);
    socket.emit("leave", { room: `content:${contentId}` });
  };
}
```

Apply updates to store

```ts
function onLikeUpdated(p: {
  contentId: string;
  likeCount: number;
  userLiked: boolean;
}) {
  setState(prev => {
    const curr = prev.contentStats?.[p.contentId] || {};
    return {
      ...prev,
      contentStats: {
        ...(prev.contentStats || {}),
        [p.contentId]: { ...curr, likeCount: p.likeCount },
      },
    };
  });
}
```

## 3) Optimistic UI for likes (with reconciliation)

```ts
async function toggleLike(contentType: string, id: string) {
  const token = await AsyncStorage.getItem("token");
  // optimistic
  mutateStats(id, s => ({
    hasLiked: !s.hasLiked,
    likeCount: s.likeCount + (s.hasLiked ? -1 : 1),
  }));

  const res = await fetch(
    `${API_BASE_URL}/api/content/${contentType}/${id}/like`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!res.ok) {
    // revert on failure
    mutateStats(id, s => ({
      hasLiked: !s.hasLiked,
      likeCount: s.likeCount + (s.hasLiked ? -1 : 1),
    }));
  }
  // success will be reconciled by real-time `like-updated` as well
}
```

Helper `mutateStats`

```ts
function mutateStats(
  id: string,
  fn: (s: BatchMetadataItem) => Partial<BatchMetadataItem>
) {
  setState(prev => {
    const curr =
      prev.contentStats?.[id] ||
      ({
        id,
        likeCount: 0,
        commentCount: 0,
        shareCount: 0,
        bookmarkCount: 0,
        viewCount: 0,
        hasLiked: false,
        hasBookmarked: false,
        hasShared: false,
        hasViewed: false,
      } as BatchMetadataItem);
    return {
      ...prev,
      contentStats: {
        ...(prev.contentStats || {}),
        [id]: { ...curr, ...fn(curr) },
      },
    };
  });
}
```

## 4) Bookmark state and count

- `batch-metadata` returns `bookmarkCount` and `hasBookmarked`.
- Use these to initialize the bookmark UI and counts.
- Continue to call `POST /api/bookmark/:mediaId/toggle` for actions; refetch batch metadata on section switches or rely on socket events if you add them later.

## 5) Content type tips

- For this endpoint, `contentType` defaults to `media` and supports: `media | devotional | artist | merch | ebook | podcast`.
- Your feed items should pass the matching type used in the backend for accurate counts.

## 6) Error handling and fallbacks

- If `batch-metadata` fails, fall back to per-item `GET /api/content/:type/:id/metadata` for visible items.
- Always guard undefined flags with defaults (false/0) in UI.

## 7) QA checklist

- Feed/grid makes a single `batch-metadata` request per screen with all IDs.
- Cards initialize like/bookmark states and counts correctly.
- Tapping like updates UI instantly; `like-updated` reconciles counts.
- Joining/leaving `content:<id>` works; no memory leaks on unmount.
- Pagination/refresh triggers a new batch request and merges results.

---

Need a ready hook? Ask for a `useBatchMetadata` + `useContentLikeRealtime` pair and we’ll scaffold it for your store.
