// Customer experience: join via QR (?b=slug) and the digital card app (?c=token). No login.
import { getService } from '../data/index.js';
import { t, setLang, lang, fmtNum, fmtDate, fmtTime, ago, unitWord, tierName, rewardName, programName, appName } from '../core/i18n.js';
import { tierFor, nextTier, CHANNELS, canOperate, stampGoal, stampState, readyCount, isStampy } from '../core/loyalty.js';
import { esc, icon, $, showError, toast, modal, qrSvg, errText } from '../ui/ui.js';
import { renderCard } from '../ui/card.js';
import { EV_ICON, eventTitle, signed, evName } from './biz-common.js';
import { wallet, snapshot } from '../core/wallet.js';

const S = await getService();
const root = document.getElementById('root');
const qs = new URLSearchParams(location.search);
const LANG_KEY = 'nuqta_cust_lang';
const applyLang = (bizLang) => setLang(localStorage.getItem(LANG_KEY) || bizLang || 'ar', { persist: false });
const toggleLang = () => { localStorage.setItem(LANG_KEY, lang === 'ar' ? 'en' : 'ar'); setLang(lang === 'ar' ? 'en' : 'ar', { persist: false }); };
const brand = (b) => { document.querySelector('meta[name=theme-color]').content = b.colors?.bg || '#0F6E5C'; document.title = programName(b); };

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
let installPrompt = null;
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; document.querySelector('[data-install]')?.removeAttribute('hidden'); });
// Back-to-wallet button used in the card and join headers.
const walletLink = () => `<a class="btn ghost sm icon" href="rewards.html" aria-label="${t('w_title')}" title="${t('w_title')}">${icon(lang === 'ar' ? 'chevron' : 'back')}</a>`;

// ── Join ───────────────────────────────────────────────
async function join(slug) {
  const b = await S.getBusinessBySlug(slug);
  if (!b) { root.className = 'center-load'; root.innerHTML = `<p class="muted">${t('err_not-found')}</p>`; return; }
  const saved = wallet.tokenFor(b.id);
  if (saved && !qs.has('new')) return location.replace(`rewards.html?c=${saved}`);
  applyLang(b.lang); brand(b);
  const unit = unitWord(b.program, b.currency);
  const paused = !canOperate(b);

  const draw = () => {
    root.className = 'cust'; root.style.setProperty('--cb', b.colors?.bg || '#0F6E5C'); root.style.paddingBottom = '24px';
    root.innerHTML = `
    <header class="join-hero" style="color:${esc(b.colors?.text || '#fff')}">
      ${wallet.all().length ? `<a class="btn ghost sm" href="rewards.html" style="position:absolute;top:12px;inset-inline-start:12px;color:inherit">${icon('card')}${t('w_title')}</a>` : ''}
      <button class="btn ghost sm" id="lang" style="position:absolute;top:12px;inset-inline-end:12px;color:inherit">${t('switch_lang')}</button>
      ${b.logo ? `<img src="${esc(b.logo)}" alt="">` : ''}
      <h1>${t('join_title', { biz: esc(b.name) })}</h1>
      <p>${t('join_sub', { unit: esc(unit) })}${b.program.welcomeBonus ? ' ' + t('join_bonus', { n: fmtNum(b.program.welcomeBonus), unit: esc(unit) }) : ''}</p>
    </header>
    <div class="cust-body">
      ${paused ? `<div class="note">${icon('info')}<span>${t('c_paused')}</span></div>` : `
      <form class="form" id="jf" novalidate>
        <label class="field"><span>${t('first_name')}</span><input class="input" name="firstName" autocomplete="given-name" required maxlength="40" style="min-height:52px"></label>
        <label class="field"><span>${t('phone')}</span><input class="input" name="phone" type="tel" inputmode="tel" autocomplete="tel" required dir="ltr" placeholder="09XX XXX XXX" style="min-height:52px"></label>
        <label class="field"><span>${t('email')} <span class="muted">(${t('optional')})</span></span><input class="input" name="email" type="email" autocomplete="email" dir="ltr" style="min-height:52px"></label>
        <label class="field"><span>${t('birthday')} <span class="muted">(${t('optional')})</span></span><input class="input" name="birthday" type="date" max="${new Date().toISOString().slice(0, 10)}" style="min-height:52px"><small>${t('join_bday_hint', { biz: esc(b.name) })}</small></label>
        <div id="err" role="alert"></div>
        <button class="btn primary xl" type="submit">${t('join_btn')}</button>
        <p class="small muted" style="text-align:center">${t('join_privacy', { biz: esc(b.name) })} ${t('join_offers_note', { biz: esc(b.name) })}</p>
      </form>`}
    </div>`;
    $('#lang').onclick = () => { toggleLang(); draw(); };
    const f = $('#jf'); if (!f) return;
    f.firstName.focus();
    f.onsubmit = async (e) => {
      e.preventDefault(); const btn = f.querySelector('[type=submit]'); btn.disabled = true; $('#err').innerHTML = '';
      try {
        const r = await S.joinProgram(slug, { firstName: f.firstName.value, phone: f.phone.value, email: f.email.value, birthday: f.birthday.value, marketingConsent: true });
        wallet.save(r.cardToken, b.id, null);
        location.replace(`rewards.html?c=${r.cardToken}&welcome=1`);
      } catch (err) {
        const field = { 'invalid-phone': 'phone', 'invalid-email': 'email', 'invalid-name': 'firstName' }[err.code];
        if (field) { f[field].setAttribute('aria-invalid', 'true'); f[field].focus(); }
        $('#err').innerHTML = `<div class="note" style="background:var(--danger-tint);color:var(--danger)">${icon('info')}<span>${esc(err.code === 'already-member' ? t('join_exists') : errText(err))}</span></div>`;
        btn.disabled = false;
      }
    };
  };
  draw();
}

