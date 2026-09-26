# ChatGPT brief — Artist signup, church signup, and music-first artist roadmap

**How to use this file:** Paste the **entire document** into ChatGPT (or attach it) and send the starter prompt in §0. ChatGPT should write a **stakeholder note**, not more engineering specs.

**Product:** Jevah — a gospel / faith media app (mobile + web).  
**Audience of the *output* note:** investors, pastors, artists, church leaders, and non-technical team members.  
**Source of facts:** Jevah backend as of September 2026. Treat “Already built” vs “Not built yet” as binding. Do not invent features.

---

## 0. Starter prompt (copy this with the file)

```
Using the attached brief as the only source of truth, write a comprehensive stakeholder note that a layperson, pastor, gospel artist, and investor can all understand.

Cover three roadmaps:
1) Artist signup (how a gospel artist joins Jevah)
2) Church signup (how a church joins Jevah)
3) Music-first artist (highest priority): an artist whose main goal is “put my songs in front of listeners”

Rules:
- Plain English. Short paragraphs. Analogies to Spotify, YouTube, and a church membership desk are welcome.
- Separate “what exists today” from “what we will build next.” Never blur them.
- Music-first artists are the top product priority. Church signup is important but later / parallel, not a blocker for music.
- Do not dump API paths, database names, or code. You may keep a tiny “for the product team” appendix if useful.
- Do not invent dates, budgets, or user counts. Use the phase labels in the brief (Now / Next / Later).
- End with: (a) 10-line executive summary, (b) decisions leadership must make, (c) how success will be measured.

Write it as a document titled: “Jevah: How Artists and Churches Join — and How Music Gets Heard.”
```

---

## 1. Instructions for ChatGPT (follow these while writing)

### 1.1 Voice

- Warm, clear, confident. Gospel product, not Silicon Valley jargon.
- Prefer “song,” “profile,” “review team,” “listeners,” “church listing.”
- Avoid: JWT, R2, Mongo, Redis, lane, slug, OTP (say “code emailed to you”), “contentType.”
- One idea per paragraph. Use tables and numbered journeys.

### 1.2 Structure of the output note (required sections)

1. **What Jevah is** (half a page max)
2. **Why this matters** (artists vs churches vs listeners)
3. **Simple glossary**
4. **Artist signup** — today, the journey in steps, then roadmap
5. **Church signup** — today (directory, not a full church app), the intended journey, then roadmap
6. **Music-first artist (priority)** — the north star, the shortest path to a live song, then roadmap
7. **How the three pieces fit** (do not mix music with church sermons)
8. **What “done” looks like** for each
9. **Risks and choices for leadership**
10. **Success measures**
11. **10-line executive summary** at the end (or a box at the top *and* a recap at the end)

### 1.3 Priority order you must communicate

1. **Music-first artists** — join, get approved, upload a song, get heard.
2. **Artist signup polish** — one obvious path, not two confusing doors.
3. **Church signup** — churches can claim a home on Jevah and publish sermons/community later, without blocking music.

### 1.4 Analogies you may use

| Jevah idea | Everyday comparison |
|------------|---------------------|
| Artist apply + review | Spotify for Artists / YouTube Partner: apply, wait, then upload |
| Copyright-free music shelf | A shared worship-bed playlist Jevah curates (not the artist’s own catalog) |
| Artists music shelf | The artist’s own songs, like their Spotify discography |
| Music For You | “Discover Weekly” / personalized radio for gospel songs |
| Church directory today | A phone book / “find your church” list during signup |
| Church account (future) | The church’s own desk: sermons, profile, congregation |
| Admin review | A small trust-and-safety / A&R desk — humans say yes before songs go public |

### 1.5 Do not do

- Do not recommend auto-approving every artist (trust & gospel brand matter).
- Do not mix artist songs with Jevah’s copyright-free catalog.
- Do not mix sermons into the music player shelves.
- Do not say churches already have a self-serve signup portal — they do not.
- Do not say DSP export to Spotify/Apple is in scope (it is Later / out of current scope).
- Do not claim every user can upload music. Only approved creators can.

---

## 2. What Jevah is (facts)

Jevah is a **gospel media platform**: Bible, vertical video feed, music listening, sermons, community, and creator tools.

**Three kinds of people:**

| Who | What they want |
|-----|----------------|
| **Listener / member** | Hear gospel music, watch sermons, read Bible, follow their church |
| **Artist** | Put original gospel music on Jevah and be discovered |
| **Church / pastor** | Be findable, eventually publish sermons and gather their people |

