# Creator notifications — frontend handoff

**Date:** 2026-09-25  
**Audience:** Web Studio + mobile creator hub  
**Related:** [FRONTEND_CREATOR_SIGNUP_HANDOFF.md](./FRONTEND_CREATOR_SIGNUP_HANDOFF.md) · [FRONTEND_CREATOR_STUDIO_HANDOFF.md](./FRONTEND_CREATOR_STUDIO_HANDOFF.md)

Creators get **in-app inbox + email** for identity and catalog events. You do not poll a new endpoint for each event. Subscribe to the existing notification inbox and deep-link from `metadata.creatorEvent`.

---

## 1. What fires (backend already sends)

Transactional (always, even if they opted out of marketing):

| Event | When | Email subject (approx.) | Inbox type |
|-------|------|-------------------------|------------|
| `application_received` | They submit apply | We received your Jevah creator application | `system` |
| `application_accepted` | Admin sets artist `active` | You’re approved — welcome to Jevah Studio | `system` |
| `application_rejected` | Admin sets artist `rejected` | Update on your Jevah creator application | `system` |
| `application_suspended` | Admin sets artist `suspended` | Your Jevah creator account was suspended | `system` |
| `media_uploaded` | Video/sermon upload goes through | We got your upload | `system` |
| `media_under_review` | Upload or admin holds it | … is under review | `content_moderation` |
| `media_approved` | Admin / AI approves video | … is live on Jevah | `content_moderation` |
| `media_rejected` | Video not published | … could not be published | `content_moderation` |
| `media_reported` | Someone reports their video | Someone reported … | `content_report` |
| `music_approved` | Track finalize approved | … is live on Artists | `content_moderation` |
| `music_rejected` | Track finalize rejected | … was not approved | `content_moderation` |
| `view_milestone` | 100 / 500 / 5k / 10k views | … just hit N views | `milestone` |
| `buzzing` | First time 1,000 views | … is buzzing on Jevah | `milestone` |

Marketing (opt-in only):

| Admin action | Segment | Use |
|--------------|---------|-----|
| `POST /api/admin/email/marketing` | `creators_active` | Feature / merch / product drops to approved artists |
| `POST /api/admin/email/artist-onboard` | existing | Invite / how-to-upload |

---

## 2. How the UI should consume this

Use the inbox you already have:

```http
GET /api/notifications
Authorization: Bearer <token>
```

Each item can include:

```ts
{
  type: "system" | "content_moderation" | "content_report" | "milestone"
  title: string
  message: string
  metadata: {
    creatorEvent?: string   // values from the table above
    contentTitle?: string
    contentType?: string
    reason?: string   // creator-facing; on hold/reject includes the gospel standard
    count?: number
  }
  relatedId?: string        // media / artist / track id
}
```

**Studio banners**

| `metadata.creatorEvent` | UI |
|-------------------------|----|
| `application_received` | Pending review banner (already on `GET /api/creators/me`) |
| `application_accepted` | “You’re in — upload” empty state |
| `application_rejected` | Re-apply CTA → `/creators/apply` (`capabilities.canApply` is true) |
| `application_suspended` | Support / locked studio |
| `media_*` / `music_*` | Row status on the upload / track. On hold or reject, show `metadata.reason` (and `creatorReason` on `GET /api/user-content/my-content`). Always includes: “Jevah publishes worship, Scripture, and teaching centered on Jesus Christ.” |
| `view_milestone` / `buzzing` | Confetti / analytics toast |

Push already follows the same inbox types. Deep-link Studio for all of the above.

---

## 3. Artist statuses you must handle

`GET /api/creators/me` `artist.status`:

| Status | Meaning |
|--------|---------|
| `pending` | Under review |
| `active` | Can upload |
| `rejected` | Not approved; they may apply again |
| `suspended` | Banned from Studio |

Admin patch: `PATCH /api/admin/artists/:id` with `status` + optional `reviewNote` / `rejectionReason` (that sentence is included in the email).

---

## 4. What you should not build

- A second “creator mail” API
- Client-side view-count emails (the API sends them once per threshold)
- Marketing mail from the creator app — that is admin Compose → `creators_active`

Show the inbox. The mail is the backup for people who miss the app.
