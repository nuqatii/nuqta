// Platform admin: tenants, trials, subscriptions and payments, platform settings.
// Aggregates only — never customer PII.
import { getService } from '../data/index.js';
import { t, setLang, lang, appName, fmtNum, fmtMoney, ago, fmtDate } from '../core/i18n.js';
import { DAY, accessState, PLANS, PAID_PLANS, extendPaid, extendTrial } from '../core/loyalty.js';
import { esc, icon, $, showError, toast, confirmBox, modal } from '../ui/ui.js';
import { faqText } from '../core/faq.js';

const S = await getService();
const root = document.getElementById('root');
const CHIP = { trial: 'brand', active: 'ok', grace: 'warn', expired: 'bad', suspended: 'bad' };
let filter = 'all';

async function render() {
  if (!S.auth.current()) return location.replace('login.html?next=admin.html');
  if (!(await S.isPlatformAdmin())) { root.className = 'center-load'; root.innerHTML = `<div class="empty">${icon('shield')}<p>${t('ad_not_admin')}</p><a class="btn" href="app.html">${t('back')}</a></div>`; return; }
  const [list, settings, faq] = await Promise.all([S.adminListBusinesses(), S.adminSettings(), S.faq()]);
  const now = Date.now();
  const rows = list.map((b) => ({ ...b, acc: accessState(b, now) }));
  const is = (r, f) => f === 'all' || (f === 'trial' && r.acc.state === 'trial') || (f === 'active' && r.acc.state === 'active')
    || (f === 'expiring' && ['trial', 'active', 'grace'].includes(r.acc.state) && r.acc.daysLeft <= 7)
    || (f === 'locked' && ['grace', 'expired', 'suspended'].includes(r.acc.state));
  const count = (f) => rows.filter((r) => is(r, f)).length;
  const tot = (k) => list.reduce((s, b) => s + (b[k] || 0), 0);
  const mrr = rows.filter((r) => r.acc.state === 'active').reduce((s, r) => s + (settings.prices?.[r.plan] || 0), 0);
  const shown = rows.filter((r) => is(r, filter));

  document.title = t('ad_title');
  root.className = '';
  root.innerHTML = `${S.mode === 'demo' ? `<div class="demo-bar">${t('demo_banner')}</div>` : ''}
  <main class="page" style="margin-inline:auto">
    <div class="page-head"><div><div class="brandmark" style="padding:0 0 8px"><span class="dot"></span>${esc(appName())}</div><h1>${t('ad_title')}</h1><p>${t('ad_privacy')}</p></div>
      <div class="actions"><button class="btn ghost" id="lang">${icon('globe')}${t('switch_lang')}</button><button class="btn" id="out">${icon('out')}${t('nav_signout')}</button></div></div>
    <section class="kpis">
      <div class="kpi"><div class="l">${t('ad_businesses')}</div><div class="v">${fmtNum(list.length)}</div><div class="d muted">${fmtNum(list.filter((b) => b.createdAt > now - 30 * DAY).length)} ${t('ad_new')}</div></div>
      <div class="kpi"><div class="l">${t('ad_k_trials')}</div><div class="v">${fmtNum(count('trial'))}</div></div>
      <div class="kpi"><div class="l">${t('ad_k_paying')}</div><div class="v">${fmtNum(count('active'))}</div></div>
      <div class="kpi"><div class="l">${t('ad_k_locked')}</div><div class="v">${fmtNum(count('locked'))}</div></div>
      <div class="kpi"><div class="l">${t('ad_k_mrr')}</div><div class="v">${fmtMoney(mrr, settings.currency)}</div></div>
    </section>
    <section class="panel"><div class="panel-h"><h2>${t('ad_businesses')}</h2>
      <div class="row wrap">${['all', 'trial', 'active', 'expiring', 'locked'].map((f) => `<button class="chip" data-f="${f}" aria-pressed="${filter === f}">${t('ad_f_' + f)} · ${fmtNum(count(f))}</button>`).join('')}</div></div>
      <div class="table-wrap" style="margin-top:12px"><table class="tbl"><thead><tr>
      <th>${t('col_business')}</th><th>${t('ad_sub')}</th><th class="hide-sm">${t('ad_plan')}</th><th class="r hide-sm">${t('k_customers')}</th><th class="r hide-sm">${t('ad_txns')}</th><th class="hide-sm">${t('ad_last_active')}</th><th>${t('ad_actions')}</th></tr></thead><tbody>
      ${shown.map((b) => `<tr style="cursor:default"><td><div class="row">${b.logo ? `<img src="${esc(b.logo)}" style="width:32px;height:32px;border-radius:8px" alt="">` : `<span class="av sq">${esc(b.name[0])}</span>`}<div><div style="font-weight:500">${esc(b.name)}</div><div class="small muted"><span class="ltr">/${esc(b.slug)}</span> · ${t('bt_' + b.type)} · ${fmtDate(b.createdAt)}</div></div></div></td>
        <td><span class="chip ${CHIP[b.acc.state]}">${t('st_' + b.acc.state)}</span>
          <div class="small muted" style="margin-top:4px">${b.acc.state === 'expired' ? fmtDate(b.acc.endsAt) : b.acc.state === 'suspended' ? '' : `${t('bl_until', { d: fmtDate(b.acc.state === 'grace' ? b.acc.lockAt : b.acc.endsAt) })} · ${t('bl_days_left', { n: b.acc.daysLeft })}`}</div></td>
        <td class="hide-sm">${t('plan_' + (b.plan || 'trial'))}</td>
        <td class="r num hide-sm">${fmtNum(b.statCustomers || 0)}</td><td class="r num hide-sm">${fmtNum(b.statTxns || 0)}</td>
        <td class="hide-sm small muted">${ago(b.lastActivityAt)}</td>
        <td><div class="row" style="gap:6px;flex-wrap:nowrap">
          <button class="btn sm primary" data-pay="${b.id}">${t('ad_mark_paid')}</button>
          <button class="btn sm icon" data-more="${b.id}" aria-label="${t('nav_more')}">${icon('more')}</button></div></td></tr>`).join('') || `<tr><td colspan="7" class="muted" style="text-align:center;padding:24px">—</td></tr>`}
    </tbody></table></div></section>
    <div class="cols" style="margin-top:16px">
      <section class="panel c7"><div class="panel-h"><h2>${t('ad_billing')}</h2></div><div class="panel-b"><form class="form" id="bs">
        <div class="grid2"><label class="field"><span>${t('ad_trial_days')}</span><input class="input num" name="trialDays" inputmode="numeric" value="${settings.trialDays}"></label>
        <label class="field"><span>${t('ad_currency')}</span><input class="input" name="currency" value="${esc(settings.currency)}" maxlength="6" dir="ltr"></label></div>
        <div class="field"><span>${t('ad_prices')}</span><div class="grid2" style="grid-template-columns:repeat(3,1fr)">${PAID_PLANS.map((p) => `<label class="field"><span class="small">${t('plan_' + p)}</span><input class="input num" name="price_${p}" inputmode="decimal" value="${settings.prices?.[p] ?? ''}"></label>`).join('')}</div></div>
        <label class="field"><span>${t('ad_payinfo')}</span><textarea class="input" name="paymentInfo" maxlength="1000" dir="auto" rows="4">${esc(settings.paymentInfo)}</textarea></label>
        <label class="field"><span>${t('ad_wa')}</span><input class="input" name="supportWhatsapp" value="${esc(settings.supportWhatsapp)}" dir="ltr" placeholder="+963 9XX XXX XXX"></label>
        <div><button class="btn primary" type="submit">${t('save')}</button></div></form></div></section>
      <div class="c5 stack">
        <section class="panel"><div class="panel-h"><h2>${t('ad_settings')}</h2></div><div class="panel-b"><form class="form" id="ps">
          <label class="check"><input type="checkbox" name="signupsOpen" ${settings.signupsOpen ? 'checked' : ''}><span>${t('ad_signups')}</span></label>
          <label class="field"><span>${t('ad_announcement')}</span><textarea class="input" name="announcement" maxlength="300" dir="auto">${esc(settings.announcement || '')}</textarea></label>
          <div><button class="btn primary" type="submit">${t('save')}</button></div></form></div></section>
        <section class="panel"><div class="panel-h"><h2>${t('ad_health')}</h2></div><div class="panel-b"><ul class="list">
          <li><span class="grow small muted">${t('ad_mode')}</span><span class="chip ${S.mode === 'firebase' ? 'ok' : 'warn'}">${S.mode === 'firebase' ? 'Firebase' : 'Demo (localStorage)'}</span></li>
          <li><span class="grow small muted">${t('ad_customers')}</span><span class="num">${fmtNum(tot('statCustomers'))}</span></li>
          <li><span class="grow small muted">${t('ad_revenue_all')}</span><span class="num">${fmtMoney(tot('statRevenue'), 'SYP')}</span></li>
          <li><span class="grow small muted">${t('ad_redeemed')}</span><span class="num">${fmtNum(tot('statRedeemed'))}</span></li>
        </ul></div></section>
      </div>
    </div>
    <section class="panel" style="margin-top:16px"><div class="panel-h"><div><h2>${t('fq_title')} <span class="chip ${faq.custom ? 'brand' : ''}">${faq.custom ? t('fq_custom') : t('fq_default')}</span></h2><p class="small muted" style="margin:4px 0 0">${t('fq_hint')}</p></div>
      <div class="row wrap"><a class="btn ghost sm" href="index.html#faq" target="_blank" rel="noopener">${icon('globe')}nuqatii.com</a><button class="btn sm primary" id="fqAdd">${icon('plus')}${t('fq_add')}</button></div></div>
      <div class="panel-b"><ul class="list faq-ed">${faq.items.map((x, i) => `<li><span class="grow"><span class="t">${esc(faqText(x.q, lang))}</span><span class="s">${esc(faqText(x.a, lang).slice(0, 140))}${faqText(x.a, lang).length > 140 ? '…' : ''}</span></span>
        <span class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sm icon" data-fup="${i}" ${i ? '' : 'disabled'} aria-label="${t('fq_up')}">↑</button><button class="btn sm icon" data-fdn="${i}" ${i < faq.items.length - 1 ? '' : 'disabled'} aria-label="${t('fq_down')}">↓</button>
        <button class="btn sm icon" data-fed="${i}" aria-label="${t('fq_edit')}">${icon('edit')}</button><button class="btn sm icon" data-fdel="${i}" aria-label="${t('delete')}">${icon('trash')}</button></span></li>`).join('')}</ul>
      ${faq.custom ? `<div style="margin-top:12px"><button class="btn ghost sm" id="fqReset">${t('fq_reset')}</button></div>` : ''}</div></section>
  </main>`;

  $('#lang').onclick = () => { setLang(lang === 'ar' ? 'en' : 'ar'); render(); };
  $('#out').onclick = async () => { await S.signOut(); location.replace('login.html'); };
  root.querySelectorAll('[data-f]').forEach((x) => (x.onclick = () => { filter = x.dataset.f; render(); }));
  root.querySelectorAll('[data-pay]').forEach((x) => (x.onclick = () => payDialog(rows.find((r) => r.id === x.dataset.pay), settings)));
  root.querySelectorAll('[data-more]').forEach((x) => (x.onclick = () => moreDialog(rows.find((r) => r.id === x.dataset.more))));
  const items = faq.items.map((x) => ({ q: { ...x.q }, a: { ...x.a } }));
  const saveFaq = async (next) => { try { await S.adminSaveFaq(next); toast(t('saved')); render(); } catch (err) { showError(err); } };
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
    try { await S.adminResetFaq(); toast(t('saved')); render(); } catch (err) { showError(err); }
  };
  $('#ps').onsubmit = async (e) => {
    e.preventDefault();
    try { await S.adminSaveSettings({ ...settings, signupsOpen: e.target.signupsOpen.checked, announcement: e.target.announcement.value }); toast(t('saved')); } catch (err) { showError(err); }
  };
  $('#bs').onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    const prices = Object.fromEntries(PAID_PLANS.map((p) => [p, f['price_' + p].value]));
    try { await S.adminSaveSettings({ ...settings, trialDays: f.trialDays.value, currency: f.currency.value.trim() || 'USD', prices, paymentInfo: f.paymentInfo.value, supportWhatsapp: f.supportWhatsapp.value.trim() }); toast(t('saved')); render(); }
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
  const startPlan = PAID_PLANS.includes(b.plan) ? b.plan : 'starter';
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
  }).then((ok) => ok && render());
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
    <label class="field"><span>${t('ad_plan')}</span><select class="input" id="plan">${PLANS.map((p) => `<option value="${p}" ${b.plan === p ? 'selected' : ''}>${t('plan_' + p)}</option>`).join('')}</select></label>
    <div><h3 style="margin-bottom:6px">${t('ad_history')}</h3>${payments.length ? `<ul class="list">${payments.map((p) => `<li><span class="grow"><span class="t">${t('plan_' + p.plan)} · ${t('bl_months', { n: p.months })}</span><span class="s">${fmtDate(p.at)} · ${esc(p.method || '')} · ${esc(p.by || '')}${p.note ? ' · ' + esc(p.note) : ''}</span></span><span class="num small">${p.amount ? fmtMoney(p.amount, p.currency) : ''}</span></li>`).join('')}</ul>` : `<p class="small muted">${t('bl_none')}</p>`}</div>
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
  if (changed) render();
}

render().catch(showError);
