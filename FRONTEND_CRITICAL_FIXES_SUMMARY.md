# 🔴 CRITICAL: Frontend Fixes Required Immediately

**Status:** Blocking 404 errors and incorrect API usage  
**Priority:** Fix before UI implementation

---

## 🚨 Quick Fixes (5 minutes)

### 1. Fix Query Parameter Name

**File:** `app/services/copyrightFreeMusicAPI.ts`  
**Line 92**

```typescript
// ❌ WRONG
sort,

// ✅ CORRECT
sortBy: sort,
```

### 2. Remove Duplicate Methods (Use Toggle)

**File:** `app/services/copyrightFreeMusicAPI.ts`

**Remove these methods:**
- `likeSong()` 
- `unlikeSong()`
- `saveSong()`
- `unsaveSong()`

**Replace with:**
- `toggleLike()` - Uses POST (always)
- `toggleSave()` - Uses POST (always)

See `FRONTEND_API_FIXES_REQUIRED.md` for complete code.

---

## 📖 Read These Documents

1. **MUSIC_VS_COPYRIGHT_FREE_SONGS_CLARIFICATION.md** - Explains the distinction between user music and copyright-free songs
2. **FRONTEND_API_FIXES_REQUIRED.md** - Complete list of API fixes with code examples
3. **AUDIO_LIBRARY_FRONTEND_COMPLETE_GUIDE.md** - Full integration guide

---

## 🎯 Key Understanding

### Copyright-Free Songs ≠ Music Cards

- **Music** = User-uploaded → `/api/media` → Music Card UI
- **Copyright-Free Songs** = Admin library → `/api/audio/copyright-free` → **Separate UI Component**

**DO NOT reuse MusicCard for copyright-free songs!**

---

## ✅ After Fixes

1. 404 errors will be resolved
2. API calls will work correctly
3. You can implement the separate copyright-free songs UI

---

**Next Steps:**
1. Fix the API service (see fixes above)
2. Create separate `CopyrightFreeSongCard` component
3. Use backend URLs as strings with `{ uri: url }` (not `require()`)
4. Test the endpoints

See detailed guides in the documents listed above.

