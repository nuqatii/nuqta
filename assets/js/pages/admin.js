// Platform admin: tenants, trials, subscriptions and payments, platform settings.
// Aggregates only — never customer PII.
import { getService } from '../data/index.js';
import { t, setLang, lang, appName, fmtNum, fmtMoney, ago, fmtDate } from '../core/i18n.js';
import { DAY, accessState, PLANS, PAID_PLANS, extendPaid, extendTrial, planKey } from '../core/loyalty.js';
import { esc, icon, $, showError, toast, confirmBox, modal, waLink } from '../ui/ui.js';
import { baseUrl } from '../config.js';
import { faqText } from '../core/faq.js';

const S = await getService();
const root = document.getElementById('root');
const CHIP = { trial: 'brand', active: 'ok', grace: 'warn', expired: 'bad', suspended: 'bad' };
let filter = 'all';
let search = '';
let paySearch = '';
let sort = 'new';
const TABS = ['businesses', 'followups', 'payments', 'billing', 'settings', 'faq'];
const TAB_ICON = { businesses: 'building', followups: 'clock', payments: 'receipt', billing: 'card', settings: 'gear', faq: 'info' };
const route = () => { const h = location.hash.replace('#', ''); if (h.startsWith('biz/')) return { tab: 'businesses', biz: h.slice(4) }; return { tab: TABS.includes(h) ? h : 'businesses' }; };
addEventListener('hashchange', () => { scrollTo(0, 0); render().catch(showError); });
const RECENT = 3 * DAY;   // "contacted" hides a follow-up for 3 days

