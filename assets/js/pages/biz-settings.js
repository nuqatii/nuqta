// Settings and the Join QR / printable poster.
import { t, fmtDate, ago, lang, unitWord, programName } from '../core/i18n.js';
import { BUSINESS_TYPES } from '../core/loyalty.js';
import { esc, icon, $, showError, toast, qrSvg, svgToPng, download, copyText, legalLinks } from '../ui/ui.js';
import { baseUrl } from '../config.js';

export const joinUrl = (b) => `${baseUrl()}rewards.html?b=${b.slug}`;

export default async function settings(ctx, el, { page }) {
  return page === 'qr' ? qrPage(ctx, el) : settingsPage(ctx, el);
}

function qrPage(ctx, el) {
  const b = ctx.biz; const url = joinUrl(b); const svg = qrSvg(url, { margin: 2 });
  el.innerHTML = `<div class="page-head"><div><h1>${t('qr_title')}</h1><p>${t('qr_sub')}</p></div></div>
  <div class="cols">
    <section class="panel c5"><div class="panel-b stack">
      <div style="background:#fff;border-radius:14px;border:1px solid var(--line);padding:12px;max-width:260px">${svg}</div>
      <label class="field"><span>${t('se_join_link')}</span><div class="row"><input class="input small" readonly value="${esc(url)}" dir="ltr"><button class="btn icon" id="cp" aria-label="${t('copy')}">${icon('copy')}</button></div></label>
      <div class="row wrap"><button class="btn" id="png">${icon('dl')}${t('qr_png')}</button><button class="btn" id="svg">${icon('dl')}${t('qr_svg')}</button>
        <a class="btn ghost" href="${esc(url)}" target="_blank" rel="noopener">${icon('globe')}${lang === 'ar' ? 'افتح الصفحة' : 'Open page'}</a></div>
      <p class="small muted">${t('qr_where')}</p>
    </div></section>
    <section class="panel c7"><div class="panel-h"><h2>${t('qr_poster')}</h2><button class="btn primary" id="print">${icon('receipt')}${t('qr_print_poster')}</button></div>
      <div class="panel-b"><div class="poster print-me" style="--pb:${esc(b.colors?.bg || '#0F6E5C')};color:${esc(b.colors?.text || '#fff')}">
        ${b.logo ? `<img src="${esc(b.logo)}" alt="">` : `<span></span>`}
        <h2>${t('qr_poster_h')}<br><span style="font-weight:500;opacity:.9;font-size:.7em">${esc(programName(b))}</span></h2>
        <div class="qrbox">${qrSvg(url)}</div>
        <p>${t('qr_poster_sub', { unit: unitWord(b.program, b.currency) })}</p>
        <small>${esc(url.replace(/^https?:\/\//, ''))}</small>
      </div></div></section>
  </div>`;
  $('#cp', el).onclick = () => copyText(url);
  $('#svg', el).onclick = () => download(`${b.slug}-join-qr.svg`, svg, 'image/svg+xml');
  $('#png', el).onclick = async () => download(`${b.slug}-join-qr.png`, await svgToPng(svg, 1200));
  $('#print', el).onclick = () => window.print();
}

async function settingsPage(ctx, el) {
  const b = ctx.biz;
  const [audit, contact] = await Promise.all([ctx.S.listAudit(ctx.bid).catch(() => []), ctx.S.ownerContact(ctx.bid).catch(() => ({}))]);
  el.innerHTML = `<div class="page-head"><div><h1>${t('se_title')}</h1></div></div>
  <div class="cols">
    <section class="panel c7"><div class="panel-h"><h2>${t('se_business')}</h2></div><div class="panel-b">
      <form class="form" id="sf">
        <label class="field"><span>${t('ob_name')}</span><input class="input" name="name" value="${esc(b.name)}" maxlength="60" required></label>
        <div class="grid2"><label class="field"><span>${t('ob_type')}</span><select class="input" name="type">${BUSINESS_TYPES.map((x) => `<option value="${x}" ${b.type === x ? 'selected' : ''}>${t('bt_' + x)}</option>`).join('')}</select></label>
        <label class="field"><span>${t('se_currency')}</span><select class="input" name="currency">${['SYP', 'USD', 'LBP', 'EUR', 'CAD'].map((c) => `<option ${b.currency === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label></div>
        <label class="field"><span>${t('se_language')}</span><select class="input" name="lang"><option value="ar" ${b.lang === 'ar' ? 'selected' : ''}>العربية</option><option value="en" ${b.lang === 'en' ? 'selected' : ''}>English</option></select></label>
        <div><button class="btn primary" type="submit">${t('save')}</button></div>
      </form>
      <div class="hr" style="margin:18px 0"></div>
      <form class="form" id="oc">
        <label class="field"><span>${t('ob_owner_phone')}</span><div class="row"><input class="input" name="phone" type="tel" inputmode="tel" dir="ltr" placeholder="09XX XXX XXX" value="${esc(contact.ownerPhone || '')}" style="max-width:240px"><button class="btn" type="submit">${t('save')}</button></div>
        <small>${t('ob_owner_phone_hint')}</small></label>
      </form>
      <div class="hr" style="margin:18px 0"></div>
      <ul class="list">
        <li><span class="grow"><span class="s">${t('se_join_link')}</span><span class="t ltr small">${esc(joinUrl(b))}</span></span><a class="btn sm" href="#/qr">${icon('qr')}</a></li>
        <li><span class="grow"><span class="s">${t('se_plan')}</span><span class="t">${t('plan_' + (b.plan || 'free'))}</span></span></li>
        <li><span class="grow"><span class="s">ID</span><span class="t ltr small">${esc(ctx.bid)}</span></span></li>
      </ul>
      ${ctx.S.mode === 'demo' ? `<div class="hr" style="margin:18px 0"></div><div class="spread"><span class="muted small">${t('demo_banner')}</span><button class="btn danger" id="reset">${t('demo_reset')}</button></div>` : ''}
    </div></section>
    <section class="panel c5"><div class="panel-h"><h2>${t('se_audit')}</h2></div><div class="panel-b"><ul class="list">
      ${''}${audit.slice(0, 40).map((a) => `<li><span class="grow"><span class="t small ltr" style="font-weight:500">${esc(a.action)}</span><span class="s">${esc(a.actorEmail || '—')} · ${ago(a.at)}</span></span></li>`).join('') || `<li class="muted small">—</li>`}
    </ul></div></section>
  </div>
  <div style="margin-top:20px">${legalLinks()}</div>`;
  $('#sf', el).onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    if (!f.name.value.trim()) return f.name.focus();
    try { await ctx.S.updateBusiness(ctx.bid, { name: f.name.value.trim(), type: f.type.value, currency: f.currency.value, lang: f.lang.value }); toast(t('saved')); await ctx.reloadBiz(); }
    catch (err) { showError(err); }
  };
  $('#oc', el).onsubmit = async (e) => {
    e.preventDefault();
    try { const p = await ctx.S.updateOwnerContact(ctx.bid, { phone: e.target.phone.value }); e.target.phone.value = p; toast(t('saved')); } catch (err) { showError(err); }
  };
  $('#reset', el)?.addEventListener('click', async () => { await ctx.S.resetDemo(); localStorage.removeItem('nuqta_bid'); location.replace('login.html'); });
}
