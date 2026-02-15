# Frontend Admin Delete Reported Content API Guide

## Overview

This document provides a complete guide for integrating the admin delete reported content API into the frontend application. This endpoint allows administrators to permanently delete content that has been reported by users.

**Base URL:** `https://jevahapp-backend.onrender.com` (or your backend URL)

**Authentication:** All endpoints require Bearer token authentication with admin role:
```
Authorization: Bearer <admin_jwt_token>
```

**Important:** This endpoint is **admin-only**. Only users with the `admin` role can access this endpoint.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [API Endpoint](#api-endpoint)
3. [Integration Flow](#integration-flow)
4. [Error Handling](#error-handling)
5. [Code Examples](#code-examples)
6. [Best Practices](#best-practices)
7. [UI/UX Recommendations](#uiux-recommendations)
8. [Testing Checklist](#testing-checklist)

---

## Quick Start

### Basic Delete Flow

```typescript
// Delete reported content as admin
const response = await fetch(`${API_BASE}/api/media/reports/${mediaId}/delete`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const result = await response.json();

if (result.success) {
  console.log(`Content "${result.data.mediaTitle}" deleted successfully`);
  console.log(`Resolved ${result.data.reportsResolved} reports`);
}
```

---

## API Endpoint

### Delete Reported Content

**Endpoint:** `DELETE /api/media/reports/:id/delete`

**Purpose:** Permanently delete content that has been reported. This endpoint:
- Deletes the media files from storage
- Marks all related reports as "resolved"
- Sends notification to the content creator
- Invalidates relevant caches
- Logs the deletion action for audit trail

**Access:** Admin only

#### Request

```typescript
DELETE /api/media/reports/507f1f77bcf86cd799439011/delete
Headers:
  Authorization: Bearer <admin_token>
```

**Path Parameters:**
- `id` (string, required): MongoDB ObjectId of the media item to delete

#### Success Response (200)

```json
{
  "success": true,
  "message": "Reported media deleted successfully",
  "data": {
    "mediaId": "507f1f77bcf86cd799439011",
    "mediaTitle": "Inappropriate Content Title",
    "contentType": "videos",
    "reportsResolved": 3,
    "deletedBy": "Admin Name"
  }
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 401 | `UNAUTHORIZED` | User not authenticated or token missing |
| 403 | `FORBIDDEN` | User is not an admin |
| 400 | `INVALID_MEDIA_ID` | Invalid media ID format |
| 404 | `MEDIA_NOT_FOUND` | Media item not found |
| 500 | `SERVER_ERROR` | Internal server error |

**Error Response Format:**
```json
{
  "success": false,
  "message": "Forbidden: Admin access required"
}
```

---

## Integration Flow

### 1. Admin Dashboard - Reported Content List

When displaying reported content in the admin dashboard:

```typescript
interface ReportedContent {
  _id: string;
  mediaId: {
    _id: string;
    title: string;
    contentType: string;
    thumbnailUrl: string;
  };
  reason: string;
  description?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  reportedBy: {
    firstName: string;
    lastName: string;
    username: string;
  };
  createdAt: string;
  reportCount?: number;
}
```

### 2. Delete Action Flow

```typescript
// Step 1: Show confirmation dialog
const handleDeleteContent = async (mediaId: string, mediaTitle: string) => {
  const confirmed = await showDeleteConfirmation({
    title: 'Delete Reported Content',
    message: `Are you sure you want to permanently delete "${mediaTitle}"? This action cannot be undone.`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
  });

  if (!confirmed) return;

  // Step 2: Show loading state
  setDeleting(true);

  try {
    // Step 3: Call delete endpoint
    const response = await deleteReportedContent(mediaId);

    // Step 4: Show success message
    showSuccessToast(`Content "${mediaTitle}" deleted successfully`);

    // Step 5: Refresh the reports list
    refreshReportsList();

    // Step 6: Update analytics/metrics if needed
    updateAdminMetrics();
  } catch (error) {
    // Step 7: Handle errors
    handleDeleteError(error);
  } finally {
    setDeleting(false);
  }
};
```

---

## Error Handling

### Complete Error Handling Example

```typescript
async function deleteReportedContent(mediaId: string): Promise<DeleteResult> {
  try {
    const response = await fetch(
      `${API_BASE}/api/media/reports/${mediaId}/delete`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getAdminToken()}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      // Handle specific error cases
      switch (response.status) {
        case 401:
          throw new Error('Unauthorized: Please log in again');
        case 403:
          throw new Error('Access denied: Admin privileges required');
        case 404:
          throw new Error('Content not found');
        case 500:
          throw new Error('Server error: Please try again later');
        default:
          throw new Error(data.message || 'Failed to delete content');
      }
    }

    if (!data.success) {
      throw new Error(data.message || 'Delete operation failed');
    }

    return data.data;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error: Please check your connection');
    }
    throw error;
  }
}
```

---

## Code Examples

### React/React Native Example

```typescript
import React, { useState } from 'react';
import { Alert, ActivityIndicator } from 'react-native';

interface DeleteReportedContentProps {
  mediaId: string;
  mediaTitle: string;
  onDeleted: () => void;
}

const DeleteReportedContentButton: React.FC<DeleteReportedContentProps> = ({
  mediaId,
  mediaTitle,
  onDeleted,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    // Show confirmation dialog
    Alert.alert(
      'Delete Reported Content',
      `Are you sure you want to permanently delete "${mediaTitle}"?\n\nThis action cannot be undone and will:\n• Delete all media files\n• Resolve all related reports\n• Notify the content creator`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              const response = await fetch(
                `${API_BASE}/api/media/reports/${mediaId}/delete`,
                {
                  method: 'DELETE',
                  headers: {
                    'Authorization': `Bearer ${await getAdminToken()}`,
                  },
                }
              );

              const result = await response.json();

              if (!response.ok || !result.success) {
                throw new Error(result.message || 'Failed to delete content');
              }

              Alert.alert(
                'Success',
                `Content "${mediaTitle}" has been deleted successfully.\n\nResolved ${result.data.reportsResolved} report(s).`,
                [{ text: 'OK', onPress: onDeleted }]
              );
            } catch (error: any) {
              Alert.alert(
                'Error',
                error.message || 'Failed to delete content. Please try again.',
                [{ text: 'OK' }]
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Button
      title={isDeleting ? 'Deleting...' : 'Delete Content'}
      onPress={handleDelete}
      disabled={isDeleting}
      color="#FF3B30"
      icon={isDeleting ? <ActivityIndicator /> : <TrashIcon />}
    />
  );
};
```

### TypeScript Service Class Example

```typescript
class AdminContentModerationService {
  private baseUrl: string;
  private getAuthToken: () => Promise<string>;

  constructor(baseUrl: string, getAuthToken: () => Promise<string>) {
    this.baseUrl = baseUrl;
    this.getAuthToken = getAuthToken;
  }

  /**
   * Delete reported content (admin only)
   * @param mediaId - The ID of the media to delete
   * @returns Promise with deletion result
   */
  async deleteReportedContent(
    mediaId: string
  ): Promise<{
    mediaId: string;
    mediaTitle: string;
    contentType: string;
    reportsResolved: number;
    deletedBy: string;
  }> {
    const token = await this.getAuthToken();

    const response = await fetch(
      `${this.baseUrl}/api/media/reports/${mediaId}/delete`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete content');
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Delete operation failed');
    }

    return result.data;
  }

  /**
   * Check if user is admin before showing delete button
   */
  async checkAdminAccess(): Promise<boolean> {
    try {
      const token = await this.getAuthToken();
      // Decode token or call a user info endpoint
      const userInfo = await this.getUserInfo(token);
      return userInfo.role === 'admin';
    } catch {
      return false;
    }
  }

  private async getUserInfo(token: string) {
    // Implementation depends on your auth system
    // This is a placeholder
    const response = await fetch(`${this.baseUrl}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
  }
}

// Usage
const adminService = new AdminContentModerationService(
  API_BASE,
  getAdminToken
);

try {
  const result = await adminService.deleteReportedContent(mediaId);
  console.log(`Deleted: ${result.mediaTitle}`);
  console.log(`Resolved ${result.reportsResolved} reports`);
} catch (error) {
  console.error('Delete failed:', error);
}
```

### Expo/React Native Hook Example

```typescript
import { useState } from 'react';
import { useAuth } from './useAuth';

interface UseDeleteReportedContentReturn {
  deleteContent: (mediaId: string) => Promise<void>;
  isDeleting: boolean;
  error: string | null;
}

export function useDeleteReportedContent(): UseDeleteReportedContentReturn {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token, user } = useAuth();

  const deleteContent = async (mediaId: string) => {
    // Verify admin access
    if (user?.role !== 'admin') {
      throw new Error('Admin access required');
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/api/media/reports/${mediaId}/delete`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to delete content');
      }

      return result.data;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to delete content';
      setError(errorMessage);
      throw err;
    } finally {
      setIsDeleting(false);
    }
  };

  return { deleteContent, isDeleting, error };
}

// Usage in component
function AdminReportedContentList() {
  const { deleteContent, isDeleting, error } = useDeleteReportedContent();
  const [reports, setReports] = useState<ReportedContent[]>([]);

  const handleDelete = async (mediaId: string, mediaTitle: string) => {
    if (confirm(`Delete "${mediaTitle}"?`)) {
      try {
        await deleteContent(mediaId);
        // Remove from local state
        setReports(reports.filter(r => r.mediaId._id !== mediaId));
        showToast('Content deleted successfully');
      } catch (err) {
        showToast(error || 'Delete failed');
      }
    }
  };

  return (
    // Render list with delete buttons
  );
}
```

---

## Best Practices

### 1. **Always Verify Admin Access**

```typescript
// Check admin role before showing delete button
const isAdmin = user?.role === 'admin';

if (!isAdmin) {
  return null; // Don't render delete button
}
```

### 2. **Show Confirmation Dialog**

Always require explicit confirmation before deleting:

```typescript
const confirmed = await showConfirmation({
  title: 'Delete Content',
  message: 'This action cannot be undone.',
  confirmText: 'Delete',
  cancelText: 'Cancel',
  type: 'destructive', // Red/destructive styling
});
```

### 3. **Handle Loading States**

```typescript
const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

const isDeleting = (mediaId: string) => deletingIds.has(mediaId);

const handleDelete = async (mediaId: string) => {
  setDeletingIds(prev => new Set(prev).add(mediaId));
  try {
    await deleteReportedContent(mediaId);
  } finally {
    setDeletingIds(prev => {
      const next = new Set(prev);
      next.delete(mediaId);
      return next;
    });
  }
};
```

### 4. **Optimistic UI Updates**

```typescript
// Remove from list immediately, rollback on error
const handleDelete = async (mediaId: string) => {
  const originalReports = [...reports];
  
  // Optimistic update
  setReports(reports.filter(r => r.mediaId._id !== mediaId));

  try {
    await deleteReportedContent(mediaId);
    // Success - already removed
  } catch (error) {
    // Rollback on error
    setReports(originalReports);
    showError('Failed to delete content');
  }
};
```

### 5. **Log Admin Actions**

```typescript
// Log admin actions for audit trail
const handleDelete = async (mediaId: string, mediaTitle: string) => {
  try {
    await deleteReportedContent(mediaId);
    
    // Log to analytics
    analytics.logEvent('admin_content_deleted', {
      mediaId,
      mediaTitle,
      deletedBy: user.id,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    analytics.logEvent('admin_content_delete_failed', {
      mediaId,
      error: error.message,
    });
  }
};
```

### 6. **Refresh Related Data**

After deletion, refresh:
- Reports list
- Admin dashboard metrics
- Content moderation queue
- Any cached data

```typescript
const handleDelete = async (mediaId: string) => {
  await deleteReportedContent(mediaId);
  
  // Refresh all related data
  await Promise.all([
    refreshReportsList(),
    refreshAdminMetrics(),
    refreshModerationQueue(),
    invalidateCache(),
  ]);
};
```

---

## UI/UX Recommendations

### 1. **Delete Button Placement**

Place delete button in:
- Admin dashboard → Reported content list
- Content moderation panel
- Individual report detail view

### 2. **Visual Indicators**

```typescript
// Use destructive/red styling
<Button
  title="Delete Content"
  color="#FF3B30" // Red
  icon={<TrashIcon />}
  style={{ backgroundColor: '#FF3B30' }}
/>
```

### 3. **Confirmation Dialog**

Show clear, informative confirmation:

```typescript
Alert.alert(
  'Delete Reported Content',
  `Are you sure you want to permanently delete "${mediaTitle}"?\n\n` +
  `This will:\n` +
  `• Delete all media files permanently\n` +
  `• Resolve ${reportCount} report(s)\n` +
  `• Notify the content creator\n` +
  `• This action cannot be undone`,
  [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete',
      style: 'destructive',
      onPress: handleConfirmDelete,
    },
  ]
);
```

### 4. **Success Feedback**

```typescript
// Show success message with details
showSuccessToast({
  title: 'Content Deleted',
  message: `"${mediaTitle}" has been deleted.\nResolved ${reportsResolved} report(s).`,
  duration: 5000,
});
```

### 5. **Error Feedback**

```typescript
// Show clear error messages
showErrorToast({
  title: 'Delete Failed',
  message: error.message || 'Unable to delete content. Please try again.',
  action: {
    label: 'Retry',
    onPress: () => handleDelete(mediaId),
  },
});
```

### 6. **Loading States**

```typescript
// Show loading indicator during deletion
{isDeleting ? (
  <ActivityIndicator size="small" color="#FF3B30" />
) : (
  <TrashIcon />
)}
```

---

## Testing Checklist

### Functional Testing

- [ ] Admin can delete reported content
- [ ] Non-admin users cannot access endpoint (403 error)
- [ ] Unauthenticated users cannot access endpoint (401 error)
- [ ] Invalid media ID returns 400 error
- [ ] Non-existent media returns 404 error
- [ ] All related reports are marked as resolved
- [ ] Content creator receives notification
- [ ] Media files are deleted from storage
- [ ] Cache is invalidated correctly

### UI Testing

- [ ] Delete button only visible to admins
- [ ] Confirmation dialog appears before deletion
- [ ] Loading state shows during deletion
- [ ] Success message displays after deletion
- [ ] Error message displays on failure
- [ ] Content is removed from list after deletion
- [ ] Reports list updates correctly

### Edge Cases

- [ ] Handle network errors gracefully
- [ ] Handle expired tokens (401)
- [ ] Handle concurrent deletions
- [ ] Handle deletion of already-deleted content
- [ ] Handle very long media titles in UI
- [ ] Handle missing media metadata

### Integration Testing

```typescript
describe('Admin Delete Reported Content', () => {
  it('should delete content and resolve reports', async () => {
    const mediaId = 'test-media-id';
    const result = await adminService.deleteReportedContent(mediaId);
    
    expect(result.success).toBe(true);
    expect(result.data.reportsResolved).toBeGreaterThan(0);
  });

  it('should reject non-admin users', async () => {
    const nonAdminToken = await getNonAdminToken();
    
    await expect(
      deleteWithToken(mediaId, nonAdminToken)
    ).rejects.toThrow('Admin access required');
  });
});
```

---

## Security Considerations

1. **Always verify admin role on frontend AND backend**
   - Frontend: Hide delete button for non-admins
   - Backend: Enforce admin check (already implemented)

2. **Use secure token storage**
   ```typescript
   // Use secure storage for admin tokens
   import * as SecureStore from 'expo-secure-store';
   
   await SecureStore.setItemAsync('admin_token', token);
   ```

3. **Log all admin actions**
   - Track who deleted what and when
   - Useful for audit trails and debugging

4. **Rate limiting**
   - Backend already implements rate limiting
   - Frontend should also throttle rapid delete requests

---

## Related Endpoints

- `GET /api/media/reports/pending` - Get all pending reports
- `GET /api/media/:id/reports` - Get reports for specific media
- `POST /api/media/reports/:reportId/review` - Review a report
- `POST /api/media/:id/report` - Report content (for users)

---

## Support

For issues or questions:
- Check backend logs for detailed error messages
- Verify admin token is valid and not expired
- Ensure user role is set to "admin" in database
- Contact backend team for API-related issues

---

## Changelog

### Version 1.0.0 (Current)
- Initial release
- Admin-only delete endpoint
- Automatic report resolution
- Content creator notifications
- Cache invalidation

---

**Last Updated:** [Current Date]
**API Version:** 1.0.0