**Important product split (never confuse these in the note):**

| Shelf | Who fills it | Listener experience |
|-------|----------------|---------------------|
| **Copyright-free / worship beds** | Jevah staff (curated) | Background worship, legal-to-use beds |
| **Artists / Gospel catalog** | Approved artists | Original songs, artist pages, albums |
| **Sermons** | Teaching / preaching (media) | Sermon catalog — **not** a music playlist |
| **Vertical feed** | Short video / mixed media | TikTok-style — **not** a dump of all songs |

---

## 3. Glossary for the output note

| Term | Plain meaning |
|------|----------------|
| **Signup** | Create an account (email + password, then confirm email) |
| **Apply** | Ask to become a creator (artist, minister, or podcaster) |
| **Review** | Jevah staff check the application. Not instant. |
| **Studio** | The artist’s private workspace to upload and manage songs |
| **Publish** | Make a song visible to listeners |
| **Verified** | Staff marked this artist or church as trusted |
| **Church listing** | Name/location in Jevah’s church directory (today this is staff-added) |
| **Church account** | A login that *belongs to the church* (not built as a full product yet) |
| **Music-first artist** | Someone who came to Jevah mainly to release music, not to run a church or post videos |

---

## 4. Honest current state (September 2026)

### 4.1 Artist signup — what exists today

There are **two doors**. That is a product problem to simplify.

**Door A — Dedicated artist register (older path)**  
Someone can register *as an artist* up front (name, genres, bio, socials). They must **confirm email** before they can log in. They are **not** automatically allowed to put songs in front of the public. Staff still verify the artist.

**Door B — Recommended path (Spotify-for-Artists style)**  
1. Sign up as a normal user (or already have an account).  
2. Confirm email.  
3. Open **Become a creator** (Profile on mobile, or web `/creators/apply`).  
4. Choose type: **Artist** and/or Minister and/or Podcaster.  
5. Required: display name + at least one gospel genre.  
6. Optional: bio, Instagram, YouTube, Spotify, note to the reviewers.  
7. Status becomes **pending**. No public upload yet.  
8. Staff approve in an **Artists queue**.  
9. Studio unlocks. Artist can upload songs, covers, singles / EPs / albums.  
10. Songs appear on the **Artists** music tab and on a **public artist page**.  
11. Listeners can follow the artist. Studio shows plays, likes, saves (analytics).

**Rules that already work:**

- Email must be confirmed before apply or upload.
- Apply never auto-approves.
- Admin can still email applicants even if they have not confirmed email (invites, reminders).
- Welcome email after email is confirmed (“Welcome to Jevah Creators”).
- Uploads go to cloud storage; the app does not freeze while the file processes.
- Only **published, ready** artist tracks show to the public.
- Artist songs **do not** appear in the copyright-free shelf.

**Creator types on apply:** artist, minister, podcaster (can pick more than one).  
**Genres on apply:** gospel, contemporary Christian, Afro gospel, hymn, choir, rap gospel, highlife gospel, other.

### 4.2 What the approved artist can already do

- Upload individual songs (title, genre, cover art).
- Build a **release**: single, EP, album, or mixtape (cover + track list + publish / schedule).
- Edit public profile (photo, bio, socials, location).
- See analytics (listens, unique listeners, monthly listeners, top tracks).
- Get a public page listeners can open and play from.
- Be included in **Artists For You** (personalized gospel-song shelf that learns from listens).
- Appear in browse/search of the Artists catalog.

**Not in current scope:** one-click export of songs to Spotify, Apple Music, or other stores.

### 4.3 Church signup — what exists today (this is the gap)

**Today a church is mostly a directory listing, not a self-serve church product.**

What staff can do:

- Add a church (name, state, branch, denomination, address, contact email/phone, website).
- List it so **everyday users** can search “find my church” while finishing their profile.
- Mark a church listing as verified.
- Email churches that have a contact address.
- Store which church a member picked on their profile.

What **does not exist yet** as a product:

- No public “Church signup” button equivalent to artist apply.
- No church dashboard where a pastor logs in and runs the church page.
- A user role called “church admin” exists in the system, and staff can flip a “verified church” flag on a *person*, but there is **no church-admin studio** wired up. Treat church *account* as **foundation only**.
- Sermons exist as a **public teaching catalog** (title, speaker, church name, scripture, series). Staff / general media upload can add them. That is **not** the same as “the church signed up and published Sunday’s message.”

**Do not tell stakeholders churches can already “sign up and take over their page.”** They cannot. Staff add listings; members pick a church; sermons can be published as media.

