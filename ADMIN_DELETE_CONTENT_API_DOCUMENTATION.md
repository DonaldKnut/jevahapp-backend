# Admin Delete Content API Documentation

## Overview

This document provides complete documentation for the admin delete content endpoint, which allows administrators to permanently delete content that violates platform rules and policies.

**Base URL:** `https://api.jevahapp.com` (or your backend URL)

**Authentication:** Bearer token authentication with admin role required

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [API Endpoint](#api-endpoint)
3. [Request Details](#request-details)
4. [Response Details](#response-details)
5. [What Happens When Content is Deleted](#what-happens-when-content-is-deleted)
6. [Error Responses](#error-responses)
7. [Code Examples](#code-examples)
8. [Security & Permissions](#security--permissions)
9. [Best Practices](#best-practices)
10. [Testing Guide](#testing-guide)

---

## Quick Start

### Basic Delete Request

```bash
curl -X DELETE \
  https://api.jevahapp.com/api/media/reports/507f1f77bcf86cd799439011/delete \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

### JavaScript/TypeScript Example

```typescript
const deleteContent = async (mediaId: string, adminToken: string) => {
  const response = await fetch(
    `https://api.jevahapp.com/api/media/reports/${mediaId}/delete`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const result = await response.json();
  return result;
};
```

---

## API Endpoint

### Delete Reported Content

**Endpoint:** `DELETE /api/media/reports/:id/delete`

**Purpose:** Permanently delete content that violates platform rules. This is a destructive operation that:
- Deletes media files from storage (R2/CDN)
- Removes the media document from the database
- Marks all related reports as "resolved"
- Sends notification to the content creator
- Invalidates relevant caches
- Logs the deletion for audit trail

**Access Level:** Admin only (requires `admin` role)

**Rate Limiting:** Standard API rate limits apply

---

## Request Details

### HTTP Method
```
DELETE
```

### URL Structure
```
/api/media/reports/:id/delete
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | MongoDB ObjectId of the media item to delete |

### Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `Authorization` | string | Yes | Bearer token: `Bearer <admin_jwt_token>` |
| `Content-Type` | string | No | `application/json` (optional) |

### Request Body
None required. This is a DELETE request with no body.

### Example Request

```http
DELETE /api/media/reports/507f1f77bcf86cd799439011/delete HTTP/1.1
Host: api.jevahapp.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

---

## Response Details

### Success Response (200 OK)

When content is successfully deleted:

```json
{
  "success": true,
  "message": "Reported media deleted successfully",
  "data": {
    "mediaId": "507f1f77bcf86cd799439011",
    "mediaTitle": "Example Video Title",
    "contentType": "videos",
    "reportsResolved": 3,
    "deletedBy": "John Doe"
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `true` for successful deletion |
| `message` | string | Success message |
| `data.mediaId` | string | The ID of the deleted media |
| `data.mediaTitle` | string | Title of the deleted content |
| `data.contentType` | string | Type of content (videos, music, books, etc.) |
| `data.reportsResolved` | number | Number of reports that were marked as resolved |
| `data.deletedBy` | string | Name of the admin who performed the deletion |

---

## What Happens When Content is Deleted

When an admin deletes content, the following operations occur **in order**:

### 1. **Validation & Authorization**
- ✅ Verifies admin role (`userRole === "admin"`)
- ✅ Validates authentication token
- ✅ Validates media ID format (MongoDB ObjectId)
- ✅ Checks if media exists

### 2. **File Deletion from Storage**
- Deletes main media file from R2/CDN storage (`fileObjectKey`)
- Deletes thumbnail/image from storage (`thumbnailObjectKey`)
- **Note:** Deletion continues even if file deletion fails (logged but non-blocking)

### 3. **Database Operations**
- Marks all related `MediaReport` documents as `status: "resolved"`
- Sets `reviewedBy` to the admin's user ID
- Sets `reviewedAt` to current timestamp
- Adds `adminNotes`: `"Content deleted by admin: {adminName}"`
- Deletes the `Media` document from database

### 4. **Cache Invalidation**
- Deletes cache for specific media: `media:public:{id}`
- Deletes cache for authenticated media: `media:{id}`
- Invalidates all public media caches: `media:public:*`
- Invalidates all media list caches: `media:all:*`

### 5. **Notification to Content Creator**
- Creates a notification of type `content_moderation`
- Title: `"Content Removed"`
- Message: `"Your content "{title}" has been removed due to policy violations."`
- Priority: `high`
- Includes metadata: `mediaId`, `contentType`, `reason`, `deletedBy`

### 6. **Audit Logging**
- Logs deletion event with:
  - Media ID and title
  - Content type
  - Admin ID and name
  - Number of reports resolved
  - Uploader ID

---

## Error Responses

### 403 Forbidden - Not Admin

**Status Code:** `403`

**Response:**
```json
{
  "success": false,
  "message": "Forbidden: Admin access required"
}
```

**Cause:** User does not have `admin` role

---

### 401 Unauthorized - Not Authenticated

**Status Code:** `401`

**Response:**
```json
{
  "success": false,
  "message": "Unauthorized: User not authenticated"
}
```

**Cause:** Missing or invalid authentication token

---

### 400 Bad Request - Invalid Media ID

**Status Code:** `400`

**Response:**
```json
{
  "success": false,
  "message": "Invalid media ID"
}
```

**Cause:** Media ID is not a valid MongoDB ObjectId format

**Example:** Using `"123"` instead of `"507f1f77bcf86cd799439011"`

---

### 404 Not Found - Media Doesn't Exist

**Status Code:** `404`

**Response:**
```json
{
  "success": false,
  "message": "Media not found"
}
```

**Cause:** Media with the provided ID does not exist in the database

---

### 500 Internal Server Error

**Status Code:** `500`

**Response:**
```json
{
  "success": false,
  "message": "Failed to delete reported media"
}
```

**Cause:** Unexpected server error (database connection, storage error, etc.)

**Note:** Check server logs for detailed error information

---

## Code Examples

### React/Next.js Example

```typescript
import { useState } from 'react';

interface DeleteContentResponse {
  success: boolean;
  message: string;
  data?: {
    mediaId: string;
    mediaTitle: string;
    contentType: string;
    reportsResolved: number;
    deletedBy: string;
  };
}

export const useDeleteContent = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteContent = async (
    mediaId: string,
    adminToken: string
  ): Promise<DeleteContentResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/media/reports/${mediaId}/delete`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete content');
      }

      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { deleteContent, loading, error };
};

// Usage in component
const AdminContentModeration = () => {
  const { deleteContent, loading, error } = useDeleteContent();
  const adminToken = useAuth().token; // Your auth hook

  const handleDelete = async (mediaId: string) => {
    if (!confirm('Are you sure you want to permanently delete this content?')) {
      return;
    }

    const result = await deleteContent(mediaId, adminToken);
    
    if (result?.success) {
      alert(`Content "${result.data?.mediaTitle}" deleted successfully`);
      // Refresh content list
    } else {
      alert(`Error: ${error}`);
    }
  };

  return (
    <button 
      onClick={() => handleDelete(mediaId)}
      disabled={loading}
    >
      {loading ? 'Deleting...' : 'Delete Content'}
    </button>
  );
};
```

### Node.js/Express Example

```javascript
const axios = require('axios');

async function deleteReportedContent(mediaId, adminToken) {
  try {
    const response = await axios.delete(
      `https://api.jevahapp.com/api/media/reports/${mediaId}/delete`,
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      }
    );

    console.log('Content deleted:', response.data);
    return response.data;
  } catch (error) {
    if (error.response) {
      // Server responded with error
      console.error('Error:', error.response.data);
      throw new Error(error.response.data.message);
    } else {
      // Network error
      console.error('Network error:', error.message);
      throw error;
    }
  }
}

// Usage
deleteReportedContent('507f1f77bcf86cd799439011', 'your-admin-token')
  .then(result => {
    console.log(`Deleted: ${result.data.mediaTitle}`);
    console.log(`Resolved ${result.data.reportsResolved} reports`);
  })
  .catch(error => {
    console.error('Failed to delete:', error.message);
  });
```

### cURL Example

```bash
#!/bin/bash

MEDIA_ID="507f1f77bcf86cd799439011"
ADMIN_TOKEN="your-admin-jwt-token"
API_URL="https://api.jevahapp.com"

response=$(curl -X DELETE \
  "${API_URL}/api/media/reports/${MEDIA_ID}/delete" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -w "\n%{http_code}")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -eq 200 ]; then
  echo "✅ Content deleted successfully"
  echo "$body" | jq '.'
else
  echo "❌ Error: HTTP $http_code"
  echo "$body" | jq '.'
fi
```

### Python Example

```python
import requests

def delete_content(media_id: str, admin_token: str) -> dict:
    """
    Delete reported content as admin
    
    Args:
        media_id: MongoDB ObjectId of the media to delete
        admin_token: Admin JWT token
        
    Returns:
        Response data as dictionary
    """
    url = f"https://api.jevahapp.com/api/media/reports/{media_id}/delete"
    
    headers = {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.delete(url, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        error_data = e.response.json() if e.response else {}
        raise Exception(error_data.get("message", "Failed to delete content"))
    except requests.exceptions.RequestException as e:
        raise Exception(f"Network error: {str(e)}")

# Usage
try:
    result = delete_content(
        media_id="507f1f77bcf86cd799439011",
        admin_token="your-admin-token"
    )
    print(f"✅ Deleted: {result['data']['mediaTitle']}")
    print(f"📊 Resolved {result['data']['reportsResolved']} reports")
except Exception as e:
    print(f"❌ Error: {e}")
```

---

## Security & Permissions

### Required Permissions

- **Role:** `admin` (checked via `requireAdmin` middleware)
- **Authentication:** Valid JWT token with admin role

### Security Features

1. **Role-Based Access Control (RBAC)**
   - Only users with `admin` role can access this endpoint
   - Role is verified both in middleware and controller

2. **Authentication Required**
   - Valid JWT token must be present
   - Token must contain valid admin user ID

3. **Audit Trail**
   - All deletions are logged with:
     - Admin ID and name
     - Media ID and title
     - Timestamp
     - Number of reports resolved

4. **Non-Blocking File Deletion**
   - If file deletion from storage fails, the operation continues
   - Errors are logged but don't prevent database deletion
   - Ensures content is removed even if storage has issues

---

## Best Practices

### 1. **Always Confirm Before Deleting**

```typescript
const handleDelete = async (mediaId: string) => {
  const confirmed = window.confirm(
    'Are you sure you want to permanently delete this content? ' +
    'This action cannot be undone.'
  );
  
  if (!confirmed) return;
  
  // Proceed with deletion
};
```

### 2. **Show Loading States**

```typescript
const [isDeleting, setIsDeleting] = useState(false);

const deleteContent = async () => {
  setIsDeleting(true);
  try {
    await deleteContent(mediaId, token);
    // Show success message
  } catch (error) {
    // Show error message
  } finally {
    setIsDeleting(false);
  }
};
```

### 3. **Handle Errors Gracefully**

```typescript
try {
  const result = await deleteContent(mediaId, token);
  if (result.success) {
    showSuccessToast(`Content deleted. ${result.data.reportsResolved} reports resolved.`);
    refreshContentList();
  }
} catch (error: any) {
  if (error.response?.status === 403) {
    showErrorToast('You do not have permission to delete content');
  } else if (error.response?.status === 404) {
    showErrorToast('Content not found. It may have already been deleted.');
  } else {
    showErrorToast('Failed to delete content. Please try again.');
  }
}
```

### 4. **Refresh UI After Deletion**

```typescript
const handleDeleteSuccess = async (result: DeleteResponse) => {
  // Remove from UI immediately
  setContentList(prev => prev.filter(item => item.id !== result.data.mediaId));
  
  // Show success notification
  showNotification({
    type: 'success',
    message: `Content "${result.data.mediaTitle}" deleted successfully`,
  });
  
  // Optionally refresh from server
  await refreshContentList();
};
```

### 5. **Log Admin Actions**

```typescript
// Track admin actions for audit
const logAdminAction = async (action: string, mediaId: string) => {
  await analytics.track('admin_action', {
    action,
    mediaId,
    timestamp: new Date().toISOString(),
  });
};
```

---

## Testing Guide

### Manual Testing Checklist

- [ ] **Test with Admin Token**
  - ✅ Should successfully delete content
  - ✅ Should return 200 OK with success data

- [ ] **Test with Non-Admin Token**
  - ✅ Should return 403 Forbidden
  - ✅ Should not delete content

- [ ] **Test with Invalid Token**
  - ✅ Should return 401 Unauthorized

- [ ] **Test with Invalid Media ID**
  - ✅ Should return 400 Bad Request
  - ✅ Should show "Invalid media ID" message

- [ ] **Test with Non-Existent Media ID**
  - ✅ Should return 404 Not Found
  - ✅ Should show "Media not found" message

- [ ] **Verify Side Effects**
  - ✅ Media files deleted from storage
  - ✅ Media document removed from database
  - ✅ Reports marked as resolved
  - ✅ Cache invalidated
  - ✅ Notification sent to creator
  - ✅ Audit log created

### Postman Collection

```json
{
  "info": {
    "name": "Admin Delete Content",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Delete Reported Content",
      "request": {
        "method": "DELETE",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{admin_token}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/media/reports/:id/delete",
          "host": ["{{base_url}}"],
          "path": ["api", "media", "reports", ":id", "delete"],
          "variable": [
            {
              "key": "id",
              "value": "507f1f77bcf86cd799439011"
            }
          ]
        }
      }
    }
  ]
}
```

### Automated Test Example (Jest)

```typescript
describe('DELETE /api/media/reports/:id/delete', () => {
  let adminToken: string;
  let mediaId: string;

  beforeAll(async () => {
    // Get admin token
    adminToken = await getAdminToken();
    // Create test media
    mediaId = await createTestMedia();
  });

  it('should delete content successfully with admin token', async () => {
    const response = await request(app)
      .delete(`/api/media/reports/${mediaId}/delete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.mediaId).toBe(mediaId);
    expect(response.body.data.reportsResolved).toBeGreaterThanOrEqual(0);
  });

  it('should return 403 for non-admin user', async () => {
    const userToken = await getUserToken();
    
    const response = await request(app)
      .delete(`/api/media/reports/${mediaId}/delete`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('Admin access required');
  });

  it('should return 404 for non-existent media', async () => {
    const fakeId = '507f1f77bcf86cd799439999';
    
    const response = await request(app)
      .delete(`/api/media/reports/${fakeId}/delete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Media not found');
  });
});
```

---

## Related Endpoints

- **Report Content:** `POST /api/media/:id/report` - Users can report inappropriate content
- **Get Reports:** `GET /api/media/reports/pending` - Get all pending reports (admin)
- **Review Report:** `POST /api/media/reports/:reportId/review` - Review a specific report (admin)
- **Update Moderation Status:** `PATCH /api/admin/moderation/:id` - Update moderation status (admin)

---

## Support & Troubleshooting

### Common Issues

**Issue:** Getting 403 Forbidden even with admin token
- **Solution:** Verify the user's role is set to `"admin"` in the database

**Issue:** Content deleted but files still in storage
- **Solution:** Check storage service logs. File deletion is non-blocking, but errors are logged

**Issue:** Notification not sent to creator
- **Solution:** Verify creator has valid email and notification service is running

### Contact

For issues or questions, contact the backend team or check server logs for detailed error messages.

---

**Last Updated:** December 2024  
**API Version:** 2.0  
**Endpoint Status:** ✅ Production Ready

