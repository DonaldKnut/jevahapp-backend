# Audio Library System - Implementation Plan

**Date:** 2024  
**Status:** Ready to Implement  
**Strategy:** Create `/api/audio/*` wrapper routes that reuse existing functionality

---

## 🎯 Strategy: Wrapper Routes Pattern

**Approach:** Create new `/api/audio/*` routes that:
1. ✅ Match frontend expectations exactly
2. ✅ Internally reuse existing services/controllers
3. ✅ Transform responses to match frontend format
4. ✅ Don't break existing code
5. ✅ Can add audio-specific logic later

---

## 📋 Implementation Checklist

### Phase 1: Copyright-Free Songs (NEW)

- [ ] Create `CopyrightFreeSong` model OR use Media model with filter
- [ ] Create `/api/audio/copyright-free` routes
- [ ] Create audio song service
- [ ] Create audio song controller
- [ ] Add `isPublicDomain` field to Media model

### Phase 2: Audio Playlist Routes (WRAPPER)

- [ ] Create `/api/audio/playlists/*` routes
- [ ] Wrap existing playlist controllers
- [ ] Transform responses to match frontend format
- [ ] Filter playlists to only show audio playlists (optional)

### Phase 3: Audio Playback Routes (WRAPPER)

- [ ] Create `/api/audio/playback/*` routes
- [ ] Wrap existing playback session controllers
- [ ] Transform responses (e.g., "complete" instead of "end")
- [ ] Add audio-specific validation

### Phase 4: Audio Interactions (WRAPPER)

- [ ] Create `/api/audio/copyright-free/:songId/like` route
- [ ] Create `/api/audio/copyright-free/:songId/save` route
- [ ] Create `/api/audio/library` route
- [ ] Wrap existing interaction/bookmark controllers

---

## 🔄 Route Mapping Strategy

### Frontend → Backend Internal Mapping

| Frontend Route | Internal Backend | Method |
|----------------|------------------|--------|
| `GET /api/audio/copyright-free` | Query Media with filters | Direct query |
| `POST /api/audio/playlists` | `POST /api/playlists` | Call existing |
| `POST /api/audio/playback/start` | `POST /api/media/:id/playback/start` | Call existing |
| `GET /api/audio/library` | Query Library/Bookmark | Direct query |

---

## 🏗️ Architecture Decision

### Option A: Use Media Model with Filters ✅ RECOMMENDED

**Pros:**
- ✅ Reuse existing Media infrastructure
- ✅ No new model needed
- ✅ All features already exist (likes, views, etc.)
- ✅ Single source of truth

**Implementation:**
- Add `isPublicDomain: boolean` field to Media
- Filter Media by: `contentType: "music" | "audio"` AND `isPublicDomain: true`
- Use existing Media CRUD operations

### Option B: Separate CopyrightFreeSong Model

**Pros:**
- ✅ Clear separation
- ✅ Dedicated schema

**Cons:**
- ❌ Duplicate functionality
- ❌ More maintenance
- ❌ Harder to keep in sync

**Decision:** Use Option A (Media model with filters)

---

## 📝 Detailed Implementation Steps

### Step 1: Extend Media Model

Add copyright-free fields to Media model:
- `isPublicDomain: boolean`
- Ensure `contentType: "music" | "audio"` works

### Step 2: Create Audio Routes Module

Create `/api/audio/*` routes that:
- Wrap existing controllers
- Transform request/response formats
- Add audio-specific validation

### Step 3: Create Audio Service

Create service layer that:
- Filters Media by copyright-free criteria
- Formats responses for frontend
- Handles audio-specific logic

### Step 4: Test & Document

- Test all endpoints
- Document for frontend
- Ensure backward compatibility

---

**Ready to implement?** Let's start building!

