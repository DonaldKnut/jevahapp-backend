# Contabo deploy checklist (after this push)

**When:** You’re ready — run these on Contabo **after** `git pull` of `main`.  
**Goal:** clerk JWT, analytics, lite, Guardian audio, fail-soft moderation all live.

App path (prod): `/var/www/backend`  
PM2: `backend` + `backend-worker`

---

## 1. Pull & build

```bash
cd /var/www/backend
git fetch origin
git checkout main
git pull origin main

npm ci   # or npm install
npm run build
# ensure email templates copied
npm run copy-templates
```

## 2. Env (do **not** bloat RAM)

```bash
# Leave UNSET unless you intentionally run sidecars:
# FEED_RANKER_URL=

# Guardian (required for creator audio STT + strong Media moderation)
CONTENT_GUARDIAN_URL=http://127.0.0.1:8091
CONTENT_GUARDIAN_TIMEOUT_MS=120000
MODERATION_FUSION_MODE=guardian_first

# Safer default — quarantine when Gemini down (do NOT set true unless ops re-scan)
# MODERATION_OFFLINE_PROVISIONAL_APPROVE=true

# Optional creator audio
# TRACK_GUARDIAN_AUDIO=false
# TRACK_VERIFIED_SKIP_AUDIO=true
```

## 3. Restart API + worker

```bash
pm2 restart backend --update-env
pm2 restart backend-worker --update-env
pm2 save
pm2 status
```

## 4. Content Guardian (if used)

```bash
# Example — adjust to how you run it on Contabo
cd /var/www/backend/services/content-guardian
# .venv + uvicorn app.main:app --host 127.0.0.1 --port 8091
curl -s http://127.0.0.1:8091/health | jq .
# Expect whisper + vision status; softFailRisk if both vision models down
```

Creator audio STT **only works if Guardian is up** (`/v1/score-audio`).

## 5. Smoke (from laptop or Contabo)

```bash
BASE=https://api.jevahapp.com/api
TOKEN="<user JWT>"
ADMIN="<admin JWT>"

# Auth — clerk-login must return accessToken
# Email login
curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"…","password":"…"}' | jq '{token:(.accessToken//.token|type),user:.user.email}'

# For You lite
curl -s "$BASE/feed/for-you?profile=lite&limit=8" -H "Authorization: Bearer $TOKEN" \
  -H "X-Jevah-Client: lite" | jq '.data|{profile,n:(.items|length),lite:(.items[0].lite)}'

# Chronological lite
curl -s "$BASE/media/all-content?profile=lite&limit=8" -H "Authorization: Bearer $TOKEN" \
  | jq '.data|{profile,n:(.media|length)}'

# Music for you lite
curl -s "$BASE/feed/music-for-you?profile=lite&lane=artist&limit=8" \
  -H "Authorization: Bearer $TOKEN" | jq '.data|{profile,n:(.tracks|length)}'

# Creator analytics
curl -s "$BASE/creators/me/analytics?rangeDays=30" -H "Authorization: Bearer $TOKEN" \
  | jq '.data|{totalListens,uniqueListeners,focusHint}'

# Metrics / Guardian
curl -s "$BASE/../metrics" -H "Authorization: Bearer $ADMIN" 2>/dev/null || true
# Use your actual metrics path if mounted under /api/metrics
curl -s "https://api.jevahapp.com/api/metrics" -H "Authorization: Bearer $ADMIN" \
  | jq '.moderation|{guardianOk,visionHint,offlineProvisionalApprove}'

# Report preview (admin)
# GET /api/admin/reports/media/:reportId → data.media.preview.mediaUrl
```

## 6. RAM check

```bash
free -h
pm2 monit   # or pm2 show backend
```

Leave `FEED_RANKER_URL` unset. Don’t start Torch sidecars you don’t need.

---

**Yes — do Contabo when this commit is on `main`.** Backend work lands first; you deploy + smoke.
