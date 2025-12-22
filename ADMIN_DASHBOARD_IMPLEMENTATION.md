# Admin Dashboard & Content Moderation System

## Overview

This document describes the complete admin dashboard system, content moderation with email notifications, user management, and platform analytics.

## Features Implemented

### 1. Admin Dashboard Endpoints
- **Platform Analytics** - Comprehensive platform statistics
- **User Management** - View, ban, unban, and change user roles
- **Moderation Queue** - Review and manage content moderation
- **Activity Logging** - Track all admin actions

### 2. Email Notifications
- **Admin Alerts** - Email admins when content is flagged or reported
- **User Notifications** - Email users when their content is removed
- **Report Threshold Alerts** - Alert admins when content receives multiple reports

### 3. User Ban System
- **Ban/Unban Users** - Temporary or permanent bans
- **Ban Expiration** - Automatic unban when ban period expires
- **Auth Integration** - Banned users cannot access the platform

### 4. Content Moderation Integration
- **AI Classification** - Automatic content analysis
- **Email Notifications** - Real-time alerts to admins and users
- **Report System** - User reporting with threshold alerts

## API Endpoints

### Platform Analytics

#### Get Platform Analytics
```
GET /api/admin/dashboard/analytics
```
Returns comprehensive platform statistics including:
- User metrics (total, new users, active users, banned users)
- Content metrics (total, new content, by type)
- Moderation metrics (pending, rejected, status distribution)
- Report metrics (total, pending)

### User Management

#### Get All Users
```
GET /api/admin/users?page=1&limit=20&search=john&role=artist&isBanned=false
```
Query parameters:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `search` - Search by email, firstName, or lastName
- `role` - Filter by role
- `isBanned` - Filter by ban status
- `isEmailVerified` - Filter by email verification status

#### Get User Details
```
GET /api/admin/users/:id
```
Returns detailed user information including activity stats, media count, and reports count.

#### Ban User
```
POST /api/admin/users/:id/ban
Body: {
  reason?: string,
  duration?: number  // Duration in days (optional, permanent if not provided)
}
```

#### Unban User
```
POST /api/admin/users/:id/unban
```

#### Update User Role
```
PATCH /api/admin/users/:id/role
Body: {
  role: "learner" | "parent" | "educator" | "moderator" | "admin" | "content_creator" | "vendor" | "church_admin" | "artist"
}
```

### Moderation Management

#### Get Moderation Queue
```
GET /api/admin/moderation/queue?page=1&limit=20&status=pending
```
Query parameters:
- `page` - Page number
- `limit` - Items per page
- `status` - Filter by status (pending, under_review, approved, rejected)

#### Update Moderation Status
```
PATCH /api/admin/moderation/:id/status
Body: {
  status: "approved" | "rejected" | "under_review",
  adminNotes?: string
}
```
- Automatically sends email to user if content is rejected
- Logs admin action for audit trail

### Activity Logging

#### Get Admin Activity Log
```
GET /api/admin/activity?page=1&limit=50&adminId=userId
```

## Email Notifications

### Admin Moderation Alerts

Admins receive email alerts when:
- Content is flagged by AI moderation as inappropriate
- Content receives 3+ user reports
- Content requires manual review

**Email includes:**
- Content title and type
- Uploader information
- Moderation result and flags
- Report count
- Direct link to admin dashboard

### User Content Removal Notifications

Users receive email when their content is removed, including:
- Content title
- Reason for removal
- Detected flags/issues
- Appeal process information

## User Ban System

### Ban Types

1. **Temporary Ban** - Specify `duration` in days
   ```json
   {
     "reason": "Spam content",
     "duration": 7  // 7 days
   }
   ```

2. **Permanent Ban** - Omit `duration` field
   ```json
   {
     "reason": "Repeated violations"
   }
   ```

### Ban Enforcement

- Banned users cannot authenticate (checked in `auth.middleware.ts`)
- Bans automatically expire when `banUntil` date passes
- Ban information is stored in user document:
  - `isBanned` - Boolean flag
  - `banReason` - Reason for ban
  - `bannedAt` - When ban was applied
  - `banUntil` - When ban expires (null for permanent)
  - `bannedBy` - Admin who applied the ban

## Google Cloud Speech-to-Text Setup

### Cost Information

**Pricing (as of 2024):**
- **Standard Model**: $0.006 per 15 seconds (~$0.24/minute)
- **Enhanced Model**: $0.009 per 15 seconds (~$0.36/minute)
- **Free Tier**: 60 minutes/month (standard model only)

**Estimated Costs:**
- 1,000 minutes/month: ~$240 (standard) or ~$360 (enhanced)
- 10,000 minutes/month: ~$2,400 (standard) or ~$3,600 (enhanced)

**Recommendation**: Start with Gemini transcription (free), upgrade to Google STT if accuracy is insufficient.

### Setup Instructions

