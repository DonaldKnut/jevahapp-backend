# Creator signup — frontend handoff (web + mobile)

**Date:** 2026-09-25  
**Audience:** Web (`www.jevahapp.com/creators/*`) and mobile (iOS / Android)  
**Backend:** `jevahapp-backend` — one `User`, one JWT, one register route  
**Status:** Ready to build UI against. Signup is identity. Apply is a later step.

Related:

- [FRONTEND_CREATOR_APPLY_HANDOFF.md](./FRONTEND_CREATOR_APPLY_HANDOFF.md) — ministry profile after verify
- [FRONTEND_CREATOR_STUDIO_HANDOFF.md](./FRONTEND_CREATOR_STUDIO_HANDOFF.md) — desk after approval
- [FRONTEND_CREATORS.md](./FRONTEND_CREATORS.md) — catalog + hub

---

## 0. Product rule (do not fork this)

| Do | Do not |
|----|--------|
| Call **`POST /api/auth/register`** from web and mobile | Invent `/api/creators/register` or a second user table |
| Treat signup as **identity** (`role: learner`) | Auto-promote `role` to `artist` on register |
| Send them to **apply** after email verify | Merge register + apply into one write |
| Reuse the same `AuthContext` as login | Mint a web-only token mobile cannot use |
| Honor `registrationEnabled` | Show a dead form when registration is paused |

`POST /api/auth/artist/register` is a **legacy** mobile path. Do **not** use it for the new creator funnel. It writes `role: artist` immediately. The scalable path is:

```
register (learner) → verify email → apply → admin Artists queue → Studio
```

One Jevah account. The same email/password works in the app and on the web.

---

## 1. Journey and screens

```
Marketing /creators
    │
    ├─ signed out ──► /creators/signup          NEW
    │                      │
    │                      ├─ 201 + isEmailVerified: false
    │                      │         └─► /creators/verify     OTP waiting UI
    │                      │                  │ resend
    │                      │                  ▼
    │                      └─ 201 + isEmailVerified: true     (staging auto-verify)
    │                                └─► /creators/apply      exists
    │                                         ▼
    │                                   /creators/studio      exists (read-only until approved)
    │
    └─ has account ──► /creators/login          exists
                           │
                           ├─ 422 EMAIL_NOT_VERIFIED ──► /creators/verify
                           └─ 200 ──► apply or studio from nextStep
```

Mobile mirrors the same states inside the existing creator hub (`capabilities.nextStep` on `GET /api/creators/me`).

Do **not** put ministry name, genres, or socials on signup. That is apply.

---

## 2. Base URL and session

| Client | Base | Credentials |
|--------|------|-------------|
| Web | `VITE_API_URL` already includes `/api` (prod: `https://api.jevahapp.com/api`) | `credentials: "include"` + `Authorization: Bearer <accessToken>` |
| Mobile | same `/api` host | Bearer only (no cookie required) |

Every successful **register / login / verify / refresh** returns:

```ts
{
  success: true
  accessToken: string
  token: string          // same value as accessToken — unwrap either
  tokenType: "Bearer"
  expiresIn: number      // seconds
  user: AuthUser
  nextStep?: AuthNextStep
}
```

Persist `accessToken` (web: `localStorage.accessToken`). Refresh cookie is HttpOnly, `Secure` + `SameSite=None` in production so `www.jevahapp.com` can talk to `api.jevahapp.com`.

---

## 3. `user` shape (persist this)

Same object as login. Map it into the existing `AdminUser` / auth store.

```ts
type AuthUser = {
  id: string
  email: string
  firstName?: string
  lastName?: string
  username?: string
  avatar: string | null
  role: string                 // "learner" after register. Not "artist".
  isEmailVerified: boolean
  isBanned: boolean
  isVerifiedArtist: boolean
  isVerifiedCreator: boolean
  createdAt?: string
  nextStep?: AuthNextStep
}

type AuthNextStep =
  | "verify_email"
  | "apply"
  | "wait_review"
  | "studio"
  | "home"
  | "contact_support"
```

