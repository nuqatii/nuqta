// Draws the stamp grid shown on the Google Wallet pass (Google has no stamp layout of its own).
// Same look as the web card: filled circles with the business icon, dashed empty circles, gift at the end.
import { ICON_PATHS } from './shared/icons.js';

export const HERO_W = 1032;
export const HERO_H = 336;

const hex = (c, f) => (/^#[0-9a-fA-F]{6}$/.test(c || '') ? c : f);

// Returns the SVG markup. No text is drawn (the server has no fonts); the count is on the pass itself.
export function stampsSvg({ business, progress, goal, ready }) {
  const bg = hex(business.colors?.bg, '#0F6E5C');
  const accent = hex(business.colors?.secondary, '#E8A33D');
  const ink = hex(business.colors?.text, '#FFFFFF');
  const iconPath = ICON_PATHS[business.design?.icon] || ICON_PATHS.star;
  const cells = goal + 1;                                  // stamps + the gift circle
  const rows = cells <= 7 ? 1 : 2;
  const cols = Math.ceil(cells / rows);
  const padX = 48, padY = 40, gap = 18;
  const d = Math.min((HERO_W - padX * 2 - gap * (cols - 1)) / cols, (HERO_H - padY * 2 - gap * (rows - 1)) / rows, 132);
  const r = d / 2;
  const gridW = cols * d + (cols - 1) * gap;
  const gridH = rows * d + (rows - 1) * gap;
  const x0 = (HERO_W - gridW) / 2;
  const y0 = (HERO_H - gridH) / 2;
  const glyph = (cx, cy, size, path, color, sw = 1.8) => {
    const s = size / 24;
    return `<g transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${s})" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${path}</g>`;
  };
  let out = '';
  for (let i = 0; i < cells; i++) {
    const row = Math.floor(i / cols), col = i % cols;
    const cx = x0 + col * (d + gap) + r, cy = y0 + row * (d + gap) + r;
    if (i === goal) {
      const on = ready > 0;
      out += `<circle cx="${cx}" cy="${cy}" r="${r - 2}" fill="${on ? accent : 'none'}" stroke="${ink}" stroke-opacity="${on ? 1 : 0.6}" stroke-width="${on ? 5 : 3}"/>`;
      out += glyph(cx, cy, d * 0.5, ICON_PATHS.gift, on ? bg : ink, 1.8);
    } else if (i < progress) {
      out += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${accent}"/>`;
      out += glyph(cx, cy, d * 0.55, iconPath, bg, 2);
    } else {
      out += `<circle cx="${cx}" cy="${cy}" r="${r - 2}" fill="none" stroke="${ink}" stroke-opacity="0.55" stroke-width="3" stroke-dasharray="${(d * 0.09).toFixed(1)} ${(d * 0.07).toFixed(1)}"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${HERO_W}" height="${HERO_H}" viewBox="0 0 ${HERO_W} ${HERO_H}"><rect width="100%" height="100%" fill="${bg}"/>${out}</svg>`;
}

export async function stampsPng(args) {
  const { Resvg } = await import('@resvg/resvg-js');
  return new Resvg(stampsSvg(args), { fitTo: { mode: 'original' } }).render().asPng();
}
