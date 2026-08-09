# Frontend handoff — fix web login (`Route not found` / CORS)

**Date:** 2026-08-05  
**Audience:** Web app at [https://www.jevahapp.com/login](https://www.jevahapp.com/login) (Vite or Next)  
**Backend:** Contabo `https://api.jevahapp.com` — CORS is already fixed  

**Status:** Backend is healthy. The browser is calling the **wrong path**.

---

## 1. What is broken (observed)

Browser network tab:

```text
POST/OPTIONS  https://api.jevahapp.com/auth/login   ← WRONG (404)
```

Correct path:

```text
POST/OPTIONS  https://api.jevahapp.com/api/auth/login   ← RIGHT
```

Symptoms you saw:

- UI: “Sign in failed / Route not found”
- Console: CORS preflight failed (no `Access-Control-Allow-Origin`)
- Then: `404 Not Found`

CORS looked broken because nginx/Express 404 on `/auth/login` often returns **without** CORS headers. The real bug is the missing `/api` segment.

Backend proof (already passed on Contabo):

```bash
curl -i -X OPTIONS https://api.jevahapp.com/api/auth/login \
  -H "Origin: https://www.jevahapp.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,authorization"
# → 204 + Access-Control-Allow-Origin: https://www.jevahapp.com
```

---

## 2. What you must change

### Option A (recommended) — API base includes `/api`

Env (production):

```env
# Vite
VITE_API_URL=https://api.jevahapp.com/api

# Next.js
NEXT_PUBLIC_API_URL=https://api.jevahapp.com/api
```

Client code pattern:

```ts
const API = import.meta.env.VITE_API_URL; // or process.env.NEXT_PUBLIC_API_URL
await fetch(`${API}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include", // if you use refresh cookies
  body: JSON.stringify({ email, password, rememberMe }),
});
```

Final URL must be: `https://api.jevahapp.com/api/auth/login`

### Option B — origin only, paths include `/api`

```env
VITE_API_URL=https://api.jevahapp.com
# or NEXT_PUBLIC_API_URL=https://api.jevahapp.com
```

```ts
await fetch(`${API}/api/auth/login`, { ... });
```

**Pick one style and use it everywhere.** Mixing A + B causes `…/api/api/auth/login`.

### Rules

| Do | Don’t |
|----|--------|
| No trailing slash on env value | `https://api.jevahapp.com/api/` |
| Rebuild + redeploy after env change | Expect browser refresh alone to fix it |
| Same base for login, me, refresh, media, CF | Hardcode `api.jevahapp.com/auth/...` |

---

## 3. Auth paths (copy-paste)

All relative to base **with** `/api` (Option A):

| Action | Method | Path |
|--------|--------|------|
| Login | POST | `/auth/login` |
| Me | GET | `/auth/me` |
| Refresh | POST | `/auth/refresh` |
| Logout | POST | `/auth/logout` |
| Register | POST | `/auth/register` **or** `/register` |
| Forgot password | POST | `/auth/forgot-password` |
| Reset password | POST | `/auth/reset-password` |

### Login body

```json
{ "email": "user@example.com", "password": "…", "rememberMe": true }
```

### Login success (shape)

```json
{
  "success": true,
  "token": "<jwt>",
  "accessToken": "<jwt>",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": { "id": "…", "email": "…", "role": "…" }
}
```

Send on later calls:

```http
Authorization: Bearer <accessToken>
```

---

## 4. FE checklist

- [ ] Find where `API_URL` / `VITE_API_URL` / `NEXT_PUBLIC_API_URL` is set (Vercel/Netlify/hosting dashboard **and** local `.env`)
- [ ] Set value so final login URL is `https://api.jevahapp.com/api/auth/login`
- [ ] Grep the repo for `api.jevahapp.com/auth` and `/auth/login` — fix any path missing `/api`
- [ ] Redeploy web app
- [ ] Hard refresh login page → Network tab shows `/api/auth/login` → **200**, not 404
- [ ] After login, boot session with `GET /api/auth/me` (or `${API}/auth/me` under Option A)

---

## 5. Local / LAN (optional)

```env
VITE_API_URL=http://192.168.x.x:4000/api
# or http://localhost:4000/api
```

Backend already allows `https://www.jevahapp.com` via CORS.

---

## 6. Out of scope (backend already done)

- CORS throwing 500 on Origin — **fixed and deployed**
- CF view/like rate limits and `counted` contract — see [FRONTEND_CF_MUSIC_PLAYER_HANDOFF.md](./FRONTEND_CF_MUSIC_PLAYER_HANDOFF.md)
- Full admin path map — see [FRONTEND_NEXT_ADMIN_HANDOFF.md](./FRONTEND_NEXT_ADMIN_HANDOFF.md) (**update its env example to include `/api` if using Option A**)
