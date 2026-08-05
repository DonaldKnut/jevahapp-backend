# Content Guardian

Local, AI-optional gospel moderation for Jevah uploads. Clear Christian content **auto-approves and publishes**; off-theme or unsafe content is **rejected**. Gemini is used only for **gray-zone** cases.

## Architecture

1. Worker extracts evidence (FFmpeg frames + audio clips) — existing pipeline
2. Transcription prefers **Content Guardian Whisper** (`POST /v1/transcribe`), then Google STT / Gemini
3. Node calls Guardian `POST /v1/score` (lexicons + NudeNet + CLIP)
4. Node `gospelFusion` applies business rules → approve / reject / review
5. Only `review` escalates to Gemini (if key + budget), else offline heuristics / admin queue

Approved media continues through the existing pipeline (`mediaModerate` → publish) and appears in the feed with **no admin action**.

## Run locally

```bash
# Terminal A — Guardian (Python 3.11+)
cd services/content-guardian
python -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8091

# Or from repo root:
npm run guardian:dev
```

```bash
# Terminal B — API / worker
CONTENT_GUARDIAN_URL=http://127.0.0.1:8091
MODERATION_FUSION_MODE=guardian_first
npm run worker:dev
```

### Docker Compose

```bash
docker compose up -d content-guardian
# app + worker already get CONTENT_GUARDIAN_URL=http://content-guardian:8091
```

Health: `GET http://127.0.0.1:8091/health`  
Admin metrics include `moderation.guardianOk` on `GET /api/metrics` (admin JWT).

## Env

| Variable | Default | Meaning |
|----------|---------|---------|
| `CONTENT_GUARDIAN_URL` | — | Base URL; unset = skip Guardian |
| `CONTENT_GUARDIAN_TIMEOUT_MS` | `120000` | Score/transcribe timeout |
| `MODERATION_FUSION_MODE` | `guardian_first` | `guardian_first` \| `gemini_first` \| `offline_only` |
| `FUSION_*` | see `env.example` | Approve/reject thresholds |
| `GUARDIAN_ENABLE_WHISPER` | `true` | faster-whisper STT |
| `GUARDIAN_ENABLE_NUDENET` | `true` | NSFW vision |
| `GUARDIAN_ENABLE_CLIP` | `true` | Church vs club scenes |
| `GUARDIAN_WHISPER_MODEL` | `base` | CPU-friendly Whisper size |

## Decision policy (summary)

| Condition | Action |
|-----------|--------|
| Hard blocklist / NSFW ≥ 0.65 | **reject** |
| Church scene + gospel text, safe NSFW | **approve** (auto publish) |
| Strong gospel text, safe vision | **approve** |
| Weak gospel + secular/anti-gospel | **reject** |
| Everything else | **review** → Gemini → offline / admin |

## Tests

```bash
npm run test:moderation-fusion
npm run guardian:test   # lexicon/fusion pytest (no torch required if using requirements-dev.txt)
```

Python CI-light:

```bash
cd services/content-guardian
pip install -r requirements-dev.txt
python -m pytest -q
```

## Providers on ModerationCase

- `content-guardian` — primary clear decisions
- `google-gemini` — gray-zone AI
- `offline` — blocklist / provisional gospel / quarantine

## Ops notes

- First request may be slow (model download/load). Warm with `GET /health` then a tiny `/v1/score`.
- If Guardian is down, circuit opens after 3 failures (60s); Node falls through to Gemini/offline and **never silent-approves** secular content.
- Contabo/VPS: keep Whisper on `base` + `int8`; expect multi‑GB RAM for CLIP + NudeNet.
