# Seed Copyright-Free Songs from Assets Folder

**Date:** 2024  
**Status:** ✅ Ready to Use

---

## ✅ What's Ready

### Admin Upload Endpoint ✅
- **Endpoint:** `POST /api/audio/copyright-free`
- **Location:** `/api/audio/copyright-free`
- **Auth:** Admin only (requires `role: "admin"`)
- **Files:** Upload audio + thumbnail via multipart form data
- **Status:** ✅ Fully implemented and working

### Seed Script from Assets ✅
- **Script:** `scripts/seed-copyright-free-from-assets.js`
- **Command:** `npm run seed:copyright-free:assets`
- **Location:** Reads from `assets/audio/` and `assets/images/`
- **Status:** ✅ Ready to use

---

## 🎯 What the Script Does

The seed script will:

1. ✅ **Read all audio files** from `assets/audio/` folder (14 songs)
2. ✅ **Map each song to its artist** (using your provided mapping)
3. ✅ **Assign one image per song** from `assets/images/` folder
4. ✅ **Upload audio files** to Cloudflare R2 automatically
5. ✅ **Upload thumbnail images** to Cloudflare R2 automatically
6. ✅ **Create database entries** with all metadata
7. ✅ **Mark as copyright-free** (`isPublicDomain: true`)
8. ✅ **Pre-approve** (`moderationStatus: "approved"`)
9. ✅ **Initialize counts** (likeCount, viewCount, listenCount = 0)

---

## 📋 Song to Artist Mapping

The script uses this mapping:

| Audio File | Artist |
|------------|--------|
| `call-to-worship-xx-engelis.mp3` | Engelis |
| `gospel-train-367419.mp3` | Traditional Gospel |
| `you-restore-my-soul-413723.mp3` | Tune Melody Media |
| `the-wind-gospel-pop-vocals-341410.mp3` | Gospel Pop Vocals |
| `in-the-name-of-jesus-Tadashikeiji.mp3` | Tadashikeiji |
| `holy-holy-holy-438720.mp3` | Misselle |
| `he-is-risen-matthew-28-441357.mp3` | Misselle |
| `agbani-lagbatan-by-oliverkeyz-featuring-folake-jesu-198779.mp3` | TuneMelodyMedia |
| `davidestifinopray3-391582.mp3` | Davidest |
| `gospel-worship-christian-church-music-amazing-grace-347221.mp3` | Tunetank |
| `gospel-worship-christian-church-348450.mp3` | Tunetank |
| `glory-hallelujah-397698.mp3` | Lilex |
| `davidest-salvation-406000.mp3` | Davidest |
| `rise-in-glory-394237.mp3` | Lilex |

---

## 🖼️ Image Assignment

- **Images:** All images from `assets/images/` folder
- **Assignment:** One image per song (sequentially/cyclically)
- **Total Images:** 16 images available
- **Total Songs:** 14 songs

Each song will get one unique image assigned to it.

---

## 🚀 How to Run

### Step 1: Build the Project
```bash
npm run build
```

### Step 2: Run the Seed Script
```bash
npm run seed:copyright-free:assets
```

That's it! The script will:
- ✅ Upload all 14 songs to Cloudflare R2
- ✅ Upload all images to Cloudflare R2
- ✅ Create database entries
- ✅ Mark as copyright-free and approved

---

## 📊 What Gets Created

For each song, the database entry includes:

- ✅ **Title** - Clean title from filename
- ✅ **Artist/Speaker** - Mapped artist name
- ✅ **File URL** - Cloudflare R2 URL for audio
- ✅ **Thumbnail URL** - Cloudflare R2 URL for image
- ✅ **Category** - Auto-detected (worship, inspiration, etc.)
- ✅ **Topics** - Auto-detected from title
- ✅ **Tags** - Auto-generated
- ✅ **Year** - 2024
- ✅ **Duration** - Estimated from file size
- ✅ **Counts** - All set to 0 (likeCount, viewCount, listenCount)
- ✅ **isPublicDomain** - true
- ✅ **moderationStatus** - approved
- ✅ **uploadedBy** - Admin user

---

## ✅ Features After Seeding

Once seeded, users can:

- ✅ **View all songs** - Public endpoint (no auth needed)
- ✅ **Play songs** - Full audio playback
- ✅ **Like songs** - Real-time like/unlike
- ✅ **See view counts** - Tracked automatically
- ✅ **See listen counts** - Tracked automatically
- ✅ **Save to library** - Save favorites
- ✅ **Add to playlists** - Create custom playlists

---

## 🔍 Verify After Seeding

### Check via API:
```bash
# Get all copyright-free songs
curl http://localhost:4000/api/audio/copyright-free

# Get single song
curl http://localhost:4000/api/audio/copyright-free/{songId}
```

### Check via Database:
```javascript
db.media.find({
  isPublicDomain: true,
  contentType: { $in: ["music", "audio"] }
}).count();
```

---

## 📝 Expected Output

When you run the script, you'll see:

```
✅ Connected to MongoDB

📋 Setting up admin user...
✅ Using existing admin user: admin@jevah.com

🎵 Found 14 audio files
🖼️  Found 16 image files

📤 Starting upload and seeding process...

📤 [1/14] Processing: Call To Worship
   Artist: Engelis
   Image: 1_Da6xj2FnBYu_B4aCkmdN2Q.jpg
   📤 Uploading audio to Cloudflare R2...
   ✅ Audio uploaded: ...
   📤 Uploading thumbnail to Cloudflare R2...
   ✅ Thumbnail uploaded: ...
   ✅ Song created in database: Call To Worship

📤 [2/14] Processing: Gospel Train
   ...

📊 Summary:
   ✅ Successfully seeded: 14
   ⚠️  Skipped (already exist): 0
   ❌ Errors: 0

🎉 Copyright-free songs seeding completed!

📋 Songs seeded:
   ✓ Call To Worship by Engelis
   ✓ Gospel Train by Traditional Gospel
   ✓ You Restore My Soul by Tune Melody Media
   ...

✅ All done! Songs are ready for users to listen, like, and view.

✅ Database connection closed
```

---

## 🎯 Summary

✅ **Admin Upload Endpoint:** `POST /api/audio/copyright-free` (Admin only)  
✅ **Seed Script:** `npm run seed:copyright-free:assets`  
✅ **Songs:** 14 songs from `assets/audio/`  
✅ **Images:** 16 images from `assets/images/`  
✅ **Artists:** All mapped correctly  
✅ **Features:** Like, view counts, listen counts - all working  
✅ **Real-time Updates:** Socket.IO ready  

---

## ✅ Ready to Go!

**To seed your songs:**

```bash
# 1. Build (if not already done)
npm run build

# 2. Run seed script
npm run seed:copyright-free:assets
```

**That's it!** 🎉

All 14 songs will be:
- ✅ Uploaded to Cloudflare R2
- ✅ Seeded to database
- ✅ Ready for users to listen, like, and view

---

**Status:** ✅ **READY TO SEED**

