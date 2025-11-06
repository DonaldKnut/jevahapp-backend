# Create Forum API - Frontend Documentation

## Endpoint

**POST** `/api/community/forum/create`

**Access:** Authenticated users only (requires Bearer token)

**Rate Limit:** 10 requests per hour

---

## Request

### Headers
```
Authorization: Bearer {token}
Content-Type: application/json
```

### Body
```json
{
  "title": "Forum Title",        // Required - 3-100 characters
  "description": "Forum description" // Required - 10-500 characters
}
```

### Example Request
```typescript
const createForum = async (title: string, description: string) => {
  const response = await fetch('/api/community/forum/create', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: title,
      description: description
    })
  });
  
  return await response.json();
};
```

---

## Response

### Success (201 Created)
```json
{
  "success": true,
  "data": {
    "_id": "forum-id",
    "title": "Forum Title",
    "description": "Forum description",
    "createdBy": {
      "_id": "user-id",
      "firstName": "John",
      "lastName": "Doe",
      "username": "john_doe"
    },
    "postsCount": 0,
    "participantsCount": 0,
    "isActive": true,
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

### Error (400 Bad Request)
```json
{
  "success": false,
  "error": "Validation error: title must be at least 3 characters"
}
```

### Error (401 Unauthorized)
```json
{
  "success": false,
  "error": "Unauthorized: Authentication required"
}
```

### Error (429 Too Many Requests)
```json
{
  "success": false,
  "error": "Rate limit exceeded"
}
```

---

## Validation Rules

- **title**: Required, 3-100 characters
- **description**: Required, 10-500 characters

---

## Usage Example

```typescript
// React/React Native example
const handleCreateForum = async () => {
  try {
    const result = await createForum(
      "Youth Ministry Discussions",
      "A space for youth ministry leaders to share ideas and resources"
    );
    
    if (result.success) {
      console.log("Forum created:", result.data);
      // Navigate to the new forum or refresh list
    } else {
      console.error("Error:", result.error);
    }
  } catch (error) {
    console.error("Failed to create forum:", error);
  }
};
```

---

**That's it!** Just hit the endpoint with title and description, and you'll get back the created forum object.


