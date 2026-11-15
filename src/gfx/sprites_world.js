// Procedural pixel art: trees, buildings, props, crops and interior furniture.
import { PixelCanvas } from './pixel.js';
import { mulberry32, shade } from '../core/util.js';
import { OUT } from './sprites_chars.js';

export const TREE_PALETTES = {
  green: { o: '#1d4a22', d: '#2e7a33', b: '#47a83f', l: '#6cc24e', h: '#9ad86a' },
  dark: { o: '#163a1c', d: '#245f2b', b: '#367f35', l: '#4f9a3f', h: '#78b858' },
  autumn: { o: '#5a2a10', d: '#b8621e', b: '#e08a2e', l: '#f6b84a', h: '#ffd88a' },
  pink: { o: '#5a2440', d: '#c86a9a', b: '#e894bc', l: '#f8bcd8', h: '#ffe0ee' },
};

function trunk(p, cx, top, bottom, w) {
  const T = '#7a4a2a', TD = '#5a3420', TL = '#9a6438';
  for (let y = top; y <= bottom; y++) {
    const flare = y > bottom - 2 ? 1 : 0;
    for (let x = cx - w - flare; x <= cx + w - 1 + flare; x++) {
      p.set(x, y, x >= cx + w - 2 + flare ? TD : x <= cx - w + flare ? TL : T);
    }
  }
  p.set(cx - 1, top + 3, TD); p.set(cx, top + 6, TD);
}

export function drawTree(seed, pal, big = false) {
  const rnd = mulberry32(seed);
  const W = big ? 46 : 36, H = big ? 56 : 44;
  const p = new PixelCanvas(W, H);
  const cx = W / 2;
  trunk(p, Math.floor(cx), H - (big ? 18 : 15), H - 2, big ? 3 : 2);
  const R = big ? 15 : 11.5;
  const ccy = big ? 22 : 17;
  const blobs = [];
  const n = 7 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.5;
    const d = R * (0.45 + rnd() * 0.25);
    blobs.push([cx + Math.cos(a) * d, ccy + Math.sin(a) * d * 0.85, R * (0.42 + rnd() * 0.18)]);
  }
  blobs.push([cx, ccy, R * 0.7]);
  blobs.sort((a, b) => a[1] - b[1]);
  for (const [bx, by, r] of blobs) p.circle(bx, by, r, pal.d);
  for (const [bx, by, r] of blobs) p.circle(bx - 0.6, by - 0.8, r - 1.2, pal.b);
  for (const [bx, by, r] of blobs) {
    if (by > ccy + R * 0.3) continue;
    p.circle(bx - r * 0.3, by - r * 0.35, r * 0.45, pal.l);
  }
  for (let i = 0; i < (big ? 14 : 9); i++) {
    const x = Math.floor(cx - R + rnd() * R * 2), y = Math.floor(ccy - R + rnd() * R * 1.4);
    if (p.isSet(x, y)) { p.set(x, y, pal.h); if (rnd() < 0.5) p.set(x + 1, y, pal.l); }
  }
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(cx - R + rnd() * R * 2), y = Math.floor(ccy + rnd() * R);
    if (p.isSet(x, y) && p.get(x, y) !== p.get(Math.floor(cx), H - 4)) p.set(x, y, pal.d);
  }
  return p.outline(pal.o);
}

export function drawPine(seed) {
  const rnd = mulberry32(seed);
  const p = new PixelCanvas(26, 46);
  trunk(p, 13, 36, 44, 2);
  const tiers = [[13, 32, 12], [13, 25, 10], [13, 18, 8], [13, 11, 6]];
  for (const [cx, base, hw] of tiers) {
    p.tri(cx - hw, base, cx + hw, base, cx, base - hw * 1.3, '#245f3b');
    p.tri(cx - hw + 2, base - 1, cx + 1, base - 1, cx, base - hw * 1.2, '#3a8a50');
    p.set(cx - 2 + Math.floor(rnd() * 3), base - 3, '#5aa868');
  }
  p.tri(10, 6, 16, 6, 13, -1, '#245f3b');
  return p.outline('#12301c');
}

