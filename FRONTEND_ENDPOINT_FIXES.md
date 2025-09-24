# Frontend Endpoint Fixes

## Issue: 404 Error on Bookmark Operations

The frontend is getting 404 errors because some parts of the code are using incorrect endpoints.

### ❌ Wrong Endpoints (causing 404s):

```typescript
// These endpoints DON'T exist in the backend:
/api/aceiinnorstt /
  media /
  { id } /
  save /
  api /
  interactions /
  media /
  { id } /
  unsave;
```

### ✅ Correct Endpoints:

```typescript
// Use these endpoints instead:
POST / api / bookmark / { mediaId } / toggle;
GET / api / bookmark / { mediaId } / status;
GET / api / bookmark / user;
```

## Frontend Code Fixes Needed

### 1. Fix AllMediaAPI.ts

**File:** `app/utils/allMediaAPI.ts` (around line 750)

**Replace this:**

```typescript
// ❌ WRONG - This endpoint doesn't exist
async unbookmarkContent(contentId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/interactions/media/${contentId}/save`,
    {
      method: 'POST',
      headers: await this.getAuthHeaders(),
    }
  );
  // ... rest of code
}
```

**With this:**

```typescript
// ✅ CORRECT - Use the unified bookmark endpoint
async unbookmarkContent(contentId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/bookmark/${contentId}/toggle`,
    {
      method: 'POST',
      headers: await this.getAuthHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  console.log('✅ Unbookmark successful:', result);
}
```

### 2. Fix Any Other Bookmark/Save Operations

**Search for these patterns in your frontend code:**

```typescript
// ❌ Replace these patterns:
/api/aceiinnorstt /
  media /
  { id } /
  save /
  api /
  interactions /
  media /
  { id } /
  unsave /
  api /
  interactions /
  { contentType } /
  { id } /
  save /
  api /
  interactions /
  { contentType } /
  { id } /
  unsave /
  // ✅ With this pattern:
  api /
  bookmark /
  { mediaId } /
  toggle;
```

### 3. Update Your ContentInteractionService

Your `ContentInteractionService` is already correct! It's using:

```typescript
// ✅ This is correct in your ContentInteractionService
const response = await fetch(
  `${this.baseURL}/api/bookmark/${contentId}/toggle`,
  {
    method: "POST",
    headers,
  }
);
```

## Backend Endpoints Available

### Bookmark Operations:

- `POST /api/bookmark/{mediaId}/toggle` - Toggle bookmark (save/unsave)
- `GET /api/bookmark/{mediaId}/status` - Get bookmark status
- `GET /api/bookmark/user` - Get user's bookmarked content
- `GET /api/bookmark/{mediaId}/stats` - Get bookmark statistics
- `POST /api/bookmark/bulk` - Bulk bookmark operations

### Content Interactions:

- `POST /api/content/{contentType}/{contentId}/like` - Toggle like
- `POST /api/content/{contentType}/{contentId}/comment` - Add comment
- `POST /api/content/{contentType}/{contentId}/share` - Share content
- `POST /api/content/{contentType}/{contentId}/view` - Record view
- `GET /api/content/{contentType}/{contentId}/metadata` - Get metadata
- `POST /api/content/batch-metadata` - Get batch metadata

## Quick Fix Script

Add this to your frontend to ensure all bookmark operations use the correct endpoint:

```typescript
// utils/bookmarkFix.ts
export const fixBookmarkEndpoint = (contentId: string) => {
  // Replace any old interaction endpoints with bookmark endpoints
  return `/api/bookmark/${contentId}/toggle`;
};

// Usage in your components:
const handleUnbookmark = async (contentId: string) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}${fixBookmarkEndpoint(contentId)}`,
      {
        method: "POST",
        headers: await getAuthHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log("✅ Bookmark operation successful:", result);
  } catch (error) {
    console.error("❌ Bookmark operation failed:", error);
  }
};
```

## Testing the Fix

After making these changes, test with:

```typescript
// Test bookmark toggle
const testBookmark = async () => {
  const contentId = "68cb2e00573976c282832555"; // Use a real content ID
  const response = await fetch(
    `${API_BASE_URL}/api/bookmark/${contentId}/toggle`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${yourToken}`,
      },
    }
  );

  console.log("Response status:", response.status);
  const result = await response.json();
  console.log("Response data:", result);
};
```

This should resolve the 404 errors you're seeing in the console.

