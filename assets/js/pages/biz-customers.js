import { t, fmtNum, fmtMoney, fmtDate, ago, tierName, unitWord, rewardName, lang } from '../core/i18n.js';
import { tierFor, autoSegment, AUTO_SEGMENTS, rewardIsLive, toLatinDigits, CHANNELS, isStampy, stampState, daysToBirthday, BIRTHDAY_FILTERS } from '../core/loyalty.js';
import { esc, icon, $, avatar, fullName, modal, showError, toast, download, toCSV, waLink, copyText, confirmBox } from '../ui/ui.js';
import { eventTitle, signed, EV_ICON, empty } from './biz-common.js';
import { baseUrl } from '../config.js';

export const cardUrl = (c) => `${baseUrl()}rewards.html?c=${c.cardToken}`;
export const SEG_COLOR = { new: '#3B82F6', active: '#0F6E5C', loyal: '#7C3AED', vip: '#C9A227', at_risk: '#E8A33D', inactive: '#98A0AE' };

const memo = {};   // list filters, kept when the list refreshes itself after a new member joins
export default async function customers(ctx, el, { page, params, live }) {
  if (page === 'customer') return profile(ctx, el, params[0]);
  const b = ctx.biz;
  const [all, rwList] = await Promise.all([ctx.customers(), ctx.S.listRewards(ctx.bid)]);
  const liveRw = rwList.filter((r) => rewardIsLive(r));
  // Stamp cards: show progress toward the next reward plus a gift count for saved-up rewards.
  const ptsCell = (c) => { if (!isStampy(b.program)) return fmtNum(c.points); const s = stampState(b.program, liveRw, c.points); return `${fmtNum(s.progress)}/${fmtNum(s.goal)}${s.ready ? ` <span class="chip warn" style="padding:0 7px">${icon('gift')}${fmtNum(s.ready)}</span>` : ''}`; };
  const segOf = new Map(all.map((c) => [c.id, autoSegment(c, b.tiers)]));
  // Birthdays: today, or within the next 7 days.
  const bdayOf = new Map(all.map((c) => [c.id, daysToBirthday(c.birthday)]));
  const inBday = (c, f) => { const d = bdayOf.get(c.id); return d !== null && d <= BIRTHDAY_FILTERS[f]; };
  const bdayCount = (f) => all.filter((c) => inBday(c, f)).length;
  const isBdayView = () => st.seg in BIRTHDAY_FILTERS;
  const st = live && memo[ctx.bid] ? memo[ctx.bid] : { q: '', seg: new URLSearchParams(location.hash.split('?')[1] || '').get('seg') || 'all', sort: 'recent', limit: 50 };
  memo[ctx.bid] = st;

  function filtered() {
    const q = toLatinDigits(st.q).trim().toLowerCase(); const digits = q.replace(/\D/g, '').replace(/^0/, '');
    let rows = all.filter((c) => st.seg === 'all' || (isBdayView() ? inBday(c, st.seg) : segOf.get(c.id) === st.seg));
    if (q) rows = rows.filter((c) => fullName(c).toLowerCase().includes(q) || (digits.length >= 2 && (c.phone.includes(digits) || c.memberNumber.includes(digits))) || (c.email || '').includes(q) || c.id === q);
    const by = { recent: (c) => -(c.joinedAt || 0), points: (c) => -(c.points || 0), spend: (c) => -(c.spend || 0), visit: (c) => -(c.lastVisitAt || 0), name: null }[st.sort];
    rows = isBdayView() && st.sort === 'recent' ? [...rows].sort((a, c) => bdayOf.get(a.id) - bdayOf.get(c.id))
      : [...rows].sort(by ? (a, c) => by(a) - by(c) : (a, c) => fullName(a).localeCompare(fullName(c), lang));
    return rows;
  }
  const counts = Object.fromEntries(AUTO_SEGMENTS.map((s) => [s, 0])); for (const s of segOf.values()) counts[s]++;

  const delReqs = ctx.can('settings') ? await ctx.S.listDeletionRequests(ctx.bid).catch(() => []) : [];
  el.innerHTML = `
  ${delReqs.length ? `<div class="note" style="background:var(--danger-tint);color:var(--danger);margin-bottom:14px;align-items:center">${icon('shield')}<span style="flex:1">${delReqs.length === 1 ? t('del_banner_one') : t('del_banner', { n: fmtNum(delReqs.length) })}</span><button class="btn sm" id="delreqs">${t('del_review')}</button></div>` : ''}
  <div class="page-head"><div><h1>${t('cu_title')}</h1><p>${t('cu_count', { n: fmtNum(all.length) })}</p></div>
    <div class="actions"><button class="btn" id="csv">${icon('dl')}${t('export_csv')}</button><button class="btn primary" id="add">${icon('plus')}${t('cu_add')}</button></div></div>
  <div class="stack" style="gap:12px;margin-bottom:14px">
    <div class="row wrap"><div style="position:relative;flex:1;min-width:240px"><input class="input" id="q" value="${esc(st.q)}" placeholder="${t('cu_search_ph')}" style="padding-inline-start:40px">
      <span style="position:absolute;inset-inline-start:12px;top:12px;color:var(--faint);width:20px;height:20px">${icon('search')}</span></div>
      <select class="input" id="sort" style="width:auto">${['recent', 'visit', 'points', 'spend', 'name'].map((s) => `<option value="${s}" ${st.sort === s ? 'selected' : ''}>${{ recent: t('joined'), visit: t('last_visit'), points: t('points'), spend: t('total_spend'), name: t('first_name') }[s]}</option>`).join('')}</select></div>
    <div class="row wrap" role="group">${['all', ...AUTO_SEGMENTS].map((s) => `<button class="chip ${s !== 'all' ? 'dot' : ''}" style="--c:${SEG_COLOR[s] || ''}" data-seg="${s}" aria-pressed="${st.seg === s}">${s === 'all' ? t('all') : t('seg_' + s)} · ${fmtNum(s === 'all' ? all.length : counts[s])}</button>`).join('')}
      ${Object.keys(BIRTHDAY_FILTERS).map((s) => `<button class="chip bday" data-seg="${s}" aria-pressed="${st.seg === s}">${icon('cake')}${t(s)} · ${fmtNum(bdayCount(s))}</button>`).join('')}</div>
  </div>
  <section class="panel"><div class="table-wrap" id="tbl"></div></section>`;

  function drawTable() {
    const rows = filtered();
    const box = $('#tbl', el);
    const bv = isBdayView();
    // In the birthday views: when it is, plus one-tap call / WhatsApp to wish them a happy birthday.
    const bdayCell = (c) => { const d = bdayOf.get(c.id); const [, mo, da] = c.birthday.split('-').map(Number);
      const when = d === 0 ? `<span class="chip bday on">${icon('cake')}${t('bd_today')}</span>` : `<span class="chip">${d === 1 ? t('bd_tomorrow') : t('bd_in', { n: fmtNum(d) })} · ${new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SY-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short' }).format(new Date(2000, mo - 1, da))}</span>`;
      const msg = t('bd_wa', { name: c.firstName, biz: b.name });
      return `<td><div class="row" style="gap:6px;flex-wrap:nowrap">${when}
        <a class="btn sm icon" href="tel:${esc(c.phone)}" data-stop aria-label="${t('bd_call')}" title="${t('bd_call')}">${icon('phone')}</a>
        <a class="btn sm icon wa" href="${esc(waLink(c.phone, msg))}" target="_blank" rel="noopener" data-stop aria-label="${t('bd_whatsapp')}" title="${t('bd_whatsapp')}">${icon('whatsapp')}</a></div></td>`; };
    if (!all.length) { box.innerHTML = empty(t('cu_empty'), `<a class="btn primary" href="#/qr">${icon('qr')}${t('nav_qr')}</a>`); return; }
    if (bv && !rows.length && !st.q) { box.innerHTML = empty(t(st.seg === 'bday_today' ? 'bd_none_today' : 'bd_none_week'), `<p class="small muted" style="max-width:420px;margin:0 auto">${t('bd_hint')}</p>`); return; }
    box.innerHTML = `<table class="tbl"><thead><tr><th>${t('first_name')}</th>${bv ? `<th>${t('birthday')}</th>` : ''}<th class="hide-sm">${t('tier')}</th><th class="r">${t('points')}</th><th class="r hide-sm">${t('visits')}</th><th class="hide-sm">${t('last_visit')}</th><th class="r hide-sm">${t('total_spend')}</th></tr></thead>
      <tbody>${rows.slice(0, st.limit).map((c) => { const tr = tierFor(b.tiers, c.lifetimePoints); const sg = segOf.get(c.id); return `<tr data-id="${c.id}" tabindex="0">
        <td><div class="row">${avatar(c)}<div style="min-width:0"><div style="font-weight:500">${esc(fullName(c))}</div><div class="small muted"><span class="ltr">${esc(c.phone)}</span> <span class="chip dot" style="--c:${SEG_COLOR[sg]};padding:0 7px;font-size:.72rem">${t('seg_' + sg)}</span></div></div></div></td>
        ${bv ? bdayCell(c) : ''}<td class="hide-sm">${b.tiers.length > 1 ? `<span class="chip dot" style="--c:${esc(tr?.color)}">${esc(tierName(tr))}</span>` : ''}</td>
        <td class="r pts">${ptsCell(c)}</td><td class="r num hide-sm">${fmtNum(c.visits)}</td>
        <td class="hide-sm small muted">${c.lastVisitAt ? ago(c.lastVisitAt) : '—'}</td><td class="r num hide-sm">${fmtMoney(c.spend, b.currency)}</td></tr>`; }).join('')}</tbody></table>
      ${rows.length > st.limit ? `<div style="padding:14px;text-align:center"><button class="btn" id="more">${t('view_all')} (${fmtNum(rows.length)})</button></div>` : ''}
      ${!rows.length ? `<p class="muted" style="padding:24px;text-align:center">${t('co_no_match', { q: esc(st.q) })}</p>` : ''}`;
    box.querySelectorAll('[data-stop]').forEach((a) => (a.onclick = (e) => e.stopPropagation()));
    box.querySelectorAll('tr[data-id]').forEach((tr) => { tr.onclick = () => ctx.nav('customer/' + tr.dataset.id); tr.onkeydown = (e) => { if (e.key === 'Enter') tr.click(); }; });
    $('#more', box)?.addEventListener('click', () => { st.limit += 200; drawTable(); });
  }
  drawTable();
  $('#delreqs', el)?.addEventListener('click', () => {
    const byId = new Map(all.map((c) => [c.id, c]));
    modal({ title: t('del_requests_title'), wide: true,
      body: `<ul class="list">${delReqs.map((r) => { const c = byId.get(r.id) || { firstName: '#' + r.memberNumber }; return `<li>${avatar(c)}<span class="grow"><span class="t">${esc(fullName(c))}</span><span class="s"><span class="ltr">${esc(c.phone || '')}</span> · ${t('del_requested_on', { d: fmtDate(r.at) })}</span></span>
        <button class="btn sm danger" data-del="${esc(r.id)}">${icon('trash')}${t('delete')}</button></li>`; }).join('')}</ul>`,
      onMount: (m, close) => m.querySelectorAll('[data-del]').forEach((x) => (x.onclick = async () => {
        const c = byId.get(x.dataset.del);
        if (c && !(await confirmBox(t('del_customer'), t('del_customer_body', { name: fullName(c) }), t('delete'), 'danger'))) return;
        try { await ctx.S.deleteCustomerData(ctx.bid, x.dataset.del); toast(t('del_done')); await ctx.customers(true); close(); customers(ctx, el, { page: 'customers', params: [] }); }
        catch (e) { showError(e); }
      })) });
  });
  $('#q', el).oninput = (e) => { st.q = e.target.value; st.limit = 50; drawTable(); };
  $('#sort', el).onchange = (e) => { st.sort = e.target.value; drawTable(); };
  el.querySelectorAll('[data-seg]').forEach((x) => (x.onclick = () => { st.seg = x.dataset.seg; el.querySelectorAll('[data-seg]').forEach((y) => y.setAttribute('aria-pressed', y === x)); drawTable(); }));
  $('#add', el).onclick = async () => { const r = await addCustomerDialog(ctx); if (r) ctx.nav('customer/' + r.customerId); };
  $('#csv', el).onclick = () => download(`${b.slug}-customers.csv`, toCSV(filtered().map((c) => ({
    member_number: c.memberNumber, first_name: c.firstName, last_name: c.lastName, phone: c.phone, email: c.email, birthday: c.birthday,
    tier: tierName(tierFor(b.tiers, c.lifetimePoints)), segment: segOf.get(c.id), points: c.points, lifetime_points: c.lifetimePoints, visits: c.visits,
    total_spend: c.spend, rewards_redeemed: c.redeemedCount, joined: new Date(c.joinedAt).toISOString().slice(0, 10),
    last_visit: c.lastVisitAt ? new Date(c.lastVisitAt).toISOString().slice(0, 10) : '', marketing_consent: c.marketingConsent ? 'yes' : 'no',
  }))), 'text/csv');
}