export function drawBush(seed, berries = false) {
  const rnd = mulberry32(seed);
  const p = new PixelCanvas(20, 15);
  const pal = TREE_PALETTES.green;
  const blobs = [[6, 9, 5], [14, 9, 5], [10, 7, 5.5]];
  for (const [x, y, r] of blobs) p.circle(x, y, r, pal.d);
  for (const [x, y, r] of blobs) p.circle(x - 0.5, y - 0.8, r - 1.1, pal.b);
  for (const [x, y, r] of blobs) p.circle(x - r * 0.3, y - r * 0.4, r * 0.4, pal.l);
  if (berries) for (let i = 0; i < 5; i++) {
    const x = 3 + Math.floor(rnd() * 14), y = 4 + Math.floor(rnd() * 8);
    if (p.isSet(x, y)) p.set(x, y, i % 2 ? '#e0483e' : '#f05a8a');
  }
  return p.outline(pal.o);
}

// ---------------------------------------------------------------- buildings
const ROOFS = {
  straw: { b: '#e8c35a', d: '#c99a38', l: '#f5dc8a', o: '#8a5a1a', thatch: true },
  moss: { b: '#7fb050', d: '#5a8a38', l: '#a8d070', o: '#2e4a1a', thatch: true },
  red: { b: '#c8503c', d: '#9a3a2c', l: '#e8786a', o: '#5a1a14', thatch: false },
  blue: { b: '#4a74b8', d: '#33558a', l: '#7aa0d8', o: '#1a2a4a', thatch: false },
  teal: { b: '#3aa898', d: '#26786c', l: '#6ad0c0', o: '#0e3a34', thatch: false },
};

function roof(p, x0, x1, top, bottom, ridgeInset, R, seed) {
  const rnd = mulberry32(seed);
  for (let y = top; y <= bottom; y++) {
    const t = (y - top) / (bottom - top);
    const inset = Math.round(ridgeInset * (1 - t));
    for (let x = x0 + inset; x <= x1 - inset; x++) {
      let c = R.b;
      if (R.thatch) {
        const stripe = (x * 3 + Math.floor(y / 6) * 5) % 7;
        if (stripe === 0) c = R.d; else if (stripe === 3) c = R.l;
        if ((y - top) % 8 === 7) c = R.d;
        if ((y - top) % 8 === 0 && y > top) c = R.l;
      } else {
        const row = Math.floor((y - top) / 5);
        const off = row % 2 ? 3 : 0;
        if ((y - top) % 5 === 4) c = R.d;
        else if ((x + off) % 6 === 0) c = R.d;
        else if ((y - top) % 5 === 0) c = R.l;
      }
      if (x === x0 + inset || x === x1 - inset) c = R.d;
      p.set(x, y, c);
    }
  }
  // fringe bottom edge
  for (let x = x0; x <= x1; x++) {
    if (R.thatch && rnd() < 0.5) p.set(x, bottom + 1, R.d);
    p.set(x, bottom, R.d);
  }
  // ridge
  for (let x = x0 + ridgeInset; x <= x1 - ridgeInset; x++) { p.set(x, top, R.o); p.set(x, top + 1, R.d); }
}

function plankWall(p, x0, y0, x1, y1, base) {
  const d = shade(base, -0.2), l = shade(base, 0.12);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    let c = base;
    if ((y - y0) % 4 === 3) c = d;
    else if ((y - y0) % 4 === 0) c = l;
    if ((x * 7 + Math.floor((y - y0) / 4) * 13) % 23 === 0) c = d;
    p.set(x, y, c);
  }
}

function windowAt(p, x, y, w = 12, h = 11, box = true) {
  const F = '#6e4426';
  p.rect(x - 1, y - 1, w + 2, h + 2, F);
  p.rect(x, y, w, h, '#8fd3ff');
  p.rect(x, y, w, Math.floor(h / 2), '#a8e0ff');
  p.rect(x + Math.floor(w / 2), y, 1, h, F);
  p.rect(x, y + Math.floor(h / 2), w, 1, F);
  p.set(x + 1, y + 1, '#ffffff'); p.set(x + 2, y + 1, '#ffffff'); p.set(x + 1, y + 2, '#ffffff');
  if (box) {
    p.rect(x - 2, y + h + 1, w + 4, 3, '#8a5a32');
    for (let i = 0; i < w + 2; i += 2) p.set(x - 1 + i, y + h, i % 4 ? '#f05a8a' : '#ffd84a');
    for (let i = 1; i < w + 2; i += 3) p.set(x - 1 + i, y + h - 1, '#4f9a3a');
  }
}

