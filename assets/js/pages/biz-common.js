// Helpers shared by business pages.
import { t, fmtNum, fmtMoney, ago, fmtDate, lang } from '../core/i18n.js';
import { DAY } from '../core/loyalty.js';
import { esc, icon, avatar, fullName } from '../ui/ui.js';

export const EV_ICON = { join: 'plus', purchase: 'receipt', redeem: 'gift', adjust: 'edit', tier: 'star' };

export const evName = (ev) => (lang === 'ar' && ev.rewardNameAr) || ev.rewardName || '';
export function eventTitle(ev) {
  switch (ev.type) {
    case 'join': return t('ev_join');
    case 'purchase': return t('ev_purchase');
    case 'redeem': return t('ev_redeem', { r: evName(ev) });
    case 'adjust': return t('ev_adjust') + (ev.note ? ` — ${ev.note}` : '');
    case 'tier': return t('ev_tier', { r: evName(ev) });
    default: return ev.type;
  }
}
export const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmtNum(Math.abs(n));

// One line in an activity list, optionally with the customer's name.
export function activityItem(ev, { customer, currency, showCustomer = true } = {}) {
  const pts = ev.points || 0;
  return `<li ${customer ? `data-cust="${customer.id}" style="cursor:pointer"` : ''}>
    ${showCustomer && customer ? avatar(customer) : `<span class="av sq" style="background:var(--sunken);color:var(--muted)">${icon(EV_ICON[ev.type] || 'star')}</span>`}
    <span class="grow">
      <span class="t">${showCustomer && customer ? esc(fullName(customer)) : esc(eventTitle(ev))}</span>
      <span class="s">${showCustomer && customer ? esc(eventTitle(ev)) + ' · ' : ''}${ev.amount ? fmtMoney(ev.amount, currency) + ' · ' : ''}${ago(ev.at)}${ev.staffName ? ' · ' + esc(ev.staffName) : ''}</span>
    </span>
    ${pts ? `<span class="pts ${pts > 0 ? 'pos' : 'neg'}">${signed(pts)}</span>` : ''}
  </li>`;
}

// Bucket events into the last `n` periods of `size` ms. Returns [{start, label, items}].
export function buckets(items, { n = 12, size = 7 * DAY, at = (x) => x.at, now = Date.now() } = {}) {
  const end = startOfDay(now) + DAY;
  const out = Array.from({ length: n }, (_, i) => { const start = end - (n - i) * size; return { start, items: [], label: fmtDate(start, { day: 'numeric', month: 'short' }) }; });
  const first = out[0].start;
  for (const x of items) {
    const ts = at(x); if (!ts || ts < first || ts >= end) continue;
    out[Math.min(n - 1, Math.floor((ts - first) / size))].items.push(x);
  }
  return out;
}
export const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const sum = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);
export const pctDelta = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 100) : null);
export const deltaHtml = (d, key = 'vs_prev') => (d == null ? '' : `<div class="d ${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d)}% <span class="muted">${t(key)}</span></div>`);

export function empty(text, actionHtml = '') { return `<div class="empty">${icon('sparkle')}<p>${esc(text)}</p>${actionHtml}</div>`; }
export const dir = () => (lang === 'ar' ? 'rtl' : 'ltr');
