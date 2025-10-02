## Frontend Church/Branch Suggestions Integration Guide

Author: Backend Team
Consumers: Mobile/Web Frontend

### Goal

Use a single input (no UI redesign) to fetch church/branch suggestions from the new backend, preferring internal (seeded/verified) data, with optional Mapbox blending.

---

### Endpoint

- GET `/api/places/suggest`

Query params:

- `q: string` (required, min 2)
- `limit?: number` (default 10, max 20)
- `source?: "internal" | "mapbox" | "combined"` (default: `combined`)
- `country?: string` (ISO‑3166, e.g. `NG`)
- `near?: "lat,lng"` (optional proximity boost)
- `churchId?: string` (limit branches to a church)

Example:

```
/api/places/suggest?q=redeemed&limit=10&source=combined&country=NG&near=6.5244,3.3792
```

---

### Response (Normalized Shape)

```json
{
  "success": true,
  "source": "combined",
  "results": [
    {
      "id": "branch_123",
      "type": "branch", // or "church"
      "name": "RCCG City of David",
      "parentChurch": {
        "id": "rccg",
        "name": "The Redeemed Christian Church of God"
      },
      "address": {
        "line1": "Victoria Island",
        "city": "Lagos",
        "state": "Lagos",
        "postalCode": "",
        "countryCode": "NG"
      },
      "location": { "lat": 6.431, "lng": 3.4337 },
      "source": "internal", // "internal" or "mapbox"
      "confidence": 0.91, // 0..1 ranking score
      "distanceMeters": 850, // optional
      "verified": true
    }
  ]
}
```

---

### TypeScript Types (Frontend)

```ts
export type SuggestSource = "internal" | "mapbox";

export interface NormalizedAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
}

export interface NormalizedResult {
  id: string;
  type: "church" | "branch";
  name: string;
  parentChurch?: { id: string; name: string };
  address: NormalizedAddress;
  location?: { lat: number; lng: number };
  source: SuggestSource;
  confidence: number;
  distanceMeters?: number;
  verified?: boolean;
}
```

---

### Minimal Integration (Single Input)

```ts
// Debounced fetch on input changes (React)
import { useEffect, useMemo, useState } from "react";

function useDebounce<T>(value: T, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function useChurchSuggestions(
  q: string,
  near?: { lat: number; lng: number }
) {
  const [items, setItems] = useState<NormalizedResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dq = useDebounce(q.trim(), 250);

  useEffect(() => {
    if (dq.length < 2) {
      setItems([]);
      return;
    }
    const url =
      `/api/places/suggest?q=${encodeURIComponent(dq)}&limit=10&source=combined&country=NG` +
      (near ? `&near=${near.lat},${near.lng}` : "");
    setLoading(true);
    setError(null);
    fetch(url)
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d?.results) ? d.results : []))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [dq, near?.lat, near?.lng]);

  return { items, loading, error };
}
```

Render in your existing dropdown without UI changes:

```tsx
// Example render (React)
{
  items.map(r => (
    <SuggestionRow
      key={`${r.source}:${r.id}`}
      title={r.name}
      subtitle={[
        r.parentChurch?.name,
        r.address?.line1,
        r.address?.city,
        r.address?.state,
      ]
        .filter(Boolean)
        .join(" • ")}
      badge={
        r.verified ? "Verified" : r.source === "mapbox" ? "Map" : undefined
      }
      onPress={() => onSelectSuggestion(r)}
    />
  ));
}
```

On select, store the chosen entity (id + type). If you need details later:

- GET `/api/churches/:id` (returns church + branches)

---

### Behavior Notes

- Internal results are preferred; Mapbox fills gaps when `source=combined`.
- Pass `country=NG` to focus on Nigeria; safe to omit if global.
- Pass `near=lat,lng` (if available) to boost proximity.
- Debounce requests (~250ms) to respect rate limits.
- Handle `429` by backing off (e.g., pause queries for 1–2s).

---

### Error & Empty States

- `<2` characters: do not query; show nothing.
- Network/error: show a small hint and allow retry.
- No results: show CTA "Can’t find it? Add your church" (links to support/admin flow).

---

### QA Checklist

- Typing common Nigerian churches returns internal results first.
- Proximity boosts local branches when `near` provided.
- Mapbox results appear only when internal is sparse.
- Selecting a Mapbox item that matches internal data should snap to the internal id (the backend already de‑dupes; UI just uses the returned id/type).

---

### Postman Quick Tests

```
GET {{API_BASE}}/api/places/suggest?q=glory&limit=10&source=internal&country=NG
GET {{API_BASE}}/api/places/suggest?q=rccg&limit=10&source=combined&country=NG&near=6.5244,3.3792
GET {{API_BASE}}/api/churches/{{CHURCH_ID}}
```

---

### Tips

- If you want to temporarily force only seeded data, use `source=internal`.
- Keep item identity stable with `key={source}:{id}`.
- Cache by `q|nearBucket|country` if you need extra snappiness.
