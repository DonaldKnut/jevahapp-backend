# Cloudflare Media Optimization Setup Checklist

This checklist provides step-by-step instructions to optimize Cloudflare R2 media delivery and resolve audio/video cracking issues.

## Prerequisites

- ✅ Cloudflare account with R2 bucket created
- ✅ Domain added to Cloudflare (if using custom domain)
- ✅ Backend code updated (already done ✅)

---

## Step 1: Configure R2 Bucket for Public Access

### 1.1 Enable Public Access

1. Go to **Cloudflare Dashboard** → **R2** → Select your bucket
2. Click **Settings** tab
3. Scroll to **Public Access**
4. Enable **Allow Access** (if not already enabled)
5. Click **Save**

### 1.2 Configure CORS (Optional but Recommended)

1. In bucket **Settings**, scroll to **CORS Policy**
2. Click **Edit CORS Policy**
3. Add the following JSON configuration:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD", "OPTIONS"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": [
      "ETag",
      "Content-Length",
      "Content-Range",
      "Accept-Ranges",
      "Content-Type"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

4. Click **Save**

---

## Step 2: Set Up Custom Domain (RECOMMENDED)

### 2.1 Create Custom Domain in R2

1. Go to **Cloudflare Dashboard** → **R2** → Your bucket → **Settings**
2. Scroll to **Custom Domains**
3. Click **Connect Domain**
4. Enter your custom domain (e.g., `media.yourdomain.com`)
5. Click **Connect Domain**
6. Cloudflare will automatically create the DNS record

### 2.2 Verify DNS Configuration

1. Go to **Cloudflare Dashboard** → **DNS** → **Records**
2. Find the record for your custom domain (e.g., `media.yourdomain.com`)
3. **CRITICAL**: Ensure the proxy status shows **Proxied** (🟠 Orange Cloud)
   - If it shows **DNS only** (⚪ Gray Cloud), click to toggle to **Proxied**
4. Wait 1-5 minutes for DNS propagation

### 2.3 Update Environment Variable

Update your backend `.env` file:

```bash
R2_CUSTOM_DOMAIN=media.yourdomain.com
```

**Restart your backend server** after updating the environment variable.

### 2.4 Test Custom Domain

```bash
# Test if domain resolves correctly
curl -I https://media.yourdomain.com/jevah/media-videos/test-video.mp4

# Should return headers including:
# - Accept-Ranges: bytes
# - Content-Type: video/mp4
# - CF-Cache-Status: HIT (after first request)
```

---

## Step 3: Configure Cloudflare Page Rules

### 3.1 Navigate to Page Rules

1. Go to **Cloudflare Dashboard** → **Rules** → **Page Rules**
2. Click **Create Page Rule**

### 3.2 Rule 1: Cache Video Files

**URL Pattern**: 
```
media.yourdomain.com/*.mp4
```
OR if using path-based structure:
```
media.yourdomain.com/media-videos/*
```

**Settings** (click "Add a Setting" for each):
- **Cache Level**: Cache Everything
- **Edge Cache TTL**: 1 month
- **Browser Cache TTL**: Respect Existing Headers
- **Respect Existing Headers**: Off

Click **Save and Deploy**

### 3.3 Rule 2: Cache Audio Files

**URL Pattern**: 
```
media.yourdomain.com/*.mp3
```
OR:
```
media.yourdomain.com/media-music/*
```

**Settings**:
- **Cache Level**: Cache Everything
- **Edge Cache TTL**: 1 month
- **Browser Cache TTL**: Respect Existing Headers

Click **Save and Deploy**

### 3.4 Rule 3: Cache Document Files (PDFs, EPUBs)

**URL Pattern**: 
```
media.yourdomain.com/media-books/*
```
OR:
```
media.yourdomain.com/*.pdf
media.yourdomain.com/*.epub
```

**Settings**:
- **Cache Level**: Cache Everything
- **Edge Cache TTL**: 1 week
- **Browser Cache TTL**: Respect Existing Headers

Click **Save and Deploy**

### 3.5 Verify Page Rules Order

**Important**: Page Rules are evaluated in order. Make sure more specific rules (e.g., `*.mp4`) come BEFORE more general rules.

Drag and drop rules to reorder if needed.

---

## Step 4: SSL/TLS Configuration

1. Go to **Cloudflare Dashboard** → **SSL/TLS**
2. Set **SSL/TLS encryption mode** to **Full (strict)**
3. Enable **Always Use HTTPS**
4. Set **Minimum TLS Version** to **1.2** or higher
5. Save changes

---

## Step 5: Test Media Delivery

### 5.1 Test Video File

```bash
# Test video with Range request
curl -I -H "Range: bytes=0-1023" https://media.yourdomain.com/path/to/video.mp4

# Expected response:
# HTTP/2 206 Partial Content
# Accept-Ranges: bytes
# Content-Range: bytes 0-1023/12345678
# Content-Length: 1024
# CF-Cache-Status: HIT (after caching)
```

### 5.2 Test Audio File

```bash
# Test audio file
curl -I https://media.yourdomain.com/path/to/audio.mp3

# Expected response:
# HTTP/2 200 OK
# Accept-Ranges: bytes
# Content-Type: audio/mpeg
# Cache-Control: public, max-age=31536000, immutable
# CF-Cache-Status: HIT (after caching)
```

### 5.3 Test Cache Status

Check the `CF-Cache-Status` header:
- **HIT**: ✅ File is cached at Cloudflare edge
- **MISS**: First request (will be cached for next requests)
- **DYNAMIC**: File not cacheable (shouldn't happen for static media)

---

## Step 6: Monitor Performance

### 6.1 Cloudflare Analytics

1. Go to **Cloudflare Dashboard** → **Analytics** → **Performance**
2. Monitor:
   - **Cache Hit Ratio**: Should be > 80% for media files
   - **Bandwidth Saved**: Should show significant savings
   - **Request Rate**: Monitor for unusual spikes

### 6.2 Browser DevTools Testing

1. Open your app/frontend
2. Open Browser DevTools → Network tab
3. Play a video/audio file
4. Check the media file request:
   - **Status**: Should be 200 or 206 (Partial Content for Range requests)
   - **Size**: Should show cached size (smaller than full file)
   - **Time**: Should be very fast (< 100ms) after first request
   - **Response Headers**: Check for `CF-Cache-Status: HIT`

---

## Step 7: Frontend Implementation (React Native)

See `FRONTEND_MEDIA_BUFFERING_GUIDE.md` for detailed frontend implementation.

### Quick Checklist:

- [ ] Increase video buffer size to 5000-10000ms
- [ ] Implement pre-buffering before playback
- [ ] Add proper error handling and retry logic
- [ ] Implement progressive loading for large files
- [ ] Add loading states and progress indicators

---

## Troubleshooting

### Issue: Custom Domain Not Working

**Symptoms**: 404 errors or connection refused

**Solutions**:
1. Verify DNS record is **Proxied** (orange cloud)
2. Wait 5-10 minutes for DNS propagation
3. Check if SSL/TLS mode is set correctly
4. Verify bucket name matches in R2 settings

### Issue: Files Not Caching

**Symptoms**: `CF-Cache-Status: DYNAMIC` or `MISS` always

**Solutions**:
1. Verify Page Rules are active (green checkmark)
2. Check Page Rule order (more specific rules first)
3. Verify Cache-Control headers are set correctly
4. Ensure file extensions match Page Rule patterns

### Issue: Range Requests Not Working

**Symptoms**: Videos can't seek/scrub, audio stutters

**Solutions**:
1. Verify `Accept-Ranges: bytes` header is present
2. Check CORS configuration includes `Content-Range` in ExposeHeaders
3. Test with curl to verify Range request support
4. Check if custom domain is proxied (required for optimal Range support)

### Issue: SSL Certificate Errors

**Symptoms**: Certificate warnings in browser/app

**Solutions**:
1. Ensure SSL/TLS mode is **Full (strict)**
2. Verify custom domain is properly connected in R2 settings
3. Wait for certificate provisioning (can take up to 24 hours)

---

## Verification Script

Run this script to verify your setup:

```bash
#!/bin/bash

DOMAIN="media.yourdomain.com"  # Update this
TEST_VIDEO="/path/to/test-video.mp4"  # Update this
TEST_AUDIO="/path/to/test-audio.mp3"  # Update this

echo "Testing Cloudflare R2 Media Setup..."
echo "====================================="
echo ""

echo "1. Testing DNS resolution..."
nslookup $DOMAIN
echo ""

echo "2. Testing SSL certificate..."
openssl s_client -connect $DOMAIN:443 -servername $DOMAIN < /dev/null 2>/dev/null | grep -A 5 "Certificate chain"
echo ""

echo "3. Testing video file (with Range request)..."
curl -I -H "Range: bytes=0-1023" "https://$DOMAIN$TEST_VIDEO" 2>&1 | grep -E "HTTP|Accept-Ranges|Content-Range|CF-Cache-Status|Cache-Control"
echo ""

echo "4. Testing audio file..."
curl -I "https://$DOMAIN$TEST_AUDIO" 2>&1 | grep -E "HTTP|Accept-Ranges|Content-Type|CF-Cache-Status|Cache-Control"
echo ""

echo "✅ Setup verification complete!"
```

---

## Next Steps

1. ✅ Complete all steps above
2. ✅ Test media playback in your app
3. ✅ Monitor Cloudflare Analytics for cache hit rates
4. ✅ Implement frontend buffering optimizations (see `FRONTEND_MEDIA_BUFFERING_GUIDE.md`)
5. ✅ Monitor user reports for improved playback experience

---

## Support

If you encounter issues:
1. Check Cloudflare Status page: https://www.cloudflarestatus.com/
2. Review Cloudflare R2 documentation: https://developers.cloudflare.com/r2/
3. Check Cloudflare Community Forums
4. Review error logs in Cloudflare Dashboard → Analytics → Logs

---

**Last Updated**: 2024
**Status**: Ready for Implementation ✅


