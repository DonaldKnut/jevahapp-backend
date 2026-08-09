# Auth session model (mobile + web)

**Date:** 2026-08-09  
**Audience:** Mobile FE (`jevahapp-frontend`), web FE  
**Backend:** `jevahapp-backend`

---

## Rule

**Backend JWT is the only app session.** Clerk is an OAuth shell (Google/Apple), not the API gate.

```
Email/password ──► POST /api/auth/login ──────────────► TokenUtils.storeAuthToken
OAuth ──► Clerk getToken ──► POST /api/auth/clerk-login ► TokenUtils.storeAuthToken
                                                              │
                                                              ▼
                                            Authorization: Bearer <backend JWT>
```

`verifyToken` on Contabo only accepts JWTs signed with `JWT_SECRET`. Clerk session tokens are **not** valid on `/api/*`.

---

## Canonical APIs (mobile)

| Helper | File | Use |
|--------|------|-----|
| `getSessionToken` / `hasBackendSession` | `app/utils/sessionAuth.ts` | Boot gates, remember-me |
| `TokenUtils.getAuthToken` | `app/utils/tokenUtils.ts` | All HTTP / socket clients |
| `storeSessionToken` / `TokenUtils.storeAuthToken` | same | Login (email + OAuth) |
| `clearBackendSession` / `clearLocalSessionState` | `sessionAuth` / `sessionExpired` | Logout + 401 end-session |

Storage slots (all written together): AsyncStorage `token` + `userToken`, SecureStore `jwt`.

---

## Boot (`app/index.tsx`)

1. If `hasBackendSession()` → Home (do **not** wait on Clerk).
2. Else after Clerk loads → `/auth/login`.
3. Clerk `isSignedIn` alone never grants Home (no backend JWT ⇒ broken APIs).

---

## Logout

Always wipe backend session first, then Clerk `signOut()` when a Clerk session exists:

- Account screen, SessionExpired overlay, `app/auth/Logout.tsx`, `useAuth.signOut`
- Optional: `POST /api/auth/logout` with Bearer (revokes refresh when used)

---

## Feed auth

`useAuthFeed` means “call authenticated feed endpoints” when a backend session (or cached user) exists — not “Clerk signed in”.

For You / music For You / feed events all require `Authorization: Bearer <backend JWT>`.

---

## Backend response contracts

### Email login

```http
POST /api/auth/login
```

```json
{
  "success": true,
  "token": "<jwt>",
  "accessToken": "<jwt>",
  "expiresIn": 604800,
  "tokenType": "bearer",
  "user": { }
}
```

### Clerk bridge (Google/Apple via Clerk)

```http
POST /api/auth/clerk-login
Content-Type: application/json

{ "token": "<clerk session JWT>", "userInfo": { "firstName", "lastName", "avatar"? } }
```

```json
{
  "success": true,
  "token": "<backend jwt>",
  "accessToken": "<backend jwt>",
  "expiresIn": 604800,
  "tokenType": "bearer",
  "user": { },
  "needsAgeSelection": false,
  "isNewUser": false
}
```

Store `token` **or** `accessToken` (same value). Do not store the Clerk token as the API Bearer.

### OAuth alias

```http
POST /api/auth/oauth-login
{ "provider": "google", "token": "<clerk/oauth token>", "userInfo": { } }
```

Same shape: `token` + `accessToken` backend JWT.

---

## Future (true Clerk-only)

Requires backend to accept Clerk JWTs (or a per-request bridge). Until then, do **not** remove `TokenUtils` / backend JWT storage.

---

## FE checklist

- [ ] Boot uses `hasBackendSession()`, not Clerk alone  
- [ ] After Clerk OAuth, call `/api/auth/clerk-login` and store returned JWT  
- [ ] All API/socket clients use `TokenUtils.getAuthToken`  
- [ ] Logout clears backend slots before `Clerk.signOut()`  
- [ ] 401 → clear session + SessionExpired (do not silently retry with Clerk token)  
