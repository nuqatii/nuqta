// Monthly report for owners and managers: members, return visits, revenue from members, rewards,
// top customers and busiest days, compared with the month before. Printable / save as PDF.
import { t, fmtNum, fmtMoney, lang, unitWord, appName } from '../core/i18n.js';
import { DAY, daysToBirthday } from '../core/loyalty.js';
import { esc, icon, $, printDoc, fullName, showError } from '../ui/ui.js';

const monthStart = (y, m) => new Date(y, m, 1).getTime();
const loc = () => (lang === 'ar' ? 'ar-SY-u-nu-latn' : 'en-GB');
const monthLabel = (y, m) => new Intl.DateTimeFormat(loc(), { month: 'long', year: 'numeric' }).format(new Date(y, m, 1));

export default async function report(ctx, el) {
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const q = new URLSearchParams(location.hash.split('?')[1] || '').get('m');
  let pick = months.findIndex((x) => `${x.y}-${String(x.m + 1).padStart(2, '0')}` === q); if (pick < 0) pick = 0;

  el.innerHTML = `<div class="page-head"><div><h1>${t('rp_title')}</h1><p>${t('rp_sub')}</p></div>
    <div class="actions"><select class="input" id="rpm" style="width:auto">${months.map((x, i) => `<option value="${i}" ${i === pick ? 'selected' : ''}>${monthLabel(x.y, x.m)}</option>`).join('')}</select>
    <button class="btn primary" id="rpp">${icon('receipt')}${t('rp_print')}</button></div></div>
    <div id="rpBody"><div class="center-load"><div class="spinner"></div></div></div>`;
  let html = '';
  async function draw() {
    const { y, m } = months[pick];
    $('#rpBody', el).innerHTML = '<div class="center-load"><div class="spinner"></div></div>';
    try { html = await build(ctx, y, m); $('#rpBody', el).innerHTML = html; } catch (e) { showError(e); }
  }
  $('#rpm', el).onchange = (e) => { pick = +e.target.value; draw(); };
  $('#rpp', el).onclick = () => html && printDoc(html);
  await draw();
}

