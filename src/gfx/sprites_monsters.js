// Procedural pixel art: monsters & bosses. All sprites face right (flip for left).
import { PixelCanvas, mk, drawScaled, recolor } from './pixel.js';
import { shade } from '../core/util.js';
import { OUT } from './sprites_chars.js';

const EYE = '#2b1d24';

function slime(k, pal, f, crown = false) {
  const W = Math.ceil(17 * k), H = Math.ceil(15 * k) + (crown ? Math.ceil(7 * k) : 0);
  const p = new PixelCanvas(W, H);
  const sq = [[1, 1], [1.12, 0.86], [0.9, 1.12]][f];
  const rx = 6.6 * k * sq[0], ry = 5.6 * k * sq[1];
  const base = H - 2;
  const cx = W / 2, cy = base - ry + 1.5 * k;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    if (dx * dx + dy * dy <= 1 && y <= base) {
      let c = pal.base;
      if (dy > 0.45 || dx > 0.6) c = pal.dark;
      p.set(x, y, c);
    }
  }
  p.ellipse(cx - rx * 0.45, cy - ry * 0.45, Math.max(1, 1.6 * k), Math.max(1, 1.1 * k), pal.light);
  const ey = Math.round(cy - ry * 0.05);
  const eh = Math.max(2, Math.round(2 * k)), ew = Math.max(1, Math.round(k));
  p.rect(Math.round(cx - 2.5 * k), ey, ew, eh, EYE);
  p.rect(Math.round(cx + 1.5 * k), ey, ew, eh, EYE);
  if (k >= 2) {
    p.rect(Math.round(cx - 2.5 * k), ey, ew, 1, '#ffffff');
    p.rect(Math.round(cx + 1.5 * k), ey, ew, 1, '#ffffff');
    p.rect(Math.round(cx - 1 * k), ey + eh + Math.round(k), Math.round(2 * k), Math.max(1, Math.round(k * 0.6)), shade(pal.dark, -0.3));
  }
  if (crown) {
    const top = Math.round(cy - ry) - 1;
    const cw = Math.round(9 * k), cx0 = Math.round(cx - cw / 2);
    const ch = Math.round(5 * k);
    p.rect(cx0, top - Math.round(2 * k), cw, Math.round(2 * k) + 1, '#f4c430');
    for (let i = 0; i < 3; i++) {
      const tx = cx0 + Math.round((i + 0.5) * cw / 3);
      p.tri(tx - 2 * k, top - 2 * k, tx + 2 * k, top - 2 * k, tx, top - ch, '#f4c430');
    }
    p.rect(cx0, top - Math.round(1.5 * k), cw, 1, '#c8901a');
    p.circle(cx, top - 1 * k, k * 0.9, '#e0483e');
  }
  return p.outline(OUT);
}

function bat(f) {
  const p = mk(22, 16);
  const B = '#7a4fb0', D = '#553480', W = '#9a6ad0';
  if (f === 0) { p.tri(10, 7, 1, 1, 6, 10, W); p.tri(12, 7, 21, 1, 16, 10, W); p.tri(10, 8, 3, 3, 7, 10, D); p.tri(12, 8, 19, 3, 15, 10, D); }
  else { p.tri(10, 7, 1, 13, 7, 6, W); p.tri(12, 7, 21, 13, 15, 6, W); p.tri(10, 8, 3, 12, 8, 7, D); p.tri(12, 8, 19, 12, 14, 7, D); }
  p.circle(11, 8, 3.8, B);
  p.tri(8, 6, 8, 2, 10, 5, B); p.tri(12, 5, 14, 2, 14, 6, B);
  p.set(9, 8, '#ffdd55'); p.set(12, 8, '#ffdd55');
  p.set(10, 10, '#ffffff'); p.set(12, 10, '#ffffff');
  return p.outline(OUT);
}

function shroom(f, pal = { cap: '#e0483e', capD: '#a83030', spot: '#fff2e0' }) {
  const p = mk(18, 19);
  const b = f % 2 ? -1 : 0;
  // feet
  p.rect(5, 16 + (f === 1 ? -1 : 0), 3, 2, '#c8a882');
  p.rect(10, 16 + (f === 3 ? -1 : 0), 3, 2, '#c8a882');
  p.rect(5, 9 + b, 8, 7 - b, '#f2e2c4');
  p.rect(11, 9 + b, 2, 7 - b, '#d8c4a0');
  p.ellipse(9, 6.5 + b, 7.6, 5, pal.cap);
  p.paint((x, y) => (y > 7 + b && p.get(x, y) === p.get(9, 4 + b) && (x < 6 || x > 12 || y > 9 + b) ? pal.capD : null));
  p.rect(2, 9 + b, 15, 1, pal.capD);
  p.circle(6, 4 + b, 1.4, pal.spot); p.circle(11.5, 3 + b, 1.1, pal.spot); p.circle(14, 6 + b, 1, pal.spot); p.set(9, 6 + b, pal.spot);
  p.rect(7, 11 + b, 1, 2, EYE); p.rect(11, 11 + b, 1, 2, EYE);
  p.set(6, 10 + b, EYE); p.set(12, 10 + b, EYE);
  return p.outline(OUT);
}

