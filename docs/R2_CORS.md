# R2 CORS — required for web/mobile Track uploads

Presigned `PUT` uploads go **browser/app → R2 directly**. API CORS on `api.jevahapp.com` can be fine while the file PUT still fails.

Live symptom on `https://www.jevahapp.com`: upload dies at ~10% with

```
Access to XMLHttpRequest at 'https://….r2.cloudflarestorage.com/…'
from origin 'https://www.jevahapp.com' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

OPTIONS to R2 often shows **404**. Vite can proxy localhost only. Production talks to R2.

This is **bucket CORS**, not Express CORS.

## 1. Bucket CORS (Cloudflare dashboard — required)

R2 → `jevah` bucket → **Settings → CORS policy**. Save this (or merge):

```json
[
  {
    "AllowedOrigins": [
      "https://www.jevahapp.com",
      "https://jevahapp.com",
      "https://admin.jevahapp.com",
      "https://creators.jevahapp.com",
      "http://localhost:5173",
      "http://localhost:4173",
      "http://localhost:8081",
      "http://localhost:19006"
    ],
    "AllowedMethods": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Location", "x-amz-request-id"],
    "MaxAgeSeconds": 86400
  }
]
```

`AllowedHeaders: ["*"]` is the safe choice. If you prefer an explicit list:

```
content-type
content-length
content-md5
x-amz-checksum-crc32
x-amz-sdk-checksum-algorithm
x-amz-*
```

Wait about a minute, hard-refresh Creator Studio, retry **Publish songs**.

### Apply via Wrangler

```bash
npx wrangler r2 bucket cors put jevah --file docs/r2-cors.json
```

### Apply via S3 API

Use `PutBucketCors` against `R2_ENDPOINT` with the same JSON.

## 2. Presign without checksums (backend)

AWS SDK v3 signs flexible CRC32 by default. The server never has the file bytes, so the query becomes `x-amz-checksum-crc32=AAAAAA==` and the PUT fails **after** CORS is fixed.

Our R2 client uses `requestChecksumCalculation: "WHEN_REQUIRED"` (see `createR2S3Client`). Browser intents:

- Do **not** attach `x-amz-checksum-crc32` / `x-amz-sdk-checksum-algorithm`
- Return `headers` / `uploadHeaders`: `{ "Content-Type": "audio/mpeg" }`
- Expire in 15 minutes (`TRACK_PRESIGN_EXPIRES_SEC = 900`)

AWS SDK v3 often signs `content-length;host` only on a body-less PUT. The browser must still send `Content-Type` from `headers` so R2 stores `audio/mpeg`.

## 3. Smoke

1. Apply bucket CORS.
2. Issue a new upload-intent. The `putUrl` must **not** contain `x-amz-checksum`.
3. From `https://www.jevahapp.com` DevTools → Network: OPTIONS to R2 is **200** with `Access-Control-Allow-Origin: https://www.jevahapp.com`.
4. PUT is **200**.
5. Finalize the track as today.

Until bucket CORS lands, production Studio publish will keep failing at 10% even with the checksum fix. Localhost can still work via the Vite `/__r2` proxy.

## Env

See `env.example`: `R2_*`, optional `TRACK_AUTO_APPROVE_VERIFIED`, `TRACK_AI_REVIEW`.