// ── Add customer ─────────────────────────────────────────
export async function addCustomerDialog(ctx, prefill = {}) {
  const body = `<form class="form" id="addf" novalidate>
    <div class="grid2"><label class="field"><span>${t('first_name')}</span><input class="input" name="firstName" required autofocus maxlength="40"></label>
    <label class="field"><span>${t('last_name')} <span class="muted">(${t('optional')})</span></span><input class="input" name="lastName" maxlength="40"></label></div>
    <label class="field"><span>${t('phone')}</span><input class="input" name="phone" type="tel" inputmode="tel" required dir="ltr" value="${esc(prefill.phone || '')}" placeholder="09XX XXX XXX"></label>
    <label class="field"><span>${t('email')} <span class="muted">(${t('optional')})</span></span><input class="input" name="email" type="email" dir="ltr"></label>
    <label class="field"><span>${t('birthday')} <span class="muted">(${t('optional')})</span></span><input class="input" name="birthday" type="date"></label>
    <label class="check"><input type="checkbox" name="marketingConsent" checked><span>${t('marketing_consent')}</span></label>
  </form>`;
  return modal({ title: t('cu_add'), body, actions: [
    { label: t('cancel'), value: null },
    { label: t('cu_add'), kind: 'primary', onClick: async (m) => {
      const f = $('#addf', m);
      const r = await ctx.S.addCustomer(ctx.bid, { firstName: f.firstName.value, lastName: f.lastName.value, phone: f.phone.value, email: f.email.value, birthday: f.birthday.value, marketingConsent: f.marketingConsent.checked });
      await ctx.customers(true); toast(t('customer_added'));
      return r;
    } },
  ] });
}

