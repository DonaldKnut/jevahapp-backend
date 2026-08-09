# Artist / creator email verification

**Date:** 2026-08-09  
**Audience:** Mobile + web creators, admin ops  

## Rule

Artists/creators must **verify email** before apply + studio writes.  
**Admin can always email / message them** (ops, onboard, marketing) — those paths do **not** require `isEmailVerified`.

```
Artist register ──► verification email (OTP)
                 └── login blocked until verified
                 └── welcome email on POST /api/auth/verify-email

Creators apply / studio writes ──► require isEmailVerified (403 EMAIL_NOT_VERIFIED)

Admin ops email / artist-onboard / marketing ──► reach by email regardless of verify flag
```

## Artist account create (`POST /api/auth/artist/register`)

1. Creates user `role: artist`, `isEmailVerified: false` + OTP (10 min).  
2. Sends **verification** email (`verify.ejs`).  
3. `POST /api/auth/verify-email` → sets verified → **welcome** via `welcome-artist.ejs` (subject: “Welcome to Jevah Creators”). Learners get `welcome.ejs`.  
4. Resend: `POST /api/auth/resend-verification-email`.  
5. Login: blocked until verified (same as learners).

## Creators hub

| Call | Gate |
|------|------|
| `GET /api/creators/me` | Auth only — returns `needsEmailVerification` / `nextStep: "verify_email"` |
| `POST /api/creators/apply` | `requireEmailVerified` |
| Studio track/release writes | `requireEmailVerified` |

`403` body:

```json
{
  "success": false,
  "code": "EMAIL_NOT_VERIFIED",
  "message": "Verify your email before…",
  "data": { "email": "…", "needsEmailVerification": true }
}
```

## Clerk / OAuth

- New users: `isEmailVerified` from Clerk claim; welcome only if verified.  
- Existing: if Clerk later reports verified → Mongo `isEmailVerified` synced.  
- Response includes `needsEmailVerification`. Unverified Clerk users can use the app but **cannot** apply/upload until Clerk email is verified (then re-login).

## Admin reach (always)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/admin/email` | Direct ops email to userIds / emails |
| `POST /api/admin/email/artist-onboard` | Creator invite / onboard |
| `POST /api/admin/email/marketing` | Broadcast (opt-in segment) |
| `POST /api/admin/users/:id/warn` | In-app + optional email |

These ignore creator `isEmailVerified` so pending / unverified applicants still get mail.

## FE checklist

- [ ] After artist register → verify-email screen (not studio)  
- [ ] `GET /creators/me` → if `nextStep === "verify_email"` show verify UI  
- [ ] Handle `EMAIL_NOT_VERIFIED` on apply/upload  
- [ ] Admin Artists tooling keeps using admin email endpoints  
