# Like Persistence – Frontend Flow

> **Canonical doc:** [`LIKE_STATE_PERSISTENCE_FRONTEND_GUIDE.md`](../LIKE_STATE_PERSISTENCE_FRONTEND_GUIDE.md)  
> This file exists for frontend integration reference. See the canonical doc for the complete flow, code examples, and checklist.

---

## Summary

1. **Toggle like:** `POST /api/content/:contentType/:contentId/like` with JWT → reconcile `data.liked` and `data.likeCount`.
2. **On feed/list load:** Call `POST /api/content/batch-metadata` with visible content IDs **and** `Authorization: Bearer <JWT>`.
3. **On logout:** Clear interaction cache.
4. **On login/reload:** Re-fetch batch-metadata with auth when lists load.
