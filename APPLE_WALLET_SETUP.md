# Apple Wallet setup (one time)

Everything runs in the browser, and you don't need a Mac. Most of the waiting is for Apple to approve your developer account.
The server side is already built and deploys with the rest of Nuqta. It stays switched off until these steps are done.

## Part 1: Join the Apple Developer Program (individual)

1. Go to https://developer.apple.com/programs/enroll and sign in with your Apple ID. Two-factor authentication must be on.
2. Choose **Individual / Sole Proprietor**. Use your real legal name and your address in Lebanon, the same as your Google profile.
3. Pay $99/year. Apple usually approves within 1–2 days and sends you an email.

## Part 2: Find your Team ID

Go to https://developer.apple.com/account and open **Membership details**. Copy your **Team ID** (10 letters and numbers).

## Part 3: Create a Pass Type ID

1. Go to **Certificates, Identifiers & Profiles**, then **Identifiers**, then **+**, then **Pass Type IDs**, then **Continue**.
2. Description: `Nuqta loyalty cards`.
3. Identifier: `pass.io.github.nuqatii.cards`. If Apple says it is taken, add a word, for example `pass.io.github.nuqatii.loyalty`.
4. Click **Register**.

**Send Claude the Team ID and the Pass Type ID.** Claude replies with a file named `nuqta.certSigningRequest`.

## Part 4: Create the pass certificate

1. Go to **Identifiers**, open your Pass Type ID, then **Create Certificate**.
2. Upload `nuqta.certSigningRequest`, then click **Continue**, then **Download**. You get a file named `pass.cer`.
3. **Send `pass.cer` to Claude.** Claude replies with two small text files: `APPLE_PASS_CERT.txt` and `APPLE_PASS_KEY.txt`.

## Part 5: Give the keys to GitHub

Open GitHub, then **Settings**, then **Secrets and variables**, then **Actions**, then **New repository secret**. Add two secrets:
- `APPLE_PASS_CERT`: paste the whole content of `APPLE_PASS_CERT.txt`.
- `APPLE_PASS_KEY`: paste the whole content of `APPLE_PASS_KEY.txt`.

Then **delete both .txt files** from your computer. GitHub keeps them encrypted.

## Part 6: Add Apple's public certificate

1. Download **Worldwide Developer Relations - G4** from https://www.apple.com/certificateauthority/. The file is `AppleWWDRCAG4.cer`.
2. In GitHub, open the folder `functions/apple`, then **Add file**, then **Upload files**, and upload `AppleWWDRCAG4.cer`. This certificate is public, so it is safe in the repository.

## Part 7: Switch it on

Upload the `config.js` Claude sends you. It has `APPLE_WALLET.passTypeId` and `teamId` filled in. Then wait for the green ✓ in **Actions**.

**Test:** on an iPhone, open a customer card in **Safari**, refresh the page, tap **Add to Apple Wallet**, then tap **Add**.
Then record a purchase for that customer. Within a minute the pass updates by itself and shows a notification on the phone.

> Open the card in Safari. Links opened inside WhatsApp or Instagram may not offer "Add". Use **Open in Safari** first.

## Part 8: Official badge (before telling customers)

Apple asks that apps use its official **Add to Apple Wallet** badge.
1. Download the badges from Apple's Wallet marketing guidelines page at https://developer.apple.com/wallet/add-to-apple-wallet-guidelines/. Get both the Arabic and the English SVG.
2. Upload them as `assets/img/applewallet-ar.svg` and `assets/img/applewallet-en.svg`, or send them to Claude.
3. Set `APPLE_WALLET.officialButton: true` in `config.js`.

## Every year

The pass certificate expires after 12 months. Repeat Parts 4 and 5 before it expires. Passes already on phones keep working, but they stop updating until it is renewed.

## How it works (reference)

- The button downloads `gwallet/apple/pass?t=<card token>`, a signed `.pkpass` file. Each card has its own serial number, `<businessId>_<customerId>`, and uses its secret card token as the pass's authentication token.
- iPhones register at `gwallet/apple/v1/...`, which is Apple's standard pass web service. Registrations are stored in Firestore `appleRegs`, and pass versions in `applePasses`. Both are server-only, so the website can't read them.
- After a purchase, redemption, points adjustment, name change or deletion, the site pings `gwallet/sync`. The function marks the pass changed and sends Apple a silent push, and the iPhone then downloads the new version.
- Stamp cards get the same stamp-circle image as Google, sized for Apple's "strip" area.
- iPhone users see only the Apple button and Android users only the Google button. Computers show both.

## Troubleshooting

| Problem | Fix |
|---|---|
| The button opens "Apple Wallet is not set up yet" | Check `passTypeId`/`teamId` in config.js, the two GitHub secrets, and `functions/apple/AppleWWDRCAG4.cer`. Then run the deploy again. |
| Safari says "Safari cannot download this file" | The pass was rejected, usually because the certificate doesn't match the Pass Type ID. Check the Firebase function logs for `apple`. |
| The pass doesn't update after a purchase | Pull down on the pass back to refresh. Check the logs for `apns`. The certificate may be expired. |
