// Builds every procedural sprite once at boot and caches canvases by name.
// To replace a sprite with a hand-made PNG later, keep the same key & anchor.
import { PixelCanvas, col } from './pixel.js';
import { buildHeroSprite, buildPetSprite, HERO_LOOKS, PET_DRAW } from './sprites_chars.js';
import { MONSTER_DRAW } from './sprites_monsters.js';
import * as W from './sprites_world.js';
import { ICONS, PROJ } from './sprites_items.js';
import { ICON_ART } from './art.js';

export const SPR = {};     // generic sprites: { w,h,ax,ay, frames:[canvas], ... }
export const MON = {};     // monsters: { w,h,ax,ay, R,L,RF,LF,RE,LE }
export const HERO = {};
export const PET = {};
export const ICON = {};    // 16x16 canvases
export const PC = {};      // raw PixelCanvas for baking into other canvases
const urlCache = new Map();

function edgeRecolor(pc, color) {
  const p = pc.clone();
  const v = col(color);
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    if (!pc.isSet(x, y)) continue;
    if (!pc.isSet(x - 1, y) || !pc.isSet(x + 1, y) || !pc.isSet(x, y - 1) || !pc.isSet(x, y + 1)) p.data[y * p.w + x] = v;
  }
  return p;
}

function single(name, pc, ax, ay) {
  PC[name] = pc;
  SPR[name] = { w: pc.w, h: pc.h, ax: ax ?? Math.floor(pc.w / 2), ay: ay ?? pc.h - 1, frames: [pc.toCanvas()] };
}

export function buildAssets() {
  for (const id of Object.keys(HERO_LOOKS)) HERO[id] = buildHeroSprite(id);
  for (const id of Object.keys(PET_DRAW)) PET[id] = buildPetSprite(id);

  for (const [name, fn] of Object.entries(MONSTER_DRAW)) {
    const fr = fn();
    const w = fr[0].w, h = fr[0].h;
    const L = fr.map((f) => f.flipX());
    const elite = fr.map((f) => edgeRecolor(f, '#ffd84a'));
    MON[name] = {
      w, h, ax: Math.floor(w / 2), ay: h - 2,
      R: fr.map((f) => f.toCanvas()), L: L.map((f) => f.toCanvas()),
      RF: fr.map((f) => f.silhouette('#ffffff').toCanvas()), LF: L.map((f) => f.silhouette('#ffffff').toCanvas()),
      RE: elite.map((f) => f.toCanvas()), LE: elite.map((f) => f.flipX().toCanvas()),
    };
  }

  // Trees (several seeded variants)
  for (let i = 0; i < 4; i++) {
    single(`tree_green_${i}`, W.drawTree(100 + i, W.TREE_PALETTES.green), undefined, undefined);
    single(`tree_dark_${i}`, W.drawTree(200 + i, W.TREE_PALETTES.dark), undefined, undefined);
  }
  for (let i = 0; i < 2; i++) {
    single(`tree_autumn_${i}`, W.drawTree(300 + i, W.TREE_PALETTES.autumn));
    single(`tree_pink_${i}`, W.drawTree(400 + i, W.TREE_PALETTES.pink));
    single(`tree_big_${i}`, W.drawTree(500 + i, W.TREE_PALETTES.green, true));
    single(`pine_${i}`, W.drawPine(600 + i));
  }
  single('bush_0', W.drawBush(1)); single('bush_1', W.drawBush(2, true));

  // Buildings
  const houseVariants = [
    ['straw', '#d49a5c', false], ['straw', '#c8b48a', true], ['red', '#e0c8a0', true],
    ['blue', '#d4a87a', false], ['moss', '#b8885a', true], ['red', '#d49a5c', false],
  ];
  houseVariants.forEach(([roof, wall, chim], i) => single(`house_${i}`, W.drawHouse(roof, wall, 10 + i, chim)));
  single('barn', W.drawBarn());
  single('shrine', W.drawShrine());

  // Props
  single('fence_h', W.drawFenceH(), 8, 13);
  single('fence_v', W.drawFenceV(), 4, 19);
  single('hay', W.drawHay());
  single('crate', W.drawCrate()); single('crate_open', W.drawCrate(true));
  single('barrel', W.drawBarrel()); single('barrel_open', W.drawBarrel(true));
  single('pot', W.drawPot()); single('pot_broken', W.drawPot(true));
  single('rock', W.drawRock()); single('rock_big', W.drawRock(true));
  single('stump', W.drawStump());
  single('well', W.drawWell());
  single('lamp', W.drawLamp());
  single('sign', W.drawSign());
  single('cart', W.drawCart());

  // Ground decals (raw only, baked into ground)
  PC.flower_r = W.drawFlower('#f05a6a'); PC.flower_w = W.drawFlower('#ffffff');
  PC.flower_y = W.drawFlower('#ffd84a'); PC.flower_p = W.drawFlower('#c88aff'); PC.flower_b = W.drawFlower('#6ab0ff');
  PC.tuft = W.drawTuft('#4f9a3a', '#8fd65a'); PC.tuft_d = W.drawTuft('#3f8a32', '#6cc24e');
  for (const k of ['carrot', 'cabbage', 'wheat', 'pumpkin', 'sprout']) PC[`crop_${k}`] = W.drawCrop(k);
  for (let i = 0; i < 3; i++) PC[`lily_${i}`] = W.drawLilyPad(i);
  PC.rock_s = W.drawRock();

  // Interior furniture
  single('bed_r', W.drawBed('#d84a5a')); single('bed_b', W.drawBed('#4a74b8')); single('bed_g', W.drawBed('#4fa34a'));
  single('table', W.drawTable()); single('chair', W.drawChair());
  single('bookshelf', W.drawBookshelf(7)); single('bookshelf2', W.drawBookshelf(13));
  single('fireplace', W.drawFireplace()); single('cupboard', W.drawCupboard());
  single('plant', W.drawPlant()); single('stove', W.drawStove()); single('altar', W.drawAltar());
  single('clock', W.drawClock()); single('painting_0', W.drawPainting(0)); single('painting_1', W.drawPainting(1));
  for (const k of ['wood', 'silver', 'gold']) {
    single(`chest_${k}`, W.drawChest(k)); single(`chest_${k}_open`, W.drawChest(k, true));
  }
  PC.rug_r = W.drawRug(48, 30, '#b8443a'); PC.rug_b = W.drawRug(44, 28, '#3a6ab0'); PC.rug_g = W.drawRug(40, 26, '#4f8a3a');

  // Icons & projectiles
  for (const [k, fn] of Object.entries(ICONS)) { const pc = fn(); PC[`icon_${k}`] = pc; ICON[k] = pc.toCanvas(); }
  for (const [k, fn] of Object.entries(PROJ)) single(`p_${k}`, fn(), Math.floor(fn().w / 2), Math.floor(fn().h / 2));

  buildDigits();
}

