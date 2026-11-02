# Test site setup: test.nuqatii.com (one time, about 30 minutes)

The test site is a full copy of nuqatii with **its own database**. Fake businesses, orders and customers there never touch the real site.

You upload **the same zip** to both sites. The files notice which address they run on: at `test.nuqatii.com` they use the test database and show a dark red **TEST SITE** bar at the top.

Wallet passes (Google and Apple) stay off on the test site, because they need the real issuer accounts.

## Part 1: Create the test Firebase project
1. Go to https://console.firebase.google.com and click **Add project**. Name it `nuqatii-test`. Analytics: off. Click **Create**.
2. **Authentication** → **Get started** → **Email/Password** → turn on → **Save**.
3. Still in Authentication, open **Settings → Authorized domains → Add domain** and add `test.nuqatii.com`.
4. **Firestore Database** → **Create database**. Choose the same location as your real project if you know it, otherwise `eur3 (europe)`. Start in **production mode**.
5. **Project settings** (the gear) → **Your apps** → click the **</>** web icon. Nickname: `test site` → **Register app**. Firebase shows a block called `firebaseConfig` with `apiKey`, `authDomain`, `projectId`, and so on.
6. **Send that block to Claude.** It's safe to share, because these values are public in every website. Claude puts it in `config.js` and sends the zip back.

## Part 2: Create the test repository on GitHub
1. GitHub → **New repository** → name `nuqta-test`. **Public**, so GitHub Pages is free.
2. Upload everything from the zip, the same as for the real site.
3. **Settings → Pages** → Source: **Deploy from a branch**, branch `main`, folder `/ (root)` → **Save**.
4. In **Custom domain**, type `test.nuqatii.com` → **Save**. GitHub creates a file called `CNAME` in this repository. **Leave it there.**

> The zip no longer contains a `CNAME` file, so uploading it never overwrites either site's domain. Your real repository keeps its own `CNAME` (`nuqatii.com`).

## Part 3: Point test.nuqatii.com at GitHub (GoDaddy)
GoDaddy → **My Products → nuqatii.com → DNS → Add New Record**:
- Type: `CNAME`
- Name: `test`
- Value: `nuqatii.github.io`

Wait for **DNS check successful** in GitHub Pages, then tick **Enforce HTTPS**.

## Part 4: Let GitHub deploy the test database rules
1. In the **Google Cloud console**, switch the project at the top to `nuqatii-test`. Then create a service account exactly like Part 4 of `GOOGLE_WALLET_SETUP.md`:
   - **IAM & Admin → Service Accounts → Create service account**.
   - Name `github-deploy`, role **Editor**.
   - Open it → **Keys** → **Add key → JSON**.
2. In the **nuqta-test** repository, open **Settings → Secrets and variables → Actions**:
   - **Secrets** tab → **New repository secret** → `FIREBASE_SERVICE_ACCOUNT` → paste the JSON file's contents.
   - **Variables** tab → **New repository variable**:
     - `FIREBASE_PROJECT` = the test project's id (for example `nuqatii-test`, as shown in Firebase project settings)
     - `FIREBASE_DEPLOY` = `firestore:rules`
3. Delete the downloaded JSON file.
4. **Actions → Deploy to Firebase → Run workflow** and wait for the green ✓.

The test project only needs its rules deployed. It runs on the free plan; no server function or billing is needed.

## Part 5: Your accounts on the test site
1. Open https://test.nuqatii.com/login.html. You should see the red TEST SITE bar.
2. **Sign up a test admin** with your own email, and confirm it from the email.
3. In the Firebase console (`nuqatii-test`), go to **Firestore → Start collection**:
   - Collection id: `platformAdmins`
   - Document id: your test admin's **User UID** (from Authentication → Users)
   - Field: `at`, type number, value `1`

   Sign in again, and you're in the test admin portal.
4. **Sign up a second account** for a test café (another email, or `yourname+cafe@gmail.com`) and create the business.

## Part 6: Try online ordering
1. In the **test admin portal**:
   - **Settings** tab → tick **Online ordering (pilot)**.
   - Open the test café → tick **Online ordering (pilot)**.
2. As the café, open **Menu** and add a few items with prices.
3. On your phone, open the café's join link (**QR code & poster** page), join, and open the **Order** tab on the card. Order something.
4. On the laptop, the order appears on **Orders** with a sound. Tap **Accept → Ready → Collected**, and check the card on the phone updates at each step, then shows the new points or stamps.

When you're happy, upload the same zip to the real repository. Ordering stays **off for everyone** there until you tick both switches for a business.
