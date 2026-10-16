import { t, fmtNum, fmtMoney, tierName, lang } from '../core/i18n.js';
import { DAY, tierFor, autoSegment, AUTO_SEGMENTS } from '../core/loyalty.js';
import { $, barChart, lineChart, hbars, compact } from '../ui/ui.js';
import { buckets, sum } from './biz-common.js';
import { SEG_COLOR } from './biz-customers.js';

export default async function analytics(ctx, el) {
  const b = ctx.biz;
  const [customers, acts, locations] = await Promise.all([ctx.customers(), ctx.activity(), ctx.S.listLocations(ctx.bid)]);
  let days = 30;

  function draw() {
    const from = Date.now() - days * DAY;
    const a = acts.filter((x) => x.at >= from);
    const p = a.filter((x) => x.type === 'purchase');
    const earned = sum(a.filter((x) => x.points > 0), (x) => x.points), spent = -sum(a.filter((x) => x.type === 'redeem'), (x) => x.points);
    const returning = customers.filter((c) => c.visits >= 2).length;
    const dowNames = [...Array(7)].map((_, i) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SY' : 'en', { weekday: 'short' }).format(new Date(2026, 0, 4 + i)));
    const dow = dowNames.map((label, i) => ({ label, value: p.filter((x) => new Date(x.at).getDay() === i).length }));
    const daily = buckets(p, { n: Math.min(days, 60), size: DAY }).map((w) => ({ label: w.label, value: sum(w.items, (x) => x.amount) }));
    const tiers = [...b.tiers].sort((x, y) => x.min - y.min);
    const segCounts = AUTO_SEGMENTS.map((s) => ({ label: t('seg_' + s), value: customers.filter((c) => autoSegment(c, b.tiers) === s).length, color: SEG_COLOR[s] }));
    const staff = {}; for (const x of p) staff[x.staffName || '—'] = (staff[x.staffName || '—'] || 0) + 1;
    const locRev = locations.map((l) => ({ label: l.name, value: sum(p.filter((x) => (x.locationId || 'main') === l.id), (x) => x.amount) }));

    $('#body', el).innerHTML = `
    <section class="kpis" style="grid-template-columns:repeat(4,1fr)">
      <div class="kpi"><div class="l">${t('an_return_rate')}</div><div class="v">${customers.length ? Math.round((returning / customers.length) * 100) : 0}%</div><div class="d muted">${t('an_return_rate_d')}</div></div>
      <div class="kpi"><div class="l">${t('an_redemption_rate')}</div><div class="v">${earned ? Math.round((spent / earned) * 100) : 0}%</div><div class="d muted">${t('an_redemption_rate_d')}</div></div>
      <div class="kpi"><div class="l">${t('an_avg_visits')}</div><div class="v">${customers.length ? (sum(customers, (c) => c.visits) / customers.length).toFixed(1) : 0}</div></div>
      <div class="kpi"><div class="l">${t('avg_tx')}</div><div class="v" style="font-size:1.25rem">${fmtMoney(p.length ? Math.round(sum(p, (x) => x.amount) / p.length) : 0, b.currency)}</div></div>
    </section>
    <div class="cols">
      <section class="panel c8"><div class="panel-h"><h2>${t('revenue_chart')}</h2><span class="small muted">${fmtMoney(sum(p, (x) => x.amount), b.currency)}</span></div><div class="panel-b">${lineChart(daily, { fmt: compact })}</div></section>
      <section class="panel c4"><div class="panel-h"><h2>${t('an_by_dow')}</h2></div><div class="panel-b">${barChart(dow, { highlightLast: false })}</div></section>
      <section class="panel c4"><div class="panel-h"><h2>${t('an_by_tier')}</h2></div><div class="panel-b">${hbars(tiers.map((tr) => ({ label: tierName(tr), value: customers.filter((c) => tierFor(tiers, c.lifetimePoints)?.id === tr.id).length, color: tr.color })), { fmt: fmtNum })}</div></section>
      <section class="panel c4"><div class="panel-h"><h2>${t('an_by_segment')}</h2></div><div class="panel-b">${hbars(segCounts, { fmt: fmtNum })}</div></section>
      <section class="panel c4"><div class="panel-h"><h2>${t('an_by_staff')}</h2></div><div class="panel-b">${hbars(Object.entries(staff).sort((x, y) => y[1] - x[1]).map(([label, value]) => ({ label, value })), { fmt: fmtNum })}</div></section>
      ${locations.length > 1 ? `<section class="panel c12"><div class="panel-h"><h2>${t('an_by_location')}</h2></div><div class="panel-b">${hbars(locRev, { fmt: (v) => fmtMoney(v, b.currency) })}</div></section>` : ''}
    </div>`;
  }
  el.innerHTML = `<div class="page-head"><div><h1>${t('an_title')}</h1></div><div class="seg" id="range">${[30, 90, 120].map((d) => `<button data-d="${d}" aria-pressed="${d === days}">${t('an_range', { n: d })}</button>`).join('')}</div></div><div id="body"></div>`;
  el.querySelectorAll('[data-d]').forEach((x) => (x.onclick = () => { days = +x.dataset.d; el.querySelectorAll('[data-d]').forEach((y) => y.setAttribute('aria-pressed', y === x)); draw(); }));
  draw();
}