// Ready-made WhatsApp messages to owners, in the business's own language.
const MSG = {
  ar: {
    hello: 'مرحباً {name}، معك فريق نقاطي بخصوص {biz}.',
    trial: 'مرحباً {name}، معك فريق نقاطي. تنتهي التجربة المجانية لـ {biz} في {date}. هل ترغب بالاستمرار في الاشتراك؟ نحن هنا لأي سؤال.',
    active: 'مرحباً {name}، معك فريق نقاطي. ينتهي اشتراك {biz} في {date}. هل نجدده لك؟',
    grace: 'مرحباً {name}، معك فريق نقاطي. انتهت فترة {biz}، وستتوقف إضافة النقاط بعد {n} أيام. راسلنا هنا لتجديد الاشتراك.',
    idle: 'مرحباً {name}، معك فريق نقاطي. لاحظنا أنه لم تُسجَّل مشتريات في {biz} منذ فترة. هل تحتاج أي مساعدة في استخدام البطاقة مع الزبائن؟',
    fresh: 'مرحباً {name}، أهلاً بك في نقاطي! لاحظنا أن {biz} لم يضف زبائن بعد. هل نساعدك بتجهيز ملصق رمز QR والبدء؟',
  },
  en: {
    hello: 'Hi {name}, this is the nuqatii team about {biz}.',
    trial: 'Hi {name}, this is the nuqatii team. The free trial for {biz} ends on {date}. Would you like to continue with a subscription? We’re here for any questions.',
    active: 'Hi {name}, this is the nuqatii team. The subscription for {biz} ends on {date}. Shall we renew it for you?',
    grace: 'Hi {name}, this is the nuqatii team. The period for {biz} has ended, and adding points stops in {n} days. Message us here to renew.',
    idle: 'Hi {name}, this is the nuqatii team. We noticed no purchases have been recorded at {biz} for a while. Can we help you use the card with your customers?',
    fresh: 'Hi {name}, welcome to nuqatii! We noticed {biz} hasn’t added any customers yet. Can we help you set up your QR poster and get started?',
  },
};
function ownerMsg(kind, b, contact, extra = {}) {
  const L2 = b.lang === 'en' ? 'en' : 'ar';
  const date = extra.date ? new Intl.DateTimeFormat(L2 === 'ar' ? 'ar-SY-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'long' }).format(new Date(extra.date)) : '';
  return MSG[L2][kind].replace('{name}', contact?.ownerName || '').replace(/ ،/, '،').replace(/\s+,/, ',').replace('{biz}', b.name).replace('{date}', date).replace('{n}', extra.n ?? '');
}
const contactBtns = (b, contact, kind = 'hello', extra) => (contact?.ownerPhone
  ? `<a class="btn sm icon wa" href="${esc(waLink(contact.ownerPhone, ownerMsg(kind, b, contact, extra)))}" target="_blank" rel="noopener" title="WhatsApp" aria-label="WhatsApp">${icon('whatsapp')}</a><a class="btn sm icon" href="tel:${esc(contact.ownerPhone)}" title="${t('bd_call')}" aria-label="${t('bd_call')}">${icon('phone')}</a>`
  : `<span class="tiny muted" title="${t('ad_no_phone')}">${t('ad_no_phone')}</span>`);
const logoOf = (b) => (b.logo ? `<img src="${esc(b.logo)}" style="width:32px;height:32px;border-radius:8px;object-fit:cover" alt="">` : `<span class="av sq">${esc((b.name || '?')[0])}</span>`);
const subLine = (b) => (b.acc.state === 'expired' ? fmtDate(b.acc.endsAt) : b.acc.state === 'suspended' ? '' : `${t('bl_until', { d: fmtDate(b.acc.state === 'grace' ? b.acc.lockAt : b.acc.endsAt) })} · ${t('bl_days_left', { n: b.acc.daysLeft })}`);

// Businesses that need a message from you, grouped by reason.
function followUps(rows, dir, now) {
  const live = (r) => ['trial', 'active', 'grace'].includes(r.acc.state);
  const groups = {
    ending: rows.filter((r) => live(r) && r.acc.daysLeft <= 7).sort((a, b) => a.acc.daysLeft - b.acc.daysLeft),
    fresh: rows.filter((r) => live(r) && !(r.statCustomers > 0) && r.createdAt < now - DAY && r.createdAt > now - 30 * DAY),
    idle: rows.filter((r) => live(r) && r.statCustomers > 0 && (r.lastActivityAt || 0) < now - 14 * DAY),
  };
  const recent = (r) => (dir.get(r.id)?.note?.contactedAt || 0) > now - RECENT;
  for (const k of Object.keys(groups)) groups[k].sort((a, b) => recent(a) - recent(b));
  const open = new Set(Object.values(groups).flat().filter((r) => !recent(r)).map((r) => r.id));
  return { groups, recent, openCount: open.size };
}

// Data is loaded once and kept while the page is open, so switching tabs is instant.
// Anything you change reloads it; it also refreshes quietly in the background after 2 minutes.
const C = { details: new Map(), at: 0 };
let isAdmin = null;
const STALE = 2 * 60 * 1000;
function reload() { for (const k of ['list', 'settings', 'dir', 'faq', 'pays']) delete C[k]; C.details.clear(); return render().catch(showError); }
async function ensure(tab, biz) {
  const jobs = [];
  const want = (k, fn) => { if (C[k] === undefined) jobs.push(fn().then((v) => { C[k] = v; })); };
  if (C.list === undefined) C.at = Date.now();
  want('list', () => S.adminListBusinesses());
  want('settings', () => S.adminSettings());
  want('dir', () => S.adminDirectory().catch(() => new Map()));
  if (tab === 'faq') want('faq', () => S.faq());
  if (tab === 'payments') want('pays', () => S.adminListPayments());
  if (biz && !C.details.has(biz)) jobs.push(S.adminBusinessDetails(biz).catch(() => null).then((v) => C.details.set(biz, v)));
  if (jobs.length) await Promise.all(jobs);
}
let refreshing = false;
function refreshInBackground() {
  if (refreshing || Date.now() - C.at < STALE) return;
  refreshing = true;
  Promise.all([S.adminListBusinesses(), S.adminSettings(), S.adminDirectory().catch(() => C.dir)]).then(([l, st, d]) => {
    C.list = l; C.settings = st; C.dir = d; delete C.pays; C.details.clear(); C.at = Date.now();
    if (!document.querySelector('.modal-back') && !document.activeElement?.matches('input, textarea, select')) render().catch(() => {});
  }).catch(() => {}).finally(() => { refreshing = false; });
}

async function render() {
  if (!S.auth.current()) return location.replace('login.html?next=admin.html');
  if (isAdmin === null) isAdmin = await S.isPlatformAdmin();
  if (!isAdmin) { root.className = 'center-load'; root.innerHTML = `<div class="empty">${icon('shield')}<p>${t('ad_not_admin')}</p><a class="btn" href="app.html">${t('back')}</a></div>`; return; }
  const { tab, biz } = route();
  // Switch the tab straight away; show a spinner only if this tab's data isn't loaded yet.
  const bar = root.querySelector('.ad-tabs');
  if (bar) bar.querySelectorAll('a').forEach((a) => a.setAttribute('aria-selected', a.getAttribute('href') === '#' + tab));
  const missing = C.list === undefined || (tab === 'faq' && !C.faq) || (tab === 'payments' && !C.pays) || (biz && !C.details.has(biz));
  if (missing && bar) $('#tabBody').innerHTML = '<div class="center-load" style="min-height:240px"><div class="spinner"></div></div>';
  await ensure(tab, biz);
  if (route().tab !== tab || route().biz !== biz) return;   // the person already moved on
  const { list, settings, dir, faq, pays } = C;
  const now = Date.now();
  const rows = list.map((b) => ({ ...b, acc: accessState(b, now) }));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const is = (r, f) => f === 'all' || (f === 'trial' && r.acc.state === 'trial') || (f === 'active' && r.acc.state === 'active')
    || (f === 'expiring' && ['trial', 'active', 'grace'].includes(r.acc.state) && r.acc.daysLeft <= 7)
    || (f === 'locked' && ['grace', 'expired', 'suspended'].includes(r.acc.state));
  const count = (f) => rows.filter((r) => is(r, f)).length;
  const tot = (k) => list.reduce((s, b) => s + (b[k] || 0), 0);
  const mrr = rows.filter((r) => r.acc.state === 'active').reduce((s, r) => s + (settings.prices?.[planKey(r.plan)] || 0), 0);
  const fu = followUps(rows, dir, now);
  const details = biz ? C.details.get(biz) : null;
  setTimeout(refreshInBackground, 0);

  document.title = `${t('ad_title')} · ${details ? details.name : t('ad_tab_' + tab)}`;
  root.className = '';
  root.innerHTML = `${S.mode === 'demo' ? `<div class="demo-bar">${t('demo_banner')}</div>` : ''}
  <main class="page" style="margin-inline:auto">
    <div class="page-head"><div><div class="brandmark" style="padding:0 0 8px"><span class="dot"></span>${esc(appName())}</div><h1>${t('ad_title')}</h1><p>${t('ad_privacy')}</p></div>
      <div class="actions"><button class="btn ghost" id="lang">${icon('globe')}${t('switch_lang')}</button><button class="btn" id="out">${icon('out')}${t('nav_signout')}</button></div></div>
    <nav class="ad-tabs" role="tablist">${TABS.map((x) => `<a role="tab" href="#${x}" aria-selected="${x === tab}">${icon(TAB_ICON[x])}<span>${t('ad_tab_' + x)}</span>${x === 'followups' && fu.openCount ? `<b class="ad-badge">${fmtNum(fu.openCount)}</b>` : ''}</a>`).join('')}</nav>
    <div id="tabBody">${biz ? detailsView() : tab === 'businesses' ? businessesTab() : tab === 'followups' ? followupsTab() : tab === 'payments' ? paymentsTab() : tab === 'billing' ? billingTab() : tab === 'settings' ? settingsTab() : faqTab()}</div>
  </main>`;

  // ── Businesses ──
  function businessesTab() {
    return `<section class="kpis">
      <div class="kpi"><div class="l">${t('ad_businesses')}</div><div class="v">${fmtNum(list.length)}</div><div class="d muted">${fmtNum(list.filter((b) => b.createdAt > now - 30 * DAY).length)} ${t('ad_new')}</div></div>
      <div class="kpi"><div class="l">${t('ad_k_trials')}</div><div class="v">${fmtNum(count('trial'))}</div></div>
      <div class="kpi"><div class="l">${t('ad_k_paying')}</div><div class="v">${fmtNum(count('active'))}</div></div>
      <div class="kpi"><div class="l">${t('ad_k_locked')}</div><div class="v">${fmtNum(count('locked'))}</div></div>
      <div class="kpi"><div class="l">${t('ad_k_mrr')}</div><div class="v">${fmtMoney(mrr, settings.currency)}</div></div>
    </section>
    <section class="panel"><div class="panel-h"><h2>${t('ad_businesses')}</h2>
      <div class="row wrap">${['all', 'trial', 'active', 'expiring', 'locked'].map((f) => `<button class="chip" data-f="${f}" aria-pressed="${filter === f}">${t('ad_f_' + f)} · ${fmtNum(count(f))}</button>`).join('')}</div></div>
      <div class="row wrap" style="margin-top:12px"><div style="position:relative;flex:1;min-width:220px"><input class="input" id="adq" type="search" value="${esc(search)}" placeholder="${t('ad_search_ph')}" style="padding-inline-start:40px" autocomplete="off">
        <span style="position:absolute;inset-inline-start:12px;top:12px;color:var(--faint);width:20px;height:20px">${icon('search')}</span></div>
        <select class="input" id="adsort" style="width:auto" aria-label="${t('ad_sort')}">${['new', 'name', 'ends', 'customers', 'active'].map((x) => `<option value="${x}" ${sort === x ? 'selected' : ''}>${t('ad_sort_' + x)}</option>`).join('')}</select></div>
      <div class="table-wrap" style="margin-top:12px" id="adtbl"></div></section>`;
  }
  function tableHtml() {
    const q = search.trim().toLowerCase();
    let shown = rows.filter((r) => is(r, filter));
    if (q) shown = shown.filter((b) => [b.name, b.slug, t('bt_' + b.type), b.id, dir.get(b.id)?.ownerEmail, dir.get(b.id)?.ownerName, dir.get(b.id)?.ownerPhone].some((v) => String(v || '').toLowerCase().includes(q)));
    const key = { new: (b) => -(b.createdAt || 0), ends: (b) => (b.acc.state === 'suspended' ? Infinity : b.acc.endsAt || 0), customers: (b) => -(b.statCustomers || 0), active: (b) => -(b.lastActivityAt || 0) }[sort];
    shown.sort(key ? (a, b) => key(a) - key(b) : (a, b) => a.name.localeCompare(b.name, lang));
    return `<table class="tbl"><thead><tr>
      <th>${t('col_business')}</th><th>${t('ad_sub')}</th><th class="hide-sm">${t('ad_plan')}</th><th class="r hide-sm">${t('k_customers')}</th><th class="r hide-sm">${t('ad_txns')}</th><th class="hide-sm">${t('ad_last_active')}</th><th>${t('ad_actions')}</th></tr></thead><tbody>
      ${shown.map((b) => `<tr data-open="${b.id}" tabindex="0"><td><div class="row">${logoOf(b)}<div><div style="font-weight:500">${esc(b.name)}</div><div class="small muted"><span class="ltr">/${esc(b.slug)}</span> · ${t('bt_' + b.type)} · ${fmtDate(b.createdAt)}</div></div></div></td>
        <td><span class="chip ${CHIP[b.acc.state]}">${t('st_' + b.acc.state)}</span><div class="small muted" style="margin-top:4px">${subLine(b)}</div></td>
        <td class="hide-sm">${t('plan_' + planKey(b.plan))}</td>
        <td class="r num hide-sm">${fmtNum(b.statCustomers || 0)}</td><td class="r num hide-sm">${fmtNum(b.statTxns || 0)}</td>
        <td class="hide-sm small muted">${ago(b.lastActivityAt)}</td>
        <td data-stop><div class="row" style="gap:6px;flex-wrap:nowrap">
          ${dir.get(b.id)?.ownerPhone ? contactBtns(b, dir.get(b.id)).split('</a>')[0] + '</a>' : ''}
          <button class="btn sm primary" data-pay="${b.id}">${t('ad_mark_paid')}</button>
          <button class="btn sm icon" data-more="${b.id}" aria-label="${t('nav_more')}">${icon('more')}</button></div></td></tr>`).join('')
        || `<tr><td colspan="7" class="muted" style="text-align:center;padding:24px">${q ? t('ad_no_match', { q: esc(search) }) : '—'}</td></tr>`}
    </tbody></table>`;
  }

  // ── Follow-ups ──
  function followupsTab() {
    const reasonLine = (k, b) => (k === 'ending' ? `<span class="chip ${CHIP[b.acc.state]}">${t('st_' + b.acc.state)}</span> ${subLine(b)}`
      : k === 'fresh' ? t('ad_fu_fresh_line', { d: ago(b.createdAt) }) : t('ad_fu_idle_line', { d: ago(b.lastActivityAt) }));
    const kindOf = (k, b) => (k === 'ending' ? (b.acc.state === 'grace' ? 'grace' : b.acc.state === 'active' ? 'active' : 'trial') : k);
    const extraOf = (k, b) => (k === 'ending' ? { date: b.acc.state === 'grace' ? b.acc.lockAt : b.acc.endsAt, n: b.acc.daysLeft } : {});
    const section = (k) => { const xs = fu.groups[k]; return `<section class="panel" style="margin-bottom:16px"><div class="panel-h"><div><h2>${t('ad_fu_' + k)} <span class="chip">${fmtNum(xs.length)}</span></h2><p class="small muted" style="margin:4px 0 0">${t('ad_fu_' + k + '_d')}</p></div></div>
      <div class="panel-b">${xs.length ? `<ul class="list fu-list">${xs.map((b) => { const c = dir.get(b.id) || {}; const done = fu.recent(b); return `<li class="${done ? 'done' : ''}">
        <a class="row grow" href="#biz/${b.id}" style="text-decoration:none;color:inherit;min-width:0">${logoOf(b)}<span class="grow" style="min-width:0"><span class="t">${esc(b.name)}${c.ownerName ? ` <span class="muted small">· ${esc(c.ownerName)}</span>` : ''}</span><span class="s">${reasonLine(k, b)}</span>
          ${c.note?.contactedAt ? `<span class="tiny muted">${t('ad_contacted_ago', { d: ago(c.note.contactedAt) })}</span>` : ''}</span></a>
        <span class="row" style="gap:6px;flex-wrap:nowrap">${contactBtns(b, c, kindOf(k, b), extraOf(k, b))}<button class="btn sm" data-contacted="${b.id}" ${done ? 'disabled' : ''}>${icon('check')}<span class="hide-sm">${t('ad_mark_contacted')}</span></button></span></li>`; }).join('')}</ul>`
        : `<p class="small muted">${t('ad_fu_none')}</p>`}</div></section>`; };
    return `<p class="muted" style="margin:0 0 14px">${t('ad_fu_intro')}</p>${['ending', 'fresh', 'idle'].map(section).join('')}`;
  }

  // ── Payments ──
  function paymentsTab() {
    const month = (ms) => { const d = new Date(ms); return d.getFullYear() * 12 + d.getMonth(); };
    const thisM = month(now);
    const sumBy = (xs) => { const m = {}; for (const p of xs) m[p.currency || 'USD'] = (m[p.currency || 'USD'] || 0) + (Number(p.amount) || 0); return Object.entries(m).map(([c, v]) => fmtMoney(v, c)).join(' + ') || fmtMoney(0, settings.currency); };
    return `<section class="kpis">
      <div class="kpi"><div class="l">${t('ad_pay_this_month')}</div><div class="v">${sumBy(pays.filter((p) => month(p.at) === thisM))}</div><div class="d muted">${fmtNum(pays.filter((p) => month(p.at) === thisM).length)} ${t('ad_pay_count')}</div></div>
      <div class="kpi"><div class="l">${t('ad_pay_last_month')}</div><div class="v">${sumBy(pays.filter((p) => month(p.at) === thisM - 1))}</div></div>
      <div class="kpi"><div class="l">${t('ad_pay_all')}</div><div class="v">${sumBy(pays)}</div><div class="d muted">${fmtNum(pays.length)} ${t('ad_pay_count')}</div></div>
    </section>
    <section class="panel"><div class="panel-h"><h2>${t('ad_tab_payments')}</h2>
      <div style="position:relative;min-width:220px"><input class="input" id="payq" type="search" value="${esc(paySearch)}" placeholder="${t('ad_pay_search')}" style="padding-inline-start:40px" autocomplete="off">
      <span style="position:absolute;inset-inline-start:12px;top:12px;color:var(--faint);width:20px;height:20px">${icon('search')}</span></div></div>
      <div class="table-wrap" style="margin-top:12px" id="paytbl"></div></section>`;
  }
  function payTableHtml() {
    const q = paySearch.trim().toLowerCase();
    const xs = pays.filter((p) => !q || [byId.get(p.businessId)?.name, p.method, p.note, p.by].some((v) => String(v || '').toLowerCase().includes(q)));
    return `<table class="tbl"><thead><tr><th>${t('ad_pay_date')}</th><th>${t('col_business')}</th><th class="hide-sm">${t('ad_plan')}</th><th class="r">${t('ad_amount')}</th><th class="hide-sm">${t('ad_method')}</th><th class="hide-sm">${t('ad_note')}</th></tr></thead><tbody>
      ${xs.map((p) => { const b = byId.get(p.businessId); return `<tr data-open="${esc(p.businessId)}" tabindex="0"><td class="small">${fmtDate(p.at)}</td>
        <td><div style="font-weight:500">${esc(b?.name || p.businessId)}</div><div class="small muted">${t('ad_paid_until_short', { d: fmtDate(p.periodEnd) })}</div></td>
        <td class="hide-sm">${t('plan_' + planKey(p.plan))} · ${t('bl_months', { n: p.months })}</td><td class="r num">${p.amount ? fmtMoney(p.amount, p.currency) : '—'}</td>
        <td class="hide-sm small">${esc(p.method || '')}</td><td class="hide-sm small muted">${esc(p.note || '')}</td></tr>`; }).join('')
      || `<tr><td colspan="6" class="muted" style="text-align:center;padding:24px">${q ? t('ad_no_match', { q: esc(paySearch) }) : t('ad_pay_none')}</td></tr>`}</tbody></table>`;
  }

  // ── One business ──
  function detailsView() {
    if (!details) return `<div class="empty">${icon('info')}<p>${t('ad_biz_missing')}</p><a class="btn" href="#businesses">${t('back')}</a></div>`;
    const b = { ...details, acc: accessState(details, now) }; const c = details.contact || {}; const n = details.note || {};
    const owner = details.members.find((m) => m.role === 'owner');
    const joinUrl = `${baseUrl()}rewards.html?b=${b.slug}`;
    const row = (label, value) => `<li><span class="grow small muted">${label}</span><span>${value}</span></li>`;
    return `<a class="btn ghost sm" href="#businesses" style="margin-bottom:12px">${icon('back')}${t('ad_tab_businesses')}</a>
    <div class="biz-head"><div class="row" style="gap:14px">${b.logo ? `<img src="${esc(b.logo)}" style="width:56px;height:56px;border-radius:14px;object-fit:cover" alt="">` : `<span class="av sq" style="width:56px;height:56px;font-size:1.4rem">${esc(b.name[0])}</span>`}
      <div><h2 style="margin:0">${esc(b.name)}</h2><div class="small muted"><a class="ltr" href="${esc(joinUrl)}" target="_blank" rel="noopener">/${esc(b.slug)}</a> · ${t('bt_' + b.type)} · ${t('ad_since', { d: fmtDate(b.createdAt) })}</div></div></div>
      <div class="row wrap"><button class="btn primary" id="dPay">${t('ad_mark_paid')}</button><button class="btn" id="dMore">${icon('sliders')}${t('ad_manage')}</button></div></div>
    <div class="cols" style="margin-top:16px;align-items:start">
      <div class="c7 stack">
        <section class="panel"><div class="panel-h"><h2>${t('ad_sub')}</h2><span class="chip ${CHIP[b.acc.state]}">${t('st_' + b.acc.state)}</span></div><div class="panel-b"><ul class="list">
          ${row(t('ad_plan'), t('plan_' + planKey(b.plan)))}
          ${b.acc.state !== 'suspended' ? row(b.acc.state === 'grace' ? t('ad_locks_on') : t('ad_ends_on'), `${fmtDate(b.acc.state === 'grace' ? b.acc.lockAt : b.acc.endsAt)} · ${t('bl_days_left', { n: b.acc.daysLeft })}`) : ''}
          ${row(t('ad_trial_end'), fmtDate(b.trialEndsAt))}
          ${b.paidUntil ? row(t('ad_paid_until'), fmtDate(b.paidUntil)) : ''}
          ${b.terms?.acceptedAt ? row(t('ad_terms_ok'), fmtDate(b.terms.acceptedAt)) : ''}
        </ul></div></section>
        <section class="panel"><div class="panel-h"><h2>${t('ad_usage')}</h2></div><div class="panel-b"><div class="kpis mini">
          <div class="kpi"><div class="l">${t('k_customers')}</div><div class="v">${fmtNum(b.statCustomers || 0)}</div></div>
          <div class="kpi"><div class="l">${t('ad_txns')}</div><div class="v">${fmtNum(b.statTxns || 0)}</div></div>
          <div class="kpi"><div class="l">${t('ad_redeemed')}</div><div class="v">${fmtNum(b.statRedeemed || 0)}</div></div>
          <div class="kpi"><div class="l">${t('ad_last_active')}</div><div class="v small">${ago(b.lastActivityAt)}</div></div></div></div></section>
        <section class="panel"><div class="panel-h"><h2>${t('ad_history')}</h2></div><div class="panel-b">${details.payments.length ? `<ul class="list">${details.payments.map((p) => `<li><span class="grow"><span class="t">${t('plan_' + planKey(p.plan))} · ${t('bl_months', { n: p.months })}</span><span class="s">${fmtDate(p.at)} · ${esc(p.method || '')}${p.note ? ' · ' + esc(p.note) : ''}</span></span><span class="num small">${p.amount ? fmtMoney(p.amount, p.currency) : ''}</span></li>`).join('')}</ul>` : `<p class="small muted">${t('bl_none')}</p>`}</div></section>
      </div>
      <div class="c5 stack">
        <section class="panel"><div class="panel-h"><h2>${t('ad_owner')}</h2></div><div class="panel-b stack" style="gap:12px">
          <ul class="list">${row(t('ad_owner_name'), esc(c.ownerName || owner?.name || '—'))}${row(t('email'), (c.ownerEmail || owner?.email) ? `<a class="ltr" href="mailto:${esc(c.ownerEmail || owner?.email)}">${esc(c.ownerEmail || owner?.email)}</a>` : '—')}</ul>
          <form class="form" id="dPhone"><label class="field"><span>${t('ad_owner_wa')}</span><div class="row"><input class="input" name="phone" type="tel" dir="ltr" value="${esc(c.ownerPhone || '')}" placeholder="09XX XXX XXX" style="max-width:200px"><button class="btn" type="submit">${t('save')}</button></div></label></form>
          <div class="row" style="gap:8px">${contactBtns(b, c)}</div>
        </div></section>
        <section class="panel"><div class="panel-h"><h2>${t('ad_notes')}</h2></div><div class="panel-b stack" style="gap:10px">
          <textarea class="input" id="dNote" rows="6" maxlength="4000" dir="auto" placeholder="${t('ad_notes_ph')}">${esc(n.text || '')}</textarea>
          <div class="spread"><span class="tiny muted">${n.updatedAt ? t('ad_saved_ago', { d: ago(n.updatedAt) }) : t('ad_notes_private')}</span><button class="btn sm primary" id="dNoteSave">${t('save')}</button></div>
          <div class="hr"></div>
          <div class="spread"><span class="small">${n.contactedAt ? t('ad_contacted_ago', { d: ago(n.contactedAt) }) : t('ad_never_contacted')}</span><button class="btn sm" id="dContacted">${icon('check')}${t('ad_mark_contacted')}</button></div>
        </div></section>
        <section class="panel"><div class="panel-h"><h2>${t('ad_team')}</h2><span class="small muted">${fmtNum(details.members.length)}</span></div><div class="panel-b"><ul class="list">
          ${details.members.map((m) => `<li><span class="grow"><span class="t">${esc(m.name || m.email || '')}</span><span class="s ltr">${esc(m.email || '')}</span></span><span class="chip">${t('role_' + m.role)}</span></li>`).join('') || '<li class="muted small">—</li>'}
        </ul></div></section>
      </div>
    </div>`;
  }

  // ── Billing / settings / FAQ ──
  function billingTab() {
    return `<section class="panel"><div class="panel-h"><h2>${t('ad_billing')}</h2></div><div class="panel-b"><form class="form" id="bs" style="max-width:720px">
        <div class="grid2"><label class="field"><span>${t('ad_trial_days')}</span><input class="input num" name="trialDays" inputmode="numeric" value="${settings.trialDays}"></label>
        <label class="field"><span>${t('ad_currency')}</span><input class="input" name="currency" value="${esc(settings.currency)}" maxlength="6" dir="ltr"></label></div>
        <div class="field"><span>${t('ad_prices')}</span><div class="grid2">${PAID_PLANS.map((p) => `<label class="field"><span class="small">${t('plan_' + p)} · ${p === 'basic' ? t('ad_basic_hint') : t('ad_ent_hint')}</span><input class="input num" name="price_${p}" inputmode="decimal" value="${settings.prices?.[p] ?? ''}"></label>`).join('')}</div></div>
        <label class="field"><span>${t('ad_payinfo')}</span><textarea class="input" name="paymentInfo" maxlength="1000" dir="auto" rows="4">${esc(settings.paymentInfo)}</textarea></label>
        <label class="field"><span>${t('ad_wa')}</span><input class="input" name="supportWhatsapp" value="${esc(settings.supportWhatsapp)}" dir="ltr" placeholder="+963 9XX XXX XXX"></label>
        <div><button class="btn primary" type="submit">${t('save')}</button></div></form></div></section>`;
  }
  function settingsTab() {
    return `<div class="cols">
      <section class="panel c7"><div class="panel-h"><h2>${t('ad_settings')}</h2></div><div class="panel-b"><form class="form" id="ps">
        <label class="check"><input type="checkbox" name="signupsOpen" ${settings.signupsOpen ? 'checked' : ''}><span>${t('ad_signups')}</span></label>
        <label class="field"><span>${t('ad_announcement')}</span><textarea class="input" name="announcement" maxlength="300" dir="auto">${esc(settings.announcement || '')}</textarea></label>
        <div><button class="btn primary" type="submit">${t('save')}</button></div></form></div></section>
      <section class="panel c5"><div class="panel-h"><h2>${t('ad_health')}</h2></div><div class="panel-b"><ul class="list">
        <li><span class="grow small muted">${t('ad_mode')}</span><span class="chip ${S.mode === 'firebase' ? 'ok' : 'warn'}">${S.mode === 'firebase' ? 'Firebase' : 'Demo (localStorage)'}</span></li>
        <li><span class="grow small muted">${t('ad_customers')}</span><span class="num">${fmtNum(tot('statCustomers'))}</span></li>
        <li><span class="grow small muted">${t('ad_revenue_all')}</span><span class="num">${fmtMoney(tot('statRevenue'), 'SYP')}</span></li>
        <li><span class="grow small muted">${t('ad_redeemed')}</span><span class="num">${fmtNum(tot('statRedeemed'))}</span></li>
      </ul></div></section></div>`;
  }
  function faqTab() {
    return `<section class="panel"><div class="panel-h"><div><h2>${t('fq_title')} <span class="chip ${faq.custom ? 'brand' : ''}">${faq.custom ? t('fq_custom') : t('fq_default')}</span></h2><p class="small muted" style="margin:4px 0 0">${t('fq_hint')}</p></div>
      <div class="row wrap"><a class="btn ghost sm" href="index.html#faq" target="_blank" rel="noopener">${icon('globe')}nuqatii.com</a><button class="btn sm primary" id="fqAdd">${icon('plus')}${t('fq_add')}</button></div></div>
      <div class="panel-b"><ul class="list faq-ed">${faq.items.map((x, i) => `<li><span class="grow"><span class="t">${esc(faqText(x.q, lang))}</span><span class="s">${esc(faqText(x.a, lang).slice(0, 140))}${faqText(x.a, lang).length > 140 ? '…' : ''}</span></span>
        <span class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sm icon" data-fup="${i}" ${i ? '' : 'disabled'} aria-label="${t('fq_up')}">↑</button><button class="btn sm icon" data-fdn="${i}" ${i < faq.items.length - 1 ? '' : 'disabled'} aria-label="${t('fq_down')}">↓</button>
        <button class="btn sm icon" data-fed="${i}" aria-label="${t('fq_edit')}">${icon('edit')}</button><button class="btn sm icon" data-fdel="${i}" aria-label="${t('delete')}">${icon('trash')}</button></span></li>`).join('')}</ul>
      ${faq.custom ? `<div style="margin-top:12px"><button class="btn ghost sm" id="fqReset">${t('fq_reset')}</button></div>` : ''}</div></section>`;
  }

  // ── Wiring ──
  $('#lang').onclick = () => { setLang(lang === 'ar' ? 'en' : 'ar'); render(); };
  $('#out').onclick = async () => { await S.signOut(); location.replace('login.html'); };
  const openRows = (box) => {
    box.querySelectorAll('[data-stop]').forEach((x) => (x.onclick = (e) => e.stopPropagation()));
    box.querySelectorAll('tr[data-open]').forEach((tr) => { tr.style.cursor = 'pointer'; tr.onclick = () => (location.hash = 'biz/' + tr.dataset.open); tr.onkeydown = (e) => { if (e.key === 'Enter') tr.click(); }; });
  };

  if (biz && details) {
    const b = { ...details, acc: accessState(details, now) };
    $('#dPay').onclick = () => payDialog(b, settings);
    $('#dMore').onclick = () => moreDialog(b);
    $('#dPhone').onsubmit = async (e) => { e.preventDefault(); try { await S.adminSetOwnerPhone(b.id, e.target.phone.value); toast(t('saved')); reload(); } catch (err) { showError(err); } };
    $('#dNoteSave').onclick = async () => { try { await S.adminSaveNote(b.id, $('#dNote').value); toast(t('saved')); reload(); } catch (err) { showError(err); } };
    $('#dContacted').onclick = async () => { try { await S.adminMarkContacted(b.id); toast(t('saved')); reload(); } catch (err) { showError(err); } };
    return;
  }
  if (tab === 'businesses') {
    const drawTable = () => {
      const box = $('#adtbl'); box.innerHTML = tableHtml(); openRows(box);
      box.querySelectorAll('[data-pay]').forEach((x) => (x.onclick = () => payDialog(byId.get(x.dataset.pay), settings)));
      box.querySelectorAll('[data-more]').forEach((x) => (x.onclick = () => moreDialog(byId.get(x.dataset.more))));
    };
    drawTable();
    root.querySelectorAll('[data-f]').forEach((x) => (x.onclick = () => { filter = x.dataset.f; root.querySelectorAll('[data-f]').forEach((y) => y.setAttribute('aria-pressed', y === x)); drawTable(); }));
    $('#adq').oninput = (e) => { search = e.target.value; drawTable(); };
    $('#adsort').onchange = (e) => { sort = e.target.value; drawTable(); };
  }
  if (tab === 'followups') root.querySelectorAll('[data-contacted]').forEach((x) => (x.onclick = async () => {
    try { await S.adminMarkContacted(x.dataset.contacted); toast(t('saved')); reload(); } catch (err) { showError(err); }
  }));
  if (tab === 'payments') {
    const draw = () => { const box = $('#paytbl'); box.innerHTML = payTableHtml(); openRows(box); };
    draw(); $('#payq').oninput = (e) => { paySearch = e.target.value; draw(); };
  }
  if (tab === 'faq') {
    const items = faq.items.map((x) => ({ q: { ...x.q }, a: { ...x.a } }));
    const saveFaq = async (next) => { try { await S.adminSaveFaq(next); toast(t('saved')); reload(); } catch (err) { showError(err); } };
    const move = (i, d) => { const n = items.slice(); [n[i], n[i + d]] = [n[i + d], n[i]]; saveFaq(n); };
    root.querySelectorAll('[data-fup]').forEach((x) => (x.onclick = () => move(+x.dataset.fup, -1)));
    root.querySelectorAll('[data-fdn]').forEach((x) => (x.onclick = () => move(+x.dataset.fdn, 1)));
    root.querySelectorAll('[data-fed]').forEach((x) => (x.onclick = () => faqDialog(items, +x.dataset.fed, saveFaq)));
    root.querySelectorAll('[data-fdel]').forEach((x) => (x.onclick = async () => {
      const i = +x.dataset.fdel;
      if (await confirmBox(t('fq_del'), faqText(items[i].q, lang), t('delete'), 'danger')) saveFaq(items.filter((_, j) => j !== i));
    }));
    $('#fqAdd').onclick = () => faqDialog(items, -1, saveFaq);
    if ($('#fqReset')) $('#fqReset').onclick = async () => {
      if (!(await confirmBox(t('fq_reset'), t('fq_reset_q'), t('fq_reset'), 'danger'))) return;
      try { await S.adminResetFaq(); toast(t('saved')); reload(); } catch (err) { showError(err); }
    };
  }
  if (tab === 'settings') $('#ps').onsubmit = async (e) => {
    e.preventDefault();
    try { await S.adminSaveSettings({ ...settings, signupsOpen: e.target.signupsOpen.checked, announcement: e.target.announcement.value }); toast(t('saved')); delete C.settings; } catch (err) { showError(err); }
  };
  if (tab === 'billing') $('#bs').onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    const prices = Object.fromEntries(PAID_PLANS.map((p) => [p, f['price_' + p].value]));
    try { await S.adminSaveSettings({ ...settings, trialDays: f.trialDays.value, currency: f.currency.value.trim() || 'USD', prices, paymentInfo: f.paymentInfo.value, supportWhatsapp: f.supportWhatsapp.value.trim() }); toast(t('saved')); reload(); }
    catch (err) { showError(err); }
  };
}

