# Forum Creation API - Frontend Integration Guide

**Last Updated:** 2025-11-07  
**Status:** Production Ready (Requires Auth Token)

---

## Conceptual Model

We operate with two layers:

1. **Forum Categories (Boards)** – curated/top-level topics seeded into the `Forum` collection (e.g. *Bible Study & Teaching*, *Prayer Requests*, *Christian Living*). These entries are flagged with `isCategory: true` and can be fetched via `GET /api/community/forum?view=categories`.
2. **User Forums (Discussions)** – forums authored by authenticated users. Every discussion must reference an existing category using `categoryId`. The backend validates and stores the reference for filtering/routing.

---

## Authentication Requirements

All create/update/delete actions require a Bearer token issued by `/api/auth/login` or Clerk auth.

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

Configure your API client (Axios/fetch wrapper) to attach the token automatically from secure storage so protected requests stay authorized.

---

## Step 1 – Load Available Categories

Call this when the “Create Forum” view mounts so users can pick the category their new forum should live under:

```http
GET /api/community/forum?view=categories&page=1&limit=50
```

Example response (trimmed):

```json
{
  "success": true,
  "data": {
    "forums": [
      {
        "id": "64f1ff5f5f1a5b0012c4e101",
        "title": "Bible Study & Teaching",
        "description": "Deep dive into scripture, biblical teachings, and theological discussions...",
        "isCategory": true,
        "postsCount": 0,
        "participantsCount": 0
      },
      {
        "id": "64f1ff5f5f1a5b0012c4e102",
        "title": "Prayer Requests",
        "description": "Share prayer requests and lift up others in prayer...",
        "isCategory": true
      }
      // ...more categories
    ],
    "pagination": { "page": 1, "limit": 50, "total": 15 }
  }
}
```

Render these options in a select/dropdown with `id` as the value. Keep the user’s choice so you can supply it during creation and while routing afterwards.

---

## Step 2 – Create Forum

### Endpoint Summary
- **Method:** `POST`
- **URL:** `/api/community/forum/create`
- **Rate Limit:** 10 requests/hour/user
- **Auth:** Required (`Authorization: Bearer <token>`)

### Request Body

```json
{
  "categoryId": "64f1ff5f5f1a5b0012c4e101",                                 // required (ObjectId string)
  "title": "How to stay consistent with daily devotions",                          // required, 3-100 chars
  "description": "Share practical routines and accountability methods for keeping daily devotion time meaningful." // required, 10-500 chars
}
```

Backend validation rejects:
- Missing/invalid `categoryId` (must point to an `isCategory` forum)
- Missing/short/long `title`
- Missing/short/long `description`

### Successful Response (201)

```json
{
  "success": true,
  "data": {
    "id": "6502aa84b70b4d0021aa9ff0",
    "_id": "6502aa84b70b4d0021aa9ff0",
    "title": "How to stay consistent with daily devotions",
    "description": "Share practical routines...",
    "isCategory": false,
    "categoryId": "64f1ff5f5f1a5b0012c4e101",
    "category": {
      "id": "64f1ff5f5f1a5b0012c4e101",
      "title": "Bible Study & Teaching",
      "description": "Deep dive into scripture..."
    },
    "createdBy": "64ffbb51b6c0e90012af4567",
    "createdByUser": {
      "_id": "64ffbb51b6c0e90012af4567",
      "username": "grace-a",
      "firstName": "Grace",
      "lastName": "Adeyemi",
      "avatarUrl": "https://.../avatar.png"
    },
    "postsCount": 0,
    "participantsCount": 0,
    "isActive": true,
    "createdAt": "2025-11-07T20:45:00.123Z",
    "updatedAt": "2025-11-07T20:45:00.123Z"
  }
}
```

### Error Responses

| Status | Body | Cause |
|--------|------|-------|
| `400` | `{ "success": false, "error": "Validation error: categoryId is required" }` | Missing/invalid categoryId |
| `400` | `{ "success": false, "error": "Validation error: title must be at least 3 characters" }` | Title too short |
| `400` | `{ "success": false, "error": "Validation error: description must be at least 10 characters" }` | Description too short |
| `401` | `{ "success": false, "error": "Unauthorized: Authentication required" }` | Missing/invalid token |
| `429` | `{ "success": false, "error": "Rate limit exceeded" }` | Too many attempts |

---

## Fetch Discussions by Category

To list user-created forums under a specific category:

```http
GET /api/community/forum?view=discussions&categoryId=<categoryId>&page=1&limit=20
```

Response structure matches the categories call but each entry has `isCategory: false` and carries its parent `category` summary.

Use `view=discussions` without `categoryId` to fetch all discussions regardless of category, or `view=all` to mix categories and discussions (rarely needed).

---

## Frontend Workflow

1. **Fetch categories** (`GET /api/community/forum?view=categories`). Store the list in local/remote state.
2. **Render form controls:**
   - Dropdown/select for category (required)
   - Text input for `title`
   - Textarea for `description`
3. **Validate client-side** against backend limits.
4. **Submit** via your HTTP client once all fields are valid.
5. **Handle success:**
   - Use `response.data.categoryId` (or `response.data.category.id`) to route the user to the correct category view.
   - Refresh the discussion list for that category or append the new forum to the state slice.
6. **Handle errors:** display `response.error` inline.

### Example Hook (Axios)

```ts
import { useState } from "react";
import { apiClient } from "../lib/apiClient";

export function useCreateForum() {
  const [loading, setLoading] = useState(false);

  const createForum = async (payload: { title: string; description: string; categoryId: string }) => {
    setLoading(true);
    try {
      const { data } = await apiClient.post("/community/forum/create", payload);
      return { forum: data.data, error: null };
    } catch (error: any) {
      const message = error.response?.data?.error ?? "Failed to create forum";
      return { forum: null, error: message };
    } finally {
      setLoading(false);
    }
  };

  return { createForum, loading };
}
```

### Example Submission Logic

```ts
const onSubmit = async () => {
  if (!selectedCategoryId) {
    setError("Please choose a category");
    return;
  }

  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();

  if (trimmedTitle.length < 3 || trimmedDescription.length < 10) {
    setError("Title or description is too short");
    return;
  }

  const { forum, error } = await createForum({
    title: trimmedTitle,
    description: trimmedDescription,
    categoryId: selectedCategoryId,
  });

  if (error) {
    toast.error(error);
    return;
  }

  toast.success("Forum created successfully");
  router.push(`/community/forum/${forum.categoryId}?view=discussions`);
};
```

---

## After Creating a Forum: First Discussion Post

Encourage the creator to add the first message so the forum isn’t empty:

```http
POST /api/community/forum/<forumId>/posts
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Here is how my daily devotion routine looks...",
  "embeddedLinks": [
    { "url": "https://youtube.com/...", "type": "video", "title": "Morning Devotional" }
  ],
  "tags": ["devotional"]
}
```

> Note: The backend now rejects posts sent directly to a category (`isCategory: true`). Always supply the actual discussion forum ID.

---

## QA Checklist

- ✅ Category dropdown is populated from `GET /api/community/forum?view=categories`
- ✅ Client-side validation mirrors backend limits
- ✅ Payload includes a valid `categoryId`
- ✅ Authorization header present
- ✅ Success response used to navigate/refresh the correct category
- ✅ UI surfaces backend error messages on failure

Following this approach guarantees every new forum lands under an approved category and keeps navigation consistent across the app.
