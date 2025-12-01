# Music vs Copyright-Free Songs - Complete Distinction Guide

**Date:** 2024  
**Status:** ✅ Critical Distinction Clarified

---

## 🎯 Key Distinction

### **Music** (User-Uploaded)
- **Uploaded by:** Regular users (content creators)
- **Content Type:** `contentType: "music"`
- **Rights:** Users own the rights to their music
- **Endpoint:** `/api/media` (regular media endpoints)
- **UI:** Music Card UI (user-uploaded content display)
- **Purpose:** User-generated content platform

### **Copyright-Free Songs** (Audio Library - Admin Managed)
- **Uploaded by:** Admins only
- **Content Type:** `contentType: "music"` or `"audio"` (with `isPublicDomain: true`)
- **Rights:** Public domain / Copyright-free (platform managed)
- **Endpoint:** `/api/audio/copyright-free` (dedicated audio library endpoints)
- **UI:** **Different UI** - Similar to YouTube Audio Library (NOT music cards)
- **Purpose:** Platform-provided copyright-free audio library

---

## 📊 Backend Structure

### Database Schema

Both use the **same `Media` model** but are distinguished by:

```typescript
// Music (User-uploaded)
{
  contentType: "music",
  isPublicDomain: false,  // or undefined
  uploadedBy: userId,     // Regular user
  moderationStatus: "pending" | "approved" | "rejected"
}

// Copyright-Free Songs (Audio Library)
{
  contentType: "music" | "audio",
  isPublicDomain: true,   // ✅ KEY DIFFERENCE
  uploadedBy: adminId,    // Admin user
  moderationStatus: "approved", // Pre-approved
  speaker: "Artist Name", // Admin-provided metadata
  year: 2024,             // Admin-provided metadata
  isDefaultContent: true  // For seeded content
}
```

### Query Filtering

```typescript
// Get user-uploaded music
GET /api/media?contentType=music&isPublicDomain=false

// Get copyright-free songs (audio library)
GET /api/audio/copyright-free  // Automatically filters isPublicDomain: true
```

---

## 🎨 Frontend Implementation

### UI Separation

#### 1. Music Screen (User-Uploaded)
- **Component:** `MusicCard` / `MusicList`
- **Endpoint:** `/api/media?contentType=music`
- **Display:** User-generated content cards
- **Features:** User profiles, upload dates, user interactions

#### 2. Copyright-Free Songs Screen (Audio Library)
- **Component:** `CopyrightFreeSongs` (separate component - NOT MusicCard)
- **Endpoint:** `/api/audio/copyright-free`
- **Display:** Audio library style (like YouTube Audio Library)
- **Features:** Admin-curated, category browsing, public domain indicator

---

## 🔌 API Endpoints Reference

### Music (User-Uploaded)

```
GET    /api/media?contentType=music          - Get all user music
GET    /api/media/:id                        - Get single music track
POST   /api/media                            - Upload music (users)
PUT    /api/media/:id                        - Update music (owner)
DELETE /api/media/:id                        - Delete music (owner)
```

### Copyright-Free Songs (Audio Library)

```
GET    /api/audio/copyright-free             - Get all copyright-free songs (Public)
GET    /api/audio/copyright-free/:songId     - Get single song (Public)
GET    /api/audio/copyright-free/search      - Search songs (Public)
GET    /api/audio/copyright-free/categories  - Get categories (Public)
GET    /api/audio/copyright-free/artists     - Get artists (Public)
POST   /api/audio/copyright-free/:songId/like - Like song (Auth)
POST   /api/audio/copyright-free/:songId/save - Save to library (Auth)

POST   /api/audio/copyright-free             - Upload song (Admin only)
PUT    /api/audio/copyright-free/:id         - Update song (Admin only)
DELETE /api/audio/copyright-free/:id         - Delete song (Admin only)
```

---

## ✅ Frontend Implementation Guide

### Step 1: Create Separate Component

**DO NOT reuse `MusicCard` for copyright-free songs.**

```typescript
// ❌ WRONG - Don't do this
<MusicCard song={copyrightFreeSong} />

// ✅ CORRECT - Use separate component
<CopyrightFreeSongCard song={copyrightFreeSong} />
```

### Step 2: Use Correct API Endpoint

```typescript
// ✅ CORRECT - For copyright-free songs
const response = await fetch(`${API_BASE_URL}/api/audio/copyright-free`);

// ❌ WRONG - Don't use media endpoint
const response = await fetch(`${API_BASE_URL}/api/media?contentType=music`);
```

### Step 3: Transform Backend Response

The backend returns songs with this structure:

```typescript
{
  success: true,
  data: {
    songs: [
      {
        _id: "507f1f77bcf86cd799439011",
        title: "Amazing Grace",
        fileUrl: "https://...",           // Audio file URL
        thumbnailUrl: "https://...",      // Thumbnail image URL
        speaker: "John Doe",              // Artist/speaker
        year: 2024,
        duration: 180,
        likeCount: 42,
        viewCount: 1250,
        listenCount: 890,
        category: "worship",
        isPublicDomain: true,             // ✅ Always true for copyright-free
        contentType: "music",             // or "audio"
        // ... other fields
      }
    ],
    pagination: { ... }
  }
}
```

### Step 4: Handle Image URLs Correctly

```typescript
// Backend returns STRING URLs (not require() objects)
const thumbnailUrl = song.thumbnailUrl; // "https://pub-xxx.r2.dev/..."

// ✅ Use in Image component
<Image source={{ uri: thumbnailUrl }} />

// ❌ Don't use require() for backend URLs
<Image source={require(song.thumbnailUrl)} /> // ❌ WRONG
```

