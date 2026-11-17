// PixelLab sprite art: loads the PNGs and prepares flipped, hit-flash and outlined variants.
// World art is drawn at 2x the logical resolution (WS), so a 64px sprite is 32 logical px.
import { SPECIES, BASE_IDS, PURE_IDS, MIXED_IDS, EVOLVED_IDS, DEX_IDS } from '../content/species.js';

export const WS = 2;

export const CREATURE = {};  // id -> creature sprite (critters, monsters, bosses)
export const HERO_ART = {};  // id -> { dirs: { south: canvas, ... }, flash, w, h, ax, ay }

export const DIR8 = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
export const dir8 = (angle) => DIR8[((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8];

// How each creature moves when animated in code: hop | walk | fly | float
export const MOTION = {
  emberpup: 'walk', cinderhound: 'walk', leafkit: 'hop', thornhare: 'hop', voltowl: 'fly', tempestowl: 'fly',
  puddlit: 'hop', tidetoad: 'hop', pebblet: 'hop', boulderon: 'walk', glimmoth: 'fly', lunamoth: 'fly',
  slime: 'hop', slime_blue: 'hop', slime_red: 'hop', bat: 'fly', shroom: 'walk', shroom_blue: 'walk',
  wisp: 'float', wolf: 'walk', spore: 'hop', beetle: 'walk', imp: 'fly', golem: 'walk',
  king_slime: 'hop', treant: 'walk', colossus: 'walk', alpha_wolf: 'walk', night_lord: 'float',
  // breeds and their evolutions
  ashbloom: 'hop', infernobloom: 'walk', scaldfrog: 'hop', geyserking: 'hop', blazewing: 'fly', phoenowl: 'fly',
  magmaul: 'walk', volcanox: 'walk', pyrefly: 'fly', solarfly: 'fly', lilypaw: 'hop', lotusage: 'hop',
  gustleaf: 'fly', stormleaf: 'fly', mossmound: 'hop', mossgiant: 'walk', petalwisp: 'fly', blossomwisp: 'fly',
  zapgill: 'hop', stormgill: 'hop', coralump: 'walk', reefguard: 'walk', mistmoth: 'fly', dreammoth: 'fly',
  cragowl: 'fly', titanowl: 'fly', aurowl: 'fly', celestowl: 'fly', gemmoth: 'fly', prismoth: 'fly',
  // the four newer species, their same-species breeds, and their mixed breeds with evolutions
  duskit: 'walk', nightprowl: 'walk', snowpip: 'walk', emperice: 'walk', venewt: 'walk', venomander: 'walk', ferrit: 'walk', steelfang: 'walk',
  cindercat: 'walk', infernyx: 'walk', thornshade: 'hop', nightbramble: 'walk', gloomowl: 'fly', eclipsowl: 'fly',
  murkfin: 'hop', abyssfin: 'hop', shadestone: 'hop', obsidclaw: 'walk', duskmoth: 'fly', nocturna: 'fly',
  frostflare: 'walk', auroravix: 'walk', frostbloom: 'hop', wintergrove: 'walk', blizzowl: 'fly', hailstrix: 'fly',
  floepip: 'hop', glacierback: 'walk', avalump: 'hop', glacitan: 'walk', frostfae: 'fly', aurorafae: 'fly',
  smogpup: 'walk', fumeroar: 'walk', sporebun: 'hop', mycelord: 'walk', toxivolt: 'walk', voltoxin: 'walk',
  sludgill: 'hop', swamplord: 'hop', corrodon: 'walk', corrosaur: 'walk', fogwing: 'fly', hazewing: 'fly',
  forgepup: 'walk', forgehound: 'walk', vinegear: 'hop', gearwood: 'walk', magnowl: 'fly', teslowl: 'fly',
  anchorfin: 'hop', dreadnaut: 'walk', ironclod: 'hop', titanclad: 'walk', chromoth: 'fly', mirrorwing: 'fly',
  frostshade: 'walk', rimeshade: 'walk', gloomnewt: 'walk', gloomdrake: 'walk', shurikat: 'walk', phantomblade: 'walk',
  slushling: 'walk', frostbite: 'walk', steelpeng: 'walk', ironberg: 'walk', rustail: 'walk', scrapdrake: 'walk',
  // monsters: the Blight, the zone monsters, the Snare gang and the bosses
  blob: 'hop', inkwing: 'fly', hound: 'walk', spitter: 'hop', shardooze: 'hop', bloater: 'walk',
  thornling: 'walk', bogcrab: 'walk', sawbeetle: 'walk', cinderimp: 'fly', snowgolem: 'walk', wiltsprite: 'fly',
  poacher: 'walk', slinger: 'walk', drone: 'fly', inkking: 'hop', elder: 'walk', snareboss: 'walk',
};
// Monsters that have drawn animation sheets (creatures/anim/<id>.png) like the survivalmons
export const ENEMY_ANIM = ['blob', 'inkwing', 'hound', 'spitter', 'shardooze', 'bloater', 'thornling', 'bogcrab', 'sawbeetle',
  'cinderimp', 'snowgolem', 'wiltsprite', 'poacher', 'slinger', 'drone', 'inkking', 'elder', 'snareboss', 'night_lord'];
const HAS_SHEET = new Set(ENEMY_ANIM);

const CREATURE_IDS = [
  ...BASE_IDS, ...PURE_IDS,
  'slime', 'bat', 'shroom', 'wisp', 'wolf', 'spore', 'beetle', 'imp', 'golem',
  'king_slime', 'treant', 'colossus', 'alpha_wolf', 'night_lord',
  ...ENEMY_ANIM.filter((id) => id !== 'night_lord'),
  ...MIXED_IDS, ...EVOLVED_IDS,
];
// Enemy colour variants made by shifting the hue of an existing sprite
const VARIANTS = { slime_blue: ['slime', 95], slime_red: ['slime', -105], shroom_blue: ['shroom', 185] };
const HEROES = ['rowan', 'bram', 'lyra', 'pip'];
// Survivalmons with drawn animation: creatures/anim/<id>.png holds one cell per frame (cell = the
// sprite's own size, 8 cells across): row 0 = moving (8 frames), row 1 = idle (6), row 2 = attack (6,
// played once each time it attacks), row 3 = faint (8, played once, ending lying down). Frame 0 of
// the moving row is the still sprite. A missing or empty attack/faint row just isn't used.
// A survivalmon that rolls into foes has its curl-up instead of an attack in row 2 (6 frames, ending
// as a ball); the ball then turns as it rolls (anim.ball, made from that last frame).
const ANIM_FRAMES = { move: 8, idle: 6, attack: 6, curl: 6, faint: 8 };
const BALL_STEPS = 8;
// A hero's dash (heroes/<id>/dash.png): 96px cells, with the 64px standing sprite 16px in
const DASH_CELL = 96, DASH_PAD = 16;
const ANIM_ROWS = [['move', 0], ['idle', 1], ['attack', 2], ['faint', 3]];
export const ANIM_FPS = { move: 10, fly: 12, idle: 7, attack: 14, faint: 10 };

// ---------------------------------------------------------------- canvas helpers
// Every image the game loads is counted, so the loading screen (index.html) can show real progress.
const loadProgress = (window.__loadProgress ||= { total: 0, done: 0 });
function loadImage(src) {
  loadProgress.total++;
  return new Promise((resolve) => {
    const img = new Image();
    let retried = false;
    img.onload = () => { loadProgress.done++; resolve(img); };
    // a flaky connection or a stale cached copy: one more try, fresh from the network
    img.onerror = () => {
      if (!retried) { retried = true; img.src = `${src}${src.includes('?') ? '&' : '?'}r=${Date.now()}`; return; }
      loadProgress.done++; resolve(null);
    };
    img.src = src;
  });
}
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function fromImage(img) { const c = canvasOf(img.width, img.height); c.getContext('2d').drawImage(img, 0, 0); return c; }
function flip(src) {
  const c = canvasOf(src.width, src.height), g = c.getContext('2d');
  g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0);
  return c;
}
function silhouette(src, color) {
  const c = canvasOf(src.width, src.height), g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  return c;
}
// 1px coloured outline around the sprite; result is padded by 1px on every side
function outlined(src, color) {
  const sil = silhouette(src, color);
  const c = canvasOf(src.width + 2, src.height + 2), g = c.getContext('2d');
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) g.drawImage(sil, dx, dy);
  g.drawImage(src, 1, 1);
  return c;
}
function bbox(src) {
  const { data, width, height } = src.getContext('2d').getImageData(0, 0, src.width, src.height);
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] < 40) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return { x0: 0, y0: 0, x1: width - 1, y1: height - 1 };
  return { x0, y0, x1, y1 };
}
function hueShift(src, deg) {
  const c = fromImage(src), g = c.getContext('2d');
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  const rot = (deg / 360) % 1;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
    const max = Math.max(r, gg, b), min = Math.min(r, gg, b), l = (max + min) / 2;
    if (max === min) continue;
    const dd = max - min, s = l > 0.5 ? dd / (2 - max - min) : dd / (max + min);
    let h = max === r ? (gg - b) / dd + (gg < b ? 6 : 0) : max === gg ? (b - r) / dd + 2 : (r - gg) / dd + 4;
    h = (h / 6 + rot + 1) % 1;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    d[i] = f(h + 1 / 3) * 255; d[i + 1] = f(h) * 255; d[i + 2] = f(h - 1 / 3) * 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

function makeCreature(id, canvas) {
  const b = bbox(canvas);
  const L = flip(canvas);
  return {
    id, w: canvas.width, h: canvas.height,
    ax: (b.x0 + b.x1 + 1) / 2, ay: b.y1 + 1,       // feet, in native px
    cw: (b.x1 - b.x0 + 1) / WS, ch: (b.y1 - b.y0 + 1) / WS, // content size, logical px
    R: canvas, L,
    RF: silhouette(canvas, '#ffffff'), LF: silhouette(L, '#ffffff'),
    RE: outlined(canvas, '#ffd84a'), LE: outlined(L, '#ffd84a'),
    RC: outlined(canvas, '#5ff0ff'), LC: outlined(L, '#5ff0ff'),
    motion: MOTION[id] || 'walk',
  };
}

function cut(img, x, y, w, h) { const c = canvasOf(w, h); c.getContext('2d').drawImage(img, x, y, w, h, 0, 0, w, h); return c; }
// Sheets drawn facing left. The game treats every sprite as facing right, so these are mirrored as
// they load; otherwise they walk backwards.
const FACES_LEFT = new Set(['emberpup', 'leafkit', 'puddlit', 'cinderhound', 'thornhare', 'scaldfrog', 'magmaul', 'lilypaw', 'zapgill']);
// A survivalmon from its animation sheet: the still sprite (frame 0) plus moving and idle frames.
function animatedCreature(id, sheet) {
  const c = sheet.width / 8, rows = Math.round(sheet.height / c);
  const mirror = FACES_LEFT.has(id);
  const frame = (i, row) => { const f = cut(sheet, i * c, row * c, c, c); return mirror ? flip(f) : f; };
  const a = makeCreature(id, frame(0, 0));
  a.anim = {};
  const roller = SPECIES[id]?.q?.spin;
  for (const [kind, row] of ANIM_ROWS) {
    if (row >= rows) continue;
    const k = roller && kind === 'attack' ? 'curl' : kind;
    const frames = Array.from({ length: ANIM_FRAMES[k] }, (_, i) => frame(i, row));
    if (row >= 2 && frames.every(blank)) continue; // e.g. a roller still without its curl-up
    a.anim[k] = frames.map((R) => ({ R, L: flip(R) }));
  }
  if (a.anim.curl) a.anim.ball = ballTurns(a.anim.curl[a.anim.curl.length - 1].R).map((R) => ({ R, L: flip(R) }));
  return a;
}
// A curled-up survivalmon turning as it rolls: BALL_STEPS turns of one frame, clockwise, about the
// ball's middle, pixel for pixel (no smoothing), so moving right it rolls forward. Each turn gets a
// margin all round, so a ball that fills its cell keeps its edges when turned (drawCreature centres
// a padded image).
function ballTurns(src) {
  const b = bbox(src), cx = (b.x0 + b.x1 + 1) / 2, cy = (b.y0 + b.y1 + 1) / 2;
  const p = Math.ceil(Math.max(src.width, src.height) * 0.21);
  return Array.from({ length: BALL_STEPS }, (_, i) => {
    const c = canvasOf(src.width + 2 * p, src.height + 2 * p), g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.translate(cx + p, cy + p); g.rotate((i * Math.PI * 2) / BALL_STEPS); g.drawImage(src, -cx, -cy);
    return c;
  });
}
// True if a frame has nothing drawn in it
function blank(c) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < d.length; i += 16) if (d[i] > 20) return false;
  return true;
}

