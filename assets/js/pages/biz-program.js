import { t, fmtNum, fmtMoney, unitWord, curLabel, tierName, lang } from '../core/i18n.js';
import { PROGRAM_TYPES, defaultProgram, earnFor, tierFor } from '../core/loyalty.js';
import { esc, icon, $, showError, toast } from '../ui/ui.js';

export default async function program(ctx, el) {
  const b = ctx.biz;
  const customers = await ctx.customers();
  const st = { program: { ...b.program }, tiers: (b.tiers || []).map((x) => ({ ...x })).sort((x, y) => x.min - y.min) };
  const cur = curLabel(b.currency);

  function render() {
    const p = st.program; const unit = unitWord(p, b.currency);
    el.innerHTML = `<div class="page-head"><div><h1>${t('pg_title')}</h1></div><div class="actions"><button class="btn primary" id="save">${icon('check')}${t('save')}</button></div></div>
    <div class="cols">
      <section class="panel c7"><div class="panel-h"><h2>${t('pg_type')}</h2></div><div class="panel-b stack">
        <div class="choice-grid" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))">${PROGRAM_TYPES.map((pt) => `<button class="choice" data-pt="${pt}" aria-pressed="${p.type === pt}"><b>${t('pt_' + pt)}</b><small>${t('pt_' + pt + '_d')}</small></button>`).join('')}</div>
        ${p.type !== b.program.type ? `<div class="note">${icon('info')}<span>${t('pg_change_warn')}</span></div>` : ''}
        <div class="hr"></div>
        <h3>${t('pg_rule')}</h3>
        ${p.type === 'points' ? `<div class="row wrap">${t('pg_spend_each')} <input class="input num" data-k="per" style="width:120px" inputmode="decimal" value="${p.per}"> ${esc(cur)} → ${t('pg_give')} <input class="input num" data-k="earn" style="width:90px" inputmode="numeric" value="${p.earn}"> ${t('u_points')}</div>` : ''}
        ${p.type === 'spend' ? `<div class="row wrap">${t('pg_spend_each')} <input class="input num" data-k="per" style="width:120px" inputmode="decimal" value="${p.per}"> ${esc(cur)} = 1</div>` : ''}
        ${p.type === 'stamps' || p.type === 'visits' ? `<label class="field"><span>${t('pg_goal')}</span><input class="input num" data-k="goal" inputmode="numeric" value="${p.goal || 10}" style="max-width:140px"></label>` : ''}
        <label class="field"><span>${t('pg_welcome')} (${esc(unit)})</span><input class="input num" data-k="welcomeBonus" inputmode="numeric" value="${p.welcomeBonus || 0}" style="max-width:140px"><small>${t('pg_welcome_hint')}</small></label>
        <p class="note">${icon('info')}<span id="ex">${example()}</span></p>
      </div></section>
      <section class="panel c5"><div class="panel-h"><h2>${t('pg_tiers')}</h2><button class="btn sm" id="addtier">${icon('plus')}${t('pg_add_tier')}</button></div><div class="panel-b stack">
        ${st.tiers.map((tr, i) => `<div class="stack" style="gap:8px;padding-bottom:12px;border-bottom:1px solid var(--line-2)">
          <div class="row"><input type="color" data-t="${i}" data-f="color" value="${esc(tr.color)}" style="width:36px;height:36px;border:1px solid var(--line);border-radius:8px;padding:0">
            <input class="input" data-t="${i}" data-f="name" value="${esc(tr.name)}" placeholder="Name" aria-label="Name">
            <input class="input" data-t="${i}" data-f="nameAr" value="${esc(tr.nameAr || '')}" placeholder="الاسم" dir="rtl" aria-label="الاسم">
            ${i > 0 ? `<button class="btn ghost sm icon" data-rm="${i}" aria-label="${t('delete')}">${icon('trash')}</button>` : ''}</div>
          <div class="grid2"><label class="field"><span class="small">${t('pg_tier_min', { unit: esc(unit) })}</span><input class="input num" data-t="${i}" data-f="min" inputmode="numeric" value="${tr.min}" ${i === 0 ? 'readonly' : ''}></label>
          <label class="field"><span class="small">${t('pg_tier_benefits')}</span><input class="input" data-t="${i}" data-f="benefits" value="${esc(tr.benefits || '')}"></label></div>
          <span class="small muted">${fmtNum(customers.filter((c) => tierFor(st.tiers, c.lifetimePoints)?.id === tr.id).length)} ${t('k_customers')}</span>
        </div>`).join('')}
      </div></section>
    </div>`;
    bind();
  }
  const example = () => { const amt = b.currency === 'SYP' ? 1250 : 25; const n = earnFor(st.program, { amount: amt, qty: 1 }); return t('pg_example', { amt: fmtMoney(amt, b.currency), n: fmtNum(n), unit: unitWord(st.program, b.currency) }); };

  function bind() {
    el.querySelectorAll('[data-pt]').forEach((x) => (x.onclick = () => { const keep = st.program.welcomeBonus; st.program = x.dataset.pt === b.program.type ? { ...b.program } : { ...defaultProgram(x.dataset.pt, b.currency), welcomeBonus: keep }; render(); }));
    el.querySelectorAll('[data-k]').forEach((x) => (x.oninput = () => { st.program[x.dataset.k] = Math.max(0, Number(x.value) || 0); $('#ex', el).textContent = example(); }));
    el.querySelectorAll('[data-t]').forEach((x) => (x.oninput = () => { const tr = st.tiers[+x.dataset.t]; tr[x.dataset.f] = x.dataset.f === 'min' ? Math.max(0, Number(x.value) || 0) : x.value; }));
    el.querySelectorAll('[data-rm]').forEach((x) => (x.onclick = () => { st.tiers.splice(+x.dataset.rm, 1); render(); }));
    $('#addtier', el).onclick = () => { const last = st.tiers[st.tiers.length - 1]; st.tiers.push({ id: 't' + Date.now().toString(36), name: 'New tier', nameAr: 'مستوى جديد', min: (last?.min || 0) + 1000, color: '#5B6B8C', benefits: '' }); render(); };
    $('#save', el).onclick = async () => {
      const p = st.program;
      if ((p.type === 'points' || p.type === 'spend') && !(p.per > 0)) return toast(t('err_invalid-amount'), 'bad');
      const tiers = [...st.tiers].sort((x, y) => x.min - y.min); if (tiers[0]) tiers[0].min = 0;
      try { await ctx.S.updateBusiness(ctx.bid, { program: p, tiers }, 'program'); await ctx.reloadBiz(); toast(t('saved')); ctx.nav('program'); }
      catch (e) { showError(e); }
    };
  }
  render();
}
