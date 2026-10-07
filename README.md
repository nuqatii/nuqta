# Nuqta · نقطة — loyalty cards + CRM for local businesses

Multi-tenant SaaS MVP: each business gets its own branded digital loyalty card, rewards, tiers, customer list, segments, campaigns and staff accounts. Customers join by scanning a QR code — no app, no password. Arabic-first with full English, RTL/LTR.

*"Nuqta" is a placeholder name — change `APP_NAME` in `assets/js/config.js`.*

Static site (HTML/CSS/JS modules, no build step) + Firebase Auth + Firestore. Hosts on GitHub Pages.

---

## Try it in 30 seconds (demo mode)

```bash
python3 -m http.server 8080     # or: npm start
# open http://localhost:8080
```

Demo mode runs entirely in the browser (localStorage) and is seeded with **Joe's Pizza**: 250 members, ~1,200 purchases over six months, 4 tiers, 5 rewards, 2 campaigns, 2 branches — plus a second tenant, **Urban Coffee** (stamp card), so you can see isolation.

| Sign in as | Email | Sees |
|---|---|---|
| Owner | `owner@joespizza.demo` | everything |
| Cashier | `staff@joespizza.demo` | checkout, customers, activity |
| Marketing | `marketing@joespizza.demo` | segments, campaigns, analytics |
| Platform admin | `admin@nuqta.demo` | all businesses (no customer PII) |

Password for all: `demo1234`. The landing page also links to Maya's customer card and the join page. A reward code **R-DEMO42** is waiting in Checkout → Reward code.

Open the cashier in one tab and a customer card in another — the demo store syncs between tabs.

---

## Go live with Firebase

1. **Create a Firebase project** → add a Web app → copy its config.
2. **Authentication** → enable *Email/Password*. Add your domain (e.g. `yourname.github.io` or your custom domain) under *Authorized domains*.
3. **Firestore** → create database (production mode).
4. In `assets/js/config.js`: paste the config into `FIREBASE` and set `MODE: 'firebase'`.
5. Deploy rules + indexes:
   ```bash
   npm install
   npx firebase login
   npx firebase use --add          # pick your project
   npm run deploy:rules
   ```
6. **Make yourself platform admin**: sign up in the app, then in the Firestore console create document `platformAdmins/<your auth uid>` with any field (e.g. `{ at: 1 }`). Admins can only be added from the console.
7. **Publish** — push the folder to a GitHub repo and enable Pages (root). `404.html` gives you pretty links: `/join/<slug>` and `/c/<token>`.

Append `?mode=demo` to any URL to see the demo even after switching to Firebase.

---

## How it's built

```
index.html          sign in / sign up / demo accounts
app.html            business portal (hash router, role-aware)
rewards.html        customer: join (?b=slug) and card app (?c=token) — PWA
admin.html          platform admin
assets/js/
  config.js         ← the only file to edit when going live
  core/loyalty.js   pure rules: earning, tiers, segments, codes, phone normalisation, role matrix
  core/i18n.js      Arabic + English strings, number/date/currency formatting
  data/service.js   every read/write — one implementation for both backends
  data/db-firestore.js / db-memory.js   storage adapters with the same interface
  ui/card.js        the loyalty card (laid out like a Wallet pass)
  pages/biz-*.js    one module per business page
firestore.rules     tenant isolation + roles, enforced server-side
tests/              logic/service tests, i18n completeness, security-rules tests
```

### Data model (Firestore)