function wisp(f) {
  const p = mk(16, 18);
  const C = '#cfeaff', D = '#8fb8e8';
  p.ellipse(8, 7, 5.5, 5.5, C);
  p.rect(3, 7, 11, 6, C);
  for (let x = 3; x < 14; x++) {
    const wave = ((x + f * 2) % 4) < 2 ? 1 : 0;
    p.rect(x, 13, 1, 1 + wave, C);
    if (x > 9) p.rect(x, 9, 1, 5 + wave, D);
  }
  p.ellipse(6, 7, 1.2, 1.8, '#2b3a6a'); p.ellipse(10.5, 7, 1.2, 1.8, '#2b3a6a');
  p.set(8, 10, '#2b3a6a'); p.set(8, 11, '#2b3a6a');
  p.set(5, 4, '#ffffff'); p.set(6, 3, '#ffffff');
  return p.outline('#3a4a8a');
}

function beetle(f) {
  const p = mk(20, 16);
  const S = '#2f7f9f', D = '#1f5570', L = '#6fc4e0';
  const l = f ? 1 : 0;
  for (let i = 0; i < 3; i++) {
    p.line(5 + i * 4, 11, 3 + i * 4 + l, 14, '#2b1d24');
    p.line(7 + i * 4, 11, 8 + i * 4 - l, 14, '#2b1d24');
  }
  p.ellipse(9, 8, 7, 5, S);
  p.paint((x, y) => (y > 9 ? D : null));
  p.line(9, 3, 9, 12, D);
  p.set(6, 5, L); p.set(7, 5, L); p.set(5, 6, L);
  p.ellipse(16, 9, 3, 2.6, '#3a3a4a');
  p.tri(17, 7, 20, 3, 19, 8, '#4a4a5a');
  p.set(17, 9, '#ff6a4a');
  return p.outline(OUT);
}

function wolf(k, pal, f) {
  const W = Math.ceil(24 * k), H = Math.ceil(17 * k);
  const p = new PixelCanvas(W, H);
  const s = (v) => v * k;
  const legY = H - 2;
  const swing = f % 2 === 0 ? 1 : -1;
  const legs = [[s(6), swing], [s(9), -swing], [s(14), swing], [s(17), -swing]];
  for (const [lx, sw] of legs) {
    const lw = Math.max(1, Math.round(1.6 * k));
    p.rect(Math.round(lx + sw * k * 0.8), Math.round(s(10)), lw, legY - Math.round(s(10)) + 1, pal.dark);
  }
  // tail
  p.tri(s(5), s(7), s(0.5), s(3 + (f % 2)), s(3), s(9), pal.base);
  p.ellipse(s(11.5), s(9), s(7), s(3.8), pal.base);
  p.paint((x, y) => (y < s(7) && p.get(x, y) === p.get(Math.round(s(11.5)), Math.round(s(9))) ? pal.dark : null));
  p.ellipse(s(11), s(11), s(4.5), s(1.6), pal.light);
  // head
  p.circle(s(18.5), s(7.5), s(3.8), pal.base);
  p.tri(s(15.5), s(5), s(16.5), s(0.5), s(18.5), s(4.5), pal.dark);
  p.tri(s(18.5), s(4.5), s(20), s(0.5), s(21), s(5), pal.dark);
  p.ellipse(s(21.5), s(8.5), s(2.2), s(1.6), pal.light);
  p.set(Math.round(s(23)), Math.round(s(8)), '#2b1d24');
  p.rect(Math.round(s(19)), Math.round(s(6.5)), Math.max(1, Math.round(k)), Math.max(1, Math.round(k)), pal.eye);
  return p.outline(OUT);
}

function sporePuff(f) {
  const p = mk(18, 17);
  const b = f ? -1 : 0;
  p.ellipse(9, 9 + b, 7, 6 - (f ? 0.5 : 0), '#b07ad8');
  p.paint((x, y) => (y > 11 + b ? '#8a52b8' : null));
  p.circle(5, 6 + b, 1.2, '#e6c8ff'); p.circle(12, 5 + b, 1.4, '#e6c8ff'); p.circle(14, 9 + b, 1, '#e6c8ff'); p.circle(8, 4 + b, 0.8, '#e6c8ff');
  p.rect(6, 9 + b, 1, 2, EYE); p.rect(11, 9 + b, 1, 2, EYE);
  p.circle(8.5, 12.5 + b, 1.2, '#4a2a6a');
  p.rect(6, 15, 2, 1, '#6a3a90'); p.rect(11, 15, 2, 1, '#6a3a90');
  return p.outline(OUT);
}

