// Survivalmon eggs. Every type has its own patterned shell (icons/egg_<type>.png), all drawn on the
// same egg shape, so a mixed breed's egg can be split along a zigzag crack: the top half shows its
// first type and the bottom half its second. icons/egg.png is the plain "mystery" egg.
import { ICON_ART } from './art.js';
import { SPECIES } from '../content/species.js';

export const EGG_TYPES = ['fire', 'water', 'grass', 'storm', 'rock', 'fairy', 'shadow'];
export const EGG_ICONS = EGG_TYPES.map((t) => `egg_${t}`);
export const EGG_SIZE = 32;
// The row the shell splits at, per column: a zigzag across the middle of the egg
export const seamY = (x) => 14 + Math.abs((x % 6) - 3);

const shells = new Map(), urls = new Map();
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
// Shell pixels (not the dark outline)
const isShell = (d, i) => d[i + 3] > 200 && (d[i] + d[i + 1] + d[i + 2]) / 3 > 90;

// 32x32 canvas of the egg a species hatches from; the mystery egg when the species is unknown
export function eggCanvas(species) {
  const types = SPECIES[species]?.types || [];
  const key = types.join('+') || 'mystery';
  if (shells.has(key)) return shells.get(key);
  const top = ICON_ART[`egg_${types[0]}`]?.full || ICON_ART.egg?.full;
  if (!top) return null;
  const low = types[1] && types[1] !== types[0] ? ICON_ART[`egg_${types[1]}`]?.full : null;
  let out = top;
  if (low) {
    out = canvasOf(EGG_SIZE, EGG_SIZE);
    const g = out.getContext('2d');
    g.drawImage(top, 0, 0);
    const a = g.getImageData(0, 0, EGG_SIZE, EGG_SIZE);
    const lg = canvasOf(EGG_SIZE, EGG_SIZE).getContext('2d');
    lg.drawImage(low, 0, 0);
    const b = lg.getImageData(0, 0, EGG_SIZE, EGG_SIZE).data, d = a.data;
    for (let y = 0; y < EGG_SIZE; y++) for (let x = 0; x < EGG_SIZE; x++) {
      const s = seamY(x), i = (y * EGG_SIZE + x) * 4;
      if (y < s) continue;
      const line = y === s && isShell(d, i) && isShell(b, i);
      const k = line ? 0.55 : 1;
      d[i] = b[i] * k; d[i + 1] = b[i + 1] * k; d[i + 2] = b[i + 2] * k; d[i + 3] = b[i + 3];
    }
    g.putImageData(a, 0, 0);
  }
  shells.set(key, out);
  return out;
}

// Data URL of a species' egg at a whole-number scale (crisp pixels in the DOM)
export function eggURL(species, scale = 2) {
  const src = eggCanvas(species);
  if (!src) return '';
  const key = `${(SPECIES[species]?.types || []).join('+')}:${scale}`;
  if (urls.has(key)) return urls.get(key);
  const c = canvasOf(EGG_SIZE * scale, EGG_SIZE * scale), g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, c.width, c.height);
  const url = c.toDataURL();
  urls.set(key, url);
  return url;
}

// The two halves of an egg split along the seam, for the hatch animation
export function eggHalves(src) {
  const top = canvasOf(EGG_SIZE, EGG_SIZE), low = canvasOf(EGG_SIZE, EGG_SIZE);
  const tg = top.getContext('2d'), lg = low.getContext('2d');
  for (let x = 0; x < EGG_SIZE; x++) {
    const s = seamY(x);
    tg.drawImage(src, x, 0, 1, s, x, 0, 1, s);
    lg.drawImage(src, x, s, 1, EGG_SIZE - s, x, s, 1, EGG_SIZE - s);
  }
  return { top, low };
}

// Pixels of the crack that runs along the seam, inside the shell: ordered from the middle outward
// (so it spreads as the egg wobbles), with short jagged branches off its peaks and dips
export function crackPixels(src) {
  const d = src.getContext('2d').getImageData(0, 0, EGG_SIZE, EGG_SIZE).data, out = [];
  const shell = (x, y) => x >= 0 && y >= 0 && x < EGG_SIZE && y < EGG_SIZE && isShell(d, (y * EGG_SIZE + x) * 4);
  const cols = [];
  for (let x = 0; x < EGG_SIZE; x++) if (shell(x, seamY(x))) cols.push(x);
  cols.sort((a, b) => Math.abs(a - 15.5) - Math.abs(b - 15.5));
  for (const x of cols) {
    const y = seamY(x);
    out.push([x, y]);
    if (x % 6 === 3 && shell(x, y - 1)) { out.push([x, y - 1]); if (shell(x + 1, y - 2)) out.push([x + 1, y - 2]); }
    if (x % 6 === 0 && shell(x, y + 1)) { out.push([x, y + 1]); if (shell(x - 1, y + 2)) out.push([x - 1, y + 2]); }
  }
  return out;
}
