# Nuqta (نقطة) — project context

*Last updated: 14 Oct 2026. "Nuqta" is a placeholder product name (set in `assets/js/config.js` → `APP_NAME`).*

## What it is
A multi-tenant SaaS for restaurants, cafés, salons and shops in **Damascus, Syria**: each business creates its own branded digital loyalty card, rewards, tiers, customer CRM, campaigns and staff accounts. Customers join by scanning a QR code — no app, no password. **Arabic-first with full English (RTL/LTR).** Separate product from WafaCard and from the phone-number loyalty idea.

## Where things live
| | |
|---|---|
| Live site | https://nuqatii.github.io/nuqta/ (GitHub Pages, repo **nuqatii/nuqta**, branch `main`, root) |
| Pages | `index.html` sign in/up · `app.html` business portal · `rewards.html` customer join (`?b=slug`), card (`?c=token`), "My cards" (no params) · `admin.html` platform admin |
| Firebase project | **nuqati-39894** (Auth: Email/Password · Firestore) — config already in `assets/js/config.js`, `MODE: 'firebase'` |
| Google Wallet | Issuer ID **3388000000023216599** (already in `config.js → GOOGLE_WALLET.issuerId`; issuer profile country: Syria) |
| Platform admin | doc `platformAdmins/{uid}` created by hand in the Firestore console |
| Demo mode | add `?mode=demo` to any URL → in-browser data (Joe's Pizza, Urban Coffee, Rose Salon). Demo logins: owner@joespizza.demo, staff@joespizza.demo, marketing@joespizza.demo, owner@urbancoffee.demo, admin@nuqta.demo — password `demo1234` |

## How I deploy (important)
- I upload files through the **GitHub website** (Add file → Upload files, drag the *contents* of the `nuqta` folder so `index.html` is at the repo root). My laptop runs Windows; no command line.
- **Auto-deploy (once set up, see GOOGLE_WALLET_SETUP.md part 4):** GitHub Actions (`.github/workflows/firebase-deploy.yml`) deploys `functions/` and `firestore.rules` whenever they, `config.js` or `loyalty.js` change, using the repo secret `FIREBASE_SERVICE_ACCOUNT`. Until that secret exists, rules must still be pasted into **Firebase → Firestore → Rules → Publish** by hand. If code and rules are out of sync, creating businesses fails.
- Indexes created so far: composite `activity (customerId ↑, at ↓)`, `redemptions (status ↑, createdAt ↓)`; single-field collection-group exemptions `members.uid`, `invites.email`.
- After deploying, phones may need a refresh (service worker is network-first, cache `nuqta-v4`).

## Tech stack & structure
Static site, plain HTML/CSS/JS ES modules, **no build step**, Firebase JS SDK 12.19.0 from gstatic. One service layer runs on both backends.
```
assets/js/config.js          ← only file to edit for go-live settings
assets/js/core/loyalty.js    pure rules: earning, tiers, segments, stamps (stampState/readyCount),
                              subscription (accessState, GRACE_DAYS=3, DEFAULT_TRIAL_DAYS=30), roles
assets/js/core/i18n.js       all Arabic + English strings (tests check both languages have every key)
assets/js/core/wallet.js     customer's "My cards" list (localStorage on the phone)
assets/js/data/service.js    every read/write; db-firestore.js / db-memory.js adapters; demo-seed.js
assets/js/ui/card.js         the loyalty card (laid out like an Apple/Google Wallet pass)
assets/js/pages/*.js         one module per screen (biz-*.js business, customer.js, admin.js, auth.js)
firestore.rules              tenant isolation + roles + subscription lock, enforced server-side
functions/                   server function `gwallet` (Google Wallet: save/sync/logo), Node 22, region europe-west1;
                              shared/ = copies of loyalty.js + config.js + ui/icons.js made at deploy time (not in the repo)
.github/workflows/           firebase-deploy.yml (auto-deploy functions + rules)
tests/                       node --test (logic, journeys, tenant isolation, i18n, gwallet); tests/rules needs Java emulator
```

## Data model (Firestore)
- `businesses/{bid}`: name, slug, type, currency (SYP default; **new Syrian pound**, 10 SYP = 1 point default), lang, logo (data URL), colors, design, program `{type: points|visits|stamps|spend, per, earn, goal, welcomeBonus}`, tiers, status (`active|suspended`), **plan** (`trial|starter|professional|enterprise`), **trialEndsAt**, **paidUntil**, memberSeq. Public read.
- Sub-collections: `members/{uid}` (role owner|manager|staff|marketing), `invites/{email}`, `customers/{cid}`, `phones/{e164}` (uniqueness lock), `activity/{id}` (immutable ledger: join/purchase/redeem/adjust/tier), `rewards`, `redemptions/{code}` (pending → redeemed once), `locations`, `segments`, `campaigns(/recipients)`, `templates`, `payments` (admin-recorded), `audit`, `private/settings`.
- `cards/{token}` (+ `/activity`, `/redemptions`): the customer's card, readable by anyone holding the 24-char secret token. QR on the card encodes a separate `scanId`, not the token.
- `stats/{bid}` usage counters · `slugs/{slug}` · `platform/settings` (signupsOpen, announcement, trialDays, currency, prices, paymentInfo, supportWhatsapp) · `platformAdmins/{uid}`.

## Decisions made (keep these)
- **Customers:** join with first name + mobile (required), email + birthday (optional). No offers tick box — joining = agreeing to offers; they can switch off in their card's Profile tab. Phone normalised to +963.
- **My cards:** all cards on a phone collected on `rewards.html`; opening any card link adds it; one card per business per phone. Chosen over phone-number login (option 2, needs SMS/WhatsApp OTP) and Apple/Google Wallet (later).
- **Stamp/visit cards count in rounds:** circles show stamps toward the *next* reward (`progress/goal`), saved-up rewards counted separately ("2 rewards ready"); redeeming one subtracts one card's worth. Grid size = cheapest live reward cost. Points programs keep one running balance.
- **Checkout** shows "Card complete! +1 new reward" and a **Give it now** button; cashier can skip.
- **Trials & subscriptions:** every new business gets a free trial (default 30 days, admin can extend per business). 3 grace days after expiry, then **soft lock** (owner sees only Subscription page, staff see a notice, join page paused, customer cards read-only; no data deleted). **Payments are manual**: business pays via Sham Cash / Syriatel Cash / transfer / cash and confirms on WhatsApp; admin clicks **Record payment** (1/3/6/12 months), paid time is added after any remaining time. Only the admin can change plan/trialEndsAt/paidUntil (rules enforce).
- **Admin account is admin only** — never owns a business, always lands on admin.html; to run my own shop I sign up with a different email.
- **Legal:** `privacy.html` and `terms.html` (Arabic + English; Arabic is the reference version). Operator is a Syrian business based in Syria; governed by Syrian law, Damascus courts; contact by WhatsApp +963953667748 (no email yet); business data deleted 90 days after an account ends. Details live in `config.js → LEGAL`; texts in `assets/js/core/legal-text.js`. A business must tick "I agree to the Terms and Privacy Policy" before it is created (stored as `terms {version, acceptedAt, acceptedBy}` on the business). Customers have **Delete my data** on their card's Profile tab → owner sees a notice on Customers and deletes (name/phone/contact removed, card stops working, purchases stay anonymous). Owners can also delete any customer from the profile ⋯ menu.
- **Google Wallet (built 14 Oct, waiting for setup):** "Add to Google Wallet" button under the card on `rewards.html` (hidden while `config.js → GOOGLE_WALLET.issuerId` is empty). It links to the function `gwallet/save?t=<token>`, which upserts a LoyaltyClass per business (`<issuer>.biz_<bid>`) and a LoyaltyObject per card (`<issuer>.card_<bid>_<cid>`), marks `walletGoogle: true` on the card + customer, and redirects to Google's save page. No customer login; the pass returns on a new phone through the Google account. Signing is keyless (the function's default compute service account signs via the IAM Credentials API). After purchases, redemptions, adjustments, name changes and deletions, the cashier's browser pings `gwallet/sync?t=` (only for customers with walletGoogle); design changes ping `sync?b=`. The logo is served from Firestore's data URL by `gwallet/logo`. Pass contents: points / stamps "x/goal" / spend, rewards ready, tier, QR = scanId, link back to the card. Stamp/visit cards also get a hero image of the stamp grid, drawn by `gwallet/stamps?b=&p=&g=&r=&v=` (SVG → PNG with @resvg/resvg-js, icons from `assets/js/ui/icons.js`). First test pass worked on 14 Oct (Pizza New). The privacy policy mentions Google Wallet. Apple Wallet comes later ($99/yr Apple Developer).
- Campaigns: pick audience from automatic groups (new/active/loyal/VIP/at risk/inactive), ready-made groups, or custom segments; sending is one-tap WhatsApp links per customer or CSV export.

