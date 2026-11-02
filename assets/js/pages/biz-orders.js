// Online ordering (pilot): the live Orders board and the Menu editor.
import { t, fmtNum, fmtMoney, ago, lang } from '../core/i18n.js';
import { esc, icon, $, modal, showError, toast, confirmBox, readImage } from '../ui/ui.js';
import { empty } from './biz-common.js';

export default async function orders(ctx, el, { page }) {
  return page === 'menu' ? menuPage(ctx, el) : board(ctx, el);
}

const itemName = (m) => (lang === 'ar' && m.nameAr) || m.name || m.nameAr || '';

// ── Live board: New → Preparing → Ready → Collected ─────────
async function board(ctx, el) {
  const b = ctx.biz; const list = await ctx.orders();
  const money = (n) => fmtMoney(n, b.currency);
  const col = (status) => list.filter((o) => o.status === status).sort((a, c) => a.createdAt - c.createdAt);
  const done = list.filter((o) => ['collected', 'declined', 'cancelled'].includes(o.status)).sort((a, c) => c.updatedAt - a.updatedAt).slice(0, 20);
  const next = { new: ['accepted', 'o_accept'], accepted: ['ready', 'o_mark_ready'], ready: ['collected', 'o_mark_collected'] };
  const card = (o) => `<article class="o-card ${o.status}">
    <div class="spread"><b class="ltr" style="font-size:1.15rem">#${esc(o.code)}</b><span class="small muted">${ago(o.createdAt)}</span></div>
    <div><b>${esc(o.firstName)}</b> <span class="small muted ltr">${esc(o.memberNumber || '')}</span></div>
    <ul class="o-items">${o.items.map((l) => `<li><b>${fmtNum(l.qty)}×</b> ${esc(itemName(l))}${l.note ? `<small>${esc(l.note)}</small>` : ''}</li>`).join('')}</ul>
    ${o.note ? `<div class="note small">${icon('info')}<span>${esc(o.note)}</span></div>` : ''}
    <div class="spread"><span class="small">${o.pickup ? `${icon('clock')} ${esc(o.pickup)}` : ''}</span><b>${money(o.total)}</b></div>
    <div class="row" style="gap:6px">${next[o.status] ? `<button class="btn primary sm grow" data-go="${esc(o.id)}" data-to="${next[o.status][0]}">${t(next[o.status][1])}</button>` : ''}
      ${o.status !== 'ready' ? `<button class="btn sm" data-decline="${esc(o.id)}">${t('o_decline')}</button>` : ''}</div>
  </article>`;
  const paused = !!b.orderSettings?.paused;
  el.innerHTML = `<div class="page-head"><div><h1>${t('nav_orders')}</h1><p>${t('o_board_sub')}</p></div>
    <div class="actions">${ctx.can('menu') ? `<label class="check" style="margin:0"><input type="checkbox" id="pause" ${paused ? 'checked' : ''}><span>${t('o_pause')}</span></label><a class="btn" href="#/menu">${icon('list')}${t('nav_menu')}</a>` : ''}</div></div>
    ${paused ? `<div class="note" style="margin-bottom:12px">${icon('clock')}<span>${t('o_paused_staff')}</span></div>` : ''}
    <div class="o-board">${[['new', 'o_col_new'], ['accepted', 'o_col_accepted'], ['ready', 'o_col_ready']].map(([s, label]) => `<section class="o-col"><h2>${t(label)} <span class="chip">${fmtNum(col(s).length)}</span></h2>
      ${col(s).map(card).join('') || `<p class="small muted">${t('o_col_empty')}</p>`}</section>`).join('')}</div>
    <section class="panel" style="margin-top:16px"><div class="panel-h"><h2>${t('o_done')}</h2></div><div class="panel-b">
      ${done.length ? `<ul class="list">${done.map((o) => `<li><span class="grow"><span class="t"><span class="ltr">#${esc(o.code)}</span> · ${esc(o.firstName)}</span><span class="s">${o.items.map((l) => `${fmtNum(l.qty)}× ${esc(itemName(l))}`).join(' · ')} · ${ago(o.updatedAt)}</span></span>
        <span class="chip ${o.status === 'collected' ? 'ok' : 'bad'}">${t('o_st_' + o.status)}</span><b class="small">${money(o.total)}</b></li>`).join('')}</ul>` : `<p class="small muted">${t('o_col_empty')}</p>`}
    </div></section>`;

  el.querySelectorAll('[data-go]').forEach((x) => (x.onclick = async () => {
    x.disabled = true;
    try {
      const r = await ctx.S.setOrderStatus(ctx.bid, x.dataset.go, x.dataset.to);
      if (x.dataset.to === 'collected') { toast(r.earned != null ? t('o_collected_pts', { n: fmtNum(r.earned) }) : t('saved')); ctx.invalidateCustomersSoon?.(); }
    } catch (e) { showError(e); x.disabled = false; }
  }));
  el.querySelectorAll('[data-decline]').forEach((x) => (x.onclick = async () => {
    const reasons = ['o_r_soldout', 'o_r_closing', 'o_r_busy'];
    const reason = await modal({ title: t('o_decline'), body: `<form class="form" id="df">${reasons.map((r, i) => `<label class="check"><input type="radio" name="r" value="${t(r)}" ${i ? '' : 'checked'}><span>${t(r)}</span></label>`).join('')}
      <label class="field"><span>${t('o_r_other')}</span><input class="input" name="other" maxlength="120"></label></form>`,
      actions: [{ label: t('cancel'), value: null }, { label: t('o_decline'), kind: 'danger', onClick: (m) => { const f = $('#df', m); return f.other.value.trim() || f.r.value; } }] });
    if (!reason) return;
    try { await ctx.S.setOrderStatus(ctx.bid, x.dataset.decline, 'declined', { reason }); } catch (e) { showError(e); }
  }));
  $('#pause', el)?.addEventListener('change', async (e) => {
    try { await ctx.S.setOrderSettings(ctx.bid, { paused: e.target.checked }); await ctx.reloadBiz(); } catch (err) { showError(err); e.target.checked = !e.target.checked; }
  });
}

