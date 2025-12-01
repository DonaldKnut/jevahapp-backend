# Frontend API Fixes Required

**Date:** 2024  
**Priority:** 🔴 CRITICAL

---

## 🐛 Issue 1: Query Parameter Mismatch

### Problem
Frontend sends `sort` but backend expects `sortBy`.

### Frontend Code (WRONG)
```typescript
// copyrightFreeMusicAPI.ts line 92
const params = new URLSearchParams({
  page: page.toString(),
  limit: limit.toString(),
  sort,  // ❌ WRONG - backend expects "sortBy"
});
```

### Backend Expects
```typescript
// Backend expects "sortBy" query parameter
GET /api/audio/copyright-free?sortBy=popular&page=1&limit=20
```

### Fix Required

**File:** `app/services/copyrightFreeMusicAPI.ts`

**Change line 92:**
```typescript
// ❌ BEFORE
const params = new URLSearchParams({
  page: page.toString(),
  limit: limit.toString(),
  sort,  // Wrong parameter name
});

// ✅ AFTER
const params = new URLSearchParams({
  page: page.toString(),
  limit: limit.toString(),
  sortBy: sort,  // Correct parameter name
});
```

---

## 🐛 Issue 2: TypeScript Error (Already Fixed ✅)

### Problem
Line 332 used `TokenUtils.getToken()` which doesn't exist.

### Fix Applied ✅
```typescript
// Line 332 - Already fixed
const token = await TokenUtils.getAuthToken(); // ✅ Correct
```

---

## 🐛 Issue 3: Like/Unlike Endpoint Mismatch

### Problem
Frontend has separate `likeSong()` and `unlikeSong()` methods, but backend uses a **toggle endpoint** (single endpoint for both).

### Frontend Code (WRONG)
```typescript
// ❌ WRONG - Frontend tries DELETE method
async unlikeSong(songId: string) {
  const response = await fetch(`${this.baseUrl}/${songId}/like`, {
    method: "DELETE",  // ❌ Backend doesn't support DELETE
    ...
  });
}
```

### Backend Reality
```typescript
// Backend uses POST for both like and unlike (toggle)
POST /api/audio/copyright-free/:songId/like
```

### Fix Required

**File:** `app/services/copyrightFreeMusicAPI.ts`

**Remove `unlikeSong()` method and use single toggle:**

```typescript
// ✅ CORRECT - Single toggle method
async toggleLike(songId: string): Promise<{
  success: boolean;
  data: { 
    liked: boolean; 
    likeCount: number;
    viewCount: number;
    listenCount: number;
  };
}> {
  try {
    const token = await TokenUtils.getAuthToken();
    if (!token) {
      throw new Error("Authentication required");
    }

    const response = await fetch(`${this.baseUrl}/${songId}/like`, {
      method: "POST",  // ✅ Always POST (toggle)
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error toggling like for song ${songId}:`, error);
    throw error;
  }
}
```

**Then update usage:**
```typescript
// ❌ OLD WAY
if (song.isLiked) {
  await copyrightFreeMusicAPI.unlikeSong(songId);
} else {
  await copyrightFreeMusicAPI.likeSong(songId);
}

