// Renders privacy.html / terms.html in Arabic or English.
import { CONFIG } from '../config.js';
import { PRIVACY, TERMS } from '../core/legal-text.js';

const root = document.getElementById('root');
const which = document.body.dataset.doc === 'terms' ? 'terms' : 'privacy';
const DOCS = { privacy: PRIVACY, terms: TERMS };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const qs = new URLSearchParams(location.search);
let lang = qs.get('lang') || localStorage.getItem('nuqta_cust_lang') || localStorage.getItem('nuqta_lang') || CONFIG.DEFAULT_LANG || 'ar';

function fill(s) {
  const L = CONFIG.LEGAL;
  return esc(s).replace(/\{name\}/g, esc(L.name[lang] || L.name.en)).replace(/\{country\}/g, esc(L.country[lang] || L.country.en))
    .replace(/\{whatsapp\}/g, esc(L.whatsapp)).replace(/\{days\}/g, String(L.retentionDays));
}
function render() {
  const d = DOCS[which][lang]; const L = CONFIG.LEGAL; const ar = lang === 'ar';
  document.documentElement.lang = lang; document.documentElement.dir = ar ? 'rtl' : 'ltr';
  document.title = d.title;
  const other = which === 'privacy' ? 'terms' : 'privacy';
  const date = new Intl.DateTimeFormat(ar ? 'ar-SY-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(L.updated));
  const wa = L.whatsapp.replace(/[^\d]/g, '');
  root.className = 'legal';
  root.innerHTML = `
    <header class="legal-head">
      <a class="brandmark" href="index.html" style="padding:0"><span class="dot"></span>${esc(CONFIG.APP_NAME[lang] || CONFIG.APP_NAME.en)}</a>
      <button class="btn ghost sm" id="lang">${ar ? 'English' : 'العربية'}</button>
    </header>
    <article>
      <h1>${esc(d.title)}</h1>
      <p class="muted small">${ar ? 'آخر تحديث' : 'Last updated'}: ${esc(date)}</p>
      <p class="lead">${fill(d.intro)}</p>
      <nav class="toc" aria-label="${ar ? 'المحتويات' : 'Contents'}"><ol>${d.sections.map(([h], i) => `<li><a href="#s${i + 1}">${fill(h)}</a></li>`).join('')}</ol></nav>
      ${d.sections.map(([h, ...blocks], i) => `<section id="s${i + 1}"><h2>${i + 1}. ${fill(h)}</h2>${blocks.map((b) => (Array.isArray(b) ? `<ul>${b.map((x) => `<li>${fill(x)}</li>`).join('')}</ul>` : `<p>${fill(b)}</p>`)).join('')}</section>`).join('')}
      <section id="contact"><h2>${ar ? 'تواصل معنا' : 'Contact us'}</h2>
        <p>${ar ? 'لأي سؤال أو طلب يتعلق بهذه الوثيقة أو ببياناتك:' : 'For any question or request about this document or your data:'}</p>
        <p><a class="btn" href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp <span class="ltr">${esc(L.whatsapp)}</span></a>
        ${L.email ? ` <a class="btn ghost" href="mailto:${esc(L.email)}">${esc(L.email)}</a>` : ''}</p>
      </section>
      <p class="small"><a href="${other}.html?lang=${lang}">${other === 'terms' ? (ar ? 'شروط الخدمة' : 'Terms of Service') : (ar ? 'سياسة الخصوصية' : 'Privacy Policy')}</a></p>
      ${ar ? '' : '<p class="tiny muted">The Arabic version of this document is the reference version.</p>'}
    </article>`;
  document.getElementById('lang').onclick = () => { lang = ar ? 'en' : 'ar'; history.replaceState(null, '', `?lang=${lang}${location.hash}`); render(); };
}
render();