function imp(f) {
  const p = mk(18, 18);
  const b = f ? -1 : 0;
  const R = '#d84a3a', D = '#a03028';
  p.tri(4, 7 + b, 0, 3 + b + f * 2, 3, 11 + b, '#7a2a3a');
  p.tri(14, 7 + b, 18, 3 + b + f * 2, 15, 11 + b, '#7a2a3a');
  p.line(4, 14, 1, 16, D); p.set(1, 15, D);
  p.ellipse(9, 11 + b, 4.5, 4, R);
  p.circle(9, 7 + b, 4, R);
  p.tri(5, 5 + b, 5, 0 + b, 7.5, 4 + b, '#f3eedc'); p.tri(10.5, 4 + b, 13, 0 + b, 13, 5 + b, '#f3eedc');
  p.set(7, 7 + b, '#ffe04a'); p.set(11, 7 + b, '#ffe04a');
  p.rect(8, 9 + b, 3, 1, '#5a1a1a');
  p.rect(6, 15, 2, 2, D); p.rect(11, 15, 2, 2, D);
  return p.outline(OUT);
}

function golem(k, pal, f) {
  const W = Math.ceil(22 * k), H = Math.ceil(23 * k);
  const p = new PixelCanvas(W, H);
  const s = (v) => Math.round(v * k);
  const st = f % 2 ? 1 : 0;
  p.rect(s(5), H - s(5) - (st ? s(1) : 0), s(5), s(4), pal.dark);
  p.rect(s(12), H - s(5) - (st ? 0 : s(1)), s(5), s(4), pal.dark);
  p.ellipse(11 * k, 11 * k, 8 * k, 7.6 * k, pal.base);
  p.paint((x, y) => (x + y * 0.6 > 20 * k ? pal.dark : (x + y < 11 * k ? pal.light : null)));
  // arms
  p.ellipse(2.8 * k, 13 * k + st, 2.7 * k, 4 * k, pal.dark);
  p.ellipse(19.2 * k, 13 * k - st, 2.7 * k, 4 * k, pal.dark);
  // moss
  p.ellipse(9 * k, 4.5 * k, 4.5 * k, 1.6 * k, '#6cc24e'); p.set(s(6), s(5.6), '#4f9a3a'); p.set(s(12), s(5.6), '#4f9a3a');
  // cracks
  p.line(s(8), s(14), s(10), s(17), pal.dark); p.line(s(14), s(9), s(15), s(12), pal.dark);
  // eyes
  p.rect(s(7), s(9), Math.max(1, s(2)), Math.max(1, s(1.4)), pal.eye);
  p.rect(s(13), s(9), Math.max(1, s(2)), Math.max(1, s(1.4)), pal.eye);
  return p.outline(OUT);
}

function treant(f) {
  const p = new PixelCanvas(60, 66);
  const T = '#7a4a2a', TD = '#5a3420', TL = '#9a6438';
  const sway = f % 2;
  // roots/legs
  p.tri(18, 52, 8, 64, 24, 58, TD); p.tri(42, 52, 52, 64, 36, 58, TD);
  p.rect(22, 54, 5, 10 - (f === 1 ? 2 : 0), TD); p.rect(33, 54, 5, 10 - (f === 3 ? 2 : 0), TD);
  p.ellipse(30, 44, 13, 14, T);
  p.paint((x, y) => (y > 30 && x > 36 ? TD : (y > 30 && x < 24 ? TL : null)));
  for (let y = 33; y < 58; y += 3) p.set(26 + (y % 5), y, TD);
  // arms (branches)
  p.line(18, 40, 6, 32 - sway, TD); p.line(18, 41, 6, 33 - sway, TD); p.line(8, 33 - sway, 4, 28 - sway, TD);
  p.line(42, 40, 54, 32 + sway, TD); p.line(42, 41, 54, 33 + sway, TD); p.line(52, 33 + sway, 57, 28 + sway, TD);
  // canopy
  const greens = ['#2e7a33', '#47a83f', '#6cc24e'];
  const blobs = [[30, 18, 17], [16, 24, 10], [44, 24, 10], [20, 12, 10], [40, 12, 10], [30, 6, 9]];
  for (const [bx, byy, r] of blobs) {
    p.circle(bx + sway * 0.5, byy, r, greens[0]);
    p.circle(bx - 1 + sway * 0.5, byy - 1, r - 1.5, greens[1]);
    p.circle(bx - r * 0.35, byy - r * 0.35, r * 0.4, greens[2]);
  }
  // face
  p.ellipse(25, 42, 2.5, 2, '#1a1010'); p.ellipse(35, 42, 2.5, 2, '#1a1010');
  p.set(25, 42, '#9aff6a'); p.set(35, 42, '#9aff6a');
  p.rect(26, 49, 8, 2, '#1a1010');
  p.line(22, 38, 27, 40, TD); p.line(38, 38, 33, 40, TD);
  return p.outline('#1d2a14');
}

