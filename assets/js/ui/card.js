// Digital loyalty card. Structured like a Wallet "storeCard" pass:
//   logo + organisation  → logoText
//   header field         → headerFields[0]  (points)
//   balance / stamps     → primaryFields / strip image
//   member · tier · no.  → secondaryFields
//   QR / barcode         → barcode (message = card.qrValue / card.barcodeValue)
// wallet.js (future) can build a pass from exactly the same data.
import { esc, icon, qrSvg, barcodeSvg } from './ui.js';
import { t, fmtNum, unitWord, tierName, programName } from '../core/i18n.js';
import { tierFor } from '../core/loyalty.js';

export function walletFields({ business, card }) {
  const tier = tierFor(business.tiers, card.lifetimePoints || 0);
  return {
    passTypeIdentifier: null, serialNumber: card.passId, organizationName: business.name,
    logoText: programName(business), backgroundColor: business.colors?.bg, foregroundColor: business.colors?.text,
    headerFields: [{ key: 'points', label: unitWord(business.program, business.currency), value: card.points || 0 }],
    secondaryFields: [{ key: 'member', label: t('c_member'), value: card.firstName }, { key: 'tier', label: t('tier'), value: tierName(tier) }],
    auxiliaryFields: [{ key: 'no', label: t('member_no'), value: card.memberNumber }],
    barcode: { format: business.design?.codeFormat === 'barcode' ? 'PKBarcodeFormatCode128' : 'PKBarcodeFormatQR', message: business.design?.codeFormat === 'barcode' ? card.barcodeValue : card.qrValue },
  };
}

export function renderCard({ business: b, card, rewardsReady = 0, mini = false, showCode = true, design, colors }) {
  const d = { style: 'gradient', layout: 'classic', icon: 'star', codeFormat: 'qr', ...(b.design || {}), ...(design || {}) };
  const c = { bg: '#0F6E5C', secondary: '#E8A33D', text: '#FFFFFF', ...(b.colors || {}), ...(colors || {}) };
  const tier = tierFor(b.tiers, card.lifetimePoints || 0);
  const isStampy = b.program?.type === 'stamps' || b.program?.type === 'visits';
  const layout = d.layout === 'stamps' && !isStampy ? 'classic' : d.layout;
  const unit = unitWord(b.program, b.currency);
  const logo = b.logo ? `<img src="${esc(b.logo)}" alt="">` : icon(d.icon);
  const vars = `--cb:${c.bg};--cs:${c.secondary};--ct:${d.style === 'minimal' ? '#1D2433' : c.text}`;

  let middle;
  if (layout === 'stamps') {
    const goal = Math.min(15, Math.max(4, b.program?.goal || 10));
    // Stamp balance shows as filled circles; the last cell is the reward, lit once it's earned.
    const filled = Math.min(goal, Math.max(0, card.points || 0));
    const cells = Array.from({ length: goal + 1 }, (_, i) => (i === goal
      ? `<span class="gift ${filled >= goal ? 'on' : ''}">${icon('gift')}</span>`
      : `<span class="${i < filled ? 'on' : ''}">${i < filled ? icon(d.icon) : ''}</span>`)).join('');
    const cols = goal + 1 <= 6 ? goal + 1 : Math.ceil((goal + 1) / 2);
    middle = `<div class="stamps" style="grid-template-columns:repeat(${cols},1fr)">${cells}</div>`;
  } else {
    middle = `<div class="balance"><span class="big">${fmtNum(card.points || 0)}</span><span class="unit">${esc(unit)}</span></div>`;
  }

  const code = d.codeFormat === 'barcode' ? `<div class="bc">${barcodeSvg(card.barcodeValue || card.memberNumber || '000000')}</div>` : `<div class="qr">${qrSvg(card.qrValue || 'NQ-PREVIEW')}</div>`;
  return `<article class="lcard st-${esc(d.style)} ly-${esc(layout)} ${mini ? 'mini' : ''}" style="${vars}" aria-label="${esc(programName(b))}">
    <div class="face">
      ${d.cover ? `<div class="cover" style="background-image:url('${esc(d.cover)}')"></div>` : ''}
      <div class="top">
        <div class="logo">${logo}</div>
        <div class="names"><b>${esc(programName(b))}</b>${programName(b) !== b.name ? `<small>${esc(b.name)}</small>` : ''}</div>
        ${layout === 'stamps' ? `<div class="hdr-field"><small>${esc(unit)}</small><b>${fmtNum(card.points || 0)}</b></div>` : ''}
      </div>
      ${middle}
      <div class="fields">
        <div><small>${t('c_member')}</small><b>${esc(card.firstName || '—')}</b></div>
        ${tier && (b.tiers || []).length > 1 ? `<div><small>${t('tier')}</small><b><span class="tier-b" style="--tc:${esc(tier.color)}"><i></i>${esc(tierName(tier))}</span></b></div>` : ''}
        <div style="margin-inline-start:auto;text-align:end"><small>${t('member_no')}</small><b class="ltr">${esc(card.memberNumber || '—')}</b></div>
      </div>
    </div>
    ${showCode ? `<div class="tear"></div><div class="code">${code}
      ${rewardsReady ? `<span class="rw">${t('c_rewards_count', { n: rewardsReady })}</span>` : `<small>${esc(card.memberNumber || '')}</small>`}</div>` : ''}
  </article>`;
}

export const sampleCard = (b, name = 'Maya') => ({
  firstName: name, points: b.program?.type === 'stamps' || b.program?.type === 'visits' ? Math.min(6, (b.program?.goal || 10) - 3) : 1250,
  lifetimePoints: (b.tiers || []).sort((x, y) => x.min - y.min)[Math.min(2, (b.tiers || []).length - 1)]?.min || 0,
  memberNumber: '100042', qrValue: 'NQ-PREVIEW', barcodeValue: '100042',
});