// Add (i = -1) or edit one FAQ question, in Arabic and English.
function faqDialog(items, i, save) {
  const x = i >= 0 ? items[i] : { q: { ar: '', en: '' }, a: { ar: '', en: '' } };
  const body = `<form class="form" id="fq">
    <label class="field"><span>${t('fq_q_ar')}</span><input class="input" name="qar" maxlength="200" dir="rtl" value="${esc(x.q.ar)}"></label>
    <label class="field"><span>${t('fq_a_ar')}</span><textarea class="input" name="aar" maxlength="1500" dir="rtl" rows="5">${esc(x.a.ar)}</textarea></label>
    <label class="field"><span>${t('fq_q_en')}</span><input class="input" name="qen" maxlength="200" dir="ltr" value="${esc(x.q.en)}"></label>
    <label class="field"><span>${t('fq_a_en')}</span><textarea class="input" name="aen" maxlength="1500" dir="ltr" rows="5">${esc(x.a.en)}</textarea></label>
    <p class="small muted">${t('fq_days')}</p></form>`;
  modal({ title: i >= 0 ? t('fq_edit') : t('fq_add'), wide: true, body, actions: [{ label: t('cancel'), value: false }, { label: t('save'), kind: 'primary', onClick: async (m) => {
    const f = $('#fq', m);
    const it = { q: { ar: f.qar.value.trim(), en: f.qen.value.trim() }, a: { ar: f.aar.value.trim(), en: f.aen.value.trim() } };
    if (!((it.q.ar && it.a.ar) || (it.q.en && it.a.en))) { toast(t('fq_need')); return false; }
    const next = items.slice(); if (i >= 0) next[i] = it; else next.push(it);
    await save(next); return true;
  } }] });
}

