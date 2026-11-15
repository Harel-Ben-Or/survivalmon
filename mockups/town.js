// Town hub mockups: three layouts drawn with the game's own tiles, sprites and critters.
// Each layout is rendered whole (with name plaques) and as a phone-sized view around the hero;
// both are posted to the dev server's /__snapshot endpoint as PNGs.
import { buildAssets, SPR, PC } from '../src/gfx/assets.js';
import { loadArt, loadWorldArt, WS, CREATURE, HERO_ART, drawCreature, drawHero } from '../src/gfx/art.js';
import { TileGround } from '../src/world/tileground.js';
import { T, TILE } from '../src/world/world.js';
import { mulberry32 } from '../src/core/util.js';

const BASE = '../assets/sprites';
const TOWN_ART = ['gate', 'dummy', 'clinic', 'workshop', 'training', 'nursery', 'library'];
const FALLBACK = { gate: 'shrine', dummy: 'stump', clinic: 'house_1', workshop: 'house_2', training: 'house_3', nursery: 'barn', library: 'shrine' };
const PHONE = { w: 422, h: 195 }; // logical view of a landscape phone in the game

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
// Sprite cropped to its pixels, anchored bottom-centre like the world sprites.
function spriteOf(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (d[(y * c.width + x) * 4 + 3] < 8) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return { w: out.width / WS, h: out.height / WS, ax: out.width / WS / 2, ay: out.height / WS, frames: [out] };
}

// ---------------------------------------------------------------- a hand-laid town map
class Town {
  constructor(w, h, seed) {
    this.w = w; this.h = h; this.pw = w * TILE; this.ph = h * TILE;
    this.tiles = new Uint8Array(w * h);
    this.baked = []; this.bakedTall = []; this.shadows = []; this.objects = []; this.mons = []; this.labels = [];
    this.rng = mulberry32(seed);
  }
  r() { return this.rng(); }
  tileAt(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.tiles[y * this.w + x] : T.DARK; }
  set(x, y, t) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.tiles[y * this.w + x] = t; }
  rect(t, x0, y0, x1, y1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, t); }
  disc(t, cx, cy, r) { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if (Math.hypot(x - cx, y - cy) <= r) this.set(x, y, t); }
  obj(spr, x, y, sortY = y) { if (SPR[spr]) this.objects.push({ spr, x, y, sortY }); }
  // A building whose door sits on tile (dx, dy); its sprite's bottom edge lines up with that tile.
  building(spr, dx, dy, name) {
    const s = SPR[spr], x = dx * TILE + 8, y = dy * TILE + 4;
    this.objects.push({ spr, x, y, sortY: y });
    this.shadows.push({ x, y: y - 2, rx: s.w * 0.42, ry: 5 });
    if (name) this.labels.push({ name, x, y: y - s.h - 3 });
    return { x, y };
  }
  fenceRect(x0, y0, x1, y1, gaps = []) {
    const gap = (x, y) => gaps.some(([gx, gy]) => gx === x && gy === y);
    for (let x = x0; x <= x1; x++) for (const y of [y0, y1]) if (!gap(x, y)) this.obj('fence_h', x * TILE + 8, y * TILE + 13);
    for (let y = y0 + 1; y < y1; y++) for (const x of [x0, x1]) if (!gap(x, y)) this.obj('fence_v', x * TILE + 8, y * TILE + 16);
  }
  tree(spr, x, y) { this.obj(spr, x, y); this.shadows.push({ x, y: y - 1, rx: 11, ry: 4 }); }
  // Thick forest on every edge, leaving the listed openings ({ side, from, to } in tiles).
  forest(openings = []) {
    const kinds = ['tree_dark_0', 'tree_dark_1', 'tree_green_0', 'tree_green_1', 'pine_0', 'pine_1', 'tree_dark_2'];
    const open = (side, t) => openings.some((o) => o.side === side && t >= o.from && t <= o.to);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const e = Math.min(x, y, this.w - 1 - x, this.h - 1 - y);
      if (e > 1) continue;
      const side = y <= 1 ? 'n' : y >= this.h - 2 ? 's' : x <= 1 ? 'w' : 'e';
      const t = side === 'n' || side === 's' ? x : y;
      if (open(side, t)) continue;
      this.set(x, y, T.DARK);
    }
    for (let y = -1; y <= this.h + 1; y += 1.15) for (let x = -1; x <= this.w + 1; x += 1.4) {
      const e = Math.min(x, y, this.w - 1 - x, this.h - 1 - y);
      if (e > 1.2) continue;
      const side = y <= 1.2 ? 'n' : y >= this.h - 2.2 ? 's' : x <= 1.2 ? 'w' : 'e';
      const t = side === 'n' || side === 's' ? x : y;
      if (open(side, Math.round(t)) || open(side, Math.round(t) - 1) || open(side, Math.round(t) + 1)) continue;
      const jx = (x + (this.r() - 0.5) * 0.6) * TILE + 8, jy = (y + (this.r() - 0.5) * 0.4) * TILE + 14;
      this.tree(kinds[Math.floor(this.r() * kinds.length)], jx, jy);
    }
  }
  flowers(n, x0, y0, x1, y1) {
    const names = ['flower_r', 'flower_w', 'flower_y', 'flower_p', 'flower_b', 'tuft', 'tuft', 'tuft_d'];
    for (let i = 0; i < n; i++) {
      const tx = x0 + Math.floor(this.r() * (x1 - x0 + 1)), ty = y0 + Math.floor(this.r() * (y1 - y0 + 1));
      if (this.tileAt(tx, ty) !== T.GRASS) continue;
      const name = names[Math.floor(this.r() * names.length)];
      this.baked.push({ name, pc: PC[name], x: tx * TILE + Math.floor(this.r() * 10), y: ty * TILE + Math.floor(this.r() * 10) });
    }
  }
  crops(x0, y0, x1, y1, kind) {
    this.rect(T.FARM, x0, y0, x1, y1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.baked.push({ name: `crop_${kind}`, pc: PC[`crop_${kind}`], x: x * TILE + 2, y: y * TILE + 2 });
  }
  mon(id, tx, ty, left = false) { this.mons.push({ id, x: tx * TILE + 8, y: ty * TILE + 12, left }); }
  hero(id, tx, ty, team = []) {
    this.heroAt = { id, x: tx * TILE + 8, y: ty * TILE + 10 };
    this.team = team;
  }
}

