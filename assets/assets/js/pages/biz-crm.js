import { t, fmtNum, lang, tierName } from '../core/i18n.js';
import { AUTO_SEGMENTS, autoSegment, matchesRules, presetSegments, RULE_FIELDS } from '../core/loyalty.js';
import { esc, icon, $, modal, showError, toast, confirmBox, avatar, fullName } from '../ui/ui.js';
import { SEG_COLOR } from './biz-customers.js';

// Resolve any segment key used across CRM and campaigns.
//   auto_<name> → automatic group, preset_<id> → ready-made, otherwise a saved custom segment id.
export function segmentMembers(key, customers, tiers, custom = []) {
  if (!key || key === 'all') return customers;
  if (key.startsWith('auto_')) { const s = key.slice(5); return customers.filter((c) => autoSegment(c, tiers) === s); }
  const seg = presetSegments().find((p) => p.id === key) || custom.find((s) => s.id === key);
  return seg ? customers.filter((c) => matchesRules(c, seg.rules)) : [];
}
export function segmentOptions(custom) {
  const name = (s) => (lang === 'ar' && s.nameAr) || s.name;
  return [
    { group: t('crm_auto'), items: AUTO_SEGMENTS.map((s) => ({ key: 'auto_' + s, label: t('seg_' + s) })) },
    { group: t('crm_presets'), items: presetSegments().map((p) => ({ key: p.id, label: name(p) })) },
    ...(custom.length ? [{ group: t('crm_custom'), items: custom.map((s) => ({ key: s.id, label: s.name })) }] : []),
  ];
}
export const segmentLabel = (key, custom) => segmentOptions(custom).flatMap((g) => g.items).find((i) => i.key === key)?.label || t('all');

