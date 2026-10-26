// Business portal shell: auth gate, business picker, role-aware nav, hash router.
import { getService } from '../data/index.js';
import { t, setLang, lang, appName } from '../core/i18n.js';
import { can, DAY, accessState } from '../core/loyalty.js';
import { esc, icon, $, modal, showError, confirmBox, toast } from '../ui/ui.js';

const S = await getService();
const root = document.getElementById('root');

// "Install the app": nuqatii Business installs as its own app, separate from customers' "My cards".
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
let installPrompt = null;
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });
async function installApp() {
  if (installPrompt) { installPrompt.prompt(); installPrompt = null; return; }
  modal({ title: t('bi_install'), body: `<p>${isIOS ? t('bi_ios') : t('bi_other')}</p>`, actions: [{ label: t('close'), value: null }] });
}

const NAV = [
  { group: 'nav_group_daily', items: [
    { id: 'dashboard', icon: 'home' }, { id: 'checkout', icon: 'scan', cls: 'checkout-link' },
    { id: 'customers', icon: 'users' }, { id: 'transactions', icon: 'list' },
  ] },
  { group: 'nav_group_grow', items: [
    { id: 'rewards', icon: 'gift' }, { id: 'crm', icon: 'pie' }, { id: 'campaigns', icon: 'send' }, { id: 'analytics', icon: 'chart' }, { id: 'qr', icon: 'qr' },
  ] },
  { group: 'nav_group_setup', items: [
    { id: 'program', icon: 'sliders' }, { id: 'designer', icon: 'palette' }, { id: 'locations', icon: 'pin' }, { id: 'staff', icon: 'team' }, { id: 'settings', icon: 'gear' }, { id: 'billing', icon: 'card' },
  ] },
];
const PAGES = {
  dashboard: () => import('./biz-dashboard.js'), checkout: () => import('./biz-checkout.js'),
  customers: () => import('./biz-customers.js'), customer: () => import('./biz-customers.js'),
  transactions: () => import('./biz-activity.js'), rewards: () => import('./biz-rewards.js'),
  program: () => import('./biz-program.js'), designer: () => import('./biz-designer.js'),
  crm: () => import('./biz-crm.js'), campaigns: () => import('./biz-campaigns.js'),
  analytics: () => import('./biz-analytics.js'), locations: () => import('./biz-team.js'), staff: () => import('./biz-team.js'),
  settings: () => import('./biz-settings.js'), qr: () => import('./biz-settings.js'),
  billing: () => import('./biz-billing.js'),
};
const AREA = { customer: 'customers' };

// ── Context shared by every page ─────────────────────────
const ctx = {
  S, user: S.auth.current(), bid: null, role: null, biz: null, memberships: [], platform: null,
  access() { return accessState(this.biz); },
  _customers: null, _activity: null, _live: {}, _unsub: [],
  // Customers and recent activity stay live (Firestore listeners), so a member who joins by QR code
  // or a purchase by another cashier shows up on the dashboard without refreshing.
  async customers(force) {
    if (force) { this._customers = await S.listCustomers(this.bid); return this._customers; }
    if (!this._live.c) this._live.c = liveList('c', (on) => S.watchCustomers(this.bid, on), (rows, prev) => { this._customers = rows; announceJoins(rows, prev); });
    await this._live.c; return this._customers;
  },
  async activity(force) {
    if (!can(this.role, 'transactions')) return [];
    if (force) { this._activity = await S.listActivity(this.bid, { since: Date.now() - 120 * DAY }); return this._activity; }
    if (!this._live.a) this._live.a = liveList('a', (on) => S.watchActivity(this.bid, Date.now() - 120 * DAY, on), (rows) => { this._activity = rows; });
    await this._live.a; return this._activity;
  },
  invalidate() { this._unsub.forEach((u) => { try { u(); } catch {} }); this._unsub = []; this._live = {}; this._customers = null; this._activity = null; },
  // Patch a customer in the cache after checkout so the next lookup is instant.
  patchCustomer(c) { if (!this._customers) return; const i = this._customers.findIndex((x) => x.id === c.id); if (i >= 0) this._customers[i] = { ...this._customers[i], ...c }; else this._customers.unshift(c); if (!this._live.a) this._activity = null; },
  // Refresh the business doc (name/logo may show in the chrome) and re-render the current page.
  async reloadBiz() { this.biz = await S.getBusiness(this.bid); renderChrome(); await route(); return this.biz; },
  nav(path) { location.hash = '#/' + path; },
  can(area) { return can(this.role, area); },
};

