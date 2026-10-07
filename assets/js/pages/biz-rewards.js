import { t, fmtNum, fmtMoney, fmtDate, ago, unitWord, rewardName, lang, curLabel } from '../core/i18n.js';
import { rewardIsLive } from '../core/loyalty.js';
import { esc, icon, $, modal, showError, toast, confirmBox, readImage, avatar, fullName } from '../ui/ui.js';
import { empty, evName } from './biz-common.js';

export default async function rewards(ctx, el) {
  const b = ctx.biz; const unit = unitWord(b.program, b.currency);
  const [list, reds, customers] = await Promise.all([ctx.S.listRewards(ctx.bid), ctx.S.listRedemptions(ctx.bid).catch(() => []), ctx.customers()]);
  const byId = new Map(customers.map((c) => [c.id, c]));
  el.innerHTML = `<div class="page-head"><div><h1>${t('rw_title')}</h1><p>${fmtNum(list.filter((r) => rewardIsLive(r)).length)} ${t('active')}</p></div>
    <div class="actions"><button class="btn primary" id="add">${icon('plus')}${t('rw_add')}</button></div></div>
    <div class="cols">
      <section class="panel c7"><div class="panel-b">${list.length ? `<ul class="list">${list.map((r) => `<li>
        <span class="av sq" style="width:52px;height:52px;background:${r.image ? `url('${esc(r.image)}') center/cover` : 'var(--saffron-tint)'};color:#A66B12">${r.image ? '' : icon('gift')}</span>
        <span class="grow"><span class="t">${esc(rewardName(r))}</span>
          <span class="s">${fmtNum(r.cost)} ${esc(unit)}${r.value ? ' · ' + fmtMoney(r.value, b.currency) : ''} · ${t('times_redeemed', { n: fmtNum(r.redeemedCount || 0) })}${r.expiresAt ? ' · ' + t('rw_expires') + ' ' + fmtDate(r.expiresAt) : ''}</span></span>
        <label class="switch" title="${t('rw_on')}"><input type="checkbox" data-toggle="${r.id}" ${r.active ? 'checked' : ''} aria-label="${t('rw_on')}"><i></i></label>
        <button class="btn sm icon ghost" data-edit="${r.id}" aria-label="${t('edit')}">${icon('edit')}</button></li>`).join('')}</ul>` : empty(t('rw_empty'), `<button class="btn primary" data-add2>${icon('plus')}${t('rw_add')}</button>`)}</div></section>
      <section class="panel c5"><div class="panel-h"><h2>${t('rw_redemptions')}</h2></div><div class="panel-b"><ul class="list">
        ${reds.slice(0, 12).map((r) => { const c = byId.get(r.customerId) || { firstName: '?' }; return `<li>${avatar(c)}<span class="grow"><span class="t">${esc(evName(r))}</span><span class="s">${esc(fullName(c))} · ${ago(r.redeemedAt || r.createdAt)}</span></span><span class="chip ${r.status === 'redeemed' ? 'ok' : 'warn'}">${r.status === 'redeemed' ? t('done') : t('co_pending').split(' ')[0]}</span></li>`; }).join('') || `<li class="muted small">${t('no_data_yet')}</li>`}
      </ul></div></section>
    </div>`;
  const open = (r) => rewardDialog(ctx, r).then((ok) => ok && rewards(ctx, el));
  $('#add', el).onclick = () => open();
  el.querySelector('[data-add2]')?.addEventListener('click', () => open());
  el.querySelectorAll('[data-edit]').forEach((x) => (x.onclick = () => open(list.find((r) => r.id === x.dataset.edit))));
  el.querySelectorAll('[data-toggle]').forEach((x) => (x.onchange = async () => {
    const r = list.find((y) => y.id === x.dataset.toggle);
    try { await ctx.S.saveReward(ctx.bid, { ...r, active: x.checked }); r.active = x.checked; toast(t('saved')); } catch (e) { x.checked = !x.checked; showError(e); }
  }));
}

