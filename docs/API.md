# API Reference

Base path: `/api`  
Auth: `Authorization: Bearer <token>` unless marked **Public**.

---

## Auth — `/api/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/clerk-login` | Public | Clerk SSO login |
| POST | `/oauth-login` | Public | OAuth login |
| POST | `/register` | Public | Email registration |
| POST | `/artist/register` | Public | Artist registration |
| POST | `/login` | Public | Email/password login |
| POST | `/verify-email` | Public | Verify email code |
| POST | `/resend-verification` | Public | Resend verification |
| POST | `/forgot-password` | Public | Request password reset |
| POST | `/reset-password` | Public | Reset password |
| POST | `/complete-profile` | Token | Complete profile |
| GET | `/me` | Token | Current user |
| POST | `/logout` | Token | Logout |
| POST | `/refresh-token` | Cookie | Refresh access token |
| PUT | `/avatar` | Token | Upload avatar |

---

## Users — `/api/users`, `/api/user/profile`, `/api/user-profiles`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users/me` | Token | Current user profile |
| PUT | `/users/me` | Token | Update profile |
| GET | `/users/:id` | Token | User by ID |
| GET | `/user/profile` | Token | Profile settings |
| PUT | `/user/profile` | Token | Update settings |
| GET | `/user-profiles/:userId` | Token | Public profile |
| GET | `/user-profiles/search` | Token | Search users |
| GET | `/user/posts`, `/user/media`, etc. | Token | User content (see `userContent.routes`) |

---

## Engagement — `/api/content`

See [ENGAGEMENT.md](./ENGAGEMENT.md) for full contracts.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/:contentType/:contentId/like` | Token | Toggle like |
| POST | `/:contentType/:contentId/share` | Token | Record share |
| POST | `/:contentType/:contentId/view` | Optional | Record view |
| GET | `/:contentType/:contentId/metadata` | Optional | Single metadata |
| POST | `/batch-metadata` | Optional | Batch metadata |
| GET | `/:contentType/:contentId/likers` | Public | List likers |
| POST | `/:contentType/:contentId/comment` | Token | Add comment |
| GET | `/:contentType/:contentId/comments` | Optional | List comments |
| GET | `/comments/:commentId/replies` | Public | Comment replies |
| PATCH | `/comments/:commentId` | Token | Edit comment |
| DELETE | `/comments/:commentId` | Token | Delete comment |
| POST | `/comments/:commentId/report` | Token | Report comment |
| POST | `/comments/:commentId/hide` | Token | Hide comment |

**contentType:** `media`, `artist`, `merch`, `ebook`, `podcast`, `devotional`

---

## Bookmarks — `/api/bookmark`, `/api/bookmarks`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/:contentId/toggle` | Token | Toggle save (feed `Media` only) |
| GET | `/:contentId/status` | Token | Bookmark status |
| GET | `/user` | Token | User's saved media |
| GET | `/:mediaId/stats` | Public | Bookmark stats |
| POST | `/bulk` | Token | Bulk bookmark |

---

## Legacy interactions — `/api/interactions`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| DELETE | `/comments/:commentId` | Token | Legacy delete |
| POST | `/comments/:commentId/reaction` | Token | Comment reaction |
| GET | `/media/:mediaId/share-urls` | Public | Share URLs |
| GET | `/media/:mediaId/share-stats` | Public | Share stats |
| POST | `/messages/:recipientId` | Token | Send DM |
| GET | `/conversations` | Token | List conversations |
| GET | `/conversations/:id/messages` | Token | Messages |
| DELETE | `/messages/:messageId` | Token | Delete message |

---

## Media — `/api/media`

### Public (no auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/public` | Public media list |
| GET | `/public/all-content` | Global feed |
| GET | `/public/search` | Public search |
| GET | `/public/:id` | Single public media |
| GET | `/default` | Default/onboarding content |

### CRUD (auth required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List media |
| GET | `/all-content` | Global feed (auth) |
| GET | `/search` | Search |
| GET | `/upload-counts` | Upload limits |
| GET | `/:id` | Single media |
| GET | `/:id/stats` | Interaction stats |
| DELETE | `/:id` | Delete media |
| GET | `/refresh-url/:mediaId` | Refresh video URL |
| GET | `/onboarding` | Onboarding content |

### Upload

| Method | Path | Description |
|--------|------|-------------|
| POST | `/upload` | Legacy multipart upload (buffered; lower video ceiling) |
| POST | `/upload/intent` | Create private staging intent + presigned PUT |
| POST | `/upload/:mediaId/finalize` | Verify staging object, enqueue processing (202) |
| DELETE | `/upload/:mediaId` | Abort intent / cleanup staging |
| GET | `/upload/:mediaId/status` | Poll processing / moderation state |
| POST | `/generate-description` | AI description |

