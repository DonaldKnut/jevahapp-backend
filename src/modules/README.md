# API Modules

Routes are grouped by **domain** under `src/modules/`. Each module either:
- **Re-exports** route handlers from `src/routes/` (most modules), or
- **Owns its implementation** inside the module folder (e.g. `health` has `modules/health/routes.ts`).

## Structure

- **`index.ts`** – Central registrar. Imports all modules and mounts them via `registerModules(app)`.
- **`<domain>/index.ts`** – Per-domain entry. Either exports:
  - `{ path, router }` for a single mount, or
  - `{ mounts: [{ path, router }, ...] }` for multiple mounts.
- **`<domain>/routes.ts`** (optional) – When a module is fully modularized, routes live here and use imports like `../../utils/logger`, `../../models/...`.

## Current modules

| Module       | Paths |
|-------------|--------|
| auth        | `/api/auth` |
| users       | `/api/users`, `/api/user/profile`, `/api/user-profiles`, `/api` (user content) |
| media       | `/api/media` (×3), `/api/enhanced-media` |
| admin       | `/api/admin` (×2), `/api/logs` |
| content     | `/api/interactions`, `/api/content`, `/api/bookmark`, `/api/bookmarks` |
| bible       | `/api/bible`, `/api/bible-facts` |
| community   | `/api/community`, `/api/comments` |
| location    | `/api/location`, `/api` (places, churches) |
| notifications | `/api/notifications`, `/api/push-notifications` |
| ai          | `/api/ai-chatbot`, `/api/ai-reengagement` |
| engagement  | `/api/trending`, `/api/analytics` |
| devotionals | `/api/devotionals` |
| games       | `/api/games` |
| payment     | `/api/payment` |
| merchandise | `/api/merchandise` |
| hymns       | `/api/hymns` |
| ebooks      | `/api/ebooks`, `/api/tts` |
| playlists   | `/api/playlists` |
| audio       | `/api/audio` |
| search      | `/api/search` |
| health      | `/api/health` (implementation in `modules/health/routes.ts`) |
| metrics     | `/api/metrics` |

## Fully modularized modules

- **health** – Routes live in `modules/health/routes.ts`; no dependency on `src/routes/health.routes.ts`.

To fully modularize another module: create `<module>/routes.ts` (and optionally `controllers/`, `services/`), fix imports to use `../../` for shared code, then point `<module>/index.ts` at `./routes` instead of `../../routes/...`. You can delete or keep the old file in `src/routes/` once nothing else imports it.

## Adding a new module

1. Create `src/modules/<name>/index.ts`.
2. Export either `{ path, router }` or `{ mounts }` (see existing modules).
3. In `src/modules/index.ts`, add:
   - `import * as <name> from "./<name>";`
   - Add `<name>` to the `modules` array.

Route handlers stay in `src/routes/`; controllers, services, and models stay in `src/controllers/`, `src/service/`, `src/models/`. Moving those into each module is an optional later step.