export function drawHouse(variant = 'straw', wallColor = '#d49a5c', seed = 1, chimney = false) {
  const R = ROOFS[variant];
  const W = 88, H = 86;
  const p = new PixelCanvas(W, H);
  // walls
  plankWall(p, 8, 44, 79, 78, wallColor);
  // timber beams
  const beam = '#6e4426';
  for (const bx of [8, 9, 78, 79, 42, 43, 44, 45]) p.rect(bx, 44, 1, 35, beam);
  p.rect(8, 44, 72, 2, beam);
  // stone foundation
  for (let x = 6; x <= 81; x++) for (let y = 77; y <= 81; y++) {
    const c = ((x + (y % 2) * 3) % 6 === 0 || y === 79) ? '#6e6a70' : (y === 77 ? '#b4b0b8' : '#9a96a0');
    p.set(x, y, c);
  }
  windowAt(p, 17, 52); windowAt(p, 59, 52);
  // door
  p.rect(35, 54, 18, 25, beam);
  p.rect(37, 56, 14, 23, '#2a1a14');
  p.rect(37, 56, 14, 3, '#1a100c');
  p.rect(39, 78, 10, 1, '#3a2a20');
  // steps
  p.rect(33, 81, 22, 3, '#c4a882'); p.rect(33, 81, 22, 1, '#e0caa8'); p.rect(33, 83, 22, 1, '#9a7a5a');
  // lantern by door
  p.rect(55, 58, 3, 4, '#3a2a20'); p.set(56, 59, '#ffd84a'); p.set(56, 60, '#ffb03a');
  // chimney (behind roof edge)
  if (chimney) { p.rect(62, 2, 8, 14, '#8a7a7a'); p.rect(62, 2, 8, 2, '#5a4a4a'); for (let y = 5; y < 16; y += 3) p.rect(62, y, 8, 1, '#6e6060'); }
  // roof
  roof(p, 1, 86, 6, 46, 16, R, seed);
  if (!R.thatch) {
    // small gable window
    p.rect(39, 20, 10, 9, R.o); p.rect(40, 21, 8, 7, '#8fd3ff'); p.rect(44, 21, 1, 7, R.o); p.rect(40, 24, 8, 1, R.o);
  } else {
    p.rect(40, 22, 8, 6, R.o); p.rect(41, 23, 6, 4, '#3a2a14'); p.set(42, 24, '#ffd84a');
  }
  return p.outline(OUT);
}

export function drawBarn(seed = 3) {
  const W = 116, H = 98;
  const p = new PixelCanvas(W, H);
  const R = ROOFS.red, wall = '#b8443a';
  plankWall(p, 8, 46, 107, 90, wall);
  for (let x = 8; x <= 107; x += 6) p.rect(x, 46, 1, 45, shade(wall, -0.25));
  p.rect(8, 46, 100, 2, '#f3eedc'); p.rect(8, 46, 2, 45, '#f3eedc'); p.rect(106, 46, 2, 45, '#f3eedc');
  // big door with X
  p.rect(40, 58, 36, 33, '#f3eedc');
  p.rect(42, 60, 32, 31, '#2a1a14');
  p.line(42, 60, 57, 90, '#f3eedc'); p.line(73, 60, 58, 90, '#f3eedc');
  p.line(43, 60, 58, 90, '#f3eedc'); p.line(74, 60, 59, 90, '#f3eedc');
  p.rect(57, 60, 2, 31, '#f3eedc');
  // inner dark doorway for entry (center)
  p.rect(52, 74, 12, 17, '#1a100c');
  windowAt(p, 16, 60, 12, 10, false); windowAt(p, 88, 60, 12, 10, false);
  for (let x = 6; x <= 109; x++) for (let y = 90; y <= 93; y++) p.set(x, y, (x % 5 === 0 || y === 92) ? '#6e6a70' : '#9a96a0');
  roof(p, 0, 115, 4, 48, 22, R, seed);
  // hayloft
  p.rect(48, 18, 20, 16, '#f3eedc'); p.rect(50, 20, 16, 14, '#2a1a14');
  p.rect(51, 28, 14, 6, '#e8c35a'); p.set(53, 27, '#e8c35a'); p.set(60, 26, '#e8c35a');
  return p.outline(OUT);
}