// ── Profile ──────────────────────────────────────────────
async function profile(ctx, el, cid) {
  const b = ctx.biz; const unit = unitWord(b.program, b.currency);
  const [c, events, rewards] = await Promise.all([
    ctx.S.getCustomer(ctx.bid, cid),
    ctx.can('transactions') ? ctx.S.listActivity(ctx.bid, { customerId: cid }) : Promise.resolve([]),
    ctx.S.listRewards(ctx.bid),
  ]);
  if (!c) { el.innerHTML = empty(t('err_not-found')); return; }
  const tier = tierFor(b.tiers, c.lifetimePoints); const seg = autoSegment(c, b.tiers);
  const purchases = events.filter((e) => e.type === 'purchase');
  const avg = purchases.length ? c.spend / purchases.length : 0;
  const link = cardUrl(c);
  const afford = rewards.filter((r) => rewardIsLive(r) && c.points >= r.cost);
  const msg = lang === 'ar' ? `أهلاً ${c.firstName}! هذه بطاقة مكافآتك في ${b.name}: ${link}` : `Hi ${c.firstName}! Here's your ${b.name} rewards card: ${link}`;

  el.innerHTML = `
  <a href="#/customers" class="small row" style="gap:4px;margin-bottom:12px;width:max-content">${icon(lang === 'ar' ? 'chevron' : 'back')}${t('cu_title')}</a>
  <div class="page-head" style="align-items:center">
    <div class="row" style="gap:14px">${avatar(c).replace('class="av', 'style="width:56px;height:56px;font-size:1.2rem" class="av')}
      <div><h1>${esc(fullName(c))}</h1><div class="row wrap" style="margin-top:6px;gap:6px">
        <span class="chip dot" style="--c:${SEG_COLOR[seg]}">${t('seg_' + seg)}</span>
        ${b.tiers.length > 1 ? `<span class="chip dot" style="--c:${esc(tier?.color)}">${esc(tierName(tier))}</span>` : ''}
        <span class="chip ltr">#${esc(c.memberNumber)}</span></div></div></div>
    <div class="actions">
      ${ctx.can('checkout') ? `<a class="btn primary" href="#/checkout/${c.id}">${icon('scan')}${t('co_complete')}</a>` : ''}
      <a class="btn" href="${esc(waLink(c.phone, msg))}" target="_blank" rel="noopener">${icon('whatsapp')}${t('send_card')}</a>
      <button class="btn icon" id="more" aria-label="${t('nav_more')}">${icon('more')}</button>
    </div>
  </div>
  <div class="cols">
    <div class="c5 stack">
      <section class="kpis" style="grid-template-columns:1fr 1fr;margin:0">
        ${isStampy(b.program) ? (() => { const s = stampState(b.program, rewards.filter((r) => rewardIsLive(r)), c.points); return `<div class="kpi"><div class="l">${t('c_next_reward')}</div><div class="v">${fmtNum(s.progress)}/${fmtNum(s.goal)}</div><div class="d muted">${s.ready ? (s.ready === 1 ? t('c_rewards_count_one') : t('c_rewards_count', { n: fmtNum(s.ready) })) : esc(unit)}</div></div>`; })()
          : `<div class="kpi"><div class="l">${t('points')}</div><div class="v">${fmtNum(c.points)}</div><div class="d muted">${esc(unit)}</div></div>`}
        <div class="kpi"><div class="l">${t('lifetime_points')}</div><div class="v">${fmtNum(c.lifetimePoints)}</div></div>
        <div class="kpi" style="border-top:1px solid var(--line-2);border-inline-start:0"><div class="l">${t('visits')}</div><div class="v">${fmtNum(c.visits)}</div></div>
        <div class="kpi" style="border-top:1px solid var(--line-2)"><div class="l">${t('total_spend')}</div><div class="v" style="font-size:1.2rem">${fmtMoney(c.spend, b.currency)}</div></div>
        <div class="kpi" style="border-top:1px solid var(--line-2);border-inline-start:0"><div class="l">${t('avg_tx')}</div><div class="v" style="font-size:1.2rem">${fmtMoney(Math.round(avg), b.currency)}</div></div>
        <div class="kpi" style="border-top:1px solid var(--line-2)"><div class="l">${t('rewards_redeemed')}</div><div class="v">${fmtNum(c.redeemedCount)}</div></div>
      </section>
      <section class="panel"><div class="panel-h"><h2>${lang === 'ar' ? 'المعلومات' : 'Details'}</h2><button class="btn sm" id="edit">${icon('edit')}${t('edit')}</button></div>
        <div class="panel-b"><ul class="list">
          ${row(t('phone'), `<a class="ltr" href="tel:${esc(c.phone)}">${esc(c.phone)}</a>`)}
          ${row(t('email'), esc(c.email || '—'))}
          ${row(t('birthday'), c.birthday ? fmtDate(new Date(c.birthday).getTime(), { day: 'numeric', month: 'long' }) : '—')}
          ${row(t('joined'), fmtDate(c.joinedAt))}
          ${row(t('last_visit'), c.lastVisitAt ? ago(c.lastVisitAt) : '—')}
          ${row(t('marketing_consent'), c.marketingConsent ? `<span class="chip ok">${t('yes')}</span>` : `<span class="chip">${t('no')}</span>`)}
          ${row(t('preferred_channel'), t('ch_' + (c.preferredChannel || 'whatsapp')))}
        </ul>${c.notes ? `<div class="note" style="margin-top:10px">${icon('info')}<span>${esc(c.notes)}</span></div>` : ''}</div></section>
      ${afford.length && ctx.can('checkout') ? `<section class="panel"><div class="panel-h"><h2>${t('co_can_redeem')}</h2></div><div class="panel-b row wrap">${afford.map((r) => `<a class="chip" href="#/checkout/${c.id}" style="padding:6px 12px">${icon('gift')} ${esc(rewardName(r))} · ${fmtNum(r.cost)}</a>`).join('')}</div></section>` : ''}
    </div>
    <section class="panel c7"><div class="panel-h"><h2>${t('timeline')}</h2><span class="small muted">${fmtNum(events.length)}</span></div>
      <div class="panel-b">${events.length ? `<ol class="timeline">${events.map((e) => `<li><span class="ic ${e.type}">${icon(EV_ICON[e.type] || 'star')}</span>
        <div class="body"><div class="spread"><b style="font-weight:500">${esc(eventTitle(e))}</b>${e.points ? `<span class="pts ${e.points > 0 ? 'pos' : 'neg'}">${signed(e.points)}</span>` : ''}</div>
        <div class="small muted">${fmtDate(e.at, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}${e.amount ? ' · ' + fmtMoney(e.amount, b.currency) : ''}${e.staffName ? ' · ' + t('by_staff', { s: esc(e.staffName) }) : ''}${e.type === 'join' && e.points ? ' · ' + t('welcome_bonus_ev') : ''}</div></div></li>`).join('')}</ol>` : empty(t('no_data_yet'))}</div></section>
  </div>`;

  $('#edit', el).onclick = () => editDialog(ctx, c).then((ok) => ok && profile(ctx, el, cid));
  $('#more', el).onclick = () => modal({ title: fullName(c), body: `<div class="demo-list">
      <button data-a="open">${icon('card')}<span class="grow"><b>${t('open_card')}</b></span></button>
      <button data-a="copy">${icon('copy')}<span class="grow"><b>${t('copy')}</b><small class="ltr">${esc(link)}</small></span></button>
      ${ctx.can('program') ? `<button data-a="adjust">${icon('sliders')}<span class="grow"><b>${t('adjust_points')}</b></span></button>` : ''}
      ${ctx.can('settings') ? `<button data-a="delete" style="color:var(--danger)">${icon('trash')}<span class="grow"><b>${t('del_customer')}</b></span></button>` : ''}</div>`,
  onMount: (m, close) => m.querySelectorAll('[data-a]').forEach((x) => (x.onclick = async () => {
    close();
    if (x.dataset.a === 'open') window.open(link, '_blank');
    if (x.dataset.a === 'copy') copyText(link);
    if (x.dataset.a === 'adjust') { if (await adjustDialog(ctx, c)) { await ctx.customers(true); profile(ctx, el, cid); } }
    if (x.dataset.a === 'delete' && await confirmBox(t('del_customer'), t('del_customer_body', { name: fullName(c) }), t('delete'), 'danger')) {
      try { await ctx.S.deleteCustomerData(ctx.bid, c.id); toast(t('del_done')); await ctx.customers(true); ctx.nav('customers'); } catch (e) { showError(e); }
    }
  })) });
}
const row = (k, v) => `<li><span class="grow small muted">${k}</span><span>${v}</span></li>`;

