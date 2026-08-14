# Backend handoff — Creator Studio analytics

**Date:** 2026-08-09  
**Audience:** web Creator Studio (`/creators/studio`) + mobile  
**Status:** **Shipped** — `GET /api/creators/me/analytics`

---

## Endpoint

```http
GET /api/creators/me/analytics?rangeDays=28
Authorization: Bearer <creator JWT>
```

Per-track:

```http
GET /api/creators/me/analytics/tracks/:trackId?rangeDays=28
```

`rangeDays`: `7` | `28` | `90` (clamped 1–90, default **28**; `30` still accepted).

| Status | When |
|--------|------|
| 200 | Artist profile exists (zeros OK if no tracks yet) |
| 401 | Missing JWT |
| 403 | Banned |
| 404 | No `Artist` for user — FE soft-falls to catalog `playCount` |

---

## Response shape

Matches FE `CreatorAnalyticsDashboard` contract: `totalListens`, `uniqueListeners`, `monthlyListeners` (always last 28 days), `followers`, `completes`, `likes`, `saves`, `avgWatchPct`, `topRegions[]`, `focusHint`, `topTracks[]` (`coverUrl`, `skipRate`), `timeseries[]`, `sources[]`.

Studio preview / admin inspect plays (`source=studio_preview|admin|inspect`) are excluded. See [FRONTEND_CREATOR_STUDIO_HANDOFF.md](./FRONTEND_CREATOR_STUDIO_HANDOFF.md).

---

## Data sources (Contabo-safe)

| Metric | Source |
|--------|--------|
| `likes` / `saves` / top track listens | `copyrightfreesongs` counters (`lane: artist`) |
| `uniqueListeners` / `completes` / `avgWatchPct` | `copyrightfreesonginteractions` |
| `timeseries` + range `totalListens` | `feedevents` (`watch_time` / `impression`) in window; if empty → catalog play+view sum |
| `topRegions` | Interaction `countryCode` (stamped from `CF-IPCountry` on qualified CF views). Empty until geo accumulates |

No lat/lng from FE. Coarse country only. Caps: 10 regions, 20 tracks.

---

## Smoke

```bash
BASE=https://api.jevahapp.com/api
TOKEN="<creator JWT>"

curl -s "$BASE/creators/me/analytics?rangeDays=30" \
  -H "Authorization: Bearer $TOKEN" | jq '.data|{totalListens,uniqueListeners,nRegions:(.topRegions|length),focusHint}'
```