### How to branch the UI

| Field | Screen |
|-------|--------|
| `isEmailVerified === false` or `nextStep === "verify_email"` | `/creators/verify` (or mobile OTP sheet) |
| `isBanned === true` | Hard stop + support copy. Do not retry. |
| `nextStep === "apply"` | `/creators/apply` |
| `nextStep === "wait_review"` | Studio with pending banner |
| `nextStep === "studio"` | `/creators/studio` |
| `firstName` | “Welcome, Grace” on verify + apply |

`GET /api/auth/me` now includes `nextStep`. `GET /api/creators/me` remains the source of truth for capability flags (`canApply`, `showPendingBanner`, …).

---

## 4. Endpoints

All paths are relative to `/api`. Register / status / verify / resend / forgot are **public** (`auth: false`) unless noted.

### 4.1 Public gate — call this first on the signup page

```http
GET /api/auth/registration-status
```

```json
{ "success": true, "registrationEnabled": true, "message": null }
```

When admin turns registration off:

```json
{
  "success": true,
  "registrationEnabled": false,
  "message": "New accounts are paused. Sign in if you already have a Jevah account."
}
```

**UI:** hide the form, show a paused panel, link to `/creators/login`.

If someone posts anyway:

`POST /api/auth/register` → **403** `{ code: "REGISTRATION_DISABLED" }`.

### 4.2 Register — web and mobile use this

```http
POST /api/auth/register
Content-Type: application/json
```

```json
{
  "firstName": "Grace",
  "lastName": "Okoye",
  "email": "grace@ministry.com",
  "password": "Correct-horse-battery-1",
  "rememberMe": true,
  "source": "creators_web"
}
```

| Field | Rules | UI |
|-------|--------|-----|
| `firstName` | trim, 1–40 | Required |
| `lastName` | trim, 1–40 | Required |
| `email` | valid, stored lowercased | Required |
| `password` | see §6 | Required |
| `rememberMe` | boolean, default false | Same refresh lifetime as login |
| `source` | optional telemetry | Web: `creators_web`. Mobile: `ios` / `android` |

Do **not** send username, phone, avatar, genres, or creator type.

**201**

```json
{
  "success": true,
  "accessToken": "eyJ…",
  "token": "eyJ…",
  "tokenType": "Bearer",
  "expiresIn": 604800,
  "user": {
    "id": "…",
    "email": "grace@ministry.com",
    "firstName": "Grace",
    "lastName": "Okoye",
    "role": "learner",
    "isEmailVerified": false,
    "isBanned": false,
    "createdAt": "2026-09-25T16:00:00.000Z",
    "nextStep": "verify_email"
  },
  "nextStep": "verify_email",
  "message": "Account created. Check your email to verify."
}
```

If the environment auto-verifies (`AUTH_AUTO_VERIFY_EMAIL=true` on a staging API), `isEmailVerified` is `true` and `nextStep` is `"apply"`. Branch on those two fields — do not hard-code “always show OTP”.

### 4.3 Verify email — OTP first (preferred)

```http
POST /api/auth/verify-email
Content-Type: application/json
```

Public:

```json
{ "email": "grace@ministry.com", "code": "482193" }
```

If they already have the register session:

```http
POST /api/auth/verify-email
Authorization: Bearer <accessToken>
```

```json
{ "code": "482193" }
```

**200** — same envelope as login, `user.isEmailVerified: true`, `nextStep: "apply"`.

### 4.4 Magic link (mail clients)

```http
GET /api/auth/verify-email?token=…
```

Redirects to:

- `https://www.jevahapp.com/creators/verify?status=ok`
- or `…/creators/verify?status=expired`

The API sets the refresh cookie on success when it can. The waiting page should still tolerate “open mail on phone, finish on desktop” by asking them to sign in if `/auth/me` is empty.

