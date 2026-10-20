// Public home page: what nuqatii is, how it works, a live card preview, demo links, contact and legal links.
import { CONFIG } from '../config.js';
import { setLang, lang } from '../core/i18n.js';
import { renderCard } from '../ui/card.js';
import { icon } from '../ui/ui.js';
import { DEFAULT_FAQ, faqText, whatsappUrl } from '../core/faq.js';
import { getService } from '../data/index.js';

const root = document.getElementById('root');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DEMO_CARD = 'demoMayaCard7Qp2xKw9Lr4Tz';
let faqItems = DEFAULT_FAQ;

const H = {
  en: {
    title: 'Digital loyalty cards for local businesses',
    tag: 'Every visit counts.',
    lead: 'nuqatii gives restaurants, cafés, salons and shops their own branded loyalty card. Customers join by scanning a QR code: no app and no password. They collect points or stamps on their phone and can keep the card in Google Wallet or Apple Wallet.',
    start: 'Create your loyalty program', signin: 'Sign in', demoCard: 'See a demo card', demoBiz: 'Try the business dashboard',
    howTitle: 'How it works',
    how: [
      ['qr', 'Scan & join', 'The customer scans the QR code at the counter and enters a first name and phone number. That’s it.'],
      ['card', 'Card on the phone', 'The card opens in the browser and can be added to Google Wallet or Apple Wallet with one tap.'],
      ['scan', 'Earn at checkout', 'The cashier scans the card and adds points or stamps. The card and the wallet pass update automatically.'],
      ['gift', 'Get rewarded', 'When enough points or stamps are collected, the reward is ready. The cashier confirms it in one tap.'],
    ],
    featTitle: 'For business owners',
    feats: [
      ['palette', 'Your brand', 'Logo, colours and card design that match your shop.'],
      ['star', 'Points, stamps or visits', 'Pick the program that fits, with rewards and membership tiers.'],
      ['users', 'Customer list', 'See who your regulars are, who is new, and who hasn’t visited in a while.'],
      ['send', 'Campaigns', 'Prepare offers for groups of customers and send them on WhatsApp or straight to their Google Wallet card.'],
      ['team', 'Staff accounts', 'Owners, managers, cashiers and marketing, each with the right access.'],
      ['shield', 'Private by design', 'Each business sees only its own customers. Customers can ask to delete their data at any time.'],
    ],
    walletTitle: 'Works with phone wallets',
    wallet: 'Customers can save their card to Google Wallet or Apple Wallet. The pass shows the business’s logo, the customer’s name and member number, their points or stamps, rewards ready, and a QR code for the cashier. It updates by itself after every visit.',
    demoTitle: 'Try it',
    demoText: 'The demo runs entirely in your browser with sample data, so nothing you do there is saved or affects real businesses.',
    demoLogin: 'Demo business login', email: 'Email', password: 'Password',
    contact: 'Chat with us on WhatsApp', faqTitle: 'Frequently asked questions', faqMore: 'Still have a question?', privacy: 'Privacy Policy', terms: 'Terms of Service',
    preview: { name: 'Coffee Corner', program: 'Coffee Club', member: 'Maya' },
  },
  ar: {
    title: 'بطاقات ولاء رقمية للأنشطة التجارية المحلية',
    tag: 'كل زيارة تُحسب.',
    lead: 'تمنح نقاطي المطاعم والمقاهي والصالونات والمتاجر بطاقة ولاء خاصة بعلامتها. ينضم الزبون بمسح رمز QR، بلا تطبيق ولا كلمة مرور، ويجمع النقاط أو الأختام على هاتفه ويمكنه حفظ البطاقة في محفظة Google أو Apple Wallet.',
    start: 'أنشئ برنامج الولاء الخاص بك', signin: 'تسجيل الدخول', demoCard: 'شاهد بطاقة تجريبية', demoBiz: 'جرّب لوحة النشاط التجاري',
    howTitle: 'كيف تعمل',
    how: [
      ['qr', 'امسح وانضم', 'يمسح الزبون رمز QR عند الكاشير ويُدخل اسمه الأول ورقم هاتفه. هذا كل شيء.'],
      ['card', 'البطاقة على الهاتف', 'تُفتح البطاقة في المتصفح ويمكن إضافتها إلى محفظة Google أو Apple Wallet بلمسة واحدة.'],
      ['scan', 'اكسب عند الدفع', 'يمسح الكاشير البطاقة ويضيف النقاط أو الأختام، وتتحدّث البطاقة والمحفظة تلقائياً.'],
      ['gift', 'احصل على مكافأتك', 'عند جمع ما يكفي من النقاط أو الأختام تصبح المكافأة جاهزة، ويؤكدها الكاشير بلمسة.'],
    ],
    featTitle: 'لأصحاب الأنشطة التجارية',
    feats: [
      ['palette', 'علامتك التجارية', 'شعار وألوان وتصميم بطاقة يناسب محلّك.'],
      ['star', 'نقاط أو أختام أو زيارات', 'اختر البرنامج المناسب مع مكافآت ومستويات عضوية.'],
      ['users', 'قائمة الزبائن', 'اعرف زبائنك الدائمين والجدد ومن غاب منذ فترة.'],
      ['send', 'حملات', 'حضّر عروضاً لمجموعات من الزبائن وأرسلها عبر واتساب أو مباشرة إلى بطاقتهم في محفظة Google.'],
      ['team', 'حسابات الموظفين', 'مالك ومدير وكاشير وتسويق، لكلٍّ صلاحياته.'],
      ['shield', 'الخصوصية أولاً', 'يرى كل نشاط زبائنه فقط، ويمكن للزبون طلب حذف بياناته في أي وقت.'],
    ],
    walletTitle: 'تعمل مع محافظ الهاتف',
    wallet: 'يمكن للزبائن حفظ بطاقتهم في محفظة Google أو Apple Wallet. تعرض البطاقة شعار النشاط واسم الزبون ورقم عضويته ونقاطه أو أختامه والمكافآت الجاهزة ورمز QR للكاشير، وتتحدّث تلقائياً بعد كل زيارة.',
    demoTitle: 'جرّبها',
    demoText: 'النسخة التجريبية تعمل بالكامل داخل متصفحك ببيانات نموذجية، فلا يُحفظ شيء ولا يؤثر على أي نشاط حقيقي.',
    demoLogin: 'دخول النشاط التجريبي', email: 'البريد الإلكتروني', password: 'كلمة المرور',
    contact: 'تواصل معنا عبر واتساب', faqTitle: 'الأسئلة الشائعة', faqMore: 'لديك سؤال آخر؟', privacy: 'سياسة الخصوصية', terms: 'شروط الاستخدام',
    preview: { name: 'ركن القهوة', program: 'نادي القهوة', member: 'مايا' },
  },
};