export function drawShrine() {
  const W = 72, H = 80;
  const p = new PixelCanvas(W, H);
  const S = '#a8a4b4', SD = '#7a768a', SL = '#d0ccdc';
  // steps
  p.rect(18, 72, 36, 6, SD); p.rect(20, 72, 32, 2, SL);
  // walls / pillars
  p.rect(10, 38, 52, 35, S);
  for (let y = 38; y < 73; y += 6) p.rect(10, y, 52, 1, SD);
  for (let x = 10; x < 62; x += 9) for (let y = 38; y < 73; y += 12) p.set(x + ((y / 6) % 2 ? 4 : 0), y + 3, SD);
  p.rect(10, 38, 6, 35, SL); p.rect(56, 38, 6, 35, SD);
  // doorway
  p.rect(27, 50, 18, 23, '#2a1f3a');
  p.ellipse(36, 50, 9, 6, '#2a1f3a');
  // glowing sigil
  p.circle(36, 30, 4, '#7af0ff'); p.circle(36, 30, 2, '#ffffff');
  // roof
  roof(p, 2, 69, 8, 40, 18, ROOFS.teal, 11);
  p.tri(30, 10, 42, 10, 36, 2, ROOFS.teal.d);
  p.circle(36, 24, 4.5, '#2a1f3a'); p.circle(36, 24, 3, '#7af0ff'); p.set(36, 24, '#ffffff');
  return p.outline(OUT);
}

