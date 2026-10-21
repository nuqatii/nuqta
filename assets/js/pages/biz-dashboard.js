import { t, fmtNum, fmtMoney, rewardName, tierName } from '../core/i18n.js';
import { DAY, tierFor, daysToBirthday } from '../core/loyalty.js';
import { esc, icon, lineChart, barChart, compact, avatar, fullName } from '../ui/ui.js';
import { activityItem, buckets, sum, pctDelta, deltaHtml, empty } from './biz-common.js';

export default async function dashboard(ctx, el) {
  const b = ctx.biz;
  const [customers, acts, rewards] = await Promise.all([ctx.customers(), ctx.activity(), ctx.S.listRewards(ctx.bid)]);
  const now = Date.now();
  const byId = new Map(customers.map((c) => [c.id, c]));
  const inRange = (a, from, to) => a.at >= from && a.at < to;
  const last30 = acts.filter((a) => inRange(a, now - 30 * DAY, now + 1));
  const prev30 = acts.filter((a) => inRange(a, now - 60 * DAY, now - 30 * DAY));
  const purchases = (xs) => xs.filter((a) => a.type === 'purchase');
  const newWeek = customers.filter((c) => c.joinedAt >= now - 7 * DAY).length;
  const newPrev = customers.filter((c) => c.joinedAt >= now - 14 * DAY && c.joinedAt < now - 7 * DAY).length;
  const rev = sum(purchases(last30), (a) => a.amount), revPrev = sum(purchases(prev30), (a) => a.amount);
  const ptsIssued = sum(last30.filter((a) => a.points > 0), (a) => a.points), ptsPrev = sum(prev30.filter((a) => a.points > 0), (a) => a.points);
  const red = last30.filter((a) => a.type === 'redeem').length, redPrev = prev30.filter((a) => a.type === 'redeem').length;
  const ptsRedeemed = -sum(last30.filter((a) => a.type === 'redeem'), (a) => a.points);

  // Members over time: cumulative count at the end of each of the last 16 weeks.
  const weeks = buckets(customers, { n: 16, at: (c) => c.joinedAt });
  const before = customers.filter((c) => c.joinedAt < weeks[0].start).length;
  let run = before;
  const growth = weeks.map((w) => ({ label: w.label, value: (run += w.items.length) }));
  const revWeeks = buckets(purchases(acts), { n: 12 }).map((w) => ({ label: w.label, value: sum(w.items, (a) => a.amount) }));

  const top = [...customers].sort((a, c) => (c.spend || 0) - (a.spend || 0)).slice(0, 5);
  const popular = [...rewards].sort((a, c) => (c.redeemedCount || 0) - (a.redeemedCount || 0)).slice(0, 5);
  const maxPop = Math.max(1, ...popular.map((r) => r.redeemedCount || 0));
  const first = (ctx.user.name || '').split(' ')[0];
  const bdays = customers.filter((c) => daysToBirthday(c.birthday) === 0);

  el.innerHTML = `
  <div class="page-head">
    <div><h1>${t('dash_hello', { name: esc(first || '') })}</h1><p>${t('dash_today', { biz: esc(b.name) })}</p></div>
    <div class="actions">${ctx.can('checkout') ? `<a class="btn primary lg" href="#/checkout">${icon('scan')}${t('quick_checkout')}</a>` : ''}</div>
  </div>
  ${bdays.length ? `<a class="bday-bar" href="#/customers?seg=bday_today">${icon('cake')}<span class="grow"><b>${bdays.length === 1 ? t('bd_dash_one', { name: esc(bdays[0].firstName) }) : t('bd_dash', { n: fmtNum(bdays.length) })}</b><small>${t('bd_dash_sub')}</small></span><span class="btn sm">${t('bd_see')}</span></a>` : ''}
  <section class="kpis" aria-label="Summary">
    <div class="kpi"><div class="l">${t('k_customers')}</div><div class="v">${fmtNum(customers.length)}</div></div>
    <div class="kpi"><div class="l">${t('k_new')}</div><div class="v">${fmtNum(newWeek)}</div>${deltaHtml(pctDelta(newWeek, newPrev), 'vs_prev_week')}</div>
    <div class="kpi"><div class="l">${t('k_revenue')}</div><div class="v" title="${fmtMoney(rev, b.currency)}">${fmtMoney(compactish(rev), b.currency)}</div>${deltaHtml(pctDelta(rev, revPrev))}</div>
    <div class="kpi"><div class="l">${t('k_points')}</div><div class="v">${fmtNum(ptsIssued)}</div>${deltaHtml(pctDelta(ptsIssued, ptsPrev))}</div>
    <div class="kpi"><div class="l">${t('k_redeemed')}</div><div class="v">${fmtNum(red)}</div>${deltaHtml(pctDelta(red, redPrev))}</div>
  </section>
  <div class="cols">
    <section class="panel c7"><div class="panel-h"><h2>${t('growth_chart')}</h2><span class="small muted">${fmtNum(customers.length)}</span></div>
      <div class="panel-b">${customers.length ? lineChart(growth, { fmt: compact }) : empty(t('no_data_yet'))}</div></section>
    <section class="panel c5"><div class="panel-h"><h2>${t('loyalty_activity')}</h2><span class="small muted">30d</span></div>
      <div class="panel-b stack" style="gap:18px">
        <div class="row" style="gap:28px">
          <div><div class="small muted">${t('earned_pts')}</div><div style="font-size:1.5rem;font-weight:600" class="num pos">+${fmtNum(ptsIssued)}</div></div>
          <div><div class="small muted">${t('redeemed_pts')}</div><div style="font-size:1.5rem;font-weight:600" class="num">${fmtNum(ptsRedeemed)}</div></div>
        </div>
        <div><div class="progress-line" style="--cb:var(--saffron)"><i style="width:${ptsIssued ? Math.min(100, (ptsRedeemed / ptsIssued) * 100) : 0}%"></i></div>
        <p class="small muted" style="margin-top:6px">${t('an_redemption_rate')}: ${ptsIssued ? Math.round((ptsRedeemed / ptsIssued) * 100) : 0}%</p></div>
        <div class="stack" style="gap:8px">${tierStrip(customers, b)}</div>
      </div></section>
    <section class="panel c7"><div class="panel-h"><h2>${t('revenue_chart')}</h2></div>
      <div class="panel-b">${barChart(revWeeks, { fmt: compact })}</div></section>
    <section class="panel c5"><div class="panel-h"><h2>${t('popular_rewards')}</h2><a class="small" href="#/rewards">${t('view_all')}</a></div>
      <div class="panel-b">${popular.length ? `<div class="bars">${popular.map((r) => `<div class="bar-row"><span class="nowrap" style="overflow:hidden;text-overflow:ellipsis">${esc(rewardName(r))}</span><div class="track"><div class="fill" style="width:${((r.redeemedCount || 0) / maxPop) * 100}%;background:var(--saffron)"></div></div><span class="num small">${fmtNum(r.redeemedCount || 0)}</span></div>`).join('')}</div>` : empty(t('rw_empty'), `<a class="btn" href="#/rewards">${t('rw_add')}</a>`)}</div></section>
    <section class="panel c6"><div class="panel-h"><h2>${t('top_customers')}</h2><a class="small" href="#/customers">${t('view_all')}</a></div>
      <div class="panel-b"><ul class="list">${top.map((c) => { const tr = tierFor(b.tiers, c.lifetimePoints); return `<li data-cust="${c.id}" style="cursor:pointer">${avatar(c)}<span class="grow"><span class="t">${esc(fullName(c))}</span><span class="s">${fmtNum(c.visits)} ${t('visits')} · <span class="chip dot" style="--c:${esc(tr?.color)};padding:0 8px">${esc(tierName(tr))}</span></span></span><span class="num small">${fmtMoney(c.spend, b.currency)}</span></li>`; }).join('') || `<li class="muted">${t('no_data_yet')}</li>`}</ul></div></section>
    <section class="panel c6"><div class="panel-h"><h2>${t('recent_tx')}</h2><a class="small" href="#/transactions">${t('view_all')}</a></div>
      <div class="panel-b"><ul class="list">${acts.slice(0, 6).map((a) => activityItem(a, { customer: byId.get(a.customerId), currency: b.currency })).join('') || `<li class="muted">${t('no_data_yet')}</li>`}</ul></div></section>
  </div>`;
  el.querySelectorAll('[data-cust]').forEach((li) => (li.onclick = () => ctx.nav('customer/' + li.dataset.cust)));
}

const compactish = (n) => (n >= 100000 ? Math.round(n / 1000) * 1000 : n);

function tierStrip(customers, b) {
  const tiers = [...(b.tiers || [])].sort((x, y) => x.min - y.min);
  if (tiers.length < 2) return '';
  const counts = tiers.map((tr) => customers.filter((c) => tierFor(tiers, c.lifetimePoints)?.id === tr.id).length);
  const total = Math.max(1, customers.length);
  return `<div class="small muted">${t('an_by_tier')}</div>
    <div style="display:flex;height:12px;border-radius:99px;overflow:hidden;background:var(--sunken)">${tiers.map((tr, i) => `<span title="${esc(tierName(tr))}: ${counts[i]}" style="width:${(counts[i] / total) * 100}%;background:${esc(tr.color)}"></span>`).join('')}</div>
    <div class="row wrap" style="gap:12px">${tiers.map((tr, i) => `<span class="chip dot" style="--c:${esc(tr.color)}">${esc(tierName(tr))} · ${fmtNum(counts[i])}</span>`).join('')}</div>`;
}