function previewCard(T) {
  const business = { name: T.preview.name, colors: { bg: '#3B2A20', secondary: '#E8D5B5', text: '#FFFFFF' }, design: { style: 'gradient', layout: 'stamps', icon: 'coffee', codeFormat: 'qr', programName: T.preview.program, programNameAr: T.preview.program }, program: { type: 'stamps', goal: 8 }, tiers: [], currency: 'SYP' };
  const card = { firstName: T.preview.member, memberNumber: '100024', qrValue: 'NQ-DEMO', points: 13, lifetimePoints: 13 };
  return renderCard({ business, card, goal: 8 });
}

function render() {
  const T = H[lang] || H.en; const ar = lang === 'ar';
  const wa = whatsappUrl(lang);
  const name = CONFIG.APP_NAME[lang] || CONFIG.APP_NAME.en;
  document.title = `${name} · ${T.title}`;
  root.className = 'home';
  root.innerHTML = `
  <header class="home-top">
    <a class="home-logo" href="index.html"><img src="assets/brand/logo-horizontal-${ar ? 'ar' : 'en'}.svg" alt="${esc(name)}" height="34"></a>
    <nav><button class="btn ghost sm" id="lang">${ar ? 'English' : 'العربية'}</button><a class="btn sm" href="login.html?mode=firebase">${T.signin}</a></nav>
  </header>
  <section class="home-hero">
    <div class="home-copy">
      <p class="home-tag">${T.tag}</p>
      <h1>${T.title}</h1>
      <p class="home-lead">${T.lead}</p>
      <div class="home-cta"><a class="btn primary lg" href="login.html?mode=firebase&view=signup">${T.start}</a><a class="btn lg" href="rewards.html?mode=demo&c=${DEMO_CARD}">${T.demoCard}</a></div>
    </div>
    <div class="home-card">${previewCard(T)}</div>
  </section>
  <section class="home-sec"><h2>${T.howTitle}</h2>
    <ol class="home-steps">${T.how.map(([ic, h, p], i) => `<li><span class="n">${i + 1}</span>${icon(ic)}<h3>${h}</h3><p>${p}</p></li>`).join('')}</ol>
  </section>
  <section class="home-sec"><h2>${T.featTitle}</h2>
    <div class="home-feats">${T.feats.map(([ic, h, p]) => `<div>${icon(ic)}<h3>${h}</h3><p>${p}</p></div>`).join('')}</div>
  </section>
  <section class="home-sec home-wallet"><h2>${T.walletTitle}</h2><p>${T.wallet}</p></section>
  <section class="home-sec home-demo"><h2>${T.demoTitle}</h2><p>${T.demoText}</p>
    <div class="home-demo-grid">
      <a class="home-demo-card" href="rewards.html?mode=demo&c=${DEMO_CARD}">${icon('card')}<b>${T.demoCard}</b><span class="ltr">rewards.html?mode=demo</span></a>
      <a class="home-demo-card" href="login.html?mode=demo">${icon('building')}<b>${T.demoBiz}</b>
        <span>${T.demoLogin}:<br>${T.email}: <code class="ltr">owner@joespizza.demo</code><br>${T.password}: <code class="ltr">demo1234</code></span></a>
    </div>
  </section>
  <section class="home-sec" id="faq"><h2>${T.faqTitle}</h2>
    <div class="home-faq" id="faqList">${faqHtml()}</div>
    <div class="home-faq-more"><span>${T.faqMore}</span><a class="btn wa" href="${wa}" target="_blank" rel="noopener">${icon('whatsapp')}${T.contact}</a></div>
  </section>
  <footer class="home-foot">
    <a class="btn wa" href="${wa}" target="_blank" rel="noopener">${icon('whatsapp')}${T.contact}</a>
    <div class="home-links"><a href="privacy.html">${T.privacy}</a><a href="terms.html">${T.terms}</a><span>© ${new Date().getFullYear()} ${esc(name)}</span></div>
  </footer>`;
  document.getElementById('lang').onclick = () => { setLang(ar ? 'en' : 'ar'); render(); };
  faqSchema();
}

function faqHtml() {
  return faqItems.map((x) => `<details><summary>${esc(faqText(x.q, lang))}</summary><p>${esc(faqText(x.a, lang))}</p></details>`).join('');
}

// Lets Google show the questions in search results.
function faqSchema() {
  let el = document.getElementById('faq-ld');
  if (!el) { el = document.createElement('script'); el.type = 'application/ld+json'; el.id = 'faq-ld'; document.head.appendChild(el); }
  el.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqItems.map((x) => ({ '@type': 'Question', name: faqText(x.q, lang), acceptedAnswer: { '@type': 'Answer', text: faqText(x.a, lang) } })) });
}

// The admin can edit the FAQ (admin.html); show the saved version once it loads.
getService().then((S) => S.faq()).then((f) => {
  faqItems = f.items;
  const box = document.getElementById('faqList');
  if (box) box.innerHTML = faqHtml();
  faqSchema();
}).catch(() => {});

const q = new URLSearchParams(location.search).get('lang');
if (q === 'ar' || q === 'en') setLang(q);
render();
