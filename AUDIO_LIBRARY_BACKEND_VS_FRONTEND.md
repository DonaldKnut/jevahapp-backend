# Audio Library: Backend Current State vs Frontend Requirements

**Date:** 2024  
**Status:** Gap Analysis Complete

---

## 📊 Comparison Table

| Feature | Frontend Wants | Backend Has | Status | Solution |
|---------|---------------|-------------|--------|----------|
| **Copyright-Free Songs** |
| Get all songs | `GET /api/audio/copyright-free` | `GET /api/media?contentType=music` | ❌ Path mismatch | Create wrapper |
| Get single song | `GET /api/audio/copyright-free/:id` | `GET /api/media/:id` | ❌ Path mismatch | Create wrapper |
| Search songs | `GET /api/audio/copyright-free/search` | `GET /api/media?search=...` | ❌ Path mismatch | Create wrapper |
| Get categories | `GET /api/audio/copyright-free/categories` | ❌ Not available | ❌ Missing | Create new endpoint |
| **Playlists** |
| Get playlists | `GET /api/audio/playlists` | `GET /api/playlists` | ✅ Exists | Create wrapper |
| Create playlist | `POST /api/audio/playlists` | `POST /api/playlists` | ✅ Exists | Create wrapper |
| Get single playlist | `GET /api/audio/playlists/:id` | `GET /api/playlists/:id` | ✅ Exists | Create wrapper |
| Update playlist | `PUT /api/audio/playlists/:id` | `PUT /api/playlists/:id` | ✅ Exists | Create wrapper |
| Delete playlist | `DELETE /api/audio/playlists/:id` | `DELETE /api/playlists/:id` | ✅ Exists | Create wrapper |
| Add song | `POST /api/audio/playlists/:id/songs` | `POST /api/playlists/:id/tracks` | ⚠️ Path different | Create wrapper |
| Remove song | `DELETE /api/audio/playlists/:id/songs/:songId` | `DELETE /api/playlists/:id/tracks/:mediaId` | ⚠️ Path different | Create wrapper |
| Reorder songs | `PUT /api/audio/playlists/:id/songs/reorder` | `PUT /api/playlists/:id/tracks/reorder` | ⚠️ Path different | Create wrapper |
| **Playback Tracking** |
| Start playback | `POST /api/audio/playback/start` | `POST /api/media/:id/playback/start` | ⚠️ Path different | Create wrapper |
| Update progress | `POST /api/audio/playback/progress` | `POST /api/media/playback/progress` | ✅ Exists | Create wrapper |
| Complete playback | `POST /api/audio/playback/complete` | `POST /api/media/playback/end` | ⚠️ Name different | Create wrapper |
| Pause playback | `POST /api/audio/playback/pause` | `POST /api/media/playback/pause` | ✅ Exists | Create wrapper |
| Resume playback | `POST /api/audio/playback/resume` | `POST /api/media/playback/resume` | ✅ Exists | Create wrapper |
| Get history | `GET /api/audio/playback/history` | `GET /api/media/playback/history` | ✅ Exists | Create wrapper |
| Get last position | `GET /api/audio/playback/last-position/:trackId` | ❌ Not available | ❌ Missing | Create new endpoint |
| **Interactions** |
| Like song | `POST /api/audio/copyright-free/:songId/like` | `POST /api/content/media/:id/like` | ⚠️ Path different | Create wrapper |
| Unlike song | `DELETE /api/audio/copyright-free/:songId/like` | Same as like (toggle) | ⚠️ Path different | Create wrapper |
| Save song | `POST /api/audio/copyright-free/:songId/save` | `POST /api/bookmarks` or `/api/enhanced-media/library` | ⚠️ Path different | Create wrapper |
| Unsave song | `DELETE /api/audio/copyright-free/:songId/save` | `DELETE /api/bookmarks/:id` | ⚠️ Path different | Create wrapper |
| Get library | `GET /api/audio/library` | `GET /api/bookmarks?type=media` | ⚠️ Path different | Create wrapper |

