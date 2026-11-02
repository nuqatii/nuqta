// Web push: a real phone notification from the customer's card ("Order #K7P is ready"), within seconds.
// Signed with the VAPID key pair: the public key is in config.js, the private key comes from the
// GitHub secret VAPID_PRIVATE_KEY (written to functions/.env by the deploy). Off until that secret exists.
import webpush from 'web-push';

export function createWebPush({ publicKey, privateKey = process.env.VAPID_PRIVATE_KEY, subject = 'mailto:receipts@nuqatii.com', send = webpush.sendNotification } = {}) {
  const enabled = !!(publicKey && privateKey);
  return {
    enabled: () => enabled,
    // Sends to every subscription; returns the ones the browser says are gone (to delete).
    async notifyAll(subs, payload) {
      if (!enabled) return { sent: 0, gone: [] };
      let sent = 0; const gone = [];
      await Promise.all(subs.map(async (s) => {
        try {
          await send({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { vapidDetails: { subject, publicKey, privateKey }, TTL: 3600, urgency: 'high' });
          sent++;
        } catch (e) { if (e.statusCode === 404 || e.statusCode === 410) gone.push(s.id); else console.error('push', e.statusCode, e.body || e.message); }
      }));
      return { sent, gone };
    },
  };
}
