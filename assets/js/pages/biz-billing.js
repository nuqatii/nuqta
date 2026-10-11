// Owner's Subscription page: status, plans and prices, how to pay, payment history.
import { t, fmtNum, fmtMoney, fmtDate, lang } from '../core/i18n.js';
import { accessState, PAID_PLANS } from '../core/loyalty.js';
import { esc, icon, waLink } from '../ui/ui.js';

const CHIP = { trial: 'brand', active: 'ok', grace: 'warn', expired: 'bad', suspended: 'bad' };

export default async function billing(ctx, el) {
  const b = ctx.biz;
  const [platform, payments] = await Promise.all([
    ctx.platform ? Promise.resolve(ctx.platform) : ctx.S.platformSettings(),
    ctx.S.listPayments(ctx.bid).catch(() => []),
  ]);
  const a = accessState(b);
  const locked = a.state === 'expired' || a.state === 'suspended';
  const planName = (p) => t('plan_' + p);
  const price = (p) => fmtMoney(platform.prices?.[p] || 0, platform.currency);
  const msg = t('bl_confirm_msg', { biz: b.name, plan: planName(b.plan === 'trial' ? 'starter' : b.plan), id: ctx.bid });
  const wa = platform.supportWhatsapp ? waLink(platform.supportWhatsapp, msg) : '';

  el.innerHTML = `
  ${locked ? `<section class="panel" style="border-color:var(--danger);margin-bottom:16px"><div class="panel-b stack" style="gap:6px">
      <h2>${t('sub_locked_t')}</h2><p class="muted">${a.state === 'suspended' ? t('err_business-suspended') : t('sub_locked_d')}</p></div></section>` : ''}
  <div class="page-head"><div><h1>${t('nav_billing')}</h1>
    <p><span class="chip ${CHIP[a.state]}">${t('st_' + a.state)}</span>
      ${a.endsAt && a.state !== 'expired' ? ` ${planName(b.plan || 'trial')} · ${t('bl_until', { d: fmtDate(a.state === 'grace' ? a.lockAt : a.endsAt) })} · ${t('bl_days_left', { n: fmtNum(a.daysLeft) })}` : ''}</p></div></div>
  <div class="cols">
    <div class="c7 stack">
      <section class="panel"><div class="panel-h"><h2>${t('bl_plans')}</h2></div><div class="panel-b">
        <div class="plan-grid">${PAID_PLANS.map((p) => `<div class="plan ${b.plan === p ? 'cur' : ''}">
          <b>${planName(p)}</b><span class="price">${price(p)}</span><span class="small muted">${t('bl_per_month')}</span>
          ${b.plan === p ? `<span class="chip brand" style="justify-self:start;margin-top:6px">${t('bl_current')}</span>` : ''}</div>`).join('')}</div>
      </div></section>
      <section class="panel"><div class="panel-h"><h2>${t('bl_how')}</h2></div><div class="panel-b stack" style="gap:12px">
        <div class="payinfo" dir="auto">${esc(platform.paymentInfo || t('bl_how_none'))}</div>
        ${wa ? `<a class="btn primary lg" href="${esc(wa)}" target="_blank" rel="noopener">${icon('whatsapp')}${t('bl_confirm')}</a>` : ''}
        <p class="small muted">${t('bl_after')}</p>
        <p class="tiny muted ltr">ID: ${esc(ctx.bid)}</p>
      </div></section>
    </div>
    <section class="panel c5"><div class="panel-h"><h2>${t('bl_history')}</h2></div><div class="panel-b">
      ${payments.length ? `<ul class="list">${payments.map((p) => `<li><span class="av sq" style="background:var(--ok-tint);color:var(--ok)">${icon('check')}</span>
        <span class="grow"><span class="t">${planName(p.plan)} · ${t('bl_months', { n: fmtNum(p.months) })}</span>
        <span class="s">${fmtDate(p.at)}${p.method ? ' · ' + esc(p.method) : ''} · ${t('bl_until', { d: fmtDate(p.periodEnd) })}</span></span>
        <span class="num small">${p.amount ? fmtMoney(p.amount, p.currency) : ''}</span></li>`).join('')}</ul>` : `<p class="muted small">${t('bl_none')}</p>`}
    </div></section>
  </div>`;
}
