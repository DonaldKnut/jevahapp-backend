# R2 CORS — required for mobile/web Track uploads

Presigned `PUT` uploads go **browser/app → R2 directly**. If CORS is missing, intent succeeds but the PUT fails (opaque network / CORS error).

## Required bucket CORS (Cloudflare R2)

Allow your Expo / Vite origins (and `*` only for local debug):

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:8081",
      "http://localhost:19006",
      "http://localhost:5173",
      "https://admin.jevahapp.com",
      "https://creators.jevahapp.com"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Content-Length", "x-amz-*"],
    "ExposeHeaders": ["ETag", "Location"],
    "MaxAgeSeconds": 3600
  }
]
```

### Apply via Wrangler

```bash
npx wrangler r2 bucket cors put YOUR_BUCKET_NAME --file r2-cors.json
```

### Apply via S3 API

Use `PutBucketCors` against `R2_ENDPOINT` with the same JSON.

## Checklist

- [ ] Staging bucket CORS includes Expo/dev origins
- [ ] Production bucket CORS includes production web + any custom schemes you use
- [ ] Presign uses exact `Content-Type` the client sends (our API returns `uploadHeaders`)
- [ ] Smoke: intent → PUT → HEAD/finalize

## Env

See `env.example`: `R2_*`, optional `TRACK_AUTO_APPROVE_VERIFIED`, `TRACK_AI_REVIEW`.
