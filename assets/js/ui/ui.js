// Small UI toolkit: escaping, icons, toasts, dialogs, QR/barcodes, charts, files.
import { t, lang } from '../core/i18n.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const on = (root, sel, ev, fn) => root.addEventListener(ev, (e) => { const el = e.target.closest(sel); if (el && root.contains(el)) fn(e, el); });

// ── Icons (24px stroke set) ─────────────────────────────
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M7 12h10"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.7.8 2.8 2.5 3 5.2"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
  gift: '<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7M12 8v13"/><path d="M12 8C10 4 6.5 4 6.5 6.2S9.5 8 12 8c2.5 0 5.5 0 5.5-1.8S14 4 12 8z"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2 0-1.3-1-1.5-1-2.7 0-1.1.9-2 2-2h2.3A3.7 3.7 0 0 0 21 10.6C21 6.3 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10.5" cy="7" r="1.2"/><circle cx="15.5" cy="7.5" r="1.2"/>',
  pie: '<path d="M12 3v9h9"/><path d="M21 12a9 9 0 1 1-9-9"/>',
  send: '<path d="m21 3-9.5 9.5M21 3l-6.5 18-3-8.5L3 9.5z"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="m8 15 4-5 3 3 5-6"/>',
  pin: '<path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  team: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.2 4-6.5 8-6.5s7.2 2.3 8 6.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4h-4"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  back: '<path d="m15 6-6 6 6 6"/>',
  out: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18M7 15h4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.2 4-6.5 8-6.5s7.2 2.3 8 6.5"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  pizza: '<path d="M12 3 3.5 19.5C6 21 9 21.8 12 21.8s6-.8 8.5-2.3z"/><path d="M5 16.5c2.2 1 4.6 1.5 7 1.5s4.8-.5 7-1.5"/><circle cx="11" cy="10.5" r="1.2"/><circle cx="13.5" cy="14" r="1.2"/>',
  coffee: '<path d="M4 9h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.6 7.6 20 18M8.6 16.4 20 6"/>',
  dumbbell: '<path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12"/>',
  bag: '<path d="M5 8h14l-1 12.5a1 1 0 0 1-1 .5H7a1 1 0 0 1-1-.5z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  heart: '<path d="M12 20s-7.5-4.6-9-9.4C1.9 7 4.2 4 7.4 4c2 0 3.6 1.1 4.6 2.7C13 5.1 14.6 4 16.6 4c3.2 0 5.5 3 4.4 6.6C19.5 15.4 12 20 12 20z"/>',
  leaf: '<path d="M5 19C5 10 10 5 20 4c-.5 9.5-5.5 15-13 15H5z"/><path d="M5 19c3-4 6-6.5 10-8"/>',
  sparkle: '<path d="M12 3c.6 4.2 2.4 6.3 6.5 7-4.1.7-5.9 2.8-6.5 7-.6-4.2-2.4-6.3-6.5-7 4.1-.7 5.9-2.8 6.5-7zM19 15c.3 1.8 1 2.6 2.5 3-1.5.4-2.2 1.2-2.5 3-.3-1.8-1-2.6-2.5-3 1.5-.4 2.2-1.2 2.5-3z"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  dl: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  whatsapp: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-1.9-1-1 .8a4 4 0 0 1-2.2-2.2l.8-1-1-1.9z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8M15 7h6v6"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z"/>',
  building: '<path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  minus: '<path d="M5 12h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
};
export const ICONS = P;
export const icon = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.star}</svg>`;
export const CARD_ICONS = ['star', 'pizza', 'coffee', 'scissors', 'dumbbell', 'bag', 'heart', 'leaf', 'sparkle', 'gift'];

// ── Feedback ────────────────────────────────────────────
export function toast(msg, kind = '') {
  let box = $('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.append(box); }
  const el = document.createElement('div'); el.className = 'toast ' + kind; el.textContent = msg; box.append(el);
  setTimeout(() => el.remove(), kind === 'bad' ? 5200 : 2800);
}
export function errText(e) {
  const code = e?.code || e?.message || '';
  const k = 'err_' + code;
  const s = t(k);
  if (s !== k) return s;
  if (String(code).includes('permission')) return t('err_permission-denied');
  return t('err_generic', { msg: e?.message || code });
}
export const showError = (e) => { console.error(e); toast(errText(e), 'bad'); };

// modal({ title, body (html), wide, actions:[{label, kind, value}], onMount(el, close) }) → Promise<value>
export function modal({ title, body, wide, actions = [], onMount }) {
  return new Promise((resolve) => {
    const back = document.createElement('div'); back.className = 'modal-back';
    back.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-h"><h2>${esc(title)}</h2><button class="btn ghost icon" data-x aria-label="${t('close')}">${icon('x')}</button></div>
      <div class="modal-b">${body}</div>
      ${actions.length ? `<div class="modal-f">${actions.map((a, i) => `<button class="btn ${a.kind || ''}" data-a="${i}" ${a.type === 'submit' ? 'type="submit"' : ''}>${esc(a.label)}</button>`).join('')}</div>` : ''}</div>`;
    const prev = document.activeElement;
    const close = (v) => { back.remove(); document.removeEventListener('keydown', key); prev?.focus?.(); resolve(v); };
    const key = (e) => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', key);
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(null); });
    back.querySelector('[data-x]').onclick = () => close(null);
    back.querySelectorAll('[data-a]').forEach((b) => (b.onclick = async () => {
      const a = actions[+b.dataset.a];
      if (a.onClick) {
        b.disabled = true;
        try { const v = await a.onClick(back); if (v !== false) close(v ?? a.value); } catch (err) { showError(err); } finally { b.disabled = false; }
      } else close(a.value);
    }));
    document.body.append(back);
    onMount?.(back, close);
    (back.querySelector('[autofocus]') || back.querySelector('input,select,textarea,button:not([data-x])'))?.focus();
  });
}
export const confirmBox = (title, text, okLabel = t('confirm'), kind = 'primary') =>
  modal({ title, body: `<p>${esc(text)}</p>`, actions: [{ label: t('cancel'), value: false }, { label: okLabel, kind, value: true }] });