### 4.4 Music discovery — what exists today (why music-first can win)

Listeners already have:

- Music tab split: **Copyright-free** vs **Artists**.
- Artist profile + playable discography.
- Personalized **Artists For You** (learns skips, likes, saves, listens).
- Follow artist.
- Same audio player for both shelves (different catalogs).

This is why **music-first is the right priority**: the listening pipes are largely built. The remaining job is **make joining and releasing a first song feel obvious and fast**.

---

## 5. Roadmap 1 — Artist signup

### North star

A gospel artist should understand in **under two minutes**: “Create account → confirm email → apply → wait for a human yes → upload my first song → listeners can play it.”

### Journey to describe (target, after we simplify)

```
Hear about Jevah
    → Create account (or log in)
    → Confirm email (code in inbox)
    → “Share your music” / Become a creator
    → Short form: my artist name, I’m an artist, my genre, optional social links
    → “We’re reviewing you” (honest wait, status always visible)
    → Approved email + in-app “Upload your first song”
    → Song processes → goes live on my page + Artists tab
    → I see plays. Listeners can follow me.
```

### Phases

**Now (already built — polish and explain, don’t rebuild)**

- Email confirmation gate.
- Apply form (web + mobile) with required vs optional fields.
- Pending banner with staff-written status text.
- Admin Artists queue (approve / suspend / verify).
- Studio + public page after approval.
- Admin can send artist onboard / invite emails.

**Next (highest leverage for signup)**

1. **One front door.** Marketing and the app should push Door B (apply after normal signup). Hide or merge the old “register as artist” door so people are not confused.
2. **Time-to-yes SLA.** Leadership sets a review promise, e.g. “We aim to review complete applications within X business days.” Product shows that promise on the pending screen.
3. **Incomplete-application rescue.** If they stop after signup, email/push: “Finish your creator apply.” If pending too long, ops reminder — already partly possible via admin email.
4. **Social proof at apply.** Optional: “Paste your YouTube or Spotify” stays optional but is the fastest way for reviewers to say yes.
5. **Photo upload at apply** (file picker), not only a link to an image — listed as future in current apply UX.
6. **Mobile empty states.** Music → Artists: “Are you an artist? Share your music.” Profile remains the primary entry (do not spam the Home feed).

**Later**

- Multi-step wizard if the form grows (Name → Role → Genre → Socials).
- Faster review for artists who already have strong public catalogs.
- Minister vs artist copy so pastors who only want sermons are not forced through a “music studio” story (see church roadmap).

### Definition of done (artist signup)

- A new person can go from zero to **pending application** in one sitting on phone or web.
- They always know the next step (confirm email / wait / upload).
- Staff can approve in one queue without hunting emails.
- After approval, the next screen is **upload**, not a maze of church or video tools.

---

## 6. Roadmap 2 — Church signup

### North star

A church should be able to **claim a home on Jevah**: “This is our church, here are our sermons, here is how our members find us.”  
This is **not** the same as an artist putting out an album. Do not copy-paste the music studio.

### Honest framing for stakeholders

| Today | Tomorrow (intended) |
|-------|---------------------|
| Staff type the church into a directory | Church requests or claims that listing |
| Members pick a church while finishing profile | Members still pick a church — now it can be *claimed and cared for* |
| Sermons can be uploaded as teaching media | Church account publishes sermons under the church name |
| “Church admin” is a unused seat | Pastor/admin login with a simple church desk |

### Proposed church journey (to-be)

```
Pastor hears about Jevah
    → Search: “Is my church already listed?”
    → If yes: Claim this listing (prove you represent the church)
    → If no: Request a new church listing (name, city/state, denomination, contact)
    → Confirm email
    → Staff verify (listing + person)
    → Church desk unlocks:
         • Edit public church profile (name, address, times, contact)
         • Upload Sunday sermon (video or audio)
         • See members who selected this church (privacy-respecting counts first)
         • Invite co-admins (later)
    → Members who picked this church can find sermons and the church page
```

### Phases

**Now (directory only)**

- Staff add / edit / verify / unlist churches.
- Onboarding search (“find your church”).
- Member profile stores church (and optional branch).
- Outreach email to church contact addresses.
- Public sermon catalog exists, but it is **not owned by a church login**.

**Next (first real church signup)**

1. **“Add or claim my church”** public form (web + later mobile). Creates a *request*, not an instant live church.
2. Staff queue: **Church requests** (approve listing + attach the person as church admin + verify).
3. Simple **church profile page** (public): name, location, denomination, contact, upcoming nothing-fancy — just identity.
4. **Sermon publish from church desk** — reuse the existing sermon/media pipeline, but the uploader is the church, and the sermon shows the church name automatically.
5. Clear split in marketing: *Artists share music. Churches share the Word and a home for members.*

