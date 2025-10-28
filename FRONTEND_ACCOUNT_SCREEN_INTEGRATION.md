## AccountScreen Dynamic Content Integration (Profile Tabs)

Audience: Mobile/Web Frontend (React Native / Expo)
Auth: All calls require `Authorization: Bearer <token>` (Clerk JWT)

### Goal

Replace hardcoded tiles in `AccountScreen.tsx` with dynamic data from the backend profile endpoints while keeping the existing UI. Tabs (posts/photos/videos/audios) load paginated content; Analytics remains local for now.

---

### Endpoints

- GET `/api/user/tabs` (optional for counts/order)
- GET `/api/user/photos?page&limit&sort`
- GET `/api/user/posts?page&limit&sort`
- GET `/api/user/videos?page&limit&sort`
- GET `/api/user/audios?page&limit&sort`
- GET `/api/user/content/:id`

Common query: `userId?` is optional (defaults to current user from JWT). `sort` is `recent|popular`. Default `page=1`, `limit=20`.

---

### Minimal Types (FE)

```ts
type ProfileTabKey = "posts" | "photos" | "videos" | "audios";

type TabItem =
  | {
      id: string;
      type: "post";
      title: string;
      body?: string;
      imageUrl?: string;
      createdAt: string;
      likes: number;
      comments: number;
    }
  | {
      id: string;
      type: "photo";
      url: string;
      thumbnailUrl?: string;
      createdAt: string;
      likes: number;
      comments: number;
    }
  | {
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
  | {
      id: string;
      type: "audio";
      title: string;
      fileUrl: string;
      durationSec?: number;
      createdAt: string;
      plays: number;
      likes: number;
      comments: number;
    };

interface PaginatedResponse<T> {
  success: true;
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
```

---

### Getting a JWT from Clerk (Expo)

```ts
import { useAuth } from "@clerk/clerk-expo";

const { getToken } = useAuth();
const token = await getToken(); // Bearer JWT for backend
```

---

### Data Hooks

Add two small hooks to fetch tabs and tab items. These are framework-agnostic and can live in your `hooks/` folder.

```ts
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/clerk-expo";

function useDebounce<T>(value: T, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function useProfileTabs(userId?: string) {
  const { getToken } = useAuth();
  const [tabs, setTabs] = useState<
    { key: string; label: string; count: number }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const token = await getToken();
        const url = "/api/user/tabs" + (userId ? `?userId=${userId}` : "");
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setTabs(Array.isArray(data?.tabs) ? data.tabs : []);
      } catch (e: any) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken, userId]);

  return { tabs, loading, error };
}

export function useProfileTabItems(
  key: ProfileTabKey,
  opts?: {
    userId?: string;
    page?: number;
    limit?: number;
    sort?: "recent" | "popular";
  }
) {
  const { getToken } = useAuth();
  const [items, setItems] = useState<TabItem[]>([]);
  const [page, setPage] = useState(opts?.page ?? 1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const limit = opts?.limit ?? 20;
  const sort = opts?.sort ?? "recent";
  const userId = opts?.userId;

  useEffect(() => {
    setItems([]);
    setPage(opts?.page ?? 1);
  }, [key, userId, sort, limit]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const token = await getToken();
        const qs = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          sort,
        });
        if (userId) qs.set("userId", userId);
        const res = await fetch(`/api/user/${key}?` + qs.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json()) as PaginatedResponse<TabItem>;
        setItems(prev => (page === 1 ? data.items : [...prev, ...data.items]));
        setTotal(data.total ?? 0);
      } catch (e: any) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken, key, page, limit, sort, userId]);

  const hasMore = useMemo(() => items.length < total, [items.length, total]);
  const loadMore = () => {
    if (!loading && hasMore) setPage(p => p + 1);
  };

  return { items, loading, error, page, total, hasMore, loadMore };
}
```

---

### Wire Into `AccountScreen.tsx`

Current tabs array:

```ts
const contentTabs = [
  { icon: "grid-outline", label: "Posts" },
  { icon: "camera-outline", label: "Media" }, // map to Photos
  { icon: "play-outline", label: "Videos" },
  { icon: "stats-chart-outline", label: "Analytics" },
];

// Map tab index -> backend key
const tabKeyMap: Record<number, ProfileTabKey | null> = {
  0: "posts",
  1: "photos",
  2: "videos",
  3: null, // Analytics (local)
};
```

Replace the local `tabImages` usage with API items. Example render for tabs 0–2:

```tsx
const activeKey = tabKeyMap[selectedContentTab];
const { items, loading, loadMore, hasMore } = useProfileTabItems(
  activeKey ?? "posts"
);

{
  /* Grid */
}
{
  selectedContentTab !== 3 ? (
    <View className="px-4 mb-8">
      <View className="flex-row justify-between flex-wrap">
        {items.map((it, idx) => (
          <View
            key={`${it.type}-${it.id}-${idx}`}
            style={{ width: "32%", marginBottom: 8 }}
          >
            <View className="aspect-square bg-gray-200 rounded-lg overflow-hidden">
              {it.type === "photo" && (
                <Image
                  source={{ uri: it.thumbnailUrl || it.url }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              )}
              {it.type === "post" && (
                <Image
                  source={{ uri: it.imageUrl }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              )}
              {it.type === "video" && (
                <Image
                  source={{ uri: it.thumbnailUrl }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              )}
              {it.type === "audio" && (
                <View className="w-full h-full items-center justify-center">
                  <Ionicons
                    name="musical-notes-outline"
                    size={18}
                    color="#0A332D"
                  />
                </View>
              )}
            </View>
          </View>
        ))}
      </View>
      {/* Load more on scroll or button */}
      {hasMore && !loading && (
        <TouchableOpacity
          onPress={loadMore}
          className="self-center mt-2 px-4 py-2 rounded-lg bg-gray-100"
        >
          <Text>Load more</Text>
        </TouchableOpacity>
      )}
    </View>
  ) : (
    // Analytics tab remains unchanged
    <View className="px-4 mb-8">{/* ... existing analytics list ... */}</View>
  );
}
```

If you’d like to show counts/order from backend:

```tsx
const { tabs: profileTabs } = useProfileTabs();
// Use profileTabs to show counts/badges or to drive the order of contentTabs
```

---

### Single Item View (Optional)

On tile tap, fetch full details:

```ts
async function openItem(id: string) {
  const token = await getToken();
  const res = await fetch(`/api/user/content/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  // Navigate to details screen with data.item
}
```

---

### Tips

- Use `thumbnailUrl` for grids; stream/play from `fileUrl` on detail.
- Handle `popular` vs `recent` sort with a small toggle in the header.
- Debounce scroll-based `loadMore` if needed.
- Keep a small cache keyed by `tab|page` to reduce flicker on tab swaps.



