# Frontend Like Endpoint - SIMPLE GUIDE

**READ THIS FIRST - IT'S SIMPLE**

---

## ✅ THE ONLY ENDPOINT YOU NEED

### For ALL Content (Videos, Audio, Ebooks, Podcasts, etc.)

```typescript
POST https://api.jevahapp.com/api/content/media/:contentId/like
```

**That's it. Use `media` as the contentType for EVERYTHING.**

---

## 🚨 STOP USING THESE (WRONG)

```typescript
// ❌ WRONG - Don't use "devotional"
POST /api/content/devotional/:id/like

// ❌ WRONG - Don't use "video"  
POST /api/content/video/:id/like

// ❌ WRONG - Don't use "audio"
POST /api/content/audio/:id/like

// ❌ WRONG - Don't use "podcast"
POST /api/content/podcast/:id/like
```

---

## ✅ CORRECT - Use This For Everything

```typescript
// ✅ CORRECT - Use "media" for ALL content
POST https://api.jevahapp.com/api/content/media/:contentId/like
```

---

## 📝 Example Code

### React Native / JavaScript

```typescript
async function toggleLike(contentId: string, token: string) {
  const response = await fetch(
    `https://api.jevahapp.com/api/content/media/${contentId}/like`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const result = await response.json();
  
  if (result.success) {
    return {
      liked: result.data.liked,
      likeCount: result.data.likeCount,
    };
  }
  
  throw new Error(result.message);
}
```

### Usage

```typescript
// For a video
await toggleLike('694cbaa719660a778e14b9aa', token);

// For audio
await toggleLike('694cbaa719660a778e14b9ab', token);

// For ebook
await toggleLike('694cbaa719660a778e14b9ac', token);

// For podcast
await toggleLike('694cbaa719660a778e14b9ad', token);

// ALL use the same endpoint with "media"
```

---

## 🔧 Fix Your Current Code

### Find and Replace

**Search for:**
```typescript
/api/content/devotional/
/api/content/video/
/api/content/audio/
/api/content/podcast/
/api/content/ebook/
```

**Replace ALL with:**
```typescript
/api/content/media/
```

### Example Fix

```typescript
// BEFORE (WRONG)
const endpoint = `https://api.jevahapp.com/api/content/${contentType}/${contentId}/like`;

// AFTER (CORRECT)
const endpoint = `https://api.jevahapp.com/api/content/media/${contentId}/like`;
// Just use "media" always, ignore contentType variable
```

---

## 📋 Response Format

```json
{
  "success": true,
  "message": "Like toggled successfully",
  "data": {
    "liked": true,
    "likeCount": 42
  }
}
```

---

## ⚠️ Common Errors

### Error: "Invalid content type: devotional"

**Cause:** You're using `/api/content/devotional/:id/like`

**Fix:** Change to `/api/content/media/:id/like`

### Error: "Invalid content type: video"

**Cause:** You're using `/api/content/video/:id/like`

**Fix:** Change to `/api/content/media/:id/like`

---

## 🎯 Summary

1. **ONLY endpoint:** `POST /api/content/media/:contentId/like`
2. **Use for:** Videos, Audio, Ebooks, Podcasts - EVERYTHING
3. **Never use:** `devotional`, `video`, `audio`, `podcast` as contentType
4. **Always use:** `media` as contentType

---

## ✅ Quick Checklist

- [ ] Changed all endpoints to use `/api/content/media/`
- [ ] Removed any `devotional` references
- [ ] Removed any `video`, `audio`, `podcast` contentType usage
- [ ] Using `media` for ALL content types
- [ ] Tested with a video - works ✅

---

**That's it. Simple. Use `/api/content/media/:id/like` for everything.**

