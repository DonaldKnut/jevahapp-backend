# Audio Library Seeding - Quick Start Guide

**Date:** 2024  
**Status:** ✅ Ready to Use

---

## 🎯 Two Options for Seeding Songs

### Option 1: Drag Files & Auto-Upload (Recommended) ✅

**Best for:** When you have audio files and thumbnails ready on your computer

#### Steps:

1. **Create folder structure:**
   ```
   seeds/copyright-free-songs/
     ├── peaceful-worship/
     │   ├── audio.mp3
     │   ├── thumbnail.jpg
     │   └── metadata.json (optional)
     ├── joyful-praise/
     │   ├── audio.mp3
     │   └── thumbnail.jpg
     └── ...
   ```

2. **Drag your files:**
   - Put each song in its own folder
   - Include audio file (`.mp3`, `.wav`, `.ogg`, `.aac`, `.flac`, `.m4a`)
   - Include thumbnail (`.jpg`, `.png`, `.webp`)
   - Optionally add `metadata.json` for custom info

3. **Run the script:**
   ```bash
   npm run build
   npm run seed:copyright-free:upload
   ```

**What it does:**
- ✅ Automatically uploads audio files to Cloudflare R2
- ✅ Automatically uploads thumbnails to Cloudflare R2
- ✅ Creates database entries with all metadata
- ✅ Marks songs as copyright-free and approved

---

### Option 2: Provide URLs & Update Script

**Best for:** When files are already uploaded to Cloudflare or another CDN

#### Steps:

1. **Upload files to Cloudflare R2** (or your CDN) and get public URLs

2. **Update the seed script** (`scripts/seed-copyright-free-songs.js`) with your URLs:
   ```javascript
   const defaultCopyrightFreeSongs = [
     {
       title: "Your Song Title",
       fileUrl: "https://your-cdn.com/audio/your-song.mp3",
       thumbnailUrl: "https://your-cdn.com/thumbnails/your-song.jpg",
       ...
     }
   ];
   ```

3. **Run the seed script:**
   ```bash
   npm run build
   npm run seed:copyright-free
   ```

---

## 📋 Recommended: Option 1 (Drag & Auto-Upload)

This is the easiest approach. Here's how:

### Step-by-Step:

1. **Navigate to the seeds folder:**
   ```
   cd seeds/copyright-free-songs
   ```

2. **Create folders for each song:**
   ```bash
   mkdir peaceful-worship
   mkdir joyful-praise
   mkdir heavenly-hymn
   # ... etc
   ```

3. **Drag files into each folder:**
   - Audio file (e.g., `audio.mp3`)
   - Thumbnail (e.g., `thumbnail.jpg`)

4. **Optional: Add metadata.json** to any folder:
   ```json
   {
     "title": "Peaceful Worship",
     "description": "A calming worship song",
     "category": "worship",
     "speaker": "Jevah Music",
     "year": 2024,
     "duration": 180,
     "topics": ["worship", "peace"],
     "tags": ["worship", "peaceful"]
   }
   ```

5. **Run the script:**
   ```bash
   npm run build
   npm run seed:copyright-free:upload
   ```

That's it! The script will:
- Upload everything to Cloudflare R2
- Create database entries
- Handle all the metadata

---

## 📁 Folder Structure Example

```
seeds/copyright-free-songs/
  ├── peaceful-worship/
  │   ├── audio.mp3          ← Audio file
  │   ├── thumbnail.jpg      ← Thumbnail image
  │   └── metadata.json      ← Optional metadata
  ├── joyful-praise/
  │   ├── song.mp3
  │   └── cover.png
  └── heavenly-hymn/
      ├── track.mp3
      └── thumb.jpg
```

---

## 🎵 Metadata File (Optional)

Create `metadata.json` in any song folder to customize:

```json
{
  "title": "Custom Song Title",
  "description": "Custom description",
  "category": "worship",
  "speaker": "Artist Name",
  "year": 2024,
  "duration": 180,
  "topics": ["worship", "praise"],
  "tags": ["worship", "praise"]
}
```

**If no metadata.json:**
- Title = folder name (converted to Title Case)
- Uses default values from script

---

## ✅ Admin Upload Endpoint

Once songs are seeded, admins can also upload new songs via:

**Endpoint:** `POST /api/audio/copyright-free`

**Usage:**
- Use the admin panel or API directly
- Requires admin authentication
- Uploads files via multipart form data
- Automatically handles Cloudflare R2 upload

---

## 🚀 Quick Commands

```bash
# Build project (required before seeding)
npm run build

# Option 1: Auto-upload from local files
npm run seed:copyright-free:upload

# Option 2: Seed with URLs (edit script first)
npm run seed:copyright-free

# Clear and reseed (removes existing songs)
npm run seed:copyright-free:clear
```

---

## 💡 Recommendations

**For initial setup:** Use Option 1 (drag files & auto-upload)
- Simplest workflow
- No manual URL management
- Automated upload to Cloudflare R2

**For ongoing additions:** Use the admin upload endpoint
- Through admin panel UI
- Or via API calls

---

## 📝 Summary

✅ **Option 1 (Recommended):** Drag files → Run script → Done!  
✅ **Option 2:** Upload to CDN → Update script → Run script  
✅ **Admin Endpoint:** Upload via `POST /api/audio/copyright-free`

**All options are ready to use!** Choose the one that fits your workflow best. 🎉

