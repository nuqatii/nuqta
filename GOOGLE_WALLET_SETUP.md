# Google Wallet — one-time setup

Everything here is done in the browser — no command line. It takes about 30–45 minutes the first time.
Do the parts **in order**.

You will use four websites, all signed in with the Google account that owns the Firebase project:

| | |
|---|---|
| Firebase console | https://console.firebase.google.com → project **nuqati-39894** |
| Google Cloud console | https://console.cloud.google.com → pick project **nuqati-39894** at the top |
| Google Pay & Wallet console | https://pay.google.com/business/console |
| GitHub | https://github.com/nuqatii/nuqta |

**Your function's service account** (you'll paste it twice below):
```
605724800372-compute@developer.gserviceaccount.com
```
The number at the start is your **project number**. Check it in Firebase → ⚙️ Project settings → General → *Project number*. If it is different, use your number instead.

---

## Part 1 — Switch Firebase to the Blaze plan (pay as you go)

1. Firebase console → bottom-left **Spark** → **Upgrade** → choose **Blaze** → add a card.
2. Set a **budget alert** when asked (for example $5/month). It only emails you; it does not stop anything.

At your size this should cost $0: the free allowance covers about 2 million function calls a month.

## Part 2 — Turn on the Google APIs

Google Cloud console → ☰ → **APIs & Services → Library**. Search for each of these, open it, and click **Enable**:

1. **Google Wallet API**
2. **IAM Service Account Credentials API** (lets the function sign passes without a key file)
3. **Compute Engine API** (this creates the service account above; it costs nothing by itself)
4. **Cloud Billing API** (the deploy checks that the project is on Blaze)

## Part 3 — Let the function sign Wallet links

Google Cloud console → ☰ → **IAM & Admin → IAM** → **Grant access**:
- **New principals:** `605724800372-compute@developer.gserviceaccount.com`
- **Role:** *Service Account Token Creator*
- **Save**

## Part 4 — Let GitHub deploy for you (deploy key)

From now on, GitHub publishes the server function **and your `firestore.rules`** automatically whenever you upload them. You no longer paste rules into Firebase by hand.

**4a. Create the deploy account.** Google Cloud console → **IAM & Admin → Service Accounts** → **+ Create service account**:
- Name: `github-deploy` → **Create and continue**
- Add these 4 roles (use **+ Add another role**):
  - *Editor*
  - *Cloud Functions Admin*
  - *Cloud Run Admin*
  - *Service Account User*
- **Done**

**4b. Make its key.** Click the new `github-deploy` account → **Keys** tab → **Add key → Create new key → JSON**. A `.json` file downloads.

**4c. Give the key to GitHub.** GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:
- Name: `FIREBASE_SERVICE_ACCOUNT`
- Secret: open the `.json` file in Notepad, select all, copy, and paste it here
- **Add secret**

Then **delete the downloaded `.json` file** from your computer. GitHub keeps it encrypted, and nobody can read it back, not even you.

## Part 5 — Upload the new files

Upload the zip contents to GitHub as usual. This time there are three new things:
- the `functions` folder
- the `.github` folder, which holds the deploy instructions
- `.firebaserc`

If GitHub refuses to upload the `.github` folder, use **Add file → Create new file** instead:
- File name: `.github/workflows/firebase-deploy.yml` (typing the `/` creates the folders)
- Content: paste the contents of that file from the zip
- **Commit**

Then open the repo's **Actions** tab:
- **Deploy to Firebase** runs for 3–5 minutes and should end with a green ✓.
- If it ran before you added the secret, it shows a yellow warning instead. Open **Deploy to Firebase → Run workflow** to run it again.
- If it fails (red ✗), open it, copy the red lines, and send them to Claude.

## Part 6 — Create your Google Wallet issuer account

1. Open https://pay.google.com/business/console and create your business profile when asked.
2. In the left menu, open **Google Wallet API**. Copy your **Issuer ID**, a long number.
3. Left menu → **Users** → **Invite a user**:
   - Email: `605724800372-compute@developer.gserviceaccount.com`
   - Access level: **Developer**
   - **Invite**
4. Also invite the Gmail address of your test phone (and anyone helping you test). Google starts every new account in **demo mode**: only people listed here can save passes, and the passes show "TEST ONLY".

## Part 7 — Switch it on

On GitHub, open `assets/js/config.js` → ✏️ edit → paste your Issuer ID:
```js
GOOGLE_WALLET: {
  issuerId: '3388000000012345678',   // ← your Issuer ID
```
Commit. GitHub redeploys the function by itself; watch the Actions tab for the green ✓.

**Test:** on an Android phone signed in with a Gmail account you invited in Part 6, open a customer card. Then:
1. Tap **Add to Google Wallet**, then tap **Save**. The card appears in Google Wallet.
2. Add a purchase for that customer at the checkout. Within a minute or two the points change in Google Wallet too.

## Part 8 — Go live for everyone (Google review)

While in demo mode only invited accounts can save passes. To open it to all customers:

1. Download Google's official **"Add to Google Wallet"** button images. In the Wallet developer documentation, open *Loyalty cards → Brand guidelines* and get the **Arabic** and **English** SVG buttons.
2. Rename them `gwallet-ar.svg` and `gwallet-en.svg` and upload them to `assets/img/`.
3. In `config.js`, set `officialButton: true` and commit. Google requires its official button before approval.
4. Pay & Wallet console → **Google Wallet API** → **Request publishing access**. Fill in the business details and attach a screenshot of a pass. Google usually answers within a few working days.

---

## How it works (for reference)

- **Adding a card:** the customer taps **Add to Google Wallet** on their card page. The function `gwallet` (region europe-west1) does three things:
  - builds the business's card design (name, colour, logo) and the customer's pass (first name, member number, balance, rewards ready, tier, QR code)
  - saves the pass at Google
  - opens Google's "Save" screen

  No customer sign-in is needed.
- **Updating points:** after every purchase, redemption, points adjustment or name change, the cashier's browser quietly tells the function to refresh that customer's pass. This only happens for customers who added the card to Google Wallet.
- **Changing the design:** changing the business name, logo, colours or program name in Settings or the Card designer refreshes the design on everyone's passes.
- **New phone:** the pass comes back with the customer's Google account. If it doesn't, they open their card link and tap the button again; nothing is duplicated.
- **Data deletion:** deleting a customer turns their pass inactive and removes their name from it.
- **Not updated automatically yet:** if you change a reward's cost on a stamp card, passes show the new goal at that customer's next visit.

## Troubleshooting

| What you see | Fix |
|---|---|
| Actions: *"Permission denied"* or *"does not have permission"* | Check the 4 roles in Part 4a, then **Run workflow** again |
| Actions: *"Cloud Billing API has not been used…"* | Enable **Cloud Billing API** (Part 2), wait 2 minutes, then **Run workflow** |
| Actions: *"Default service account … does not exist"* | Enable **Compute Engine API** (Part 2), wait 2 minutes, then run again |
| Actions: build fails mentioning *Cloud Build* | IAM → find `605724800372-compute@…` → add role *Cloud Build Service Account* → run again |
| The button opens a page saying *"Google Wallet is not set up yet"* | `issuerId` is empty, or the deploy after editing `config.js` hasn't finished |
| The button says *"Could not add the card…"* | Firebase console → Functions → `gwallet` → Logs. The red line usually says what is missing (Part 2, 3 or 6) |
| Google shows *"Something went wrong"* or *"not authorized"* | The function's service account isn't invited in Part 6, or your test Gmail isn't invited while in demo mode |
