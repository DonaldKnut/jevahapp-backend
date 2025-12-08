# Copyright-Free Songs View Tracking Strategy Analysis

**Date:** 2025-01-27  
**Status:** 📊 Analysis & Recommendation

---

## 🔍 Current Implementation

### **Copyright-Free Songs (Current)**
- ✅ ViewCount increments **immediately** on GET request
- ❌ No playback tracking
- ❌ No threshold requirement
- ❌ Counts even if user never plays the song

**Location:** `src/controllers/copyrightFreeSong.controller.ts` (line 54)

```typescript
// Increment view count when song is viewed
await songService.incrementViewCount(songId);
```

---

## 📊 Comparison: Regular Media vs Copyright-Free Songs

### **Regular Media (Videos/Audio) - Better Approach** ✅

Uses **playback sessions** with **threshold-based counting**:

1. **Playback Session Starts** → User presses play
2. **Playback Session Ends** → User stops/completes
3. **ViewCount/ListenCount increments** → Only if playback ≥ 30 seconds

**Location:** `src/service/playbackSession.service.ts` (lines 313-349)

```typescript
// Record view/listen if threshold met (30 seconds default)
const viewThreshold = 30; // seconds
if (session.totalWatchTime >= viewThreshold || endPosition >= viewThreshold) {
  // Increment appropriate count on media
  const updateField = isAudioContent 
    ? { listenCount: 1 } 
    : { viewCount: 1 };
  
  await Media.findByIdAndUpdate(session.mediaId, {
    $inc: updateField,
  });
  
  viewRecorded = true;
}
```

---

## ❌ Problems with Current Approach

### **1. Inflated View Counts**

- User opens song page → Counts as view (even if they don't play)
- User scrolls through list → Could trigger multiple views
- Bot crawlers → Inflate counts
- Accidental clicks → Count as views

### **2. Inaccurate Analytics**

- Can't distinguish between:
  - ✅ User who listened to full song
  - ❌ User who just opened the page

### **3. Inconsistent with Regular Media**

- Regular media: Requires 30 seconds of playback
- Copyright-free songs: Counts on page load
- **Inconsistent user experience**

---

## ✅ Recommended Approach: Playback-Based Tracking

### **Strategy: Track Only When User Plays**

1. **User opens song page** → NO view count
2. **User presses play** → Start playback session
3. **User listens ≥ 30 seconds** → Increment viewCount
4. **User stops/completes** → End playback session

### **Benefits:**

- ✅ **More accurate analytics** - Only counts actual engagement
- ✅ **Consistent with regular media** - Same system for all content
- ✅ **Better UX** - View counts reflect real interest
- ✅ **Prevents inflation** - No accidental views

---

## 🎯 Implementation Options

### **Option 1: Use Existing Playback Session System (Recommended)** ✅

**Pros:**
- ✅ Already built and tested
- ✅ Consistent with regular media
- ✅ Has threshold logic (30 seconds)
- ✅ Tracks playback duration
- ✅ Handles pause/resume

**Cons:**
- ⚠️ Copyright-free songs use separate model
- ⚠️ Need to adapt playback sessions to work with CopyrightFreeSong model

### **Option 2: Simple Playback Tracking (Simpler)**

**Pros:**
- ✅ Simpler implementation
- ✅ Copyright-free songs specific
- ✅ Quick to implement

**Cons:**
- ❌ Duplicates existing functionality
- ❌ Less feature-rich (no pause/resume tracking)

---

## 📋 Recommended Implementation Plan

### **Step 1: Remove Immediate View Count Increment**

**File:** `src/controllers/copyrightFreeSong.controller.ts`

**Current:**
```typescript
// Increment view count when song is viewed
await songService.incrementViewCount(songId);
```

**Remove this** - Don't count on GET request

### **Step 2: Integrate with Playback Sessions**

**Option A: Extend Playback Sessions to Support Copyright-Free Songs**

- Update playback session to reference `CopyrightFreeSong` model
- Add support for both `Media` and `CopyrightFreeSong`

**Option B: Create Separate Playback Tracking (Simpler)**

- Track when user starts playing
- Track playback duration
- Only increment viewCount after 30 seconds

### **Step 3: Update View Count Increment Logic**

Only increment when:
- User has played song for ≥ 30 seconds
- User has completed playback (≥ 90% progress)

---

## 🔄 Proposed Flow

```
User Opens Song Page
    ↓
GET /api/audio/copyright-free/:songId
    ↓
✅ Return song data (NO view count increment)
    ↓
User Presses Play Button
    ↓
POST /api/audio/copyright-free/:songId/playback/start
    ↓
✅ Start playback session
    ↓
Audio Plays...
    ↓
POST /api/audio/copyright-free/:songId/playback/progress
    ↓
✅ Track playback progress
    ↓
User Stops or Completes
    ↓
POST /api/audio/copyright-free/:songId/playback/end
    ↓
Check: Did user listen ≥ 30 seconds?
    ↓
YES → ✅ Increment viewCount
NO  → ❌ Don't count as view
```

---

## 📊 Comparison Table

| Aspect | Current (GET) | Recommended (Playback) |
|--------|---------------|------------------------|
| **Accuracy** | ❌ Low (counts page views) | ✅ High (counts actual plays) |
| **Consistency** | ❌ Different from regular media | ✅ Same as regular media |
| **Analytics** | ❌ Inflated numbers | ✅ Real engagement |
| **Implementation** | ✅ Simple (already done) | ⚠️ Requires playback tracking |
| **User Experience** | ❌ Counts accidental views | ✅ Reflects real interest |

---

## ✅ Recommendation

**YES, switch to playback-based tracking!**

### **Why:**

1. **Better Analytics** - View counts reflect actual engagement
2. **Consistent Experience** - Same behavior as regular media
3. **Industry Standard** - YouTube, Spotify, etc. all use playback thresholds
4. **Prevents Inflation** - No accidental or bot views

### **Implementation Priority:**

**Option A (Recommended):** Extend existing playback session system
- More work but consistent architecture
- Better long-term maintenance

**Option B (Faster):** Simple playback tracking for copyright-free songs
- Quicker to implement
- Copyright-free songs specific

---

## 🎯 Next Steps

1. **Decide on approach** (Option A or B)
2. **Remove immediate view count increment** from GET endpoint
3. **Implement playback tracking** for copyright-free songs
4. **Add threshold logic** (30 seconds minimum)
5. **Update frontend** to call playback endpoints

---

**Recommendation:** ✅ **Use playback-based tracking** - Much better strategy!



