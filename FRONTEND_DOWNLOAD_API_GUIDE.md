# Frontend Download API Integration Guide

## Overview

This document provides a complete guide for integrating the backend download API into the frontend application. The API supports initiating downloads, tracking progress, managing offline content, and retrieving download status.

**Base URL:** `https://jevahapp-backend.onrender.com` (or your backend URL)

**Authentication:** All endpoints require Bearer token authentication:
```
Authorization: Bearer <jwt_token>
```

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [API Endpoints](#api-endpoints)
3. [Integration Flow](#integration-flow)
4. [Error Handling](#error-handling)
5. [Code Examples](#code-examples)
6. [Best Practices](#best-practices)
7. [Testing Checklist](#testing-checklist)

---

## Quick Start

### Basic Download Flow

```typescript
// 1. Initiate download
const response = await fetch(`${API_BASE}/api/media/${mediaId}/download`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ fileSize: 12345678 }), // Optional
});

const { downloadUrl, fileName, fileSize, contentType } = await response.json();

// 2. Download file using expo-file-system
// 3. Update status as download progresses
// 4. Mark as completed when done
```

---

## API Endpoints

### 1. Initiate Download

**Endpoint:** `POST /api/media/:mediaId/download`

**Purpose:** Initiates a download and returns a signed download URL.

#### Request

```typescript
POST /api/media/507f1f77bcf86cd799439011/download
Headers:
  Authorization: Bearer <token>
  Content-Type: application/json
Body:
  {
    "fileSize": 12345678  // Optional - number in bytes
  }
```

#### Success Response (200)

```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://cdn.example.com/media/video123.mp4?expires=1234567890&signature=abc123",
    "fileName": "Gospel Video Title",
    "fileSize": 12345678,
    "contentType": "video/mp4"
  }
}
```

**Note:** The response is wrapped in a `data` object as expected by the frontend.

#### Error Responses

All error responses follow this format:
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable error message"
}
```

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_MEDIA_ID` | Invalid media ID format |
| 400 | `VALIDATION_ERROR` | Invalid request data (e.g., negative fileSize) |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication token |
| 403 | `DOWNLOAD_NOT_ALLOWED` | Media is not available for download |
| 404 | `MEDIA_NOT_FOUND` | Media item doesn't exist |
| 500 | `INTERNAL_ERROR` | Server error occurred |

#### Important Notes

- `fileSize` is **optional** - you can send `{}` or omit it
- `downloadUrl` is a **signed URL** that expires in **1 hour**
- The URL provides direct file access - no additional authentication needed
- **Do NOT** treat this as an interaction event (separate from views/likes)

---

### 2. Update Download Status

**Endpoint:** `PATCH /api/media/offline-downloads/:mediaId`

**Purpose:** Updates download progress, status, and local file path as the download progresses.

#### Request

```typescript
PATCH /api/media/offline-downloads/507f1f77bcf86cd799439011
Headers:
  Authorization: Bearer <token>
  Content-Type: application/json
Body:
  {
    "downloadStatus": "downloading",  // Optional: "pending" | "downloading" | "completed" | "failed" | "cancelled"
    "downloadProgress": 45,           // Optional: 0-100
    "isDownloaded": false,             // Optional: boolean
    "localPath": "file:///path/to/file.mp4"  // Optional: sent only on completion
  }
```

#### Common Request Patterns

**Initial Status (Download Starting):**
```json
{
  "downloadStatus": "downloading",
  "downloadProgress": 0
}
```

**Progress Update (During Download):**
```json
{
  "downloadProgress": 45
}
```

**Completion:**
```json
{
  "localPath": "file:///var/mobile/.../downloads/media123.mp4",
  "isDownloaded": true,
  "downloadStatus": "completed",
  "downloadProgress": 100
}
```

**Failure:**
```json
{
  "downloadStatus": "failed",
  "downloadProgress": 0
}
```

#### Success Response (200)

```json
{
  "success": true,
  "data": {
    "mediaId": "507f1f77bcf86cd799439011",
    "downloadStatus": "completed",
    "downloadProgress": 100,
    "isDownloaded": true,
    "localPath": "file:///path/to/file.mp4",
    "fileName": "Gospel Video Title",
    "fileSize": 12345678,
    "contentType": "video/mp4",
    "updatedAt": "2024-01-20T15:30:00Z"
  },
  "message": "Download status updated successfully"
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid status or progress value (field: "downloadStatus" or "downloadProgress") |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication token |
| 404 | `DOWNLOAD_NOT_FOUND` | Download record not found (will be created automatically) |
| 500 | `SERVER_ERROR` | Server error occurred |

#### Important Notes

- **Upsert behavior:** If download record doesn't exist, it will be created automatically
- Only send fields you want to update (partial updates supported)
- `downloadProgress` must be between 0 and 100
- `localPath` is the file system path from your app (backend stores it as-is)
- Update progress every 10-20% for better UX (don't spam with every byte)

---

### 3. Get User's Downloads

**Endpoint:** `GET /api/media/offline-downloads`

**Purpose:** Retrieves a paginated list of all downloads for the authenticated user. This endpoint returns download metadata along with media information for playback.

#### Request

```typescript
GET /api/media/offline-downloads?page=1&limit=20&status=completed&contentType=video
Headers:
  Authorization: Bearer <token>
```

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number (1-indexed) |
| `limit` | number | No | 20 | Items per page (max: 100) |
| `status` | string | No | - | Filter: `pending`, `downloading`, `completed`, `failed`, `cancelled` |
| `contentType` | string | No | - | Filter: `video`, `audio`, `ebook` |

#### Success Response (200)

```json
{
  "success": true,
  "data": {
    "downloads": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "mediaId": "507f1f77bcf86cd799439011",
        "userId": "507f1f77bcf86cd799439010",
        "fileName": "Gospel Video Title",
        "fileSize": 12345678,
        "contentType": "video/mp4",
        "downloadStatus": "completed",
        "downloadProgress": 100,
        "isDownloaded": true,
        "localPath": "file:///path/to/file.mp4",
        "downloadUrl": "https://cdn.example.com/media/video123.mp4",
        "media": {
          "_id": "507f1f77bcf86cd799439011",
          "title": "Gospel Video Title",
          "description": "Video description",
          "thumbnailUrl": "https://cdn.example.com/thumbnails/video123.jpg",
          "fileUrl": "https://cdn.example.com/media/video123.mp4", // ✅ Always available for playback
          "contentType": "video/mp4",
          "duration": 180,
          "category": "worship"
        },
        "createdAt": "2024-01-20T10:00:00Z",
        "updatedAt": "2024-01-20T15:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 401 | `UNAUTHORIZED` | Missing or invalid authentication token |
| 500 | `SERVER_ERROR` | Server error occurred |

---

### 4. Get Single Download Status

**Endpoint:** `GET /api/media/offline-downloads/:mediaId`

**Purpose:** Retrieves the download status for a specific media item.

#### Request

```typescript
GET /api/media/offline-downloads/507f1f77bcf86cd799439011
Headers:
  Authorization: Bearer <token>
```

#### Success Response (200)

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "mediaId": "507f1f77bcf86cd799439011",
    "downloadStatus": "completed",
    "downloadProgress": 100,
    "isDownloaded": true,
    "localPath": "file:///path/to/file.mp4",
    "fileName": "Gospel Video Title",
    "fileSize": 12345678,
    "contentType": "video/mp4",
    "createdAt": "2024-01-20T10:00:00Z",
    "updatedAt": "2024-01-20T15:30:00Z"
  }
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 401 | `UNAUTHORIZED` | Missing or invalid authentication token |
| 404 | `DOWNLOAD_NOT_FOUND` | Download record not found |
| 500 | `SERVER_ERROR` | Server error occurred |

---

### 5. Remove Download

**Endpoint:** `DELETE /api/media/offline-downloads/:mediaId`

**Purpose:** Removes a download record from the user's downloads list.

#### Request

```typescript
DELETE /api/media/offline-downloads/507f1f77bcf86cd799439011
Headers:
  Authorization: Bearer <token>
```

#### Success Response (200)

```json
{
  "success": true,
  "message": "Download removed successfully"
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_MEDIA_ID` | Invalid media ID format |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication token |
| 404 | `DOWNLOAD_NOT_FOUND` | Download record not found |
| 500 | `SERVER_ERROR` | Server error occurred |

#### Important Notes

- **Frontend responsibility:** You must delete the actual file from the device
- Backend only removes the metadata record
- This is a soft delete - the record is removed from the user's list

---

## Integration Flow

### Complete Download Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User taps "Download" button                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Check if already downloaded (local check)                │
│    - Check local storage/FileSystem                          │
│    - If exists and valid, show "Downloaded" state           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. POST /api/media/:mediaId/download                         │
│    Request: { fileSize?: number }                           │
│    Response: { downloadUrl, fileName, fileSize, ... }       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Add to local store (status: "DOWNLOADING")               │
│    - Store downloadUrl, fileName, etc.                       │
│    - Update UI to show download in progress                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. PATCH /api/media/offline-downloads/:mediaId              │
│    Request: { downloadStatus: "downloading",                │
│              downloadProgress: 0 }                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Download file using expo-file-system                     │
│    - Use downloadUrl from step 3                            │
│    - Track progress with downloadAsync                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. PATCH /api/media/offline-downloads/:mediaId              │
│    (Progress updates every 10-20%)                          │
│    Request: { downloadProgress: 10 }                        │
│    Request: { downloadProgress: 30 }                         │
│    Request: { downloadProgress: 50 }                         │
│    ...                                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. File download completes                                   │
│    - Save to local file system                               │
│    - Get localPath from expo-file-system                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. PATCH /api/media/offline-downloads/:mediaId              │
│    Request: {                                                │
│      localPath: "file:///.../file.mp4",                      │
│      isDownloaded: true,                                     │
│      downloadStatus: "completed",                            │
│      downloadProgress: 100                                   │
│    }                                                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 10. Update local store with localPath                        │
│     - Mark as downloaded in local state                      │
│     - Update UI to show "Downloaded" state                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 11. File available for offline playback                      │
│     - Use localPath for playback                             │
│     - Show in "Downloads" section                            │
└─────────────────────────────────────────────────────────────┘
```

### Error Handling Flow

```
┌─────────────────────────────────────────────────────────────┐
│ If POST /api/media/:mediaId/download fails:                 │
│   → Show error message to user                              │
│   → Don't create local download record                      │
│   → Stop flow                                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ If file download fails:                                      │
│   → PATCH /api/media/offline-downloads/:mediaId             │
│     { downloadStatus: "failed" }                            │
│   → Show error message to user                               │
│   → Allow retry                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ If PATCH /api/media/offline-downloads/:mediaId fails:       │
│   → Log error (non-critical)                                 │
│   → Continue with local store update                         │
│   → Retry on next app launch if needed                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Code Examples

### React Native / Expo Example

```typescript
import * as FileSystem from 'expo-file-system';
import { API_BASE, getAuthToken } from './api';

interface DownloadProgress {
  mediaId: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  localPath?: string;
}

/**
 * Initiate download for a media item
 */
async function initiateDownload(mediaId: string, fileSize?: number): Promise<{
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  expiresAt: string;
}> {
  const token = await getAuthToken();
  
  const response = await fetch(`${API_BASE}/api/media/${mediaId}/download`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(fileSize ? { fileSize } : {}),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to initiate download');
  }

    const result = await response.json();
    
    // Extract from data wrapper
    const data = result.data || result; // Support both formats for backward compatibility
    
    return {
      downloadUrl: data.downloadUrl,
      fileName: data.fileName,
      fileSize: data.fileSize,
      contentType: data.contentType,
    };
}

/**
 * Update download status on backend
 */
async function updateDownloadStatus(
  mediaId: string,
  updates: {
    downloadStatus?: DownloadProgress['status'];
    downloadProgress?: number;
    isDownloaded?: boolean;
    localPath?: string;
  }
): Promise<void> {
  const token = await getAuthToken();
  
  try {
    const response = await fetch(
      `${API_BASE}/api/media/offline-downloads/${mediaId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      // Non-critical error - log but don't throw
      console.warn('Failed to update download status:', await response.text());
    }
  } catch (error) {
    // Non-critical error - log but don't throw
    console.warn('Error updating download status:', error);
  }
}

/**
 * Download file with progress tracking
 */
async function downloadFile(
  mediaId: string,
  downloadUrl: string,
  fileName: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  // Create downloads directory if it doesn't exist
  const downloadsDir = `${FileSystem.documentDirectory}downloads/`;
  const dirInfo = await FileSystem.getInfoAsync(downloadsDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(downloadsDir, { intermediates: true });
  }

  // Generate local file path
  const fileExtension = fileName.split('.').pop() || 'mp4';
  const localPath = `${downloadsDir}${mediaId}.${fileExtension}`;

  // Update status to downloading
  await updateDownloadStatus(mediaId, {
    downloadStatus: 'downloading',
    downloadProgress: 0,
  });

  // Download file with progress tracking
  const downloadResumable = FileSystem.createDownloadResumable(
    downloadUrl,
    localPath,
    {},
    (downloadProgress) => {
      const progress = Math.round(
        (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100
      );
      
      // Update progress every 10%
      if (progress % 10 === 0 || progress === 100) {
        updateDownloadStatus(mediaId, {
          downloadProgress: progress,
        });
      }
      
      onProgress?.(progress);
    }
  );

  try {
    const result = await downloadResumable.downloadAsync();
    
    if (!result) {
      throw new Error('Download failed - no result');
    }

    // Update status to completed
    await updateDownloadStatus(mediaId, {
      localPath: result.uri,
      isDownloaded: true,
      downloadStatus: 'completed',
      downloadProgress: 100,
    });

    return result.uri;
  } catch (error) {
    // Update status to failed
    await updateDownloadStatus(mediaId, {
      downloadStatus: 'failed',
      downloadProgress: 0,
    });
    
    throw error;
  }
}

/**
 * Complete download flow
 */
export async function downloadMedia(
  mediaId: string,
  fileSize?: number,
  onProgress?: (progress: number) => void
): Promise<string> {
  try {
    // Step 1: Initiate download
    const { downloadUrl, fileName } = await initiateDownload(mediaId, fileSize);
    
    // Step 2: Download file
    const localPath = await downloadFile(mediaId, downloadUrl, fileName, onProgress);
    
    return localPath;
  } catch (error) {
    console.error('Download error:', error);
    throw error;
  }
}

/**
 * Get user's downloads with safe JSON parsing
 */
export async function getUserDownloads(
  page: number = 1,
  limit: number = 20,
  filters?: {
    status?: string;
    contentType?: string;
  }
): Promise<{
  downloads: DownloadItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}> {
  const token = await getAuthToken();
  
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  
  if (filters?.status) params.append('status', filters.status);
  if (filters?.contentType) params.append('contentType', filters.contentType);

  const response = await fetch(
    `${API_BASE}/api/media/offline-downloads?${params.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to get downloads');
  }

  const result = await response.json();
  
  // Safely extract data - handle both wrapped and unwrapped responses
  const responseData = result.data || result;
  
  // Safely transform downloads with null checks
  const downloads: DownloadItem[] = (responseData.downloads || []).map((item: any) => ({
    _id: item._id || item.mediaId || '',
    mediaId: item.mediaId || '',
    fileName: item.fileName || 'Untitled',
    fileSize: item.fileSize || 0,
    contentType: item.contentType || 'application/octet-stream',
    downloadStatus: item.downloadStatus || 'pending',
    downloadProgress: item.downloadProgress || 0,
    isDownloaded: item.isDownloaded || false,
    localPath: item.localPath || null,
    downloadUrl: item.downloadUrl || null,
    // Safely extract media object
    media: item.media ? {
      _id: item.media._id || '',
      title: item.media.title || 'Untitled',
      description: item.media.description || '',
      thumbnailUrl: item.media.thumbnailUrl || null,
      fileUrl: item.media.fileUrl || null, // ✅ Always available for playback
      contentType: item.media.contentType || item.contentType || 'application/octet-stream',
      duration: item.media.duration || 0,
      category: item.media.category || null,
    } : null,
    createdAt: item.createdAt || item.downloadDate || new Date().toISOString(),
    updatedAt: item.updatedAt || item.downloadDate || new Date().toISOString(),
  }));

  return {
    downloads,
    pagination: responseData.pagination || {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    },
  };
}

// Type definitions for type safety
interface DownloadItem {
  _id: string;
  mediaId: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  downloadStatus: 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled';
  downloadProgress: number;
  isDownloaded: boolean;
  localPath: string | null;
  downloadUrl: string | null;
  media: {
    _id: string;
    title: string;
    description: string;
    thumbnailUrl: string | null;
    fileUrl: string | null; // For playback - always available
    contentType: string;
    duration: number;
    category: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get single download status
 */
export async function getDownloadStatus(mediaId: string): Promise<any> {
  const token = await getAuthToken();
  
  const response = await fetch(
    `${API_BASE}/api/media/offline-downloads/${mediaId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (response.status === 404) {
    return null; // Not downloaded
  }

  if (!response.ok) {
    throw new Error('Failed to get download status');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Remove download
 */
export async function removeDownload(mediaId: string): Promise<void> {
  const token = await getAuthToken();
  
  // Delete local file first
  const downloadStatus = await getDownloadStatus(mediaId);
  if (downloadStatus?.localPath) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(downloadStatus.localPath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(downloadStatus.localPath);
      }
    } catch (error) {
      console.warn('Error deleting local file:', error);
    }
  }
  
  // Remove from backend
  const response = await fetch(
    `${API_BASE}/api/media/offline-downloads/${mediaId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to remove download');
  }
}
```

### React Hook Example

```typescript
import { useState, useCallback } from 'react';
import { downloadMedia, getDownloadStatus, removeDownload } from './downloadApi';

export function useDownload(mediaId: string) {
  const [status, setStatus] = useState<'idle' | 'downloading' | 'completed' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);
  const [localPath, setLocalPath] = useState<string | null>(null);

  // Check if already downloaded on mount
  useEffect(() => {
    checkDownloadStatus();
  }, [mediaId]);

  const checkDownloadStatus = async () => {
    try {
      const downloadStatus = await getDownloadStatus(mediaId);
      if (downloadStatus?.isDownloaded && downloadStatus.localPath) {
        setStatus('completed');
        setLocalPath(downloadStatus.localPath);
        setProgress(100);
      }
    } catch (error) {
      console.error('Error checking download status:', error);
    }
  };

  const startDownload = useCallback(async (fileSize?: number) => {
    try {
      setStatus('downloading');
      setProgress(0);
      
      const path = await downloadMedia(
        mediaId,
        fileSize,
        (prog) => setProgress(prog)
      );
      
      setLocalPath(path);
      setStatus('completed');
      setProgress(100);
    } catch (error) {
      setStatus('failed');
      setProgress(0);
      throw error;
    }
  }, [mediaId]);

  const cancelDownload = useCallback(async () => {
    // Cancel download logic here
    // Update status to cancelled
    setStatus('idle');
    setProgress(0);
  }, []);

  const deleteDownload = useCallback(async () => {
    try {
      await removeDownload(mediaId);
      setStatus('idle');
      setLocalPath(null);
      setProgress(0);
    } catch (error) {
      throw error;
    }
  }, [mediaId]);

  return {
    status,
    progress,
    localPath,
    startDownload,
    cancelDownload,
    deleteDownload,
    isDownloaded: status === 'completed' && localPath !== null,
  };
}
```

---

## Error Handling

### Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message here",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| Code | HTTP Status | Description | Action |
|------|-------------|-------------|--------|
| `UNAUTHORIZED` | 401 | Missing or invalid token | Re-authenticate user |
| `INVALID_MEDIA_ID` | 400 | Invalid media ID format | Validate media ID before request |
| `MEDIA_NOT_FOUND` | 404 | Media doesn't exist | Show "Media not found" message |
| `DOWNLOAD_NOT_ALLOWED` | 403 | Media not downloadable | Disable download button |
| `DOWNLOAD_NOT_FOUND` | 404 | Download record not found | Create new download record |
| `VALIDATION_ERROR` | 400 | Invalid input data | Check request body |
| `SERVER_ERROR` | 500 | Server error | Retry or show error message |

### Error Handling Best Practices

```typescript
async function handleDownloadError(error: any, mediaId: string) {
  if (error.code === 'UNAUTHORIZED') {
    // Re-authenticate user
    await reAuthenticate();
    // Retry download
    return downloadMedia(mediaId);
  }
  
  if (error.code === 'DOWNLOAD_NOT_ALLOWED') {
    // Show message: "This content is not available for download"
    showMessage('This content cannot be downloaded');
    return;
  }
  
  if (error.code === 'MEDIA_NOT_FOUND') {
    // Show message: "Content not found"
    showMessage('Content not found');
    return;
  }
  
  // Generic error
  showMessage('Download failed. Please try again.');
}
```

---

## Best Practices

### 1. Progress Updates

- **Don't spam:** Update progress every 10-20%, not every byte
- **Batch updates:** Consider batching multiple progress updates
- **Throttle:** Use throttling/debouncing for progress updates

```typescript
let lastProgressUpdate = 0;
const PROGRESS_UPDATE_INTERVAL = 10; // Update every 10%

function onDownloadProgress(progress: number) {
  if (progress - lastProgressUpdate >= PROGRESS_UPDATE_INTERVAL || progress === 100) {
    updateDownloadStatus(mediaId, { downloadProgress: progress });
    lastProgressUpdate = progress;
  }
}
```

### 2. URL Expiration

- **Check expiration:** Download URLs expire in 1 hour
- **Handle gracefully:** If download fails due to expired URL, re-initiate download
- **Resume support:** Consider implementing resume for large files

```typescript
async function downloadWithRetry(mediaId: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const { downloadUrl, expiresAt } = await initiateDownload(mediaId);
      
      // Check if URL is still valid
      if (new Date(expiresAt) < new Date()) {
        throw new Error('Download URL expired');
      }
      
      return await downloadFile(mediaId, downloadUrl, fileName);
    } catch (error) {
      if (i === retries - 1) throw error;
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

### 3. Local Storage

- **Store metadata:** Keep download metadata in local storage/AsyncStorage
- **Verify files:** Check if local files still exist before showing as downloaded
- **Cleanup:** Periodically clean up orphaned files

```typescript
async function verifyDownloadedFile(localPath: string): Promise<boolean> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    return fileInfo.exists;
  } catch {
    return false;
  }
}
```

### 4. Network Handling

- **Check connectivity:** Verify network before initiating download
- **Handle interruptions:** Resume downloads if interrupted
- **Background downloads:** Use background download tasks for large files

### 5. User Experience

- **Show progress:** Display download progress in UI
- **Allow cancellation:** Provide cancel button during download
- **Error messages:** Show clear, actionable error messages
- **Offline indicator:** Show when content is available offline

---

## Testing Checklist

### Success Cases

- [ ] Initiate download with fileSize
- [ ] Initiate download without fileSize
- [ ] Update download status to "downloading"
- [ ] Update download progress (10%, 50%, 100%)
- [ ] Complete download with localPath
- [ ] Get user's downloads (paginated)
- [ ] Get single download status
- [ ] Delete download
- [ ] Filter downloads by status
- [ ] Filter downloads by contentType

### Error Cases

- [ ] Initiate download with invalid mediaId
- [ ] Initiate download for non-existent media
- [ ] Initiate download without authentication
- [ ] Update status with invalid mediaId
- [ ] Update status with invalid progress (>100)
- [ ] Delete download that doesn't belong to user
- [ ] Get downloads without authentication
- [ ] Network timeout handling
- [ ] Server error handling

### Edge Cases

- [ ] Download same media twice (should update existing record)
- [ ] Download URL expires during download (handle gracefully)
- [ ] Large file downloads (1GB+)
- [ ] Concurrent downloads (multiple files at once)
- [ ] Download cancellation mid-way
- [ ] App crashes during download (resume capability)
- [ ] Storage space insufficient
- [ ] File system permissions denied

---

## Content Type Support

### Supported Content Types

| Content Type | MIME Types | Extensions | Notes |
|--------------|------------|------------|-------|
| Video | `video/mp4`, `video/mov`, `video/avi` | `.mp4`, `.mov`, `.avi` | Most common: MP4 |
| Audio | `audio/mpeg`, `audio/mp4`, `audio/wav`, `audio/m4a` | `.mp3`, `.m4a`, `.wav` | Most common: MP3 |
| Ebook | `application/pdf`, `application/epub+zip` | `.pdf`, `.epub` | PDF most common |

### Content Type Mapping

When filtering by `contentType` in GET requests, use:
- `video` → filters for `videos` content type
- `audio` → filters for `music` content type
- `ebook` → filters for `ebook` content type

---

## Additional Notes

### Download vs Interaction

- **Downloads and interactions are separate:** Download initiation does NOT count as an interaction
- **Separate tracking:** Use separate endpoints for tracking views/likes/shares
- **Analytics:** Downloads are tracked separately for analytics

### File Storage

- **Frontend responsibility:** Frontend handles actual file storage on device
- **Backend only tracks metadata:** Backend stores download status, progress, and local path reference
- **Local path format:** Use `file://` protocol for local paths (e.g., `file:///var/mobile/.../file.mp4`)

### URL Expiration

- **1 hour expiration:** Download URLs expire 1 hour after generation
- **Re-initiate if needed:** If download takes longer than 1 hour, re-initiate to get new URL
- **Handle gracefully:** Show appropriate error if URL expires during download

### Performance

- **Pagination:** Use pagination for large download lists (default: 20 items)
- **Caching:** Consider caching download status locally
- **Batch operations:** Batch multiple status updates if possible

---

## Support

For questions or issues:
1. Check this documentation first
2. Review API error responses
3. Check backend logs for detailed error information
4. Contact backend team with specific error codes and request/response examples

---

**Last Updated:** 2024-01-20  
**API Version:** 1.0.0

