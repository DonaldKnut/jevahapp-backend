# Pre-Upload Verification - Frontend Integration Guide

## Overview

The media upload system now includes **pre-upload content verification** using AI. Content is analyzed and verified **before** it's uploaded to storage, ensuring only approved content is stored and providing immediate feedback to users.

## Key Changes

### Previous Behavior (Post-Upload Verification)
- Files were uploaded to storage immediately
- Verification happened asynchronously after upload
- Content could be rejected after storage upload
- Response: `"Content is being reviewed"`

### New Behavior (Pre-Upload Verification)
- Files are processed in memory first
- AI verification happens **before** storage upload
- Only approved content is uploaded to storage
- Immediate feedback: approved or rejected
- Response: `"Content has been verified and approved"` or rejection error

## API Endpoint

### Upload Media
```
POST /api/media/upload
```

**Authentication:** Required (Bearer token)

**Content-Type:** `multipart/form-data`

## Request Format

### Form Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes* | Media file (video, audio, or book) |
| `thumbnail` | File | Yes* | Thumbnail image (JPEG, PNG, WebP) |
| `title` | String | Yes | Media title |
| `description` | String | No | Media description |
| `contentType` | String | Yes | One of: `"music"`, `"videos"`, `"books"`, `"live"` |
| `category` | String | No | Media category |
| `topics` | String/Array | No | Topics (can be JSON string or array) |
| `duration` | Number | No | Duration in seconds |

*Note: `file` and `thumbnail` are required for all content types except `"live"`

### Example Request (JavaScript/Fetch)

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('thumbnail', thumbnailInput.files[0]);
formData.append('title', 'My Gospel Song');
formData.append('description', 'A beautiful worship song');
formData.append('contentType', 'music');
formData.append('category', 'worship');
formData.append('topics', JSON.stringify(['praise', 'worship']));

