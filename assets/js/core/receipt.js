// Subscription payment receipt. One layout for the screen, for printing and for the email
// (inline styles + tables so email apps show it correctly). No imports: the server function uses it too.

const T = {
  ar: {
    title: 'إيصال دفع', no: 'رقم الإيصال', date: 'التاريخ', billed: 'إلى', from: 'من', item: 'البيان', amount: 'المبلغ',
    sub: 'اشتراك {app} — باقة {plan}', months: '{n} شهر', months2: 'شهران', monthsN: '{n} أشهر', period: 'الفترة: {a} إلى {b}', until: 'مدفوع حتى {b}',
    method: 'طريقة الدفع', note: 'ملاحظة', total: 'الإجمالي', paid: 'مدفوع', thanks: 'شكراً لاختيارك {app}.',
    ref: 'رقم النشاط', foot: 'هذا الإيصال صادر إلكترونياً ولا يحتاج إلى توقيع.',
    plans: { basic: 'الأساسية', enterprise: 'المؤسسات' },
  },
  en: {
    title: 'Payment receipt', no: 'Receipt no.', date: 'Date', billed: 'Billed to', from: 'From', item: 'Description', amount: 'Amount',
    sub: '{app} subscription — {plan} plan', months: '{n} month', months2: '2 months', monthsN: '{n} months', period: 'Period: {a} to {b}', until: 'Paid until {b}',
    method: 'Paid via', note: 'Note', total: 'Total', paid: 'PAID', thanks: 'Thank you for choosing {app}.',
    ref: 'Business ID', foot: 'This receipt was issued electronically and needs no signature.',
    plans: { basic: 'Basic', enterprise: 'Enterprise' },
  },
};
const planOf = (p) => (p === 'enterprise' ? 'enterprise' : 'basic');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Receipt number. New payments get a running number (NQ-2026-0007); older ones a short code from their id.
export const receiptNumber = (p) => p.receiptNo || `NQ-${String(p.id || '').slice(0, 8).toUpperCase()}`;

function fmtDate(ms, lang) {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SY-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ms));
}
function fmtMoney(n, cur, lang) {
  try { return new Intl.NumberFormat(lang === 'ar' ? 'ar-SY-u-nu-latn' : 'en-US', { style: 'currency', currency: cur || 'USD', maximumFractionDigits: 2 }).format(Number(n) || 0); }
  catch { return `${Number(n) || 0} ${cur || ''}`; }
}

