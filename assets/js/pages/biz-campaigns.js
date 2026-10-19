import { t, fmtNum, fmtDate, ago, lang, tierName } from '../core/i18n.js';
import { renderTemplate, TEMPLATE_VARS, CAMPAIGN_CHANNELS, tierFor } from '../core/loyalty.js';
import { esc, icon, $, modal, showError, toast, confirmBox, download, toCSV, waLink } from '../ui/ui.js';
import { segmentMembers, segmentOptions, segmentLabel } from './biz-crm.js';
import { empty } from './biz-common.js';

export default async function campaigns(ctx, el) {
  const b = ctx.biz;
  const [list, customers, custom, templates] = await Promise.all([ctx.S.listCampaigns(ctx.bid), ctx.customers(), ctx.S.listSegments(ctx.bid).catch(() => []), ctx.S.listTemplates(ctx.bid)]);
  const tab = sessionStorage.getItem('nuqta_camp_tab') || 'list';

  el.innerHTML = `<div class="page-head"><div><h1>${t('cp_title')}</h1></div><div class="actions"><button class="btn primary" id="new">${icon('plus')}${t('cp_new')}</button></div></div>
    <div class="seg" style="margin-bottom:14px"><button data-tab="list" aria-pressed="${tab === 'list'}">${t('cp_title')}</button><button data-tab="tpl" aria-pressed="${tab === 'tpl'}">${t('cp_templates')}</button></div>
    <div id="body"></div>`;
  const body = $('#body', el);

  function drawList() {
    body.innerHTML = `<div class="note" style="margin-bottom:14px">${icon('info')}<span>${t('cp_note')}</span></div>
    <section class="panel"><div class="panel-b">${list.length ? `<ul class="list">${list.map((c) => `<li data-id="${c.id}" style="cursor:pointer">
      <span class="av sq" style="background:var(--brand-tint);color:var(--brand)">${icon(c.channel === 'gwallet' ? 'card' : c.channel === 'email' ? 'send' : 'whatsapp')}</span>
      <span class="grow"><span class="t">${esc(c.name)}</span><span class="s">${esc(segmentLabel(c.segment, custom))} · ${t('ch_' + c.channel)} · ${ago(c.createdAt)}</span></span>
      <span class="chip ${c.status === 'ready' || c.status === 'sent' ? 'ok' : ''}">${c.status === 'sent' ? t('gw_sent_chip', { n: fmtNum((c.walletSent || 0) + (c.walletSilent || 0)) }) : c.status === 'ready' ? t('cp_ready', { n: fmtNum(c.recipients) }) : t('cp_draft')}</span></li>`).join('')}</ul>` : empty(t('cp_empty'))}</div></section>`;
    body.querySelectorAll('[data-id]').forEach((li) => (li.onclick = () => editor(list.find((c) => c.id === li.dataset.id))));
  }
  function drawTemplates() {
    body.innerHTML = `<div class="note" style="margin-bottom:14px">${icon('info')}<span>${t('tp_hint')}</span></div>
    <div class="stack">${templates.map((tp) => `<section class="panel"><div class="panel-h"><h3>${t('tp_' + tp.id)}</h3>
      <label class="switch"><input type="checkbox" data-on="${tp.id}" ${tp.active ? 'checked' : ''} aria-label="${t('active')}"><i></i></label></div>
      <div class="panel-b stack" style="gap:8px"><textarea class="input" data-body="${tp.id}" rows="2">${esc(tp.body)}</textarea>
      <div class="spread"><span class="small muted">${esc(renderTemplate(tp.body, sampleVars(customers[0])))}</span><button class="btn sm" data-save="${tp.id}">${t('save')}</button></div></div></section>`).join('')}</div>`;
    body.querySelectorAll('[data-save]').forEach((x) => (x.onclick = async () => {
      const tp = templates.find((y) => y.id === x.dataset.save);
      tp.body = $(`[data-body="${tp.id}"]`, body).value; tp.active = $(`[data-on="${tp.id}"]`, body).checked;
      try { await ctx.S.saveTemplate(ctx.bid, tp); toast(t('saved')); drawTemplates(); } catch (e) { showError(e); }
    }));
    body.querySelectorAll('[data-on]').forEach((x) => (x.onchange = async () => {
      const tp = templates.find((y) => y.id === x.dataset.on); tp.active = x.checked;
      try { await ctx.S.saveTemplate(ctx.bid, tp); toast(t('saved')); } catch (e) { showError(e); }
    }));
  }
  const sampleVars = (c) => ({ first_name: c?.firstName || (lang === 'ar' ? 'مايا' : 'Maya'), business_name: b.name, points: fmtNum(c?.points || 320), tier: tierName(tierFor(b.tiers, c?.lifetimePoints || 0)), reward: lang === 'ar' ? 'حلوى مجانية' : 'Free dessert' });

  function editor(camp) {
    const preSeg = sessionStorage.getItem('nuqta_new_campaign_seg'); sessionStorage.removeItem('nuqta_new_campaign_seg');
    const c = camp ? { ...camp } : { name: '', segment: preSeg || 'auto_at_risk', channel: 'whatsapp', message: lang === 'ar' ? 'أهلاً {{first_name}}! ' : 'Hi {{first_name}}! ' };
    const group = () => segmentMembers(c.segment, customers, b.tiers, custom).filter((x) => x.marketingConsent);
    const audience = () => (c.channel === 'gwallet' ? group().filter((x) => x.walletGoogle) : group());
    const html = `<div class="form">
      <label class="field"><span>${t('cp_name')}</span><input class="input" id="cn" value="${esc(c.name)}" maxlength="80" autofocus></label>
      <div class="grid2"><label class="field"><span>${t('cp_segment')}</span><select class="input" id="cs">${segmentOptions(custom).map((g) => `<optgroup label="${esc(g.group)}">${g.items.map((i) => `<option value="${i.key}" ${i.key === c.segment ? 'selected' : ''}>${esc(i.label)}</option>`).join('')}</optgroup>`).join('')}</select></label>
      <label class="field"><span>${t('cp_channel')}</span><select class="input" id="cc">${CAMPAIGN_CHANNELS.map((ch) => `<option value="${ch}" ${ch === c.channel ? 'selected' : ''}>${t('ch_' + ch)}</option>`).join('')}</select></label></div>
      <p class="small"><b id="aud"></b></p>
      <div id="gwx" class="stack" style="gap:10px">
        <div class="note">${icon('info')}<span>${t('gw_camp_note')}</span></div>
        <label class="field"><span>${t('gw_title')}</span><input class="input" id="ch" value="${esc(c.header || b.name)}" maxlength="60"></label>
      </div>
      <label class="field"><span>${t('cp_message')}</span><textarea class="input" id="cm" maxlength="1000">${esc(c.message)}</textarea></label>
      <div class="row wrap"><span class="small muted">${t('cp_vars')}:</span>${TEMPLATE_VARS.map((v) => `<button type="button" class="chip" data-var="${v}">{{${v}}}</button>`).join('')}</div>
      <div class="note" style="flex-direction:column;gap:4px"><span class="small muted" id="pvl"></span><span id="pv" style="white-space:pre-wrap"></span></div>
    </div>`;
    const sync = (m) => { c.name = $('#cn', m).value; c.segment = $('#cs', m).value; c.channel = $('#cc', m).value; c.message = $('#cm', m).value; c.header = $('#ch', m).value; };
    const refresh = (m) => { sync(m); const a = audience(); $('#aud', m).textContent = c.channel === 'gwallet' ? t('gw_recipients', { n: fmtNum(a.length), all: fmtNum(group().length) }) : t('cp_recipients', { n: fmtNum(a.length) }); $('#gwx', m).hidden = c.channel !== 'gwallet'; const pb = m.querySelector('.modal-f .btn.primary'); if (pb) pb.textContent = c.channel === 'gwallet' ? t('gw_send') : t('cp_prepare'); $('#pvl', m).textContent = t('cp_preview', { name: a[0]?.firstName || '—' }); $('#pv', m).textContent = renderTemplate(c.message, sampleVars(a[0])); };
    modal({ title: camp ? c.name : t('cp_new'), wide: true, body: html,
      actions: [
        ...(camp ? [{ label: t('delete'), kind: 'danger ghost', onClick: async () => { if (!(await confirmBox(t('delete'), c.name, t('delete'), 'danger'))) return false; await ctx.S.deleteCampaign(ctx.bid, camp.id); return 'reload'; } }] : []),
        { label: t('save'), onClick: async (m) => { sync(m); if (!c.name.trim()) { $('#cn', m).focus(); return false; } await ctx.S.saveCampaign(ctx.bid, c); toast(t('saved')); return 'reload'; } },
        { label: t('cp_prepare'), kind: 'primary', onClick: async (m) => {
          sync(m); if (!c.name.trim()) { $('#cn', m).focus(); return false; }
          if (c.channel === 'gwallet') {
            const a = audience();
            if (!a.length) { toast(t('gw_none'), 'bad'); return false; }
            if (!(await confirmBox(t('gw_send'), t('gw_confirm', { n: fmtNum(a.length) }), t('gw_send')))) return false;
            const id = await ctx.S.saveCampaign(ctx.bid, c);
            const items = a.map((x) => ({ customerId: x.id, header: renderTemplate(c.header || b.name, sampleVars(x)), body: renderTemplate(c.message, sampleVars(x)) }));
            const r = await ctx.S.sendWalletCampaign(ctx.bid, id, items);
            return { wallet: r, name: c.name };
          }
          const id = await ctx.S.saveCampaign(ctx.bid, c);
          const rec = await ctx.S.prepareCampaign(ctx.bid, id, audience(), b);
          return { recipients: rec, name: c.name };
        } },
      ],
      onMount: (m) => {
        refresh(m);
        ['#cn', '#cs', '#cc', '#cm'].forEach((s) => ($(s, m).oninput = $(s, m).onchange = () => refresh(m)));
        m.querySelectorAll('[data-var]').forEach((x) => (x.onclick = () => { const ta = $('#cm', m); const p = ta.selectionStart ?? ta.value.length; ta.value = ta.value.slice(0, p) + `{{${x.dataset.var}}}` + ta.value.slice(p); ta.focus(); refresh(m); }));
      },
    }).then((v) => {
      if (v && v.wallet) { walletResult(v.name, v.wallet); campaigns(ctx, el); }
      else if (v && v.recipients) { recipientsDialog(v.name, v.recipients); campaigns(ctx, el); }
      else if (v === 'reload') campaigns(ctx, el);
    });
  }
  function walletResult(name, r) {
    modal({ title: name, body: `<ul class="list">
      <li><span class="grow"><span class="t">${t('gw_res_sent')}</span></span><b>${fmtNum(r.sent)}</b></li>
      ${r.silent ? `<li><span class="grow"><span class="t">${t('gw_res_silent')}</span></span><b>${fmtNum(r.silent)}</b></li>` : ''}
      ${r.notInWallet ? `<li><span class="grow"><span class="t">${t('gw_res_missing')}</span></span><b>${fmtNum(r.notInWallet)}</b></li>` : ''}
      ${r.failed ? `<li><span class="grow"><span class="t">${t('gw_res_failed')}</span></span><b>${fmtNum(r.failed)}</b></li>` : ''}</ul>`,
      actions: [{ label: t('done'), kind: 'primary', value: true }] });
  }
  function recipientsDialog(name, rec) {
    modal({ title: `${name} · ${fmtNum(rec.length)}`, wide: true,
      body: `<p class="small muted" style="margin-bottom:10px">${t('cp_note')}</p><ul class="list">${rec.slice(0, 300).map((r) => `<li><span class="grow"><span class="t">${esc(r.name)}</span><span class="s">${esc(r.text)}</span></span>
        <a class="btn sm" href="${esc(waLink(r.phone, r.text))}" target="_blank" rel="noopener">${icon('whatsapp')}${t('cp_open_wa')}</a></li>`).join('')}</ul>`,
      actions: [{ label: t('export_csv'), onClick: () => { download(`campaign-${Date.now()}.csv`, toCSV(rec.map((r) => ({ name: r.name, phone: r.phone, email: r.email, message: r.text }))), 'text/csv'); return false; } }, { label: t('done'), kind: 'primary', value: true }] });
  }

  el.querySelectorAll('[data-tab]').forEach((x) => (x.onclick = () => { sessionStorage.setItem('nuqta_camp_tab', x.dataset.tab); el.querySelectorAll('[data-tab]').forEach((y) => y.setAttribute('aria-pressed', y === x)); x.dataset.tab === 'tpl' ? drawTemplates() : drawList(); }));
  $('#new', el).onclick = () => editor();
  tab === 'tpl' ? drawTemplates() : drawList();
  if (sessionStorage.getItem('nuqta_new_campaign_seg')) editor();
}
