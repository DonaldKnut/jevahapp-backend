# React Native Caching Strategy

## ⚠️ Important: HTTP Cache Headers Don't Help React Native

**The HTTP cache headers I added (`Cache-Control`, `ETag`) won't automatically cache in React Native.**

React Native's `fetch()` and `axios` **don't cache responses** like browsers do. You need to implement caching manually.

---

## What Actually Helps React Native

### ✅ **Backend Redis Caching** (Already Done - This Helps!)
- **Server-side caching** still works perfectly
- Faster backend responses = faster React Native app
- **This is the main benefit** - backend serves cached data in 50ms instead of 500ms

### ❌ **HTTP Cache Headers** (Doesn't Help React Native)
- React Native doesn't use browser cache
- `Cache-Control` headers are ignored by `fetch()`
- Need to implement client-side caching manually

---

## React Native Caching Solutions

### Option 1: **React Query / TanStack Query** (RECOMMENDED)

**Why**: Industry standard, handles caching automatically, works with React Native

**Installation**:
```bash
npm install @tanstack/react-query
```

**Usage**:
```typescript
import { useQuery } from '@tanstack/react-query';

function useAllContent(page: number) {
  return useQuery({
    queryKey: ['all-content', page],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE}/api/media/public/all-content?page=${page}&limit=50`
      );
      return response.json();
    },
    staleTime: 15 * 60 * 1000, // 15 minutes (matches backend cache)
    cacheTime: 30 * 60 * 1000, // 30 minutes
    // Automatically caches, deduplicates, and refetches
  });
}
```

**Benefits**:
- ✅ Automatic caching
- ✅ Request deduplication
- ✅ Background refetching
- ✅ Offline support
- ✅ Works with React Native

---

### Option 2: **SWR** (Alternative)

**Why**: Simpler than React Query, good for basic caching

**Installation**:
```bash
npm install swr
```

**Usage**:
```typescript
import useSWR from 'swr';

function useAllContent(page: number) {
  const { data, error } = useSWR(
    [`all-content`, page],
    async () => {
      const response = await fetch(
        `${API_BASE}/api/media/public/all-content?page=${page}&limit=50`
      );
      return response.json();
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 15 * 60 * 1000, // 15 minutes
    }
  );
  
  return { data, error, isLoading: !data && !error };
}
```

---

### Option 3: **AsyncStorage + Custom Hook** (Manual)

**Why**: Full control, but more code to write

**Installation**:
```bash
npm install @react-native-async-storage/async-storage
```

**Usage**:
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

async function getCachedOrFetch(key: string, fetchFn: () => Promise<any>, ttl: number = 900000) {
  // Try cache first
  const cached = await AsyncStorage.getItem(key);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < ttl) {
      return data; // Cache hit
    }
  }
  
  // Cache miss - fetch and cache
  const data = await fetchFn();
  await AsyncStorage.setItem(key, JSON.stringify({
    data,
    timestamp: Date.now(),
  }));
  return data;
}
```

---

## Image Caching (CRITICAL for React Native)

React Native's default `Image` component **doesn't cache** well. You need a library:

### **react-native-fast-image** (RECOMMENDED)

**Installation**:
```bash
npm install react-native-fast-image
```

**Usage**:
```typescript
import FastImage from 'react-native-fast-image';

<FastImage
  source={{
    uri: media.thumbnailUrl,
    priority: FastImage.priority.normal,
    cache: FastImage.cacheControl.immutable, // Aggressive caching
  }}
  style={styles.thumbnail}
/>
```

**Benefits**:
- ✅ Automatic image caching
- ✅ Much faster image loading
- ✅ Reduces memory usage
- ✅ Works offline

---

## Recommended React Native Setup

### 1. **Backend** (Already Done ✅)
- Redis caching: 15 minutes
- Fast responses: 50-200ms for cached data

### 2. **React Native App** (Need to Add)

**Install**:
```bash
npm install @tanstack/react-query react-native-fast-image
```

**Setup React Query**:
```typescript
// App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15 * 60 * 1000, // 15 minutes (matches backend)
      cacheTime: 30 * 60 * 1000, // 30 minutes
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Your app */}
    </QueryClientProvider>
  );
}
```

**Use in Components**:
```typescript
function AllContentScreen() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['all-content', page],
    queryFn: () => fetchAllContent(page),
  });

  // Data is automatically cached!
  // Next time you visit, instant load (no network request)
}
```

---

## Performance Comparison

### Without Client-Side Caching
- **First Load**: 500ms (backend cache hit)
- **Navigate Away & Back**: 500ms again (new request)
- **Total**: 1000ms for 2 visits

### With React Query
- **First Load**: 500ms (backend cache hit)
- **Navigate Away & Back**: **0ms** (client cache hit)
- **Total**: 500ms for 2 visits (**2x faster**)

### With React Query + Fast Image
- **First Load**: 500ms + image loading
- **Navigate Away & Back**: **0ms** + **instant images** (cached)
- **Total**: Much faster, smoother UX

---

## What You Should Do

### Immediate (High Impact)
1. ✅ **Backend caching** - Already done!
2. ⚠️ **Add React Query** - For API response caching
3. ⚠️ **Add Fast Image** - For image caching

### Later (Nice to Have)
4. **AsyncStorage** - For offline support
5. **Request deduplication** - React Query does this automatically
6. **Prefetching** - Prefetch next page while scrolling

---

## Summary

**Backend caching helps** (faster server responses), but **React Native needs client-side caching** to be truly fast.

**Recommended Stack**:
- ✅ Backend: Redis caching (done)
- ⚠️ Frontend: React Query (for API caching)
- ⚠️ Frontend: Fast Image (for image caching)

This gives you:
- **Backend**: 50-200ms responses (cached)
- **Frontend**: 0ms for cached data (React Query)
- **Images**: Instant loading (Fast Image)

**Result**: App feels instant, even on slow networks!