// ---------------------------------------------------------------- the three layouts
// A: buildings ring a cobbled square; the gate to the wilds is straight north.
function villageSquare() {
  const m = new Town(46, 33, 11);
  m.disc(T.STONE, 23, 16, 4.7);
  m.rect(T.DIRT, 22, 0, 23, 12);           // north road out through the gate
  m.rect(T.DIRT, 11, 9, 12, 11); m.rect(T.DIRT, 11, 10, 20, 11);   // training hall
  m.rect(T.DIRT, 33, 9, 34, 11); m.rect(T.DIRT, 26, 10, 34, 11);   // workshop
  m.rect(T.DIRT, 7, 18, 19, 19);                                    // clinic
  m.rect(T.DIRT, 27, 18, 38, 19);                                   // survidex
  m.rect(T.DIRT, 22, 20, 23, 29); m.rect(T.DIRT, 12, 28, 23, 29); m.rect(T.DIRT, 12, 27, 13, 28); // nursery
  m.rect(T.DIRT, 24, 25, 28, 26);                                   // ranch gate
  m.forest([{ side: 'n', from: 20, to: 25 }]);
  m.flowers(170, 2, 2, 43, 30);
  m.obj('well', 23 * TILE + 8, 16 * TILE + 14);
  for (const [x, y] of [[19, 12], [28, 12], [18, 20], [29, 20]]) m.obj('lamp', x * TILE + 8, y * TILE + 14);
  m.building('gate', 23, 7, 'Wilds Gate');
  m.building('training', 12, 9, 'Training Hall');
  m.building('workshop', 34, 9, 'Workshop');
  m.building('clinic', 8, 18, 'Clinic');
  m.building('library', 38, 18, 'Survidex');
  m.building('nursery', 13, 27, 'Nursery');
  m.obj('dummy', 17 * TILE, 8 * TILE + 12); m.obj('dummy', 18 * TILE + 8, 9 * TILE + 6);
  for (const [s, x, y] of [['crate', 38, 9], ['barrel', 39, 10], ['crate', 39, 8]]) m.obj(s, x * TILE + 8, y * TILE + 14);
  // Ranch: fenced pasture where every caught survivalmon lives (copies too)
  m.fenceRect(28, 22, 42, 29, [[28, 25], [28, 26]]);
  m.labels.push({ name: 'Ranch', x: 35 * TILE + 8, y: 22 * TILE - 2 });
  m.obj('hay', 40 * TILE + 8, 23 * TILE + 14); m.obj('hay', 41 * TILE, 27 * TILE + 14);
  for (const [id, x, y, l] of [['voltowl', 31, 24], ['voltowl', 33, 26.5, 1], ['puddlit', 36, 24], ['pebblet', 38, 26.5, 1], ['leafkit', 31, 27.5], ['tidetoad', 35, 27.5, 1], ['thornhare', 39, 24.5]]) m.mon(id, x, y, !!l);
  for (const [s, x, y] of [['tree_pink_0', 5, 6], ['tree_autumn_0', 41, 5], ['tree_pink_1', 4, 26], ['tree_green_1', 18, 31.4]]) m.tree(s, x * TILE + 8, y * TILE + 14);
  m.hero('rowan', 23, 21, ['emberpup', 'glimmoth', 'pebblet']);
  m.phoneOn = { x: 8 * TILE + 8, y: 19 * TILE + 10, label: 'Clinic — heal your team' };
  return m;
}

