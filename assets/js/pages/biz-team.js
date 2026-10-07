// Locations and Team (staff accounts with roles).
import { t, fmtDate, lang } from '../core/i18n.js';
import { esc, icon, $, modal, showError, toast, confirmBox } from '../ui/ui.js';

export default async function team(ctx, el, { page }) {
  return page === 'locations' ? locations(ctx, el) : staff(ctx, el);
}

async function locations(ctx, el) {
  const list = await ctx.S.listLocations(ctx.bid);
  el.innerHTML = `<div class="page-head"><div><h1>${t('lc_title')}</h1><p>${t('lc_hint')}</p></div><div class="actions"><button class="btn primary" id="add">${icon('plus')}${t('lc_add')}</button></div></div>
    <section class="panel"><div class="panel-b"><ul class="list">${list.map((l) => `<li><span class="av sq" style="background:var(--brand-tint);color:var(--brand)">${icon('pin')}</span>
      <span class="grow"><span class="t">${esc(l.name)}</span><span class="s">${esc(l.address || '—')}</span></span><button class="btn sm icon ghost" data-edit="${l.id}" aria-label="${t('edit')}">${icon('edit')}</button></li>`).join('')}</ul></div></section>`;
  const dlg = (l = {}) => modal({ title: l.id ? t('edit') : t('lc_add'),
    body: `<form class="form" id="lf"><label class="field"><span>${t('lc_name')}</span><input class="input" name="name" value="${esc(l.name || '')}" autofocus required></label>
      <label class="field"><span>${t('lc_address')}</span><input class="input" name="address" value="${esc(l.address || '')}"></label></form>`,
    actions: [
      ...(l.id && l.id !== 'main' ? [{ label: t('delete'), kind: 'danger ghost', onClick: async () => { if (!(await confirmBox(t('delete'), l.name, t('delete'), 'danger'))) return false; await ctx.S.deleteLocation(ctx.bid, l.id); return true; } }] : []),
      { label: t('cancel'), value: false },
      { label: t('save'), kind: 'primary', onClick: async (m) => { const f = $('#lf', m); if (!f.name.value.trim()) return false; await ctx.S.saveLocation(ctx.bid, { ...l, name: f.name.value, address: f.address.value }); toast(t('saved')); return true; } },
    ] }).then((ok) => ok && locations(ctx, el));
  $('#add', el).onclick = () => dlg();
  el.querySelectorAll('[data-edit]').forEach((x) => (x.onclick = () => dlg(list.find((l) => l.id === x.dataset.edit))));
}

async function staff(ctx, el) {
  const [members, invites] = await Promise.all([ctx.S.listMembers(ctx.bid), ctx.S.listInvites(ctx.bid)]);
  const roles = ['manager', 'staff', 'marketing'];
  el.innerHTML = `<div class="page-head"><div><h1>${t('sf_title')}</h1></div><div class="actions"><button class="btn primary" id="inv">${icon('plus')}${t('sf_invite')}</button></div></div>
  <div class="cols">
    <section class="panel c8"><div class="panel-b"><ul class="list">
      ${members.sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : 0)).map((m) => `<li><span class="av">${esc((m.name || m.email)[0].toUpperCase())}</span>
        <span class="grow"><span class="t">${esc(m.name || m.email)} ${m.uid === ctx.user.uid ? `<span class="muted small">(${t('sf_you')})</span>` : ''}</span><span class="s ltr">${esc(m.email)}</span></span>
        ${m.role === 'owner' ? `<span class="chip brand">${t('role_owner')}</span>` : `<select class="input" data-role="${m.uid}" style="width:auto;min-height:36px" aria-label="${t('sf_role')}">${roles.map((r) => `<option value="${r}" ${m.role === r ? 'selected' : ''}>${t('role_' + r)}</option>`).join('')}</select>
          <button class="btn sm icon ghost" data-rm="${m.uid}" aria-label="${t('sf_remove')}">${icon('x')}</button>`}</li>`).join('')}
      ${invites.map((i) => `<li><span class="av" style="background:var(--sunken);color:var(--muted)">${icon('clock')}</span><span class="grow"><span class="t">${esc(i.name || i.email)}</span><span class="s"><span class="ltr">${esc(i.email)}</span> · ${t('sf_pending')} ${fmtDate(i.createdAt)}</span></span>
        <span class="chip warn">${t('role_' + i.role)}</span><button class="btn sm icon ghost" data-revoke="${esc(i.email)}" aria-label="${t('delete')}">${icon('x')}</button></li>`).join('')}
    </ul></div></section>
    <section class="panel c4"><div class="panel-h"><h2>${t('sf_role')}</h2></div><div class="panel-b"><ul class="list">
      ${['owner', ...roles].map((r) => `<li><span class="grow"><span class="t">${t('role_' + r)}</span><span class="s" style="white-space:normal">${t('role_' + r + '_d')}</span></span></li>`).join('')}</ul></div></section>
  </div>`;
  el.querySelectorAll('[data-role]').forEach((x) => (x.onchange = async () => { try { await ctx.S.setMemberRole(ctx.bid, x.dataset.role, x.value); toast(t('saved')); } catch (e) { showError(e); } }));
  el.querySelectorAll('[data-rm]').forEach((x) => (x.onclick = async () => { if (await confirmBox(t('sf_remove'), members.find((m) => m.uid === x.dataset.rm)?.email || '', t('sf_remove'), 'danger')) { try { await ctx.S.removeMember(ctx.bid, x.dataset.rm); staff(ctx, el); } catch (e) { showError(e); } } }));
  el.querySelectorAll('[data-revoke]').forEach((x) => (x.onclick = async () => { try { await ctx.S.revokeInvite(ctx.bid, x.dataset.revoke); staff(ctx, el); } catch (e) { showError(e); } }));
  $('#inv', el).onclick = () => modal({ title: t('sf_invite'),
    body: `<form class="form" id="if"><p class="small muted">${t('sf_invite_hint')}</p>
      <label class="field"><span>${t('your_name').replace(lang === 'ar' ? 'اسمك' : 'Your name', lang === 'ar' ? 'الاسم' : 'Name')}</span><input class="input" name="name" autofocus></label>
      <label class="field"><span>${t('email')}</span><input class="input" name="email" type="email" dir="ltr" required></label>
      <div class="field"><span>${t('sf_role')}</span><div class="choice-grid" style="grid-template-columns:1fr">${roles.map((r, i) => `<label class="choice"><input type="radio" name="role" value="${r}" ${i === 1 ? 'checked' : ''}><b>${t('role_' + r)}</b><small>${t('role_' + r + '_d')}</small></label>`).join('')}</div></div></form>`,
    actions: [{ label: t('cancel'), value: false }, { label: t('sf_invite'), kind: 'primary', onClick: async (m) => {
      const f = $('#if', m); await ctx.S.inviteMember(ctx.bid, { email: f.email.value, role: f.role.value, name: f.name.value }); toast(t('sf_invited')); return true;
    } }] }).then((ok) => ok && staff(ctx, el));
}