async function build(ctx, y, m) {
  const b = ctx.biz;
  const start = monthStart(y, m), end = monthStart(y, m + 1), prevStart = monthStart(y, m - 1);
  const [customers, acts] = await Promise.all([ctx.customers(), ctx.S.listActivity(ctx.bid, { since: prevStart, until: end })]);
  const byId = new Map(customers.map((c) => [c.id, c]));
  const unit = unitWord(b.program, b.currency);

  function stats(from, to) {
    const xs = acts.filter((a) => a.at >= from && a.at < to);
    const buys = xs.filter((a) => a.type === 'purchase');
    const buyers = new Map(); for (const a of buys) { const r = buyers.get(a.customerId) || { n: 0, spend: 0 }; r.n++; r.spend += Number(a.amount) || 0; buyers.set(a.customerId, r); }
    const returning = [...buyers.keys()].filter((id) => (byId.get(id)?.joinedAt || 0) < from);
    return {
      newMembers: customers.filter((c) => c.joinedAt >= from && c.joinedAt < to).length,
      members: customers.filter((c) => (c.joinedAt || 0) < to).length,
      purchases: buys.length, revenue: buys.reduce((s, a) => s + (Number(a.amount) || 0), 0),
      active: buyers.size, returning: returning.length,
      returningRevenue: returning.reduce((s, id) => s + buyers.get(id).spend, 0),
      redeemed: xs.filter((a) => a.type === 'redeem').length,
      given: buys.reduce((s, a) => s + Math.max(0, a.points || 0), 0),
      tierUps: xs.filter((a) => a.type === 'tier').length,
      buyers, buys,
    };
  }
  // A month still in progress is compared with the same number of days of the month before.
  const partial = end > Date.now();
  const cur = stats(start, end), prev = stats(prevStart, partial ? Math.min(start, prevStart + (Date.now() - start)) : start);
  const delta = (a, b2) => { if (!b2) return a ? `<span class="rp-d up">${t('rp_new_metric')}</span>` : ''; const p = Math.round(((a - b2) / b2) * 100); return `<span class="rp-d ${p >= 0 ? 'up' : 'down'}">${p >= 0 ? '▲' : '▼'} ${fmtNum(Math.abs(p))}%</span>`; };
  const money = (n) => fmtMoney(n, b.currency);
  const pct = (a, b2) => (b2 ? Math.round((a / b2) * 100) : 0);

  const top = [...cur.buyers.entries()].sort((a, c) => c[1].spend - a[1].spend || c[1].n - a[1].n).slice(0, 10);
  const dayNames = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(loc(), { weekday: 'long' }).format(new Date(2026, 0, 4 + i)));   // 4 Jan 2026 = Sunday
  const byDay = Array(7).fill(0); for (const a of cur.buys) byDay[new Date(a.at).getDay()]++;
  const maxDay = Math.max(1, ...byDay);
  const nextStart = end, nextEnd = monthStart(y, m + 2);
  const bdaysNext = customers.filter((c) => { const d = daysToBirthday(c.birthday, nextStart - DAY / 2); return d !== null && d < (nextEnd - nextStart) / DAY; }).length;
  const kpi = (label, value, d, sub = '') => `<div class="rp-kpi"><div class="l">${label}</div><div class="v">${value}</div><div class="s">${d}${sub ? ` <span>${sub}</span>` : ''}</div></div>`;

  return `<div class="rep" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">
    <header class="rp-head">${b.logo ? `<img src="${esc(b.logo)}" alt="">` : ''}<div><h2>${esc(b.name)}</h2><p>${t('rp_title')} · <b>${monthLabel(y, m)}</b></p></div>
      <div class="rp-gen">${t('rp_generated', { d: new Intl.DateTimeFormat(loc(), { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()) })}<br>${esc(appName())}</div></header>
    <section class="rp-kpis">
      ${kpi(t('rp_new_members'), fmtNum(cur.newMembers), delta(cur.newMembers, prev.newMembers), t('rp_total_members', { n: fmtNum(cur.members) }))}
      ${kpi(t('rp_purchases'), fmtNum(cur.purchases), delta(cur.purchases, prev.purchases))}
      ${kpi(t('rp_revenue'), money(cur.revenue), delta(cur.revenue, prev.revenue), cur.purchases ? t('rp_avg', { v: money(cur.revenue / cur.purchases) }) : '')}
      ${kpi(t('rp_active'), fmtNum(cur.active), delta(cur.active, prev.active))}
      ${kpi(t('rp_returning'), fmtNum(cur.returning), delta(cur.returning, prev.returning), t('rp_of_active', { p: pct(cur.returning, cur.active) }))}
      ${kpi(t('rp_redeemed'), fmtNum(cur.redeemed), delta(cur.redeemed, prev.redeemed))}
    </section>
    <section class="rp-box"><h3>${t('rp_summary')}</h3><ul>
      <li>${t('rp_s_returning', { p: pct(cur.returningRevenue, cur.revenue), v: money(cur.returningRevenue) })}</li>
      <li>${t('rp_s_given', { n: fmtNum(cur.given), unit: esc(unit), r: fmtNum(cur.redeemed) })}</li>
      ${cur.tierUps ? `<li>${t('rp_s_tiers', { n: fmtNum(cur.tierUps) })}</li>` : ''}
      <li>${t('rp_s_bdays', { n: fmtNum(bdaysNext), month: monthLabel(new Date(nextStart).getFullYear(), new Date(nextStart).getMonth()) })}</li>
    </ul></section>
    <div class="rp-cols">
      <section class="rp-box"><h3>${t('rp_top')}</h3>${top.length ? `<table class="rp-tbl"><thead><tr><th>#</th><th>${t('first_name')}</th><th class="r">${t('visits')}</th><th class="r">${t('total_spend')}</th></tr></thead><tbody>
        ${top.map(([id, r], i) => `<tr><td>${i + 1}</td><td>${esc(fullName(byId.get(id)) || '—')}</td><td class="r">${fmtNum(r.n)}</td><td class="r">${money(r.spend)}</td></tr>`).join('')}</tbody></table>` : `<p class="muted">${t('rp_none')}</p>`}</section>
      <section class="rp-box"><h3>${t('rp_days')}</h3>${cur.purchases ? `<div class="rp-bars">${[6, 0, 1, 2, 3, 4, 5].map((d) => `<div><span>${dayNames[d]}</span><i style="--w:${Math.round((byDay[d] / maxDay) * 100)}%"></i><b>${fmtNum(byDay[d])}</b></div>`).join('')}</div>` : `<p class="muted">${t('rp_none')}</p>`}</section>
    </div>
    <p class="rp-foot">${partial ? t('rp_partial', { d: new Date().getDate() }) + ' ' : ''}${t('rp_foot', { prev: monthLabel(new Date(prevStart).getFullYear(), new Date(prevStart).getMonth()) })}</p>
  </div>`;
}