// B: one main street, every door on it; the ranch, pond and fields across the road.
function mainStreet() {
  const m = new Town(60, 30, 23);
  m.rect(T.DIRT, 2, 15, 53, 16);
  m.rect(T.DIRT, 52, 0, 53, 16);            // the road turns north to the gate
  for (const dx of [8, 18, 28, 38, 46]) m.rect(T.DIRT, dx - 1, 14, dx, 14);
  m.forest([{ side: 'n', from: 50, to: 55 }]);
  m.disc(T.WATER, 33, 21.5, 3.2);
  m.crops(40, 19, 47, 23, 'wheat'); m.crops(40, 24, 47, 24, 'pumpkin');
  m.flowers(190, 2, 2, 57, 27);
  m.building('clinic', 8, 14, 'Clinic');
  m.building('training', 18, 14, 'Training Hall');
  m.building('workshop', 28, 14, 'Workshop');
  m.building('library', 38, 14, 'Survidex');
  m.building('nursery', 46, 14, 'Nursery');
  m.building('gate', 53, 8, 'Wilds Gate');
  m.obj('dummy', 22 * TILE + 8, 13 * TILE + 12);
  for (const x of [4, 13, 23, 33, 42, 50]) { m.obj('lamp', x * TILE + 8, 14 * TILE + 14); m.obj('lamp', x * TILE + 8, 18 * TILE + 2); }
  m.fenceRect(4, 18, 24, 24, [[13, 18], [14, 18]]);
  m.labels.push({ name: 'Ranch', x: 14 * TILE, y: 18 * TILE - 2 });
  m.obj('hay', 6 * TILE, 20 * TILE + 14); m.obj('hay', 22 * TILE, 23 * TILE + 14);
  for (const [id, x, y, l] of [['voltowl', 7, 21], ['voltowl', 9.5, 23, 1], ['voltowl', 11, 20.5], ['puddlit', 14, 22], ['pebblet', 17, 20.5, 1], ['leafkit', 19, 23], ['cinderhound', 21.5, 20.5, 1], ['lunamoth', 12, 23.5]]) m.mon(id, x, y, !!l);
  for (const [s, x, y] of [['tree_pink_0', 28, 20], ['tree_autumn_1', 37, 24.6], ['tree_green_0', 50, 22]]) m.tree(s, x * TILE + 8, y * TILE + 14);
  m.hero('rowan', 19, 16, ['emberpup', 'voltowl', 'glimmoth']);
  m.phoneOn = { x: 18 * TILE + 8, y: 15 * TILE + 8, label: 'Training Hall — upgrades' };
  return m;
}