// ---------------------------------------------------------------- props
export function drawFenceH() {
  const p = new PixelCanvas(16, 14);
  const W = '#c48a52', D = '#8a5a32', L = '#e0aa6e';
  p.rect(0, 4, 16, 2, W); p.rect(0, 4, 16, 1, L); p.rect(0, 9, 16, 2, W); p.rect(0, 9, 16, 1, L);
  p.rect(0, 6, 16, 1, D); p.rect(0, 11, 16, 1, D);
  p.rect(1, 1, 3, 12, W); p.rect(1, 1, 3, 1, L); p.rect(3, 2, 1, 11, D);
  return p.outline(OUT);
}
export function drawFenceV() {
  const p = new PixelCanvas(8, 20);
  const W = '#c48a52', D = '#8a5a32', L = '#e0aa6e';
  p.rect(3, 0, 2, 18, W); p.rect(3, 0, 1, 18, L);
  p.rect(2, 1, 4, 5, W); p.rect(2, 1, 4, 1, L); p.rect(5, 2, 1, 4, D);
  return p.outline(OUT);
}
export function drawHay() {
  const p = new PixelCanvas(20, 16);
  p.ellipse(10, 9, 8.5, 6, '#e8c35a');
  p.ellipse(6, 9, 4, 5.5, '#f5dc8a');
  p.ellipse(6, 9, 2.4, 3.4, '#e8c35a'); p.ellipse(6, 9, 1, 1.5, '#c99a38');
  for (let x = 11; x < 18; x += 2) p.line(x, 4, x, 14, '#c99a38');
  p.rect(9, 3, 1, 13, '#c8453a');
  return p.outline(OUT);
}
export function drawCrate(open = false) {
  const p = new PixelCanvas(16, 16);
  const W = '#c48a52', D = '#8a5a32', L = '#e0aa6e';
  p.rect(1, 3, 14, 12, W);
  p.rect(1, 3, 14, 1, L); p.rect(1, 14, 14, 1, D);
  p.rect(1, 3, 2, 12, D); p.rect(13, 3, 2, 12, D);
  if (!open) { p.line(3, 4, 12, 13, D); p.line(3, 13, 12, 4, D); }
  else { p.rect(3, 4, 10, 8, '#3a2a1a'); p.rect(3, 4, 10, 1, '#1a100c'); }
  return p.outline(OUT);
}
export function drawBarrel(open = false) {
  const p = new PixelCanvas(14, 17);
  const W = '#a8703f', D = '#7a4a2a', L = '#c8905a';
  p.ellipse(7, 9, 6, 7, W);
  p.rect(1, 5, 12, 1, '#5a5a66'); p.rect(1, 12, 12, 1, '#5a5a66');
  p.rect(3, 3, 1, 12, L); p.rect(10, 3, 1, 12, D);
  p.ellipse(7, 3.5, 5, 1.6, open ? '#2a1a10' : L);
  return p.outline(OUT);
}
export function drawPot(broken = false) {
  const p = new PixelCanvas(12, 13);
  const C = '#d07a4a', D = '#a85a34';
  if (broken) {
    p.ellipse(6, 10, 5, 2, D); p.tri(2, 10, 4, 6, 5, 10, C); p.tri(7, 10, 9, 7, 10, 10, C);
    return p.outline(OUT);
  }
  p.ellipse(6, 8, 5, 4.5, C);
  p.rect(3, 2, 6, 3, C); p.rect(2, 2, 8, 1, D);
  p.paint((x, y) => (x > 7 && y > 5 ? D : null));
  p.rect(2, 7, 8, 1, '#f3eedc');
  return p.outline(OUT);
}
export function drawRock(big = false) {
  const p = new PixelCanvas(big ? 20 : 12, big ? 15 : 9);
  const S = '#a0a0aa', D = '#74747e', L = '#cacad2';
  if (big) { p.ellipse(10, 8.5, 9, 6, S); p.ellipse(7, 6, 4, 2.5, L); p.paint((x, y) => (y > 10 || x > 15 ? D : null)); }
  else { p.ellipse(6, 5, 5, 3.6, S); p.set(4, 3, L); p.set(5, 3, L); p.paint((x, y) => (y > 6 ? D : null)); }
  return p.outline(OUT);
}
export function drawStump() {
  const p = new PixelCanvas(16, 12);
  p.rect(3, 4, 10, 6, '#7a4a2a'); p.rect(11, 4, 2, 6, '#5a3420');
  p.ellipse(8, 4, 5, 2, '#d8b07a'); p.ellipse(8, 4, 2.5, 1, '#b48a5a');
  p.tri(1, 10, 4, 7, 4, 10, '#7a4a2a'); p.tri(15, 10, 12, 7, 12, 10, '#5a3420');
  return p.outline(OUT);
}
export function drawWell() {
  const p = new PixelCanvas(28, 34);
  p.rect(4, 4, 2, 22, '#7a4a2a'); p.rect(22, 4, 2, 22, '#7a4a2a');
  p.tri(1, 8, 27, 8, 14, 0, '#c8503c'); p.rect(1, 8, 27, 2, '#9a3a2c');
  p.rect(6, 12, 16, 1, '#5a3420'); p.rect(13, 12, 1, 6, '#8a8a8a'); p.rect(12, 17, 3, 3, '#7a4a2a');
  p.ellipse(14, 26, 11, 6, '#9a96a0');
  p.ellipse(14, 24, 8, 3.2, '#2a3a5a'); p.ellipse(14, 24.5, 6, 2, '#3a6a9a');
  for (let x = 4; x < 25; x += 4) p.set(x, 29, '#6e6a70');
  return p.outline(OUT);
}
export function drawLamp() {
  const p = new PixelCanvas(10, 30);
  p.rect(4, 8, 2, 20, '#3a3a46'); p.rect(3, 27, 4, 2, '#3a3a46');
  p.rect(2, 2, 6, 7, '#3a3a46'); p.rect(3, 3, 4, 5, '#ffe07a'); p.rect(4, 4, 2, 3, '#fff6c8');
  p.rect(1, 1, 8, 1, '#3a3a46'); p.set(4, 0, '#3a3a46'); p.set(5, 0, '#3a3a46');
  return p.outline(OUT);
}
export function drawSign() {
  const p = new PixelCanvas(16, 18);
  p.rect(7, 8, 2, 9, '#7a4a2a');
  p.rect(1, 2, 14, 8, '#c48a52'); p.rect(1, 2, 14, 1, '#e0aa6e'); p.rect(1, 9, 14, 1, '#8a5a32');
  p.rect(3, 4, 7, 1, '#5a3420'); p.rect(3, 6, 9, 1, '#5a3420');
  return p.outline(OUT);
}
export function drawCart() {
  const p = new PixelCanvas(38, 28);
  const W = '#8a6a4a', D = '#5a4430', L = '#a88a6a';
  p.rect(4, 8, 28, 12, W); p.rect(4, 8, 28, 2, L); p.rect(4, 18, 28, 2, D);
  for (let x = 8; x < 32; x += 6) p.rect(x, 10, 1, 8, D);
  p.rect(32, 14, 6, 2, D);
  p.ellipse(10, 21, 5, 5, '#5a4430'); p.ellipse(10, 21, 3, 3, '#a88a6a'); p.set(10, 21, '#3a2a1a');
  p.ellipse(27, 21, 5, 5, '#5a4430'); p.ellipse(27, 21, 3, 3, '#a88a6a'); p.set(27, 21, '#3a2a1a');
  p.ellipse(13, 7, 5, 3, '#e8c35a'); p.ellipse(22, 6, 5, 3, '#f2d06b');
  return p.outline(OUT);
}

