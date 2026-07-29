# Frontend handoff — Copyright-free Track upload (Phase 1)

**Date:** 29 July 2026  
**Backend:** `jevahapp-backend`  
**Storage:** Cloudflare R2 (same as media) · max audio **100MB** · cover **5MB**  
**Presign TTL:** 900s

## Artist / minister / podcaster onboarding (product advice shipped as foundation)

**Do not** give every user an upload button. Use one **Creator application** funnel:

1. User taps “Become a creator” → `POST /api/creators/apply` with `creatorTypes: ["artist"|"minister"|"podcaster"]`
2. Status `pending` — no catalog upload yet
3. Admin reviews → `PATCH /api/admin/artists/:id` `{ status: "active", isVerified: true }`
4. User role becomes `artist`; Phase 2 uploads use `lane: "artist"` + `artistId`

**Security:** drafts stay off mobile; only `visibility=published` + `processing=ready` + `lane=curated` hit `GET /api/audio/copyright-free`. Artist-lane upload intents are admin-only in Phase 1.

---

## Admin APIs (new)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/admin/audio/tracks` | `lane`, `search`, `category`, `visibility`, page |
| POST | `/api/admin/audio/tracks/upload-intent` | Returns presigned PUTs |
| POST | `/api/admin/audio/tracks/:trackId/finalize` | `{ publish?: true }` → TrackCard |
| GET/PATCH/DELETE | `/api/admin/audio/tracks/:id` | Hard delete + R2 purge |
| POST | `…/replace-audio/intent` + `/finalize` | Replace file |
| POST | `…/replace-cover/intent` + `/finalize` | Replace artwork |

### Upload flow

1. `POST …/upload-intent` with metadata + `contentType` / `fileSizeBytes` (+ optional cover)
2. Browser `PUT` to `audio.putUrl` (and cover) with `Content-Type` header
3. `POST …/finalize` `{ "publish": true }`
4. Mobile list refreshes → song plays via `playbackUrl` / `fileUrl`

### Legacy (still works)

`POST/PUT/DELETE /api/audio/copyright-free` with URL paste — stores as Track `lane=curated` published.

---

## Mobile (unchanged path)

`GET /api/audio/copyright-free` — only published+ready curated tracks.  
Aliases: `artistName`/`singer`/`artist`, `playbackUrl`/`fileUrl`/`audioUrl`, `durationSec`/`duration`.

Optional: `?search=` · `?updatedSince=ISO`

---

## Track model

Same Mongo collection `copyrightfreesongs` (no second songs table). Added: `lane`, `visibility`, `processing`, `audio.*`, `artwork`, `artistName`, `genre`, `copyrightStatus`, `artistId?`.
