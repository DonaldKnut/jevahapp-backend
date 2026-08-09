# Advanced content verification (Media + ebooks + creator audio)

**Date:** 2026-08-09  
**Audience:** Contabo ops + FE  
**Stack:** Content Guardian (Whisper + NudeNet + CLIP + lexicons) — no new Torch models

---

## What changed

### Media fail-soft (must-fix)
| Before | After |
|--------|--------|
| Vision down → NSFW 0 → possible auto-approve | Vision soft-fail → **quarantine / gray** |
| Soft blocklist could still Guardian-approve | Soft blocklist → **force review** |
| Offline provisional approve default ON | Default **OFF** (`MODERATION_OFFLINE_PROVISIONAL_APPROVE=true` to opt in) |

### Ebooks
- PDF/EPUB extract walks **more of the book** (up to ~400k chars raw)
- **7–9 distributed windows** (~18–24k chars) scored by Guardian text lexicons
- Scanned/empty OCR → still below `minTextChars` → quarantine (human)

### Creator / Artists audio
- New Guardian `POST /v1/score-audio` — Whisper STT + gospel lexicon
- Finalize samples first ~8MB of track audio (Range request)
- Verified artists **also scanned** unless `TRACK_VERIFIED_SKIP_AUDIO=true`
- Fallback: metadata Guardian → Gemini → admin queue

---

## Contabo ops

```bash
# Keep Guardian running (already on Contabo if used for Media)
# CONTENT_GUARDIAN_URL=http://127.0.0.1:8091

# Safer defaults — leave provisional OFF
# MODERATION_OFFLINE_PROVISIONAL_APPROVE=true   # only if you want offline auto-approve

# Optional creator audio knobs
# TRACK_GUARDIAN_AUDIO=false          # disable audio STT path
# TRACK_GUARDIAN_MAX_BYTES=8388608
# TRACK_VERIFIED_SKIP_AUDIO=true      # skip STT for verified artists only
```

Restart after pull:
```bash
pm2 restart backend --update-env
# restart content-guardian if you run it as a process
```

---

## Not claimed (still)

Deepfake, CSAM classifiers, full OCR for image-only PDFs, industry audio NSFW models. Gospel Contabo product — Guardian + human queue is the bar.