// Starts a live query. Resolves after the first result; later results update the cache and refresh the page.
function liveList(key, start, apply) {
  return new Promise((resolve, reject) => {
    let first = true; let prev = null;
    const bid = ctx.bid;
    start((rows) => {
      if (bid !== ctx.bid) return;
      apply(rows, prev); prev = rows;
      if (first) { first = false; resolve(); } else liveRefresh();
    }).then((unsub) => { if (bid === ctx.bid) ctx._unsub.push(unsub); else unsub(); }).catch(reject);
  });
}
// "Maya just joined" for members who sign up by QR code while the app is open.
function announceJoins(rows, prev) {
  if (!prev) return;
  const known = new Set(prev.map((c) => c.id));
  const fresh = rows.filter((c) => !known.has(c.id) && c.source === 'qr');
  if (fresh.length === 1) toast(t('live_joined', { name: fresh[0].firstName }));
  else if (fresh.length > 1) toast(t('live_joined_n', { n: fresh.length }));
}
// Re-draw the current page quietly (no spinner) when live data changes, on pages that only show data.
const LIVE_PAGES = new Set(['dashboard', 'customers', 'customer', 'transactions', 'analytics', 'crm']);
let liveTimer = null; let livePending = false;
function liveRefresh() {
  clearTimeout(liveTimer);
  liveTimer = setTimeout(async () => {
    const id = currentId();
    if (!LIVE_PAGES.has(id) || !PAGES[id]) return;
    const el = $('#page');
    const busy = document.querySelector('.modal-back') || (el && el.contains(document.activeElement) && document.activeElement.matches('input, textarea, select'));
    if (busy) { livePending = true; return; }
    livePending = false;
    const y = scrollY; const seq = routeSeq;
    const [, ...params] = location.hash.replace(/^#\/?/, '').split('?')[0].split('/');
    try { const mod = await PAGES[id](); if (seq !== routeSeq) return; el.onclick = null; el.oninput = null; await mod.default(ctx, el, { page: id, params, live: true }); scrollTo(0, y); } catch (e) { console.warn('live refresh', e); }
  }, 700);
}
addEventListener('focusout', () => { if (livePending) setTimeout(() => { if (livePending) liveRefresh(); }, 300); });
document.addEventListener('click', () => { if (livePending && !document.querySelector('.modal-back')) liveRefresh(); }, true);

async function boot() {
  if (!ctx.user) return location.replace('login.html?next=app.html');
  if (await S.isPlatformAdmin()) return location.replace('admin.html');   // admin accounts don't run a business
  if (S.needsVerification()) return location.replace('login.html?next=app.html');   // confirm the email once
  ctx.platform = await S.platformSettings().catch(() => null);
  ctx.memberships = await S.myMemberships();
  if (!ctx.memberships.length) {
    const ob = await import('./biz-onboarding.js');
    return ob.default(ctx, root, async (bid) => { ctx.memberships = await S.myMemberships(); await selectBusiness(bid); });
  }
  const saved = localStorage.getItem('nuqta_bid');
  const pick = ctx.memberships.find((m) => m.businessId === saved) || ctx.memberships[0];
  await selectBusiness(pick.businessId);
}

async function selectBusiness(bid) {
  const m = ctx.memberships.find((x) => x.businessId === bid);
  ctx.bid = bid; ctx.role = m.role; ctx.invalidate();
  ctx.biz = await S.getBusiness(bid);
  localStorage.setItem('nuqta_bid', bid);
  renderChrome();
  route();
}

function navItems() {
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => ctx.can(i.id)) })).filter((g) => g.items.length);
}
function currentId() { const h = location.hash.replace(/^#\/?/, '').split('?')[0].split('/')[0]; return h || defaultPage(); }
const defaultPage = () => (ctx.can('dashboard') ? 'dashboard' : 'checkout');

function bizButton(cls = '') {
  const b = ctx.biz;
  return `<button class="biz-switch ${cls}" data-switch>
    ${b.logo ? `<img src="${esc(b.logo)}" alt="">` : `<span class="ph"></span>`}
    <span style="min-width:0;flex:1"><b>${esc(b.name)}</b><small>${t('role_' + ctx.role)}</small></span>
    ${ctx.memberships.length > 1 ? icon('chevron') : ''}
  </button>`;
}

// Trial / grace / renewal warning and the platform announcement, above every page.
function subBanner() {
  const a = ctx.access(); const owner = ctx.role === 'owner';
  const btn = (label) => (owner ? `<a class="btn sm" href="#/billing">${label}</a>` : '');
  let html = '';
  if (a.state === 'trial') html = `<div class="sub-bar ${a.daysLeft <= 7 ? 'warn' : ''}">${icon('clock')}<span>${t('sub_trial_banner', { n: a.daysLeft })}</span>${btn(t('sub_subscribe'))}</div>`;
  else if (a.state === 'active' && a.daysLeft <= 7) html = `<div class="sub-bar warn">${icon('clock')}<span>${t('sub_ending_banner', { n: a.daysLeft })}</span>${btn(t('sub_renew'))}</div>`;
  else if (a.state === 'grace') html = `<div class="sub-bar bad">${icon('info')}<span>${t(ctx.biz.paidUntil ? 'sub_grace_paid' : 'sub_grace_trial', { n: a.daysLeft })}</span>${btn(t(ctx.biz.paidUntil ? 'sub_renew' : 'sub_subscribe'))}</div>`;
  const ann = ctx.platform?.announcement;
  if (ann) html += `<div class="sub-bar info">${icon('info')}<span>${esc(ann)}</span></div>`;
  return html;
}
const locked = () => ['expired', 'suspended'].includes(ctx.access().state);

function renderChrome() {
  const cur = currentId();
  const curNav = cur === 'customer' ? 'customers' : cur;
  root.className = '';
  const groups = navItems();
  const bottom = ctx.role === 'staff'
    ? ['customers', 'checkout', 'transactions']
    : ctx.role === 'marketing' ? ['dashboard', 'customers', 'campaigns', 'crm'] : ['dashboard', 'customers', 'checkout', 'rewards'];
  const bottomHtml = bottom.filter((id) => ctx.can(id)).map((id) => {
    const it = NAV.flatMap((g) => g.items).find((x) => x.id === id);
    return id === 'checkout'
      ? `<a href="#/checkout" class="fab" ${curNav === id ? 'aria-current="page"' : ''}><span>${icon('scan')}</span><span>${t('nav_checkout')}</span></a>`
      : `<a href="#/${id}" ${curNav === id ? 'aria-current="page"' : ''}>${icon(it.icon)}<span>${t('nav_' + id)}</span></a>`;
  });
  root.innerHTML = `
  ${S.mode === 'demo' ? `<div class="demo-bar">${t('demo_banner')} <button data-reset>${t('demo_reset')}</button></div>` : ''}
  <div class="shell">
    <aside class="side" aria-label="Main">
      <div class="brandmark"><span class="dot"></span>${esc(appName())}</div>
      ${bizButton()}
      <nav class="nav">
        ${groups.map((g) => `<div class="nav-group">${t(g.group)}</div>${g.items.map((i) => `<a href="#/${i.id}" class="${i.cls || ''}" ${curNav === i.id ? 'aria-current="page"' : ''}>${icon(i.icon)}${t('nav_' + i.id)}</a>`).join('')}`).join('')}
      </nav>
      <div class="side-foot">
        ${standalone ? '' : `<button class="btn ghost sm" data-install style="justify-content:flex-start">${icon('dl')}${t('bi_install')}</button>`}
        <button class="btn ghost sm" data-lang style="justify-content:flex-start">${icon('globe')}${t('switch_lang')}</button>
        <div class="me"><span class="av">${esc((ctx.user.name || ctx.user.email)[0].toUpperCase())}</span><span class="grow small" style="min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(ctx.user.name || ctx.user.email)}</span>
          <button class="btn ghost sm icon" data-out title="${t('nav_signout')}" aria-label="${t('nav_signout')}">${icon('out')}</button></div>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">${bizButton()}<button class="btn ghost icon" data-lang aria-label="${t('switch_lang')}">${icon('globe')}</button></header>
      ${subBanner()}
      <main id="page" class="page" tabindex="-1"></main>
    </div>
  </div>
  <nav class="bottom-nav" style="grid-template-columns:repeat(${bottomHtml.length + 1},1fr)">${bottomHtml.join('')}
    <button data-more>${icon('more')}<span>${t('nav_more')}</span></button></nav>`;

  root.querySelectorAll('[data-lang]').forEach((b) => (b.onclick = () => { setLang(lang === 'ar' ? 'en' : 'ar'); renderChrome(); route(); }));
  root.querySelector('[data-out]').onclick = async () => { await S.signOut(); location.replace('login.html'); };
  root.querySelectorAll('[data-switch]').forEach((b) => (b.onclick = switchBusiness));
  root.querySelector('[data-more]').onclick = moreMenu;
  root.querySelector('[data-install]')?.addEventListener('click', installApp);
  root.querySelector('[data-reset]')?.addEventListener('click', async () => {
    if (await confirmBox(t('demo_reset'), lang === 'ar' ? 'ستعود بيانات Joe’s Pizza إلى حالتها الأصلية.' : "Joe's Pizza goes back to its original demo data.")) {
      await S.resetDemo(); localStorage.removeItem('nuqta_bid'); location.replace('login.html');
    }
  });
}

async function switchBusiness() {
  const body = `<div class="demo-list">${ctx.memberships.map((m) => `<button data-b="${m.businessId}">${m.logo ? `<img src="${esc(m.logo)}" style="width:34px;height:34px;border-radius:9px" alt="">` : icon('building')}<span class="grow"><b>${esc(m.name)}</b><small>${t('role_' + m.role)}</small></span>${m.businessId === ctx.bid ? icon('check') : ''}</button>`).join('')}
    <button data-new>${icon('plus')}<span class="grow"><b>${t('new_business')}</b></span></button></div>`;
  modal({ title: t('pick_business'), body, onMount: (el, close) => {
    el.querySelectorAll('[data-b]').forEach((b) => (b.onclick = () => { close(); location.hash = ''; selectBusiness(b.dataset.b); }));
    el.querySelector('[data-new]').onclick = async () => {
      close(); const ob = await import('./biz-onboarding.js');
      ob.default(ctx, root, async (bid) => { ctx.memberships = await S.myMemberships(); location.hash = ''; await selectBusiness(bid); });
    };
  } });
}

function moreMenu() {
  const body = `<nav class="nav">${navItems().map((g) => `<div class="nav-group">${t(g.group)}</div>${g.items.map((i) => `<a href="#/${i.id}" data-close>${icon(i.icon)}${t('nav_' + i.id)}</a>`).join('')}`).join('')}
    <div class="hr" style="margin:10px 0"></div>${standalone ? '' : `<a href="#" data-install2>${icon('dl')}${t('bi_install')}</a>`}<a href="#" data-out2>${icon('out')}${t('nav_signout')}</a></nav>`;
  modal({ title: t('nav_more'), body, onMount: (el, close) => {
    el.querySelectorAll('[data-close]').forEach((a) => a.addEventListener('click', () => close()));
    el.querySelector('[data-install2]')?.addEventListener('click', (e) => { e.preventDefault(); close(); installApp(); });
    el.querySelector('[data-out2]').onclick = async (e) => { e.preventDefault(); await S.signOut(); location.replace('login.html'); };
  } });
}

let routeSeq = 0;
async function route() {
  if (!ctx.biz) return;
  const [id, ...params] = location.hash.replace(/^#\/?/, '').split('?')[0].split('/');
  let page = id || defaultPage();
  // Soft lock: once the trial/subscription has ended (after grace), the owner only sees the
  // Subscription page and other roles see a notice. Data stays untouched.
  if (locked()) {
    if (ctx.role === 'owner') { if (page !== 'billing') return ctx.nav('billing'); }
    else {
      const el = $('#page');
      el.innerHTML = `<div class="empty" style="padding-top:64px">${icon('info')}<h2 style="color:var(--ink)">${t('sub_locked_t')}</h2><p>${ctx.access().state === 'suspended' ? t('err_business-suspended') : t('sub_locked_staff')}</p></div>`;
      return;
    }
  }
  const area = AREA[page] || page;
  if (!PAGES[page] || !ctx.can(area)) return ctx.nav(defaultPage());
  const seq = ++routeSeq;
  // update nav highlight without full re-render
  const navId = page === 'customer' ? 'customers' : page;
  root.querySelectorAll('.nav a, .bottom-nav a').forEach((a) => a.toggleAttribute('aria-current', a.getAttribute('href') === '#/' + navId));
  root.querySelectorAll('[aria-current]').forEach((a) => a.setAttribute('aria-current', 'page'));
  const el = $('#page');
  el.onclick = null; el.oninput = null;
  el.innerHTML = `<div class="center-load"><div class="spinner"></div></div>`;
  try {
    const mod = await PAGES[page]();
    if (seq !== routeSeq) return;
    document.title = `${t('nav_' + navId)} · ${ctx.biz.name}`;
    await mod.default(ctx, el, { page, params });
    if (seq === routeSeq) { window.scrollTo(0, 0); }
  } catch (e) {
    showError(e);
    el.innerHTML = `<div class="empty">${icon('info')}<p>${esc(e.message)}</p></div>`;
  }
}
addEventListener('hashchange', route);
boot().catch(showError);