function editDialog(ctx, c) {
  const body = `<form class="form" id="ef">
    <div class="grid2"><label class="field"><span>${t('first_name')}</span><input class="input" name="firstName" value="${esc(c.firstName)}" required></label>
    <label class="field"><span>${t('last_name')}</span><input class="input" name="lastName" value="${esc(c.lastName)}"></label></div>
    <div class="grid2"><label class="field"><span>${t('email')}</span><input class="input" name="email" type="email" dir="ltr" value="${esc(c.email)}"></label>
    <label class="field"><span>${t('birthday')}</span><input class="input" name="birthday" type="date" value="${esc(c.birthday)}"></label></div>
    <div class="grid2"><label class="field"><span>${t('gender')} (${t('optional')})</span><select class="input" name="gender"><option value="">—</option><option value="f" ${c.gender === 'f' ? 'selected' : ''}>${t('gender_f')}</option><option value="m" ${c.gender === 'm' ? 'selected' : ''}>${t('gender_m')}</option></select></label>
    <label class="field"><span>${t('preferred_channel')}</span><select class="input" name="preferredChannel">${CHANNELS.map((ch) => `<option value="${ch}" ${c.preferredChannel === ch ? 'selected' : ''}>${t('ch_' + ch)}</option>`).join('')}</select></label></div>
    <label class="field"><span>${t('notes')}</span><textarea class="input" name="notes" maxlength="500">${esc(c.notes)}</textarea></label>
    <label class="check"><input type="checkbox" name="marketingConsent" ${c.marketingConsent ? 'checked' : ''}><span>${t('marketing_consent')}</span></label>
    <p class="small muted">${t('phone')}: <span class="ltr">${esc(c.phone)}</span></p></form>`;
  return modal({ title: t('edit'), body, actions: [{ label: t('cancel'), value: false }, { label: t('save'), kind: 'primary', onClick: async (m) => {
    const f = $('#ef', m);
    await ctx.S.updateCustomer(ctx.bid, c.id, { firstName: f.firstName.value, lastName: f.lastName.value, email: f.email.value, birthday: f.birthday.value, gender: f.gender.value, preferredChannel: f.preferredChannel.value, notes: f.notes.value, marketingConsent: f.marketingConsent.checked });
    await ctx.customers(true); toast(t('saved')); return true;
  } }] });
}
function adjustDialog(ctx, c) {
  const body = `<form class="form" id="adj"><label class="field"><span>${t('points')}</span><input class="input huge" name="delta" inputmode="numeric" placeholder="+100" dir="ltr" autofocus><small>${t('adjust_hint')}</small></label>
    <label class="field"><span>${t('reason')}</span><input class="input" name="note" maxlength="140"></label></form>`;
  return modal({ title: t('adjust_points'), body, actions: [{ label: t('cancel'), value: false }, { label: t('save'), kind: 'primary', onClick: async (m) => {
    const f = $('#adj', m); await ctx.S.adjustPoints(ctx.bid, c.id, toLatinDigits(f.delta.value).replace('+', ''), f.note.value); toast(t('saved')); return true;
  } }] });
}
