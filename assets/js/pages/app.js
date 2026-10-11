// Business portal shell: auth gate, business picker, role-aware nav, hash router.
import { getService } from '../data/index.js';
import { t, setLang, lang, appName } from '../core/i18n.js';
import { can, DAY, accessState } from '../core/loyalty.js';
import { esc, icon, $, modal, showError, confirmBox } from '../ui/ui.js';

const S = await getService();
const root = document.getElementById('root');

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
  _customers: null, _activity: null,
  async customers(force) { if (force || !this._customers) this._customers = await S.listCustomers(this.bid); return this._customers; },
  async activity(force) {
    if (!can(this.role, 'transactions')) return [];
    if (force || !this._activity) this._activity = await S.listActivity(this.bid, { since: Date.now() - 120 * DAY });
    return this._activity;
  },
  invalidate() { this._customers = null; this._activity = null; },
  // Patch a customer in the cache after checkout so the next lookup is instant.
  patchCustomer(c) { if (!this._customers) return; const i = this._customers.findIndex((x) => x.id === c.id); if (i >= 0) this._customers[i] = { ...this._customers[i], ...c }; else this._customers.unshift(c); this._activity = null; },
  // Refresh the business doc (name/logo may show in the chrome) and re-render the current page.
  async reloadBiz() { this.biz = await S.getBusiness(this.bid); renderChrome(); await route(); return this.biz; },
  nav(path) { location.hash = '#/' + path; },
  can(area) { return can(this.role, area); },
};

async function boot() {
  if (!ctx.user) return location.replace('index.html?next=app.html');
  if (await S.isPlatformAdmin()) return location.replace('admin.html');   // admin accounts don't run a business
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
  root.querySelector('[data-out]').onclick = async () => { await S.signOut(); location.replace('index.html'); };
  root.querySelectorAll('[data-switch]').forEach((b) => (b.onclick = switchBusiness));
  root.querySelector('[data-more]').onclick = moreMenu;
  root.querySelector('[data-reset]')?.addEventListener('click', async () => {
    if (await confirmBox(t('demo_reset'), lang === 'ar' ? 'ستعود بيانات Joe’s Pizza إلى حالتها الأصلية.' : "Joe's Pizza goes back to its original demo data.")) {
      await S.resetDemo(); localStorage.removeItem('nuqta_bid'); location.replace('index.html');
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
    <div class="hr" style="margin:10px 0"></div><a href="#" data-out2>${icon('out')}${t('nav_signout')}</a></nav>`;
  modal({ title: t('nav_more'), body, onMount: (el, close) => {
    el.querySelectorAll('[data-close]').forEach((a) => a.addEventListener('click', () => close()));
    el.querySelector('[data-out2]').onclick = async (e) => { e.preventDefault(); await S.signOut(); location.replace('index.html'); };
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
