# Nigerian Language Content Moderation - Frontend Guide

**Version:** 1.0  
**Last Updated:** 2024  
**Status:** Production Ready

---

## 📋 Overview

The Jevah platform now supports **multilingual gospel content** including Nigerian languages (Yoruba, Hausa, Igbo) and automatically detects and moderates content in these languages. This guide explains what frontend changes are needed to support this feature.

## 🎯 Key Points for Frontend

### What's Changed

1. ✅ **Automatic Language Detection** - The system automatically detects the language of uploaded content
2. ✅ **Multilingual Transcription** - Audio/video is transcribed in whatever language it's in
3. ✅ **Language-Agnostic Moderation** - Content is approved/rejected based on gospel content, not language
4. ✅ **No Frontend Changes Required** - The backend handles everything automatically!

### What This Means

- ✅ Users can upload **Yoruba gospel songs** - they will be automatically detected and approved
- ✅ Users can upload **Hausa gospel songs** - they will be automatically detected and approved  
- ✅ Users can upload **Igbo gospel songs** - they will be automatically detected and approved
- ✅ Users can upload **multilingual gospel content** - it will be handled automatically
- ✅ **Pure gospel songs** (without preaching) are now accepted
- ✅ No language selection UI needed - detection is automatic

## 📝 Existing API Endpoint

No new endpoints - use the existing upload endpoint:

```
POST /api/media/upload
```

The system automatically:
1. Detects the language from the audio/video
2. Transcribes in the detected language
3. Moderates based on gospel content (not language)
4. Approves/rejects accordingly

## 🔄 Response Format

### Success Response (Same as Before)

```json
{
  "success": true,
  "message": "Media uploaded successfully. Content has been verified and approved.",
  "media": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Yoruba Gospel Song",
    "description": "Beautiful gospel song in Yoruba",
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
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Rejection Response (Same Format)

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

## 💡 Frontend Implementation Notes

### 1. No Changes Required to Upload Flow

The existing upload implementation works as-is:

```typescript
const formData = new FormData();
formData.append('file', file);
formData.append('thumbnail', thumbnail);
formData.append('title', title);
formData.append('description', description);
formData.append('contentType', 'music');

const response = await fetch('/api/media/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

### 2. Error Handling (Already Covered)

Handle rejection responses as documented in `PRE_UPLOAD_VERIFICATION_FRONTEND_GUIDE.md`:

```typescript
if (!response.ok) {
  const error = await response.json();
  
  if (response.status === 403) {
    // Content rejected - show error with reason
    showError({
      title: 'Content Rejected',
      message: error.message,
      reason: error.moderationResult?.reason,
      flags: error.moderationResult?.flags
    });
  }
}
```

### 3. User Messaging (Optional Enhancement)

You may want to update user-facing messages to reflect multilingual support:

#### Upload Form Placeholder Text

```typescript
// Before
placeholder: "Upload your gospel song..."

// After (Optional)
placeholder: "Upload your gospel song (English, Yoruba, Hausa, Igbo, or any language)..."
```

#### Success Messages

```typescript
// Before
"Content uploaded successfully!"

// After (Optional)
"Your gospel content has been uploaded and verified successfully!"
```

#### Error Messages (No Change Needed)

Error messages come from the backend and are already language-agnostic.

### 4. Progress Indicator (Already Covered)

The verification process may take 10-30 seconds for audio/video transcription. Show appropriate progress:

```typescript
const [uploadStatus, setUploadStatus] = useState<'idle' | 'verifying' | 'uploading' | 'complete' | 'error'>('idle');

// During upload
setUploadStatus('verifying');
// Backend is now:
// 1. Detecting language (automatic)
// 2. Transcribing audio (in detected language)
// 3. Moderating content (language-agnostic)

// After verification
setUploadStatus('uploading'); // Content approved, uploading to storage
```

## 📱 UI/UX Recommendations

### 1. Language Hint (Optional)

You may add a subtle hint that multiple languages are supported:

```tsx
<Text style={styles.hint}>
  Supported: English, Yoruba, Hausa, Igbo, and more
</Text>
```

### 2. Status Messages During Verification

```tsx
{uploadStatus === 'verifying' && (
  <View>
    <Text>Analyzing your content...</Text>
    <Text style={styles.subtitle}>
      Detecting language and verifying content...
    </Text>
  </View>
)}
```

### 3. Success Message

```tsx
{uploadStatus === 'complete' && (
  <View>
    <Text>✅ Content uploaded successfully!</Text>
    <Text style={styles.subtitle}>
      Your gospel content has been verified and approved
    </Text>
  </View>
)}
```

## ✅ Testing Checklist

Test that the frontend works correctly with:

- [ ] Yoruba gospel song upload
- [ ] Hausa gospel song upload
- [ ] Igbo gospel song upload
- [ ] Multilingual gospel content upload
- [ ] Pure gospel songs (no preaching)
- [ ] English gospel content (should still work)
- [ ] Rejected content handling (language-agnostic)

## 🔍 Debugging

### Check Language Detection

The backend automatically detects language. If you want to verify:

1. Check server logs for language detection messages
2. Verify moderation result includes appropriate approval
3. Check that transcript contains content in the expected language

### Common Issues

**Issue:** Content rejected unexpectedly
- **Solution:** Check moderation result flags - may be non-gospel content, not language issue

**Issue:** Long verification time
- **Solution:** Normal for audio/video (10-30 seconds) - ensure progress indicator is shown

**Issue:** Language not detected
- **Solution:** Backend handles fallback - content will still be moderated based on title/description

## 📚 Related Documentation

- `PRE_UPLOAD_VERIFICATION_FRONTEND_GUIDE.md` - Complete pre-upload verification guide
- `CONTENT_MODERATION_IMPLEMENTATION.md` - Backend implementation details
- `NIGERIAN_LANGUAGE_TESTING.md` - Testing documentation

## 🎉 Summary

**Good News:** No breaking changes required!

The Nigerian language support is **completely transparent** to the frontend:

- ✅ Same API endpoint
- ✅ Same request format
- ✅ Same response format
- ✅ Same error handling
- ✅ Automatic language detection
- ✅ Language-agnostic moderation

The backend now automatically:
1. Detects language from audio/video
2. Transcribes in that language
3. Moderates based on gospel content (not language)
4. Approves valid gospel content in any language

**Optional Enhancements:**
- Add language hint in upload form
- Update status messages to mention multilingual support
- Test with Nigerian language content

---

**Last Updated:** 2024  
**Status:** ✅ Ready for Frontend Integration  
**Breaking Changes:** ❌ None

