# Copyright-Free Songs Folder

Place your copyright-free songs here in the following structure:

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

## Folder Structure

Each song should be in its own folder with:

- **Audio file** (required): `.mp3`, `.wav`, `.ogg`, `.aac`, `.flac`, or `.m4a`
- **Thumbnail** (recommended): `.jpg`, `.jpeg`, `.png`, or `.webp`
- **metadata.json** (optional): Custom metadata for the song

## Metadata File (Optional)

Create a `metadata.json` file in each song folder to customize the song details:

```json
{
  "title": "Peaceful Worship",
  "description": "A calming worship song perfect for meditation and prayer",
  "category": "worship",
  "speaker": "Jevah Music",
  "year": 2024,
  "duration": 180,
  "topics": ["worship", "peace", "meditation"],
  "tags": ["worship", "peaceful", "meditation", "prayer"]
}
```

If you don't provide `metadata.json`, the script will:
- Use the folder name as the title (converted to Title Case)
- Use default values from the script

## Running the Seed Script

```bash
# 1. Build the project
npm run build

# 2. Add your songs to this folder

# 3. Run the seed script
node scripts/seed-copyright-free-with-upload.js
```

The script will:
1. ✅ Upload audio files to Cloudflare R2
2. ✅ Upload thumbnails to Cloudflare R2
3. ✅ Create database entries with all metadata
4. ✅ Mark songs as copyright-free and approved

## Supported Audio Formats

- MP3 (`.mp3`)
- WAV (`.wav`)
- OGG (`.ogg`)
- AAC (`.aac`)
- FLAC (`.flac`)
- M4A (`.m4a`)

## Supported Image Formats

- JPEG (`.jpg`, `.jpeg`)
- PNG (`.png`)
- WebP (`.webp`)

