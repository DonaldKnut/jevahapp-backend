# Groups API - Frontend Integration Guide

**Last Updated:** 2025-11-07  
**Status:** Production Ready (Requires Auth Token)

---

## Overview

This guide explains how to consume the Groups API from the frontend. The Groups feature lets authenticated users create, list, join, update, and delete community groups.

### Key Points
- 🔒 **Authentication required** for create/join/update/delete. Include the JWT token from login/Clerk auth.
- ✅ `GET` endpoints for listing groups are public (no token needed).
- 🧾 Request bodies must be sent as JSON (`Content-Type: application/json`).

---

## Authentication

All protected endpoints expect an `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

> **Tip:** After login (`/api/auth/login` or Clerk login), store the returned `token` and send it with every protected request.

---

## Endpoints Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/community/groups` | ✅ | Create a new group |
| `POST` | `/api/community/groups/create` | ✅ | Alias for create (compatibility) |
| `GET` | `/api/community/groups` | ❌ | List public groups |
| `GET` | `/api/community/groups?mine=true` | ✅ | List groups the current user belongs to |
| `GET` | `/api/community/groups/:id` | ✅ for private group | Get single group details |
| `POST` | `/api/community/groups/:id/join` | ✅ | Join a group |
| `POST` | `/api/community/groups/:id/leave` | ✅ | Leave a group |
| `PUT` | `/api/community/groups/:id` | ✅ (owner only) | Update group info |
| `DELETE` | `/api/community/groups/:id` | ✅ (owner only) | Delete group |

---

## Create a Group

### Request

```http
POST /api/community/groups
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Youth Bible Study",
  "description": "Weekly online Bible study for teens",
  "visibility": "public"  // optional: "public" (default) or "private"
}
```

**Required field:** `name` (string)

### Successful Response (201)

```json
{
  "success": true,
  "group": {
    "id": "6501ff5f5f1a5b0012c4e123",
    "name": "Youth Bible Study",
    "description": "Weekly online Bible study for teens",
    "visibility": "public",
    "owner": {
      "id": "64ffbb51b6c0e90012af4567",
      "firstName": "Grace",
      "lastName": "Adeyemi",
      "avatar": "https://.../avatar.png"
    },
    "members": [
      {
        "userId": "64ffbb51b6c0e90012af4567",
        "joinedAt": "2025-11-07T20:40:00.123Z"
      }
    ],
    "createdAt": "2025-11-07T20:40:00.123Z",
    "updatedAt": "2025-11-07T20:40:00.123Z"
  }
}
```

### Error Responses

| Status | Body | Reason |
|--------|------|--------|
| `400` | `{ "success": false, "message": "Validation error: name is required" }` | Missing or invalid `name` |
| `401` | `{ "success": false, "message": "Unauthorized: No token provided" }` | Missing token |
| `401` | `{ "success": false, "message": "Invalid token" }` | Expired/invalid JWT |

---

## List Groups (Public)

```http
GET /api/community/groups
```

### Response

```json
{
  "success": true,
  "items": [
    {
      "id": "6501ff5f5f1a5b0012c4e123",
      "name": "Youth Bible Study",
      "description": "Weekly online Bible study for teens",
      "visibility": "public",
      "owner": { "id": "64ffbb51b6c0e90012af4567", "firstName": "Grace", "lastName": "Adeyemi", "avatar": "https://..." },
      "members": [...],
      "createdAt": "2025-11-07T20:40:00.123Z",
      "updatedAt": "2025-11-07T20:40:00.123Z"
    }
  ],
  "page": 1,
  "pageSize": 1,
  "total": 1
}
```

Use query params `page` and `limit` for pagination, `mine=true` to fetch only groups the current user belongs to (requires token).

---

## Join a Group

```http
POST /api/community/groups/:id/join
Authorization: Bearer <token>
```

### Response

```json
{
  "success": true,
  "membership": {
    "groupId": "6501ff5f5f1a5b0012c4e123",
    "userId": "64ffbb51b6c0e90012af4567"
  }
}
```

---

## Leave a Group

```http
POST /api/community/groups/:id/leave
Authorization: Bearer <token>
```

### Response

```json
{ "success": true }
```

---

## Update Group (Owner Only)

```http
PUT /api/community/groups/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Youth Bible Study - Tuesdays",
  "description": "Now meeting every Tuesday evening",
  "visibility": "private"
}
```

### Response

```json
{
  "success": true,
  "group": {
    "id": "6501ff5f5f1a5b0012c4e123",
    "name": "Youth Bible Study - Tuesdays",
    "description": "Now meeting every Tuesday evening",
    "visibility": "private",
    ...
  }
}
```

Owner-only enforcement happens inside the controller:
- 403 Forbidden if current user is not the group owner.
- 400 if `visibility` is not `public` or `private`.

---

## Delete Group (Owner Only)

```http
DELETE /api/community/groups/:id
Authorization: Bearer <token>
```

### Response

```json
{ "success": true, "message": "Group deleted" }
```

---

## Common Pitfalls & Debugging

- **Missing token (401):** Ensure the app sends `Authorization: Bearer <token>` from login/Clerk.
- **Invalid token:** Token may be expired/invalid. Refresh login or re-generate token.
- **Name missing:** Backend requires `name`. Add validation on the frontend before calling the API.
- **Wrong endpoint:** Use `/api/community/groups` (or `/groups/create`) for POST, not `/create-group`.
- **Visibility value:** Only `public` or `private` are accepted.

---

## Sample Frontend Integration (TypeScript)

```ts
import { apiClient } from "../lib/apiClient"; // axios instance with baseURL & interceptors

interface CreateGroupPayload {
  name: string;
  description?: string;
  visibility?: "public" | "private";
}

export async function createGroup(payload: CreateGroupPayload) {
  const response = await apiClient.post("/community/groups", payload);
  return response.data.group;
}
```

Ensure your Axios instance adds the `Authorization` header automatically, e.g., by reading the token from secure storage.

---

## Backend Behavior Recap
- Auth middleware (`verifyToken`) validates the JWT and attaches `req.userId`.
- `createGroup` controller:
  - Validates `name`.
  - Sets current user as owner and auto-joins them as first member.
  - Responds with `201` and serialized group object.
- All responses follow `{ success: boolean, ... }` format.

---

## Testing Checklist
1. ✅ Obtain a valid JWT token (login or Clerk).
2. ✅ Send POST request with required `name` field.
3. ✅ Confirm 201 response and group data.
4. ✅ Use list endpoint to verify group creation.

If you encounter issues, log the exact HTTP status and response body—most errors come from missing token or missing `name` field.




