# Frontend upload progress handoff (detect → verify → bar)

**Date:** 2026-08-02  
**Backend:** `jevahapp-backend`  
**Audience:** Mobile upload owners (`app/categories/upload/*`)  
**Goal:** Confirm BE contract for MIME-based uploads + real `upload-progress` + optional poll.

---

## 0. What shipped on backend

| FE ask | Backend |
|--------|---------|
| Honor `X-Upload-ID` | Yes — used as `uploadId` on every socket event + poll |
| Early `received` | Yes (~5%) as soon as multipart is accepted |
| Stages map | Normalized: `received`, `uploading`, `verifying`/`scanning`, `processing`, `finalizing`, `complete` / `rejected` / `error` |
| Monotonic progress | Yes (never regresses mid-flight) |
| Emit `rejected` then HTTP 403 + `moderationResult` | Yes |
| Emit `complete` at 100 with HTTP success | Yes (before response; session kept ~2 min for poll) |
| `GET /api/media/upload/:uploadId/status` | Yes (same path as staged status; UUID → progress, ObjectId → staged media) |
| Thumbnail optional | Yes |
| Response `data` with `_id`, URLs, `duration`, `processingStatus` | Yes (plus legacy `media` object) |

**Password (related):** admins + creators can reset like any user:

| Flow | Path |
|------|------|
| Forgot (all roles) | `POST /api/auth/forgot-password` → code email (no email enumeration) |
| Reset with code | `POST /api/auth/reset-password-with-code` |
| Change while logged in | `POST /api/auth/change-password` `{ currentPassword, newPassword }` |
| Admin reset another user | `POST /api/admin/users/:id/reset-password` `{ newPassword? }` or email reset |

Sessions revoked after password change/reset.

---

## 1. Detection (FE owns; BE re-validates)

Keep FE MIME/extension detection. **Never** infer type from title.

Authoritative on BE: MIME vs `contentType`, size limits (`music` 50MB, `videos`/`sermon` 300MB, `books` 100MB).

Allowed `contentType`: `videos` | `music` | `books` | `sermon` | `live`.

---

## 2. Upload request

```http
POST /api/media/upload
Authorization: Bearer <jwt>
X-Upload-ID: <uuid>          ← REQUIRED for progress correlation
Content-Type: multipart/form-data
```

| Field | Required |
|-------|----------|
| `file` | Yes |
| `thumbnail` | No |
| `title`, `contentType` | Yes |
| `description`, `category`, `topics`, `fileSize`, `duration` | Optional |

Join Socket.IO with the same JWT **before** POST so `user:{userId}` receives events.

---

## 3. Socket event

```ts
socket.on("upload-progress", (evt) => {
  // evt.uploadId === X-Upload-ID
  // evt.progress 0–100 (monotonic)
  // evt.stage, evt.message, evt.timestamp, evt.mediaId?
});
```

| `stage` | FE `status` hint |
|---------|------------------|
| `received` / `uploading` / `finalizing` | `uploading` |
| `verifying` / `scanning` / `processing` | `verifying` |
| `complete` | `success` |
| `rejected` / `error` | `error` |

---

## 4. Poll fallback

```http
GET /api/media/upload/:uploadId/status
Authorization: Bearer <jwt>
```

```json
{
  "success": true,
  "data": {
    "uploadId": "…",
    "progress": 72,
    "stage": "verifying",
    "message": "…",
    "mediaId": null,
    "timestamp": "…"
  }
}
```

Poll every ~800ms if no socket event for ~3s while UI is loading.

---

## 5. Success / reject bodies

**Success (201 or 202 under review):**

```json
{
  "success": true,
  "uploadId": "…",
  "data": {
    "_id": "…",
    "contentType": "videos",
    "title": "…",
    "fileUrl": "…",
    "thumbnailUrl": "…",
    "duration": 123.4,
    "processingStatus": "ready" | "processing" | "pending",
    "hlsUrl": null,
    "moderationStatus": "approved" | "under_review" | "pending"
  }
}
```

If `processingStatus !== "ready"`, keep listening for worker/progress or refetch media — do not assume seek-ready.

**Reject (403):**

```json
{
  "success": false,
  "message": "…",
  "moderationResult": {
    "status": "rejected",
    "reason": "…",
    "flags": ["…"]
  },
  "uploadId": "…"
}
```

---

## 6. FE checklist

- [ ] Always send `X-Upload-ID` (= `createUploadId()`)
- [ ] Connect socket before POST; stop simulated bar on first real event
- [ ] Map stages per §3; treat `complete` as success even if HTTP still in flight
- [ ] Poll §4 if sockets flake
- [ ] Prefer `data` on success; `media` remains for older clients
- [ ] Optional thumbnail OK

---

## 7. Local Redis note (dev)

BullMQ needs **Redis ≥ 5**. If logs show `Current: 3.0.504`, upgrade local Redis (Memurai/WSL Redis 7, or Docker `redis:7`). ioredis may still connect, but queues/progress workers will error until Redis is upgraded.
