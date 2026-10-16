// Landing / sign-in / sign-up.
import { getService } from '../data/index.js';
import { t, setLang, lang, appName } from '../core/i18n.js';
import { esc, icon, showError, toast, $, legalLink, legalLinks } from '../ui/ui.js';
import { renderCard } from '../ui/card.js';
import { DEMO_ACCOUNTS, DEMO_CARD, DEMO_CARD_UC } from '../data/demo-seed.js';

const S = await getService();
const root = document.getElementById('root');
let view = new URLSearchParams(location.search).get('view') === 'signup' ? 'signup' : 'signin';

async function routeAfterLogin() {
  // The platform admin account only ever uses the admin console. To run your own shop,
  // sign up with a separate email like any other business.
  if (await S.isPlatformAdmin()) return location.replace('admin.html');
  const next = new URLSearchParams(location.search).get('next');
  if (next && /^(app|rewards)\.html/.test(next)) return location.replace(next);
  location.replace('app.html');
}

const demoBiz = {
  a: { name: "Joe's Pizza", logo: null, colors: { bg: '#B3261E', secondary: '#F2B544', text: '#fff' }, program: { type: 'points' }, currency: 'SYP',
    design: { style: 'gradient', programName: "Joe's Rewards", programNameAr: 'مكافآت جوز', icon: 'pizza' }, tiers: [{ id: 'b', min: 0, name: 'Bronze', nameAr: 'برونزي', color: '#A86B3C' }, { id: 'g', min: 1000, name: 'Gold', nameAr: 'ذهبي', color: '#C9A227' }] },
  b: { name: 'Urban Coffee', colors: { bg: '#1F3A33', secondary: '#E9DCC4', text: '#F5EFE3' }, program: { type: 'stamps', goal: 9 }, currency: 'SYP',
    design: { style: 'solid', layout: 'stamps', programName: 'Coffee Club', programNameAr: 'نادي القهوة', icon: 'coffee' }, tiers: [] },
};

function render() {
  document.title = `${appName()} — ${t('app_tagline')}`;
  const isUp = view === 'signup';
  root.className = 'auth';
  root.innerHTML = `
  <section class="auth-pitch">
    <div class="brandmark"><span class="dot"></span>${esc(appName())}</div>
    <h1>${lang === 'ar' ? 'بطاقة ولاء باسم محلّك، جاهزة خلال عشر دقائق.' : 'A loyalty card with your name on it, ready in ten minutes.'}</h1>
    <p>${lang === 'ar' ? 'الزبون يمسح الرمز وينضم من موبايله بلا تطبيق. الكاشير يضيف النقاط بثوانٍ. وأنت تعرف من يعود ومن انقطع.' : 'Customers scan and join from their phone — no app. Cashiers add points in seconds. You see who keeps coming back, and who stopped.'}</p>
    <div class="cards" aria-hidden="true">
      ${renderCard({ business: demoBiz.a, card: { firstName: lang === 'ar' ? 'مايا' : 'Maya', points: 1250, lifetimePoints: 1250, memberNumber: '100042', qrValue: 'x' }, mini: true, showCode: false })}
      ${renderCard({ business: demoBiz.b, card: { firstName: lang === 'ar' ? 'يزن' : 'Yazan', points: 6, lifetimePoints: 6, memberNumber: '100007', qrValue: 'x' }, mini: true, showCode: false })}
    </div>
  </section>
  <section class="auth-form" style="position:relative">
    <button class="btn ghost sm lang-btn" id="lang">${icon('globe')}${t('switch_lang')}</button>
    <div><h1>${t(isUp ? 'signup_title' : 'signin_title')}</h1></div>
    <form class="form" id="f" novalidate>
      ${isUp ? `<label class="field"><span>${t('your_name')}</span><input class="input" name="name" autocomplete="name" required></label>` : ''}
      <label class="field"><span>${t('email')}</span><input class="input" name="email" type="email" autocomplete="email" required dir="ltr"></label>
      <label class="field"><span>${t('password')}</span><input class="input" name="password" type="password" autocomplete="${isUp ? 'new-password' : 'current-password'}" required minlength="6" dir="ltr"></label>
      <button class="btn primary lg block" type="submit">${t(isUp ? 'signup' : 'signin')}</button>
      ${isUp ? `<p class="small muted">${t('auth_legal', { terms: legalLink('terms'), privacy: legalLink('privacy') })}</p>` : ''}
      <div class="spread small">
        <span class="muted">${t(isUp ? 'have_account' : 'no_account')} <a href="#" id="toggle">${t(isUp ? 'signin' : 'signup')}</a></span>
        ${!isUp ? `<a href="#" id="forgot">${t('forgot')}</a>` : ''}
      </div>
    </form>
    ${S.mode === 'demo' ? `
    <div class="stack" style="gap:10px">
      <div class="note">${icon('info')}<span>${t('demo_login_note')} <a href="login.html?mode=firebase">${t('demo_login_exit')}</a></span></div>
      <div class="spread"><h3>${t('demo_accounts')}</h3><span class="tiny muted ltr">${t('demo_pw')}</span></div>
      <div class="demo-list">
        ${['owner', 'staff', 'marketing', 'admin'].map((k) => `<button data-demo="${k}">${icon(k === 'admin' ? 'shield' : k === 'staff' ? 'scan' : k === 'marketing' ? 'send' : 'building')}<span class="grow"><b>${k === 'admin' ? t('admin_console') : t('role_' + k) + " · Joe's Pizza"}</b><small class="ltr">${DEMO_ACCOUNTS[k].email}</small></span></button>`).join('')}
        <a class="btn ghost block" href="rewards.html?add=${DEMO_CARD},${DEMO_CARD_UC}">${icon('card')}${lang === 'ar' ? 'شاهد بطاقات زبونة' : 'See a customer’s cards'}</a>
        <a class="btn ghost block" href="rewards.html?b=joespizza">${icon('qr')}${lang === 'ar' ? 'جرّب صفحة الانضمام' : 'Try the join page'}</a>
      </div>
    </div>` : ''}
    ${legalLinks()}
  </section>`;

  $('#lang').onclick = () => { setLang(lang === 'ar' ? 'en' : 'ar'); render(); };
  $('#toggle').onclick = (e) => { e.preventDefault(); view = isUp ? 'signin' : 'signup'; render(); };
  $('#forgot')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = $('#f').email.value.trim();
    if (!email) return $('#f').email.focus();
    try { await S.auth.resetPassword(email); toast(t('reset_sent')); } catch (err) { showError(err); }
  });
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target; const btn = f.querySelector('[type=submit]'); btn.disabled = true;
    try {
      if (isUp) await S.signUp(f.email.value, f.password.value, f.name.value.trim());
      else await S.signIn(f.email.value, f.password.value);
      await routeAfterLogin();
    } catch (err) { showError(err); btn.disabled = false; }
  };
  root.querySelectorAll('[data-demo]').forEach((b) => (b.onclick = async () => {
    const a = DEMO_ACCOUNTS[b.dataset.demo];
    try { await S.signIn(a.email, a.password); await routeAfterLogin(); } catch (err) { showError(err); }
  }));
  if (S.mode !== 'demo') $('#f').email.focus();
}

if (S.auth.current() && !new URLSearchParams(location.search).has('view')) await routeAfterLogin();
else render();