**Later**

- Multiple branches under one church.
- Co-pastors / media team roles.
- Events, giving links, live service (only if leadership wants that product).
- Congregation chat or groups tied to the church (community already exists elsewhere in the app — do not promise a rebuild).
- Ministers who also make music still use **creator apply** (artist + minister). Church desk is for the *organization*.

### Definition of done (church signup, first useful version)

- A pastor can request or claim a church without emailing a founder in private.
- Staff can approve in a church queue (like the artist queue).
- After approval, the church can publish at least **one sermon** that listeners can find under that church.
- Members who selected that church during profile still match the same church.

### What church signup is *not*

- Not a music distributor.
- Not auto-verified (scams and fake churches are a real risk).
- Not a replacement for the member “pick your church” onboarding — that stays.
- Not a blocker for artist music launch.

---

## 7. Roadmap 3 — Music-first artist (TOP PRIORITY)

This is the roadmap leadership should fund and talk about first.

### North star (one sentence)

**“I have a gospel song. I join Jevah. After a human yes, that song is playing for listeners — on my page, in the Artists tab, and in personalized For You — without me becoming a church, a video star, or a copyright-free catalog.”**

### Why this is priority

- The **listening product is already largely built** (Artists shelf, player, follows, For You, analytics).
- Gospel artists are a growth engine: every new song gives listeners a reason to open Music again.
- Confusing them with church signup, sermons, or copyright-free uploads will kill conversion.
- Time-to-first-play is the metric that matters more than “accounts created.”

### The music-first path (keep this sacred)

```
1. Join          → account + confirm email
2. Apply         → “I’m an artist” + name + genre (+ optional socials)
3. Wait          → pending, with a promised review window
4. First song    → one file, one cover, one title (single)
5. Live          → Artists tab + my public page
6. Be heard      → For You + search + follows
7. Grow          → more singles, then EP/album, read my numbers
```

Steps 1–6 are the **minimum loveable product** for this persona.  
Albums, merch, video, church tools, podcasting are **after first play**.

### What to emphasize vs de-emphasize in the product

| Emphasize (music-first) | De-emphasize until after first play |
|-------------------------|-------------------------------------|
| Apply as **Artist** | Minister / podcaster chips as equal primary |
| “Upload your first song” | Full album wizard, UPC, ISRC |
| Artists tab + my page | Vertical TikTok feed as the place songs live |
| Plays, likes, saves | Church directory, merch, dating, forums |
| Cover art + title + genre | Long bio, multiple socials required |
| Status: processing / live | Admin-only language |

### Phases

**Now (protect and finish)**

- Keep Artists catalog **pure** (no copyright-free mix).
- Keep sermons **out** of music shelves.
- First upload after approval is a **single track** (releases/albums already exist but should not be the first screen).
- For You for artist music already ranks by listens, skips, likes, saves, freshness.
- Studio analytics already exist — show a simple “your song was played” after first live track.

**Next (the actual priority work)**

1. **One hero CTA after approval:** “Upload your first song” (not a dashboard of 12 tools).
2. **First-song wizard:** pick audio → cover → title → genre → publish. Hide album/EP until they have one live track (or a small “Add to a release later”).
3. **Time-to-first-play dashboard for ops:** applications pending, approved-but-no-upload, uploaded-but-not-live (still processing), live with zero plays.
4. **Listener discovery extras that help new artists:**  
   - New releases row (“just dropped”)  
   - Optional staff “Featured gospel” (human curation, not payola without a policy)  
   - Empty-state on Artists tab still shows how to become an artist
5. **Review SLA + quality bar:** gospel fit, identity (socials help), no spam. Fast for complete apps; reject with a kind reason.
6. **Notifications that matter:** approved; song is live; first plays; new follower.
7. **Unify signup story** so music-first artists never land on church claim or sermon upload by accident.

**Later (after first-play loop works)**

- Playlists / radio that feature emerging artists.
- Trending gospel chart (honest plays, not vanity).
- Scheduled releases (already technically possible — productize as “drop Friday”).
- Collaboration credits.
- Merch (route exists as a separate vendor world — do not attach to first-song success).
- Export to Spotify/Apple — only if the company later chooses to become a distributor.

### Definition of done (music-first)

A new gospel artist who is approved can:

