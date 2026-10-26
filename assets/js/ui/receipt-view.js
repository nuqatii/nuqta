// Opens a subscription receipt in a dialog: read it, switch language, print it, or (admin) email it.
import { t, lang as uiLang } from '../core/i18n.js';
import { receiptHtml, receiptNumber } from '../core/receipt.js';
import { CONFIG } from '../config.js';
import { modal, printDoc, toast, showError, icon, $ } from './ui.js';

export async function showReceipt(S, bid, pid, { admin = false, onEmailed } = {}) {
  const d = await S.receiptData(bid, pid);
  let L = uiLang === 'en' ? 'en' : 'ar';
  const issuer = () => ({ name: CONFIG.APP_NAME[L] || CONFIG.APP_NAME.en, site: CONFIG.SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, ''), whatsapp: CONFIG.LEGAL.whatsapp, email: CONFIG.LEGAL.email });
  const html = () => receiptHtml({ p: { id: pid, ...d.p }, biz: d.biz, ownerEmail: d.ownerEmail, lang: L, issuer: issuer() });
  const emailed = d.p.emailedAt ? `<p class="small muted" style="margin:10px 0 0">${icon('check')} ${t('rc_emailed', { to: d.p.emailedTo || d.ownerEmail })}</p>` : '';
  return modal({ title: `${t('rc_title')} ${receiptNumber({ id: pid, ...d.p })}`, wide: true,
    body: `<div class="row" style="justify-content:flex-end;margin-bottom:10px"><button class="btn ghost sm" id="rcLang">${icon('globe')}${L === 'ar' ? 'English' : 'العربية'}</button></div>
      <div class="receipt-wrap" id="rcBox">${html()}</div>${emailed}`,
    onMount: (m) => { $('#rcLang', m).onclick = (e) => { L = L === 'ar' ? 'en' : 'ar'; $('#rcBox', m).innerHTML = html(); e.currentTarget.lastChild.textContent = L === 'ar' ? 'English' : 'العربية'; }; },
    actions: [
      { label: t('close'), value: null },
      ...(admin ? [{ label: d.p.emailedAt ? t('rc_resend') : t('rc_email'), onClick: async () => {
        try { const r = await S.adminEmailReceipt(bid, pid); toast(t('rc_emailed', { to: r.to })); onEmailed?.(); }
        catch (e) { if (e.code === 'email-off' || e.message === 'email-off') toast(t('rc_email_off'), 'bad'); else showError(e); }
        return false;
      } }] : []),
      { label: t('rc_print'), kind: 'primary', onClick: () => { printDoc(html()); return false; } },
    ] });
}
