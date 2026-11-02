# Order-ready phone notifications (web push): one-time setup

When staff tap **Ready** (or **Decline**) on an order, the customer gets a real phone notification within seconds: "Order #K7P is ready ☕". Tapping it opens their card on the Order tab.

## Setup (2 minutes)
1. GitHub → **Settings → Secrets and variables → Actions → New repository secret**:
   - Name: `VAPID_PRIVATE_KEY`
   - Value: the whole content of `VAPID_PRIVATE_KEY.txt` (Claude sent it; one line).
2. Delete `VAPID_PRIVATE_KEY.txt` from your computer.
3. Upload the zip, or run **Actions → Deploy to Firebase → Run workflow**, and wait for the green ✓.

The public half of the key is already in `config.js` (`PUSH_PUBLIC_KEY`). It's meant to be public.

## How customers turn it on
- When they send an order, the box **"Notify me on this phone when it's ready"** is ticked. The phone asks once to allow notifications; they tap **Allow**.
- Or they tap **Notify me when it's ready** on an order in progress.

## Which phones
| Phone | Works? |
|---|---|
| Android (Chrome, Samsung Internet, Edge) | Yes, even with the browser closed |
| Computer (Chrome, Edge, Firefox) | Yes |
| iPhone | Only after adding the card to the **Home Screen** (Share → Add to Home Screen). The card shows this tip. iOS 16.4 or newer. |

The Google Wallet message is still sent too, but Google decides when the phone shows that one.

## Reference
- Phone subscriptions are stored in `cards/{token}/push/{id}`. Only the server can read them (rules); browsers can only add their own.
- The server sends from `POST gwallet/order-ready` (staff only) with the `web-push` library, and deletes subscriptions the browser reports as gone.
- If you ever replace the key pair, everyone has to allow notifications again.
