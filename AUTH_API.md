### Jevah Auth API

Base URL: `/api/auth`

This document is generated from the actual routes and controllers in `src/routes/auth.route.ts` and `src/controllers/auth.controller.ts`.

---

### Public Endpoints (no auth)

- POST `/clerk-login`

  - Body: `{ token: string, userInfo: object }`
  - Response: `{ success, message, user, needsAgeSelection, isNewUser }`

- POST `/oauth-login`

  - Body: `{ provider: string, token: string, userInfo: object }`
  - Response: `{ success, message, token, user, isNewUser }`

- POST `/register`

  - Body: `{ email: string, password: string (min 6), firstName: string, lastName: string }`
  - 201 Response: `{ success, message, user }`

- POST `/login`

  - Body: `{ email: string, password: string }`
  - 200 Response: `{ success, message, token, user }`
  - Errors: 400 invalid credentials; 403 email not verified

- POST `/verify-email`

  - Body: `{ email: string, code: string }`
  - 200 Response: `{ success, message, user: { id, email, firstName, lastName, isEmailVerified, role } }`

- POST `/resend-verification-email`
  - Body: `{ email: string }`
  - 200 Response: `{ success, message }`
  - Errors: 404 user not found; 400 already verified

---

### Password Reset

- POST `/forgot-password`

  - Body: `{ email: string }`
  - 200 Response: `{ success, message }`

- POST `/verify-reset-code`

  - Body: `{ email: string, code: string }`
  - 200 Response: `{ success, message }`
  - Errors: 400 invalid/expired code

- POST `/reset-password-with-code`

  - Body: `{ email: string, code: string, newPassword: string (min 6) }`
  - 200 Response: `{ success, message }`

- POST `/reset-password`
  - Body: `{ email: string, token: string, newPassword: string }`
  - 200 Response: `{ success, message }`
  - Errors: 400 invalid/expired token

---

### Protected Endpoints (Authorization: Bearer <token>)

- POST `/complete-profile`

  - Body: accepts any of
    - `age: number`
    - `isKid: boolean`
    - `section: "kids" | "adults"`
    - `role: string`
    - `location: string`
    - `avatarUpload: string`
    - `interests: string[]`
    - `hasConsentedToPrivacyPolicy: boolean`
    - `parentalControlEnabled: boolean`
    - `parentEmail: string`
  - 200 Response: `{ success, message, user }`

- GET `/me`

  - 200 Response: `{ success, user }`

- GET `/user/name-age`

  - 200 Response: `{ success, user }` (subset with name/age classification)

- GET `/user/profile-picture`

  - 200 Response: `{ success, profilePicture }`

- GET `/session`

  - 200 Response: `{ success, session }`

- POST `/avatar`

  - Headers: `Content-Type: multipart/form-data`
  - Form field: `avatar` (image/jpeg|png|gif, ≤ 5MB)
  - 200 Response: `{ success, message, data: { ... } }`

- POST `/logout`

  - 200 Response: `{ success, message }`

- POST `/refresh`
  - Body: `{ token: string }`
  - 200 Response: `{ success, message, data: { token, user } }`

---

### Artist Endpoints

- POST `/artist/register` (public)

  - Headers: `Content-Type: multipart/form-data` (optional `avatar` image)
  - Body fields: `{ email, password, firstName, lastName?, artistName, genre: string[], bio?, socialMedia?, recordLabel?, yearsActive? }`
  - 201 Response: `{ success, message, artist }`

- POST `/artist/:userId/verify` (protected)

  - Body: `{ verificationDocuments: string[] }`
  - 200 Response: `{ success, message, artist }`

- PUT `/artist/:userId/profile` (protected; user can update own artist profile)
  - Body: partial artist profile fields
  - 200 Response: `{ success, message, artist }`

---

### Notes

- Rate limiting is applied to sensitive endpoints (login, email, reset) per middleware in `auth.route.ts`.
- Validation and exact error messages come from `auth.controller.ts` and `auth.service.ts`.


