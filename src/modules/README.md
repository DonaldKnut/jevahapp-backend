# Modules

One Express app. One PM2 process. Features live under `src/modules/<domain>/`.

`registerModules()` in `index.ts` is the only place that attaches routers to the app.

## When you change a feature

Put the next edit in that domain folder. Do not start a new `src/controllers` or `src/routes` file.

```
src/modules/bible/
  index.ts              # mounts /api/bible
  bible.routes.ts
  bible.controller.ts
  bible.service.ts
  biblePack.ts
  __tests__/
```

Debugging: search `src/modules/<name>`, not the whole repo.

## Do not

- Change `/api/...` paths
- Extract microservices or NestJS
- Move every leftover controller in one PR

## Next candidates (when you next touch them)

`audio`, `users`, `media` — they still re-export `src/routes/*`. Same move as Bible: git mv + shim at the old path.