// Data URL of an icon / hero / pet scaled up for crisp DOM display
export function iconURL(kind, id, scale = 3) {
  const key = `${kind}:${id}:${scale}`;
  if (urlCache.has(key)) return urlCache.get(key);
  if (kind === 'icon' && ICON_ART[id]) {
    // PixelLab icon fitted into the same 16*scale box the code icons used, so layouts keep their sizes
    const src = ICON_ART[id].full, n = 16 * scale, k = n / Math.max(src.width, src.height);
    const c = document.createElement('canvas'); c.width = c.height = n;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(src, Math.round((n - src.width * k) / 2), Math.round((n - src.height * k) / 2), Math.round(src.width * k), Math.round(src.height * k));
    const url = c.toDataURL();
    urlCache.set(key, url);
    return url;
  }
  let pc;
  if (kind === 'icon') pc = PC[`icon_${id}`];
  else if (kind === 'hero') pc = HERO[id].portrait;
  else if (kind === 'pet') pc = PET[id].portrait;
  else if (kind === 'mon') pc = MONSTER_DRAW[id]()[0];
  if (!pc) return '';
  const url = pc.scaled(scale).toCanvas().toDataURL();
  urlCache.set(key, url);
  return url;
}

// ---------------------------------------------------------------- bitmap digits
const DIG = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
  '111100111001111', '111100111101111', '111001001010010', '111101111101111', '111101111001111'];
export const DIGITS = {};
function buildDigits() {
  const colors = { white: '#ffffff', crit: '#ffd84a', hurt: '#ff5a5a', heal: '#7af08a', xp: '#7ad8ff', burn: '#ffa04a' };
  for (const [k, c] of Object.entries(colors)) {
    DIGITS[k] = DIG.map((pat) => {
      const p = new PixelCanvas(5, 7);
      for (let i = 0; i < 15; i++) if (pat[i] === '1') p.set(1 + (i % 3), 1 + Math.floor(i / 3), c);
      return p.outline('#2b1d24', true).toCanvas();
    });
  }
}
export function drawNumber(ctx, n, x, y, kind = 'white', scale = 1) {
  const s = String(Math.round(n));
  const glyphs = DIGITS[kind];
  const w = 4 * scale;
  let cx = Math.round(x - (s.length * w) / 2);
  for (const ch of s) {
    const g = glyphs[ch.charCodeAt(0) - 48];
    if (g) ctx.drawImage(g, cx, Math.round(y), 5 * scale, 7 * scale);
    cx += w;
  }
}
