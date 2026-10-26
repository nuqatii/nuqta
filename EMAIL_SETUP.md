# Email receipts setup (one time, about 15 minutes)

Receipts are always saved and printable on the owner's **Subscription** page. This setup makes nuqatii also **email** each receipt to the owner from `receipts@nuqatii.com`.

It uses **Resend** (resend.com). The free plan sends up to 3,000 emails a month (100 a day), which is plenty for receipts.

## Part 1: Create a Resend account
1. Go to https://resend.com and click **Get started**. Sign up with your Google account.

## Part 2: Add your domain
1. In Resend, open **Domains → Add domain**.
2. Type `nuqatii.com`. For the region, choose **Ireland (eu-west-1)**.
3. Resend shows a list of DNS records, usually 3 or 4: an **MX** and a **TXT** record named `send`, a **TXT** record named `resend._domainkey`, and sometimes an optional `_dmarc` record.

## Part 3: Add the records in GoDaddy
1. GoDaddy → **My Products → nuqatii.com → DNS → Add New Record**, once for each record Resend shows.
2. In the **Name** field type only the first part (for example `send` or `resend._domainkey`). GoDaddy adds `.nuqatii.com` by itself. If GoDaddy asks "Let's double check…", choose **Yes**.
3. For the MX record, use the priority Resend shows (usually 10).
4. Don't change the records you already have: the website (A and `www`) and the Firebase email records.
5. Back in Resend, click **Verify DNS records**. It can take from a few minutes to a few hours.

> Send Claude a screenshot of the records if anything is unclear.

## Part 4: Create the key and give it to GitHub
1. In Resend, open **API Keys → Create API key**. Name it `nuqatii receipts` and give it **Sending access**. Copy the key; it starts with `re_`.
2. In GitHub, open **Settings → Secrets and variables → Actions → New repository secret**.
   - Name: `RESEND_API_KEY`
   - Value: paste the key.
3. Open **Actions → Deploy to Firebase → Run workflow** (or upload any change) and wait for the green ✓.

## Test
In **Admin → Businesses**, click **Record payment** on a test business, leave **Email the receipt to the owner** ticked, and save. The owner's sign-up email should get the receipt within a minute. You can also open the business, click **Receipt** next to a payment, and use **Email to owner** / **Email again**.

## How it works (reference)
- Every payment gets a receipt number like `NQ-2026-0001`. The running number is kept in Firestore `platform/counters`.
- The email is sent by the server function at `gwallet/receipt`. Only the platform admin can trigger it. It goes to the email the owner signed up with (`businesses/{id}/private/settings.ownerEmail`), in the business's language.
- After sending, the payment is marked with `emailedAt` and `emailedTo`, which show on the admin's business page.
- Until `RESEND_API_KEY` exists, recording a payment still works and the receipt is still in the dashboard. You'll just see "Email sending isn't set up yet".