// ---------------------------------------------------------------- ground decals (baked)
export function drawFlower(color) {
  const p = new PixelCanvas(5, 5);
  p.set(2, 1, color); p.set(1, 2, color); p.set(3, 2, color); p.set(2, 3, color);
  p.set(2, 2, '#ffe07a');
  p.set(2, 4, '#3f8a32');
  return p;
}
export function drawTuft(dark, light) {
  const p = new PixelCanvas(5, 4);
  p.set(0, 1, dark); p.set(1, 2, dark); p.set(2, 0, dark); p.set(2, 1, dark); p.set(3, 2, dark); p.set(4, 1, dark);
  p.set(2, 2, light);
  return p;
}
export function drawCrop(kind, stage = 1) {
  const p = new PixelCanvas(12, 12);
  if (kind === 'carrot') {
    p.rect(5, 8, 2, 2, '#f08a3c');
    p.line(6, 8, 3, 3, '#4fa34a'); p.line(6, 8, 6, 2, '#6cc24e'); p.line(6, 8, 9, 3, '#4fa34a');
    p.set(3, 3, '#8fd65a'); p.set(9, 3, '#8fd65a');
  } else if (kind === 'cabbage') {
    p.ellipse(6, 7, 4.5, 3.6, '#4fa34a'); p.ellipse(6, 6.5, 3, 2.4, '#8fd65a'); p.ellipse(6, 6, 1.4, 1.1, '#c8f0a0');
    p.outline('#2e6a2a');
  } else if (kind === 'wheat') {
    for (let i = 0; i < 4; i++) { const x = 2 + i * 3; p.line(x, 11, x, 4, '#c99a38'); p.rect(x - 1, 2, 2, 3, '#f2d06b'); }
  } else if (kind === 'pumpkin') {
    p.ellipse(6, 8, 5, 3.4, '#f08a3c'); p.rect(4, 5, 1, 6, '#c8642a'); p.rect(8, 5, 1, 6, '#c8642a'); p.rect(6, 3, 1, 2, '#4fa34a');
    p.outline('#7a3a14');
  } else if (kind === 'sprout') {
    p.set(6, 8, '#4fa34a'); p.set(5, 7, '#6cc24e'); p.set(7, 7, '#6cc24e'); p.set(4, 6, '#8fd65a'); p.set(8, 6, '#8fd65a');
  }
  return p;
}
export function drawLilyPad(seed) {
  const p = new PixelCanvas(10, 8);
  p.ellipse(5, 4, 4.5, 3.2, '#4fa34a');
  p.tri(5, 4, 9, 2, 9, 4, '#00000000');
  p.paint((x, y) => (x === 5 && y >= 4 ? '#3a7a32' : null));
  if (seed % 3 === 0) { p.circle(3, 3, 1.2, '#f8b8d8'); p.set(3, 3, '#ffe07a'); }
  return p;
}