function nightLord(f) {
  const p = new PixelCanvas(40, 48);
  const C = '#3a2a5a', D = '#22183a', L = '#5a4488';
  const b = f % 2 ? -1 : 0;
  // cloak
  p.tri(20, 10 + b, 4, 44 + b, 36, 44 + b, C);
  p.paint((x, y) => (x > 24 && y > 16 + b ? D : (x < 12 && y > 22 ? L : null)));
  for (let x = 4; x < 37; x += 4) p.tri(x, 43 + b, x + 4, 43 + b, x + 2, 47 + b - (f % 2) * ((x / 4) % 2), C);
  // hood
  p.circle(20, 12 + b, 8, C);
  p.ellipse(20, 14 + b, 5, 5, '#0e0a18');
  p.rect(16, 13 + b, 2, 2, '#ff5adc'); p.rect(22, 13 + b, 2, 2, '#ff5adc');
  // crown
  p.tri(12, 6 + b, 14, -1 + b, 16, 6 + b, '#f4c430'); p.tri(17, 5 + b, 20, -3 + b, 23, 5 + b, '#f4c430'); p.tri(24, 6 + b, 26, -1 + b, 28, 6 + b, '#f4c430');
  p.rect(12, 5 + b, 16, 2, '#c8901a');
  // hands & orbs
  p.circle(6, 28 + b, 2.5, '#8a7ab0'); p.circle(34, 28 + b, 2.5, '#8a7ab0');
  p.circle(5, 23 + b, 3, '#c050ff'); p.circle(35, 23 + b, 3, '#c050ff');
  p.set(4, 22 + b, '#ffffff'); p.set(34, 22 + b, '#ffffff');
  return p.outline('#0e0a18');
}

const P = {
  green: { base: '#6fd16a', dark: '#3e9a46', light: '#d4f7c0' },
  blue: { base: '#5ab0f0', dark: '#3a78c0', light: '#d0ecff' },
  red: { base: '#f06a5a', dark: '#b83a3a', light: '#ffd0c8' },
  purple: { base: '#b07ad8', dark: '#7a4aa8', light: '#ecd8ff' },
  king: { base: '#5ad08a', dark: '#2e9a5a', light: '#d4ffe4' },
  wolf: { base: '#8d8fa6', dark: '#5d5f78', light: '#d4d6e4', eye: '#ffd04a' },
  alpha: { base: '#5a4a7a', dark: '#3a2a5a', light: '#a898c8', eye: '#ff5a5a' },
  stone: { base: '#9a948a', dark: '#6e6a62', light: '#c4beb4', eye: '#5ae8ff' },
  colossus: { base: '#8a8478', dark: '#5e5a52', light: '#b8b2a6', eye: '#ff8a3a' },
};

// Each entry: frames (PixelCanvas[]), anchor at bottom-center.
export const MONSTER_DRAW = {
  slime: () => [0, 1, 0, 2].map((f) => slime(1, P.green, f)),
  slime_blue: () => [0, 1, 0, 2].map((f) => slime(1, P.blue, f)),
  slime_red: () => [0, 1, 0, 2].map((f) => slime(1, P.red, f)),
  bat: () => [0, 1].map(bat),
  shroom: () => [0, 1, 2, 3].map((f) => shroom(f)),
  shroom_blue: () => [0, 1, 2, 3].map((f) => shroom(f, { cap: '#4a7ad8', capD: '#2e4fa0', spot: '#d8f0ff' })),
  wisp: () => [0, 1].map(wisp),
  beetle: () => [0, 1].map(beetle),
  wolf: () => [0, 1, 2, 3].map((f) => wolf(1, P.wolf, f)),
  spore: () => [0, 1].map(sporePuff),
  imp: () => [0, 1].map(imp),
  golem: () => [0, 1].map((f) => golem(1, P.stone, f)),
  // bosses
  king_slime: () => [0, 1, 0, 2].map((f) => slime(3, P.king, f, true)),
  treant: () => [0, 1, 2, 3].map(treant),
  colossus: () => [0, 1].map((f) => golem(2.2, P.colossus, f)),
  alpha_wolf: () => [0, 1, 2, 3].map((f) => wolf(2, P.alpha, f)),
  night_lord: () => [0, 1].map(nightLord),
};
