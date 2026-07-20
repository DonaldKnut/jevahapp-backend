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

## Backend protections (shipped)

| Action | Rule |
|--------|------|
| `PATCH /api/admin/users/:id/role` | **Only** master admin |
| Demote master | Blocked |
| Ban master | Blocked |
| Ban other admins | Master only |
| Delete master | Blocked |
| Login / `GET /api/auth/me` | `user.isMasterAdmin: true` |

Config: `src/config/superAdmin.ts` · env `SUPER_ADMIN_EMAIL`.

## Frontend alignment

- Keep login allowlist defaulting to `support@jevahapp.com`
- Prefer `user.isMasterAdmin` from API for “can change roles” UI
- Still gate `/admin/*` on `role === "admin"`; master is a stronger subset
