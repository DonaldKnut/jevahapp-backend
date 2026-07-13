# Deprecated Endpoints

Do not use these in new frontend code. Shims remain for backward compatibility and return `Deprecation` headers where noted.

## Media engagement (use `/api/content/*`)

| Deprecated | Replacement |
|------------|-------------|
| `POST /api/media/:id/interact` | `POST /api/content/media/:id/view` or `/like` |
| `POST /api/media/:id/track-view` | `POST /api/content/media/:id/view` |
| `POST /api/media/:id/bookmark` | `POST /api/bookmark/:id/toggle` |

## Copyright-free views

| Deprecated | Replacement |
|------------|-------------|
| `POST /api/audio/copyright-free/:songId/playback/track` | `POST /api/audio/copyright-free/:songId/view` |

`/playback/track` has no per-user dedupe and uses a 30s threshold.

## Comments

| Deprecated | Replacement |
|------------|-------------|
| `DELETE /api/interactions/comments/:id` | `DELETE /api/content/comments/:id` |
| `POST /api/interactions/comments/:id/reaction` | Same handler via legacy path (prefer content module) |
| `/api/comments/*` | `/api/content/:type/:id/comments` where possible |

## Copyright-free save

Do **not** use `POST /api/bookmark/:songId/toggle` for copyright-free songs. Use `POST /api/audio/copyright-free/:songId/save`.

## Removed route files

These are deleted — do not reference:

- `src/routes/contentInteraction.routes.ts`
- `src/routes/interaction.routes.ts` (duplicate)

Engagement mounts via `src/modules/engagement/routes.ts` at `/api/content`.
