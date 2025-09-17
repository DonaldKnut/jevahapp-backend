# 🔧 Cloudflare R2 Public URLs Fix

## 🚨 Problem Identified

Your Cloudflare R2 URLs were using **signed URLs with 24-hour expiration** instead of permanent public URLs. This is why:

1. **Links expire after 24 hours** - Users can't access files after this period
2. **"Request has expired" errors** - When pasting URLs in browsers
3. **Videos disappear after 24 hours** - Files become inaccessible

## ✅ Solution Implemented

### 1. Fixed File Upload Service

**File:** `src/service/fileUpload.service.ts`

**Changes Made:**

- ✅ Replaced signed URL generation with permanent public URL generation
- ✅ Added `generatePublicUrl()` method for creating permanent URLs
- ✅ URLs now work permanently in browsers without expiration

**Before (Signed URLs - Expires in 24 hours):**

```typescript
const signedUrl = await getSignedUrl(
  s3Client,
  new GetObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: objectKey,
  }),
  { expiresIn: 86400 } // 24 hours
);
```

**After (Permanent Public URLs):**

```typescript
const publicUrl = this.generatePublicUrl(objectKey);
```

### 2. URL Format

**New permanent URLs will look like:**

```
https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/media-videos/1754924666241-i3pwvr0zl.mp4
```

**Instead of expired signed URLs:**

```
https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/media-videos/1754924666241-i3pwvr0zl.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=92dafeb76f86a6bb3e5dbcc37f4c1a1c%2F20250811%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20250811T150430Z&X-Amz-Expires=86400&X-Amz-Signature=075dcc137ec301ac3a6c31d9bf9554f3870cf65ee739d95901874ba3b95ea35b&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject
```

## 🧹 Cleanup Scripts Created

### 1. Fix Existing Expired URLs

**Script:** `scripts/fix-expired-urls.js`

**Purpose:** Convert existing signed URLs in your database to permanent public URLs

**Usage:**

```bash
# Preview what will be updated (recommended first)
node scripts/fix-expired-urls.js --dry-run

# Actually update the URLs
node scripts/fix-expired-urls.js
```

**What it does:**

- 🔍 Finds all media with signed URLs (containing `X-Amz-Algorithm`, `X-Amz-Signature`, etc.)
- 🔄 Converts them to permanent public URLs
- 📊 Shows you exactly what will be updated
- ✅ Updates the database with new permanent URLs

### 2. Clean Up Cloudinary Files

**Script:** `scripts/cleanup-cloudinary-files.js`

**Purpose:** Remove all Cloudinary media entries from your database since you've hit the free quota limit

**Usage:**

```bash
# Preview what will be deleted (recommended first)
node scripts/cleanup-cloudinary-files.js --dry-run

# Actually delete the Cloudinary entries
node scripts/cleanup-cloudinary-files.js
```

**What it does:**

- 🔍 Finds all media with Cloudinary URLs
- 🗑️ Removes them from the database
- 📊 Shows you exactly what will be deleted
- ✅ Frees up space and removes broken links

## 🚀 How to Apply the Fix

### Step 1: Deploy the Updated Code

1. **Deploy your updated `fileUpload.service.ts`** to production
2. **Restart your server** to use the new code
3. **New uploads will automatically use permanent URLs**

### Step 2: Fix Existing URLs

1. **Run the URL fix script:**
   ```bash
   node scripts/fix-expired-urls.js --dry-run
   ```
2. **Review the output** to see what will be updated
3. **Apply the fix:**
   ```bash
   node scripts/fix-expired-urls.js
   ```

### Step 3: Clean Up Cloudinary Files

1. **Run the cleanup script:**
   ```bash
   node scripts/cleanup-cloudinary-files.js --dry-run
   ```
2. **Review the output** to see what will be deleted
3. **Apply the cleanup:**
   ```bash
   node scripts/cleanup-cloudinary-files.js
   ```

## 🔧 Environment Variables Required

Make sure these are set in your production environment:

```bash
# Required for public URL generation
R2_ACCOUNT_ID=870e0e55f75d0d9434531d7518f57e92
R2_BUCKET=jevah

# Optional: Custom domain (if you have one)
R2_CUSTOM_DOMAIN=your-custom-domain.com
```

## 🎯 Expected Results

### After the Fix:

1. **✅ New uploads** will have permanent URLs that work forever
2. **✅ Existing URLs** will be converted to permanent URLs
3. **✅ Files accessible in browsers** - no more "Request has expired" errors
4. **✅ Videos stay accessible** - no more disappearing after 24 hours
5. **✅ Cloudinary files removed** - database cleaned up

### Testing:

1. **Upload a new file** and check the URL format
2. **Paste the URL in a browser** - it should work immediately
3. **Wait 24+ hours** and test again - it should still work
4. **Check existing media** - URLs should be updated to permanent format

## 🚨 Important Notes

1. **Backup your database** before running the cleanup scripts
2. **Test in staging first** if possible
3. **The `--dry-run` flag** shows you exactly what will happen without making changes
4. **New uploads** will automatically use permanent URLs
5. **Existing signed URLs** need to be updated using the fix script

## 🔍 Verification

After applying the fix, you can verify by:

1. **Checking new uploads** - URLs should not contain `X-Amz-` parameters
2. **Testing in browser** - URLs should work permanently
3. **Database query** - No more signed URLs should exist:
   ```javascript
   db.media
     .find({
       $or: [
         { fileUrl: { $regex: /X-Amz-Algorithm/, $options: "i" } },
         { thumbnailUrl: { $regex: /X-Amz-Algorithm/, $options: "i" } },
       ],
     })
     .count();
   ```

This should return `0` after the fix is applied.

## 🎉 Benefits

- **Permanent file access** - URLs never expire
- **Better user experience** - Files always accessible
- **Reduced support issues** - No more "file not found" complaints
- **Cleaner database** - No more broken Cloudinary links
- **Cost savings** - Using R2's free tier effectively