// p: payment { id, receiptNo, at, plan, months, amount, currency, method, note, periodStart, periodEnd }
// biz: { id, name }, ownerEmail, issuer: { name, site, whatsapp, email }
export function receiptHtml({ p, biz, ownerEmail, lang = 'ar', issuer }) {
  const L = T[lang] ? lang : 'ar'; const t = T[L]; const rtl = L === 'ar';
  const fill = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m));
  const n = Number(p.months) || 1;
  const monthsTxt = L === 'ar' ? (n === 1 ? 'شهر واحد' : n === 2 ? t.months2 : n <= 10 ? fill(t.monthsN, { n }) : fill(t.months, { n })) : (n === 1 ? fill(t.months, { n }) : fill(t.monthsN, { n }));
  const period = p.periodStart ? fill(t.period, { a: fmtDate(p.periodStart, L), b: fmtDate(p.periodEnd, L) }) : p.periodEnd ? fill(t.until, { b: fmtDate(p.periodEnd, L) }) : '';
  const money = p.amount ? fmtMoney(p.amount, p.currency, L) : '—';
  const al = rtl ? 'right' : 'left'; const ar = rtl ? 'left' : 'right';
  const td = `padding:10px 0;border-bottom:1px solid #E6E8EF;vertical-align:top;`;
  const lab = 'color:#6B7280;font-size:12px;';
  return `<div dir="${rtl ? 'rtl' : 'ltr'}" style="font-family:${rtl ? "'Segoe UI',Tahoma,Arial" : "'Segoe UI',Helvetica,Arial"},sans-serif;color:#1B2559;max-width:640px;margin:0 auto;background:#fff;padding:28px 26px;border:1px solid #E6E8EF;border-radius:14px;line-height:1.55;text-align:${al}">
  <table role="presentation" width="100%" style="border-collapse:collapse"><tr>
    <td style="vertical-align:top;text-align:${al}"><div style="font-size:24px;font-weight:800;letter-spacing:-.3px">${esc(issuer.name)}<span style="color:#F7931E">.</span></div>
      <div style="${lab}">${esc(issuer.site)}${issuer.whatsapp ? ` · <span dir="ltr">${esc(issuer.whatsapp)}</span>` : ''}${issuer.email ? ` · ${esc(issuer.email)}` : ''}</div></td>
    <td style="vertical-align:top;text-align:${ar}"><div style="font-size:20px;font-weight:700">${t.title}</div>
      <div style="${lab}">${t.no}: <b dir="ltr" style="color:#1B2559">${esc(receiptNumber(p))}</b></div>
      <div style="${lab}">${t.date}: <b style="color:#1B2559">${fmtDate(p.at, L)}</b></div></td></tr></table>
  <table role="presentation" width="100%" style="border-collapse:collapse;margin:22px 0 8px"><tr>
    <td style="vertical-align:top;text-align:${al};width:50%"><div style="${lab}">${t.billed}</div><div style="font-weight:700;font-size:16px">${esc(biz.name)}</div>
      ${ownerEmail ? `<div dir="ltr" style="font-size:13px;text-align:${al}">${esc(ownerEmail)}</div>` : ''}<div style="${lab}">${t.ref}: <span dir="ltr">${esc(biz.id)}</span></div></td>
    <td style="vertical-align:middle;text-align:${ar}"><span style="display:inline-block;border:2px solid #0F8A5F;color:#0F8A5F;border-radius:8px;padding:4px 14px;font-weight:800;letter-spacing:1px;transform:rotate(${rtl ? '' : '-'}6deg)">${t.paid}</span></td></tr></table>
  <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:10px">
    <tr><td style="${td}${lab}text-align:${al}">${t.item}</td><td style="${td}${lab}text-align:${ar}">${t.amount}</td></tr>
    <tr><td style="${td}text-align:${al}"><div style="font-weight:600">${esc(fill(t.sub, { app: issuer.name, plan: t.plans[planOf(p.plan)] }))} · ${monthsTxt}</div>
      ${period ? `<div style="${lab}">${period}</div>` : ''}</td><td style="${td}text-align:${ar};white-space:nowrap" dir="ltr">${money}</td></tr>
    ${p.method ? `<tr><td style="${td}${lab}text-align:${al}">${t.method}</td><td style="${td}text-align:${ar}">${esc(p.method)}</td></tr>` : ''}
    ${p.note ? `<tr><td style="${td}${lab}text-align:${al}">${t.note}</td><td style="${td}text-align:${ar}">${esc(p.note)}</td></tr>` : ''}
    <tr><td style="padding:14px 0;font-weight:700;font-size:16px;text-align:${al}">${t.total}</td><td style="padding:14px 0;font-weight:800;font-size:18px;text-align:${ar};white-space:nowrap" dir="ltr">${money}</td></tr>
  </table>
  <p style="margin:18px 0 4px;font-size:14px">${esc(fill(t.thanks, { app: issuer.name }))}</p>
  <p style="${lab}margin:0">${t.foot}</p></div>`;
}

export function receiptSubject({ p, biz, lang = 'ar', issuer }) {
  return lang === 'en' ? `Receipt ${receiptNumber(p)} — ${issuer.name} subscription for ${biz.name}` : `إيصال ${receiptNumber(p)} — اشتراك ${issuer.name} لـ ${biz.name}`;
}
