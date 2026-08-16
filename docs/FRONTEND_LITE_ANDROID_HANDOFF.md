# Frontend handoff — Jevah Lite (2GB Android / low-end)

**Date:** 2026-08-10  
**Audience:** Mobile Expo (`jevahapp-frontend`)  
**Backend:** Contabo-safe `profile=lite` compact feeds (shipped)  
**Goal:** Run like Facebook Lite / TikTok Lite on ~2GB RAM phones without a second Contabo stack.

---

## 0. Senior verdict

| Layer | Who owns Lite? | Status |
|-------|----------------|--------|
| **Client RAM, APK size, image/video decode, cache** | **Frontend (~85%)** | You must build this |
| **Smaller JSON + playback hints** | Backend (~15%) | **Shipped** — `?profile=lite` / `X-Jevah-Client: lite` |
| Heavy ML on device | **Never** | Ranking/moderation stay on server |

Lite is **not** a separate backend product. Same API, leaner client + compact payloads.

---

## 1. Backend already helps (use it)

```http
GET /api/feed/for-you?profile=lite&limit=8
GET /api/feed/music-for-you?profile=lite&lane=artist&limit=8
Authorization: Bearer <backend JWT>
X-Jevah-Client: lite
```

Lite response extras:

- Smaller page default (8, cap 12)
- Stripped fields (no moderation blobs / fat nested objects)
- **Author kept** — `uploadedBy` / `author` / `authorInfo` are a compact `{ _id, id, firstName, lastName, name, avatar }` object. Do not show Unknown; see [FRONTEND_AUTHOR_AVATAR_HANDOFF.md](./FRONTEND_AUTHOR_AVATAR_HANDOFF.md)
- `data.profile: "lite"`
- Per-item `lite: { preferHls, maxVideoHeight: 360, prefetchCount: 1, imageMaxEdge }`

Full app keeps calling without `profile=lite`.

Chronological fallback (also compact when lite):

```http
GET /api/media/all-content?profile=lite&limit=8
GET /api/media/public/all-content?profile=lite&limit=8
```

---

## 2. Product rule (Facebook Lite pattern)

**One feature set core:** For You, Artists music, like/save/comment, creator apply (web), auth.  
**Defer / gate on Lite:** live rooms, heavy editor, high-res downloads, large ebooks TTS offline, animated confetti, multi-video preloading.

Detect Lite:

```ts
// Rough device class — tune with expo-device
import * as Device from "expo-device";
import { Platform } from "react-native";

export function shouldUseLiteProfile(): boolean {
  if (Platform.OS !== "android") return false;
  // Heuristics: low memory class, low total memory if available, or user toggle
  const mem = (Device as any).totalMemory; // bytes when available
  if (typeof mem === "number" && mem > 0 && mem < 2.5 * 1024 ** 3) return true;
  // Fallback: remote config / Settings → "Data saver / Lite mode"
  return false; // or AsyncStorage flag
}
```

Ship a **Settings → Lite mode / Data saver** toggle so users on 3–4GB can opt in.

---

## 3. Hard FE rules for 2GB RAM

### Memory

| Do | Don't |
|----|--------|
| Keep **≤2** decoded video surfaces (current + next) | Prefetch 5+ full videos |
| Cap image cache **32–48MB** | Unlimited FastImage / expo-image disk cache |
| Unmount off-screen players aggressively | Keep muted players in FlatList cells |
| One global audio player | Per-row Audio.Sound instances |
| Release bitmaps on blur / background | Hold full-res thumbnails forever |

### Video

1. Prefer `hlsUrl` when present (ABR → 360p on weak devices).  
2. Honor `item.lite.maxVideoHeight` (360).  
3. Start muted; don’t autoplay off-screen.  
4. On Lite: **no** 1080p MP4 download for feed — stream only.  
5. Pause + unload when `viewability < 60%`.

### Images

- Request / display thumbs only; `imageMaxEdge` 320–480.  
- If you control CDN transforms later, use width query; today use `thumbnailUrl` as-is and avoid downloading `fileUrl` for posters.

### Lists

- `FlatList` / FlashList: `windowSize={3}`, `maxToRenderPerBatch={3}`, `initialNumToRender={2}`, `removeClippedSubviews`  
- Page size **8** on Lite  
- Cursor pagination only — no infinite in-memory array growth; drop old pages beyond ~30 items if needed

### Network / data saver

- Batch `POST /api/feed/events` (already recommended)  
- Skip high-res avatar carousels on feed  
- Defer sockets until first interaction if cold start is slow (likes still work via HTTP)

### JS / APK

- Hermes on  
- Strip unused native modules from Lite flavor if you split flavors later  
- Avoid loading Creator Studio heavy screens into the main feed bundle (lazy routes)

---

## 4. Copy-paste API client switch

```ts
const lite = shouldUseLiteProfile();

const headers = {
  Authorization: `Bearer ${token}`,
  ...(lite ? { "X-Jevah-Client": "lite" } : {}),
};

const q = new URLSearchParams({
  limit: lite ? "8" : "20",
  ...(lite ? { profile: "lite" } : {}),
});

const res = await fetch(`${API}/feed/for-you?${q}`, { headers });
```

Use the same header on music-for-you.

---

## 5. Screen budget (Lite first viewport)

Vertical For You only:

- Full-bleed video or poster  
- Heart / comment / save / share  
- Caption (2 lines)  
- **No** glass dashboards, no multi-rail, no Lottie spam  

Artists: one horizontal rail or simple list — not a Spotify clone with 6 carousels.

---

## 6. Optional Expo “Lite” flavor (later)

| Flavor | Package | Default profile |
|--------|---------|-----------------|
| Full | `com.jevahapp` | `full` |
| Lite | `com.jevahapp.lite` | always `lite` |

Same backend. Lite APK excludes editor / live / large assets.

---

## 7. FE checklist

- [ ] Device heuristic + Settings toggle → `X-Jevah-Client: lite`  
- [ ] For You + music-for-you with `profile=lite&limit=8`  
- [ ] HLS preferred; max 360p intent; unload off-screen  
- [ ] Image cache capped; FlashList window small  
- [ ] Single audio player  
- [ ] Event queue soft-fail (existing)  
- [ ] Smoke on a real 2GB Android (not only emulators with 4GB+)

---

## 8. What backend will *not* do (by design)

- Separate Lite Contabo process / Redis / ML  
- Server-side layout like 2015 Facebook Lite HTML  
- On-device Whisper/CLIP  

RAM wins come from **client discipline** + **smaller JSON** + **360p streaming**.

---

## Related

- [FRONTEND_FOR_YOU_HANDOFF.md](./FRONTEND_FOR_YOU_HANDOFF.md)  
- [FRONTEND_TIKTOK_FEED_HANDOFF.md](./FRONTEND_TIKTOK_FEED_HANDOFF.md)  
- [PERFORMANCE.md](./PERFORMANCE.md)  