### 4.5 Resend

```http
POST /api/auth/resend-verification
Content-Type: application/json
```

```json
{ "email": "grace@ministry.com" }
```

**Always 200** (does not leak whether the email exists):

```json
{
  "success": true,
  "message": "If an account needs verification, we sent a new code.",
  "retryAfterSec": 60
}
```

Disable the Resend button using `retryAfterSec` and the `Retry-After` header. Alias `POST /api/auth/resend-verification-email` still works for older mobile builds.

### 4.6 Login (already wired — error code changed)

```http
POST /api/auth/login
```

Correct password + unverified email is now **422**:

```json
{
  "success": false,
  "code": "EMAIL_NOT_VERIFIED",
  "message": "Verify your email before signing in.",
  "email": "grace@ministry.com",
  "needsEmailVerification": true
}
```

Send them to `/creators/verify` with that email. Do not toast “sign in failed”.

Banned → **403** `{ code: "BANNED" }`.

### 4.7 Forgot / reset (so signup → forgot is not a dead end)

```http
POST /api/auth/forgot-password
{ "email": "grace@ministry.com" }
```

Always **200**. Same anti-enumeration copy.

```http
POST /api/auth/reset-password
{ "token": "…", "password": "New-correct-horse-1" }
```

`token` is the JWT from the email link (`/creators/reset?token=`). Mobile can keep using:

```http
POST /api/auth/reset-password-with-code
{ "email": "grace@ministry.com", "code": "482193", "newPassword": "New-correct-horse-1" }
```

Invalid / expired → **400** `{ code: "RESET_TOKEN_INVALID" }`.

Web routes to add: `/creators/forgot`, `/creators/reset`.

### 4.8 After verify — apply (already live)

```http
POST /api/creators/apply
Authorization: Bearer <accessToken>
```

No extra role required. If they skip verify, this returns **422** `{ code: "EMAIL_NOT_VERIFIED" }` — resume the OTP screen.

`GET /api/creators/me` works before verify so you can show a banner.

---

## 5. Error contract (map `fields` onto inputs)

Frontend already reads `body.message` / `body.error`. Also read `code` and `fields`.

```json
{
  "success": false,
  "code": "EMAIL_TAKEN",
  "message": "That email already has a Jevah account. Sign in instead.",
  "fields": {
    "email": "That email already has a Jevah account."
  }
}
```

| HTTP | `code` | UI |
|------|--------|-----|
| 400 | `VALIDATION_ERROR` | Inline under each `fields.*` key |
| 400 | `WEAK_PASSWORD` | Password field + strength meter red |
| 409 | `EMAIL_TAKEN` | Email field + CTA “Sign in” |
| 403 | `REGISTRATION_DISABLED` | Full-page paused state |
| 403 | `BANNED` | Support copy, no retry loop |
| 409 | `ALREADY_VERIFIED` | Redirect to login / apply |
| 400 | `INVALID_CODE` | Code inputs shake, keep digits |
| 400 | `CODE_EXPIRED` | “Resend a new code” |
| 429 | `RATE_LIMITED` | Disable CTA; honor `Retry-After` |
| 422 | `EMAIL_NOT_VERIFIED` | `/creators/verify` |

Suggested web helper:

```ts
function fieldErrors(body: { fields?: Record<string, string> }) {
  return body.fields ?? {}
}
```

---

## 6. Password rules (mirror in Zod / mobile)

Enforce the same policy the API uses. Fail in the UI before the request.

- 8–72 characters
- At least 1 letter and 1 number
- Reject common passwords (`password`, `12345678`, email local-part)
- Hash stays bcrypt on the server — do not send anything but the raw password

Human copy for `fields.password`:

> Use at least 8 characters with a letter and a number.

Existing accounts with older 6-character passwords can still **log in**. New register / reset / change-password must pass this policy.