// ── Formatting helpers ──────────────────────────────────
export const initials = (a = '', b = '') => ((a.trim()[0] || '') + (b.trim()[0] || '')).toUpperCase() || '·';
export function avatar(c, extra = '') {
  const hue = [...(c.phone || c.id || 'x')].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
  return `<span class="av ${extra}" style="background:hsl(${hue} 45% 92%);color:hsl(${hue} 40% 30%)">${esc(initials(c.firstName, c.lastName))}</span>`;
}
export const fullName = (c) => [c?.firstName, c?.lastName].filter(Boolean).join(' ');

// ── QR & barcode ────────────────────────────────────────
export function qrSvg(text, { margin = 0, color = '#1D2433' } = {}) {
  const q = window.qrcode(0, 'M'); q.addData(String(text)); q.make();
  const n = q.getModuleCount(); const s = n + margin * 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + margin} ${r + margin}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" shape-rendering="crispEdges"><rect width="${s}" height="${s}" fill="#fff"/><path d="${d}" fill="${color}"/></svg>`;
}
export function barcodeSvg(text) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  try { window.JsBarcode(svg, String(text), { format: 'CODE128', displayValue: false, margin: 0, height: 70, width: 2 }); }
  catch { return ''; }
  svg.setAttribute('preserveAspectRatio', 'none');
  return svg.outerHTML;
}

