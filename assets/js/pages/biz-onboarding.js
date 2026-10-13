// 7-step onboarding with a live card preview. Target: a non-technical owner done in < 10 minutes.
import { t, lang, setLang, fmtMoney, unitWord, curLabel, appName, fmtDate } from '../core/i18n.js';
import { accessState } from '../core/loyalty.js';
import { BUSINESS_TYPES, PROGRAM_TYPES, defaultProgram, earnFor, defaultTiers } from '../core/loyalty.js';
import { esc, icon, $, readImage, showError, qrSvg, copyText, CARD_ICONS, legalLink, toast } from '../ui/ui.js';
import { CONFIG } from '../config.js';
import { renderCard } from '../ui/card.js';
import { baseUrl } from '../config.js';

export const PALETTES = [
  { bg: '#0F6E5C', secondary: '#E8A33D', text: '#FFFFFF' }, { bg: '#B3261E', secondary: '#F2B544', text: '#FFFFFF' },
  { bg: '#1F3A33', secondary: '#E9DCC4', text: '#F5EFE3' }, { bg: '#22336B', secondary: '#7FB2F0', text: '#FFFFFF' },
  { bg: '#5B2A86', secondary: '#F4A6C6', text: '#FFFFFF' }, { bg: '#2B2B2B', secondary: '#D4AF37', text: '#F7F3E8' },
  { bg: '#C2185B', secondary: '#FFD1DC', text: '#FFFFFF' }, { bg: '#2E7D32', secondary: '#C5E1A5', text: '#FFFFFF' },
];
const TYPE_ICON = { restaurant: 'pizza', cafe: 'coffee', retail: 'bag', salon: 'scissors', gym: 'dumbbell', beauty: 'sparkle', grocery: 'leaf', other: 'star' };
const REWARD_IDEAS = {
  ar: { points: [['مشروب مجاني', 150], ['حلوى مجانية', 300], ['خصم ١٠٪', 500]], visits: [['زيارة مجانية', 10], ['خصم ٢٠٪', 5]], stamps: [['قطعة مجانية', 0]], spend: [['قسيمة بقيمة ١٠٠٠ ل.س', 10000]] },
  en: { points: [['Free drink', 150], ['Free dessert', 300], ['10% off', 500]], visits: [['Free visit', 10], ['20% off', 5]], stamps: [['Free one on us', 0]], spend: [['1,000 SYP voucher', 10000]] },
};
const TOTAL = 7;