const ymd = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Record a payment and add months of paid time.
function payDialog(b, settings) {
  const startPlan = PAID_PLANS.includes(planKey(b.plan)) ? planKey(b.plan) : 'basic';
  const body = `<form class="form" id="pf">
    <div class="grid2"><label class="field"><span>${t('ad_plan')}</span><select class="input" name="plan">${PAID_PLANS.map((p) => `<option value="${p}" ${p === startPlan ? 'selected' : ''}>${t('plan_' + p)}</option>`).join('')}</select></label>
    <div class="field"><span>${t('ad_months')}</span><div class="seg" role="group">${[1, 3, 6, 12].map((m) => `<button type="button" data-m="${m}" aria-pressed="${m === 1}">${m}</button>`).join('')}</div></div></div>
    <div class="grid2"><label class="field"><span>${t('ad_amount')} (${esc(settings.currency)})</span><input class="input num" name="amount" inputmode="decimal"></label>
    <label class="field"><span>${t('ad_method')}</span><input class="input" name="method" list="methods" placeholder="Sham Cash"><datalist id="methods"><option>Sham Cash</option><option>Syriatel Cash</option><option>MTN Cash</option><option>${lang === 'ar' ? 'نقداً' : 'Cash'}</option><option>${lang === 'ar' ? 'تحويل بنكي' : 'Bank transfer'}</option></datalist></label></div>
    <label class="field"><span>${t('ad_note')} <span class="muted">(${t('optional')})</span></span><input class="input" name="note" maxlength="200"></label>
    <p class="note" id="until"></p></form>`;
  let months = 1;
  modal({ title: `${t('ad_mark_paid')} · ${b.name}`, body,
    onMount: (m) => {
      const f = $('#pf', m);
      const upd = () => {
        $('#until', m).innerHTML = `${icon('clock')}<span>${t('ad_new_until', { d: fmtDate(extendPaid(b, months)) })}</span>`;
        if (!f.amount.dataset.touched) f.amount.value = (settings.prices?.[f.plan.value] || 0) * months || '';
      };
      m.querySelectorAll('[data-m]').forEach((x) => (x.onclick = () => { months = +x.dataset.m; m.querySelectorAll('[data-m]').forEach((y) => y.setAttribute('aria-pressed', y === x)); upd(); }));
      f.plan.onchange = upd; f.amount.oninput = () => (f.amount.dataset.touched = '1');
      upd();
    },
    actions: [{ label: t('cancel'), value: false }, { label: t('ad_mark_paid'), kind: 'primary', onClick: async (m) => {
      const f = $('#pf', m);
      const until = await S.adminMarkPaid(b.id, { months, plan: f.plan.value, amount: f.amount.value, currency: settings.currency, method: f.method.value, note: f.note.value });
      toast(t('ad_paid_ok', { d: fmtDate(until) })); return true;
    } }],
  }).then((ok) => ok && reload());
}