### Step 5: Handle Audio URLs Correctly

```typescript
// Backend returns STRING URLs (not require() objects)
const audioUrl = song.fileUrl; // "https://pub-xxx.r2.dev/..."

// ✅ Use in Audio component
const { sound } = await Audio.Sound.createAsync({ uri: audioUrl });

// ❌ Don't use require() for backend URLs
const { sound } = await Audio.Sound.createAsync(require(song.fileUrl)); // ❌ WRONG
```

---

## 🐛 Common Issues & Fixes

### Issue 1: 404 Error on `/api/audio/copyright-free`

**Cause:** Route might not be registered or route order issue.

**Fix:** Verify route registration in `app.ts`:
```typescript
app.use("/api/audio", audioRoutes);
```

**Verify route order in `audio.route.ts`** (specific routes before parameter routes):
```typescript
router.get("/copyright-free", ...);           // ✅ Base route
router.get("/copyright-free/search", ...);    // ✅ Specific route BEFORE :songId
router.get("/copyright-free/:songId", ...);   // ✅ Parameter route LAST
```

### Issue 2: TypeScript Error `getToken()` doesn't exist

**Fix:** Use `getAuthToken()` instead:
```typescript
// ❌ WRONG
const token = await TokenUtils.getToken();

// ✅ CORRECT
const token = await TokenUtils.getAuthToken();
```

### Issue 3: Using Wrong UI Component

**Fix:** Create separate component for copyright-free songs:
```typescript
// Create: components/CopyrightFreeSongCard.tsx
// NOT: components/MusicCard.tsx (that's for user-uploaded music)
```

### Issue 4: Images/Audio Not Loading

**Cause:** Using `require()` instead of URI for backend URLs.

**Fix:**
```typescript
// ✅ CORRECT - Backend URLs are strings
<Image source={{ uri: song.thumbnailUrl }} />
const { sound } = await Audio.Sound.createAsync({ uri: song.fileUrl });

// ❌ WRONG - require() only works for local assets
<Image source={require(song.thumbnailUrl)} />
const { sound } = await Audio.Sound.createAsync(require(song.fileUrl));
```

---

## 📝 Complete Frontend Example

```typescript
// components/CopyrightFreeSongCard.tsx
import React from 'react';
import { Image, Text, View, TouchableOpacity } from 'react-native';

interface CopyrightFreeSongCardProps {
  song: {
    _id: string;
    title: string;
    thumbnailUrl: string; // String URL from backend
    fileUrl: string;      // String URL from backend
    speaker: string;
    likeCount: number;
    viewCount: number;
    duration: number;
  };
  onPress: () => void;
}

export default function CopyrightFreeSongCard({ song, onPress }: CopyrightFreeSongCardProps) {
  return (
    <TouchableOpacity onPress={onPress} className="mr-4 w-[154px]">
      {/* ✅ CORRECT - Use URI for backend image */}
      <Image 
        source={{ uri: song.thumbnailUrl }} 
        style={{ width: 154, height: 232 }}
        resizeMode="cover"
      />
      
      <View className="mt-2">
        <Text className="text-sm font-bold">{song.title}</Text>
        <Text className="text-xs text-gray-500">{song.speaker}</Text>
        <Text className="text-xs text-gray-400">
          👁️ {song.viewCount} views
        </Text>
      </View>
    </TouchableOpacity>
  );
}
```

```typescript
// screens/CopyrightFreeSongsScreen.tsx
import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text } from 'react-native';
import CopyrightFreeSongCard from '../components/CopyrightFreeSongCard';
import copyrightFreeMusicAPI from '../services/copyrightFreeMusicAPI';

export default function CopyrightFreeSongsScreen() {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSongs();
  }, []);

  const loadSongs = async () => {
    try {
      setLoading(true);
      
      // ✅ CORRECT - Use copyright-free endpoint
      const response = await copyrightFreeMusicAPI.getAllSongs({
        page: 1,
        limit: 50,
      });

      if (response.success && response.data?.songs) {
        setSongs(response.data.songs);
      }
    } catch (error) {
      console.error('Error loading songs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = async (song) => {
    // ✅ CORRECT - Use URI for backend audio URL
    const { sound } = await Audio.Sound.createAsync({ 
      uri: song.fileUrl  // String URL from backend
    });
    await sound.playAsync();
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {songs.map((song) => (
        <CopyrightFreeSongCard
          key={song._id}
          song={song}
          onPress={() => handlePlay(song)}
        />
      ))}
    </ScrollView>
  );
}
```

---

## 🔍 Testing Checklist

- [ ] Copyright-free songs use `/api/audio/copyright-free` endpoint
- [ ] User music uses `/api/media?contentType=music` endpoint
- [ ] Copyright-free songs use separate UI component (not MusicCard)
- [ ] Images use `source={{ uri: url }}` (not `require()`)
- [ ] Audio files use `{ uri: url }` (not `require()`)
- [ ] No TypeScript errors with `getAuthToken()` (not `getToken()`)
- [ ] 404 errors resolved (routes properly registered)
- [ ] Clear visual distinction between user music and copyright-free songs

---

## 📋 Summary

### Key Points:

1. **Music** = User-uploaded content → `/api/media` → Music Card UI
2. **Copyright-Free Songs** = Admin-managed library → `/api/audio/copyright-free` → Separate UI
3. **Same Media Model** but distinguished by `isPublicDomain: true`
4. **Backend URLs are strings** → Use `{ uri: url }` (not `require()`)
5. **Separate Components** → Don't reuse MusicCard for copyright-free songs

---

**Status:** ✅ Ready for Frontend Implementation

