# Frontend Guide: Dynamic Profile Surface & Auth Endpoints

This guide explains how to consume the dynamic Profile surface from the backend and the auth-related endpoints required for registration, login, email verification, avatar upload, and password reset.

Base URL prefix used below assumes your HTTP client is configured with:

- baseURL: `https://<backend-domain>/api/auth`

If you do not set a baseURL, prepend `/api/auth` to each path.

---

## Auth Flow (Email/Password)

- Register: `POST /register`

  - Body: `{ email, password, firstName, lastName }`
  - On success, prompt the user to verify their email.

- Verify Email: `POST /verify-email`

  - Body: `{ email, code }`
  - Call after the user enters the 6-digit code from email.

- Resend Verification Email: `POST /resend-verification-email`

  - Body: `{ email }`
  - Use if the user didn’t receive a code or code expired.

- Login: `POST /login`
  - Body: `{ email, password }`
  - Response includes `token` and `user`. Persist the token (securely) and attach `Authorization: Bearer <token>` header for protected endpoints.

---

## Password Reset (Code-Based)

- Start Reset: `POST /forgot-password`

  - Body: `{ email }`
  - Sends a 6-character reset code to email.

- Verify Reset Code: `POST /verify-reset-code`

  - Body: `{ email, code }`
  - Optional UI step to validate the code before asking for a new password.

- Reset With Code: `POST /reset-password-with-code`
  - Body: `{ email, code, newPassword }`

Legacy (still supported):

- `POST /reset-password` with `{ email, token, newPassword }`.

---

## Profile Surface (Protected)

Mount: `GET /api/auth/me` (requires `Authorization: Bearer <token>`)

- Returns a dynamic surface to render the entire Profile screen.
- Server controls the `sections` order; frontend renders based on `type` and `payload`.

Example usage (Axios):

```ts
const res = await api.get("/me", {
  headers: { Authorization: `Bearer ${token}` },
});
const surface = res.data; // { success, user, preferences, stats, badges, links, permissions, sections }
```

Render algorithm:

1. Read `sections` array in order.
2. For each entry, switch on `type` and render the appropriate component using `payload`.
3. Defer heavy lists (e.g., posts/saved/playlists) to supplemental endpoints described below.

Section types may include:

- `header` → user display block
- `quickActions` → list of action buttons
- `stats` → counters
- `tabs` → tab definitions (keys: `posts`, `saved`, `playlists`)
- `grid`/`list`/`playlists` → initial lightweight data, can be replaced with paginated fetches
- `activity` → recent activity
- `settingsEntry` → link to settings screen

---

## Complete Profile (Protected)

- Update: `PATCH /complete-profile`
  - Body: send any subset of fields you want to update, e.g.
  ```json
  {
    "firstName": "Ada",
    "lastName": "Lovelace",
    "username": "ada",
    "bio": "Building analytical engines.",
    "location": "London",
    "section": "adults",
    "isKid": false,
    "parentalControlEnabled": false,
    "interests": ["music", "sermons"],
    "theme": "light",
    "notifications": { "email": true, "push": true }
  }
  ```
  - Response mirrors `GET /me` so UI can refresh immediately.

---

## Avatar Upload (Protected)

- Upload: `POST /avatar` (multipart/form-data)
  - Field: `avatar` (png|jpg|gif ≤ 5MB)
  - Optional: `crop` is not processed server-side currently; perform client-side cropping before upload.
  - Response: `{ success, message, data: { avatarUrl, userId } }`

Example (React Native / Expo, using fetch):

```ts
const form = new FormData();
form.append("avatar", {
  uri: imageUri,
  name: "avatar.jpg",
  type: "image/jpeg",
} as any);

await fetch(`${BASE_URL}/api/auth/avatar`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
```

---

## Supplemental User Data (Protected)

These endpoints allow fetching heavy tab data on demand, based on the `tabs` provided in the Profile surface.

- Content by tab: `GET /user/content?tab=posts|saved|playlists&page=1&limit=20`

  - Response: `{ items, page, pageSize, total }`
  - Note: If these endpoints are not yet implemented, fetch from your existing content endpoints by user and map to the `Content` and `Playlist` shapes described in the app contract.

- Activity: `GET /user/activity?page=1&limit=20`

  - Response: `{ items, page, pageSize, total }`

- Profile banner (if supported): `POST /user/profile-banner` (multipart/form-data)
  - Field: `banner`
  - Response: `{ success, message, bannerUrl }`

---

## Headers & Error Handling

- Always include `Authorization: Bearer <token>` for protected routes.
- Errors follow `{ success: false, message }` with appropriate HTTP status codes.

---

## Example Integration Snippets

- Email verification

```ts
await api.post("/verify-email", { email, code });
```

- Password reset (code-based)

```ts
await api.post("/forgot-password", { email });
await api.post("/verify-reset-code", { email, code });
await api.post("/reset-password-with-code", { email, code, newPassword });
```

- Fetch profile surface

```ts
const { data } = await api.get("/me", {
  headers: { Authorization: `Bearer ${token}` },
});
renderProfileSurface(data.sections);
```

---

## Notes

- The `AUTH_API.md` is the source of truth and aligns with current backend routes and controllers.
- If you change auth routes or shapes, update both `AUTH_API.md` and this guide to keep parity.
