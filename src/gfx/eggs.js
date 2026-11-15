// Survivalmon eggs, all drawn on the same egg shape. Every type has its own patterned shell
// (icons/egg_<type>.png) and every mixed breed has an egg of its own that blends its two types
// (icons/egg_<species>.png). icons/egg.png is the confetti egg for eggs not yet in the Hatchery.
import { ICON_ART } from './art.js';
import { SPECIES, MIXED_IDS } from '../content/species.js';

export const EGG_TYPES = ['fire', 'water', 'grass', 'storm', 'rock', 'fairy', 'shadow'];
export const EGG_ICONS = [...EGG_TYPES, ...MIXED_IDS].map((t) => `egg_${t}`);
export const EGG_SIZE = 32;
// The row the shell splits at when it hatches, per column: a zigzag across the middle of the egg
export const seamY = (x) => 14 + Math.abs((x % 6) - 3);

const urls = new Map();
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
// Shell pixels (not the dark outline)
const isShell = (d, i) => d[i + 3] > 200 && (d[i] + d[i + 1] + d[i + 2]) / 3 > 90;

// Which egg picture a species hatches from: its own, else its type's, else the confetti egg
const eggKey = (species) => {
  if (ICON_ART[`egg_${species}`]) return `egg_${species}`;
  const t = SPECIES[species]?.types?.[0];
  return t && ICON_ART[`egg_${t}`] ? `egg_${t}` : 'egg';
};

// 32x32 canvas of the egg a species hatches from
export function eggCanvas(species) { return ICON_ART[eggKey(species)]?.full || null; }

// Data URL of a species' egg at a whole-number scale (crisp pixels in the DOM)
export function eggURL(species, scale = 2) {
  const src = eggCanvas(species);
  if (!src) return '';
  const key = `${eggKey(species)}:${scale}`;
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