1. **Enable Speech-to-Text API**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create or select a project
   - Navigate to "APIs & Services" > "Library"
   - Search for "Cloud Speech-to-Text API"
   - Click "Enable"

2. **Create Service Account**
   - Go to "IAM & Admin" > "Service Accounts"
   - Click "Create Service Account"
   - Name: `jevah-speech-to-text`
   - Role: "Cloud Speech Client"
   - Click "Create Key" > "JSON"
   - Download the JSON key file

3. **Set Environment Variables**
   ```bash
   # Enable Google Cloud Speech-to-Text
   GOOGLE_CLOUD_SPEECH_TO_TEXT_ENABLED=true
   
   # Path to service account key (absolute path)
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
   ```

4. **Install Package** (optional - only if using Google STT)
   ```bash
   npm install @google-cloud/speech
   ```

5. **Deploy**
   - Upload service account key to your server
   - Set environment variables
   - Restart application

**Note**: The system defaults to Gemini transcription (free) if Google STT is not enabled.

## FFmpeg Installation

FFmpeg is **required** for media processing (audio extraction, video frame extraction).

### Installation by Platform

#### macOS
```bash
brew install ffmpeg
```

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install -y ffmpeg
```

> If you see `sudo: apt-get: command not found`, you're on **macOS**.
> Use: `brew install ffmpeg`

#### CentOS/RHEL
```bash
sudo dnf install ffmpeg
# Or if using yum:
sudo yum install epel-release
sudo yum install ffmpeg
```

#### Windows
1. Download from [https://ffmpeg.org/download.html](https://ffmpeg.org/download.html)
2. Extract to a folder (e.g., `C:\ffmpeg`)
3. Add `C:\ffmpeg\bin` to your system PATH
4. Restart terminal/IDE

#### Docker
Add to your Dockerfile:
```dockerfile
RUN apt-get update && apt-get install -y ffmpeg
```

### Verify Installation
```bash
ffmpeg -version
```

You should see version information. If not, FFmpeg is not in your PATH.

## Environment Variables

Add to your `.env` file:

```env
# Required for AI moderation
GOOGLE_AI_API_KEY=your_gemini_api_key

# Optional: For better transcription (recommended for production)
GOOGLE_CLOUD_SPEECH_TO_TEXT_ENABLED=false
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# Required for email notifications
RESEND_API_KEY=your_resend_api_key

# Optional: Admin dashboard URL (for email links)
ADMIN_DASHBOARD_URL=https://admin.jevahapp.com
```

## Workflow Examples

### Content Upload & Moderation Flow

1. User uploads content
2. Content saved to Cloudflare R2
3. Media record created with `moderationStatus: "pending"`
4. **Background process:**
   - Extract audio/frames (if video)
   - Transcribe audio
   - Send to Gemini AI for classification
   - Update moderation status
5. **If rejected or needs review:**
   - Email sent to all admins
   - In-app notification to admins
6. **If rejected:**
   - Email sent to uploader
   - In-app notification to uploader
   - Content hidden from public view

### User Report Flow

1. User reports content
2. Report count increments
3. **If report count >= 3:**
   - Media status changes to `under_review`
   - Email alert sent to all admins
   - In-app notification to admins

### Admin Review Flow

1. Admin views moderation queue
2. Admin reviews content details
3. Admin updates moderation status
4. **If rejected:**
   - Email sent to uploader with reason
   - Content hidden
   - Action logged in audit trail

## Testing

### Test Admin Endpoints

```bash
# Get platform analytics
curl -X GET http://localhost:4000/api/admin/dashboard/analytics \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Get users
curl -X GET "http://localhost:4000/api/admin/users?page=1&limit=20" \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Ban user
curl -X POST http://localhost:4000/api/admin/users/USER_ID/ban \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Test ban", "duration": 7}'

# Update moderation status
curl -X PATCH http://localhost:4000/api/admin/moderation/MEDIA_ID/status \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "rejected", "adminNotes": "Test rejection"}'
```

## Security Considerations

1. **Admin-Only Access**: All endpoints protected by `requireAdmin` middleware
2. **Audit Logging**: All admin actions logged for accountability
3. **Ban Enforcement**: Banned users cannot authenticate
4. **Role Validation**: Cannot ban admin users
5. **Token Verification**: All requests require valid JWT token

## Future Enhancements

1. **Bulk Actions** - Ban/unban multiple users
2. **Advanced Analytics** - Charts, graphs, trends
3. **Custom Moderation Rules** - Admin-configurable rules
4. **Auto-Approval** - Trusted users skip moderation
5. **Webhook Notifications** - Real-time webhooks for moderation events
6. **Moderation History** - Track all moderation decisions per content
7. **Appeal System** - Users can appeal content removal

## Notes

- Email notifications are non-blocking (won't fail moderation if email fails)
- Moderation runs asynchronously (doesn't block uploads)
- Ban expiration is checked on every authentication attempt
- All admin actions are logged for audit purposes
- Admin dashboard URL should be configured for email links