// ── Charts (plain SVG, theme-aware) ─────────────────────
// lineChart([{label, value}], {h, money}) — area + line, sparse labels.
export function lineChart(points, { h = 180, color = 'var(--brand)', fmt = (v) => v } = {}) {
  if (!points.length) return '';
  const W = 600, H = h, pl = 44, pr = 10, pt = 10, pb = 26;
  const max = Math.max(1, ...points.map((p) => p.value)); const nice = niceMax(max);
  const x = (i) => pl + (i * (W - pl - pr)) / Math.max(1, points.length - 1);
  const y = (v) => pt + (H - pt - pb) * (1 - v / nice);
  const rtl = lang === 'ar';
  const X = (i) => (rtl ? W - x(i) + pl - pr : x(i));
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join('');
  const area = `${line}L${X(points.length - 1).toFixed(1)} ${H - pb}L${X(0).toFixed(1)} ${H - pb}Z`;
  const ticks = [0, nice / 2, nice];
  const every = Math.ceil(points.length / 6);
  const yLabelX = rtl ? W - 4 : 4;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">
    ${ticks.map((v) => `<line class="grid" x1="${rtl ? pr : pl}" x2="${rtl ? W - pl : W - pr}" y1="${y(v)}" y2="${y(v)}"/><text x="${yLabelX}" y="${y(v) + 4}" text-anchor="${rtl ? 'end' : 'start'}">${esc(fmt(v))}</text>`).join('')}
    <path d="${area}" fill="${color}" opacity=".1"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
    ${points.map((p, i) => (i % every === 0 || i === points.length - 1 ? `<text x="${X(i)}" y="${H - 6}" text-anchor="middle">${esc(p.label)}</text>` : '')).join('')}
    <circle cx="${X(points.length - 1)}" cy="${y(points[points.length - 1].value)}" r="4" fill="${color}"/>
  </svg>`;
}
export function barChart(points, { h = 180, color = 'var(--brand)', fmt = (v) => v, highlightLast = true } = {}) {
  if (!points.length) return '';
  const W = 600, H = h, pl = 44, pr = 6, pt = 10, pb = 26;
  const nice = niceMax(Math.max(1, ...points.map((p) => p.value)));
  const rtl = lang === 'ar';
  const bw = (W - pl - pr) / points.length;
  const y = (v) => pt + (H - pt - pb) * (1 - v / nice);
  const X = (i) => { const x0 = pl + i * bw; return rtl ? W - x0 - bw + pl - pr : x0; };
  const every = Math.ceil(points.length / 7);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">
    ${[0, nice / 2, nice].map((v) => `<line class="grid" x1="${rtl ? pr : pl}" x2="${rtl ? W - pl : W - pr}" y1="${y(v)}" y2="${y(v)}"/><text x="${rtl ? W - 4 : 4}" y="${y(v) + 4}" text-anchor="${rtl ? 'end' : 'start'}">${esc(fmt(v))}</text>`).join('')}
    ${points.map((p, i) => `<rect x="${(X(i) + bw * 0.18).toFixed(1)}" y="${y(p.value).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${Math.max(0, H - pb - y(p.value)).toFixed(1)}" rx="3" fill="${color}" opacity="${highlightLast && i !== points.length - 1 ? 0.55 : 1}"><title>${esc(p.label)}: ${esc(fmt(p.value))}</title></rect>`).join('')}
    ${points.map((p, i) => (i % every === 0 ? `<text x="${X(i) + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(p.label)}</text>` : '')).join('')}
  </svg>`;
}
function niceMax(v) { const p = Math.pow(10, Math.floor(Math.log10(v))); const m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
export const compact = (n) => new Intl.NumberFormat(lang === 'ar' ? 'ar-SY-u-nu-latn' : 'en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
export function hbars(rows, { fmt = (v) => v } = {}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return `<div class="bars">${rows.map((r) => `<div class="bar-row"><span class="nowrap" style="overflow:hidden;text-overflow:ellipsis">${r.label}</span><div class="track"><div class="fill" style="width:${(r.value / max) * 100}%;${r.color ? `background:${r.color}` : ''}"></div></div><span class="num small">${esc(fmt(r.value))}</span></div>`).join('')}</div>`;
}

// ── Files ───────────────────────────────────────────────
export function download(name, content, type = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export function toCSV(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const q = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => q(r[c])).join(','))].join('\n');
}
// Downscale an uploaded image to a small square-ish data URL (keeps Firestore docs small, no Storage needed).
export function readImage(file, max = 256) {
  return new Promise((res, rej) => {
    if (!file || !file.type.startsWith('image/')) return rej(new Error('Not an image'));
    const img = new Image(); const r = new FileReader();
    r.onload = () => { img.src = r.result; }; r.onerror = rej;
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL(file.type === 'image/png' || file.type === 'image/svg+xml' ? 'image/png' : 'image/jpeg', 0.86));
    };
    img.onerror = rej; r.readAsDataURL(file);
  });
}
export async function svgToPng(svg, size = 1024) {
  const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, size, size);
  return new Promise((r) => c.toBlob(r, 'image/png'));
}
export async function copyText(s) { try { await navigator.clipboard.writeText(s); toast(t('copied')); } catch { prompt('', s); } }
// Links to the legal pages, opened in a new tab so nobody loses what they were typing.
export const legalLink = (kind) => `<a href="${kind}.html?lang=${lang}" target="_blank" rel="noopener">${t(kind === 'terms' ? 'legal_terms' : 'legal_privacy')}</a>`;
export const legalLinks = () => `<div class="legal-links">${legalLink('privacy')}${legalLink('terms')}</div>`;
export const waLink = (phone, text) => `https://wa.me/${String(phone || '').replace(/[^\d]/g, '')}?text=${encodeURIComponent(text)}`;
