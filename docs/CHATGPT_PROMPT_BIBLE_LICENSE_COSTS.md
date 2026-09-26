# ChatGPT brief — Bible translation licensing: what it costs Jevah

**How to use this file:** Attach it (or paste the whole thing) into ChatGPT, then send the starter prompt in §0. ChatGPT should write a **CEO / finance briefing**, not a lawyer’s contract and not an engineering spec.

**Product:** Jevah — gospel / faith app (mobile + web) with a built-in Bible reader.  
**Audience of the *output*:** CEO, finance, pastors, investors. A busy person should finish it in one sitting.  
**Date of source facts:** September 2026.  
**Hard rule:** Publishers almost never publish “NIV in an app = $X.” The output must separate **known public prices**, **planning ranges**, and **must-get-a-quote**. Do not invent a firm invoice.

This is **not legal advice**. Jevah’s counsel should review any license before we sign or ship copyrighted text.

---

## 0. Starter prompt (copy this with the file)

```
Using the attached brief as the only source of truth, write a comprehensive CEO briefing titled:

“Jevah Bible versions: what we can use today, what a license costs, and how much cash we should prepare.”

A busy CEO should understand it in one sitting. A pastor or investor in the same room should also follow it.

Cover:
1) Why Bible text is not “free just because it is the Bible”
2) What Jevah already ships legally (WEB only) and what we must not ship until licensed
3) KJV — cost, the UK catch, and why this is NOT the expensive one
4) NIV — why it is the expensive / slow one, who to ask, what we should budget while we wait
5) Other popular versions (ESV, NLT, NKJV, NASB, AMP, CSB, BSB, WEB, ASV)
6) Three budget scenarios (Stay free / Modern mix without NIV / Full NIV + others) with year-1 cash to set aside
7) Hidden costs (legal, AI bans, no offline copy, audio is extra)
8) Who we email, in what order
9) Decisions the CEO must make this quarter

Rules:
- Plain English. Short paragraphs. Tables welcome. USD unless you say otherwise.
- Never present a planning range as a signed quote. Label UNQUOTED where needed.
- Do not dump APIs, databases, or code.
- Do not tell us to scrape Bible Gateway, bible-api.com, or YouVersion.
- Be honest that NIV commercial rights are custom and not sold as a $10/month add-on.
- Our AI chatbot and AI Bible search already exist. That blocks most “free ministry NIV” shortcuts.
- End with a 10-line executive summary a CEO can screenshot, including a single “cash to prepare” line for each option.
```

---

## 1. Instructions for ChatGPT (follow while writing)

### 1.1 Voice

- Calm, board-ready. No scare tactics. No “just put NIV in, everyone else does.”
- Prefer: translation, copyright owner, quote limit, full-text app license, monthly users, commercial vs ministry use.
- Avoid: JWT, Mongo, R2, “lane,” scraping, OTP, pack gzip.

### 1.2 Required sections of the output

1. What this is about (half page)
2. One-page “price at a glance” table
3. How Jevah uses the Bible today
4. KJV
5. NIV
6. Other versions
7. Three strategic options with **year-1 cash to prepare**
8. Hidden costs (legal, DRM, no offline copy, AI bans, audio)
9. Who to contact, in order
10. CEO decisions
11. 10-line executive summary

### 1.3 Analogies you may use

| Idea | Everyday comparison |
|------|---------------------|
| Public-domain Bible | A hymn nobody owns — we may print the whole book |
| Copyrighted Bible (NIV, ESV…) | A modern worship album — we may quote a few lines; the whole album needs a deal |
| 500-verse “gratis” rule | Fair-use-style quote limit — enough for a sermon graphic, **not** a Bible app |
| API.Bible Express License | Buying grocery-store versions with a published monthly price |
| Direct publisher license | Calling the record label for a custom deal (NIV lives here) |
| YouVersion Platform | Borrowing their player — often **free for ministries**, but **no ads / no paywall / no commercial use** |

### 1.4 Do not do

- Do not say Jevah already ships KJV, NIV, or ESV as readable full text. **Only WEB is the live default corpus.**
- Do not price KJV like NIV. KJV is **$0 + a UK permission letter**.
- Do not put “NIV = $10/month.” That number is API.Bible’s **starting** commercial add-on for *other* translations.
- Do not recommend scraping, “unofficial JSON dumps,” or copying YouVersion / Bible Gateway.
- Do not promise offline NIV/ESV on the phone unless a signed license says we may store a copy.