const response = await fetch('/api/media/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

### Example Request (Axios)

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('thumbnail', thumbnailInput.files[0]);
formData.append('title', 'My Gospel Song');
formData.append('description', 'A beautiful worship song');
formData.append('contentType', 'music');

const response = await axios.post('/api/media/upload', formData, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'multipart/form-data'
  }
});
```

## Response Formats

### Success Response (201 Created)

Content has been verified and approved. File is uploaded to storage.

```json
{
  "success": true,
  "message": "Media uploaded successfully. Content has been verified and approved.",
  "media": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "My Gospel Song",
    "description": "A beautiful worship song",
    "contentType": "music",
    "fileUrl": "https://cdn.example.com/media/...",
    "thumbnailUrl": "https://cdn.example.com/thumbnails/...",
    "moderationStatus": "approved",
    "moderationResult": {
      "isApproved": true,
      "confidence": 0.95,
      "reason": "Gospel music content approved",
      "flags": [],
      "requiresReview": false,
      "moderatedAt": "2024-01-15T10:30:00.000Z"
    },
    "uploadedBy": "507f1f77bcf86cd799439012",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Rejection Response (403 Forbidden)

Content does not meet community guidelines. File is **NOT** uploaded to storage.

```json
{
  "success": false,
  "message": "Content does not meet our community guidelines and cannot be uploaded.",
  "moderationResult": {
    "status": "rejected",
    "reason": "Content contains inappropriate language",
    "flags": ["explicit_language", "non_gospel_content"],
    "confidence": 0.92
  }
}
```

### Review Required Response (403 Forbidden)

Content requires manual review before upload.

```json
{
  "success": false,
  "message": "Content requires manual review before it can be uploaded. Please contact support.",
  "moderationResult": {
    "status": "under_review",
    "reason": "Content classification is uncertain",
    "flags": ["unclear_content"],
    "confidence": 0.65
  }
}
```

### Verification Error Response (400 Bad Request)

Content verification processing failed.

```json
{
  "success": false,
  "message": "Content verification failed. Please try again or contact support.",
  "error": "Failed to extract text from PDF"
}
```

### Validation Error Response (400 Bad Request)

Invalid request data.

```json
{
  "success": false,
  "message": "Title and contentType are required"
}
```

## Status Codes

| Status Code | Meaning | Action |
|-------------|---------|--------|
| `201` | Success - Content approved and uploaded | Show success message, redirect to media page |
| `400` | Bad Request - Validation or processing error | Show error message, allow retry |
| `401` | Unauthorized - Missing or invalid token | Redirect to login |
| `403` | Forbidden - Content rejected or requires review | Show rejection message with details |
| `500` | Server Error - Unexpected error | Show generic error, allow retry |

## Error Handling

### Handling Rejected Content

When content is rejected (403), display the rejection reason and flags to help users understand why:

```javascript
try {
  const response = await fetch('/api/media/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    
    if (response.status === 403) {
      // Content rejected
      const { moderationResult } = error;
      
      showError({
        title: 'Content Rejected',
        message: error.message,
        reason: moderationResult.reason,
        flags: moderationResult.flags,
        confidence: moderationResult.confidence
      });
    } else {
      // Other errors
      showError({ message: error.message });
    }
    return;
  }

  const data = await response.json();
  showSuccess('Content uploaded successfully!');
} catch (error) {
  showError({ message: 'Network error. Please try again.' });
}
```

### Handling Review Required

When content requires review (403 with `status: "under_review"`):

```javascript
if (response.status === 403 && error.moderationResult?.status === 'under_review') {
  showWarning({
    title: 'Review Required',
    message: error.message,
    action: 'Contact support for manual review'
  });
}
```

## UI/UX Recommendations

### 1. Upload Progress Indicator

Show a progress indicator during verification (this may take 10-30 seconds):

```javascript
const uploadWithProgress = async (file, thumbnail, metadata) => {
  // Show progress indicator
  setUploadStatus('verifying'); // "verifying" | "uploading" | "complete" | "error"
  setProgress(0);

  try {
    // Upload request
    const response = await uploadMedia(file, thumbnail, metadata);
    
    setUploadStatus('complete');
    setProgress(100);
    return response;
  } catch (error) {
    setUploadStatus('error');
    throw error;
  }
};
```

### 2. Status Messages

Display appropriate messages based on verification status:

- **Verifying**: "Analyzing your content..."
- **Uploading**: "Uploading approved content..."
- **Success**: "Content uploaded successfully!"
- **Rejected**: "Content does not meet guidelines. Reason: [reason]"
- **Review Required**: "Content requires manual review. Please contact support."

### 3. Error Display

Show detailed error information for rejected content:

```jsx
{error && error.moderationResult && (
  <div className="error-details">
    <h3>Content Rejected</h3>
    <p>{error.message}</p>
    <p><strong>Reason:</strong> {error.moderationResult.reason}</p>
    {error.moderationResult.flags.length > 0 && (
      <div>
        <strong>Issues found:</strong>
        <ul>
          {error.moderationResult.flags.map(flag => (
            <li key={flag}>{formatFlag(flag)}</li>
          ))}
        </ul>
      </div>
    )}
  </div>
)}
```

### 4. Retry Logic

Allow users to retry after fixing issues:

```javascript
const handleRetry = () => {
  // Clear previous error
  setError(null);
  // Allow user to modify content and retry
  setShowUploadForm(true);
};
```

## Content Type Specifics

### Videos
- Verification includes: audio transcription + 3 video frames + metadata
- Processing time: ~15-30 seconds (depending on video length)
- File size limits: Check backend configuration

### Audio/Music
- Verification includes: audio transcription + metadata
- Processing time: ~10-20 seconds (depending on audio length)
- Supported formats: MP3, WAV, OGG, AAC, FLAC

### Books/Ebooks
- **PDF**: Full text extraction and verification
- **EPUB**: Text extraction (if JSZip available, otherwise basic moderation)
- Processing time: ~5-15 seconds (depending on book length)
- Supported formats: PDF, EPUB

### Live Content
- Verification is **skipped** for live content
- No file upload required
- Status: `"pending"` (moderated separately if needed)

## Best Practices

### 1. File Validation (Client-Side)

Validate files before upload to provide immediate feedback:

```javascript
const validateFile = (file, contentType) => {
  const errors = [];

  // Check file type
  const validTypes = {
    videos: ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov'],
    music: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac'],
    books: ['application/pdf', 'application/epub+zip']
  };

  if (!validTypes[contentType]?.includes(file.type)) {
    errors.push(`Invalid file type for ${contentType}`);
  }

  // Check file size (example: 100MB limit)
  const maxSize = 100 * 1024 * 1024; // 100MB
  if (file.size > maxSize) {
    errors.push('File size exceeds 100MB limit');
  }

  return errors;
};
```

### 2. Thumbnail Validation

```javascript
const validateThumbnail = (file) => {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!validTypes.includes(file.type)) {
    return 'Thumbnail must be JPEG, PNG, or WebP';
  }

  if (file.size > maxSize) {
    return 'Thumbnail size must be less than 5MB';
  }

  return null;
};
```

### 3. Loading States

Show appropriate loading states during verification:

```javascript
const [uploadState, setUploadState] = useState({
  status: 'idle', // 'idle' | 'verifying' | 'uploading' | 'success' | 'error'
  progress: 0,
  message: ''
});

// During verification
setUploadState({
  status: 'verifying',
  progress: 30,
  message: 'Analyzing content...'
});

// After approval, during upload
setUploadState({
  status: 'uploading',
  progress: 60,
  message: 'Uploading approved content...'
});
```

### 4. Timeout Handling

Set appropriate timeouts for long-running verification:

```javascript
const uploadWithTimeout = async (file, thumbnail, metadata) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes

  try {
    const response = await fetch('/api/media/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Upload timeout. Please try again.');
    }
    throw error;
  }
};
```

## Migration Guide

### From Post-Upload to Pre-Upload

**Before:**
```javascript
// Old: Immediate success, async moderation
const response = await uploadMedia(...);
if (response.success) {
  showMessage('Uploaded! Content is being reviewed.');
  // Media might be hidden later if rejected
}
```

**After:**
```javascript
// New: Verification before upload
try {
  const response = await uploadMedia(...);
  if (response.success) {
    showMessage('Uploaded! Content has been verified and approved.');
    // Media is guaranteed to be approved
  }
} catch (error) {
  if (error.status === 403) {
    // Content rejected before upload
    showRejectionError(error.moderationResult);
  }
}
```

## Testing

### Test Cases

1. **Approved Content**
   - Upload gospel music/video/book
   - Expect: 201 response with `moderationStatus: "approved"`

2. **Rejected Content**
   - Upload inappropriate content
   - Expect: 403 response with rejection details

3. **Review Required**
   - Upload borderline content
   - Expect: 403 response with `status: "under_review"`

4. **Invalid File Type**
   - Upload unsupported file format
   - Expect: 400 response

5. **Missing Fields**
   - Upload without required fields
   - Expect: 400 response

6. **Large Files**
   - Upload very large files
   - Expect: Timeout or size limit error

## Support

For issues or questions:
- Check error messages in response
- Review moderation result flags
- Contact support with media ID and error details

## Example: Complete Upload Component

```jsx
import React, { useState } from 'react';

const MediaUpload = () => {
  const [file, setFile] = useState(null);
  const [thumbnail, setThumbnail] = useState(null);
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState('music');
  const [uploadState, setUploadState] = useState({
    status: 'idle',
    progress: 0,
    message: ''
  });
  const [error, setError] = useState(null);

  const handleUpload = async (e) => {
    e.preventDefault();
    setError(null);
    setUploadState({ status: 'verifying', progress: 0, message: 'Analyzing content...' });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('thumbnail', thumbnail);
    formData.append('title', title);
    formData.append('contentType', contentType);

    try {
      const response = await fetch('/api/media/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          setError({
            type: 'rejection',
            message: data.message,
            moderationResult: data.moderationResult
          });
        } else {
          setError({
            type: 'error',
            message: data.message
          });
        }
        setUploadState({ status: 'error', progress: 0, message: '' });
        return;
      }

      setUploadState({
        status: 'success',
        progress: 100,
        message: 'Content uploaded successfully!'
      });
      
      // Redirect or show success
      setTimeout(() => {
        window.location.href = `/media/${data.media._id}`;
      }, 2000);

    } catch (err) {
      setError({
        type: 'error',
        message: 'Network error. Please try again.'
      });
      setUploadState({ status: 'error', progress: 0, message: '' });
    }
  };

  return (
    <form onSubmit={handleUpload}>
      {/* Form fields */}
      
      {uploadState.status === 'verifying' && (
        <div className="upload-progress">
          <p>Analyzing content... This may take 10-30 seconds.</p>
          <progress value={uploadState.progress} max={100} />
        </div>
      )}

      {error && (
        <div className={`error ${error.type}`}>
          <h3>{error.type === 'rejection' ? 'Content Rejected' : 'Upload Error'}</h3>
          <p>{error.message}</p>
          {error.moderationResult && (
            <div>
              <p><strong>Reason:</strong> {error.moderationResult.reason}</p>
              {error.moderationResult.flags?.length > 0 && (
                <ul>
                  {error.moderationResult.flags.map(flag => (
                    <li key={flag}>{flag}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      <button type="submit" disabled={uploadState.status === 'verifying'}>
        {uploadState.status === 'verifying' ? 'Verifying...' : 'Upload'}
      </button>
    </form>
  );
};

export default MediaUpload;
```

---

**Last Updated:** January 2024  
**API Version:** 2.0.0