// ── Menu editor ─────────────────────────────────────────────
async function menuPage(ctx, el) {
  const b = ctx.biz; const list = await ctx.S.listMenu(ctx.bid);
  const money = (n) => fmtMoney(n, b.currency);
  const cats = [...new Set(list.map((m) => m.category || ''))];
  const stampy = b.program?.type === 'stamps' || b.program?.type === 'visits';
  el.innerHTML = `<div class="page-head"><div><h1>${t('nav_menu')}</h1><p>${t('m_sub')}</p></div>
    <div class="actions"><a class="btn" href="#/orders">${icon('bag')}${t('nav_orders')}</a><button class="btn primary" id="add">${icon('plus')}${t('m_add')}</button></div></div>
    ${b.program?.type === 'stamps' ? `<section class="panel" style="margin-bottom:14px"><div class="panel-b row wrap" style="gap:12px"><span class="grow small">${t('m_stamp_per')}</span>
      <div class="seg" role="group">${['order', 'item'].map((x) => `<button type="button" data-sp="${x}" aria-pressed="${(b.orderSettings?.stampPer || 'order') === x}">${t('m_stamp_' + x)}</button>`).join('')}</div></div></section>` : ''}
    <section class="panel"><div class="panel-b">${list.length ? cats.map((c) => `${c ? `<h3 class="menu-cat">${esc(c)}</h3>` : ''}<ul class="list">${list.filter((m) => (m.category || '') === c).map((m) => `<li>
      <span class="av sq" style="width:48px;height:48px;${m.image ? `background:url('${esc(m.image)}') center/cover` : ''}">${m.image ? '' : icon('coffee')}</span>
      <span class="grow"><span class="t">${esc(m.name)}${m.nameAr ? ` · ${esc(m.nameAr)}` : ''}</span><span class="s">${money(m.price)}${m.description ? ' · ' + esc(m.description) : ''}</span></span>
      <label class="switch" title="${t('m_available')}"><input type="checkbox" data-av="${esc(m.id)}" ${m.available !== false ? 'checked' : ''} aria-label="${t('m_available')}"><i></i></label>
      <button class="btn sm icon ghost" data-edit="${esc(m.id)}" aria-label="${t('edit')}">${icon('edit')}</button></li>`).join('')}</ul>`).join('')
      : empty(t('m_empty'), `<button class="btn primary" data-add2>${icon('plus')}${t('m_add')}</button>`)}</div></section>
    ${stampy && b.program?.type === 'visits' ? `<p class="small muted">${t('m_visits_note')}</p>` : ''}`;
  const open = (m) => itemDialog(ctx, m, cats.filter(Boolean)).then((ok) => ok && menuPage(ctx, el));
  $('#add', el).onclick = () => open();
  el.querySelector('[data-add2]')?.addEventListener('click', () => open());
  el.querySelectorAll('[data-edit]').forEach((x) => (x.onclick = () => open(list.find((m) => m.id === x.dataset.edit))));
  el.querySelectorAll('[data-av]').forEach((x) => (x.onchange = async () => {
    const m = list.find((y) => y.id === x.dataset.av);
    try { await ctx.S.saveMenuItem(ctx.bid, { ...m, available: x.checked }); m.available = x.checked; toast(x.checked ? t('m_back_on') : t('m_sold_out_now')); } catch (e) { x.checked = !x.checked; showError(e); }
  }));
  el.querySelectorAll('[data-sp]').forEach((x) => (x.onclick = async () => {
    try { await ctx.S.setOrderSettings(ctx.bid, { stampPer: x.dataset.sp }); await ctx.reloadBiz(); toast(t('saved')); } catch (e) { showError(e); }
  }));
}