---

## 2. Why this costs money (facts for the output)

The Bible as God’s Word is freely *preached*. A **specific English wording** produced by a publisher is often **copyrighted** for decades.

A Bible **reader** in an app (open any book, any chapter, search, offline download) is **full-text use**. That almost always needs a **written license** for NIV, ESV, NLT, NKJV, NASB, AMP, CSB, The Message, etc.

Typical publisher “free quote” rule (varies slightly by version):

- Up to about **500 verses**, and
- Not a **whole book**, and
- Scripture is under **~25%** of the whole work, and
- Proper copyright line shown.

**That is not a Bible app.** Jevah’s reader is the whole canon. Treat 500-verse rules as irrelevant to shipping NIV/ESV as a selectable translation.

**Commercial** usually means any of: app store paid app, subscriptions, in-app purchases, ads, sponsorships, selling access, or a **for-profit company even if the Bible tab itself is free**. Many licenses treat a free app from a for-profit as commercial. **Jevah must assume we are commercial unless counsel and the publisher agree otherwise in writing.**

Jevah is a gospel media product (music, sermons, creators). Even if Scripture is free to the user, publishers will likely treat the company as commercial.

---

## 3. What Jevah already does (binding product facts)

**Default translation today: World English Bible (WEB).**  
WEB is **public domain**. We may store it, search it, put it on phones offline, and use it in a commercial product. **License cost: $0.** Keep the name “World English Bible” only for the official wording (it is a trademark of eBible.org).

**What is actually in users’ hands today:** WEB. That is the only translation we should tell the CEO is “already shipping as the reader.”

The product **already knows the names** of other translations:

| In the catalog as free / public-domain | In the catalog as licensed (names only — do not ship text) |
|----------------------------------------|--------------------------------------------------------------|
| WEB (live default) | NIV |
| KJV (allowed to add; not the live default) | ESV |
| ASV, Darby, YLT | NLT |
| | AMP, NASB |

For every **licensed** name, **offline download packs are blocked** until a real license exists. That is correct and must stay.

**AI already exists in Jevah:** an AI chatbot that quotes verses, and AI Bible search that ranks verses. Biblica’s public **non-commercial express** path (via API.Bible or YouVersion) **forbids AI / machine-learning features**. YouVersion’s published commercial rule is also **no**. So the cheap “ministry NIV” door is probably **closed** unless we strip AI from Scripture or get a custom clause. Say this clearly.

**Recommended product stance already in the product:** free translations can live on our servers and on the phone; copyrighted ones wait for a contract (and often must stay online-only, fetched from the owner’s approved channel).

**Do not** tell the CEO we can fill NIV/ESV/KJV by copying Bible Gateway, bible-api.com, or YouVersion. That is not a license. It is a legal risk.

---

## 4. KJV — King James Version (Authorized Version)

This is the version African and many Western churches ask for first. It is **not** the expensive problem.

### Who controls it

- **Most of the world (including the US, Nigeria, and most of Africa):** the 1769 KJV text is treated as **public domain**. Cost to put the full KJV in Jevah: **$0**, plus we must use a reputable public-domain file (not a publisher’s typeset edition with extra notes, maps, or study notes that may still be copyrighted).
- **United Kingdom:** rights in the Authorized Version are a **Crown / royal prerogative**, administered by **Cambridge University Press** (King’s Printer), not ordinary “copyright expired.” Printing, importing, or distributing the full KJV **in the UK** is not “do whatever you want.”

Cambridge’s public allowance: up to **500 verses** for liturgical / non-commercial educational use, not a complete book, not 25%+ of the work. A **full Bible in a global app** that UK users can open is **beyond** that. We should **ask Cambridge in writing**.

Public comments over the years: Cambridge has sometimes said they mainly want a **reputable text** and **often do not charge a fee** for permission — but that is **not a quote**. File the form.

**Contacts**

- Cambridge Bibles permissions: `permissions@cambridge.org`
- Bible team: `bibles@cambridge.org`
- Request form (Bibles / Prayer Books) on Cambridge’s rights site

