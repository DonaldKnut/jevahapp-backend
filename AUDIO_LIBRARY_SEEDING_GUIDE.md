# Audio Library - Seeding Guide

**Date:** 2024  
**Status:** ✅ Ready for Use

---

## 📋 Overview

This guide explains how to seed default copyright-free songs into the Audio Library System and how admins can upload new songs.

---

## ✅ Admin Upload Endpoint

### Endpoint
```
POST /api/audio/copyright-free
```

### Authentication
- ✅ **Required** - User must be authenticated
- ✅ **Admin Only** - User must have `role: "admin"`

### Request Format
**Multipart Form Data** (file upload)

**Headers:**
```
Authorization: Bearer <admin_token>
Content-Type: multipart/form-data
```

**Body Fields:**
- `title` (string, **required**) - Song title
- `description` (string, optional) - Song description
- `artist` (string, optional) - Artist name
- `speaker` (string, optional) - Speaker/Artist name (same as artist)
- `year` (number, optional) - Year of creation
- `category` (string, optional) - Category (worship, inspiration, youth, etc.)
- `topics` (array, optional) - Array of topics
- `duration` (number, optional) - Duration in seconds
- `tags` (array, optional) - Array of tags
- `file` (File, **required**) - Audio file (MP3, WAV, OGG, AAC, FLAC)
- `thumbnail` (File, **required**) - Thumbnail image (JPEG, PNG, WebP)

### Example Request (cURL)

```bash
curl -X POST https://your-api-domain.com/api/audio/copyright-free \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -F "title=Amazing Grace" \
  -F "description=Beautiful worship song" \
  -F "artist=Jevah Music" \
  -F "speaker=Jevah Music" \
  -F "year=2024" \
  -F "category=worship" \
  -F "topics=[\"worship\",\"praise\"]" \
  -F "duration=180" \
  -F "tags=[\"worship\",\"classic\"]" \
  -F "file=@/path/to/audio.mp3" \
  -F "thumbnail=@/path/to/thumbnail.jpg"
```

### Example Request (JavaScript/Fetch)

```javascript
const formData = new FormData();
formData.append('title', 'Amazing Grace');
formData.append('description', 'Beautiful worship song');
formData.append('artist', 'Jevah Music');
formData.append('speaker', 'Jevah Music');
formData.append('year', '2024');
formData.append('category', 'worship');
formData.append('topics', JSON.stringify(['worship', 'praise']));
formData.append('duration', '180');
formData.append('tags', JSON.stringify(['worship', 'classic']));
formData.append('file', audioFile); // File object
formData.append('thumbnail', thumbnailFile); // File object

const response = await fetch('/api/audio/copyright-free', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`
    // Don't set Content-Type - browser will set it with boundary
  },
  body: formData
});

const result = await response.json();
console.log('Song uploaded:', result.data);
```

### Response
```json
{
  "success": true,
  "message": "Copyright-free song uploaded successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Amazing Grace",
    "isPublicDomain": true,
    "moderationStatus": "approved",
    "fileUrl": "https://...",
    "thumbnailUrl": "https://...",
    ...
  }
}
```

---

## 🌱 Seeding Default Songs

### Option 1: Using the Seed Script (Recommended)

#### Step 1: Build the Project
```bash
npm run build
```

#### Step 2: Run the Seed Script
```bash
# Seed songs (skips if songs already exist)
npm run seed:copyright-free