1. Upload one song from a phone in one sitting.  
2. Find it on their public page the same day processing finishes.  
3. Hear it in the Artists catalog (and potentially For You as data accumulates).  
4. See at least a play count.  
5. Never be asked to “pick a church to upload music.”

### Success measures (music-first) — use these, don’t invent counts

| Measure | What it tells leadership |
|---------|--------------------------|
| Apply completion rate | Is the form too long? |
| Median hours: apply → approved | Is the review desk staffed? |
| % approved who upload a first song in 7 days | Is Studio obvious? |
| Median hours: upload → live | Is processing/moderation stuck? |
| % live tracks with ≥1 listener play in 7 days | Are we actually distributing? |
| Follows per new artist (week 1–4) | Is the page discoverable? |
| Repeat upload (2nd song in 30 days) | Did the first experience feel worth it? |

---

## 8. How the three roadmaps fit together

```
                    Jevah
         ┌────────────┼────────────┐
         │            │            │
     LISTENERS     ARTISTS      CHURCHES
     (members)   (music-first)  (home + Word)
         │            │            │
    Pick a church   Apply        Claim / request
    Hear music      Upload song  Publish sermon
    Hear sermons    Get plays    Serve members
```

**Shared:** one account system, email confirm, human review, trust & safety.  
**Separate desks:** Creator Studio (music) vs Church desk (organization + sermons).  
**A person can be both** (pastor who also records albums) — they apply as artist *and* later claim the church. Do not force both on day one.

**Priority if resources are limited:**  
Music-first loop (signup → first live play) → then church claim/sermon desk → then extras.

---

## 9. Decisions leadership must make (put these in the note)

1. **Review promise:** How many business days for artist applications? For church claims?  
2. **One artist door:** Retire or hide the old “register as artist” path in the apps? (Recommended: yes, keep one apply funnel.)  
3. **Who reviews:** Same small team for artists and churches, or split A&R vs church partnerships?  
4. **Quality bar:** What is “gospel enough”? Written guidelines for reviewers so artists are not surprised.  
5. **Featured placement:** Will staff feature songs? If yes, transparent rules (not secret pay-to-play).  
6. **Church v1 scope:** Profile + sermons only, or also events/giving? (Recommend profile + sermons only.)  
7. **Ministers who don’t make music:** Send them to church/sermon path, not the music studio.

---

## 10. Risks (plain language)

| Risk | Why it hurts | Mitigation |
|------|----------------|------------|
| Two signup doors | Artists get lost or double-create accounts | One “Share your music” funnel |
| Slow or silent review | Artists churn; they go to YouTube | SLA + status + email |
| Auto-approve | Spam, off-brand, legal risk | Keep human yes |
| Mixing shelves | Listeners lose trust (“this isn’t the artist”) | Keep catalogs separate |
| Building church desk first | Delays the music engine | Sequence: music-first, then church |
| Asking for albums first | High friction; no first play | First song is a single |
| Fake church claims | Reputation and safety | Verify like artists; contact email + documents later |

---

## 11. Suggested tone samples (match this level)

**Good:**  
“After you confirm your email, you apply as an artist. A real person at Jevah reviews you. When they say yes, you upload your first song. Listeners find it under Artists — not mixed with Jevah’s free worship beds, and not buried inside church sermons.”

**Bad:**  
“POST /api/creators/apply returns capabilities.nextStep upload_first_track once status is active and lane=artist tracks are published.”

---

## 12. Optional short appendix for product (only if ChatGPT adds one)

If an appendix is included, keep it under one page and only name these ideas — not URLs:

- Normal register vs older dedicated artist register  
- Become a creator apply  
- Staff artist approval queue  
- Studio: songs and releases  
- Public artist page, Artists catalog, Music For You  
- Church directory + member picks church at profile complete  
- Future: church claim + church desk + sermons owned by the church  

No endpoint tables in the main stakeholder note.

---

## 13. Checklist — ChatGPT must confirm before finishing

- [ ] A pastor who is not technical understands church signup is **mostly future**, directory is **today**.  
- [ ] An artist understands they **cannot skip human review**.  
- [ ] An investor sees **music-first as the growth loop** and that listening shelves already exist.  
- [ ] No claim that songs export to Spotify.  
- [ ] No claim that every member can upload music.  
- [ ] Three roadmaps are distinct; priority is explicit.  
- [ ] Phases are Now / Next / Later — no fake calendar dates.  
- [ ] Executive summary a busy person can read in 60 seconds.

---

*End of brief. ChatGPT: produce the stakeholder note now, following §0–§1.*
