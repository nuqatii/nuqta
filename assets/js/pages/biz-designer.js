import { t, lang } from '../core/i18n.js';
import { esc, icon, $, readImage, showError, toast, CARD_ICONS } from '../ui/ui.js';
import { renderCard, sampleCard } from '../ui/card.js';
import { PALETTES } from './biz-onboarding.js';

import { stampGoal } from '../core/loyalty.js';

export default async function designer(ctx, el) {
  const b = ctx.biz;
  const goal = stampGoal(b.program, await ctx.S.listRewards(ctx.bid));
  const st = { design: { style: 'gradient', layout: 'classic', icon: 'star', codeFormat: 'qr', programName: '', programNameAr: '', cover: null, ...(b.design || {}) },
    colors: { ...b.colors }, logo: b.logo || null, dirty: false };
  const stampy = b.program.type === 'stamps' || b.program.type === 'visits';

  const previewBiz = () => ({ ...b, logo: st.logo, colors: st.colors, design: st.design });
  const drawPreview = () => { $('#pv', el).innerHTML = renderCard({ business: previewBiz(), card: sampleCard(previewBiz(), lang === 'ar' ? 'مايا' : 'Maya'), rewardsReady: 2, goal }); };
  const dirty = () => { st.dirty = true; $('#save', el).disabled = false; drawPreview(); };

  const seg = (key, opts, labelKey) => `<div class="seg" role="group">${opts.map((o) => `<button type="button" data-${key}="${o}" aria-pressed="${st.design[key] === o}">${t(labelKey + o)}</button>`).join('')}</div>`;
  const color = (k, label) => `<label class="field"><span>${label}</span><span class="color-row"><input type="color" data-color="${k}" value="${esc(st.colors[k])}"><code class="small ltr">${esc(st.colors[k])}</code></span></label>`;

  el.innerHTML = `<div class="page-head"><div><h1>${t('ds_title')}</h1></div><div class="actions"><button class="btn primary" id="save" disabled>${icon('check')}${t('save')}</button></div></div>
  <div class="designer">
    <div class="stack">
      <section class="panel"><div class="panel-b form">
        <div class="field"><span>${t('ds_style')}</span>${seg('style', ['gradient', 'solid', 'split', 'minimal'], 'st_')}</div>
        <div class="field"><span>${t('ds_layout')}</span>${seg('layout', stampy ? ['classic', 'centered', 'stamps'] : ['classic', 'centered'], 'ly_')}</div>
        <div class="field"><span>${t('ds_colors')}</span><div class="swatches">${PALETTES.map((p, i) => `<button type="button" data-pal="${i}" aria-pressed="${p.bg === st.colors.bg}" style="background:linear-gradient(135deg,${p.bg} 55%,${p.secondary} 55%)" aria-label="${p.bg}"></button>`).join('')}</div></div>
        <div class="grid2">${color('bg', t('ds_bg'))}${color('secondary', t('ds_secondary'))}</div>
        ${color('text', t('ds_text'))}
      </div></section>
      <section class="panel"><div class="panel-b form">
        <div class="grid2"><label class="field"><span>${t('ds_program_name_ar')}</span><input class="input" data-name="programNameAr" dir="rtl" value="${esc(st.design.programNameAr || '')}" placeholder="${esc(b.name)}"></label>
        <label class="field"><span>${t('ds_program_name')}</span><input class="input" data-name="programName" dir="ltr" value="${esc(st.design.programName || '')}" placeholder="${esc(b.name)}"></label></div>
        <div class="field"><span>${t('ds_logo')}</span><div class="row"><span class="av sq" id="lg" style="width:48px;height:48px;background:${st.logo ? `url('${esc(st.logo)}') center/cover` : 'var(--sunken)'}"></span>
          <label class="btn sm">${icon('upload')}${t('ob_upload')}<input type="file" accept="image/*" hidden data-file="logo"></label><button type="button" class="btn ghost sm" data-rm="logo">${t('ds_remove')}</button></div></div>
        <div class="field"><span>${t('ds_cover')} <span class="muted">(${t('optional')})</span></span><div class="row">
          <label class="btn sm">${icon('upload')}${t('ob_upload')}<input type="file" accept="image/*" hidden data-file="cover"></label><button type="button" class="btn ghost sm" data-rm="cover">${t('ds_remove')}</button></div></div>
        <div class="field"><span>${t('ds_icon')}</span><div class="icon-pick">${CARD_ICONS.map((i) => `<button type="button" data-icon="${i}" aria-pressed="${st.design.icon === i}" aria-label="${i}">${icon(i)}</button>`).join('')}</div></div>
        <div class="field"><span>${t('ds_code')}</span>${seg('codeFormat', ['qr', 'barcode'], 'code_')}</div>
      </div></section>
    </div>
    <div class="preview"><div class="phone" id="pv"></div><p class="small muted" style="max-width:340px;text-align:center">${t('ds_wallet_note')}</p></div>
  </div>`;
  drawPreview();

  for (const key of ['style', 'layout', 'codeFormat']) el.querySelectorAll(`[data-${key}]`).forEach((x) => (x.onclick = () => {
    st.design[key] = x.dataset[key]; el.querySelectorAll(`[data-${key}]`).forEach((y) => y.setAttribute('aria-pressed', y === x)); dirty();
  }));
  el.querySelectorAll('[data-pal]').forEach((x) => (x.onclick = () => {
    Object.assign(st.colors, PALETTES[+x.dataset.pal]);
    el.querySelectorAll('[data-color]').forEach((c) => { c.value = st.colors[c.dataset.color]; c.nextElementSibling.textContent = c.value; });
    el.querySelectorAll('[data-pal]').forEach((y) => y.setAttribute('aria-pressed', y === x)); dirty();
  }));
  el.querySelectorAll('[data-color]').forEach((x) => (x.oninput = () => { st.colors[x.dataset.color] = x.value; x.nextElementSibling.textContent = x.value; dirty(); }));
  el.querySelectorAll('[data-name]').forEach((x) => (x.oninput = () => { st.design[x.dataset.name] = x.value; dirty(); }));
  el.querySelectorAll('[data-icon]').forEach((x) => (x.onclick = () => { st.design.icon = x.dataset.icon; el.querySelectorAll('[data-icon]').forEach((y) => y.setAttribute('aria-pressed', y === x)); dirty(); }));
  el.querySelectorAll('[data-file]').forEach((x) => (x.onchange = async (e) => {
    try {
      const img = await readImage(e.target.files[0], x.dataset.file === 'cover' ? 720 : 256);
      if (x.dataset.file === 'logo') { st.logo = img; $('#lg', el).style.background = `url('${img}') center/cover`; } else st.design.cover = img;
      dirty();
    } catch (err) { showError(err); }
  }));
  el.querySelectorAll('[data-rm]').forEach((x) => (x.onclick = () => { if (x.dataset.rm === 'logo') { st.logo = null; $('#lg', el).style.background = 'var(--sunken)'; } else st.design.cover = null; dirty(); }));
  $('#save', el).onclick = async () => {
    try { await ctx.S.updateBusiness(ctx.bid, { design: st.design, colors: { ...st.colors, primary: st.colors.bg }, logo: st.logo }, 'designer'); toast(t('saved')); await ctx.reloadBiz(); }
    catch (e) { showError(e); }
  };
  const warn = (e) => { if (st.dirty) { e.preventDefault(); e.returnValue = ''; } };
  addEventListener('beforeunload', warn); addEventListener('hashchange', () => removeEventListener('beforeunload', warn), { once: true });
}