### Cost to tell the CEO

| Item | Planning figure | Confidence |
|------|-----------------|------------|
| KJV in US / Nigeria / most countries | **$0 / year** | High |
| UK full-text permission | Often **$0–low thousands one-time**, or a short license; **get a letter** | Medium — do not book “free in UK” until Cambridge replies |
| Legal review of UK exposure | **$1,000–$3,000** one-time (part of a bigger Bible legal packet) | Planning only |
| Getting a clean public-domain KJV file into the app | Staff / engineering time, **not** a royalty | High |

**Bottom line for CEO:** KJV is the cheap, beloved classic. Budget **$0 for the text**, plus **one permission letter for the UK**, not a NIV-sized invoice. If someone said “we need a KJV license budget like NIV,” they mixed two different problems.

---

## 5. NIV — New International Version (the one people ask for after KJV)

### Who owns it

- **Biblica** (copyright owner of the NIV text).
- **HarperCollins Christian / Zondervan** — commercial **print** in the US & Canada.
- **Hodder & Stoughton** — UK / EU print.
- **Digital / app / audio commercial use** — Biblica says apply to **them** (not only Zondervan).

Latest edition only. They are **not** licensing old NIV editions.

### Why there is no price tag on the internet

**API.Bible (American Bible Society)** sells “express” commercial licenses for **many** copyrighted Bibles on a monthly, per-translation, per-user-band price. **NIV is explicitly excluded** from that commercial express checkout. Their help center (updated June 2026): *API.Bible does not offer express licensing for commercial use of the NIV. Contact Biblica.* That restriction is Biblica’s, not API.Bible’s.

**YouVersion Platform** can include NIV because publishers opted in — but YouVersion’s published rule is **non-commercial**:

- Free to the end user (no subscriptions, purchases, upgrades)
- No Scripture behind a paywall
- No ads, sponsorships, or other monetization
- Not for commercial use
- Scripture may not be used in a way that enables revenue, directly or indirectly

If Jevah has (or will have) any revenue around the app — music, ads, creators, subscriptions — **YouVersion is probably not our NIV path** unless they and Biblica say otherwise in writing.

**Biblica** will only license the **full text** to a **registered legal entity** (company / nonprofit), not a private individual. They ask for product details, price, development cost, distribution, AI/ML use.

Biblica’s public **express / royalty-free** path (via API.Bible or YouVersion) requires **both**:

1. Truly non-commercial (no sales, subscriptions, advertising, monetization), **and**
2. **No artificial intelligence or machine-learning features**

Jevah already has AI features that quote and search Scripture. Treat the $0 NIV express door as **closed** unless the CEO is willing to turn those features off for NIV, or Biblica writes a custom exception.

### What NIV *might* cost (planning ranges, not quotes)

Nobody reputable publishes “NIV app license = $X.” Direct deals are typically some mix of:

- Annual minimum guarantee
- Royalty on revenue or a **per-user / per-download** fee
- Restrictions: no local full-file dump, no AI training, trademark rules, audit rights, take-down in 24–72 hours if they pull the text
- Territory (world vs US vs Africa, etc.)

**Planning bands for a full NIV reader inside a commercial app** (industry pattern for major English Bibles, **not a Biblica quote**):

| If Jevah is… | Order-of-magnitude to budget while we wait for a quote |
|--------------|------------------------------------------------------|
| Clearly non-profit / no ads / no IAP / no AI on Scripture / ministry wrapper | Sometimes **$0 via a partner platform**, with heavy rules — **unlikely for Jevah as built** |
| Small commercial product, modest users | Often **low five figures per year** ($10,000–$40,000) **or** a revenue share — **unknown until quoted** |
| Scaled commercial / large monthly users | Can move to **high five / low six figures per year** or a real royalty. Do not promise a cap. |

**Do not** put “NIV = $10/month” in the CEO note.

**Contact**