// ✅ NEW WAY (single toggle)
const result = await copyrightFreeMusicAPI.toggleLike(songId);
song.isLiked = result.data.liked;
song.likeCount = result.data.likeCount;
```

---

## 🐛 Issue 4: Save/Unsave Endpoint Mismatch

### Problem
Frontend has separate `saveSong()` and `unsaveSong()` methods, but backend uses a **toggle endpoint**.

### Frontend Code (WRONG)
```typescript
// ❌ WRONG - Frontend tries DELETE method
async unsaveSong(songId: string) {
  const response = await fetch(`${this.baseUrl}/${songId}/save`, {
    method: "DELETE",  // ❌ Backend doesn't support DELETE
    ...
  });
}
```

### Backend Reality
```typescript
// Backend uses POST for both save and unsave (toggle)
POST /api/audio/copyright-free/:songId/save
```

### Fix Required

**File:** `app/services/copyrightFreeMusicAPI.ts`

**Remove `unsaveSong()` method and use single toggle:**

```typescript
// ✅ CORRECT - Single toggle method
async toggleSave(songId: string): Promise<{
  success: boolean;
  data: { 
    bookmarked: boolean;
    bookmarkCount: number;
  };
}> {
  try {
    const token = await TokenUtils.getAuthToken();
    if (!token) {
      throw new Error("Authentication required");
    }

    const response = await fetch(`${this.baseUrl}/${songId}/save`, {
      method: "POST",  // ✅ Always POST (toggle)
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error toggling save for song ${songId}:`, error);
    throw error;
  }
}
```

---

## 🐛 Issue 5: Response Format Mismatch

### Problem
Frontend expects different response format than backend returns.

### Frontend Expects
```typescript
{
  success: boolean;
  data: { song: CopyrightFreeSongResponse };  // ❌ Wrapped in "song" object
}
```

### Backend Returns
```typescript
{
  success: true;
  message: "Song retrieved successfully";
  data: Song;  // ✅ Direct song object, NOT wrapped
}
```

### Fix Required

**File:** `app/services/copyrightFreeMusicAPI.ts`

**Update `getSongById()` method:**

```typescript
// ❌ BEFORE
async getSongById(songId: string): Promise<{
  success: boolean;
  data: { song: CopyrightFreeSongResponse };  // Wrong format
}> {
  ...
}

// ✅ AFTER
async getSongById(songId: string): Promise<{
  success: boolean;
  data: CopyrightFreeSongResponse;  // Direct song object
}> {
  try {
    const token = await TokenUtils.getAuthToken();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}/${songId}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    // Backend returns { success: true, data: Song }
    // NOT { success: true, data: { song: Song } }
    return {
      success: result.success,
      data: result.data,  // Direct song object
    };
  } catch (error) {
    console.error(`Error fetching song ${songId}:`, error);
    throw error;
  }
}
```

---

## 🔧 Complete Fixed API Service

Here's the corrected version of key methods:

```typescript
// app/services/copyrightFreeMusicAPI.ts

class CopyrightFreeMusicAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${getApiBaseUrl()}/api/audio/copyright-free`;
  }

  /**
   * Get all copyright-free songs with pagination and filters
   */
  async getAllSongs(options: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
    sort?: "popular" | "newest" | "oldest" | "title";
  } = {}): Promise<CopyrightFreeSongsResponse> {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        search,
        sort = "popular",
      } = options;

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy: sort,  // ✅ FIX: Changed from "sort" to "sortBy"
      });

      if (category) params.append("category", category);
      if (search) params.append("search", search);

      const token = await TokenUtils.getAuthToken();
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: CopyrightFreeSongsResponse = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching copyright-free songs:", error);
      throw error;
    }
  }

  /**
   * Toggle like/unlike for a song (single endpoint)
   */
  async toggleLike(songId: string): Promise<{
    success: boolean;
    data: {
      liked: boolean;
      likeCount: number;
      viewCount: number;
      listenCount: number;
    };
  }> {
    try {
      const token = await TokenUtils.getAuthToken();
      if (!token) {
        throw new Error("Authentication required");
      }

      const response = await fetch(`${this.baseUrl}/${songId}/like`, {
        method: "POST",  // ✅ Always POST (toggle)
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error toggling like for song ${songId}:`, error);
      throw error;
    }
  }

  /**
   * Toggle save/unsave for a song (single endpoint)
   */
  async toggleSave(songId: string): Promise<{
    success: boolean;
    data: {
      bookmarked: boolean;
      bookmarkCount: number;
    };
  }> {
    try {
      const token = await TokenUtils.getAuthToken();
      if (!token) {
        throw new Error("Authentication required");
      }

      const response = await fetch(`${this.baseUrl}/${songId}/save`, {
        method: "POST",  // ✅ Always POST (toggle)
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error toggling save for song ${songId}:`, error);
      throw error;
    }
  }

  /**
   * Get a single copyright-free song by ID
   */
  async getSongById(songId: string): Promise<{
    success: boolean;
    data: CopyrightFreeSongResponse;  // ✅ Direct song object
  }> {
    try {
      const token = await TokenUtils.getAuthToken();
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseUrl}/${songId}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // ✅ Backend returns { success: true, data: Song }
      return {
        success: result.success,
        data: result.data,  // Direct song object
      };
    } catch (error) {
      console.error(`Error fetching song ${songId}:`, error);
      throw error;
    }
  }
}

export default new CopyrightFreeMusicAPI();
```

---

## ✅ Summary of Fixes

1. ✅ **Query Parameter:** Change `sort` to `sortBy` in `getAllSongs()`
2. ✅ **TypeScript Error:** Already fixed - using `getAuthToken()`
3. ✅ **Like Endpoint:** Remove `likeSong()` and `unlikeSong()`, use single `toggleLike()` method
4. ✅ **Save Endpoint:** Remove `saveSong()` and `unsaveSong()`, use single `toggleSave()` method
5. ✅ **Response Format:** Update `getSongById()` to expect direct song object (not wrapped)

---

## 🧪 Testing After Fixes

1. Test `getAllSongs()` - should return songs without 404
2. Test `toggleLike()` - should toggle like status correctly
3. Test `toggleSave()` - should toggle save status correctly
4. Test `getSongById()` - should return song in correct format
5. Verify no TypeScript errors

---

**Priority:** 🔴 Fix these issues before continuing with UI implementation.

