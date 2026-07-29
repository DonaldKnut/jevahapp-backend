# Deprecated Endpoints

Do not use these in new frontend code. Shims remain for backward compatibility and return `Deprecation` headers where noted.

## Media engagement (use `/api/content/*`)

| Deprecated | Replacement |
|------------|-------------|
| `POST /api/media/:id/interact` | `POST /api/content/media/:id/view` or `/like` |
| `POST /api/media/:id/track-view` | `POST /api/content/media/:id/view` |
| `POST /api/media/:id/bookmark` | `POST /api/bookmark/:id/toggle` |
| `POST /api/media/interactions/:id/save` | `POST /api/bookmark/:id/toggle` (Deprecation headers) |

**Save / library (canonical):** feed saves use `POST /api/bookmark/:contentId/toggle` + `GET /api/bookmark/user`. Copyright-free saves use `POST /api/audio/copyright-free/:songId/save` + `GET /api/audio/library`. `/api/enhanced-media/library/*` is a separate Library collection API — not the same as bookmarks; do not mix.

## Copyright-free views

| Deprecated | Replacement |
|------------|-------------|
| `POST /api/audio/copyright-free/:songId/playback/track` | `POST /api/audio/copyright-free/:songId/view` |

`/playback/track` has no per-user dedupe and uses a 30s threshold.

## Comments

| Deprecated | Replacement |
|------------|-------------|
| `DELETE /api/interactions/comments/:id` | `DELETE /api/content/comments/:id` |
| `POST /api/interactions/comments/:id/reaction` | `POST /api/content/comments/:id/reaction` (same handler; interactions path kept as alias) |
| `/api/comments/*` | `/api/content/:type/:id/comment(s)` and `/api/content/comments/:id` |
| `GET/POST /api/media/:id/comment(s)` | `/api/content/media/:id/comment(s)` (shim with Deprecation headers) |

## Copyright-free save

Do **not** use `POST /api/bookmark/:songId/toggle` for copyright-free songs. Use `POST /api/audio/copyright-free/:songId/save`.

## Removed route files

These are deleted — do not reference:

- `src/routes/contentInteraction.routes.ts`
- `src/routes/interaction.routes.ts` (orphan duplicate; engagement owns `/api/interactions` via `modules/engagement/routes.ts`)

Engagement mounts via `src/modules/engagement/index.ts` → `routes.ts` + `shared/routeAdapters.ts` at `/api/content`.
