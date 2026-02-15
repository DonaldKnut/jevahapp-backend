# Cloudflare Media Optimization - Quick Start

**Goal**: Fix audio/video cracking and speed up media loading from Cloudflare R2.

---

## ✅ What's Already Done (Backend)

1. ✅ Optimized Cache-Control headers in upload service
2. ✅ Proper Content-Type handling
3. ✅ Metadata tagging for streaming optimization
4. ✅ Range request support in download endpoints

**No backend changes needed** - just follow the setup steps below.

---

## 🚀 Quick Setup (30 minutes)

### Step 1: Enable R2 Public Access (5 min)

1. Cloudflare Dashboard → R2 → Your Bucket → Settings
2. Enable **Public Access**
3. (Optional) Add CORS configuration (see `CLOUDFLARE_SETUP_CHECKLIST.md`)

### Step 2: Set Up Custom Domain (15 min) ⭐ RECOMMENDED

**This is the most important step for fixing cracking issues!**

1. **In R2 Settings**:
   - Go to Custom Domains
   - Click "Connect Domain"
   - Enter: `media.yourdomain.com` (or your preferred subdomain)

2. **Verify DNS** (automatic, but check):
   - Cloudflare Dashboard → DNS → Records
   - Ensure `media.yourdomain.com` shows **🟠 Proxied** (orange cloud)
   - If gray, click to toggle to Proxied

3. **Update Backend**:
   ```bash
   # Add to .env file
   R2_CUSTOM_DOMAIN=media.yourdomain.com
   ```
   Restart backend server

### Step 3: Configure Page Rules (5 min)

1. Cloudflare Dashboard → Rules → Page Rules → Create Page Rule

**Rule for Videos**:
- URL: `media.yourdomain.com/*.mp4` (or `media.yourdomain.com/media-videos/*`)
- Settings:
  - Cache Level: **Cache Everything**
  - Edge Cache TTL: **1 month**

**Rule for Audio**:
- URL: `media.yourdomain.com/*.mp3` (or `media.yourdomain.com/media-music/*`)
- Settings:
  - Cache Level: **Cache Everything**
  - Edge Cache TTL: **1 month**

Click **Save and Deploy** for each rule.

### Step 4: Test (5 min)

```bash
# Test video file
curl -I https://media.yourdomain.com/path/to/video.mp4

# Look for these headers:
# ✅ Accept-Ranges: bytes
# ✅ CF-Cache-Status: HIT (after first request)
# ✅ Cache-Control: public, max-age=31536000, immutable
```

---

## 📱 Frontend Implementation (Next Step)

See `FRONTEND_MEDIA_BUFFERING_GUIDE.md` for detailed React Native/Expo code.

### Critical Frontend Changes:

1. **Increase Buffer Sizes**:
   ```typescript
   // Video: min 5000ms, max 10000ms
   // Audio: pre-buffer 500ms before playing
   ```

2. **Pre-buffer Before Playback**:
   ```typescript
   // Don't play immediately - load first, then play
   await video.loadAsync({ uri: url }, { shouldPlay: false });
   await new Promise(resolve => setTimeout(resolve, 500)); // Buffer
   await video.playAsync();
   ```

3. **Add Error Handling & Retries**

---

## 📋 Priority Order

**High Priority** (Do First):
1. ✅ Custom Domain Setup (Step 2) - **Most important for fixing cracking**
2. ✅ Page Rules (Step 3) - Improves performance significantly

**Medium Priority**:
3. ✅ Frontend Buffering (see `FRONTEND_MEDIA_BUFFERING_GUIDE.md`)
4. ✅ R2 CORS Configuration (Step 1, optional)

**Low Priority** (Advanced):
5. ✅ Cloudflare Worker (see `CLOUDFLARE_MEDIA_OPTIMIZATION_GUIDE.md`)
6. ✅ Advanced monitoring and analytics

---

## 🎯 Expected Results

After implementing Steps 1-3:

- ✅ **Audio cracking**: Should be resolved with custom domain + CDN caching
- ✅ **Video stuttering**: Should be fixed with better caching + Range requests
- ✅ **Slow loading**: Should improve 5-10x with CDN edge caching
- ✅ **Ebook loading**: Should be faster with optimized caching

**After frontend buffering optimizations**:

- ✅ **Smoother playback**: No more interruptions during playback
- ✅ **Faster start**: Better perceived performance with pre-buffering
- ✅ **Better UX**: Loading states and error handling

---

## 🔍 Troubleshooting

### Still seeing cracking?

1. **Check if custom domain is proxied** (orange cloud in DNS)
2. **Verify Page Rules are active** (green checkmark)
3. **Test with curl** to see actual headers
4. **Implement frontend buffering** (most common cause)

### Files not caching?

1. Check `CF-Cache-Status` header (should be HIT after first request)
2. Verify Page Rule patterns match your URL structure
3. Check Cache-Control headers in response

### Still slow?

1. Monitor Cloudflare Analytics → Performance
2. Check cache hit ratio (should be > 80%)
3. Verify you're using custom domain (not R2 dev URLs)
4. Consider Cloudflare Worker for advanced optimization

---

## 📚 Full Documentation

- **Detailed Setup**: `CLOUDFLARE_SETUP_CHECKLIST.md`
- **Complete Guide**: `CLOUDFLARE_MEDIA_OPTIMIZATION_GUIDE.md`
- **Frontend Code**: `FRONTEND_MEDIA_BUFFERING_GUIDE.md`

---

## ✅ Checklist

- [ ] R2 bucket has public access enabled
- [ ] Custom domain configured and proxied (orange cloud)
- [ ] Backend `.env` updated with `R2_CUSTOM_DOMAIN`
- [ ] Page Rules created for video/audio caching
- [ ] Tested media URLs return correct headers
- [ ] Frontend buffering implemented (see guide)
- [ ] Monitoring Cloudflare Analytics

---

**Time Estimate**: 30 minutes for setup + 1-2 hours for frontend implementation

**Expected Impact**: 5-10x faster loading, no more cracking/stuttering ✅