---

## ✅ What Works Out of the Box

1. **Playlist System** - Fully functional, just needs path wrapper
2. **Playback Session System** - Fully functional, just needs path wrapper
3. **Like/Interaction System** - Fully functional, just needs path wrapper
4. **Library/Bookmark System** - Fully functional, just needs path wrapper
5. **Media Model** - Can store copyright-free songs, just needs `isPublicDomain` field

---

## ❌ What's Missing

1. **Copyright-Free Songs Endpoints**
   - No `/api/audio/*` routes at all
   - Need to create wrapper routes
   - Need to filter Media by `isPublicDomain: true`

2. **Categories Endpoint**
   - No categories aggregation endpoint
   - Need to create new endpoint

3. **Last Position Endpoint**
   - No endpoint to get last playback position for a specific track
   - Can use existing Library/PlaybackSession data

4. **isPublicDomain Field**
   - Media model doesn't have this field
   - Need to add to identify copyright-free songs

---

## 🎯 Implementation Strategy

### Approach: Wrapper Routes Pattern ✅

Create `/api/audio/*` routes that:
1. **Wrap existing controllers/services** - Reuse all existing logic
2. **Transform request/response** - Match frontend format exactly
3. **Add audio-specific filters** - Filter by `contentType: "music" | "audio"` and `isPublicDomain: true`
4. **No breaking changes** - All existing routes remain untouched

---

## 📝 Key Implementation Decisions

### 1. Use Media Model for Copyright-Free Songs ✅

**Why:**
- ✅ All fields already exist (title, artist, duration, fileUrl, etc.)
- ✅ Already supports `contentType: "music" | "audio"`
- ✅ Already has views, likes, comments, etc.
- ✅ Single source of truth

**What to Add:**
- `isPublicDomain: boolean` field to Media model
- Filter logic: `contentType: "music" | "audio"` AND `isPublicDomain: true`

### 2. Wrapper Routes for Playlists ✅

**Why:**
- ✅ Existing playlist system is complete
- ✅ Just need path transformation (`/api/audio/playlists` → `/api/playlists`)
- ✅ Response format mostly matches

**What to Do:**
- Create `/api/audio/playlists/*` routes
- Call existing playlist controllers internally
- Transform response if needed

### 3. Wrapper Routes for Playback ✅

**Why:**
- ✅ Playback session system is complete
- ✅ Works for audio already
- ✅ Just need path transformation

**What to Do:**
- Create `/api/audio/playback/*` routes
- Call existing playback controllers internally
- Map "complete" to "end"

### 4. Wrapper Routes for Interactions ✅

**Why:**
- ✅ Like system exists
- ✅ Bookmark/library system exists
- ✅ Just need path transformation

**What to Do:**
- Create `/api/audio/copyright-free/:songId/like` route
- Create `/api/audio/copyright-free/:songId/save` route
- Create `/api/audio/library` route
- Call existing interaction controllers internally

---

## 🔧 Changes Required

### Minimal Changes Needed:

1. **Add Field to Media Model** (1 field)
   - `isPublicDomain?: boolean`

2. **Create Audio Routes Module** (New file)
   - `/api/audio/*` routes that wrap existing functionality

3. **Create Audio Controller** (New file, optional)
   - Or directly use existing controllers in routes

4. **Create Audio Service** (New file, optional)
   - Or directly query Media model in routes

**That's it!** Everything else is just routing/transformation.

---

## ✅ Backward Compatibility

**Guaranteed:**
- ✅ All existing routes remain unchanged
- ✅ All existing functionality preserved
- ✅ No database migrations required (just adding optional field)
- ✅ Existing frontend code unaffected

---

## 🚀 Next Steps

1. Add `isPublicDomain` field to Media model
2. Create audio routes module
3. Create wrapper controllers/services
4. Test all endpoints
5. Document for frontend

---

**Status:** Ready to implement with minimal changes and zero breaking changes! 🎉

