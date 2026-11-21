// How a set's weapon shoots in a run (the piece worn in the main hand): its shots take the set's
// colours, and a boomerang or a spear is the piece's own picture. See GEAR_SETS[set].shot.
import { SPR } from './assets.js';
import { ICON_ART } from './art.js';
import { GEAR_SETS, gearIcon } from '../content/gear.js';

// The hero weapons' shot sprites that take a set's colours (arrow, wand spark, pebble, boulder)
const TINTED = ['p_arrow', 'p_imp_fire', 'p_pebble', 'p_boulder'];
const BOOMERANG_PX = 13; // a flying boomerang's longest side, in world pixels
const made = {};

function hsl2rgb(h, s, l) {
  const k = (n) => (n + h * 12) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return [f(0), f(8), f(4)];
}
function hueSat(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  if (!d) return [0, 0];
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, d / (1 - Math.abs(2 * l - 1))];
}
// src recoloured: every pixel keeps its own shading and takes the tint's hue (a [hue 0..1, saturation]
// pair or a hex colour). lum > 0 lightens the lit parts (outlines stay dark), lum < 0 darkens it all.
function tinted(src, tint, lum = 0) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  const [h, s] = Array.isArray(tint) ? tint : hueSat(tint);
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    let l = (Math.max(d[i], d[i + 1], d[i + 2]) + Math.min(d[i], d[i + 1], d[i + 2])) / 510;
    l = lum > 0 ? l + (1 - l) * lum * Math.min(1, l / 0.3) : l * (1 + lum);
    [d[i], d[i + 1], d[i + 2]] = hsl2rgb(h, s, l);
  }
  g.putImageData(img, 0, 0);
  return c;
}

// The look of a set's weapon in a run, or null when the hero wears no set weapon (or their plain one):
// { spr: { base sprite -> its own sprite, or a list to cycle through }, trail, glow, slash, spear }.
export function shotSkin(set) {
  const sh = GEAR_SETS[set]?.shot;
  if (!sh) return null;
  if (made[set]) return made[set];
  const spr = {};
  if (sh.tint || sh.rainbow) {
    const tints = sh.rainbow ? [0, 1, 2, 3, 4, 5].map((i) => [i / 6, 0.85]) : [sh.tint];
    for (const id of TINTED) {
      const base = SPR[id];
      if (!base?.frames?.[0]) continue;
      const keys = tints.map((t, i) => { const key = `${id}@${set}${i || ''}`; SPR[key] = { ...base, frames: [tinted(base.frames[0], t, sh.lum)] }; return key; });
      spr[id] = keys.length > 1 ? keys : keys[0];
    }
  }
  const icon = sh.icon ? ICON_ART[gearIcon(set, 'main')] : null;
  if (icon) { // a boomerang flies as its own picture
    const c = icon.img, k = BOOMERANG_PX / Math.max(c.width, c.height);
    SPR[`p_boomerang@${set}`] = { w: c.width * k, h: c.height * k, ax: (c.width * k) / 2, ay: (c.height * k) / 2, frames: [c], png: true };
    spr.p_boomerang = `p_boomerang@${set}`;
  }
  return (made[set] = { set, spr, n: 0, trail: sh.trail || null, glow: sh.glow || null, slash: sh.slash || null, spear: icon ? icon.full : null });
}