# Clear existing songs and reseed
npm run seed:copyright-free:clear
```

Or directly:
```bash
node scripts/seed-copyright-free-songs.js
node scripts/seed-copyright-free-songs.js --clear
```

#### What the Script Does

1. **Connects to MongoDB** using `MONGODB_URI` from `.env`
2. **Finds or creates admin user** (if needed)
3. **Checks for existing songs** (skips if found, unless `--clear` flag used)
4. **Inserts default songs** with:
   - `isPublicDomain: true`
   - `moderationStatus: "approved"`
   - `uploadedBy: admin user`
   - All required fields populated

#### Default Songs Included

The script seeds 10 default copyright-free songs:
1. Peaceful Worship
2. Joyful Praise
3. Heavenly Hymn
4. Grateful Heart
5. Blessed Assurance
6. Youth Anthem
7. Morning Devotion
8. Grace Abounds
9. Victory March
10. Quiet Reflection

#### Important Notes

⚠️ **Placeholder URLs**: The seed script uses placeholder URLs for `fileUrl` and `thumbnailUrl`. You need to:

1. **Upload actual audio files** to Cloudflare R2 or your CDN
2. **Update the URLs** in the database, OR
3. **Use the admin upload endpoint** to upload songs with actual files

---

### Option 2: Manual Database Update

If you've already uploaded files to your CDN, you can update the URLs directly:

```javascript
// Update file URLs in MongoDB
db.media.updateMany(
  { isPublicDomain: true, title: "Peaceful Worship" },
  {
    $set: {
      fileUrl: "https://your-cdn.com/audio/peaceful-worship.mp3",
      thumbnailUrl: "https://your-cdn.com/thumbnails/peaceful-worship.jpg"
    }
  }
);
```

---

### Option 3: Bulk Upload via Admin Panel

Create an admin panel UI that:
1. Allows file uploads (audio + thumbnail)
2. Calls `POST /api/audio/copyright-free` endpoint
3. Handles multiple files in batch

---

## 📝 Customizing the Seed Script

### Edit the Song List

Edit `scripts/seed-copyright-free-songs.js` and modify the `defaultCopyrightFreeSongs` array:

```javascript
const defaultCopyrightFreeSongs = [
  {
    title: "Your Song Title",
    description: "Your description",
    contentType: "music",
    category: "worship",
    fileUrl: "https://your-cdn.com/audio/your-song.mp3",
    thumbnailUrl: "https://your-cdn.com/thumbnails/your-song.jpg",
    speaker: "Artist Name",
    year: 2024,
    duration: 180,
    isPublicDomain: true,
    moderationStatus: "approved",
    topics: ["worship", "praise"],
    tags: ["worship", "praise"],
    // Counts will default to 0
  },
  // Add more songs...
];
```

### Adding Real File URLs

Before running the seed script, update the `fileUrl` and `thumbnailUrl` in the script with your actual CDN URLs.

---

## 🔄 Workflow Recommendations

### Initial Setup

1. **Upload audio files** to Cloudflare R2 or your CDN
2. **Get the URLs** for each file
3. **Update the seed script** with real URLs
4. **Build the project**: `npm run build`
5. **Run the seed script**: `npm run seed:copyright-free`

### Ongoing Song Management

**For Admins:**
- Use the admin upload endpoint: `POST /api/audio/copyright-free`
- Or update the seed script and rerun it

**For Development:**
- Use the seed script to populate test data
- Use `--clear` flag to reset between tests

---

## 🧪 Testing the Seed

### Verify Songs Were Seeded

```javascript
// Check in MongoDB
db.media.find({
  isPublicDomain: true,
  contentType: { $in: ["music", "audio"] }
}).count();

// Or via API
GET /api/audio/copyright-free
```

### Check Admin Can Upload

```bash
# Test upload (replace with real token and files)
curl -X POST http://localhost:4000/api/audio/copyright-free \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -F "title=Test Song" \
  -F "file=@test.mp3" \
  -F "thumbnail=@thumb.jpg"
```

---

## 📊 Seed Script Output

When you run the seed script, you'll see:

```
✅ Connected to MongoDB

📋 Setting up admin user...
✅ Using existing admin user: admin@jevah.com

🎵 Seeding copyright-free songs...

✅ Successfully seeded 10 copyright-free songs:

   1. Peaceful Worship - Jevah Music (3:00)
      Category: worship | Tags: worship, peaceful, meditation, prayer
   2. Joyful Praise - Jevah Music (3:30)
      Category: worship | Tags: worship, praise, joyful, celebration
   ...

📊 Summary:
   Total songs seeded: 10
   Uploaded by: admin@jevah.com (Admin)
   All songs marked as: isPublicDomain = true, moderationStatus = approved

📈 Songs by category:
   worship: 6 songs
   inspiration: 3 songs
   youth: 1 songs

🎉 Copyright-free songs seeding completed successfully!

💡 Next steps:
   1. Upload actual audio files to Cloudflare R2 or your CDN
   2. Update fileUrl and thumbnailUrl in the database
   3. Or use the admin upload endpoint to add songs with files:
      POST /api/audio/copyright-free (Admin only)

✅ Database connection closed
```

---

## 🚨 Troubleshooting

### Error: "Songs already exist"
**Solution:** Use `--clear` flag to remove existing songs first:
```bash
npm run seed:copyright-free:clear
```

### Error: "Admin user not found"
**Solution:** The script will create an admin user automatically if it doesn't exist.

### Error: "Invalid file URL"
**Solution:** Make sure file URLs in the seed script are accessible and valid.

### Error: "Connection refused"
**Solution:** Check your `MONGODB_URI` in `.env` file.

---

## ✅ Summary

### Admin Upload Endpoint ✅
- **Endpoint:** `POST /api/audio/copyright-free`
- **Auth:** Admin only
- **Files:** Audio + Thumbnail required
- **Status:** ✅ Ready to use

### Seed Script ✅
- **Command:** `npm run seed:copyright-free`
- **Clear & Reseed:** `npm run seed:copyright-free:clear`
- **Songs:** 10 default songs included
- **Status:** ✅ Ready to use

---

**All tools are ready for seeding default copyright-free songs!** 🚀

