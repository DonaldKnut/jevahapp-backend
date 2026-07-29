# Backend → Frontend handoff — Media views (sign-off)

**Audience:** Mobile / Expo (`jevahapp-frontend`)  
**Date:** 2026-07-27  
**From:** Backend / engagement  
**Re:** Your *Media View Recording* handoff — corroboration + what FE must do

**Related (backend):** [ENGAGEMENT.md](./ENGAGEMENT.md) · [FRONTEND_ENGAGEMENT.md](./FRONTEND_ENGAGEMENT.md) · [WEBSOCKETS.md](./WEBSOCKETS.md)

---

## 0. Verdict (read this first)

| Topic | Status |
|-------|--------|
| Endpoint, auth, body, response (`viewCount` + **`counted`**) | **Already match** — keep calling as you do |
| Video / reels thresholds (3s / 25% / complete) | **Agreed** — same on BE |
| Audio / music thresholds | **FE must raise** to BE rules (see §3) — do not ask BE to drop to 3s |
| Ebook thresholds | **FE must raise** (5s dwell will not count) |
| Sockets `view-updated` | **Already emitted** after counted views |
| Likes | **Out of scope** for this doc — views ≠ likes |

**No blocking BE work** for the contract you listed. Align FE thresholds + always honor `data.counted`.

---

## 1. Canonical API (confirmed live)

```http
POST /api/content/:contentType/:contentId/view
Content-Type: application/json
Authorization: Bearer <optional>
```

### Path types

| FE path segment | What BE does |
|-----------------|--------------|
| `media` | Canonical for video, music, audio, sermon-as-media, reels |
| `ebook` | Accepted; **normalized → `media`**; thresholds use Media `contentType === "ebook"` |
| `podcast` | Accepted; normalized → `media`; treated as **audio** thresholds |
| `devotional` | Stays on Devotional collection |

**Yes:** keep posting video/music as **`media`**.  
**Yes:** EbookCard may keep `…/ebook/:id/view` — it works.

### Body (accepted as you send)

```json
{
  "durationMs": 3200,
  "progressPct": 28,
  "isComplete": false,
  "source": "feed",
  "deviceId": "device_…",
  "sessionId": "session_…"
}
```

- `progressPct` may be **0–100** (preferred) or 0–1; BE normalizes.
- Anonymous views need **`deviceId` and/or `sessionId`** (or Bearer). If all three missing → `200` + `counted: false` (no bump).

### Response (always)

```json
{
  "success": true,
  "data": {
    "viewCount": 43,
    "hasViewed": true,
    "counted": true
  }
}
```

| Case | HTTP | `counted` | `viewCount` |
|------|------|-----------|-------------|
| Qualifies + new in hour window | 200 | `true` | +1 |
| Qualifies + already counted this hour | 200 | `false` | unchanged |
| Below threshold | 200 | `false` | unchanged |
| Missing content | 404 | — | — |

**FE rule:** only bump local UI when `data.counted === true`. Never treat omitted `counted` as true on our API — we always send the boolean.

---

## 2. Server thresholds (source of truth — do not diverge)

BE **re-validates** every POST. Client pre-filter is UX only.

| Content kind | How BE decides kind | Counted when |
|--------------|---------------------|--------------|
| **Video / reels / live / recording** | Media `contentType` in `videos`, `live`, `recording` (default if unknown) | `durationMs ≥ 3000` **OR** `progressPct ≥ 25` **OR** `isComplete` |
| **Audio / music / podcast** | Media `contentType` in `audio`, `music`, `podcast` **or** path `podcast` | `durationMs ≥ 10000` **OR** `progressPct ≥ 20` **OR** `isComplete` |
| **Ebook** | Path/type ebook **or** Media `contentType === "ebook"`; devotionals use ebook rules | `durationMs ≥ 10000` **OR** `progressPct ≥ 10` **OR** `isComplete` |

**Dedupe:** 1 counted view per **(user XOR device/session)** per content per **rolling hour**.

**Copyright-free** stays separate: `POST /api/audio/copyright-free/:songId/view` (auth required) — do not mix.