**Frontend migration:** prefer staged intent → client SHA-256 of file bytes → direct PUT to storage → finalize with matching checksum. Legacy `POST /upload` remains during migration. Media is **private** (`isHidden`, not `approved`) until moderation + processing mark it `ready` / `approved`. Identical file bytes reuse a prior moderation **decision** only (never another user's storage object).

`checksumSha256` is required on intent creation as 64 lowercase/uppercase hex
characters calculated from the exact source-file bytes. The presigned PUT binds
that checksum (converted to S3's base64 form), and the worker independently
streams/downloads the object and compares SHA-256 before moderation. A mismatch
rejects processing. PUT using the returned URL and the exact `Content-Type` and
file size supplied when creating the intent.

### Engagement (media-specific)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/:mediaId/engagement` | Media + engagement |
| POST | `/:id/interact` | **Deprecated** → `/api/content/.../view` |
| POST | `/:id/track-view` | **Deprecated** → `/api/content/.../view` |
| GET | `/:id/action-status` | Favorite/share status |
| POST | `/viewed` | Add to viewed list |
| GET | `/viewed` | Get viewed list |

### Downloads

| Method | Path | Description |
|--------|------|-------------|
| POST | `/:id/download` | Download media |
| GET | `/:id/download-file` | Stream download |
| GET | `/offline-downloads` | List offline |
| PATCH | `/offline-downloads/:id` | Update status |
| DELETE | `/offline-downloads/:id` | Remove offline |
| GET | `/:id/download-status` | Download status |

### Live stream & recording

| Method | Path | Description |
|--------|------|-------------|
| POST | `/live/start` | Start Mux stream |
| POST | `/live/end` | End stream |
| GET | `/live` | List live streams |
| GET | `/stream/:id/status` | Stream status |
| POST | `/stream/schedule` | Schedule stream |
| GET | `/stream/:id/stats` | Stream stats |
| POST | `/go-live` | Go live |
| POST | `/recording/start` | Start recording |
| POST | `/recording/stop` | Stop recording |
| GET | `/recording/:id/status` | Recording status |
| GET | `/recordings` | User recordings |

### Analytics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/analytics` | Creator dashboard |
| GET | `/analytics/:mediaId` | Per-media analytics |
| GET | `/creator-analytics` | Creator stats |

---

## Enhanced media — `/api/enhanced-media`

Extended media operations (see `enhancedMedia.route.ts`).

---

## Audio & copyright-free — `/api/audio`

### Copyright-free (see [ENGAGEMENT.md](./ENGAGEMENT.md))

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/copyright-free` | Public | List songs |
| GET | `/copyright-free/:songId` | Public | Get song |
| GET | `/copyright-free/:songId/stream` | Public | CDN redirect |
| GET | `/copyright-free/search` | Public | Search |
| GET | `/copyright-free/search/suggestions` | Public | Autocomplete |
| GET | `/copyright-free/search/trending` | Public | Trending |
| GET | `/copyright-free/categories` | Public | Categories |
| POST | `/copyright-free` | Admin | Create song |
| PUT | `/copyright-free/:songId` | Admin | Update |
| DELETE | `/copyright-free/:songId` | Admin | Delete |
| POST | `/copyright-free/:songId/like` | Token | Toggle like |
| POST | `/copyright-free/:songId/view` | Token | Record view |
| POST | `/copyright-free/:songId/share` | Token | Share |
| POST | `/copyright-free/:songId/save` | Token | Toggle save |
| POST | `/copyright-free/:songId/download` | Token | Offline download |
| POST | `/copyright-free/:songId/playback/track` | Token | **Deprecated** |
| GET | `/library` | Token | Saved audio library |

### Playlists (under `/api/audio/playlists`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/playlists` | List user playlists |
| POST | `/playlists` | Create |
| GET | `/playlists/:id` | Get playlist |
| PUT | `/playlists/:id` | Update |
| DELETE | `/playlists/:id` | Delete |
| POST | `/playlists/:id/songs` | Add track |
| DELETE | `/playlists/:id/songs/:songId` | Remove track |
| PUT | `/playlists/:id/songs/reorder` | Reorder |

### Playback sessions

| Method | Path | Description |
|--------|------|-------------|
| POST | `/playback/start` | Start session |
| POST | `/playback/progress` | Update progress |
| POST | `/playback/pause` | Pause |
| POST | `/playback/resume` | Resume |
| POST | `/playback/end` | End session |
| GET | `/playback/history` | History |

---

## Playlists — `/api/playlists`

Same operations as `/api/audio/playlists` (dedicated mount).

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Create |
| GET | `/` | List |
| GET | `/:playlistId` | Get |
| PUT | `/:playlistId` | Update |
| DELETE | `/:playlistId` | Delete |
| POST | `/:playlistId/tracks` | Add track |
| DELETE | `/:playlistId/tracks/:mediaId` | Remove |
| PUT | `/:playlistId/tracks/reorder` | Reorder |
| POST | `/:playlistId/play` | Track play |

---

## Devotionals — `/api/devotionals`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/create-devotional` | Admin/Creator | Create |
| GET | `/devotionals` | Token | List |
| POST | `/devotionals/:id/like` | Token | Toggle like |

---

## Community — `/api/community`, `/api/comments`

Forum, prayer, polls — see `community.routes.ts` and `comment.routes.ts`.

---

## Bible — `/api/bible`, `/api/bible-facts`

Bible search, reading plans, facts — see `bible.routes.ts`.

---

## Games — `/api/games`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List games |
| GET | `/:gameId` | Game detail |
| POST | `/:gameId/start` | Start session |
| POST | `/:gameId/complete` | Complete session |
| GET | `/sessions` | User sessions |
| GET | `/achievements` | Achievements |
| GET | `/stats` | User stats |

---

## Search — `/api/search`

Unified search across content types.

---

## Notifications — `/api/notifications`, `/api/push-notifications`

In-app notifications and push token registration.

---

## Payment — `/api/payment`

Payment processing (see `payment.route.ts`).

---

## Merchandise — `/api/merchandise`

Artist merch (see `merchandise.route.ts`).

---

## Hymns — `/api/hymns`

Hymn library and sync.

---

## Ebooks — `/api/ebooks`, `/api/tts`

Ebook library and text-to-speech.

---

## AI — `/api/ai-chatbot`, `/api/ai-reengagement`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ai-chatbot/info` | Chatbot info |
| POST | `/ai-chatbot/message` | Send message |
| GET | `/ai-chatbot/history` | Chat history |

---

## Admin — `/api/admin`, `/api/logs`

Full contracts: [ADMIN.md](./ADMIN.md) · UI guide: [FRONTEND_ADMIN.md](./FRONTEND_ADMIN.md)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/dashboard/analytics` | Admin | Platform KPIs |
| GET | `/api/admin/dashboard/feed` | Admin | Uploads / review / reports activity feed |
| GET | `/api/admin/users` | Admin | List/filter users (+ online flags) |
| GET | `/api/admin/users/presence` | Admin | Online / offline user list |
| GET | `/api/admin/users/:id` | Admin | User detail |
| POST | `/api/admin/users/:id/ban` | Admin | Ban user |
| POST | `/api/admin/users/:id/unban` | Admin | Unban |
| PATCH | `/api/admin/users/:id/role` | Admin | Change role |
| PATCH | `/api/admin/users/:id/verification` | Admin | Creator/vendor/church/artist flags |
| POST | `/api/admin/email` | Admin | Email users (Resend) |
| GET | `/api/admin/media/recent` | Admin | Recent uploads |
| GET | `/api/admin/reports` | Admin | Unified reports inbox |
| GET | `/api/admin/reports/media/:reportId` | Admin | Media report detail |
| POST | `/api/admin/reports/media/:reportId/review` | Admin | Review media report |
| DELETE | `/api/admin/reports/media/:mediaId/content` | Admin | Delete reported media |
| GET | `/api/admin/reports/comments` | Admin | Comment reports |
| POST | `/api/admin/reports/comments/:commentId/hide` | Admin | Hide comment |
| POST | `/api/admin/reports/comments/:commentId/unhide` | Admin | Unhide comment |
| POST | `/api/admin/reports/comments/:commentId/dismiss` | Admin | Dismiss comment reports |
| GET | `/api/admin/moderation/queue` | Admin | Upload moderation queue (shaped + preview) |
| GET | `/api/admin/moderation/:id` | Admin | Media detail + latest AI case |
| GET | `/api/admin/moderation/:id/case` | Admin | ModerationCase history |
| PATCH | `/api/admin/moderation/:id/status` | Admin | Approve/reject media |
| PATCH | `/api/admin/media/:id` | Admin | Edit title/description/notes |
| DELETE | `/api/admin/media/:id` | Admin | Force-delete media |
| GET | `/api/admin/churches` | Admin | Church catalog (onboarding source) |
| POST | `/api/admin/churches` | Admin | Add church for onboarding |
| PATCH | `/api/admin/churches/:id` | Admin | Update church / contact / listed |
| DELETE | `/api/admin/churches/:id` | Admin | Delete church |
| PATCH | `/api/admin/churches/:id/verification` | Admin | Verify church entity |
| GET | `/api/admin/activity` | Admin | Admin activity log |
| GET | `/api/logs/logs` | Admin | Audit logs |

`POST /api/admin/email` also accepts `churchIds[]` (uses each church’s `contactEmail`).

User report intake (not admin-only): `POST /api/media/:id/report`, `POST /api/content/comments/:commentId/report`.

Full admin UI contracts: [ADMIN.md](./ADMIN.md) · [FRONTEND_MODERATION.md](./FRONTEND_MODERATION.md).

---

## Health & metrics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/metrics` | Prometheus metrics (if enabled) |

---

## Trending & analytics — `/api/trending`, `/api/analytics`

Engagement analytics and trending content (see engagement module mounts).

---

## Interactive docs

Swagger UI: `/api-docs` (when server is running).