// Extend trial, change plan label, see payments, pause/reactivate.
async function moreDialog(b) {
  const payments = await S.listPayments(b.id).catch(() => []);
  const body = `<div class="stack">
    <form class="form" id="tf"><div class="field"><span>${t('ad_extend_trial')}</span><div class="row">
      <input class="input num" name="days" inputmode="numeric" value="14" style="max-width:110px" aria-label="${t('ad_days')}"><span class="small muted">${t('ad_days')}</span>
      <button class="btn" type="submit">${t('ad_extend_trial')}</button></div><small id="tnote"></small></div></form>
    <form class="form" id="te"><div class="field"><span>${t('ad_trial_end')}</span><div class="row">
      <input class="input" name="d" type="date" value="${ymd(b.trialEndsAt || (b.createdAt || Date.now()) + 30 * DAY)}" style="max-width:190px" aria-label="${t('ad_trial_end')}">
      <button class="btn" type="submit">${t('ad_trial_set')}</button></div><small class="muted">${t('ad_trial_end_hint')}</small></div></form>
    <label class="field"><span>${t('ad_plan')}</span><select class="input" id="plan">${PLANS.map((p) => `<option value="${p}" ${planKey(b.plan) === p ? 'selected' : ''}>${t('plan_' + p)}</option>`).join('')}</select></label>
    <div><h3 style="margin-bottom:6px">${t('ad_history')}</h3>${payments.length ? `<ul class="list">${payments.map((p) => `<li><span class="grow"><span class="t">${t('plan_' + planKey(p.plan))} · ${t('bl_months', { n: p.months })}</span><span class="s">${fmtDate(p.at)} · ${esc(p.method || '')} · ${esc(p.by || '')}${p.note ? ' · ' + esc(p.note) : ''}</span></span><span class="num small">${p.amount ? fmtMoney(p.amount, p.currency) : ''}</span></li>`).join('')}</ul>` : `<p class="small muted">${t('bl_none')}</p>`}</div>
    <div class="hr"></div>
    <button class="btn ${b.status === 'active' ? 'danger' : ''}" id="st">${b.status === 'active' ? t('ad_suspend') : t('ad_reactivate')}</button>
  </div>`;
  let changed = false;
  await modal({ title: b.name, wide: true, body, onMount: (m, close) => {
    const f = $('#tf', m);
    const note = () => { const d = Number(f.days.value); $('#tnote', m).textContent = d > 0 ? t('ad_new_until', { d: fmtDate(extendTrial(b, d)) }) : ''; };
    f.days.oninput = note; note();
    f.onsubmit = async (e) => { e.preventDefault(); try { const until = await S.adminExtendTrial(b.id, f.days.value); toast(t('ad_trial_ok', { d: fmtDate(until) })); changed = true; close(); } catch (err) { showError(err); } };
    $('#te', m).onsubmit = async (e) => {
      e.preventDefault(); const d = e.target.d.value; if (!d) return;
      const past = new Date(d + 'T23:59:59').getTime() < Date.now();
      if (past && !(await confirmBox(t('ad_trial_set'), t('ad_trial_past'), t('ad_trial_set'), 'danger'))) return;
      try { const until = await S.adminSetTrialEnd(b.id, d); toast(t('ad_trial_ok', { d: fmtDate(until) })); changed = true; close(); } catch (err) { showError(err); }
    };
    $('#plan', m).onchange = async (e) => { try { await S.adminSetPlan(b.id, e.target.value); toast(t('saved')); changed = true; } catch (err) { showError(err); } };
    $('#st', m).onclick = async () => {
      const to = b.status === 'active' ? 'suspended' : 'active';
      if (to === 'suspended' && !(await confirmBox(t('ad_suspend'), b.name, t('ad_suspend'), 'danger'))) return;
      try { await S.adminSetStatus(b.id, to); changed = true; close(); } catch (err) { showError(err); }
    };
  } });
  if (changed) reload();
}

render().catch(showError);