// ---------------------------------------------------------------- interior furniture
export function drawBed(color = '#d84a5a') {
  const p = new PixelCanvas(20, 32);
  p.rect(1, 0, 18, 6, '#8a5a32'); p.rect(1, 0, 18, 1, '#a87a4a');
  p.rect(2, 6, 16, 24, '#8a5a32');
  p.rect(3, 6, 14, 6, '#f3eedc'); p.rect(4, 7, 12, 4, '#ffffff');
  p.rect(3, 12, 14, 17, color); p.rect(3, 12, 14, 2, shade(color, 0.2));
  for (let y = 16; y < 29; y += 4) p.rect(3, y, 14, 1, shade(color, -0.15));
  p.rect(1, 29, 18, 3, '#6e4426');
  return p.outline(OUT);
}
export function drawTable() {
  const p = new PixelCanvas(32, 22);
  p.rect(1, 2, 30, 12, '#b07a48'); p.rect(1, 2, 30, 2, '#d09a68'); p.rect(1, 13, 30, 2, '#7a4a2a');
  p.rect(3, 15, 3, 6, '#7a4a2a'); p.rect(26, 15, 3, 6, '#7a4a2a');
  p.ellipse(10, 7, 3, 2, '#f3eedc'); p.ellipse(10, 6.5, 2, 1, '#e8c35a');
  p.rect(20, 4, 3, 5, '#8fd3ff'); p.rect(20, 3, 3, 1, '#ffffff');
  return p.outline(OUT);
}
export function drawChair() {
  const p = new PixelCanvas(12, 16);
  p.rect(2, 0, 8, 7, '#9a6438'); p.rect(3, 1, 6, 5, '#b07a48');
  p.rect(1, 7, 10, 3, '#b07a48'); p.rect(2, 10, 2, 5, '#7a4a2a'); p.rect(8, 10, 2, 5, '#7a4a2a');
  return p.outline(OUT);
}
export function drawBookshelf(seed = 5) {
  const rnd = mulberry32(seed);
  const p = new PixelCanvas(32, 36);
  p.rect(0, 0, 32, 36, '#7a4a2a'); p.rect(2, 2, 28, 32, '#4a2a1a');
  const cols = ['#d84a5a', '#4a74b8', '#4fa34a', '#e8c35a', '#8a5ab8', '#f08a3c'];
  for (let shelf = 0; shelf < 3; shelf++) {
    const y0 = 3 + shelf * 11;
    p.rect(2, y0 + 9, 28, 2, '#7a4a2a');
    let x = 3;
    while (x < 28) {
      const w = 2 + Math.floor(rnd() * 2), h = 6 + Math.floor(rnd() * 3);
      if (rnd() < 0.15) { x += 3; continue; }
      const bc = cols[Math.floor(rnd() * cols.length)];
      p.rect(x, y0 + 9 - h, w, h, bc);
      p.rect(x + w - 1, y0 + 9 - h, 1, h, shade(bc, -0.25));
      x += w + (rnd() < 0.3 ? 1 : 0);
    }
  }
  return p.outline(OUT);
}
export function drawFireplace() {
  const p = new PixelCanvas(34, 34);
  const S = '#9a96a0', D = '#6e6a70';
  p.rect(1, 0, 32, 34, S);
  for (let y = 0; y < 34; y += 4) for (let x = (y / 4) % 2 ? 0 : 4; x < 34; x += 8) p.rect(x, y, 1, 4, D);
  for (let y = 3; y < 34; y += 4) p.rect(1, y, 32, 1, D);
  p.rect(0, 10, 34, 3, '#7a4a2a');
  p.rect(8, 18, 18, 16, '#1a100c');
  p.ellipse(17, 30, 6, 3, '#e0483e'); p.ellipse(17, 29, 4, 3, '#f6a03a'); p.ellipse(17, 28, 2, 2, '#ffe07a');
  p.rect(11, 31, 12, 2, '#5a3420');
  return p.outline(OUT);
}
export function drawChest(kind = 'wood', open = false) {
  const p = new PixelCanvas(18, 16);
  const pal = kind === 'gold'
    ? { b: '#e8b830', d: '#b08010', l: '#ffe07a', band: '#8a5a1a' }
    : kind === 'silver'
      ? { b: '#9aa8c0', d: '#6a7890', l: '#d0dcf0', band: '#4a5468' }
      : { b: '#b07a48', d: '#7a4a2a', l: '#d09a68', band: '#5a5a66' };
  p.rect(1, 7, 16, 8, pal.b); p.rect(1, 13, 16, 2, pal.d);
  if (!open) {
    p.rect(1, 2, 16, 6, pal.b); p.rect(1, 2, 16, 1, pal.l); p.rect(1, 7, 16, 1, pal.d);
    p.rect(3, 2, 2, 13, pal.band); p.rect(13, 2, 2, 13, pal.band);
    p.rect(7, 6, 4, 4, '#f4c430'); p.set(8, 8, '#2b1d24'); p.set(9, 8, '#2b1d24');
  } else {
    p.rect(1, 0, 16, 4, pal.d); p.rect(1, 0, 16, 1, pal.l);
    p.rect(2, 5, 14, 3, '#2a1a10');
    p.rect(3, 7, 2, 8, pal.band); p.rect(13, 7, 2, 8, pal.band);
  }
  return p.outline(OUT);
}
export function drawCupboard() {
  const p = new PixelCanvas(24, 30);
  p.rect(0, 0, 24, 30, '#9a6438'); p.rect(0, 0, 24, 2, '#b07a48');
  p.rect(2, 4, 9, 11, '#b07a48'); p.rect(13, 4, 9, 11, '#b07a48');
  p.rect(2, 17, 20, 5, '#b07a48'); p.rect(2, 24, 20, 5, '#b07a48');
  p.set(10, 9, '#f4c430'); p.set(13, 9, '#f4c430'); p.rect(11, 19, 2, 1, '#f4c430'); p.rect(11, 26, 2, 1, '#f4c430');
  return p.outline(OUT);
}
export function drawPlant() {
  const p = new PixelCanvas(14, 20);
  p.rect(3, 13, 8, 6, '#d07a4a'); p.rect(2, 13, 10, 2, '#a85a34');
  p.ellipse(7, 8, 5, 5, '#4fa34a'); p.ellipse(5, 6, 2.5, 2.5, '#6cc24e'); p.ellipse(9, 9, 2, 2, '#3a8a3a');
  return p.outline(OUT);
}
export function drawStove() {
  const p = new PixelCanvas(22, 26);
  p.rect(1, 4, 20, 21, '#4a4a56'); p.rect(1, 4, 20, 2, '#6a6a76');
  p.rect(4, 12, 14, 9, '#2a2a32'); p.rect(6, 15, 10, 4, '#f6a03a'); p.rect(8, 16, 6, 2, '#ffe07a');
  p.rect(8, 0, 4, 5, '#4a4a56');
  p.ellipse(7, 6, 3, 1.4, '#2a2a32'); p.ellipse(15, 6, 3, 1.4, '#2a2a32');
  return p.outline(OUT);
}
export function drawAltar() {
  const p = new PixelCanvas(28, 30);
  p.rect(2, 16, 24, 13, '#a8a4b4'); p.rect(2, 16, 24, 2, '#d0ccdc'); p.rect(2, 27, 24, 2, '#7a768a');
  p.tri(14, 0, 8, 10, 20, 10, '#7af0ff'); p.tri(14, 15, 8, 10, 20, 10, '#3ac0e0');
  p.line(14, 1, 11, 9, '#ffffff');
  return p.outline(OUT);
}
export function drawRug(w, h, color) {
  const p = new PixelCanvas(w, h);
  p.rect(0, 0, w, h, color);
  p.rect(2, 2, w - 4, h - 4, shade(color, 0.15));
  p.rect(4, 4, w - 8, h - 8, color);
  for (let x = 0; x < w; x += 2) { p.set(x, 0, '#f3eedc'); p.set(x, h - 1, '#f3eedc'); }
  return p;
}
export function drawClock() {
  const p = new PixelCanvas(12, 26);
  p.rect(1, 0, 10, 26, '#7a4a2a'); p.circle(6, 5, 3.5, '#f3eedc'); p.set(6, 4, '#2b1d24'); p.set(6, 5, '#2b1d24'); p.set(7, 5, '#2b1d24');
  p.rect(4, 11, 4, 11, '#4a2a1a'); p.circle(6, 18, 1.5, '#f4c430');
  return p.outline(OUT);
}
export function drawPainting(seed) {
  const p = new PixelCanvas(16, 12);
  p.rect(0, 0, 16, 12, '#c48a3a'); p.rect(1, 1, 14, 10, '#8fd3ff'); p.rect(1, 7, 14, 4, '#6cc24e');
  if (seed % 2) p.circle(11, 4, 1.6, '#ffe07a'); else p.tri(3, 7, 8, 2, 12, 7, '#7a768a');
  return p.outline(OUT);
}