- Digital commercial NIV: [https://www.biblica.com/permissions/](https://www.biblica.com/permissions/) and their permission request form
- North America **print** NIV: HarperCollins Christian permissions
- UK/EU **print**: Hodder & Stoughton

For Jevah’s **app**, start with **Biblica digital**, not the print desk.

**Time:** weeks to months, not a weekend checkout.

---

## 6. Other versions (CEO table)

Use this table in the output. “Gratis 500 verses” never means “full Jevah Bible tab.”

| Version | Owner / desk | Full app in a commercial product | Public price? | Planning cost |
|---------|----------------|----------------------------------|---------------|----------------|
| **WEB** (Jevah default) | Public domain (eBible.org name is trademarked) | Yes | **$0** | **$0** |
| **KJV** | PD outside UK; Cambridge in UK | Yes, with UK letter | **$0** (+ UK permission) | **$0–low** |
| **ASV, YLT, Darby** | Public domain | Yes | **$0** | **$0** |
| **BSB** (Berean Standard Bible) | Public domain since 30 Apr 2023 (CC0) | Yes — modern English, $0 | **$0** | **$0** — strongest “NIV-like English without NIV invoice” option |
| **NIV** | Biblica | Custom license; **not** API.Bible commercial express | **No list price** | **Quote required** (see §5) |
| **ESV** | Crossway | Org license; free API only if **non-commercial** | No list price for commercial full text | Quote Crossway (`rights@crossway.org` / digital permissions form). API.Bible may list ESV on express *if* Crossway opted in — verify at checkout |
| **NLT** | Tyndale House | Written permission for >500 verses / full Bible | No list price | `permissions@tyndale.com` — or API.Bible commercial ladder if offered |
| **NKJV** | HarperCollins / Thomas Nelson | Written permission for full digital app | No list price | HarperCollins Christian licensing / permissions form |
| **NASB** | Lockman Foundation | Written permission beyond quote limits | No list price | Lockman; AMP commercial print often HarperCollins |
| **AMP** | Lockman (+ HarperCollins on some commercial print) | Same family as NASB | No list price | Quote |
| **CSB** | Holman / Lifeway | Often available via API.Bible express | Checkout | Use API.Bible ladder if listed |
| **NET** | Biblical Studies Press; commercial via HarperCollins | Non-commercial quoting is generous; **commercial = HarperCollins** | No list price | Quote if we monetize |
| **The Message** | NavPress / Tyndale | Full text needs permission | No list price | Quote / API.Bible if listed |

**Later (do not pretend we have quotes):** Yoruba, Igbo, Hausa, Nigerian Pidgin, and other African-language Bibles are usually a **Bible Society** conversation (e.g. Bible Society of Nigeria / United Bible Societies), not Biblica. Budget them as a **phase 2** research item, not as year-1 NIV money.

### API.Bible — the only **published** commercial price ladder (not NIV)

American Bible Society **API.Bible** (public pages, mid-2026):

- **Starter:** $0/month, 5,000 API calls, up to **3** copyrighted Bibles, **non-commercial only**
- **Pro:** from **$29/month**, 150,000 calls; commercial allowed
- Extra API calls (example they publish): about **$1 per 1,000** calls
- **>150,000 monthly users:** they point you to a custom / enterprise conversation (`support@api.bible`)
- **Commercial license per copyrighted translation** (publisher-set; shown at checkout). Homepage publicly shows add-on bands starting at **$10 / month per translation**, with example steps of **$10, $25, $100, $300** as monthly users grow. Exact mapping is **at checkout**, not a contract we have signed.

**NIV is not on this commercial ladder.**

**Catch for Jevah:** API.Bible is usually **their servers, their rules**: DRM, print cap (~100 verses), **no AI training**, audits, pull a version within **24 hours** if the publisher withdraws, often **no keeping a full private copy** the way we store WEB. That may **block offline NIV/ESV packs** even after we pay. Say this clearly to the CEO.

YouVersion Platform: great for **ministry / non-commercial** NIV access; **not** a commercial price list; **poor fit** if Jevah monetizes or keeps Scripture AI.

---

## 7. Three options for the CEO (use these scenarios)

The CEO asked “how much do we need to prepare?” Answer with **cash to set aside this fiscal year**, not a fake invoice.

### Option A — “Stay free and legal” (recommended default until NIV is quoted)

Ship **WEB + KJV** (+ ASV/YLT/Darby if wanted) + strongly consider **BSB** as a readable modern English Bible.

| Cost | Amount |
|------|--------|
| Translation licenses | **$0 / year** |
| UK KJV letter | staff time + possible $0–low fee |
| Legal once-over (WEB/KJV/BSB + UK letter) | **~$2,000–$5,000** one-time |
| **Year-1 cash to prepare** | **$5,000–$8,000** (mostly legal, not royalties) |

**Pros:** ship now, offline Bible, no publisher can pull the text. Covers the “we need KJV” request.  
**Cons:** users who insist on NIV will complain.

### Option B — “Modern versions, no NIV yet”

Keep Option A. Add **1–3** copyrighted translations that **are** on API.Bible commercial express (example: NLT, CSB, NASB — **only if listed for commercial use at checkout**). Or negotiate ESV with Crossway.

**Example planning math** (Pro + 3 translations, **not NIV**). Treat user-band dollars as **indicative**; confirm at API.Bible checkout.

| Bible-tab users / month | API.Bible Pro | 3 licenses (indicative) | **~/month** | **~/year** |
|-------------------------|---------------|-------------------------|-------------|------------|
| Under ~1k (their published sample tier) | $29 | from ~$30 | **~$60+** | **~$700+** |
| Growing (homepage $25–$100 band) | $29 | ~$75–$300 | **~$100–$330** | **~$1,200–$4,000** |
| Larger (homepage $300 band) | $29 | ~$900 | **~$930** | **~$11,000** |

Add **$3,000–$10,000** year-1 legal + product work to obey DRM / no-offline / branding.

| Line | Year-1 cash to prepare |
|------|------------------------|
| Option A legal | $5,000–$8,000 |
| API.Bible + 3 modern versions | **$1,000–$12,000** depending on users |
| Integration / compliance | $3,000–$10,000 |
| **Year-1 total (planning)** | **$10,000–$30,000** |

**Pros:** named modern Bibles with a published price.  
**Cons:** still no NIV; may be **online-only**; we do not own the files.

### Option C — “We must have NIV”

Option A or B **plus** a **Biblica** (and maybe HarperCollins) **custom** license.

| Line | Planning |
|------|----------|
| Biblica NIV commercial full-text | **Quote — budget a placeholder of $15,000–$50,000 / year** until they answer, and be ready for higher or for a revenue share |
| Legal negotiation | **$5,000–$15,000** one-time |
| Product work (their delivery method, no scrape, possible no offline, AI restrictions) | **weeks of work** — not a license fee, but real cost |
| Timeline | **1–4+ months** to a signed paper |

**If the CEO needs a single placeholder in a budget spreadsheet before Biblica replies:**  
**Year 1 NIV program: $25,000–$75,000** (license placeholder + legal + integration), marked **UNQUOTED**.

**Cash to prepare if we pursue NIV this year (honest board number):**  
**set aside $40,000–$80,000** so a quote, lawyer, and build do not stall. That is a **reserve**, not a bill.

If Jevah will remain strictly non-commercial (no ads, no IAP, nonprofit) **and** turn off Scripture AI, ask Biblica **and** YouVersion **first** — cost might be **$0** under ministry terms. Do not assume that if Jevah is a company that monetizes music, ads, or subscriptions.

---

## 8. Hidden costs the CEO should hear

1. **Legal entity** — NIV full text: company or registered nonprofit, not a founder’s Gmail.
2. **We cannot train AI** on most copyrighted Bibles (Biblica express forbids AI/ML; API.Bible forbids training without extra consent). Jevah’s AI Bible features must stay on **WEB / other public-domain text** unless a contract allows more.
3. **Offline packs** — likely allowed for WEB/KJV/BSB; **often forbidden** for NIV/ESV unless the license says we may store a copy. Cheap Android users in low-data markets care about this.
4. **Publisher can withdraw** the file; we must remove it quickly.
5. **Scraping is not a savings** — it is how you get a cease-and-desist.
6. **Trademarks** — “NIV,” “ESV,” logos: separate from quoting verses.
7. **Audio Bibles** are **another** license (often more expensive than text). Do not fold audio into the text budget.
8. **African-language Bibles** (Yoruba, Igbo, Hausa, Pidgin) are a **later** Bible Society conversation, not part of the NIV placeholder.

---

## 9. Recommended sequence (put this in the note)

1. Keep **WEB** as default. Say so in the app (“Modern public-domain English”).
2. Add **KJV** from a clean public-domain 1769 text; email **Cambridge** for UK. Budget **~$0 royalties**.
3. Add **BSB** if product wants a free *modern* alternative to NIV.
4. Decide in writing: is Jevah **commercial**? (If yes, skip YouVersion as NIV strategy.)
5. Decide whether Scripture **AI** stays on. If yes, ministry express NIV is probably closed.
6. Create an **API.Bible checkout** (or Crossway/Tyndale forms) for 1–2 paid modern versions **only if** the CEO wants names besides NIV and is fine with online-only.
7. Submit **Biblica** NIV digital request **in the company’s name** with: what Jevah is, countries, expected users, whether we charge, whether we use AI, whether we need offline.
8. Do not announce NIV in the store until the signed license is in the folder.

---

## 10. Who to email (appendix is OK in the CEO doc)

| Need | Where |
|------|--------|
| NIV digital / commercial | Biblica permissions — biblica.com/permissions |
| NIV print US/Canada | HarperCollins Christian permissions |
| KJV in the UK | Cambridge `permissions@cambridge.org` |
| ESV | Crossway digital permissions / `rights@crossway.org` / api.esv.org (non-commercial only) |
| NLT | Tyndale `permissions@tyndale.com` |
| NKJV / some NET commercial | HarperCollins Christian / Thomas Nelson |
| NASB / AMP | Lockman Foundation |
| Published monthly prices (not NIV commercial) | API.Bible Pro + express licensing — api.bible |
| Ministry / non-commercial NIV pipe | YouVersion Platform — youversion.com/platform (likely a poor fit for Jevah) |
| High-volume API.Bible | `support@api.bible` — “Custom Plan Inquiry” |

---

## 11. Decisions the CEO must make

1. Do we **need NIV in year 1**, or is WEB + KJV + BSB enough while we quote Biblica?
2. Is Jevah **commercial** (ads, subscriptions, company revenue)? This single answer changes NIV from “maybe $0 on YouVersion” to “custom Biblica deal.”
3. Must Scripture work **offline** on cheap Android? If yes, lean hard on public-domain Bibles; expect NIV to be online-only.
4. Does our **AI / chatbot** quote a named translation? If yes, keep it on WEB until a contract allows NIV — or be ready for Biblica to say no.
5. Budget: approve **Option A (~$5k–$8k, almost no royalties)** now, and a **placeholder / reserve $40k–$80k** if we pursue NIV in the same fiscal year?
6. Who signs as the **legal entity** on publisher forms?

---

## 12. “How much should we prepare?” — numbers ChatGPT must put near the top

Use this as the screenshot table.

| If leadership chooses… | Cash to prepare this year | What that money is |
|------------------------|---------------------------|--------------------|
| **A. WEB + KJV (+ BSB)** | **$5,000–$8,000** | Lawyer + UK KJV letter. **$0 royalties.** |
| **B. A + 1–3 modern versions (not NIV)** | **$10,000–$30,000** | Legal + API.Bible / publisher express + integration |
| **C. We go after NIV** | **$40,000–$80,000 reserve** | Unquoted Biblica license + legal + build. Could come in lower or higher. |

**Minimum to unlock KJV (the version people think we “need a license for”): about $0 in royalties, plus the UK letter and a few thousand for counsel.**

**Do not** tell the board we must have $50,000 before we can add KJV. That money is for **NIV**, not KJV.

---

## 13. Checklist — ChatGPT must confirm before finishing

- [ ] CEO can see **WEB = $0, already in the product**.
- [ ] KJV is **not** “$50,000.” It is **$0 + UK permission**.
- [ ] NIV has **no fake monthly price**; commercial express **excludes** NIV.
- [ ] 500-verse rules are **not** permission to ship a Bible reader.
- [ ] Three options with **year-1 cash to prepare**, labeled unquoted where needed.
- [ ] Jevah’s **AI features** are treated as a blocker for free ministry NIV.
- [ ] Scraping / Gateway / YouVersion-as-commercial-CDN is **rejected**.
- [ ] 10-line screenshot summary at the end, including the three cash-to-prepare numbers.

---

*End of brief. ChatGPT: write the CEO briefing now, following §0–§1.*
