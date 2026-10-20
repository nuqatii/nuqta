// Home page FAQ. These are the starting questions; the platform admin can edit them
// in admin.html → "Home page FAQ" (saved in Firestore platform/faq, readable by everyone).
import { CONFIG } from '../config.js';

export const FAQ_LIMITS = { items: 30, q: 200, a: 1500 };

export const DEFAULT_FAQ = [
  {
    q: { en: 'Do my customers need to download an app?', ar: 'هل يحتاج زبائني إلى تنزيل تطبيق؟' },
    a: { en: 'No. The customer scans the QR code at your counter, types a first name and phone number, and the card opens in the phone’s browser. There is no app to download and no password to remember.',
      ar: 'لا. يمسح الزبون رمز QR عند الكاشير ويكتب اسمه الأول ورقم هاتفه، فتُفتح البطاقة في متصفح الهاتف مباشرة. لا يوجد تطبيق للتنزيل ولا كلمة مرور يتذكرها.' },
  },
  {
    q: { en: 'Does it work on iPhone and Android?', ar: 'هل تعمل على iPhone وأندرويد؟' },
    a: { en: 'Yes, on any smartphone. Customers can also save the card to Google Wallet on Android or Apple Wallet on iPhone with one tap. The wallet card updates by itself after every visit.',
      ar: 'نعم، على أي هاتف ذكي. ويمكن للزبون أيضاً حفظ البطاقة في محفظة Google على أندرويد أو Apple Wallet على iPhone بلمسة واحدة، وتتحدّث البطاقة في المحفظة تلقائياً بعد كل زيارة.' },
  },
  {
    q: { en: 'What if a customer changes or loses their phone?', ar: 'ماذا لو غيّر الزبون هاتفه أو أضاعه؟' },
    a: { en: 'Nothing is lost: the points or stamps are saved on our servers, not on the phone. A card saved in Google Wallet or Apple Wallet comes back when the customer signs in on the new phone. You can also find the customer by phone number and send them their card link on WhatsApp.',
      ar: 'لا يضيع شيء، فالنقاط والأختام محفوظة على خوادمنا وليس على الهاتف. البطاقة المحفوظة في محفظة Google أو Apple Wallet تعود عند تسجيل الدخول على الهاتف الجديد. ويمكنك أيضاً البحث عن الزبون برقم هاتفه وإرسال رابط بطاقته عبر واتساب.' },
  },
  {
    q: { en: 'Points or stamps: which should I choose?', ar: 'نقاط أم أختام: أيهما أختار؟' },
    a: { en: 'Stamps suit simple repeat purchases, like “buy 8 coffees, get 1 free”. Points suit shops with different prices, where customers earn points for every amount spent and choose from several rewards. You can change your program later from the dashboard.',
      ar: 'الأختام مناسبة للمشتريات المتكررة البسيطة مثل "اشترِ 8 قهوة واحصل على واحدة مجاناً". والنقاط مناسبة للمحلات ذات الأسعار المختلفة، حيث يكسب الزبون نقاطاً حسب المبلغ ويختار من عدة مكافآت. ويمكنك تغيير البرنامج لاحقاً من لوحة التحكم.' },
  },
  {
    q: { en: 'How much does it cost? Is there a free trial?', ar: 'كم التكلفة؟ وهل توجد تجربة مجانية؟' },
    a: { en: 'Every new business starts with a free trial, with all features included. After the trial you continue on a monthly plan. Message us on WhatsApp for the current prices.',
      ar: 'يبدأ كل نشاط جديد بتجربة مجانية تشمل كل الميزات، وبعدها تستمر باشتراك شهري. راسلنا على واتساب لمعرفة الأسعار الحالية.' },
  },
  {
    q: { en: 'How do I pay?', ar: 'كيف أدفع؟' },
    a: { en: 'By Sham Cash, Syriatel Cash, bank transfer or cash. After paying, send us a message on WhatsApp and we activate your subscription.',
      ar: 'عبر شام كاش أو سيريتل كاش أو تحويل بنكي أو نقداً. بعد الدفع أرسل لنا رسالة على واتساب ونفعّل اشتراكك.' },
  },
  {
    q: { en: 'Can my staff use it with their own accounts?', ar: 'هل يمكن لموظفيّ استخدامها بحسابات خاصة بهم؟' },
    a: { en: 'Yes. Invite managers, cashiers and marketing staff by email. Each role sees only what it needs: for example, a cashier can add points and give rewards but cannot change your settings.',
      ar: 'نعم. ادعُ المديرين والكاشيرية وموظفي التسويق عبر البريد الإلكتروني، ويرى كل دور ما يحتاجه فقط: مثلاً يستطيع الكاشير إضافة النقاط وتسليم المكافآت لكنه لا يستطيع تغيير الإعدادات.' },
  },
  {
    q: { en: 'Can I send offers to my customers?', ar: 'هل يمكنني إرسال عروض لزبائني؟' },
    a: { en: 'Yes. Choose a group, such as new customers, regulars or people who haven’t visited in a while, and write your offer. You can send it on WhatsApp, or as a message on the card in Google Wallet that arrives as a notification on the phone.',
      ar: 'نعم. اختر مجموعة مثل الزبائن الجدد أو الدائمين أو من غاب منذ فترة، واكتب عرضك. يمكنك إرساله عبر واتساب، أو كرسالة على البطاقة في محفظة Google تصل كإشعار على الهاتف.' },
  },
  {
    q: { en: 'Is my customers’ data private?', ar: 'هل بيانات زبائني خاصة؟' },
    a: { en: 'Yes. Each business sees only its own customers, and we never share or sell them. Customers can ask to delete their data at any time from their card.',
      ar: 'نعم. يرى كل نشاط زبائنه فقط، ولا نشاركهم أو نبيعهم لأي جهة. ويمكن للزبون طلب حذف بياناته في أي وقت من بطاقته.' },
  },
  {
    q: { en: 'What happens if I stop my subscription?', ar: 'ماذا يحدث إذا أوقفت اشتراكي؟' },
    a: { en: 'Your account is paused, not deleted. Customers can still see their cards but can’t earn new points. When you renew, everything continues as before. If you close your account, your data is deleted after {days} days.',
      ar: 'يُوقف حسابك مؤقتاً ولا يُحذف. يستطيع الزبائن رؤية بطاقاتهم لكن دون كسب نقاط جديدة، وعند التجديد يستمر كل شيء كما كان. وإذا أغلقت حسابك تُحذف بياناتك بعد {days} يوماً.' },
  },
];

