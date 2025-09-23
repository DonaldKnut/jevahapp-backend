# Auth API – Frontend Guide (Signup, Sign-in, Email Verification)

- Base URL: set `API_BASE_URL` (e.g., `https://jevahapp-backend.onrender.com`)
- Content type: `application/json`
- Auth: Bearer JWT returned on successful sign-in

## 1) Sign Up

- Endpoint: `POST /api/auth/register`
- Purpose: Create a new user and send a verification email

Request

```json
{
  "firstName": "Ibrahim",
  "lastName": "Openiyi",
  "email": "ibrahim@example.com",
  "password": "StrongPassw0rd!",
  "section": "adults"
}
```

Success Response

```json
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account.",
  "data": {
    "userId": "68b607db0e67a29dc6452526",
    "email": "ibrahim@example.com",
    "requiresEmailVerification": true
  }
}
```

Common Errors

- 400: weak password, invalid email, or missing fields
- 409: email already in use
- 500: unexpected error

React Native example

```ts
export async function signUp(payload: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  section?: string;
}) {
  const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `Sign up failed: ${res.status}`);
  return json;
}
```

## 2) Sign In

- Endpoint: `POST /api/auth/login`
- Purpose: Authenticate and receive JWT

Request

```json
{
  "email": "ibrahim@example.com",
  "password": "StrongPassw0rd!"
}
```

Success Response

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "JWT_TOKEN_HERE",
    "user": {
      "_id": "68b607db0e67a29dc6452526",
      "firstName": "Ibrahim",
      "lastName": "Openiyi",
      "email": "ibrahim@example.com",
      "avatar": "https://.../avatar.jpg",
      "section": "adults",
      "emailVerified": true
    }
  }
}
```

Common Errors

- 401: invalid credentials or unverified email (message will indicate)
- 423: account locked (if enabled)
- 500: unexpected error

React Native example

```ts
export async function signIn(email: string, password: string) {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `Sign in failed: ${res.status}`);
  await AsyncStorage.setItem("token", json?.data?.token);
  return json;
}
```

Me endpoint (fetch profile after login)

- `GET /api/auth/me` with `Authorization: Bearer <token>`

```ts
export async function fetchMe() {
  const token = await AsyncStorage.getItem("token");
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok)
    throw new Error(json.message || `Failed to fetch me: ${res.status}`);
  return json;
}
```

## 3) Verify Email

- Endpoint: `GET /api/auth/verify-email?token=<verificationToken>`
- Purpose: User clicks link received in email to verify

Success Response

```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

Common Errors

- 400/410: token invalid or expired
- 404: token not found
- 500: unexpected error

Frontend handling

- Typically opened in a browser via email link; if you need in-app deep link, intercept the URL, extract `token`, then call the endpoint.

## 4) Resend Verification Email

- Endpoint: `POST /api/auth/resend-verification`
- Purpose: Send a fresh verification email if the user is registered but not verified

Request

```json
{ "email": "ibrahim@example.com" }
```

Success Response

```json
{
  "success": true,
  "message": "Verification email sent"
}
```

Common Errors

- 404: email not registered
- 409: already verified
- 429: too many requests (rate limit)
- 500: unexpected error

React Native example

```ts
export async function resendVerification(email: string) {
  const res = await fetch(`${API_BASE_URL}/api/auth/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `Resend failed: ${res.status}`);
  return json;
}
```

## 5) Recommended UI Flow

- Sign Up
  - Call register → show: “Check your email to verify your account”
  - CTA: “Resend verification email”
- Sign In
  - On 401 with message “Email not verified”: show “Resend email”
  - On success, store token and preload user via `/api/auth/me`
- Deep Link / Verification
  - Handle app link, extract `token`, call `/api/auth/verify-email`, route to success screen

## 6) Types

```ts
export interface AuthUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
  section?: string;
  emailVerified?: boolean;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: { token: string; user: AuthUser };
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  data?: { userId: string; email: string; requiresEmailVerification: boolean };
}
```

## 7) Error Handling Pattern

```ts
function parseError(res: Response, json: any, fallback: string) {
  const msg = json?.message || fallback;
  return new Error(`${msg} (HTTP ${res.status})`);
}
```

## 8) QA Checklist

- Email arrives after register; link verifies successfully
- Unverified login returns clear message; resend works
- Verified login returns JWT; `/api/auth/me` returns user
- Token persisted and used on protected endpoints

---

## Copy‑Paste Prompt (for your assistant/devs)

“Given the endpoints in AUTH_FRONTEND_GUIDE.md, implement a React Native `useAuth` hook that provides: `signUp`, `signIn`, `resendVerification`, `verifyEmail(token)`, `fetchMe`, `signOut`. Persist the JWT with `AsyncStorage`, attach it in the `Authorization` header, and expose auth state (`user`, `token`, `loading`, `error`). Add graceful error handling using the guide’s error patterns, and TypeScript types from the file. Include minimal jest tests for happy/error paths.”
