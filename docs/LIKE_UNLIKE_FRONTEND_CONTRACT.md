# Like/Unlike – Frontend/Backend Contract

> **Canonical doc:** [`LIKE_SYSTEM_FRONTEND_CONTRACT.md`](./LIKE_SYSTEM_FRONTEND_CONTRACT.md)  
> This file exists for frontend integration reference. See the canonical doc for the full contract.

---

## Quick reference

| Endpoint | Auth | Returns `userInteractions.liked` |
|---------|------|----------------------------------|
| `POST /api/content/:contentType/:contentId/like` | Required | N/A (returns `data.liked` in response) |
| `GET /api/content/:contentType/:contentId/metadata` | Optional (required for hasLiked) | ✅ |
| `POST /api/content/batch-metadata` | Optional (required for hasLiked) | ✅ per contentId |

**Response shapes:** See [`LIKE_SYSTEM_FRONTEND_CONTRACT.md`](./LIKE_SYSTEM_FRONTEND_CONTRACT.md).