function itemDialog(ctx, m = {}, cats) {
  let image = m.image || null;
  const body = `<form class="form" id="mf">
    <div class="grid2"><label class="field"><span>${t('m_name_en')}</span><input class="input" name="name" maxlength="60" value="${esc(m.name || '')}" dir="auto"></label>
    <label class="field"><span>${t('m_name_ar')}</span><input class="input" name="nameAr" maxlength="60" value="${esc(m.nameAr || '')}" dir="rtl"></label></div>
    <div class="grid2"><label class="field"><span>${t('m_price')} (${esc(ctx.biz.currency)})</span><input class="input num" name="price" inputmode="decimal" value="${m.price ?? ''}" required></label>
    <label class="field"><span>${t('m_category')}</span><input class="input" name="category" maxlength="40" list="mcats" value="${esc(m.category || '')}" placeholder="${t('m_category_ph')}"><datalist id="mcats">${cats.map((c) => `<option>${esc(c)}</option>`).join('')}</datalist></label></div>
    <label class="field"><span>${t('m_desc')} <span class="muted">(${t('optional')})</span></span><input class="input" name="description" maxlength="200" value="${esc(m.description || '')}"></label>
    <div class="field"><span>${t('m_photo')} <span class="muted">(${t('optional')})</span></span><div class="row"><span class="av sq" id="mimg" style="width:56px;height:56px;${image ? `background:url('${esc(image)}') center/cover` : ''}"></span>
      <label class="btn sm">${icon('upload')}${t('ob_upload')}<input type="file" accept="image/*" id="mfile" hidden></label>${image ? `<button type="button" class="btn sm ghost" id="mrm">${t('ds_remove')}</button>` : ''}</div></div>
    <label class="check"><input type="checkbox" name="available" ${m.available !== false ? 'checked' : ''}><span>${t('m_available')}</span></label></form>`;
  return modal({ title: m.id ? t('edit') : t('m_add'), wide: true, body,
    onMount: (el) => {
      $('#mfile', el).onchange = async (e) => { try { image = await readImage(e.target.files[0], 320); $('#mimg', el).style.background = `url('${image}') center/cover`; } catch (err) { showError(err); } };
      $('#mrm', el)?.addEventListener('click', () => { image = null; $('#mimg', el).style.background = ''; });
    },
    actions: [
      ...(m.id ? [{ label: t('delete'), kind: 'danger', onClick: async () => { if (!(await confirmBox(t('delete'), m.name || m.nameAr, t('delete'), 'danger'))) return false; await ctx.S.deleteMenuItem(ctx.bid, m.id); return true; } }] : []),
      { label: t('cancel'), value: false },
      { label: t('save'), kind: 'primary', onClick: async (el) => {
        const f = $('#mf', el);
        if (!f.name.value.trim() && !f.nameAr.value.trim()) { f.name.focus(); return false; }
        if (!(Number(f.price.value.replace(/[^\d.]/g, '')) >= 0) || f.price.value === '') { f.price.focus(); return false; }
        await ctx.S.saveMenuItem(ctx.bid, { id: m.id, name: f.name.value || f.nameAr.value, nameAr: f.nameAr.value, price: f.price.value, category: f.category.value, description: f.description.value, image, available: f.available.checked, order: m.order });
        toast(t('saved')); return true;
      } },
    ] });
}