---

## 3. What FE must change

### 3.1 MusicCard / audio (`useMusicViewTracking.ts`)

| Today (FE) | Required |
|------------|----------|
| Fire at ≥3s or ≥25% | Fire at **≥10s or ≥20%** (or complete) before POST, **or** POST early but **ignore UI bump unless `counted: true`** |

Preferred: don’t POST until 10s/20% so you don’t spam + confuse analytics.  
Also: if you currently bump store when `counted === false`, **stop** — that is a FE bug.

### 3.2 EbookCard (`useEbookViewTracking.ts`)

| Today (FE) | Required |
|------------|----------|
| 5s after mount, `progressPct: 0` | Will almost always get **`counted: false`** |

Pick one:

1. **Card dwell ≥ 10s** then POST with `durationMs ≥ 10000`, or  
2. **PdfViewer / reader:** POST when read time ≥10s or progress ≥10%.

Until then, don’t expect the view badge to move from ebook card dwell alone.

### 3.3 Video / Reels

Keep **3s / 25% / complete** — already matches BE. Keep reading `counted`.

### 3.4 Always

```ts
const counted = res.data?.counted === true; // strict
const viewCount = res.data?.viewCount ?? 0;
if (counted) {
  // update store / badge from viewCount
}
// if !counted → leave badge alone (do not +1 locally)
```

---

## 4. Realtime

After a **counted** view, BE emits:

```ts
// rooms: content:media:<id>, content:<id>
"view-updated" → { contentId, contentType, viewCount, timestamp }
```

Also: `content:viewCountUpdated` (same payload).  
Wire `view-updated` as you already planned. No change required on BE.

---

## 5. Hydration (icons / badges)

Feed list already includes `viewCount` (Redis-overlaid). Paint views with the card — don’t wait on batch-metadata. See [FRONTEND_FEED_ENGAGEMENT_HANDOFF.md](./FRONTEND_FEED_ENGAGEMENT_HANDOFF.md).

---

## 6. Corroboration checklist (sign-off)

### Contract — BE confirmed

- [x] `POST /api/content/media/:id/view` → 200 + `data.counted` + `data.viewCount`
- [x] `POST /api/content/ebook/:id/view` → same (normalized to media)
- [x] Optional Bearer; anonymous + `deviceId`/`sessionId` works
- [x] `source: "feed" | "reels"` accepted
- [x] Never decrement `viewCount`
- [x] Hourly dedupe; below threshold → `counted: false`
- [x] Emit `view-updated` after counted views

### FE action items

- [ ] Align **audio** to **10s / 20% / complete**
- [ ] Align **ebook** to **10s / 10%** (or reader progress) — drop bare 5s dwell as counting trigger
- [ ] Only update UI when **`counted === true`**
- [ ] Keep video/reels at 3s / 25%
- [ ] Keep path `media` for video/music; `ebook` OK for books
- [ ] Copyright-free views stay on `/api/audio/copyright-free/...` only

### Out of scope (OK to leave)

- Sermon/Video category local-only +1
- Live concurrent `viewer-count-update`
- Dead `/api/media/interactions/:id/view`

---

## 7. Curl smoke (local)

```bash
BASE=http://127.0.0.1:4000
CONTENT_ID="<media ObjectId>"

# Video-style (should count if media is video)
curl -s -X POST "$BASE/api/content/media/$CONTENT_ID/view" \
  -H "Content-Type: application/json" \
  -d '{"durationMs":5000,"progressPct":30,"isComplete":false,"source":"feed","deviceId":"device_test","sessionId":"session_test"}'

# Immediate repeat → counted: false
curl -s -X POST "$BASE/api/content/media/$CONTENT_ID/view" \
  -H "Content-Type: application/json" \
  -d '{"durationMs":5000,"progressPct":30,"isComplete":false,"source":"feed","deviceId":"device_test","sessionId":"session_test"}'
```

---

## 8. One-line product policy

**Video is cheap to qualify (3s); audio and ebooks need a real listen/read (10s).**  
FE should match that — not ask BE to inflate vanity views.