| Path | What | Who can read |
|---|---|---|
| `businesses/{bid}` | name, slug, branding, card design, program, tiers, status, plan | public (powers join/card pages) |
| `businesses/{bid}/members/{uid}` | staff account + role | the member, owner |
| `businesses/{bid}/invites/{email}` | pending staff invites | owner, invitee |
| `businesses/{bid}/customers/{cid}` | CRM profile + balances | business members |
| `businesses/{bid}/activity/{id}` | immutable ledger: join, purchase, redeem, adjust, tier | owner, manager, cashier |
| `businesses/{bid}/rewards/{rid}` | reward catalogue | public |
| `businesses/{bid}/redemptions/{code}` | reward codes (pending → redeemed once) | cashiers |
| `businesses/{bid}/locations · segments · campaigns(/recipients) · templates · audit · private` | | by role |
| `businesses/{bid}/phones/{e164}` | one-member-per-phone lock | get only |
| `cards/{token}` (+ `/activity`, `/redemptions`) | the customer's card: member no., balance, tier, pass ID, QR/barcode values, wallet status | anyone holding the 24-char secret token |
| `stats/{bid}` | usage counters for billing/admin | members, platform admin |
| `slugs/{slug}`, `platform/settings`, `platformAdmins/{uid}` | | |

Spec tables map onto this as: Users → Firebase Auth; StaffMembers → `members`; LoyaltyPrograms/CardDesigns/MembershipTiers/BusinessSettings → fields on the business doc (one read for the customer page); Transactions + PointsTransactions → `activity`; Subscriptions → `plan` + `private/settings.subscription`; Notifications → `templates`; CampaignRecipients → `campaigns/{id}/recipients`.

### Roles

| | Owner | Manager | Cashier | Marketing |
|---|:-:|:-:|:-:|:-:|
| Checkout, reward codes | ✓ | ✓ | ✓ | |
| Customers | ✓ | ✓ | ✓ | ✓ |
| Activity log | ✓ | ✓ | ✓ | |
| Rewards, program & tiers, locations | ✓ | ✓ | | |
| Segments | ✓ | ✓ | | ✓ |
| Campaigns, message templates | ✓ | | | ✓ |
| Card designer, team, settings | ✓ | | | |

Staff are invited by email; when they sign up with that email they get the role automatically.

### Ready for later

- **Apple / Google Wallet** — every card has `passId`, `memberNumber`, `qrValue`, `barcodeValue`, `walletStatus`, and the business doc has `designVersion`. `walletFields()` in `ui/card.js` already maps a card to storeCard pass fields. Adding wallet = a Cloud Function that signs passes and re-pushes on `cards/{token}` updates.
- **WhatsApp / SMS / email** — campaigns produce a recipient list with personalised text (consented customers only); today staff send via one-tap WhatsApp links or CSV. A provider plugs into `prepareCampaign()` / templates.
- **Multi-location** — purchases already record `locationId`; analytics break revenue down by branch.
- **Subscriptions** — `plan` on each business, `private/settings.limits` reserved; admin changes plans. Nothing is limited yet.
- **Custom domains** — each business has a `slug`; the customer page reads branding from the business doc, so `rewards.joespizza.com` only needs routing.

---

## Before real customers: hardening checklist

These are deliberate MVP trade-offs, listed so they don't get forgotten:

1. **Points math runs on the client.** Rules restrict *who* can write and *which fields*, but a malicious cashier account could write any balance. Move `recordPurchase` / `redeemCode` / `joinProgram` into Cloud Functions (callable) and lock those fields in the rules.
2. **No rate limiting on the public join.** Turn on Firebase **App Check** (reCAPTCHA Enterprise) and consider a Function-based join.
3. **The join page reveals whether a phone is already a member** (phone lock is publicly readable, needed for uniqueness without a server). A Function-based join removes this.
4. **No phone verification.** Anyone can join with any number. Firebase Phone Auth (SMS OTP) works, but check SMS deliverability to Syrian numbers first; WhatsApp OTP via a provider may be more reliable.
5. **Rules tests haven't been executed yet** — the build sandbox couldn't download the Firestore emulator. Run `npm run test:rules` (needs Java) before going live.
6. Customer pages poll every 8 s; switch to Firestore `onSnapshot` for instant updates and fewer reads.
7. Logos/covers are stored as small data URLs on the business doc (no Storage setup needed). Move to Firebase Storage if designs get heavy.

## Tests

```bash
npm test             # loyalty logic, service journeys, tenant isolation, i18n completeness
npm run test:rules   # Firestore security rules in the emulator (Java required)
```
