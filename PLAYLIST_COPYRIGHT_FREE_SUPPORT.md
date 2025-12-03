# Playlist System - Copyright-Free Songs Support

**Date:** 2025-01-27  
**Status:** Analysis & Implementation Plan

---

## Current Situation

### ✅ **What Already Exists**

The backend has a **full Spotify-like playlist system** with:
- ✅ Create playlists
- ✅ Add/remove tracks
- ✅ Reorder tracks
- ✅ Update/delete playlists
- ✅ Public/private playlists
- ✅ Playlist cover images
- ✅ Track notes
- ✅ Persistence (all data saved in database)

### ⚠️ **Current Limitation**

**Playlists currently only support tracks from the `Media` model.**

The playlist track schema:
```typescript
tracks: [{
  mediaId: ObjectId,  // References Media collection only
  addedAt: Date,
  addedBy: ObjectId,
  order: number,
  notes?: string
}]
```

---

## The Problem: Copyright-Free Songs

### Two Different Models

Based on codebase analysis, there are **two separate systems**:

1. **Regular Music** → Stored in `Media` collection
   - User-uploaded music
   - Can be added to playlists ✅

2. **Copyright-Free Songs** → Stored in `CopyrightFreeSong` collection (separate)
   - Admin-uploaded copyright-free audio library
   - **CANNOT be added to playlists currently** ❌

### Why This Matters

- Copyright-free songs are in a **different collection** (`CopyrightFreeSong`)
- Playlist tracks reference `Media` collection only
- Copyright-free songs have different fields (e.g., `singer` vs `speaker`)

---

## Solution Options

### Option 1: Extend Playlist to Support Both Collections (Recommended)

**Modify playlist to support both Media and CopyrightFreeSong:**

```typescript
tracks: [{
  mediaId?: ObjectId,           // For regular Media items
  copyrightFreeSongId?: ObjectId, // For copyright-free songs
  trackType: "media" | "copyrightFree",  // Which collection
  addedAt: Date,
  addedBy: ObjectId,
  order: number,
  notes?: string
}]
```

**Pros:**
- ✅ Supports both types seamlessly
- ✅ Clear separation of concerns
- ✅ Flexible for future content types

**Cons:**
- ⚠️ Requires backend changes
- ⚠️ Need to update all playlist endpoints

### Option 2: Store Copyright-Free Songs in Media Collection

**Use `Media` model with `isPublicDomain: true` flag:**

This appears to be partially implemented already (based on `MUSIC_VS_COPYRIGHT_FREE_SONGS_CLARIFICATION.md`).

**Pros:**
- ✅ Works immediately with existing playlist system
- ✅ No backend changes needed

**Cons:**
- ⚠️ Might conflict with separate `CopyrightFreeSong` model
- ⚠️ Could create data duplication

---

## Recommended Implementation: Option 1 (Extended Support)

### Backend Changes Required

#### 1. Update Playlist Model

**File:** `src/models/playlist.model.ts`

```typescript
interface IPlaylistTrack {
  // One of these must be present
  mediaId?: mongoose.Types.ObjectId;           // For Media items
  copyrightFreeSongId?: mongoose.Types.ObjectId; // For copyright-free songs
  
  trackType: "media" | "copyrightFree";  // Which type
  addedAt: Date;
  addedBy: mongoose.Types.ObjectId;
  order: number;
  notes?: string;
}
```

#### 2. Update Add Track Endpoint

**File:** `src/controllers/playlist.controller.ts` → `addTrackToPlaylist()`

**Changes needed:**
- Accept either `mediaId` OR `copyrightFreeSongId`
- Determine `trackType` based on which ID is provided
- Validate the song exists in the appropriate collection
- Check for duplicates in both collections

**Example request:**
```json
{
  "copyrightFreeSongId": "song123",  // Instead of mediaId
  "notes": "Optional notes",
  "position": 0
}
```

#### 3. Update Get Playlist Endpoint

**File:** `src/controllers/playlist.controller.ts` → `getPlaylistById()`

