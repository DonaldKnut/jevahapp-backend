# Auth – Forgot Password Frontend Guide (Request + Reset)

- Base URL: set `API_BASE_URL` (e.g., `https://jevahapp-backend.onrender.com`)
- Content type: `application/json`
- This flow has two steps:
  1. Request a reset email
  2. Submit new password with reset token

## 1) Request Password Reset

- Endpoint: `POST /api/auth/forgot-password`
- Purpose: Send an email with a secure reset link to the user.

Request

```json
{ "email": "user@example.com" }
```

Success Response

```json
{
  "success": true,
  "message": "If that email exists, a reset link has been sent."
}
```

Common Errors

- 429: too many requests (rate limit)
- 500: unexpected error (email service, etc.)

React Native example

```ts
export async function requestPasswordReset(email: string) {
  const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `Request failed: ${res.status}`);
  return json;
}
```

UX notes

- Always show a neutral success regardless of whether the email exists to prevent account enumeration.
- Provide clear messaging and a link back to sign-in.

## 2) Reset Password (Apply)

- Endpoint: `POST /api/auth/reset-password`
- Purpose: Set a new password using the token from the email link.

Request

```json
{
  "token": "RESET_TOKEN_FROM_EMAIL_LINK",
  "password": "NewStrongPassw0rd!"
}
```

Success Response

```json
{
  "success": true,
  "message": "Password has been reset successfully. Please sign in."
}
```

Common Errors

- 400: weak password / missing fields
- 410/400: token expired/invalid
- 500: unexpected error

React Native example

```ts
export async function resetPassword(token: string, password: string) {
  const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `Reset failed: ${res.status}`);
  return json;
}
```

Deep link handling (mobile)

- The email link will open your app/site with `?token=...`.
- Extract `token` and navigate to a Reset Password screen where the user inputs a new password and submits to `/api/auth/reset-password`.

```ts
// Pseudocode for handling an incoming link
import * as Linking from "expo-linking";

Linking.addEventListener("url", ({ url }) => {
  const { queryParams } = Linking.parse(url);
  const token = String(queryParams?.token || "");
  if (token) navigate("ResetPassword", { token });
});
```

## Optional: Verify Reset Token (if supported)

- Endpoint: `GET /api/auth/verify-reset-token?token=<token>`
- Purpose: Pre-validate token (e.g., before showing password fields).

Response (typical)

```json
{ "success": true, "message": "Token valid" }
```

## Validation & UX Recommendations

- Enforce client-side password policy (length, upper/lower, number/symbol).
- Mask errors generically during request step to avoid leaking account existence.
- After successful reset, auto-redirect to sign-in and prefill email if possible.

## Types

```ts
export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
}
export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}
```

## Copy‑Paste Prompt (for your assistant/devs)

“Using AUTH_FORGOT_PASSWORD_GUIDE.md, implement a React Native `useForgotPassword` hook with: `requestPasswordReset(email)`, `resetPassword(token, newPassword)`, optional `verifyResetToken(token)`. Handle deep links to capture the token, provide loading/error state, and write minimal tests for success and error cases.”
