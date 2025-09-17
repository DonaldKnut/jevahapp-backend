# 🧹 Database Cleanup Strategy Guide

## 🎯 **Your Situation**

You have **three types of content** in your database:

1. **☁️ Cloudflare R2 files** - Your current storage (some with expired signed URLs)
2. **📸 Cloudinary files** - Old storage (hit free quota limit, files not displaying)
3. **🏠 Default onboarding content** - Pre-loaded gospel content for new users

## 🔍 **Analysis of Your Default Content**

Your default onboarding content includes:

- **Gospel Music** by Kefee, Sinach, etc.
- **Sermons** by Nigerian pastors (Adeboye, Kumuyi, Oyedepo)
- **Devotionals** and **E-books**
- **Short audio clips** for quick engagement

**These are identified by:**

- `isDefaultContent: true`
- `isOnboardingContent: true`
- Used for new user onboarding experience

## 🎯 **Recommended Cleanup Strategy**

### **Option 1: Conservative Cleanup (RECOMMENDED)**

**Keep:** Default onboarding content + Fix Cloudflare URLs
**Remove:** Cloudinary files + User-uploaded Cloudflare files with expired URLs

```bash
# Step 1: Fix expired Cloudflare URLs to permanent URLs
node scripts/fix-expired-urls.js --dry-run
node scripts/fix-expired-urls.js

# Step 2: Remove Cloudinary files (broken due to quota)
node scripts/cleanup-cloudinary-files.js --dry-run
node scripts/cleanup-cloudinary-files.js

# Step 3: Remove user Cloudflare files (but keep default content)
node scripts/cleanup-cloudflare-files.js --dry-run
node scripts/cleanup-cloudflare-files.js
```

**Benefits:**

- ✅ Preserves onboarding experience for new users
- ✅ Fixes expired URL issues
- ✅ Removes broken Cloudinary links
- ✅ Clean database with working content

### **Option 2: Aggressive Cleanup**

**Remove:** Everything except working Cloudflare files
**Keep:** Only files with permanent public URLs

```bash
# Remove everything including default content
node scripts/cleanup-cloudflare-files.js --include-default --dry-run
node scripts/cleanup-cloudflare-files.js --include-default
```

**⚠️ Warning:** This removes all default onboarding content!

## 📊 **What Each Script Does**

### 1. `fix-expired-urls.js`

- **Purpose:** Convert signed URLs to permanent public URLs
- **Target:** Files with `X-Amz-Algorithm`, `X-Amz-Signature` parameters
- **Result:** URLs work permanently in browsers

### 2. `cleanup-cloudinary-files.js`

- **Purpose:** Remove Cloudinary files (broken due to quota limit)
- **Target:** Files with `cloudinary.com` URLs
- **Result:** Removes broken links

### 3. `cleanup-cloudflare-files.js`

- **Purpose:** Remove Cloudflare files while preserving default content
- **Target:** Files with `cloudflarestorage.com` URLs
- **Preserves:** Files with `isDefaultContent: true`
- **Result:** Clean database with working default content

## 🚀 **Step-by-Step Execution**

### **Phase 1: Fix URL Issues**

```bash
# Preview what will be fixed
node scripts/fix-expired-urls.js --dry-run

# Apply the fix
node scripts/fix-expired-urls.js
```

### **Phase 2: Remove Broken Cloudinary Files**

```bash
# Preview what will be removed
node scripts/cleanup-cloudinary-files.js --dry-run

# Remove Cloudinary files
node scripts/cleanup-cloudinary-files.js
```

### **Phase 3: Clean Up User Cloudflare Files**

```bash
# Preview what will be removed (preserving default content)
node scripts/cleanup-cloudflare-files.js --dry-run

# Remove user Cloudflare files
node scripts/cleanup-cloudflare-files.js
```

## 🔍 **Verification Commands**

After cleanup, verify your database:

```javascript
// Check remaining Cloudflare files (should only be default content)
db.media
  .find({
    $or: [
      { fileUrl: { $regex: /cloudflarestorage\.com/, $options: "i" } },
      { thumbnailUrl: { $regex: /cloudflarestorage\.com/, $options: "i" } },
    ],
  })
  .count();

// Check default content is preserved
db.media.find({ isDefaultContent: true }).count();

// Check no Cloudinary files remain
db.media
  .find({
    $or: [
      { fileUrl: { $regex: /cloudinary\.com/, $options: "i" } },
      { thumbnailUrl: { $regex: /cloudinary\.com/, $options: "i" } },
    ],
  })
  .count();
```

## 🎯 **My Recommendation**

**Go with Option 1 (Conservative Cleanup)** because:

1. **✅ Preserves user experience** - New users still see onboarding content
2. **✅ Fixes technical issues** - URLs work permanently
3. **✅ Removes broken content** - No more Cloudinary quota issues
4. **✅ Clean database** - Only working content remains
5. **✅ Easy to restore** - Default content can be re-seeded if needed

## 🚨 **Important Notes**

1. **Backup your database** before running any cleanup scripts
2. **Test in staging first** if possible
3. **Use `--dry-run` flag** to preview changes
4. **Default content can be re-seeded** using `scripts/seed-default-content.js`
5. **New uploads** will automatically use permanent URLs

## 🔄 **If You Want to Re-seed Default Content Later**

```bash
# Re-seed default content after cleanup
node scripts/seed-default-content.js
```

## 📈 **Expected Results After Cleanup**

- **✅ Working URLs** - All files accessible in browsers
- **✅ Clean database** - No broken or expired links
- **✅ Preserved onboarding** - New users see default content
- **✅ Better performance** - Smaller database, faster queries
- **✅ Cost savings** - Using R2's free tier effectively

## 🤔 **Decision Matrix**

| Scenario                               | Recommended Action      |
| -------------------------------------- | ----------------------- |
| **Want to keep onboarding experience** | Option 1 (Conservative) |
| **Want completely clean slate**        | Option 2 (Aggressive)   |
| **Unsure about default content**       | Option 1 (Conservative) |
| **Need to reduce database size**       | Option 2 (Aggressive)   |

**My strong recommendation: Go with Option 1** to preserve the user onboarding experience while fixing all technical issues.
