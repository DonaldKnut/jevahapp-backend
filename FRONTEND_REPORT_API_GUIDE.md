# Frontend Report API Integration Guide

**Purpose:** This document provides complete details for integrating the Media Report API in the frontend application. Use this to verify your frontend implementation sends the correct parameters for successful email notifications to admins.

---

## 📋 Table of Contents

1. [API Endpoint Details](#api-endpoint-details)
2. [Authentication Requirements](#authentication-requirements)
3. [Request Format](#request-format)
4. [Response Format](#response-format)
5. [Validation Rules](#validation-rules)
6. [Frontend Verification Checklist](#frontend-verification-checklist)
7. [Common Errors & Solutions](#common-errors--solutions)
8. [Email Notification Flow](#email-notification-flow)
9. [Testing Checklist](#testing-checklist)

---

## 🔗 API Endpoint Details

### Report Media Content

**Endpoint:** `POST /api/media/:id/report`

**Base URL:** `https://jevahapp-backend.onrender.com` (Production)  
**Base URL:** `http://localhost:4000` (Development)

**Full URL Example:**
```
POST https://jevahapp-backend.onrender.com/api/media/507f1f77bcf86cd799439011/report
```

**Authentication:** Required (Bearer Token)  
**Rate Limit:** Applied (see rate limiter middleware)

---

## 🔐 Authentication Requirements

### Required Headers

```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Example:**
```javascript
const headers = {
  'Authorization': `Bearer ${userToken}`,
  'Content-Type': 'application/json'
};
```

### Token Source
- The JWT token should come from your authentication system (Clerk or your custom auth)
- Token must be valid and not expired
- Token must contain valid `userId` claim

---

## 📤 Request Format

### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | ✅ Yes | MongoDB ObjectId of the media item to report |

### Request Body

```typescript
{
  reason: ReportReason;        // Required - One of the valid reasons below
  description?: string;        // Optional - Additional details (max 1000 chars)
}
```

### Valid Report Reasons

The `reason` field **MUST** be one of these exact strings:

```typescript
type ReportReason = 
  | "inappropriate_content"
  | "non_gospel_content"
  | "explicit_language"
  | "violence"
  | "sexual_content"
  | "blasphemy"
  | "spam"
  | "copyright"
  | "other";
```

### Complete Request Example

**JavaScript/TypeScript:**
```javascript
const reportMedia = async (mediaId, reason, description = null) => {
  try {
    const response = await fetch(
      `https://jevahapp-backend.onrender.com/api/media/${mediaId}/report`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`, // Your auth token getter
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: reason, // Must be one of the valid reasons above
          description: description || undefined, // Optional, remove if null
        }),
      }
    );

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Report failed:', error);
    throw error;
  }
};

// Usage
await reportMedia(
  '507f1f77bcf86cd799439011',
  'inappropriate_content',
  'This content contains offensive language'
);
```

**React Example:**
```jsx
const ReportButton = ({ mediaId }) => {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const { token } = useAuth(); // Your auth hook

  const handleReport = async () => {
    if (!reason) {
      alert('Please select a reason');
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/media/${mediaId}/report`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason: reason,
            description: description.trim() || undefined,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        alert('Report submitted successfully');
      } else {
        alert(data.message || 'Failed to submit report');
      }
    } catch (error) {
      console.error('Report error:', error);
      alert('An error occurred while submitting the report');
    }
  };

  return (
    <div>
      <select value={reason} onChange={(e) => setReason(e.target.value)}>
        <option value="">Select a reason</option>
        <option value="inappropriate_content">Inappropriate Content</option>
        <option value="non_gospel_content">Non-Gospel Content</option>
        <option value="explicit_language">Explicit Language</option>
        <option value="violence">Violence</option>
        <option value="sexual_content">Sexual Content</option>
        <option value="blasphemy">Blasphemy</option>
        <option value="spam">Spam</option>
        <option value="copyright">Copyright Violation</option>
        <option value="other">Other</option>
      </select>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Additional details (optional)"
        maxLength={1000}
      />
      <button onClick={handleReport}>Submit Report</button>
    </div>
  );
};
```

**Axios Example:**
```javascript
import axios from 'axios';

const reportMedia = async (mediaId, reason, description = null) => {
  const token = getAuthToken(); // Your token getter

  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/media/${mediaId}/report`,
      {
        reason: reason,
        ...(description && { description: description.trim() }),
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error) {
    if (error.response) {
      // Server responded with error
      console.error('Report error:', error.response.data);
      throw new Error(error.response.data.message || 'Report failed');
    } else {
      // Network error
      console.error('Network error:', error.message);
      throw error;
    }
  }
};
```

---

## 📥 Response Format

### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Media reported successfully",
  "report": {
    "_id": "507f1f77bcf86cd799439012",
    "mediaId": "507f1f77bcf86cd799439011",
    "reason": "inappropriate_content",
    "status": "pending",
    "createdAt": "2025-12-22T10:30:00.000Z"
  }
}
```

### Error Responses

#### 401 Unauthorized (Missing/Invalid Token)

```json
{
  "success": false,
  "message": "Unauthorized: User not authenticated"
}
```

#### 400 Bad Request (Invalid Media ID)

```json
{
  "success": false,
  "message": "Invalid media ID"
}
```

#### 400 Bad Request (Media Not Found)

```json
{
  "success": false,
  "message": "Media not found"
}
```

#### 400 Bad Request (Self-Reporting)

```json
{
  "success": false,
  "message": "You cannot report your own content"
}
```

#### 400 Bad Request (Duplicate Report)

```json
{
  "success": false,
  "message": "You have already reported this media"
}
```

#### 500 Internal Server Error

```json
{
  "success": false,
  "message": "Failed to report media"
}
```

---

## ✅ Validation Rules

### Frontend Validation Checklist

Before sending the request, verify:

- ✅ **Media ID is valid MongoDB ObjectId format** (24 hex characters)
- ✅ **Reason is one of the valid enum values** (exact string match, case-sensitive)
- ✅ **Description is optional but if provided:**
  - Maximum 1000 characters
  - Trimmed (no leading/trailing whitespace)
- ✅ **Authorization token is present and valid**
- ✅ **User is authenticated** (not a guest user)
- ✅ **Content-Type header is set to `application/json`**

### Backend Validation

The backend will reject requests if:

- ❌ Media ID format is invalid
- ❌ Media doesn't exist in database
- ❌ User is trying to report their own content
- ❌ User already reported this media (duplicate prevention)
- ❌ Reason is not in the valid enum list
- ❌ Description exceeds 1000 characters
- ❌ User is not authenticated

---

## 🔍 Frontend Verification Checklist

Use this checklist to verify your frontend implementation:

### Request Configuration

- [ ] **Endpoint URL is correct:** `/api/media/:id/report`
- [ ] **HTTP Method is POST** (not GET, PUT, or PATCH)
- [ ] **Media ID is passed in URL path** (not in body or query params)
- [ ] **Authorization header includes Bearer token:** `Authorization: Bearer <token>`
- [ ] **Content-Type header is set:** `Content-Type: application/json`

### Request Body

- [ ] **`reason` field is included** and is one of the valid enum values
- [ ] **`reason` value is exactly one of:** `inappropriate_content`, `non_gospel_content`, `explicit_language`, `violence`, `sexual_content`, `blasphemy`, `spam`, `copyright`, `other`
- [ ] **`reason` is NOT:** `"Inappropriate Content"` (wrong case), `"inappropriate"` (wrong format), or any other variation
- [ ] **`description` field is optional** (can be omitted entirely if not provided)
- [ ] **If `description` is provided:**
  - [ ] It's a string (not null, not object, not array)
  - [ ] It's trimmed before sending
  - [ ] It's max 1000 characters
  - [ ] Empty strings are converted to `undefined` (or field is omitted)

### Error Handling

- [ ] **401 errors are handled** (redirect to login or show auth error)
- [ ] **400 errors show user-friendly messages** (don't show raw API errors)
- [ ] **500 errors show generic error message** (don't expose server details)
- [ ] **Network errors are handled gracefully**

### User Experience

- [ ] **Loading state is shown** during request
- [ ] **Success message is displayed** after successful report
- [ ] **Form is disabled/submitted** after successful report (prevent duplicates)
- [ ] **Validation errors are shown before submitting** (don't waste API calls)

---

## 🐛 Common Errors & Solutions

### Error: "Unauthorized: User not authenticated"

**Cause:** Missing or invalid authorization token

**Solution:**
```javascript
// ✅ Correct
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}

// ❌ Wrong - Missing Bearer prefix
headers: {
  'Authorization': token
}

// ❌ Wrong - Missing header entirely
headers: {
  'Content-Type': 'application/json'
}
```

---

### Error: "Invalid media ID"

**Cause:** Media ID is not a valid MongoDB ObjectId format

**Solution:**
```javascript
// ✅ Correct - Valid ObjectId (24 hex characters)
const mediaId = '507f1f77bcf86cd799439011';

// ❌ Wrong - Invalid format
const mediaId = '123'; // Too short
const mediaId = 'not-an-object-id'; // Invalid characters
```

---

### Error: "Invalid status. Must be 'reviewed', 'resolved', or 'dismissed'"

**Note:** This error is for admin review endpoint, not user report endpoint. If you see this, you're calling the wrong endpoint.

---

### Error: "You cannot report your own content"

**Cause:** User is trying to report media they uploaded

**Solution:** Hide report button for own content, or show different message:
```javascript
const canReport = media.uploadedBy !== currentUser.id;
if (!canReport) {
  // Show "You cannot report your own content" message
  return;
}
```

---

### Error: "You have already reported this media"

**Cause:** User already submitted a report for this media

**Solution:** Track reported media IDs and disable report button:
```javascript
const [reportedMediaIds, setReportedMediaIds] = useState(new Set());

const handleReport = async () => {
  if (reportedMediaIds.has(mediaId)) {
    alert('You have already reported this content');
    return;
  }
  
  // ... submit report ...
  
  // Mark as reported after success
  setReportedMediaIds(prev => new Set([...prev, mediaId]));
};
```

---

### Email Not Received (Admin Side)

**Important:** This is NOT a frontend issue, but here's what to check:

**Backend Checklist:**
- ✅ `RESEND_API_KEY` environment variable is set in production
- ✅ Admin user exists in MongoDB with `role: "admin"` (exact string, lowercase)
- ✅ Admin user has valid `email` field (not null, not empty)
- ✅ Check server logs for email errors: `"Failed to send admin notifications for report"`

**Note:** Email failures are silently caught (report still succeeds) to prevent user-facing errors. Check backend logs if emails aren't arriving.

---

## 📧 Email Notification Flow

### What Happens After Report Submission

1. **Backend receives report request** ✅
2. **Validates request** (media exists, not self-report, not duplicate) ✅
3. **Creates report record in database** ✅
4. **Fetches all admin users** (`role: "admin"`) ✅
5. **Sends email to all admin emails** (via Resend API)
6. **Sends in-app notification to all admins** ✅
7. **Returns success response to frontend** ✅

### Email Configuration Requirements

For emails to work, backend must have:

- `RESEND_API_KEY` environment variable set
- At least one user with `role: "admin"` in MongoDB
- Admin user(s) must have valid `email` field

**Note:** Email failures don't cause the API to return an error. The report will still succeed even if email fails (check logs for email errors).

---

## 🧪 Testing Checklist

### Manual Testing Steps

1. **Test with Valid Request**
   ```javascript
   POST /api/media/507f1f77bcf86cd799439011/report
   Headers: Authorization: Bearer <valid_token>
   Body: { "reason": "inappropriate_content", "description": "Test report" }
   ```
   **Expected:** 201 Created with report object

2. **Test with Missing Token**
   ```javascript
   POST /api/media/507f1f77bcf86cd799439011/report
   Body: { "reason": "inappropriate_content" }
   ```
   **Expected:** 401 Unauthorized

3. **Test with Invalid Media ID**
   ```javascript
   POST /api/media/invalid-id/report
   Headers: Authorization: Bearer <valid_token>
   Body: { "reason": "inappropriate_content" }
   ```
   **Expected:** 400 Bad Request - "Invalid media ID"

4. **Test with Invalid Reason**
   ```javascript
   POST /api/media/507f1f77bcf86cd799439011/report
   Headers: Authorization: Bearer <valid_token>
   Body: { "reason": "invalid_reason" }
   ```
   **Expected:** 400 Bad Request (validation error)

5. **Test with Self-Report**
   ```javascript
   // Report your own media
   POST /api/media/<your_media_id>/report
   Headers: Authorization: Bearer <your_token>
   Body: { "reason": "spam" }
   ```
   **Expected:** 400 Bad Request - "You cannot report your own content"

6. **Test with Duplicate Report**
   ```javascript
   // Submit same report twice
   POST /api/media/507f1f77bcf86cd799439011/report
   // ... submit first time (success)
   // ... submit second time immediately
   ```
   **Expected:** 400 Bad Request - "You have already reported this media"

### Browser DevTools Checklist

When testing, check Network tab:

- [ ] **Request URL is correct** (includes media ID in path)
- [ ] **Request method is POST**
- [ ] **Request headers include Authorization**
- [ ] **Request payload matches expected format**
- [ ] **Response status code is 201 (or appropriate error code)**
- [ ] **Response body matches expected format**

### Example Network Request (Chrome DevTools)

```
Request URL: https://jevahapp-backend.onrender.com/api/media/507f1f77bcf86cd799439011/report
Request Method: POST
Status Code: 201 Created

Request Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  Content-Type: application/json

Request Payload:
  {
    "reason": "inappropriate_content",
    "description": "This content violates community guidelines"
  }

Response:
  {
    "success": true,
    "message": "Media reported successfully",
    "report": {
      "_id": "507f1f77bcf86cd799439012",
      "mediaId": "507f1f77bcf86cd799439011",
      "reason": "inappropriate_content",
      "status": "pending",
      "createdAt": "2025-12-22T10:30:00.000Z"
    }
  }
```

---

## 📝 TypeScript Type Definitions

For TypeScript projects, use these types:

```typescript
export type ReportReason = 
  | "inappropriate_content"
  | "non_gospel_content"
  | "explicit_language"
  | "violence"
  | "sexual_content"
  | "blasphemy"
  | "spam"
  | "copyright"
  | "other";

export interface ReportMediaRequest {
  reason: ReportReason;
  description?: string;
}

export interface ReportMediaResponse {
  success: boolean;
  message: string;
  report: {
    _id: string;
    mediaId: string;
    reason: ReportReason;
    status: "pending" | "reviewed" | "resolved" | "dismissed";
    createdAt: string;
  };
}

export interface ReportMediaError {
  success: false;
  message: string;
}
```

---

## 🔗 Related Endpoints

### Get Media Reports (Admin Only)

**Endpoint:** `GET /api/media/:id/reports`  
**Auth:** Required (Admin role)

### Get All Pending Reports (Admin Only)

**Endpoint:** `GET /api/media/reports/pending`  
**Auth:** Required (Admin role)  
**Query Params:** `?page=1&limit=20`

### Review Report (Admin Only)

**Endpoint:** `POST /api/media/reports/:reportId/review`  
**Auth:** Required (Admin role)  
**Body:** `{ "status": "reviewed" | "resolved" | "dismissed", "adminNotes": "string" }`

---

## 📞 Support

If you encounter issues after verifying all items in this checklist:

1. **Check browser console** for JavaScript errors
2. **Check Network tab** for request/response details
3. **Verify backend logs** for server-side errors
4. **Verify environment variables** are set correctly
5. **Contact backend team** with:
   - Request payload
   - Response status code and body
   - Error messages
   - Timestamp of request

---

## ✅ Quick Reference

| Item | Value |
|------|-------|
| **Endpoint** | `POST /api/media/:id/report` |
| **Auth** | Bearer Token (required) |
| **Required Body Fields** | `reason` (string, enum) |
| **Optional Body Fields** | `description` (string, max 1000 chars) |
| **Success Status** | 201 Created |
| **Success Response** | `{ success: true, message: string, report: object }` |
| **Valid Reasons** | `inappropriate_content`, `non_gospel_content`, `explicit_language`, `violence`, `sexual_content`, `blasphemy`, `spam`, `copyright`, `other` |

---

**Last Updated:** December 22, 2025  
**Backend Version:** 2.0.0  
**API Base URL:** `https://jevahapp-backend.onrender.com`
