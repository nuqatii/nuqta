// Sends email through Resend (resend.com). Off until the GitHub secret RESEND_API_KEY exists
// (the deploy writes it into functions/.env). See EMAIL_SETUP.md.
export function createMailer({ apiKey = process.env.RESEND_API_KEY, from = process.env.EMAIL_FROM || 'nuqatii <receipts@nuqatii.com>', fetchFn = globalThis.fetch } = {}) {
  return {
    enabled: () => !!apiKey,
    async send({ to, subject, html, text, replyTo }) {
      if (!apiKey) { const e = new Error('email-off'); e.code = 'email-off'; throw e; }
      const r = await fetchFn('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
      });
      const out = await r.json().catch(() => ({}));
      if (!r.ok) { const e = new Error(out?.message || `Resend ${r.status}`); e.status = r.status; throw e; }
      return out.id;
    },
  };
}