// ── Card app ───────────────────────────────────────────
async function cardApp(token) {
  let data = await S.getCard(token);
  if (!data) {
    wallet.remove(token); applyLang(); root.className = 'center-load';
    root.innerHTML = `<div class="empty">${icon('card')}<p>${t('c_card_missing')}</p><a class="btn" href="rewards.html">${t('w_title')}</a></div>`; return;
  }
  const b = data.business;
  const remember = () => wallet.save(token, b.id, snapshot(data.business, data.card, readyCount(data.business.program, data.rewards, data.card.points), stampGoal(data.business.program, data.rewards)));
  remember();
  applyLang(b.lang); brand(b);
  let tab = location.hash.slice(1) || 'card';
  let acts = null, reds = null;
  const welcome = qs.get('welcome') === '1';
  if (welcome) history.replaceState(null, '', `rewards.html?c=${token}`);

  async function refresh() {
    const [d, r] = await Promise.all([S.getCard(token), S.listCardRedemptions(token)]);
    if (d) { data = d; remember(); } reds = r; acts = null;
  }
  reds = await S.listCardRedemptions(token);

  const unit = () => unitWord(b.program, b.currency);
  const live = () => data.rewards;
  const ready = () => live().filter((r) => data.card.points >= r.cost);
  const readyN = () => readyCount(b.program, live(), data.card.points);
  const ss = () => (isStampy(b.program) ? stampState(b.program, live(), data.card.points) : null);
  const openCodes = () => (reds || []).filter((r) => r.status === 'pending' && r.expiresAt > Date.now());

  function shell(inner) {
    root.className = 'cust'; root.style.setProperty('--cb', b.colors?.bg || '#0F6E5C');
    root.innerHTML = `<header class="cust-head">${walletLink()}${b.logo ? `<img src="${esc(b.logo)}" alt="">` : ''}<b>${esc(b.name)}</b><button class="btn ghost sm" id="lang">${t('switch_lang')}</button></header>
      <main class="cust-body" id="cb">${inner}</main>
      <nav class="cust-nav"><div>${[['card', 'card', t('c_card')], ['rewards', 'gift', t('c_rewards')], ['activity', 'clock', t('c_activity')], ['profile', 'user', t('c_profile')]].map(([id, ic, label]) =>
        `<button data-tab="${id}" ${tab === id ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span>${id === 'rewards' && readyN() ? `<span class="badge">${readyN()}</span>` : ''}</button>`).join('')}</div></nav>`;
    $('#lang').onclick = () => { toggleLang(); render(); };
    root.querySelectorAll('[data-tab]').forEach((x) => (x.onclick = () => { tab = x.dataset.tab; location.hash = tab; render(); }));
  }

  function cardTab() {
    const c = data.card; const tier = tierFor(b.tiers, c.lifetimePoints); const nx = nextTier(b.tiers, c.lifetimePoints);
    const stampy = b.program.type === 'stamps' || b.program.type === 'visits';
    const st = ss();
    return `${welcome ? `<div class="note" style="background:var(--ok-tint);color:var(--ok)">${icon('check')}<span><b>${t('join_welcome', { program: esc(programName(b)) })}</b><br><span class="small">${t('w_saved')}</span></span></div>` : ''}
      ${!canOperate(b) ? `<div class="note">${icon('info')}<span>${t('c_paused')}</span></div>` : ''}
      ${renderCard({ business: b, card: c, rewardsReady: readyN(), goal: stampGoal(b.program, live()) })}
      ${st && st.ready ? `<button class="btn primary lg block" data-tab="rewards">${icon('gift')}${st.ready === 1 ? t('c_rewards_count_one') : t('c_rewards_count', { n: fmtNum(st.ready) })}</button>` : ''}
      <p class="small muted" style="text-align:center">${t('c_show_staff')}</p>
      ${openCodes().length ? `<section class="panel"><div class="panel-h"><h3>${t('c_open_codes')}</h3></div><div class="panel-b"><ul class="list">${openCodes().map((r) => `<li><span class="grow"><span class="t">${esc(evName(r))}</span><span class="s">${t('c_code_exp', { t: fmtTime(r.expiresAt) })}</span></span><button class="btn sm" data-show="${esc(r.id)}">${esc(r.id)}</button></li>`).join('')}</ul></div></section>` : ''}
      ${st && live().length ? `<section class="panel"><div class="panel-b stack" style="gap:8px"><b>${t('c_next_reward')}</b><div class="progress-line"><i style="width:${(st.progress / st.goal) * 100}%"></i></div><span class="small muted">${fmtNum(st.progress)}/${fmtNum(st.goal)} · ${t('c_stamps_left', { n: fmtNum(st.left) })}</span></div></section>` : ''}
      ${(b.tiers || []).length > 1 ? `<section class="panel"><div class="panel-b stack" style="gap:8px">
        <div class="spread"><b>${esc(tierName(tier))}</b>${nx ? `<span class="small muted">${esc(tierName(nx))}</span>` : ''}</div>
        ${nx ? `<div class="progress-line"><i style="width:${Math.min(100, ((c.lifetimePoints - (tier?.min || 0)) / (nx.min - (tier?.min || 0))) * 100)}%"></i></div><span class="small muted">${t('c_to_next', { n: fmtNum(nx.min - c.lifetimePoints), unit: esc(unit()), tier: esc(tierName(nx)) })}</span>` : `<span class="small muted">${t('c_top_tier')}</span>`}
        ${tier?.benefits ? `<div class="note">${icon('star')}<span>${esc(tier.benefits)}</span></div>` : ''}
      </div></section>` : ''}
      <section class="panel"><div class="panel-b stack" style="gap:10px">
        <div class="row" style="gap:8px"><button class="btn block" disabled>${icon('card')}Apple Wallet</button><button class="btn block" disabled>${icon('card')}Google Wallet</button></div>
        <p class="tiny muted" style="text-align:center">${t('c_wallet_soon')} · ${t('c_save_card')}</p>
      </div></section>`;
  }
  function rewardsTab() {
    const c = data.card; const avail = ready(); const locked = live().filter((r) => c.points < r.cost); const st = ss();
    const times = (r) => (st ? Math.floor(c.points / r.cost) : 1);
    const row = (r, ok) => `<div class="reward-row ${ok ? '' : 'locked'}"><span class="ri" ${r.image ? `style="background:url('${esc(r.image)}') center/cover"` : ''}>${r.image ? '' : icon('gift')}</span>
      <div class="grow" style="flex:1;min-width:0"><b>${esc(rewardName(r))}${ok && times(r) > 1 ? ` <span class="chip brand" style="padding:0 8px">×${fmtNum(times(r))}</span>` : ''}</b><div class="small muted">${fmtNum(r.cost)} ${esc(unit())}${!ok ? ' · ' + t('c_need_more', { n: fmtNum(r.cost - c.points), unit: esc(unit()) }) : ''}</div>${r.description ? `<div class="small muted">${esc(r.description)}</div>` : ''}</div>
      ${ok && canOperate(b) ? `<button class="btn primary sm" data-redeem="${r.id}">${t('c_redeem')}</button>` : ''}</div>`;
    return `<h2>${t('c_rewards')}</h2>
      ${st ? `<div class="spread"><span class="muted">${t('c_next_reward')}</span><b class="num" style="font-size:1.3rem">${fmtNum(st.progress)}/${fmtNum(st.goal)} <span class="small muted" style="font-weight:400">${esc(unit())}</span></b></div>`
        : `<div class="spread"><span class="muted">${t('c_points')}</span><b class="num" style="font-size:1.3rem">${fmtNum(c.points)} <span class="small muted" style="font-weight:400">${esc(unit())}</span></b></div>`}
      ${avail.length ? `<h3>${t('c_available')}</h3>${avail.map((r) => row(r, true)).join('')}` : ''}
      ${locked.length ? `<h3 style="margin-top:6px">${t('c_locked')}</h3>${locked.map((r) => row(r, false)).join('')}` : ''}
      ${!live().length ? `<p class="muted">${t('rw_empty')}</p>` : ''}`;
  }
  async function activityTab() {
    if (!acts) acts = await S.listCardActivity(token);
    return `<h2>${t('c_activity')}</h2>${acts.length ? `<section class="panel"><div class="panel-b"><ul class="list">${acts.map((a) => `<li><span class="av sq" style="background:color-mix(in srgb,var(--cb) 12%,transparent);color:var(--cb)">${icon(EV_ICON[a.type] || 'star')}</span>
      <span class="grow"><span class="t">${esc(eventTitle(a))}</span><span class="s">${fmtDate(a.at, { day: 'numeric', month: 'short', year: 'numeric' })}</span></span>${a.points ? `<span class="pts ${a.points > 0 ? 'pos' : 'neg'}">${signed(a.points)}</span>` : ''}</li>`).join('')}</ul></div></section>` : `<p class="muted">${t('c_no_activity')}</p>`}`;
  }
  function profileTab() {
    const c = data.card;
    return `<h2>${t('c_profile')}</h2>
      <section class="panel"><div class="panel-b"><ul class="list">
        <li><span class="grow small muted">${t('c_member')}</span><b>${esc(c.firstName)}</b></li>
        <li><span class="grow small muted">${t('member_no')}</span><b class="ltr">${esc(c.memberNumber)}</b></li>
        <li><span class="grow small muted">${t('joined')}</span><span>${fmtDate(c.joinedAt)}</span></li>
        <li><span class="grow small muted">${t('visits')}</span><span class="num">${fmtNum(c.visits)}</span></li>
      </ul></div></section>
      <form class="form panel" id="pf" style="padding:16px">
        <label class="field"><span>${t('last_name')}</span><input class="input" name="lastName" maxlength="40"></label>
        <label class="field"><span>${t('email')}</span><input class="input" name="email" type="email" dir="ltr"></label>
        <label class="field"><span>${t('birthday')}</span><input class="input" name="birthday" type="date"></label>
        <label class="field"><span>${t('preferred_channel')}</span><select class="input" name="preferredChannel">${CHANNELS.filter((ch) => ch !== 'push').map((ch) => `<option value="${ch}">${t('ch_' + ch)}</option>`).join('')}</select></label>
        <label class="check"><input type="checkbox" name="marketingConsent"><span>${t('join_consent')}</span></label>
        <button class="btn primary" type="submit">${t('save')}</button>
        <p class="tiny muted">${t('join_privacy', { biz: esc(b.name) })}</p>
      </form>`;
  }

  async function render() {
    const inner = tab === 'rewards' ? rewardsTab() : tab === 'activity' ? await activityTab() : tab === 'profile' ? profileTab() : cardTab();
    shell(inner);
    root.querySelectorAll('[data-redeem]').forEach((x) => (x.onclick = () => redeem(x.dataset.redeem)));
    root.querySelectorAll('[data-show]').forEach((x) => (x.onclick = () => { const r = reds.find((y) => y.id === x.dataset.show); showCode({ code: r.id, rewardName: r.rewardName, expiresAt: r.expiresAt }); }));
    const pf = $('#pf');
    if (pf) {
      const pr = data.card.profile || {};
      pf.lastName.value = pr.lastName || ''; pf.email.value = pr.email || ''; pf.birthday.value = pr.birthday || '';
      pf.preferredChannel.value = pr.preferredChannel || 'whatsapp'; pf.marketingConsent.checked = !!pr.marketingConsent;
    }
    if (pf) pf.onsubmit = async (e) => {
      e.preventDefault();
      try { await S.updateMyProfile(token, { lastName: pf.lastName.value, email: pf.email.value, birthday: pf.birthday.value, preferredChannel: pf.preferredChannel.value, marketingConsent: pf.marketingConsent.checked }); await refresh(); toast(t('c_profile_saved')); }
      catch (err) { showError(err); }
    };
  }
  async function redeem(rewardId) {
    try { const r = await S.requestRedemption(token, rewardId); reds = await S.listCardRedemptions(token); showCode(r); }
    catch (e) { showError(e); }
  }
  function showCode(r) {
    modal({ title: evName(r), body: `<div class="stack" style="justify-items:center;text-align:center;gap:14px">
      <p class="muted">${t('c_code_title')}</p>
      <div style="width:200px;background:#fff;padding:10px;border-radius:14px;border:1px solid var(--line)">${qrSvg(r.code)}</div>
      <div class="code-big">${esc(r.code)}</div>
      <p class="small muted">${t('c_code_exp', { t: fmtTime(r.expiresAt) })}</p></div>`,
    actions: [{ label: t('done'), kind: 'primary', value: true }] }).then(() => render());
  }

  await render();
  // Pick up points the cashier just added (works for both backends; Firestore could use onSnapshot).
  const poll = async () => {
    if (document.hidden) return;
    const before = `${data.card.points}|${(reds || []).map((r) => r.status).join()}`;
    await refresh();
    if (`${data.card.points}|${(reds || []).map((r) => r.status).join()}` !== before && !document.querySelector('.modal-back')) render();
  };
  setInterval(poll, 8000);
  document.addEventListener('visibilitychange', poll);
}

// ── My cards ───────────────────────────────────────────
async function walletPage() {
  applyLang();
  document.title = t('w_title');
  let editing = false, offline = false;
  let list = wallet.all();

  const tile = (e) => {
    const sn = e.snap; if (!sn) return `<div class="wtile skel" aria-hidden="true"></div>`;
    const b = sn.biz; const c = sn.card; const stampy = b.program?.type === 'stamps' || b.program?.type === 'visits';
    const style = b.design?.style === 'minimal' ? 'solid' : b.design?.style || 'gradient';
    const g = sn.goal || b.program?.goal;
    const bal = stampy && g ? `${fmtNum(c.points % g)}<span class="of">/${fmtNum(g)}</span>` : fmtNum(c.points);
    const tier = (b.tiers || []).length > 1 ? tierFor(b.tiers, c.lifetimePoints) : null;
    return `<${editing ? 'div' : 'a'} class="wtile st-${esc(style)}" ${editing ? '' : `href="rewards.html?c=${esc(e.token)}"`} data-token="${esc(e.token)}"
      style="--cb:${esc(b.colors?.bg || '#0F6E5C')};--cs:${esc(b.colors?.secondary || '#E8A33D')};--ct:${esc(b.colors?.text || '#fff')}">
      <span class="wlogo">${b.logo ? `<img src="${esc(b.logo)}" alt="">` : icon(b.design?.icon || 'star')}</span>
      <span class="wnames"><b>${esc(programName(b))}</b><small>${esc(b.name)}${tier ? ` · ${esc(tierName(tier))}` : ''}</small></span>
      <span class="wbal"><b class="num">${bal}</b><small>${esc(unitWord(b.program, b.currency))}</small></span>
      ${sn.ready ? `<span class="wready">${icon('gift')}${t('w_rewards_ready', { n: fmtNum(sn.ready) })}</span>` : ''}
      ${editing ? `<button class="wremove" data-remove="${esc(e.token)}" aria-label="${t('w_remove')}">${icon('x')}</button>` : ''}
    </${editing ? 'div' : 'a'}>`;
  };

  function draw() {
    const ready = list.reduce((n, e) => n + (e.snap?.ready || 0), 0);
    root.className = 'cust'; root.style.removeProperty('--cb'); root.style.paddingBottom = '24px';
    root.innerHTML = `<header class="cust-head"><span class="wdot" aria-hidden="true"></span><b>${t('w_title')}</b>
        ${list.length ? `<button class="btn ghost sm" id="edit">${editing ? t('done') : t('edit')}</button>` : ''}
        <button class="btn ghost sm" id="lang">${t('switch_lang')}</button></header>
      <main class="cust-body">
        ${list.length ? `<p class="small muted">${list.length === 1 ? t('w_count_one') : t('w_count', { n: fmtNum(list.length) })}${ready ? ` · ${ready === 1 ? t('c_rewards_count_one') : t('c_rewards_count', { n: fmtNum(ready) })}` : ''}</p>
          <div class="wallet">${list.map(tile).join('')}</div>
          ${offline ? `<p class="tiny muted">${t('w_offline')}</p>` : ''}`
        : `<div class="empty" style="padding-top:48px">${icon('card')}<b style="color:var(--ink)">${t('w_empty_t')}</b><p>${t('w_empty_d')}</p></div>`}
        ${standalone ? '' : `<div class="note">${icon('info')}<span>${isIOS ? t('w_install_ios') : t('w_install')}</span></div>
        <button class="btn block" data-install ${installPrompt ? '' : 'hidden'}>${icon('dl')}${t('w_install_btn')}</button>`}
        ${list.length ? `<p class="small muted">${t('w_lost')}</p>` : ''}
        <p class="tiny muted" style="text-align:center;margin-top:8px">${esc(appName())}</p>
      </main>`;
    $('#lang').onclick = () => { toggleLang(); draw(); };
    $('#edit')?.addEventListener('click', () => { editing = !editing; draw(); });
    const ib = root.querySelector('[data-install]'); if (ib) ib.onclick = async () => { if (installPrompt) { installPrompt.prompt(); installPrompt = null; draw(); } };
    root.querySelectorAll('[data-remove]').forEach((x) => (x.onclick = async (ev) => {
      ev.preventDefault();
      const e = list.find((y) => y.token === x.dataset.remove);
      const ok = await modal({ title: t('w_remove'), body: `<p>${esc(t('w_remove_d', { biz: e.snap?.biz?.name || '' }))}</p>`,
        actions: [{ label: t('cancel'), value: false }, { label: t('w_remove'), kind: 'danger', value: true }] });
      if (ok) { wallet.remove(e.token); list = wallet.all(); if (!list.length) editing = false; draw(); }
    }));
  }
  draw();

  // Refresh balances from the server; keep the saved snapshot if a request fails (offline).
  async function refresh() {
    const results = await Promise.allSettled(list.map((e) => S.getCard(e.token)));
    results.forEach((r, i) => {
      const e = list[i];
      if (r.status === 'rejected') { offline = true; return; }
      if (!r.value) { wallet.remove(e.token); return; }      // card no longer exists
      const d = r.value;
      wallet.save(e.token, d.business.id, snapshot(d.business, d.card, readyCount(d.business.program, d.rewards, d.card.points), stampGoal(d.business.program, d.rewards)), { opened: false });
    });
    list = wallet.all();
    if (!editing) draw();
  }
  await refresh();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
}

try {
  if (qs.get('c')) await cardApp(qs.get('c'));
  else if (qs.get('b')) await join(qs.get('b').toLowerCase());
  else if (qs.get('add')) {   // e.g. a shared link with several cards; also used by the demo
    for (const tok of qs.get('add').split(',').filter((x) => /^[A-Za-z0-9]{20,}$/.test(x))) wallet.save(tok, 'pending:' + tok, null, { opened: false });
    history.replaceState(null, '', 'rewards.html'); await walletPage();
  }
  else await walletPage();
} catch (e) { showError(e); }
