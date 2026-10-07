// Staff checkout: identify → amount → done. Keyboard-first, scanner optional.
import { t, fmtNum, fmtMoney, unitWord, tierName, rewardName, ago, fmtDate, lang, curLabel } from '../core/i18n.js';
import { earnFor, tierFor, rewardIsLive, normalizePhone, toLatinDigits, parseAmount } from '../core/loyalty.js';
import { esc, icon, $, avatar, fullName, showError, toast, modal, errText } from '../ui/ui.js';
import { addCustomerDialog } from './biz-customers.js';
import { evName } from './biz-common.js';

let scanner = null;
async function stopScanner() { if (scanner) { try { await scanner.stop(); } catch {} try { scanner.clear(); } catch {} scanner = null; } }

export default async function checkout(ctx, el, { params }) {
  const b = ctx.biz; const unit = unitWord(b.program, b.currency);
  const [customers, rewards, locations] = await Promise.all([ctx.customers(), ctx.S.listRewards(ctx.bid), ctx.S.listLocations(ctx.bid)]);
  const st = { tab: 'sale', customer: null, result: null, location: localStorage.getItem('nuqta_loc_' + ctx.bid) || locations[0]?.id || 'main' };
  if (params[0]) st.customer = customers.find((c) => c.id === params[0]) || null;
  const needsAmount = b.program.type === 'points' || b.program.type === 'spend';
  const needsQty = b.program.type === 'stamps';
  addEventListener('hashchange', stopScanner, { once: true });
  // One delegated listener for every customer pick (suggestions, recent list).
  el.onclick = (e) => { const p = e.target.closest('[data-pick]'); if (p) pick(p.dataset.pick); };

  function search(q) {
    q = toLatinDigits(q).trim().toLowerCase(); if (!q) return [];
    const digits = q.replace(/\D/g, '');
    const tail = digits.replace(/^0/, '');
    return (ctx._customers || customers).filter((c) =>
      (digits.length >= 3 && (c.phone.replace(/\D/g, '').includes(tail) || c.memberNumber.includes(digits))) ||
      (c.scanId || '').toLowerCase() === q ||
      fullName(c).toLowerCase().includes(q) || (c.email && c.email.includes(q))).slice(0, 6);
  }

  function render() {
    el.innerHTML = `<div class="co-wrap stack">
      <div class="spread"><h1>${t('co_title')}</h1>
        ${locations.length > 1 ? `<select class="input" id="loc" style="width:auto;min-height:38px" aria-label="${t('nav_locations')}">${locations.map((l) => `<option value="${l.id}" ${l.id === st.location ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select>` : ''}</div>
      <div class="seg" role="tablist">
        <button role="tab" data-tab="sale" aria-pressed="${st.tab === 'sale'}">${t('co_tab_sale')}</button>
        <button role="tab" data-tab="code" aria-pressed="${st.tab === 'code'}">${t('co_tab_code')}</button>
      </div>
      <div id="co-body">${st.tab === 'code' ? codeView() : st.result ? resultView() : st.customer ? amountView() : findView()}</div>
    </div>`;
    bind();
  }

  // ── Find ─────────────────────────────────────────────
  function findView() {
    return `<section class="panel"><div class="panel-b stack">
      <label class="field"><span>${t('co_find')}</span>
        <div class="co-find"><input class="input" id="q" autocomplete="off" inputmode="search" placeholder="${t('co_find_ph')}" autofocus>
        <button class="btn lg" id="scan" aria-label="${t('co_scan')}">${icon('camera')}<span class="hide-sm">${t('co_scan')}</span></button></div></label>
      <div id="sugg"></div>
      <div id="scanbox" hidden><div class="scan-box"><div id="reader"></div></div><p class="small muted" style="margin-top:8px">${t('co_scan_hint')}</p>
        <button class="btn block" id="scanstop" style="margin-top:8px">${t('co_scan_stop')}</button></div>
    </div></section>
    ${recentStrip()}`;
  }
  function recentStrip() {
    const recent = (ctx._customers || customers).filter((c) => c.lastVisitAt).sort((a, c) => c.lastVisitAt - a.lastVisitAt).slice(0, 5);
    if (!recent.length) return '';
    return `<section class="panel"><div class="panel-h"><h3 class="small muted" style="font-weight:500">${t('co_last_visit', { d: '' }).trim()}</h3></div><div class="panel-b"><ul class="list">
      ${recent.map((c) => `<li data-pick="${c.id}" style="cursor:pointer">${avatar(c)}<span class="grow"><span class="t">${esc(fullName(c))}</span><span class="s ltr">${esc(c.phone)}</span></span><span class="small muted">${ago(c.lastVisitAt)}</span></li>`).join('')}
    </ul></div></section>`;
  }
  function suggestions(q) {
    const box = $('#sugg', el); if (!box) return;
    const res = search(q);
    if (!q.trim()) { box.innerHTML = ''; return; }
    if (!res.length) {
      const phone = normalizePhone(q);
      box.innerHTML = `<div class="note">${icon('info')}<div class="stack" style="gap:8px"><span>${t('co_no_match', { q: esc(q) })}</span>
        ${ctx.can('customers') && phone ? `<button class="btn sm" id="addnew">${icon('plus')}${t('co_add_instead')}</button>` : ''}</div></div>`;
      $('#addnew', el)?.addEventListener('click', async () => {
        const r = await addCustomerDialog(ctx, { phone: q });
        if (r) { st.customer = (await ctx.customers()).find((c) => c.id === r.customerId); render(); }
      });
      return;
    }
    box.innerHTML = `<div class="suggest" role="listbox">${res.map((c, i) => `<button role="option" data-pick="${c.id}" ${i === 0 ? 'data-first' : ''}>${avatar(c)}<span class="grow" style="min-width:0"><b style="display:block;font-weight:500">${esc(fullName(c))}</b><span class="small muted ltr">${esc(c.phone)} · #${esc(c.memberNumber)}</span></span><span class="pts">${fmtNum(c.points)}</span></button>`).join('')}</div>`;
  }
  async function resolveExact(raw) {
    const v = toLatinDigits(raw).trim();
    if (/^R-?[A-Z0-9]{4,}$/i.test(v) && !/^\d+$/.test(v)) { st.tab = 'code'; render(); $('#code', el).value = v.toUpperCase(); return verify(); }
    const local = search(v);
    if (local.length === 1) return pick(local[0].id);
    try {
      const c = await ctx.S.findCustomer(ctx.bid, v);
      if (c) { ctx.patchCustomer(c); return pick(c.id, c); }
    } catch (e) { return showError(e); }
    if (local.length) return pick(local[0].id);
    suggestions(v);
  }
  function pick(id, obj) { stopScanner(); st.customer = obj || (ctx._customers || customers).find((c) => c.id === id); render(); }

  async function startScan() {
    $('#scanbox', el).hidden = false;
    try {
      if (!window.Html5Qrcode) throw new Error('scanner');
      scanner = new window.Html5Qrcode('reader', { verbose: false });
      await scanner.start({ facingMode: 'environment' }, { fps: 12, qrbox: { width: 230, height: 230 } }, async (text) => {
        await stopScanner();
        if (navigator.vibrate) navigator.vibrate(40);
        resolveExact(text);
      }, () => {});
    } catch (e) {
      $('#scanbox', el).hidden = true; scanner = null;
      toast(t('co_camera_error'), 'bad');
    }
  }

  // ── Amount ───────────────────────────────────────────
  function amountView() {
    const c = st.customer; const tier = tierFor(b.tiers, c.lifetimePoints);
    const can = rewards.filter((r) => rewardIsLive(r) && c.points >= r.cost);
    return `<section class="panel"><div class="panel-b stack">
      <div class="co-customer">${avatar(c)}<div style="min-width:0"><b style="font-size:1.1rem">${esc(fullName(c))}</b>
        <div class="small muted"><span class="ltr">${esc(c.phone)}</span> · ${tier && b.tiers.length > 1 ? `<span class="chip dot" style="--c:${esc(tier.color)};padding:0 8px">${esc(tierName(tier))}</span> · ` : ''}${c.lastVisitAt ? t('co_last_visit', { d: ago(c.lastVisitAt) }) : t('co_never')}</div></div>
        <div class="bal"><b class="num">${fmtNum(c.points)}</b><span class="small muted">${esc(unit)}</span></div>
        <button class="btn ghost icon sm" id="clear" aria-label="${t('close')}">${icon('x')}</button></div>
      ${needsAmount ? `<label class="field"><span>${t('co_amount')} (${esc(curLabel(b.currency))})</span>
        <input class="input huge" id="amount" inputmode="decimal" autocomplete="off" placeholder="0" autofocus></label>` : ''}
      ${needsQty ? `<label class="field"><span>${t('co_qty')}</span><div class="row"><button class="btn lg icon" data-q="-1" aria-label="-">${icon('minus')}</button>
        <input class="input huge" id="qty" inputmode="numeric" value="1" style="flex:1"><button class="btn lg icon" data-q="1" aria-label="+">${icon('plus')}</button></div></label>
        ${needsAmount ? '' : `<label class="field"><span>${t('co_amount')} (${t('optional')})</span><input class="input" id="amount" inputmode="decimal" placeholder="0"></label>`}` : ''}
      ${b.program.type === 'visits' ? `<label class="field"><span>${t('co_amount')} (${t('optional')})</span><input class="input" id="amount" inputmode="decimal" placeholder="0" autofocus></label>` : ''}
      <p class="small muted" id="will" aria-live="polite">${willText()}</p>
      <button class="btn primary xl" id="complete">${icon('check')}${t('co_complete')}</button>
    </div></section>
    ${can.length ? `<section class="panel"><div class="panel-h"><h3>${t('co_redeem_now')}</h3><span class="small muted">${t('co_can_redeem')}</span></div><div class="panel-b row wrap">
      ${can.map((r) => `<button class="chip" data-redeem="${r.id}" style="padding:7px 12px">${icon('gift')} ${esc(rewardName(r))} · ${fmtNum(r.cost)}</button>`).join('')}</div></section>` : ''}`;
  }
  function willText() {
    const a = parseAmount($('#amount', el)?.value || '0'); const q = Number($('#qty', el)?.value || 1);
    const n = earnFor(b.program, { amount: Number.isFinite(a) ? a : 0, qty: q });
    return n ? t('co_will_earn', { n: fmtNum(n), unit }) : '&nbsp;';
  }
  async function complete() {
    const btn = $('#complete', el); if (btn.disabled) return; btn.disabled = true;
    try {
      const amount = $('#amount', el)?.value || '0'; const qty = $('#qty', el)?.value || 1;
      if (needsAmount && !(parseAmount(amount) > 0)) { const a = $('#amount', el); a.setAttribute('aria-invalid', 'true'); a.focus(); toast(t('err_invalid-amount'), 'bad'); btn.disabled = false; return; }
      const r = await ctx.S.recordPurchase(ctx.bid, { customerId: st.customer.id, amount: parseAmount(amount) || 0, qty, locationId: st.location });
      ctx.patchCustomer(r.customer);
      st.result = r; st.customer = r.customer; st.resultAt = Date.now(); render();
    } catch (e) { showError(e); btn.disabled = false; }
  }
  async function redeemNow(rewardId) {
    const r = rewards.find((x) => x.id === rewardId);
    const ok = await modal({ title: rewardName(r), body: `<p>${fmtNum(r.cost)} ${esc(unit)} · ${esc(fullName(st.customer))}</p>`, actions: [{ label: t('cancel'), value: false }, { label: t('c_redeem'), kind: 'primary', value: true }] });
    if (!ok) return;
    try {
      const res = await ctx.S.redeemForCustomer(ctx.bid, st.customer.id, rewardId);
      ctx.patchCustomer(res.customer); st.customer = { ...st.customer, ...res.customer };
      toast(t('co_redeemed', { r: rewardName(r), n: fmtNum(res.balance) })); render();
    } catch (e) { showError(e); }
  }

  // ── Result ───────────────────────────────────────────
  function resultView() {
    const r = st.result; const c = st.customer;
    return `<section class="panel"><div class="co-result" aria-live="polite">
      <div class="burst num">+${fmtNum(r.earned)}</div>
      <h2>${esc(fullName(c))}</h2>
      <p class="muted">${t('co_balance', { n: fmtNum(r.balance) })} ${esc(unit)}</p>
      ${r.unlocked.map((u) => `<div class="unlock">${icon('gift')} ${t('co_unlocked', { r: esc(rewardName(u)) })}</div>`).join('')}
      ${r.tierUp ? `<div class="unlock">${icon('star')} ${t('co_tierup', { t: esc(tierName(r.tierUp)) })}</div>` : ''}
      <button class="btn primary xl" id="next" style="margin-top:10px" autofocus>${t('co_new_sale')}</button>
      <a href="#/customer/${c.id}" class="small">${lang === 'ar' ? 'افتح ملف الزبون' : 'Open customer profile'}</a>
    </div></section>`;
  }

  // ── Reward code ──────────────────────────────────────
  function codeView() {
    return `<section class="panel"><div class="panel-b stack">
      <label class="field"><span>${t('co_verify')}</span><input class="input huge" id="code" autocomplete="off" autocapitalize="characters" placeholder="${t('co_verify_ph')}" dir="ltr" autofocus></label>
      <button class="btn primary xl" id="verify">${icon('check')}${t('co_verify_btn')}</button>
      <div id="vres" aria-live="polite"></div>
    </div></section>
    <section class="panel"><div class="panel-h"><h3>${t('co_pending')}</h3></div><div class="panel-b" id="pending"><div class="spinner"></div></div></section>`;
  }
  async function loadPending() {
    const box = $('#pending', el); if (!box) return;
    try {
      const list = (await ctx.S.listRedemptions(ctx.bid, 'pending')).filter((r) => !r.expiresAt || r.expiresAt > Date.now());
      const byId = new Map((ctx._customers || customers).map((c) => [c.id, c]));
      box.innerHTML = list.length ? `<ul class="list">${list.map((r) => { const c = byId.get(r.customerId) || { firstName: '?' }; return `<li>${avatar(c)}<span class="grow"><span class="t">${esc(fullName(c))} — ${esc(evName(r))}</span><span class="s"><span class="ltr">${esc(r.id)}</span> · ${ago(r.createdAt)}</span></span><button class="btn sm" data-code="${esc(r.id)}">${t('c_redeem')}</button></li>`; }).join('')}</ul>` : `<p class="muted small">${t('no_data_yet').split('.')[0]}.</p>`;
      box.querySelectorAll('[data-code]').forEach((x) => (x.onclick = () => { $('#code', el).value = x.dataset.code; verify(); }));
    } catch (e) { box.innerHTML = `<p class="small muted">${esc(errText(e))}</p>`; }
  }
  async function verify() {
    const input = $('#code', el); const out = $('#vres', el); const btn = $('#verify', el);
    if (!input.value.trim()) return input.focus();
    btn.disabled = true;
    try {
      const r = await ctx.S.redeemCode(ctx.bid, input.value);
      ctx.patchCustomer(r.customer);
      out.innerHTML = `<div class="co-result"><div class="burst" style="background:var(--saffron)">${icon('check')}</div><h2>${esc(evName(r))}</h2><p class="muted">${esc(fullName(r.customer))} · ${t('co_balance', { n: fmtNum(r.balance) })}</p></div>`;
      input.value = ''; loadPending();
    } catch (e) {
      out.innerHTML = `<div class="note" style="background:var(--danger-tint);color:var(--danger)">${icon('x')}<span>${esc(errText(e))}${e.redeemedAt ? ' ' + fmtDate(e.redeemedAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''}</span></div>`;
    } finally { btn.disabled = false; input.focus(); }
  }

  function bind() {
    el.querySelectorAll('[data-tab]').forEach((x) => (x.onclick = () => { stopScanner(); st.tab = x.dataset.tab; st.result = null; render(); }));
    $('#loc', el)?.addEventListener('change', (e) => { st.location = e.target.value; localStorage.setItem('nuqta_loc_' + ctx.bid, st.location); });
    const q = $('#q', el);
    if (q) {
      q.focus();
      q.oninput = () => suggestions(q.value);
      q.onkeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); resolveExact(q.value); }
        if (e.key === 'ArrowDown') { e.preventDefault(); $('#sugg [data-first]', el)?.focus(); }
      };
      $('#scan', el).onclick = startScan; $('#scanstop', el).onclick = () => { stopScanner(); $('#scanbox', el).hidden = true; };
    }
    $('#clear', el)?.addEventListener('click', () => { st.customer = null; render(); });
    const amt = $('#amount', el);
    if (amt) { amt.focus(); amt.oninput = () => { amt.removeAttribute('aria-invalid'); $('#will', el).innerHTML = willText(); }; amt.onkeydown = (e) => { if (e.key === 'Enter') complete(); }; }
    const qty = $('#qty', el);
    if (qty) { qty.oninput = () => ($('#will', el).innerHTML = willText()); qty.onkeydown = (e) => { if (e.key === 'Enter') complete(); }; }
    el.querySelectorAll('[data-q]').forEach((x) => (x.onclick = () => { qty.value = Math.max(1, Number(qty.value || 1) + Number(x.dataset.q)); $('#will', el).innerHTML = willText(); }));
    $('#complete', el)?.addEventListener('click', complete);
    el.querySelectorAll('[data-redeem]').forEach((x) => (x.onclick = () => redeemNow(x.dataset.redeem)));
    const next = $('#next', el);
    // Ignore the tail of the Enter that completed the sale, so it can't skip the result screen.
    if (next) { next.focus(); next.onclick = () => { if (Date.now() - (st.resultAt || 0) < 700) return; st.result = null; st.customer = null; render(); }; }
    if (st.tab === 'code') { const c = $('#code', el); c.focus(); c.onkeydown = (e) => { if (e.key === 'Enter') verify(); }; $('#verify', el).onclick = verify; loadPending(); }
  }
  render();
}