// C: your survivalmons' pasture is the heart of town; every building faces it.
function ranchHeart() {
  const m = new Town(48, 36, 37);
  m.rect(T.STONE, 13, 10, 34, 25);
  m.rect(T.GRASS, 15, 12, 32, 23);
  for (const dx of [11, 24, 37]) m.rect(T.DIRT, dx - 1, 8, dx, 10);
  m.rect(T.DIRT, 7, 17, 13, 18); m.rect(T.DIRT, 34, 17, 41, 18);
  m.rect(T.DIRT, 23, 25, 24, 35);
  m.forest([{ side: 's', from: 21, to: 26 }]);
  m.disc(T.WATER, 7, 28, 3.4);
  m.crops(35, 27, 42, 31, 'carrot');
  m.flowers(160, 2, 2, 45, 33);
  m.flowers(60, 15, 12, 32, 23);
  m.building('clinic', 11, 8, 'Clinic');
  m.building('library', 24, 8, 'Survidex');
  m.building('training', 37, 8, 'Training Hall');
  m.building('workshop', 7, 17, 'Workshop');
  m.building('nursery', 41, 17, 'Nursery');
  m.building('gate', 24, 32, 'Wilds Gate');
  m.obj('dummy', 42 * TILE, 8 * TILE + 8);
  for (const [x, y] of [[13, 10], [34, 10], [13, 25], [34, 25]]) m.obj('lamp', x * TILE + 8, y * TILE + 14);
  m.fenceRect(14, 11, 33, 24, [[23, 24], [24, 24], [14, 17], [14, 18], [33, 17], [33, 18]]);
  m.labels.push({ name: 'Ranch', x: 24 * TILE, y: 13 * TILE + 2 });
  m.obj('hay', 16 * TILE + 8, 13 * TILE + 14); m.obj('hay', 31 * TILE + 8, 22 * TILE + 14);
  for (const [id, x, y, l] of [['voltowl', 17, 15], ['voltowl', 19.5, 19, 1], ['puddlit', 22, 15.5], ['pebblet', 26, 20, 1], ['leafkit', 29, 15], ['emberpup', 30.5, 20.5, 1], ['tidetoad', 18, 21.5], ['tempestowl', 27.5, 17, 1], ['boulderon', 23, 21.5], ['lunamoth', 21, 18.5]]) m.mon(id, x, y, !!l);
  for (const [s, x, y] of [['tree_pink_0', 3, 8], ['tree_autumn_0', 45, 22], ['tree_pink_1', 30, 31]]) m.tree(s, x * TILE + 8, y * TILE + 14);
  m.hero('rowan', 18, 26.5, ['emberpup', 'glimmoth', 'voltowl']);
  m.phoneOn = { x: 41 * TILE + 8, y: 18 * TILE + 8, label: 'Nursery — breed two survivalmons' };
  return m;
}