// ---------------------------------------------------------------- loading
export async function loadArt(base = 'assets/sprites') {
  await Promise.all(CREATURE_IDS.map(async (id) => {
    const sheet = SPECIES[id] || HAS_SHEET.has(id) ? await loadImage(`${base}/creatures/anim/${id}.png`) : null;
    if (sheet) { CREATURE[id] = animatedCreature(id, sheet); return; }
    const img = await loadImage(`${base}/creatures/${id}.png`);
    if (img) CREATURE[id] = makeCreature(id, fromImage(img));
  }));
  for (const [id, [from, deg]] of Object.entries(VARIANTS)) {
    if (CREATURE[from]) CREATURE[id] = makeCreature(id, hueShift(CREATURE[from].R, deg));
  }
  // A survivalmon whose picture is missing borrows the one it grew from (or its first parent's).
  for (const id of DEX_IDS) {
    if (CREATURE[id]) continue;
    const sp = SPECIES[id], from = CREATURE[sp.from] || CREATURE[sp.pair?.[0]];
    if (from) CREATURE[id] = from;
  }
  await Promise.all(HEROES.map(async (id) => {
    const dirs = {}, flash = {};
    await Promise.all(DIR8.map(async (d) => {
      const img = await loadImage(`${base}/heroes/${id}/${d}.png`);
      if (img) { dirs[d] = fromImage(img); flash[d] = silhouette(dirs[d], '#ffffff'); }
    }));
    if (!dirs.south) return;
    // Walk cycles: heroes/<id>/walk/<dir>_<n>.png, frames counted from walk/frames.json
    const walk = {}, walkFlash = {};
    // heroes/<id>/walk.png: one row per direction (DIR8 order), one 64px cell per frame
    const sheet = await loadImage(`${base}/heroes/${id}/walk.png`);
    if (sheet) {
      const c = dirs.south.width, n = Math.floor(sheet.width / c);
      DIR8.forEach((d, r) => {
        walk[d] = Array.from({ length: n }, (_, i) => cut(sheet, i * c, r * c, c, c));
        walkFlash[d] = walk[d].map((f) => silhouette(f, '#ffffff'));
      });
    }
    const meta = sheet ? null : await fetch(`${base}/heroes/${id}/walk/frames.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (meta) await Promise.all(DIR8.map(async (d) => {
      const imgs = await Promise.all(Array.from({ length: meta[d] || 0 }, (_, i) => loadImage(`${base}/heroes/${id}/walk/${d}_${i}.png`)));
      if (imgs.length && imgs.every(Boolean)) { walk[d] = imgs.map(fromImage); walkFlash[d] = walk[d].map((c) => silhouette(c, '#ffffff')); }
    }));
    // heroes/<id>/dash.png: the dash, one row per direction (DIR8 order), DASH_CELL px cells
    const dash = {}, dashFlash = {};
    const dsheet = await loadImage(`${base}/heroes/${id}/dash.png`);
    if (dsheet) {
      const n = Math.floor(dsheet.width / DASH_CELL);
      DIR8.forEach((d, r) => {
        const fr = Array.from({ length: n }, (_, i) => cut(dsheet, i * DASH_CELL, r * DASH_CELL, DASH_CELL, DASH_CELL)).filter((f) => !blank(f));
        if (fr.length) { dash[d] = fr; dashFlash[d] = fr.map((f) => silhouette(f, '#ffffff')); }
      });
    }
    const b = bbox(dirs.south);
    HERO_ART[id] = { dirs, flash, walk, walkFlash, dash, dashFlash, w: dirs.south.width, h: dirs.south.height, ax: (b.x0 + b.x1 + 1) / 2, ay: b.y1 + 1, ch: (b.y1 - b.y0 + 1) / WS };
  }));
}

// ---------------------------------------------------------------- drawing
// Round a logical coordinate to the nearest canvas pixel (half a logical pixel at WS = 2).
export const snap = (v) => Math.round(v * WS) / WS;

// Code-driven motion for single-image creatures. t = time, moving = is it travelling.
export function creatureMotion(kind, t, moving, seed = 0, animated = false) {
  const p = t + seed;
  if (animated) {
    // the drawn frames do the squash and flap; code only adds hover height and a light bounce
    if (kind === 'fly') return { bob: 5 + Math.sin(p * 2.5) * 1.5, sx: 1, sy: 1 };
    if (kind === 'float') return { bob: 4 + Math.sin(p * 2.4) * 2, sx: 1, sy: 1 };
    if (kind === 'hop' && moving) return { bob: Math.abs(Math.sin(p * 7)) * 2, sx: 1, sy: 1 };
    return { bob: 0, sx: 1, sy: 1 };
  }
  if (kind === 'fly') return { bob: 5 + Math.sin(p * 4) * 2, sx: 1 + Math.sin(p * 14) * 0.03, sy: 1 - Math.sin(p * 14) * 0.03 };
  if (kind === 'float') return { bob: 4 + Math.sin(p * 2.4) * 2.5, sx: 1, sy: 1 + Math.sin(p * 2.4) * 0.03 };
  if (!moving) { const br = Math.sin(p * 2.2) * 0.025; return { bob: 0, sx: 1 - br * 0.5, sy: 1 + br }; }
  if (kind === 'hop') {
    const h = Math.abs(Math.sin(p * 7));
    const land = h < 0.25 ? (0.25 - h) * 0.4 : 0;
    return { bob: h * 4, sx: 1 + land - (1 - h) * 0.0, sy: 1 - land + h * 0.04 };
  }
  const s = Math.sin(p * 11);
  return { bob: Math.abs(s) * 1.5, sx: 1, sy: 1 + s * 0.025 };
}

// Draw a creature with its feet at logical (x, y).
// o: { left, flash, outline: 'elite' | 'catch', bob, sx, sy, alpha, anim: 'move' | 'idle', at: seconds }
export function drawCreature(ctx, s, x, y, o = {}) {
  const left = !!o.left;
  let img = left ? s.L : s.R;
  if (o.flash) img = left ? s.LF : s.RF;
  else if (o.outline === 'elite') img = left ? s.LE : s.RE;
  else if (o.outline === 'catch') img = left ? s.LC : s.RC;
  else if (o.anim && s.anim?.[o.anim]) {
    const fr = s.anim[o.anim];
    let i;
    if (o.frame !== undefined) i = Math.max(0, Math.min(fr.length - 1, o.frame)); // attack and faint play once
    else { const fps = o.anim === 'idle' ? ANIM_FPS.idle : s.motion === 'fly' ? ANIM_FPS.fly : ANIM_FPS.move; i = Math.floor((o.at || 0) * fps) % fr.length; }
    const f = fr[i];
    img = left ? f.L : f.R;
  }
  if (o.blight) img = blightTint(img); // a survivalmon under the Blight's control
  const pad = (img.width - s.w) / 2;
  const sx = o.sx ?? 1, sy = o.sy ?? 1;
  const ax = (left ? s.w - s.ax : s.ax) + pad, ay = s.ay + pad;
  const dw = (img.width / WS) * sx, dh = (img.height / WS) * sy;
  const dx = x - (ax / WS) * sx, dy = y - (o.bob || 0) - (ay / WS) * sy;
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  ctx.drawImage(img, snap(dx), snap(dy), dw, dh);
  if (o.alpha !== undefined) ctx.globalAlpha = 1;
}

export function drawHero(ctx, h, x, y, dir, o = {}) {
  // o.dash = which dash frame (it plays once); its cells are bigger, with the standing sprite DASH_PAD in
  const dcyc = o.dash != null && (o.flash ? h.dashFlash : h.dash)?.[dir];
  if (dcyc) {
    const img = dcyc[Math.max(0, Math.min(dcyc.length - 1, Math.floor(o.dash)))];
    ctx.drawImage(img, snap(x - (h.ax + DASH_PAD) / WS), snap(y - (o.bob || 0) - (h.ay + DASH_PAD) / WS), img.width / WS, img.height / WS);
    return;
  }
  const cycle = o.walk != null && (o.flash ? h.walkFlash : h.walk)?.[dir];
  const img = cycle ? cycle[Math.floor(o.walk) % cycle.length] : (o.flash ? h.flash : h.dirs)[dir] || h.dirs.south;
  const sx = o.sx ?? 1, sy = o.sy ?? 1;
  const dw = (h.w / WS) * sx, dh = (h.h / WS) * sy;
  ctx.drawImage(img, snap(x - (h.ax / WS) * sx), snap(y - (o.bob || 0) - (h.ay / WS) * sy), dw, dh);
}

// The village's people (assets/sprites/npcs.png): 4 rows of 88px cells each, in the order given:
// their 8 turns (DIR8), then an idle cycle facing south, or walk cycles south, north and east.
export const NPC_ART = {};
const NPC_CELL = 88;
export async function loadNpcArt(ids, base = 'assets/sprites') {
  const sheet = await loadImage(`${base}/npcs.png`);
  if (!sheet) return;
  const C = NPC_CELL;
  const row = (r) => {
    const out = [];
    for (let i = 0; (i + 1) * C <= sheet.width; i++) {
      const c = cut(sheet, i * C, r * C, C, C);
      if (blank(c)) break;
      out.push(c);
    }
    return out;
  };
  ids.forEach((id, k) => {
    const rot = row(k * 4);
    if (rot.length < 8) return;
    const dirs = Object.fromEntries(DIR8.map((d, i) => [d, rot[i]]));
    const a = row(k * 4 + 1), n = row(k * 4 + 2), e = row(k * 4 + 3);
    const walk = n.length && e.length ? { south: a, north: n, east: e, west: e.map((f) => flip(f)) } : null;
    const b = bbox(dirs.south);
    NPC_ART[id] = { dirs, idle: walk ? null : a, walk, w: C, h: C, ax: (b.x0 + b.x1 + 1) / 2, ay: b.y1 + 1 };
  });
}
const WALK4 = { east: 'east', 'south-east': 'east', 'north-east': 'east', west: 'west', 'south-west': 'west', 'north-west': 'west', south: 'south', north: 'north' };
// One of them at (x, y) (their feet), facing dir; t = seconds, for the walk or idle cycle
export function drawNpcArt(ctx, a, x, y, dir, t, moving) {
  let img;
  if (moving && a.walk) { const cyc = a.walk[WALK4[dir]]; img = cyc[Math.floor(t * 9) % cyc.length]; }
  else if (!moving && a.idle?.length && dir === 'south') img = a.idle[Math.floor(t * 5) % a.idle.length];
  else img = a.dirs[dir] || a.dirs.south;
  ctx.drawImage(img, snap(x - a.ax / WS), snap(y - a.ay / WS), a.w / WS, a.h / WS);
}
// A face for the talk box: the head and shoulders of their south turn, as a data URL
const faceCache = new Map();
export function npcFaceURL(id) {
  if (faceCache.has(id)) return faceCache.get(id);
  const a = NPC_ART[id];
  if (!a) return '';
  const b = bbox(a.dirs.south), w = b.x1 - b.x0 + 1, s = Math.min(w + 4, b.y1 - b.y0 + 1);
  const c = canvasOf(s, s);
  c.getContext('2d').drawImage(a.dirs.south, Math.round((b.x0 + b.x1 + 1) / 2 - s / 2), b.y0 - 1, s, s, 0, 0, s, s);
  const url = c.toDataURL();
  faceCache.set(id, url);
  return url;
}

// Data URL of a sprite cropped to its content, for DOM icons/portraits.
const urlCache = new Map();
export function artURL(kind, id) {
  const key = `${kind}:${id}`;
  if (urlCache.has(key)) return urlCache.get(key);
  const src = kind === 'hero' ? HERO_ART[id]?.dirs.south : CREATURE[id]?.R;
  if (!src) return '';
  const b = bbox(src);
  const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1, s = Math.max(w, h) + 2;
  const c = canvasOf(s, s);
  c.getContext('2d').drawImage(src, b.x0, b.y0, w, h, Math.floor((s - w) / 2), s - h - 1, w, h);
  const url = c.toDataURL();
  urlCache.set(key, url);
  return url;
}
export const hasArt = (id) => !!CREATURE[id];
// The Blight's dark tint, cached per frame
const blightCache = new WeakMap();
function blightTint(src) {
  let c = blightCache.get(src);
  if (!c) {
    c = canvasOf(src.width, src.height);
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(34, 8, 46, 0.58)';
    g.fillRect(0, 0, c.width, c.height);
    blightCache.set(src, c);
  }
  return c;
}
// A creature's picture cropped to its content, as a canvas (for the hatch and evolve animations)
const cropCache = new Map();
export function creatureArt(id) {
  const src = CREATURE[id]?.R;
  if (!src) return null;
  if (!cropCache.has(id)) cropCache.set(id, cropped(src));
  return cropCache.get(id);
}
export { silhouette };

// ---------------------------------------------------------------- world, interior and item art
// Replaces code-drawn sprites in SPR (same names), so the rest of the game needs no changes.
// [file, flipped?]. Variants without their own file reuse another image, sometimes mirrored.
const WORLD_ART = {
  tree_green_0: ['world/tree_green_0'], tree_green_1: ['world/tree_green_1'], tree_green_2: ['world/tree_green_0', true], tree_green_3: ['world/tree_green_1', true],
  tree_dark_0: ['world/tree_dark_0'], tree_dark_1: ['world/tree_dark_0', true], tree_dark_2: ['world/tree_big_0'], tree_dark_3: ['world/tree_big_0', true],
  tree_autumn_0: ['world/tree_autumn_0'], tree_autumn_1: ['world/tree_autumn_0', true],
  tree_pink_0: ['world/tree_pink_0'], tree_pink_1: ['world/tree_pink_0', true],
  tree_big_0: ['world/tree_big_0'], tree_big_1: ['world/tree_big_0', true],
  pine_0: ['world/pine_0'], pine_1: ['world/pine_0', true],
  bush_0: ['world/bush_0'], bush_1: ['world/bush_1'],
  house_0: ['world/house_straw'], house_1: ['world/house_red'], house_2: ['world/house_blue'], house_3: ['world/house_moss'],
  house_4: ['world/house_straw', true], house_5: ['world/house_blue', true],
  barn: ['world/barn'], shrine: ['world/shrine'],
  well: ['world/well'], lamp: ['world/lamp'], sign: ['world/sign'], hay: ['world/hay'], cart: ['world/cart'],
  crate: ['world/crate'], crate_open: ['world/crate_open'], barrel: ['world/barrel'], barrel_open: ['world/barrel_open'],
  pot: ['world/pot'], pot_broken: ['world/pot_broken'], rock: ['world/rock'], rock_big: ['world/rock_big'], stump: ['world/stump'],
  fence_h: ['world/fence_h'], fence_v: ['world/fence_v'],
  town_gate: ['town/gate'], town_dummy: ['town/dummy'], town_clinic: ['town/clinic'], town_workshop: ['town/workshop'],
  town_training: ['town/training'], town_hatchery: ['town/nursery'], town_library: ['town/library'], town_merchant: ['town/merchant'], town_ranch: ['town/ranch'],
  node_wood: ['world/node_wood'], node_clay: ['world/node_clay'], node_iron: ['world/node_iron'],
  bed_r: ['interior/bed_r'], bed_b: ['interior/bed_b'], bed_g: ['interior/bed_g'], table: ['interior/table'], chair: ['interior/chair'],
  bookshelf: ['interior/bookshelf'], bookshelf2: ['interior/bookshelf', true], fireplace: ['interior/fireplace'], stove: ['interior/stove'],
  cupboard: ['interior/cupboard'], plant: ['interior/plant'], clock: ['interior/clock'], altar: ['interior/altar'],
  painting_0: ['interior/painting_0'], painting_1: ['interior/painting_1'],
  chest_wood: ['interior/chest_wood'], chest_wood_open: ['interior/chest_wood_open'], chest_silver: ['interior/chest_silver'],
  chest_silver_open: ['interior/chest_silver_open'], chest_gold: ['interior/chest_gold'], chest_gold_open: ['interior/chest_gold_open'],
};
// Basement props (interior/cellar.png): trapdoor, ladder, gold of every kind and cellar things
const CELLAR = ['trapdoor', 'hatch', 'ladder', 'gold_heap', 'gold_gems', 'gold_small', 'gold_sack', 'gold_jar', 'gold_crate',
  'gold_bars', 'gold_goblet', 'barrel_side', 'cobweb', 'candles', 'pillar', 'wine_rack'];
// Furniture for the rooms of the town's buildings (interior/town_props.png)
const TOWN_PROPS = ['tp_forge', 'tp_anvil', 'tp_rack', 'tp_workbench', 'tp_bag', 'tp_bench', 'tp_lantern', 'tp_offering',
  'tp_medshelf', 'tp_desk', 'tp_case', 'tp_incubator', 'tp_nest', 'tp_trough', 'tp_saddle', 'tp_herbs'];
// Ground decals baked into the map
export const DECAL_ART = {};
const DECALS = ['flower_r', 'flower_w', 'flower_y', 'flower_p', 'flower_b', 'tuft', 'tuft_d', 'crop_carrot', 'crop_cabbage',
  'crop_wheat', 'crop_pumpkin', 'crop_sprout', 'lily_0', 'lily_1', 'lily_2', 'rock_s'];
// Interior surfaces (seamless tiles)
export const ROOM_ART = {};
const ROOMS = ['floor_wood', 'floor_barn', 'floor_stone', 'wall_wood', 'wall_barn', 'wall_stone', 'rug_r', 'rug_b', 'rug_g', 'window', 'window_stained', 'torch'];
// Item icons and projectiles
export const ICON_ART = {};

function cropped(src, flipIt) {
  const b = bbox(src);
  const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
  const c = canvasOf(w, h);
  c.getContext('2d').drawImage(src, b.x0, b.y0, w, h, 0, 0, w, h);
  return flipIt ? flip(c) : c;
}

export async function loadWorldArt(SPR, base = 'assets/sprites') {
  const files = new Map();
  const get = async (path) => {
    if (!files.has(path)) files.set(path, loadImage(`${base}/${path}.png`));
    return files.get(path);
  };
  await Promise.all(Object.entries(WORLD_ART).map(async ([name, [path, flipped]]) => {
    const img = await get(path);
    if (!img) return;
    const c = cropped(fromImage(img), flipped);
    SPR[name] = { w: c.width / WS, h: c.height / WS, ax: c.width / WS / 2, ay: c.height / WS, frames: [c], png: true };
  }));
  // the basement props share one sheet, 52px cells in this order
  const cellar = await get('interior/cellar');
  if (cellar) CELLAR.forEach((name, i) => {
    const cell = canvasOf(52, 52);
    cell.getContext('2d').drawImage(cellar, i * 52, 0, 52, 52, 0, 0, 52, 52);
    if (blank(cell)) return;
    const c = cropped(cell);
    SPR[name] = { w: c.width / WS, h: c.height / WS, ax: c.width / WS / 2, ay: c.height / WS, frames: [c], png: true };
  });
  // the town buildings' furniture (interior/town_props.png): 64px cells in TOWN_PROPS order
  const props = await get('interior/town_props');
  if (props) TOWN_PROPS.forEach((name, i) => {
    const cell = cut(props, i * 64, 0, 64, 64);
    if (blank(cell)) return;
    const c = cropped(cell);
    SPR[name] = { w: c.width / WS, h: c.height / WS, ax: c.width / WS / 2, ay: c.height / WS, frames: [c], png: true };
  });
  // the ground decals share one sheet, 24px cells in DECALS order
  const decals = await get('decals/decals');
  if (decals) DECALS.forEach((name, i) => {
    const cell = cut(decals, i * 24, 0, 24, 24);
    if (blank(cell)) return;
    const c = cropped(cell);
    DECAL_ART[name] = { img: c, w: c.width / WS, h: c.height / WS };
  });
  await Promise.all(ROOMS.map(async (name) => {
    const img = await get(`interior/${name}`);
    if (img) ROOM_ART[name] = { img, w: img.width / WS, h: img.height / WS };
  }));
}

// Projectiles: centred anchors so they rotate around their middle
const PROJ = ['arrow', 'ember', 'leaf', 'boomerang', 'bomb', 'pebble', 'spore', 'imp_fire', 'boulder', 'bubble', 'fireball', 'meteor', 'dark_orb', 'root', 'ice'];
export async function loadProjArt(SPR, base = 'assets/sprites/projectiles') {
  await Promise.all(PROJ.map(async (id) => {
    const img = await loadImage(`${base}/${id}.png`);
    if (!img) return;
    const c = cropped(fromImage(img));
    SPR[`p_${id}`] = { w: c.width / WS, h: c.height / WS, ax: c.width / WS / 2, ay: c.height / WS / 2, frames: [c], png: true };
  }));
}

// Icons (32px PNGs shown at 16 logical px in the world, any size in the UI)
export async function loadIconArt(ids, base = 'assets/sprites/icons') {
  await Promise.all(ids.map(async (id) => {
    const img = await loadImage(`${base}/${id}.png`);
    if (img) { const full = fromImage(img), c = cropped(full); ICON_ART[id] = { img: c, full, w: c.width / WS, h: c.height / WS }; }
  }));
}

// ---------------------------------------------------------------- attack effects
// Animated effects drawn with PixelLab's effects tool, packed into atlas pages (see content/vfx_data.js).
export const VFX = {};       // id -> { fps, loop, ax, ay, hit, f: frames, dur }
const VFX_IMG = [];
export async function loadVfxArt(base = 'assets/sprites/vfx') {
  const { VFX_PAGES, VFX_DATA } = await import('../content/vfx_data.js').catch(() => ({ VFX_PAGES: 0, VFX_DATA: {} }));
  const imgs = await Promise.all(Array.from({ length: VFX_PAGES }, (_, i) => loadImage(`${base}/vfx_${i}.png`)));
  imgs.forEach((im, i) => { VFX_IMG[i] = im; });
  for (const [id, d] of Object.entries(VFX_DATA)) VFX[id] = { ...d, dur: d.f.length / d.fps };
}
export const hasVfx = (id) => !!(id && VFX[id]);
// Seconds into an effect when its attack lands
export const vfxHitTime = (id) => { const v = VFX[id]; return v ? (v.hit ?? Math.floor(v.f.length / 3)) / v.fps : 0; };
// Draws an effect t seconds in, its origin at (x, y). o: rot, scale, alpha, flip. Returns false once a one-shot is over.
export function drawVfx(ctx, id, t, x, y, o = {}) {
  const v = VFX[id];
  if (!v) return false;
  let i = Math.floor(t * v.fps);
  if (v.loop) i %= v.f.length; else if (i >= v.f.length) return false;
  const f = v.f[Math.max(0, i)];
  if (!f) return true;
  const img = VFX_IMG[f[0]];
  if (!img) return true;
  const s = (o.scale || 1) / WS;
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  if (o.rot || o.flip) {
    ctx.save(); ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    if (o.flip) ctx.scale(-1, 1);
    ctx.drawImage(img, f[1], f[2], f[3], f[4], (f[5] - v.ax) * s, (f[6] - v.ay) * s, f[3] * s, f[4] * s);
    ctx.restore();
  } else ctx.drawImage(img, f[1], f[2], f[3], f[4], snap(x + (f[5] - v.ax) * s), snap(y + (f[6] - v.ay) * s), f[3] * s, f[4] * s);
  if (o.alpha !== undefined) ctx.globalAlpha = 1;
  return true;
}
