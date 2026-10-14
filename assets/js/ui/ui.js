// Small UI toolkit: escaping, icons, toasts, dialogs, QR/barcodes, charts, files.
import { t, lang } from '../core/i18n.js';
import { ICON_PATHS } from './icons.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const on = (root, sel, ev, fn) => root.addEventListener(ev, (e) => { const el = e.target.closest(sel); if (el && root.contains(el)) fn(e, el); });

// ── Icons (24px stroke set) ─────────────────────────────
const P = ICON_PATHS;
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
