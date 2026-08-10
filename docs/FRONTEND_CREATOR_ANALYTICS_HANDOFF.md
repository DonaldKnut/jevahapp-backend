# Backend handoff — Creator Studio analytics

**Date:** 2026-08-09  
**Audience:** web Creator Studio (`/creators/studio`) + mobile  
**Status:** **Shipped** — `GET /api/creators/me/analytics`

---

## Endpoint

```http
GET /api/creators/me/analytics?rangeDays=30
Authorization: Bearer <creator JWT>
```

Per-track:

```http
GET /api/creators/me/analytics/tracks/:trackId?rangeDays=30
```

`rangeDays`: `7` | `30` | `90` (clamped 1–90, default 30).

| Status | When |
|--------|------|
| 200 | Artist profile exists (zeros OK if no tracks yet) |
| 401 | Missing JWT |
| 403 | Banned |
| 404 | No `Artist` for user — FE soft-falls to catalog `playCount` |

---

## Response shape

Matches FE `CreatorAnalyticsDashboard` contract: `totalListens`, `uniqueListeners`, `completes`, `likes`, `saves`, `avgWatchPct`, `topRegions[]`, `focusHint`, `topTracks[]`, `timeseries[]`.

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
