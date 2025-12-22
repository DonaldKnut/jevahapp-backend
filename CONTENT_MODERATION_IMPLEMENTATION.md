# Content Moderation & Report System Implementation

## Overview

This document describes the AI-powered content moderation system and user report functionality implemented for the Jevah gospel media platform. The system uses Gemini AI to automatically classify uploaded content as gospel-inclined or inappropriate.

## Features Implemented

### 1. AI Content Moderation Service
- **Location**: `src/service/contentModeration.service.ts`
- **Functionality**:
  - Uses Google Gemini AI to analyze content
  - Processes transcripts, video frames, titles, and descriptions
  - Returns moderation results with confidence scores
  - Falls back to basic keyword checks if AI is unavailable

### 2. Media Processing Service
- **Location**: `src/service/mediaProcessing.service.ts`
- **Functionality**:
  - Extracts audio from video files using FFmpeg
  - Extracts key video frames for visual analysis
  - Prepares audio files for transcription
  - Handles temporary file cleanup

### 3. Transcription Service
- **Location**: `src/service/transcription.service.ts`
- **Functionality**:
  - Transcribes audio using Gemini AI (or Google Cloud Speech-to-Text)
  - Supports multiple audio formats
  - Converts audio to appropriate format for transcription

### 4. Media Report System
- **Model**: `src/models/mediaReport.model.ts`
- **Controller**: `src/controllers/mediaReport.controller.ts`
- **Routes**: `src/routes/mediaReport.route.ts`
- **Functionality**:
  - Users can report inappropriate content
  - Admin dashboard for reviewing reports
  - Automatic flagging when report count reaches threshold

### 5. Integration with Upload Flow
- **Location**: `src/controllers/media.controller.ts`
- **Functionality**:
  - Moderation runs asynchronously after upload
  - Doesn't block upload response
  - Updates media moderation status automatically

## API Endpoints

### Report Endpoints

#### Report Media
```
POST /api/media/:id/report
Body: {
  reason: "inappropriate_content" | "non_gospel_content" | "explicit_language" | "violence" | "sexual_content" | "blasphemy" | "spam" | "copyright" | "other",
  description?: string
}
```

#### Get Media Reports (Admin)
```
GET /api/media/:id/reports
```

#### Get All Pending Reports (Admin)
```
GET /api/media/reports/pending?page=1&limit=20
```

#### Review Report (Admin)
```
POST /api/media/reports/:reportId/review
Body: {
  status: "reviewed" | "resolved" | "dismissed",
  adminNotes?: string
}
```

## Dependencies Required

### System Dependencies

1. **FFmpeg** (Required for media processing)
   ```bash
   # macOS
   brew install ffmpeg
   
   # Ubuntu/Debian
   sudo apt-get update && sudo apt-get install -y ffmpeg
   
   # NOTE
   # If you're seeing: "sudo: apt-get: command not found"
   # you're on macOS. Use Homebrew (`brew`) instead of apt-get.
   
   # Windows
   # Download from https://ffmpeg.org/download.html
   ```

### NPM Dependencies

All required packages are already in `package.json`:
- `@google/generative-ai` - For Gemini AI
- `@google-cloud/speech` (Optional) - For better transcription accuracy

### Environment Variables

Add to your `.env` file:
```env
# Required for AI moderation
GOOGLE_AI_API_KEY=your_gemini_api_key

# Optional: For better transcription (recommended for production)
GOOGLE_CLOUD_SPEECH_TO_TEXT_ENABLED=false
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

## How It Works

### Upload Flow

1. User uploads media file
2. File is saved to Cloudflare R2
3. Media record is created with `moderationStatus: "pending"`
4. **Asynchronously** (doesn't block response):
   - For videos: Extract audio and 3 key frames
   - For audio: Extract audio
   - Transcribe audio to text
   - Send transcript + frames + metadata to Gemini AI
   - AI classifies content as:
     - `approved` - Gospel content, high confidence
     - `under_review` - Uncertain, needs manual review
     - `rejected` - Inappropriate content, high confidence
   - Update media record with moderation result

### Report Flow

1. User reports media with reason
2. Report count increments on media
3. If report count >= 3, media status changes to `under_review`
4. Admin reviews reports and can:
   - Resolve (hide media)
   - Dismiss (keep media visible)
   - Add admin notes

## Media Model Updates

New fields added to Media model:
```typescript
moderationStatus?: "pending" | "approved" | "rejected" | "under_review"
moderationResult?: {
  isApproved: boolean
  confidence: number (0-1)
  reason?: string
  flags: string[]
  requiresReview: boolean
  moderatedAt?: Date
}
reportCount?: number
isHidden?: boolean
```

## Moderation Criteria

The AI is trained to:
- **Approve**: Gospel music, Christian teachings, worship content, biblical content, spiritual growth content
- **Reject**: Explicit content, violence, hate speech, profanity, anti-Christian content, secular/non-gospel content
- **Review**: Borderline content, uncertain classification

## Performance Considerations

- Moderation runs **asynchronously** to avoid blocking uploads
- Media is immediately available but may be hidden if rejected
- Processing time depends on:
  - File size (larger files take longer to process)
  - FFmpeg availability
  - AI API response time

## Future Enhancements

1. **Google Cloud Speech-to-Text**: For better transcription accuracy
2. **Batch Processing**: Process multiple files in queue
3. **Webhook Notifications**: Notify users when moderation completes
4. **Custom Moderation Rules**: Allow admins to configure moderation criteria
5. **Auto-approval for Trusted Users**: Skip moderation for verified artists

## Testing

To test the system:

1. **Upload a video**:
   ```bash
   curl -X POST http://localhost:4000/api/media/upload \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -F "file=@test-video.mp4" \
     -F "thumbnail=@thumbnail.jpg" \
     -F "title=Test Gospel Video" \
     -F "contentType=videos"
   ```

2. **Check moderation status**:
   ```bash
   curl http://localhost:4000/api/media/:mediaId \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. **Report media**:
   ```bash
   curl -X POST http://localhost:4000/api/media/:mediaId/report \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"reason": "non_gospel_content", "description": "This is not gospel content"}'
   ```

## Notes

- FFmpeg must be installed on the server for video/audio processing
- If FFmpeg is not available, moderation will use basic keyword checks only
- For production, consider using Google Cloud Speech-to-Text for better transcription
- Moderation is non-blocking - uploads complete immediately, moderation happens in background