**Changes needed:**
- Populate both `mediaId` and `copyrightFreeSongId`
- Return unified track format for frontend

**Example response:**
```json
{
  "tracks": [
    {
      "trackType": "media",
      "mediaId": {
        "_id": "media123",
        "title": "Regular Song",
        "contentType": "music",
        ...
      },
      "copyrightFreeSongId": null,
      "order": 0
    },
    {
      "trackType": "copyrightFree",
      "copyrightFreeSongId": {
        "_id": "song123",
        "title": "Copyright-Free Song",
        "singer": "Artist Name",
        ...
      },
      "mediaId": null,
      "order": 1
    }
  ]
}
```

#### 4. Update Remove Track Endpoint

**File:** `src/controllers/playlist.controller.ts` → `removeTrackFromPlaylist()`

**Changes needed:**
- Support removing by `mediaId` OR `copyrightFreeSongId`
- Find track by either ID

---

## Frontend Implementation

### What Frontend Needs to Do

1. **Detect Content Type**
   - When user taps "Add to Playlist" on copyright-free song
   - Pass `copyrightFreeSongId` instead of `mediaId`

2. **Unified Track Display**
   - Handle both track types in playlist view
   - Show appropriate metadata (singer vs speaker, etc.)

3. **Add to Playlist Flow**
   ```typescript
   // For copyright-free songs
   await addToPlaylist({
     copyrightFreeSongId: song._id,
     playlistId: playlistId,
     position: 0
   });
   
   // For regular media
   await addToPlaylist({
     mediaId: media._id,
     playlistId: playlistId,
     position: 0
   });
   ```

---

## Implementation Plan

### Phase 1: Backend Support (Required)

1. ✅ Update Playlist model to support both track types
2. ✅ Update `addTrackToPlaylist()` to accept both IDs
3. ✅ Update `getPlaylistById()` to populate both collections
4. ✅ Update `removeTrackFromPlaylist()` to handle both IDs
5. ✅ Update validation logic

### Phase 2: Frontend Integration (Required)

1. ✅ Update "Add to Playlist" UI to detect content type
2. ✅ Update playlist display to show both track types
3. ✅ Handle unified track format

---

## Answer to Your Question

> "Is this a backend or frontend job?"

**Both!** Here's the breakdown:

### Backend Job (Required)
- Extend playlist model to support copyright-free songs
- Update endpoints to handle both track types
- Modify validation and population logic

### Frontend Job (Required)
- Update UI to add copyright-free songs to playlists
- Display both track types in playlist view
- Handle unified track format

### Current Status
- ✅ **Playlist system exists** - Fully functional for Media items
- ❌ **Copyright-free support missing** - Needs backend extension
- ⚠️ **Ready for implementation** - Clear path forward

---

## Quick Start: What Needs to Happen

### For Backend Team:
1. Modify `Playlist` model schema (add `copyrightFreeSongId` and `trackType`)
2. Update `addTrackToPlaylist()` controller
3. Update `getPlaylistById()` to populate both collections
4. Update `removeTrackFromPlaylist()` to handle both

### For Frontend Team:
1. When adding copyright-free song to playlist, send `copyrightFreeSongId`
2. Display tracks from both sources in playlist view
3. Handle different metadata fields (singer vs speaker)

---

## Estimated Effort

- **Backend:** 4-6 hours
  - Model changes: 1 hour
  - Controller updates: 2-3 hours
  - Testing: 1-2 hours

- **Frontend:** 3-4 hours
  - UI updates: 2 hours
  - Display logic: 1-2 hours

**Total:** ~8-10 hours to fully support copyright-free songs in playlists

---

## Next Steps

1. **Decide on approach** - Option 1 (extend) vs Option 2 (unify models)
2. **Implement backend changes** - Extend playlist support
3. **Update frontend** - Add copyright-free song support
4. **Test thoroughly** - Ensure both track types work seamlessly

Would you like me to implement the backend changes now?