## Constraints discovered (Syria)
- **Meta lists Syria as ineligible for the WhatsApp Business Platform** — no official automated WhatsApp to Syrian numbers. Unofficial automation risks bans; not used.
- **Twilio blocks all SMS to Syria since 15 Sep 2025.** Some gateways (e.g. SMS.to) claim delivery; a local Syriatel/MTN bulk-SMS provider is likely needed — untested.
- Google services began returning to Syria in Jan 2026; Firebase works from Damascus so far.
- **Apple Wallet and Google Wallet both work for customers in Damascus**: a local coffee shop's Highlight Cards customers add passes to both.
- Automatic messages (welcome, reward ready, tier up, birthday, win-back) are saved with on/off but **nothing sends them yet** — needs a provider + Firebase Cloud Functions (Blaze plan).

## Open items / next steps
- [ ] **Google Wallet setup** — follow GOOGLE_WALLET_SETUP.md: Blaze plan, enable APIs, IAM role, deploy key secret, issuer account + invite the service account, paste the Issuer ID in config.js, test, then official button images + request publishing access.
- [ ] Confirm the latest zip (12 Oct: stamp rounds, admin separation, PNG app icons) is uploaded and rules published.
- [ ] Android install of "My cards" — was failing because live manifest only had an SVG icon; fixed in latest zip. If still stuck: phone lacks Google Play services → use ⋮ → Add to home screen → Create shortcut.
- [ ] Add the registered business name in `config.js → LEGAL.name` and an email when available; have a lawyer review the privacy policy and terms.
- [ ] The 90-day deletion after an account ends is promised in the policy but done by hand for now (no automatic job).
- [ ] Set real plan prices, payment instructions and WhatsApp number in Admin → Billing (placeholders $15/$30/$60).
- [ ] Run `npm run test:rules` once (needs Java) — security rules have never been tested in the emulator.
- [ ] Hardening before real scale: move points/redemption/join into Cloud Functions; Firebase App Check; phone verification; join page currently reveals if a number is already a member.
- [ ] Possible next features: card notifications (push) for automatic messages, pluggable SMS sender, optional group filter on automatic messages, Apple Wallet passes, phone-number recovery of cards, final product name.