// ---------------------------------------------------------------- drawing
function draw(m, tg, cam, view, labels) {
  const cv = document.createElement('canvas');
  cv.width = view.w * WS; cv.height = view.h * WS;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(WS, 0, 0, WS, 0, 0);
  ctx.fillStyle = '#245f2b'; ctx.fillRect(0, 0, view.w, view.h);
  tg.attach(m);
  tg.draw(ctx, cam, view);
  const list = m.objects.map((o) => ({ y: o.sortY, o }));
  for (const c of m.mons) list.push({ y: c.y, c });
  if (m.heroAt) {
    list.push({ y: m.heroAt.y, h: m.heroAt });
    // the team trails just behind the hero
    m.team.forEach((id, i) => {
      const c = { id, x: m.heroAt.x + (i % 2 ? -1 : 1) * (16 + 10 * (i >> 1)), y: m.heroAt.y + 10 + 8 * (i >> 1), left: i % 2 === 0 };
      list.push({ y: c.y, c });
    });
  }
  list.sort((a, b) => a.y - b.y);
  for (const it of list) {
    if (it.o) {
      const s = SPR[it.o.spr];
      ctx.drawImage(s.frames[0], Math.round((it.o.x - s.ax - cam.x) * WS) / WS, Math.round((it.o.y - s.ay - cam.y) * WS) / WS, s.w, s.h);
    } else if (it.c) {
      const a = CREATURE[it.c.id];
      if (!a) continue;
      ctx.globalAlpha = 0.28; ctx.fillStyle = '#1a2a10';
      ctx.beginPath(); ctx.ellipse(it.c.x - cam.x, it.c.y - cam.y, Math.max(5, a.cw * 0.34), Math.max(2, a.cw * 0.12), 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      drawCreature(ctx, a, it.c.x - cam.x, it.c.y - cam.y, { left: it.c.left });
    } else {
      const art = HERO_ART[it.h.id];
      ctx.globalAlpha = 0.3; ctx.fillStyle = '#1a2a10';
      ctx.beginPath(); ctx.ellipse(it.h.x - cam.x, it.h.y - cam.y, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      drawHero(ctx, art, it.h.x - cam.x, it.h.y - cam.y, it.h.dir || 'south');
    }
  }
  if (labels) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const l of m.labels) plaque(ctx, l.name, (l.x - cam.x) * WS, (l.y - cam.y) * WS);
  }
  return cv;
}
function plaque(ctx, text, cx, bottom) {
  ctx.font = '600 30px Fredoka, Nunito, sans-serif';
  const w = ctx.measureText(text).width + 30, h = 44;
  const x = Math.round(Math.max(6, Math.min(ctx.canvas.width - w - 6, cx - w / 2))), y = Math.round(Math.max(6, bottom - h));
  ctx.fillStyle = '#2b1d24'; roundRect(ctx, x - 4, y - 4, w + 8, h + 8, 12); ctx.fill();
  ctx.fillStyle = '#e8f0e0'; roundRect(ctx, x - 1, y - 1, w + 2, h + 2, 10); ctx.fill();
  ctx.fillStyle = '#1f3a40'; roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 8); ctx.fill();
  ctx.fillStyle = '#ffe07a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2 + 1);
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

async function snapshot(name, cv) {
  await fetch('/__snapshot', { method: 'POST', body: JSON.stringify({ name, data: cv.toDataURL('image/png') }) });
}

async function main() {
  buildAssets();
  await loadArt(BASE);
  await loadWorldArt(SPR, BASE);
  await Promise.all(TOWN_ART.map(async (id) => {
    const img = await loadImage(`${BASE}/town/${id}.png`);
    SPR[id] = img ? spriteOf(img) : SPR[FALLBACK[id]];
  }));
  await document.fonts.load('600 30px Fredoka');
  const tg = await TileGround.load(`${BASE}/tiles`);
  const out = document.getElementById('out');
  const layouts = { square: villageSquare(), street: mainStreet(), ranch: ranchHeart() };
  for (const [key, m] of Object.entries(layouts)) {
    const full = draw(m, tg, { x: 0, y: 0 }, { w: m.pw, h: m.ph }, true);
    // phone view: the camera the game would use, with the hero standing at a door
    m.heroAt = { id: 'rowan', x: m.phoneOn.x, y: m.phoneOn.y, dir: 'north' };
    const cam = {
      x: Math.max(0, Math.min(m.pw - PHONE.w, Math.round(m.heroAt.x - PHONE.w / 2))),
      y: Math.max(0, Math.min(m.ph - PHONE.h, Math.round(m.heroAt.y - 8 - PHONE.h / 2))),
    };
    // where the hero lands in the phone view, for the page's HUD overlay
    window.heroSpots = { ...window.heroSpots, [key]: { x: (m.heroAt.x - cam.x) / PHONE.w, y: (m.heroAt.y - cam.y) / PHONE.h } };
    const phone = draw(m, tg, cam, PHONE, false);
    for (const cv of [full, phone]) { cv.style.maxWidth = '100%'; out.append(cv); }
    await snapshot(`town_${key}`, full);
    await snapshot(`town_${key}_phone`, phone);
  }
  document.title = 'done';
}
main();
