# Cloudflare Media Optimization Guide

This guide provides comprehensive strategies to optimize media delivery through Cloudflare R2, addressing issues like audio/video cracking, slow loading times, and improving playback performance.

## Table of Contents

1. [Backend Optimizations](#backend-optimizations)
2. [Cloudflare R2 Configuration](#cloudflare-r2-configuration)
3. [Custom Domain Setup](#custom-domain-setup)
4. [Cloudflare Page Rules](#cloudflare-page-rules)
5. [Cloudflare Workers (Advanced)](#cloudflare-workers-advanced)
6. [Frontend Recommendations](#frontend-recommendations)
7. [Troubleshooting](#troubleshooting)

---

## Backend Optimizations

### ✅ Already Implemented

The codebase has been enhanced with:
- **Optimized Cache-Control headers**: `public, max-age=31536000, immutable` for media files
- **Proper Content-Type detection**: Ensures correct MIME types for all media formats
- **Metadata tagging**: Files are tagged as streamable for video/audio content
- **Range request support**: The download endpoint supports HTTP Range requests for resumable streaming

### File Upload Service

The `fileUpload.service.ts` now includes:
- Optimized caching strategies based on media type
- Metadata hints for streaming optimization
- Proper Content-Type handling for all file types

---

## Cloudflare R2 Configuration

### 1. Enable Public Access

Ensure your R2 bucket allows public access:

1. Go to Cloudflare Dashboard → R2 → Your Bucket
2. Click **Settings**
3. Enable **Public Access** (if not already enabled)
4. Optionally configure CORS rules:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Range", "Accept-Ranges"],
    "MaxAgeSeconds": 3600
  }
]
```

### 2. Custom Domain Configuration

**Highly Recommended**: Use a custom domain with Cloudflare proxy enabled.

#### Benefits:
- **Global CDN caching**: Files are cached at Cloudflare's edge locations
- **Better performance**: Reduced latency through geographic distribution
- **Additional optimizations**: Access to Page Rules, Workers, and other Cloudflare features
- **Improved streaming**: Better Range request handling

#### Setup Steps:

1. **Create Custom Domain in R2**:
   ```
   Cloudflare Dashboard → R2 → Your Bucket → Settings → Custom Domains
   Add Custom Domain: media.yourdomain.com
   ```

2. **Enable Cloudflare Proxy** (Orange Cloud):
   - DNS record should show proxy enabled (orange cloud)
   - This enables CDN caching and optimizations

3. **Update Environment Variable**:
   ```bash
   R2_CUSTOM_DOMAIN=media.yourdomain.com
   ```

### 3. R2 Public URL Format

If not using a custom domain, ensure you're using the public R2 URL format:
```
https://pub-{account-id}.r2.dev/{bucket-name}/{object-key}
```

---

## Custom Domain Setup

### DNS Configuration

1. Add a CNAME record in Cloudflare DNS:
   ```
   Type: CNAME
   Name: media (or subdomain of choice)
   Target: {your-bucket}.r2.cloudflarestorage.com
   Proxy Status: Proxied (Orange Cloud) ✅
   ```

2. **Important**: Keep proxy enabled to leverage Cloudflare's CDN

### SSL/TLS Settings

In Cloudflare Dashboard → SSL/TLS:
- **SSL/TLS encryption mode**: Full (strict) recommended
- **Always Use HTTPS**: Enabled
- **Minimum TLS Version**: 1.2 or higher

---

## Cloudflare Page Rules

Create Page Rules to optimize media delivery. Go to **Cloudflare Dashboard → Rules → Page Rules**.

### Rule 1: Cache Video Files Aggressively

**URL Pattern**: `media.yourdomain.com/*.mp4` (adjust based on your URL structure)

**Settings**:
- **Cache Level**: Cache Everything
- **Edge Cache TTL**: 1 month
- **Browser Cache TTL**: Respect Existing Headers
- **Respect Existing Headers**: Off
- **Add Custom Header**: 
  - Header name: `Accept-Ranges`
  - Value: `bytes`

### Rule 2: Cache Audio Files

**URL Pattern**: `media.yourdomain.com/*.mp3` or `media.yourdomain.com/media-music/*`

**Settings**:
- **Cache Level**: Cache Everything
- **Edge Cache TTL**: 1 month
- **Browser Cache TTL**: Respect Existing Headers

### Rule 3: Optimize PDF/EPUB Files

**URL Pattern**: `media.yourdomain.com/media-books/*` or `*.pdf`, `*.epub`

**Settings**:
- **Cache Level**: Cache Everything
- **Edge Cache TTL**: 1 week
- **Browser Cache TTL**: Respect Existing Headers
- **Bypass Cache on Cookie**: Off

### Rule 4: Bypass Cache for Range Requests (if needed)

If experiencing issues with Range requests, you may need to:
- **Disable caching for Range requests** in specific scenarios
- Use a Worker (see below) instead for more control

---

## Cloudflare Workers (Advanced)

For advanced streaming optimization, create a Cloudflare Worker to add custom headers and handle Range requests optimally.

### Worker Script Example

```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // Only handle media files
  const mediaExtensions = ['.mp4', '.mp3', '.m4a', '.webm', '.ogg', '.pdf', '.epub']
  const isMediaFile = mediaExtensions.some(ext => url.pathname.endsWith(ext))
  
  if (!isMediaFile) {
    return fetch(request)
  }
  
  // Fetch from R2 origin
  const response = await fetch(request, {
    cf: {
      cacheEverything: true,
      cacheTtl: 2592000, // 30 days
      cacheTtlByStatus: {
        '200-299': 2592000,
        '404': 1,
        '500-599': 0
      }
    }
  })
  
  // Clone response to modify headers
  const newResponse = new Response(response.body, response)
  
  // Add streaming-optimized headers
  newResponse.headers.set('Accept-Ranges', 'bytes')
  newResponse.headers.set('X-Content-Type-Options', 'nosniff')
  
  // For video/audio, ensure proper CORS if needed
  if (url.pathname.match(/\.(mp4|mp3|m4a|webm|ogg)$/i)) {
    newResponse.headers.set('Access-Control-Allow-Origin', '*')
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    newResponse.headers.set('Access-Control-Allow-Headers', 'Range')
    newResponse.headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges')
  }
  
  // Preserve Range request headers
  if (request.headers.get('Range')) {
    const range = request.headers.get('Range')
    // Cloudflare will handle Range requests automatically, but we ensure headers are set
  }
  
  return newResponse
}
```

### Deploy Worker

1. Go to **Cloudflare Dashboard → Workers & Pages → Create Application**
2. Create a new Worker
3. Paste the script above
4. Deploy and add a route: `media.yourdomain.com/*`
5. Ensure the route is before Page Rules in priority

---

## Frontend Recommendations

### Video Streaming Best Practices

```typescript
// React Native / Expo Video Player Example
import { Video } from 'expo-av';

<Video
  source={{ uri: mediaUrl }}
  shouldPlay={true}
  isLooping={false}
  resizeMode="contain"
  useNativeControls={true}
  // Optimize buffering
  progressUpdateIntervalMillis={1000}
  // Preload settings
  shouldPlay={false} // Let user initiate play for better buffering
  // Buffering configuration
  bufferConfig={{
    minBufferMs: 5000,
    maxBufferMs: 10000,
    bufferForPlaybackMs: 2500,
    bufferForPlaybackAfterRebufferMs: 5000,
  }}
/>
```

### Audio Streaming Best Practices

```typescript
// For audio, ensure proper buffering
import { Audio } from 'expo-av';

const sound = new Audio.Sound();

await sound.loadAsync(
  { uri: audioUrl },
  {
    shouldPlay: false, // Load first, then play
    progressUpdateIntervalMillis: 1000,
    positionMillis: 0,
    isLooping: false,
    // Pre-buffer before playing
    shouldCorrectPitch: true,
  }
);

// Pre-buffer before playing
await sound.setStatusAsync({ shouldPlay: false });
await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for buffering
await sound.playAsync();
```

### PDF/EPUB Loading Optimization

```typescript
// For ebooks, implement progressive loading
import * as FileSystem from 'expo-file-system';

// Pre-download or cache ebooks
async function preloadEbook(mediaUrl: string) {
  const fileUri = FileSystem.documentDirectory + 'ebook.pdf';
  
  const downloadResumable = FileSystem.createDownloadResumable(
    mediaUrl,
    fileUri,
    {},
    (downloadProgress) => {
      const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
      // Update UI with progress
    }
  );
  
  try {
    const result = await downloadResumable.downloadAsync();
    return result?.uri;
  } catch (e) {
    console.error('Download error:', e);
    // Fallback to direct URL
    return mediaUrl;
  }
}
```

### Range Request Implementation

Ensure your video/audio player supports HTTP Range requests:

```typescript
// Example: Custom fetch with Range support
async function fetchMediaWithRange(url: string, start?: number, end?: number) {
  const headers: HeadersInit = {};
  
  if (start !== undefined && end !== undefined) {
    headers['Range'] = `bytes=${start}-${end}`;
  }
  
  const response = await fetch(url, { headers });
  
  if (response.status === 206) {
    // Partial content - Range request successful
    const contentRange = response.headers.get('Content-Range');
    const contentLength = response.headers.get('Content-Length');
    // Handle partial content
  }
  
  return response;
}
```

### Preloading Strategy

```typescript
// Preload media metadata before playing
async function preloadMediaMetadata(mediaUrl: string) {
  try {
    // HEAD request to get metadata without downloading
    const response = await fetch(mediaUrl, { method: 'HEAD' });
    
    const contentLength = response.headers.get('Content-Length');
    const contentType = response.headers.get('Content-Type');
    const acceptRanges = response.headers.get('Accept-Ranges');
    
    return {
      size: contentLength ? parseInt(contentLength) : null,
      type: contentType,
      supportsRange: acceptRanges === 'bytes',
    };
  } catch (error) {
    console.error('Preload error:', error);
    return null;
  }
}
```

---

## Troubleshooting

### Issue: Audio/Video Cracking or Stuttering

**Possible Causes & Solutions**:

1. **Insufficient Buffering**
   - ✅ **Solution**: Increase buffer size in player configuration
   - Set `minBufferMs` to 5000-10000ms
   - Pre-buffer before playing

2. **Network Issues**
   - ✅ **Solution**: Implement progressive loading with Range requests
   - Use CDN caching (custom domain with Cloudflare proxy)
   - Check network connectivity before playing

3. **Missing Range Request Support**
   - ✅ **Solution**: Ensure `Accept-Ranges: bytes` header is present
   - Verify player supports HTTP Range requests
   - Check Cloudflare Page Rules/Worker configuration

4. **Caching Issues**
   - ✅ **Solution**: Verify Cache-Control headers
   - Check Cloudflare cache status in response headers
   - Clear cache if testing: Add `?v=${timestamp}` for cache busting during development

### Issue: Slow Ebook Loading

**Solutions**:

1. **Implement Progressive Download**
   - Download in background when user opens ebook list
   - Cache downloaded files locally

2. **Optimize PDF/EPUB Size**
   - Compress files before upload
   - Use optimized formats (WebP for images in PDFs)

3. **Preload Strategy**
   - Pre-fetch ebook metadata
   - Implement pagination for large ebooks

### Issue: Media Not Loading from R2

**Checklist**:

1. ✅ Verify R2 bucket is publicly accessible
2. ✅ Check CORS configuration in R2 bucket settings
3. ✅ Verify custom domain is properly configured (if used)
4. ✅ Check DNS records (should be proxied - orange cloud)
5. ✅ Verify SSL/TLS settings in Cloudflare
6. ✅ Check environment variables (`R2_CUSTOM_DOMAIN`, `R2_PUBLIC_DEV_URL`)

### Debugging Tips

1. **Check Response Headers**:
   ```bash
   curl -I https://media.yourdomain.com/path/to/file.mp4
   ```
   Look for:
   - `Accept-Ranges: bytes`
   - `Content-Type: video/mp4` (correct MIME type)
   - `Cache-Control: public, max-age=31536000, immutable`
   - `CF-Cache-Status: HIT` (if using custom domain)

2. **Test Range Requests**:
   ```bash
   curl -H "Range: bytes=0-1023" -I https://media.yourdomain.com/path/to/file.mp4
   ```
   Should return `206 Partial Content`

3. **Check Cloudflare Cache**:
   - Response header `CF-Cache-Status`:
     - `HIT`: Cached at edge ✅
     - `MISS`: Not cached (first request)
     - `DYNAMIC`: Not cacheable

---

## Performance Metrics

### Target Metrics

- **Time to First Byte (TTFB)**: < 100ms (with CDN caching)
- **Video Start Time**: < 2 seconds
- **Audio Start Time**: < 1 second
- **Ebook Load Time**: < 3 seconds (for first page)

### Monitoring

1. **Cloudflare Analytics**:
   - Dashboard → Analytics → Performance
   - Monitor cache hit ratio (aim for > 80%)

2. **Real User Monitoring**:
   - Track media load times in your app
   - Monitor buffering events
   - Track failed media loads

---

## Summary of Optimizations

### ✅ Backend (Already Implemented)
- Optimized Cache-Control headers
- Proper Content-Type handling
- Metadata tagging for streaming
- Range request support in download endpoint

### 🔧 Cloudflare Configuration (Recommended)
- [ ] Set up custom domain with Cloudflare proxy
- [ ] Configure Page Rules for media caching
- [ ] Set up CORS rules in R2 bucket
- [ ] Consider Cloudflare Worker for advanced optimization

### 📱 Frontend (To Implement)
- [ ] Increase buffer sizes for video/audio players
- [ ] Implement pre-buffering before playback
- [ ] Add progressive loading for large files
- [ ] Implement proper error handling and retry logic
- [ ] Add loading states and progress indicators

---

## Additional Resources

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Cloudflare Page Rules](https://developers.cloudflare.com/fundamentals/get-started/concepts/how-cloudflare-works/#cloudflare-page-rules)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [HTTP Range Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests)
- [Video Streaming Best Practices](https://web.dev/fast/#optimize-your-videos)

---

**Last Updated**: 2024
**Maintained By**: Backend Team