function rewardDialog(ctx, r = {}) {
  const b = ctx.biz; const unit = unitWord(b.program, b.currency);
  let image = r.image || null;
  const exp = r.expiresAt ? new Date(r.expiresAt).toISOString().slice(0, 10) : '';
  const body = `<form class="form" id="rf">
    <div class="grid2"><label class="field"><span>${t('rw_name')}</span><input class="input" name="name" required maxlength="60" value="${esc(r.name || '')}" autofocus></label>
    <label class="field"><span>${t('rw_name_ar')} <span class="muted">(${t('optional')})</span></span><input class="input" name="nameAr" maxlength="60" dir="rtl" value="${esc(r.nameAr || '')}"></label></div>
    <label class="field"><span>${t('rw_desc')} <span class="muted">(${t('optional')})</span></span><input class="input" name="description" maxlength="240" value="${esc(r.description || '')}"></label>
    <div class="grid2"><label class="field"><span>${t('rw_cost')} (${esc(unit)})</span><input class="input num" name="cost" inputmode="numeric" required value="${r.cost || ''}"></label>
    <label class="field"><span>${t('rw_value')} (${esc(curLabel(b.currency))}) <span class="muted">(${t('optional')})</span></span><input class="input num" name="value" inputmode="decimal" value="${r.value || ''}"></label></div>
    <div class="grid2"><label class="field"><span>${t('rw_expires')} <span class="muted">(${t('optional')})</span></span><input class="input" type="date" name="expiresAt" value="${exp}"></label>
    <label class="field"><span>${t('rw_limit')}</span><input class="input num" name="usageLimit" inputmode="numeric" value="${r.usageLimit || 0}"><small>${t('rw_limit_hint')}</small></label></div>
    <label class="field"><span>${t('rw_min')} (${esc(curLabel(b.currency))}) <span class="muted">(${t('optional')})</span></span><input class="input num" name="minPurchase" inputmode="decimal" value="${r.minPurchase || ''}"></label>
    <div class="row"><span class="av sq" id="img" style="width:52px;height:52px;background:${image ? `url('${esc(image)}') center/cover` : 'var(--sunken)'}"></span>
      <label class="btn sm">${icon('upload')}${t('rw_image')}<input type="file" accept="image/*" hidden id="imgf"></label></div>
    <label class="check"><input type="checkbox" name="active" ${r.active !== false ? 'checked' : ''}><span>${t('rw_on')}</span></label>
  </form>`;
  return modal({ title: r.id ? t('edit') : t('rw_add'), body, actions: [
    ...(r.id ? [{ label: t('delete'), kind: 'danger ghost', onClick: async () => { if (!(await confirmBox(t('delete'), rewardName(r), t('delete'), 'danger'))) return false; await ctx.S.deleteReward(ctx.bid, r.id); toast(t('deleted')); return true; } }] : []),
    { label: t('cancel'), value: false },
    { label: t('save'), kind: 'primary', onClick: async (m) => {
      const f = $('#rf', m);
      if (!f.name.value.trim()) { f.name.setAttribute('aria-invalid', 'true'); f.name.focus(); return false; }
      if (!(Number(f.cost.value) > 0)) { f.cost.setAttribute('aria-invalid', 'true'); f.cost.focus(); return false; }
      await ctx.S.saveReward(ctx.bid, { id: r.id, name: f.name.value, nameAr: f.nameAr.value, description: f.description.value, cost: f.cost.value, value: f.value.value,
        expiresAt: f.expiresAt.value ? new Date(f.expiresAt.value + 'T23:59:59').getTime() : null, usageLimit: f.usageLimit.value, minPurchase: f.minPurchase.value, active: f.active.checked, image });
      toast(t('rw_saved')); return true;
    } },
  ], onMount: (m) => { $('#imgf', m).onchange = async (e) => { try { image = await readImage(e.target.files[0], 320); $('#img', m).style.background = `url('${image}') center/cover`; } catch (err) { showError(err); } }; } });
}
