# Master admin (support@jevahapp.com)

Backend counterpart to the web console’s master-account rules.

## Seed into Mongo

Password is **never** committed. Pass it only at seed time:

```bash
# From jevahapp-backend (ensure MONGODB_URI in .env)
SUPER_ADMIN_PASSWORD='your-strong-password-here' npm run seed:super-admin

# If the user already exists and you only want to restore role/flags:
SUPER_ADMIN_PASSWORD='…' npm run seed:super-admin -- --keep-password
```

Creates / updates:

| Field | Value |
|-------|--------|
| `email` | `support@jevahapp.com` (or `SUPER_ADMIN_EMAIL`) |
| `role` | `admin` |
| `isEmailVerified` | `true` |
| `isBanned` | `false` |
| `password` | bcrypt hash of `SUPER_ADMIN_PASSWORD` |

Then sign in at the web `/login` with that email + password.

## Demo Creator Studio (artist)

`support@jevahapp.com` stays **admin**. Creator Studio needs `role: artist`.

```bash
CREATOR_SEED_PASSWORD='your-strong-password' npm run seed:demo-creator
```

Default login: `creator@jevahapp.com` (active verified Artist + one demo track). Open `/creators` or `/creators/studio`, not `/admin`.


## Backend protections (shipped)

| Action | Rule |
|--------|------|
| `PATCH /api/admin/users/:id/role` | **Only** master admin |
| Demote master | Blocked |
| Ban master | Blocked |
| Ban / unban other admins | Master only |
| Delete master | Blocked |
| Delete other admins | Master only |
| Banned account login | `403` `Account is banned` (+ `banReason` / `banUntil`) — same as `verifyToken` |
| Login / `GET /api/auth/me` | `user.isMasterAdmin: true`; `/me` also returns `isBanned` |

Config: `src/config/superAdmin.ts` · env `SUPER_ADMIN_EMAIL`.

## Frontend alignment

- Keep login allowlist defaulting to `support@jevahapp.com`
- Prefer `user.isMasterAdmin` from API for “can change roles” UI
- Still gate `/admin/*` on `role === "admin"`; master is a stronger subset
