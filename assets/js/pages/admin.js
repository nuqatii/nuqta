// Platform admin: tenants, plans, suspension, usage. Aggregates only — never customer PII.
import { getService } from '../data/index.js';
import { t, setLang, lang, appName, fmtNum, fmtMoney, ago, fmtDate } from '../core/i18n.js';
import { DAY } from '../core/loyalty.js';
import { esc, icon, $, showError, toast, confirmBox } from '../ui/ui.js';

const S = await getService();
const root = document.getElementById('root');
const PLANS = ['free', 'starter', 'professional', 'enterprise'];

async function render() {
  if (!S.auth.current()) return location.replace('index.html?next=admin.html');
  if (!(await S.isPlatformAdmin())) { root.className = 'center-load'; root.innerHTML = `<div class="empty">${icon('shield')}<p>${t('ad_not_admin')}</p><a class="btn" href="app.html">${t('back')}</a></div>`; return; }
  const [list, settings] = await Promise.all([S.adminListBusinesses(), S.adminSettings()]);
  const tot = (k) => list.reduce((s, b) => s + (b[k] || 0), 0);
  const active = list.filter((b) => b.status === 'active').length;
  const fresh = list.filter((b) => b.createdAt > Date.now() - 30 * DAY).length;
  document.title = t('ad_title');
  root.className = '';
  root.innerHTML = `${S.mode === 'demo' ? `<div class="demo-bar">${t('demo_banner')}</div>` : ''}
  <main class="page" style="margin-inline:auto">
    <div class="page-head"><div><div class="brandmark" style="padding:0 0 8px"><span class="dot"></span>${esc(appName())}</div><h1>${t('ad_title')}</h1><p>${t('ad_privacy')}</p></div>
      <div class="actions"><button class="btn ghost" id="lang">${icon('globe')}${t('switch_lang')}</button><button class="btn" id="out">${icon('out')}${t('nav_signout')}</button></div></div>
    <section class="kpis">
      <div class="kpi"><div class="l">${t('ad_businesses')}</div><div class="v">${fmtNum(list.length)}</div><div class="d muted">${fmtNum(active)} ${t('ad_active')}</div></div>
      <div class="kpi"><div class="l">${t('ad_new')}</div><div class="v">${fmtNum(fresh)}</div></div>
      <div class="kpi"><div class="l">${t('ad_customers')}</div><div class="v">${fmtNum(tot('statCustomers'))}</div></div>
      <div class="kpi"><div class="l">${t('ad_txns')}</div><div class="v">${fmtNum(tot('statTxns'))}</div></div>
      <div class="kpi"><div class="l">${t('ad_redeemed')}</div><div class="v">${fmtNum(tot('statRedeemed'))}</div></div>
    </section>
    <section class="panel"><div class="panel-h"><h2>${t('ad_businesses')}</h2></div><div class="table-wrap" style="margin-top:12px"><table class="tbl"><thead><tr>
      <th>${t('col_business')}</th><th class="hide-sm">${t('col_type')}</th><th>${t('ad_plan')}</th><th>${t('status')}</th><th class="r">${t('k_customers')}</th><th class="r hide-sm">${t('ad_txns')}</th><th class="hide-sm">${t('ad_last_active')}</th><th></th></tr></thead><tbody>
      ${list.map((b) => `<tr style="cursor:default"><td><div class="row">${b.logo ? `<img src="${esc(b.logo)}" style="width:32px;height:32px;border-radius:8px" alt="">` : `<span class="av sq">${esc(b.name[0])}</span>`}<div><div style="font-weight:500">${esc(b.name)}</div><div class="small muted ltr">/${esc(b.slug)} · ${fmtDate(b.createdAt)}</div></div></div></td>
        <td class="hide-sm">${t('bt_' + b.type)}</td>
        <td><select class="input" data-plan="${b.id}" style="min-height:34px;width:auto">${PLANS.map((p) => `<option value="${p}" ${b.plan === p ? 'selected' : ''}>${t('plan_' + p)}</option>`).join('')}</select></td>
        <td><span class="chip ${b.status === 'active' ? 'ok' : 'bad'}">${b.status === 'active' ? t('ad_active') : t('ad_suspended')}</span></td>
        <td class="r num">${fmtNum(b.statCustomers || 0)}</td><td class="r num hide-sm">${fmtNum(b.statTxns || 0)}</td>
        <td class="hide-sm small muted">${ago(b.lastActivityAt)}</td>
        <td><button class="btn sm ${b.status === 'active' ? 'danger' : ''}" data-status="${b.id}" data-to="${b.status === 'active' ? 'suspended' : 'active'}">${b.status === 'active' ? t('ad_suspend') : t('ad_reactivate')}</button></td></tr>`).join('')}
    </tbody></table></div></section>
    <div class="cols" style="margin-top:16px">
      <section class="panel c6"><div class="panel-h"><h2>${t('ad_settings')}</h2></div><div class="panel-b"><form class="form" id="ps">
        <label class="check"><input type="checkbox" name="signupsOpen" ${settings.signupsOpen ? 'checked' : ''}><span>${t('ad_signups')}</span></label>
        <label class="field"><span>${t('ad_announcement')}</span><textarea class="input" name="announcement" maxlength="300">${esc(settings.announcement || '')}</textarea></label>
        <div><button class="btn primary" type="submit">${t('save')}</button></div></form></div></section>
      <section class="panel c6"><div class="panel-h"><h2>${t('ad_health')}</h2></div><div class="panel-b"><ul class="list">
        <li><span class="grow small muted">${t('ad_mode')}</span><span class="chip ${S.mode === 'firebase' ? 'ok' : 'warn'}">${S.mode === 'firebase' ? 'Firebase' : 'Demo (localStorage)'}</span></li>
        <li><span class="grow small muted">${t('ad_revenue_all')}</span><span class="num">${fmtMoney(tot('statRevenue'), 'SYP')}</span></li>
        <li><span class="grow small muted">${t('ad_points_all')}</span><span class="num">${fmtNum(tot('statPoints'))}</span></li>
        <li><span class="grow small muted">${lang === 'ar' ? 'أنشطة مدفوعة' : 'Paying businesses'}</span><span class="num">${fmtNum(list.filter((b) => b.plan !== 'free').length)}</span></li>
      </ul></div></section>
    </div>
  </main>`;
  $('#lang').onclick = () => { setLang(lang === 'ar' ? 'en' : 'ar'); render(); };
  $('#out').onclick = async () => { await S.signOut(); location.replace('index.html'); };
  root.querySelectorAll('[data-plan]').forEach((x) => (x.onchange = async () => { try { await S.adminSetPlan(x.dataset.plan, x.value); toast(t('saved')); } catch (e) { showError(e); } }));
  root.querySelectorAll('[data-status]').forEach((x) => (x.onclick = async () => {
    const b = list.find((y) => y.id === x.dataset.status);
    if (x.dataset.to === 'suspended' && !(await confirmBox(t('ad_suspend'), b.name, t('ad_suspend'), 'danger'))) return;
    try { await S.adminSetStatus(b.id, x.dataset.to); render(); } catch (e) { showError(e); }
  }));
  $('#ps').onsubmit = async (e) => { e.preventDefault(); try { await S.adminSaveSettings({ signupsOpen: e.target.signupsOpen.checked, announcement: e.target.announcement.value }); toast(t('saved')); } catch (err) { showError(err); } };
}
render().catch(showError);
