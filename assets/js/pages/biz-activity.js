import { t, fmtNum, fmtMoney, fmtDate } from '../core/i18n.js';
import { DAY } from '../core/loyalty.js';
import { esc, icon, $, avatar, fullName, download, toCSV } from '../ui/ui.js';
import { eventTitle, signed, sum, empty } from './biz-common.js';

export default async function activity(ctx, el) {
  const b = ctx.biz;
  const [acts, customers, locations] = await Promise.all([ctx.activity(), ctx.customers(), ctx.S.listLocations(ctx.bid)]);
  const byId = new Map(customers.map((c) => [c.id, c]));
  const locName = new Map(locations.map((l) => [l.id, l.name]));
  const staff = [...new Set(acts.map((a) => a.staffName).filter(Boolean))];
  const st = { type: 'all', days: 30, staff: '', loc: '', limit: 100 };

  const rows = () => acts.filter((a) => (st.type === 'all' || a.type === st.type) && a.at >= Date.now() - st.days * DAY && (!st.staff || a.staffName === st.staff) && (!st.loc || a.locationId === st.loc));

  el.innerHTML = `<div class="page-head"><div><h1>${t('nav_transactions')}</h1><p id="sumline"></p></div>
    <div class="actions"><button class="btn" id="csv">${icon('dl')}${t('export_csv')}</button></div></div>
    <div class="row wrap" style="margin-bottom:14px">
      <div class="seg">${['all', 'purchase', 'redeem', 'join', 'adjust'].map((x) => `<button data-type="${x}" aria-pressed="${st.type === x}">${x === 'all' ? t('all') : x === 'purchase' ? t('ev_purchase') : x === 'redeem' ? t('redeemed_pts') : x === 'join' ? t('seg_new') : t('ev_adjust')}</button>`).join('')}</div>
      <select class="input" id="days" style="width:auto">${[7, 30, 90, 120].map((d) => `<option value="${d}" ${d === st.days ? 'selected' : ''}>${t('an_range', { n: d })}</option>`).join('')}</select>
      ${staff.length > 1 ? `<select class="input" id="staff" style="width:auto"><option value="">${t('nav_staff')}: ${t('all')}</option>${staff.map((s) => `<option>${esc(s)}</option>`).join('')}</select>` : ''}
      ${locations.length > 1 ? `<select class="input" id="loc" style="width:auto"><option value="">${t('nav_locations')}: ${t('all')}</option>${locations.map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join('')}</select>` : ''}
    </div>
    <section class="panel"><div class="table-wrap" id="tbl"></div></section>`;

  function draw() {
    const r = rows();
    const p = r.filter((a) => a.type === 'purchase');
    $('#sumline', el).textContent = `${fmtNum(p.length)} ${t('ev_purchase')} · ${fmtMoney(sum(p, (a) => a.amount), b.currency)} · +${fmtNum(sum(r.filter((a) => a.points > 0), (a) => a.points))} ${t('points')}`;
    $('#tbl', el).innerHTML = r.length ? `<table class="tbl"><thead><tr><th>${t('first_name')}</th><th>${t('status')}</th><th class="r">${t('co_amount')}</th><th class="r">${t('points')}</th><th class="hide-sm">${t('nav_staff')}</th><th class="hide-sm">${lang2('time')}</th></tr></thead><tbody>
      ${r.slice(0, st.limit).map((a) => { const c = byId.get(a.customerId) || { firstName: '?' }; return `<tr data-c="${esc(a.customerId)}"><td><div class="row">${avatar(c)}<span>${esc(fullName(c))}</span></div></td><td>${esc(eventTitle(a))}</td>
        <td class="r num">${a.amount ? fmtMoney(a.amount, b.currency) : '—'}</td><td class="r pts ${a.points > 0 ? 'pos' : a.points < 0 ? 'neg' : ''}">${a.points ? signed(a.points) : '—'}</td>
        <td class="hide-sm small">${esc(a.staffName || '—')}${a.locationId && locations.length > 1 ? ` · ${esc(locName.get(a.locationId) || '')}` : ''}</td>
        <td class="hide-sm small muted nowrap">${fmtDate(a.at, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td></tr>`; }).join('')}</tbody></table>
      ${r.length > st.limit ? `<div style="padding:14px;text-align:center"><button class="btn" id="more">${t('view_all')} (${fmtNum(r.length)})</button></div>` : ''}` : empty(t('no_data_yet'));
    el.querySelectorAll('tr[data-c]').forEach((tr) => (tr.onclick = () => ctx.nav('customer/' + tr.dataset.c)));
    $('#more', el)?.addEventListener('click', () => { st.limit += 400; draw(); });
  }
  draw();
  el.querySelectorAll('[data-type]').forEach((x) => (x.onclick = () => { st.type = x.dataset.type; el.querySelectorAll('[data-type]').forEach((y) => y.setAttribute('aria-pressed', y === x)); draw(); }));
  $('#days', el).onchange = (e) => { st.days = +e.target.value; draw(); };
  $('#staff', el)?.addEventListener('change', (e) => { st.staff = e.target.value; draw(); });
  $('#loc', el)?.addEventListener('change', (e) => { st.loc = e.target.value; draw(); });
  $('#csv', el).onclick = () => download(`${b.slug}-activity.csv`, toCSV(rows().map((a) => {
    const c = byId.get(a.customerId) || {};
    return { id: a.id, date: new Date(a.at).toISOString(), type: a.type, member_number: c.memberNumber, customer: fullName(c), phone: c.phone, amount: a.amount || 0, points: a.points || 0, reward: a.rewardName || '', staff: a.staffName || '', location: locName.get(a.locationId) || '' };
  })), 'text/csv');
}
const lang2 = (k) => ({ time: document.documentElement.lang === 'ar' ? 'الوقت' : 'Time' }[k]);