export default async function crm(ctx, el) {
  const b = ctx.biz;
  const [customers, custom] = await Promise.all([ctx.customers(), ctx.S.listSegments(ctx.bid)]);
  const counts = Object.fromEntries(AUTO_SEGMENTS.map((s) => [s, 0]));
  for (const c of customers) counts[autoSegment(c, b.tiers)]++;
  const returning = customers.filter((c) => (c.visits || 0) >= 2).length;
  const name = (s) => (lang === 'ar' && s.nameAr) || s.name;

  el.innerHTML = `<div class="page-head"><div><h1>${t('crm_title')}</h1><p>${fmtNum(customers.length)} ${t('k_customers')} · ${t('crm_returning')}: ${fmtNum(returning)} (${customers.length ? Math.round((returning / customers.length) * 100) : 0}%)</p></div>
    <div class="actions"><button class="btn primary" id="new">${icon('plus')}${t('crm_new')}</button></div></div>
  <section class="panel"><div class="panel-h"><h2>${t('crm_auto')}</h2></div><div class="panel-b">
    <div style="display:flex;height:14px;border-radius:99px;overflow:hidden;margin-bottom:16px">${AUTO_SEGMENTS.map((s) => `<span title="${t('seg_' + s)}" style="width:${(counts[s] / Math.max(1, customers.length)) * 100}%;background:${SEG_COLOR[s]}"></span>`).join('')}</div>
    <div class="choice-grid" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))">${AUTO_SEGMENTS.map((s) => `<button class="choice" data-open="auto_${s}" style="border-inline-start:4px solid ${SEG_COLOR[s]}">
      <span class="spread"><b>${t('seg_' + s)}</b><b class="num">${fmtNum(counts[s])}</b></span><small>${t('seg_' + s + '_d')}</small></button>`).join('')}</div>
  </div></section>
  <section class="panel"><div class="panel-h"><h2>${t('crm_custom')}</h2></div><div class="panel-b"><ul class="list">
    ${[...custom.map((s) => ({ ...s, own: true })), ...presetSegments()].map((s) => `<li><span class="av sq" style="background:var(--brand-tint);color:var(--brand)">${icon(s.own ? 'pie' : 'sparkle')}</span>
      <span class="grow"><span class="t">${esc(name(s))}</span><span class="s">${esc(rulesText(s.rules, b))}</span></span>
      <span class="num">${fmtNum(customers.filter((c) => matchesRules(c, s.rules)).length)}</span>
      <button class="btn sm" data-open="${s.id}">${t('view_all')}</button>
      ${s.own ? `<button class="btn sm icon ghost" data-edit="${s.id}" aria-label="${t('edit')}">${icon('edit')}</button>` : ''}</li>`).join('')}
  </ul></div></section>`;

  el.querySelectorAll('[data-open]').forEach((x) => (x.onclick = () => showMembers(x.dataset.open)));
  el.querySelectorAll('[data-edit]').forEach((x) => (x.onclick = () => builder(custom.find((s) => s.id === x.dataset.edit))));
  $('#new', el).onclick = () => builder();

  function showMembers(key) {
    const list = segmentMembers(key, customers, b.tiers, custom);
    modal({ title: `${segmentLabel(key, custom)} · ${fmtNum(list.length)}`, wide: true,
      body: `<ul class="list">${list.slice(0, 200).map((c) => `<li data-c="${c.id}" style="cursor:pointer">${avatar(c)}<span class="grow"><span class="t">${esc(fullName(c))}</span><span class="s ltr">${esc(c.phone)}</span></span><span class="pts">${fmtNum(c.points)}</span></li>`).join('') || `<li class="muted">—</li>`}</ul>`,
      actions: ctx.can('campaigns') ? [{ label: t('cp_new'), kind: 'primary', value: 'camp' }] : [],
      onMount: (m, close) => m.querySelectorAll('[data-c]').forEach((li) => (li.onclick = () => { close(); ctx.nav('customer/' + li.dataset.c); })),
    }).then((v) => { if (v === 'camp') { sessionStorage.setItem('nuqta_new_campaign_seg', key); ctx.nav('campaigns'); } });
  }

  function builder(seg) {
    const rules = seg ? seg.rules.map((r) => ({ ...r })) : [{ field: 'daysSinceVisit', op: 'gte', value: 30 }];
    const fields = Object.keys(RULE_FIELDS).filter((f) => f !== 'marketingConsent');
    const rowHtml = (r, i) => `<div class="rule-row" data-i="${i}">
      <select class="input" data-f="field">${fields.map((f) => `<option value="${f}" ${r.field === f ? 'selected' : ''}>${t('f_' + f)}</option>`).join('')}</select>
      <select class="input" data-f="op">${['gte', 'gt', 'lte', 'lt', 'eq', 'neq'].map((o) => `<option value="${o}" ${r.op === o ? 'selected' : ''}>${t('op_' + o)}</option>`).join('')}</select>
      ${r.field === 'tierId' ? `<select class="input" data-f="value">${b.tiers.map((tr) => `<option value="${tr.id}" ${r.value === tr.id ? 'selected' : ''}>${esc(tierName(tr))}</option>`).join('')}</select>` : `<input class="input num" data-f="value" inputmode="numeric" value="${esc(r.value)}">`}
      <button class="btn ghost icon" data-rm="${i}" aria-label="${t('delete')}">${icon('x')}</button></div>`;
    const draw = (m) => {
      $('#rules', m).innerHTML = rules.map(rowHtml).join('');
      $('#count', m).textContent = t('crm_matches', { n: fmtNum(customers.filter((c) => matchesRules(c, rules)).length) });
      m.querySelectorAll('[data-f]').forEach((x) => (x.onchange = x.oninput = () => {
        const r = rules[+x.closest('[data-i]').dataset.i]; r[x.dataset.f] = x.value;
        if (x.dataset.f === 'field') { r.value = r.field === 'tierId' ? b.tiers[0]?.id : 0; if (r.field === 'tierId') r.op = 'eq'; draw(m); return; }
        $('#count', m).textContent = t('crm_matches', { n: fmtNum(customers.filter((c) => matchesRules(c, rules)).length) });
      }));
      m.querySelectorAll('[data-rm]').forEach((x) => (x.onclick = () => { rules.splice(+x.dataset.rm, 1); draw(m); }));
    };
    modal({ title: seg ? t('edit') : t('crm_new'), wide: true,
      body: `<div class="form"><label class="field"><span>${t('cp_name')}</span><input class="input" id="sname" value="${esc(seg?.name || '')}" maxlength="80" autofocus></label>
        <div class="field"><span>${t('crm_rules')}</span><div class="stack" id="rules" style="gap:8px"></div></div>
        <div class="spread"><button class="btn sm" id="addr">${icon('plus')}${t('crm_add_rule')}</button><b id="count"></b></div></div>`,
      actions: [
        ...(seg ? [{ label: t('delete'), kind: 'danger ghost', onClick: async () => { if (!(await confirmBox(t('delete'), seg.name, t('delete'), 'danger'))) return false; await ctx.S.deleteSegment(ctx.bid, seg.id); return true; } }] : []),
        { label: t('cancel'), value: false },
        { label: t('save'), kind: 'primary', onClick: async (m) => {
          const n = $('#sname', m).value.trim(); if (!n) { $('#sname', m).focus(); return false; }
          await ctx.S.saveSegment(ctx.bid, { id: seg?.id, name: n, rules: rules.map((r) => ({ ...r, value: r.field === 'tierId' ? r.value : Number(r.value) })), createdAt: seg?.createdAt });
          toast(t('saved')); return true;
        } },
      ],
      onMount: (m) => { draw(m); $('#addr', m).onclick = () => { rules.push({ field: 'visits', op: 'gte', value: 5 }); draw(m); }; },
    }).then((ok) => ok && crm(ctx, el)).catch(showError);
  }
}

function rulesText(rules, b) {
  return (rules || []).map((r) => `${t('f_' + r.field)} ${t('op_' + r.op)} ${r.field === 'tierId' ? tierName(b.tiers.find((x) => x.id === r.value)) : fmtNum(r.value)}`).join(' · ');
}