---

## 7. Emails the user will receive

Transactional. They arrive even if the user is opted out of promos. From-name: **Jevah**.

| Event | Subject | What to tell the user on-screen |
|-------|---------|----------------------------------|
| Register / resend | Verify your Jevah account | 6-digit code, 12 min TTL, 5 attempts then lock |
| After verify (creator-web) | You're in — apply as a creator | Link to `/creators/apply` |
| Forgot password | Reset your Jevah password | Code + link to `/creators/reset?token=` |

OTP UI: six boxes, numeric, paste-friendly. After 5 wrong tries the API locks and they must resend.

---

## 8. Suggested UI build order

### Web

1. **`/creators/signup`** — same split shell as login (amber promo + form). Fields: first name, last name, email, password, remember me. Footer: “Already have an account? Sign in”.
2. Call `GET /auth/registration-status` on mount. If false, render the paused panel.
3. On 201, store tokens + user. If `nextStep === "verify_email"`, go to **`/creators/verify`**. Else go to apply.
4. **`/creators/verify`** — “Welcome, {firstName}”, 6-box OTP, resend countdown from `retryAfterSec`, deep-link `?status=ok|expired`.
5. Login footer: “New here? Create an account” → signup. Landing CTA for signed-out users → **signup**, not login.
6. **`/creators/forgot`** + **`/creators/reset`** once you wire §4.7.

### Mobile

1. Keep using `POST /api/auth/register` (or the existing `/api/register` alias — same handler).
2. Add `source: "ios"` / `"android"`.
3. After 201, if `isEmailVerified === false`, show the OTP sheet against `POST /api/auth/verify-email`.
4. Then open the existing Apply screen. Do not create a second account.
5. Login: if `code === "EMAIL_NOT_VERIFIED"`, open the same OTP sheet.

Zod / mobile schema you can copy:

```ts
const signupSchema = z.object({
  firstName: z.string().trim().min(1).max(40),
  lastName: z.string().trim().min(1).max(40),
  email: z.string().trim().email(),
  password: z
    .string()
    .min(8)
    .max(72)
    .regex(/[A-Za-z]/, "Add a letter")
    .regex(/[0-9]/, "Add a number"),
  rememberMe: z.boolean().optional(),
  source: z.enum(["creators_web", "ios", "android", "web"]).optional(),
})
```

---

## 9. What not to build

- A separate “creator account” collection or token
- Ministry fields on signup
- Calling `/api/admin/*` from the client
- Treating `role === "learner"` as a blocker for apply
- Showing “account created” and then sending them to login with no token — register **must** return `accessToken` / `token`

---

## 10. Quick test checklist (against production API)

1. `GET /api/auth/registration-status` → `{ registrationEnabled }`
2. `POST /api/auth/register` with the body in §4.2 → **201** + tokens + `user.role === "learner"`
3. Duplicate email → **409** `EMAIL_TAKEN` + `fields.email`
4. Weak password (`password`) → **400** `WEAK_PASSWORD`
5. Verification email arrives with a 6-digit code
6. `POST /api/auth/verify-email` → `user.isEmailVerified: true` + tokens
7. `POST /api/auth/resend-verification` → 200 + `retryAfterSec`
8. Same email/password works on `POST /api/auth/login` and in the mobile app
9. After verify, `POST /api/creators/apply` works with that JWT
10. Unverified login → **422** `EMAIL_NOT_VERIFIED` (pretty verify screen, not a generic 401)

---

## 11. Contact / surfaces

| Surface | URL |
|---------|-----|
| Marketing | https://www.jevahapp.com/creators |
| Signup | https://www.jevahapp.com/creators/signup |
| Verify | https://www.jevahapp.com/creators/verify |
| Login | https://www.jevahapp.com/creators/login |
| Apply | https://www.jevahapp.com/creators/apply |
| Studio | https://www.jevahapp.com/creators/studio |