export default function onboarding(ctx, root, onDone) {
  const st = {
    step: 1, name: '', type: 'restaurant', logo: null, colors: { ...PALETTES[0] }, currency: 'SYP',
    program: defaultProgram('points', 'SYP'), reward: { name: '', cost: 150 }, icon: 'pizza', busy: false,
  };

  function preview() {
    const biz = { name: st.name || (lang === 'ar' ? 'اسم نشاطك' : 'Your business'), logo: st.logo, colors: st.colors, currency: st.currency,
      program: st.program, tiers: defaultTiers(), design: { style: 'gradient', layout: st.program.type === 'stamps' || st.program.type === 'visits' ? 'stamps' : 'classic', icon: st.icon, programName: '' } };
    const pts = st.program.type === 'stamps' || st.program.type === 'visits' ? 4 : 320;
    return renderCard({ business: biz, card: { firstName: lang === 'ar' ? 'مايا' : 'Maya', points: pts, lifetimePoints: 0, memberNumber: '100001', qrValue: 'preview' } });
  }
  const refreshPreview = () => { const p = $('#ob-prev'); if (p) p.innerHTML = preview(); };

  function stepBody() {
    switch (st.step) {
      case 1: return `<h1>${t('ob_name')}</h1>
        <label class="field"><span class="sr">${t('ob_name')}</span><input class="input" id="name" maxlength="60" placeholder="${t('ob_name_ph')}" value="${esc(st.name)}" autofocus style="min-height:56px;font-size:1.2rem"></label>`;
      case 2: return `<h1>${t('ob_type')}</h1><div class="choice-grid" role="group">${BUSINESS_TYPES.map((b) => `<button class="choice" data-type="${b}" aria-pressed="${st.type === b}">${icon(TYPE_ICON[b])}<b>${t('bt_' + b)}</b></button>`).join('')}</div>`;
      case 3: return `<h1>${t('ob_logo')}</h1><p class="muted">${t('ob_logo_hint')}</p>
        <div class="logo-drop"><div class="prev">${st.logo ? `<img src="${esc(st.logo)}" alt="">` : icon('upload')}</div>
        <div class="stack" style="gap:8px"><label class="btn">${icon('upload')}${t('ob_upload')}<input type="file" accept="image/*" id="logo" hidden></label>
        ${st.logo ? `<button class="btn ghost sm" id="rmlogo">${t('ds_remove')}</button>` : ''}</div></div>
        <div class="field"><span>${t('ds_icon')}</span><div class="icon-pick">${CARD_ICONS.map((i) => `<button data-icon="${i}" aria-pressed="${st.icon === i}" aria-label="${i}">${icon(i)}</button>`).join('')}</div></div>`;
      case 4: return `<h1>${t('ob_colors')}</h1>
        <div class="swatches" role="group">${PALETTES.map((p, i) => `<button data-pal="${i}" aria-pressed="${p.bg === st.colors.bg}" style="background:linear-gradient(135deg,${p.bg} 55%,${p.secondary} 55%)" aria-label="${p.bg}"></button>`).join('')}</div>
        <div class="grid2">
          <label class="field"><span>${t('ds_bg')}</span><span class="color-row"><input type="color" id="c-bg" value="${st.colors.bg}"><code class="small ltr">${st.colors.bg}</code></span></label>
          <label class="field"><span>${t('ds_secondary')}</span><span class="color-row"><input type="color" id="c-sec" value="${st.colors.secondary}"><code class="small ltr">${st.colors.secondary}</code></span></label>
        </div>`;
      case 5: {
        const p = st.program; const cur = curLabel(st.currency);
        return `<h1>${t('ob_program')}</h1>
        <div class="choice-grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">${PROGRAM_TYPES.map((pt) => `<button class="choice" data-pt="${pt}" aria-pressed="${p.type === pt}"><b>${t('pt_' + pt)}</b><small>${t('pt_' + pt + '_d')}</small></button>`).join('')}</div>
        <div class="panel"><div class="panel-b form">
          ${p.type === 'points' ? `<div class="row wrap">${t('pg_spend_each')} <input class="input num" id="per" style="width:110px" inputmode="decimal" value="${p.per}"> ${cur} → ${t('pg_give')} <input class="input num" id="earn" style="width:80px" inputmode="numeric" value="${p.earn}"> ${t('u_points')}</div>` : ''}
          ${p.type === 'spend' ? `<div class="row wrap">${t('pg_spend_each')} <input class="input num" id="per" style="width:110px" inputmode="decimal" value="${p.per}"> ${cur} = 1</div>` : ''}
          ${p.type === 'stamps' || p.type === 'visits' ? `<label class="field"><span>${t('pg_goal')}</span><input class="input num" id="goal" inputmode="numeric" value="${p.goal}" style="max-width:120px"></label>` : ''}
          <p class="small muted">${t('pg_preview')}: ${t('pg_example', { amt: fmtMoney(1250, st.currency), n: earnFor(p, { amount: 1250, qty: 1 }), unit: unitWord(p, st.currency) })}</p>
        </div></div>`;
      }
      case 6: {
        const ideas = REWARD_IDEAS[lang][st.program.type] || [];
        return `<h1>${t('ob_reward')}</h1>
        <div class="row wrap">${ideas.map(([n, c]) => { c = c || st.program.goal; return `<button class="chip" data-idea="${esc(n)}|${c}">${esc(n)} · ${c}</button>`; }).join('')}</div>
        <div class="grid2">
          <label class="field"><span>${t('rw_name')}</span><input class="input" id="rname" maxlength="60" value="${esc(st.reward.name)}"></label>
          <label class="field"><span>${t('rw_cost')} (${esc(unitWord(st.program, st.currency))})</span><input class="input num" id="rcost" inputmode="numeric" value="${st.reward.cost}"></label>
        </div>`;
      }
      case 7: return `<h1>${lang === 'ar' ? 'كل شيء جاهز للإنشاء' : 'Ready to create'}</h1>
        <ul class="list">
          <li><span class="grow"><span class="s">${t('ob_name')}</span><span class="t">${esc(st.name)}</span></span></li>
          <li><span class="grow"><span class="s">${t('ob_type')}</span><span class="t">${t('bt_' + st.type)}</span></span></li>
          <li><span class="grow"><span class="s">${t('pg_rule')}</span><span class="t">${t('pt_' + st.program.type)} — ${ruleText()}</span></span></li>
          <li><span class="grow"><span class="s">${t('ob_reward')}</span><span class="t">${esc(st.reward.name || '—')} · ${st.reward.cost} ${esc(unitWord(st.program, st.currency))}</span></span></li>
        </ul>
        <label class="check" style="margin-top:8px"><input type="checkbox" id="agree" ${st.agree ? 'checked' : ''}><span>${t('ob_terms', { terms: legalLink('terms'), privacy: legalLink('privacy') })}</span></label>`;
    }
  }
  const ruleText = () => {
    const p = st.program; const cur = curLabel(st.currency);
    return p.type === 'points' ? t('rule_points', { earn: p.earn, per: p.per, cur }) : p.type === 'spend' ? t('rule_spend', { per: p.per, cur }) : t('rule_' + p.type);
  };

  // New sign-ups are closed by the platform: say so up front instead of after seven steps.
  if (ctx.platform && ctx.platform.signupsOpen === false) {
    root.className = 'center-load';
    root.innerHTML = `<div class="empty" style="max-width:420px">${icon('info')}<h2 style="color:var(--ink)">${t('err_signups-closed')}</h2>
      <button class="btn" id="out">${icon('out')}${t('nav_signout')}</button></div>`;
    $('#out').onclick = async () => { await ctx.S.signOut(); location.replace('index.html'); };
    return;
  }

  function render() {
    root.className = '';
    root.innerHTML = `<div class="ob">
      <div class="ob-form">
        <div class="spread"><div class="brandmark" style="padding:0"><span class="dot"></span>${esc(appName())}</div>
          <button class="btn ghost sm" id="lang">${icon('globe')}${t('switch_lang')}</button></div>
        <div class="stack" style="gap:8px"><span class="small muted">${t('ob_step', { n: st.step, total: TOTAL })}</span>
          <div class="progress">${Array.from({ length: TOTAL }, (_, i) => `<i class="${i < st.step ? 'on' : ''}"></i>`).join('')}</div></div>
        <div class="stack" id="body">${stepBody()}</div>
        <div class="ob-nav">
          ${st.step > 1 ? `<button class="btn lg" id="back">${t('back')}</button>` : `<span></span>`}
          <div class="row">${st.step === 3 && !st.logo ? `<button class="btn ghost lg" id="skip">${t('ob_skip')}</button>` : ''}
          <button class="btn primary lg" id="next">${st.step === TOTAL ? t('ob_finish') : t('next')}</button></div>
        </div>
      </div>
      <aside class="ob-side"><div class="phone" id="ob-prev">${preview()}</div></aside>
    </div>`;
    bind();
  }

  function bind() {
    $('#lang').onclick = () => { setLang(lang === 'ar' ? 'en' : 'ar'); render(); };
    $('#back')?.addEventListener('click', () => { st.step--; render(); });
    $('#skip')?.addEventListener('click', () => { st.step++; render(); });
    $('#next').onclick = next;
    const name = $('#name');
    if (name) { name.oninput = () => { st.name = name.value; refreshPreview(); }; name.onkeydown = (e) => { if (e.key === 'Enter') next(); }; }
    root.querySelectorAll('[data-type]').forEach((b) => (b.onclick = () => { st.type = b.dataset.type; st.icon = TYPE_ICON[st.type]; if (st.type === 'cafe') { st.program = defaultProgram('stamps', st.currency); st.reward = { name: '', cost: st.program.goal }; } render(); }));
    $('#logo')?.addEventListener('change', async (e) => { try { st.logo = await readImage(e.target.files[0]); render(); } catch (err) { showError(err); } });
    $('#rmlogo')?.addEventListener('click', () => { st.logo = null; render(); });
    root.querySelectorAll('[data-icon]').forEach((b) => (b.onclick = () => { st.icon = b.dataset.icon; render(); }));
    root.querySelectorAll('[data-pal]').forEach((b) => (b.onclick = () => { st.colors = { ...PALETTES[+b.dataset.pal] }; render(); }));
    $('#c-bg')?.addEventListener('input', (e) => { st.colors.bg = e.target.value; e.target.nextElementSibling.textContent = e.target.value; refreshPreview(); });
    $('#c-sec')?.addEventListener('input', (e) => { st.colors.secondary = e.target.value; e.target.nextElementSibling.textContent = e.target.value; refreshPreview(); });
    root.querySelectorAll('[data-pt]').forEach((b) => (b.onclick = () => {
      st.program = defaultProgram(b.dataset.pt, st.currency);
      st.reward.cost = { points: 150, visits: st.program.goal, stamps: st.program.goal, spend: 10000 }[b.dataset.pt]; render();
    }));
    for (const k of ['per', 'earn', 'goal']) $('#' + k)?.addEventListener('input', (e) => { const v = Number(e.target.value); if (v > 0) { st.program[k] = v; if (k === 'goal') st.reward.cost = v; refreshPreview(); } });
    root.querySelectorAll('[data-idea]').forEach((b) => (b.onclick = () => { const [n, c] = b.dataset.idea.split('|'); st.reward = { name: n, cost: +c }; render(); }));
    $('#rname')?.addEventListener('input', (e) => (st.reward.name = e.target.value));
    $('#agree')?.addEventListener('change', (e) => (st.agree = e.target.checked));
    $('#rcost')?.addEventListener('input', (e) => (st.reward.cost = Number(e.target.value) || 1));
  }

  async function next() {
    if (st.step === 1 && !st.name.trim()) { $('#name').setAttribute('aria-invalid', 'true'); return $('#name').focus(); }
    if (st.step === 5) { // re-read inputs in case they were typed without blur
      for (const k of ['per', 'earn', 'goal']) { const el = $('#' + k); if (el && Number(el.value) > 0) st.program[k] = Number(el.value); }
    }
    if (st.step === 6 && !st.reward.name.trim()) { const el = $('#rname'); el.setAttribute('aria-invalid', 'true'); return el.focus(); }
    if (st.step < TOTAL) { st.step++; return render(); }
    if (!$('#agree')?.checked) { toast(t('err_terms-required'), 'bad'); $('#agree')?.focus(); return; }
    if (st.busy) return; st.busy = true; $('#next').disabled = true;
    try {
      const b = await ctx.S.createBusiness({
        name: st.name, type: st.type, logo: st.logo, colors: st.colors, currency: st.currency, lang,
        programType: st.program.type, program: st.program, termsAccepted: true, termsVersion: CONFIG.LEGAL.updated,
        design: { icon: st.icon, layout: st.program.type === 'stamps' || st.program.type === 'visits' ? 'stamps' : 'classic', programName: '', programNameAr: '' },
        firstReward: { name: st.reward.name, nameAr: lang === 'ar' ? st.reward.name : '', cost: st.reward.cost },
      });
      success(b);
    } catch (e) { showError(e); st.busy = false; $('#next').disabled = false; }
  }

  function success(b) {
    const url = `${baseUrl()}rewards.html?b=${b.slug}`;
    root.innerHTML = `<div class="ob"><div class="ob-form" style="gap:18px">
      <div class="brandmark" style="padding:0"><span class="dot"></span>${esc(appName())}</div>
      <div class="stack" style="gap:6px"><h1>${t('ob_ready')}</h1><p class="muted">${t('ob_ready_sub')}</p></div>
      <div class="note">${icon('clock')}<span>${t('ob_trial_note', { n: Math.round((b.trialEndsAt - b.createdAt) / 86400000), d: fmtDate(accessState(b).endsAt) })}</span></div>
      <div class="row wrap" style="align-items:flex-start;gap:20px">
        <div style="width:180px;background:#fff;padding:12px;border-radius:14px;border:1px solid var(--line)">${qrSvg(url)}</div>
        <div class="stack" style="gap:10px;flex:1;min-width:220px">
          <label class="field"><span>${t('se_join_link')}</span><input class="input small" readonly value="${esc(url)}" dir="ltr"></label>
          <div class="row wrap"><button class="btn" id="cp">${icon('copy')}${t('copy')}</button><a class="btn" href="${esc(url)}" target="_blank" rel="noopener">${icon('globe')}${lang === 'ar' ? 'افتح الصفحة' : 'Open page'}</a></div>
        </div>
      </div>
      <div class="ob-nav"><a class="btn lg" href="#/qr" id="poster">${icon('qr')}${t('qr_poster')}</a><button class="btn primary lg" id="go">${t('ob_go_dashboard')}</button></div>
    </div><aside class="ob-side"><div class="phone">${renderCard({ business: b, card: { firstName: lang === 'ar' ? 'مايا' : 'Maya', points: b.program.welcomeBonus || 0, lifetimePoints: 0, memberNumber: '100001', qrValue: url } })}</div></aside></div>`;
    $('#cp').onclick = () => copyText(url);
    $('#go').onclick = () => { location.hash = '#/dashboard'; onDone(b.id); };
    $('#poster').onclick = (e) => { e.preventDefault(); location.hash = '#/qr'; onDone(b.id); };
  }

  render();
}