// Keep only well-formed items and trim them to the limits.
export function cleanFaq(items) {
  const s = (v, n) => String(v ?? '').trim().slice(0, n);
  return (Array.isArray(items) ? items : []).slice(0, FAQ_LIMITS.items).map((x) => ({
    q: { en: s(x?.q?.en, FAQ_LIMITS.q), ar: s(x?.q?.ar, FAQ_LIMITS.q) },
    a: { en: s(x?.a?.en, FAQ_LIMITS.a), ar: s(x?.a?.ar, FAQ_LIMITS.a) },
  })).filter((x) => (x.q.en || x.q.ar) && (x.a.en || x.a.ar));
}

// Text in the visitor's language, falling back to the other one; fills {days}.
export function faqText(pair, lang) {
  const v = pair?.[lang] || pair?.[lang === 'ar' ? 'en' : 'ar'] || '';
  return v.replace(/\{days\}/g, String(CONFIG.LEGAL.retentionDays));
}

// WhatsApp chat link with a ready first message; the number is not shown on the page.
export function whatsappUrl(lang) {
  const n = String(CONFIG.LEGAL.whatsapp || '').replace(/[^\d]/g, '');
  const name = CONFIG.APP_NAME[lang] || CONFIG.APP_NAME.en;
  const text = lang === 'ar' ? `مرحباً، لدي سؤال عن ${name}` : `Hi, I have a question about ${name}`;
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}
