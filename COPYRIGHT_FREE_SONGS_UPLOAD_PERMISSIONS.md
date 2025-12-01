# Copyright-Free Songs Upload Permissions

**Date:** 2024  
**Status:** Permission Model Defined

---

## 🎯 Who Can Upload Copyright-Free Songs?

### Recommendation: **ADMINS ONLY** ✅

**Why:**
- Copyright-free songs are **platform-managed content** (like YouTube Audio Library)
- They require **legal verification** (copyright status)
- They should be **curated and quality-controlled**
- Regular users upload their own content, not copyright-free library content

---

## 📋 Permission Model Options

### Option 1: Admins Only (RECOMMENDED) ✅

**Who can upload:**
- ✅ **Admins only** (`role: "admin"`)

**Who can view:**
- ✅ **All users** (public content)

**Why:**
- Similar to YouTube Audio Library (admin-managed)
- Ensures legal compliance
- Maintains content quality
- Prevents abuse

**Implementation:**
```typescript
// Upload endpoint - Admin only
POST /api/audio/copyright-free
Middleware: requireAdmin

// View endpoints - Public
GET /api/audio/copyright-free (public)
GET /api/audio/copyright-free/:id (public)
```

---

### Option 2: Admins + Verified Content Creators

**Who can upload:**
- ✅ Admins (`role: "admin"`)
- ✅ Verified content creators (`role: "content_creator"` + `isVerifiedCreator: true`)

**Who can view:**
- ✅ All users

**Why:**
- Allows trusted creators to contribute
- Still maintains control

**Implementation:**
```typescript
// Upload endpoint - Admin or verified creator
POST /api/audio/copyright-free
Middleware: requireAdminOrCreator
```

---

### Option 3: System Only (No User Uploads)

**Who can upload:**
- ✅ **System** (through admin panel/scripts only)
- ❌ No user-facing upload endpoint

**Who can view:**
- ✅ All users

**Why:**
- Maximum control
- Uploads only via admin tools

**Implementation:**
- No public upload endpoint
- Admin panel only
- Or script-based bulk uploads

---

## ✅ Recommended: Option 1 (Admins Only)

### Permission Structure

| Action | Who Can Do It | Endpoint |
|--------|---------------|----------|
| **Upload copyright-free song** | Admins only | `POST /api/audio/copyright-free` (Admin only) |
| **Update copyright-free song** | Admins only | `PUT /api/audio/copyright-free/:id` (Admin only) |
| **Delete copyright-free song** | Admins only | `DELETE /api/audio/copyright-free/:id` (Admin only) |
| **View copyright-free songs** | All users (public) | `GET /api/audio/copyright-free` (Public) |
| **Play copyright-free songs** | All users | Playback endpoints (Public/Auth optional) |
| **Like copyright-free songs** | Authenticated users | `POST /api/audio/copyright-free/:id/like` (Auth required) |
| **Save to library** | Authenticated users | `POST /api/audio/copyright-free/:id/save` (Auth required) |

---

## 🔒 Security Implementation

### Upload Endpoint Protection

```typescript
// Admin-only upload endpoint
router.post(
  "/copyright-free",
  verifyToken,        // Must be authenticated
  requireAdmin,       // Must be admin
  apiRateLimiter,
  uploadCopyrightFreeSong
);
```

### View Endpoints (Public)

```typescript
// Public view endpoints (no auth required)
router.get("/copyright-free", getCopyrightFreeSongs);
router.get("/copyright-free/:songId", getCopyrightFreeSong);
router.get("/copyright-free/search", searchCopyrightFreeSongs);
router.get("/copyright-free/categories", getCategories);
```

---

## 📝 Implementation Details

### Upload Controller Logic

```typescript
export const uploadCopyrightFreeSong = async (req: Request, res: Response) => {
  // Middleware already verified user is admin
  
  const {
    title,
    artist,
    year,
    audioUrl,        // Admin uploads via URL or file
    thumbnailUrl,
    category,
    description,
    speaker,
    tags,
    duration,
    // ... other fields
  } = req.body;
  
  // Create Media document with:
  // - contentType: "music" or "audio"
  // - isPublicDomain: true
  // - uploadedBy: admin user ID
  // - moderationStatus: "approved" (admin uploads are pre-approved)
};
```

---

## 🎯 Decision Matrix

| Option | Security | Flexibility | Control | Recommendation |
|--------|----------|-------------|---------|----------------|
| **Admins Only** | ✅ High | ⚠️ Less flexible | ✅ High | ⭐ **RECOMMENDED** |
| **Admins + Creators** | ✅ Medium | ✅ More flexible | ✅ Medium | ⭐ Good alternative |
| **System Only** | ✅✅ Highest | ❌ Least flexible | ✅✅ Highest | ⭐ If you want maximum control |

---

## ✅ Recommended Implementation

**Upload Permissions:**
- ✅ **Admins only** can upload copyright-free songs
- ✅ Use `requireAdmin` middleware
- ✅ Set `isPublicDomain: true` automatically
- ✅ Set `moderationStatus: "approved"` automatically (admin uploads are trusted)

**View Permissions:**
- ✅ **Public** (all users can view/listen)
- ✅ No authentication required to browse

**Interaction Permissions:**
- ✅ **Authenticated users** can like/save
- ✅ Auth required for personal actions

---

## 📋 Next Steps

1. ✅ Decide on permission model (Admins only recommended)
2. ⏳ Implement admin-only upload endpoint
3. ⏳ Implement public view endpoints
4. ⏳ Add admin middleware checks
5. ⏳ Document for frontend/admin panel

---

**Question:** Which permission model do you prefer?
- **A)** Admins only (recommended)
- **B)** Admins + Verified creators
- **C)** System only (no user uploads)

Once you confirm, I'll implement accordingly! 🚀

