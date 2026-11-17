// Procedural pixel art: item icons (16x16), pickups and projectiles.
import { PixelCanvas } from './pixel.js';
import { OUT } from './sprites_chars.js';

const I = () => new PixelCanvas(16, 16);

// Spirit: a small pale-blue wisp of light (the Spirit Shrine's currency)
function spiritWisp() {
  const p = I();
  p.tri(4, 9, 12, 9, 9, 1, '#5fd8f0');
  p.ellipse(8, 10.5, 4.6, 4.2, '#5fd8f0');
  p.tri(6, 9, 10, 9, 8.5, 3.5, '#bff4ff');
  p.ellipse(8, 11, 2.6, 2.4, '#bff4ff');
  p.ellipse(8, 11.5, 1.2, 1.1, '#ffffff');
  return p.outline(OUT);
}
// Evolution stone: faceted gem-like rock with a glowing rune
function stone(base, light, dark) {
  const p = I();
  p.ellipse(8, 9, 6, 6.5, base);
  p.paint((x, y) => (x + y < 13 ? light : x + y > 20 ? dark : null));
  p.line(6, 6, 10, 12, light); p.line(10, 6, 6, 12, light);
  p.set(8, 9, '#ffffff'); p.set(5, 5, '#ffffff');
  return p.outline(OUT);
}
const WOOD = '#b07a48', WOODD = '#7a4a2a', METAL = '#c4ccd8', METALD = '#7a8494';

export const ICONS = {
  // ---------------- weapons
  bow() { const p = I(); for (let a = -1.2; a <= 1.2; a += 0.05) p.set(5 + Math.cos(a) * 6, 8 + Math.sin(a) * 7, WOODD); for (let a = -1.1; a <= 1.1; a += 0.05) p.set(5 + Math.cos(a) * 5, 8 + Math.sin(a) * 6.5, WOOD); p.line(7, 2, 7, 14, '#f3eedc'); p.line(3, 8, 14, 8, '#8a5a32'); p.tri(13, 6, 13, 10, 15.5, 8, METAL); p.rect(3, 7, 2, 3, '#e0483e'); return p.outline(OUT); },
  pitchfork() { const p = I(); p.line(2, 14, 10, 6, WOOD); p.line(3, 14, 11, 6, WOODD); p.rect(9, 5, 3, 3, METALD); p.line(10, 4, 10, 1, METAL); p.line(12, 6, 15, 6, METAL); p.line(11, 5, 14, 2, METAL); return p.outline(OUT); },
  emberwand() { const p = I(); p.line(3, 14, 10, 7, '#6a3a1a'); p.line(4, 14, 11, 7, '#8a5a32'); p.circle(11.5, 4.5, 3, '#e0483e'); p.circle(11.5, 4.5, 2, '#f6a03a'); p.circle(11, 4, 1, '#ffe07a'); return p.outline(OUT); },
  boomerang() { const p = I(); p.tri(2, 4, 6, 2, 10, 12, '#d8843a'); p.tri(10, 12, 14, 9, 12, 14, '#d8843a'); p.tri(6, 7, 13, 10, 10, 13, '#d8843a'); p.line(3, 4, 9, 11, '#f6b86a'); p.set(4, 3, '#e0483e'); p.set(13, 11, '#e0483e'); return p.outline(OUT); },
  leaves() { const p = I(); const leaf = (x, y, c) => { p.ellipse(x, y, 2.6, 1.6, c); p.set(Math.round(x), Math.round(y), '#c8f0a0'); }; leaf(8, 3, '#6cc24e'); leaf(13, 8, '#4fa34a'); leaf(8, 13, '#6cc24e'); leaf(3, 8, '#4fa34a'); p.circle(8, 8, 1.4, '#f3eedc'); return p.outline(OUT); },
  thornaura() { const p = I(); for (let a = 0; a < Math.PI * 2; a += 0.08) p.set(8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, '#4f8a3a'); for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) p.tri(8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, 8 + Math.cos(a + 0.3) * 6, 8 + Math.sin(a + 0.3) * 6, 8 + Math.cos(a + 0.15) * 8, 8 + Math.sin(a + 0.15) * 8, '#8a6a3a'); p.circle(8, 8, 2, '#e0483e'); return p.outline(OUT); },
  lightrod() { const p = I(); p.line(3, 14, 10, 6, '#5a5a6a'); p.line(4, 14, 11, 6, '#8a8a9a'); p.circle(11.5, 4.5, 2.4, '#5ae8ff'); p.line(12, 1, 10, 4, '#ffe07a'); p.line(10, 4, 13, 4, '#ffe07a'); p.line(13, 4, 11, 7, '#ffe07a'); return p.outline(OUT); },
  bombs() { const p = I(); p.circle(7, 10, 5, '#3a3a4a'); p.circle(5.5, 8.5, 1.5, '#7a7a8a'); p.rect(9, 4, 3, 2, '#8a8a9a'); p.line(11, 4, 13, 1, '#c8a46a'); p.set(13, 1, '#ffe07a'); p.set(14, 0, '#f6a03a'); return p.outline(OUT); },
  scythe() { const p = I(); for (let a = Math.PI; a < Math.PI * 1.9; a += 0.04) { p.set(9 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, METAL); p.set(9 + Math.cos(a) * 5, 8 + Math.sin(a) * 5, '#e8eef8'); } p.line(9, 3, 9, 15, '#6a4a8a'); p.circle(9, 8, 1, '#c050ff'); return p.outline(OUT); },
  sling() { const p = I(); p.line(8, 15, 8, 9, WOODD); p.line(8, 9, 4, 3, WOOD); p.line(8, 9, 12, 3, WOOD); p.line(4, 3, 8, 7, '#c8453a'); p.line(12, 3, 8, 7, '#c8453a'); p.circle(8, 6.5, 1.6, '#9a9aa6'); return p.outline(OUT); },

  // ---------------- spells
  fireball() { const p = I(); p.tri(1, 14, 7, 6, 10, 11, '#e0483e'); p.circle(10, 6, 5, '#e0483e'); p.circle(10.5, 5.5, 3.5, '#f6a03a'); p.circle(11, 5, 2, '#ffe07a'); return p.outline(OUT); },
  frostnova() { const p = I(); const c = '#8fd8ff'; p.line(8, 1, 8, 15, c); p.line(1, 8, 15, 8, c); p.line(3, 3, 13, 13, c); p.line(13, 3, 3, 13, c); p.circle(8, 8, 2, '#ffffff'); for (const [x, y] of [[8, 1], [8, 15], [1, 8], [15, 8]]) p.set(x, y, '#ffffff'); return p.outline('#1a3a6a'); },
  chainlight() { const p = I(); const c = '#ffe07a'; p.line(10, 0, 5, 7, c); p.line(5, 7, 10, 8, c); p.line(10, 8, 5, 15, c); p.line(11, 0, 6, 7, '#fff6c8'); p.line(11, 8, 6, 15, '#f6c83a'); return p.outline('#5a4a1a'); },
  heal() { const p = I(); for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) p.ellipse(8 + Math.cos(a) * 4, 8 + Math.sin(a) * 4, 2.6, 2.6, '#f5a0c8'); p.circle(8, 8, 2.6, '#ffe07a'); p.rect(7, 6, 2, 5, '#4fa34a'); p.rect(6, 7, 4, 2, '#4fa34a'); p.rect(7.5, 6.5, 1, 4, '#ffffff'); return p.outline(OUT); },
  meteor() { const p = I(); p.line(1, 1, 8, 8, '#f6a03a'); p.line(2, 1, 9, 8, '#ffe07a'); p.line(1, 2, 8, 9, '#e0483e'); p.circle(10, 10, 4.5, '#7a5a4a'); p.circle(9, 9, 2, '#a8826a'); p.set(12, 12, '#4a3a2a'); return p.outline(OUT); },
  gale() { const p = I(); for (let t = 0; t < 12; t += 0.05) { const r = t * 0.55; p.set(8 + Math.cos(t) * r, 8 + Math.sin(t) * r * 0.8, t > 6 ? '#c8f0ff' : '#ffffff'); } return p.outline('#3a6a8a'); },
  thornfield() { const p = I(); for (let i = 0; i < 4; i++) { const x = 2 + i * 4; p.tri(x - 1, 15, x + 2, 15, x + 0.5, 4 + (i % 2) * 3, i % 2 ? '#4f8a3a' : '#6cc24e'); } p.set(4, 8, '#e0483e'); p.set(12, 9, '#e0483e'); return p.outline(OUT); },

  // ---------------- artifacts
  clover() { const p = I(); const g = '#4fc04a'; p.circle(5.5, 5.5, 3, g); p.circle(10.5, 5.5, 3, g); p.circle(5.5, 10.5, 3, g); p.circle(10.5, 10.5, 3, g); p.circle(8, 8, 1.5, '#8fe06a'); p.line(10, 11, 14, 15, '#3a7a32'); return p.outline(OUT); },
  feather() { const p = I(); p.ellipse(9, 7, 3.5, 6.5, '#8fd8ff'); p.ellipse(8.5, 6, 1.6, 4.5, '#d8f4ff'); p.line(11, 2, 5, 15, '#4a74b8'); return p.outline(OUT); },
  fang() { const p = I(); p.tri(4, 2, 12, 2, 8, 15, '#f3eedc'); p.tri(6, 2, 10, 2, 8, 10, '#ffffff'); p.circle(8, 14, 1.2, '#e0483e'); p.rect(4, 1, 8, 2, '#c8453a'); return p.outline(OUT); },
  shell() { const p = I(); p.ellipse(8, 9, 6.5, 5.5, '#7a8a9a'); p.ellipse(8, 8, 4.5, 3.5, '#a8b8c8'); for (let x = 4; x <= 12; x += 3) p.line(8, 4, x, 13, '#5a6a7a'); return p.outline(OUT); },
  magnet() { const p = I(); for (let a = Math.PI; a <= Math.PI * 2; a += 0.05) for (let r = 3; r <= 6; r++) p.set(8 + Math.cos(a) * r, 8 + Math.sin(a) * r, '#e0483e'); p.rect(2, 8, 4, 5, '#e0483e'); p.rect(10, 8, 4, 5, '#e0483e'); p.rect(2, 11, 4, 2, '#e8eef8'); p.rect(10, 11, 4, 2, '#e8eef8'); return p.outline(OUT); },
  hourglass() { const p = I(); p.rect(3, 1, 10, 2, WOODD); p.rect(3, 13, 10, 2, WOODD); p.tri(4, 3, 12, 3, 8, 8, '#d8f4ff'); p.tri(4, 13, 12, 13, 8, 8, '#d8f4ff'); p.tri(6, 13, 10, 13, 8, 10, '#f2d06b'); p.tri(6, 4, 10, 4, 8, 6, '#f2d06b'); return p.outline(OUT); },
  ring() { const p = I(); p.circle(8, 10, 5, '#f4c430'); p.circle(8, 10, 3, '#00000000'); p.circle(8, 3.5, 2.6, '#c050ff'); p.set(7, 3, '#ffffff'); return p.outline(OUT); },
  mirror() { const p = I(); p.ellipse(8, 6, 5, 5.5, '#c48a3a'); p.ellipse(8, 6, 3.6, 4, '#bfeaff'); p.line(6, 3, 7, 5, '#ffffff'); p.rect(7, 11, 2, 4, '#c48a3a'); return p.outline(OUT); },
  oilflask() { const p = I(); p.ellipse(8, 10, 5, 4.5, '#3a3a4a'); p.ellipse(8, 11, 4, 3, '#2a2a32'); p.rect(6, 2, 4, 5, '#7a7a8a'); p.rect(6, 1, 4, 1, WOODD); p.set(9, 13, '#f6a03a'); p.set(6, 9, '#7a7a8a'); return p.outline(OUT); },
  frostcrystal() { const p = I(); p.tri(8, 1, 3, 8, 13, 8, '#8fd8ff'); p.tri(8, 15, 3, 8, 13, 8, '#5ab0f0'); p.line(8, 2, 6, 7, '#ffffff'); return p.outline('#1a3a6a'); },
  stormcharm() { const p = I(); p.circle(8, 9, 5.5, '#3b5bd1'); p.line(9, 4, 6, 9, '#ffe07a'); p.line(6, 9, 10, 9, '#ffe07a'); p.line(10, 9, 7, 14, '#ffe07a'); p.rect(7, 1, 2, 3, '#c8a46a'); return p.outline(OUT); },
  collar() { const p = I(); for (let a = 0; a < Math.PI * 2; a += 0.05) { p.set(8 + Math.cos(a) * 5.5, 7 + Math.sin(a) * 4, '#c8453a'); p.set(8 + Math.cos(a) * 4.5, 7 + Math.sin(a) * 3.2, '#e0583e'); } p.circle(8, 12.5, 2.2, '#f4c430'); p.set(8, 12, '#fff6a0'); return p.outline(OUT); },
  phoenix() { const p = I(); p.ellipse(8, 7, 3.5, 6.5, '#f6a03a'); p.ellipse(8, 6, 1.8, 4.5, '#ffe07a'); p.tri(4, 12, 8, 10, 5, 15, '#e0483e'); p.tri(12, 12, 8, 10, 11, 15, '#e0483e'); p.line(10, 1, 6, 14, '#c8642a'); return p.outline(OUT); },
  thornmail() { const p = I(); p.rect(3, 4, 10, 10, '#7a8a9a'); p.rect(3, 4, 10, 2, '#a8b8c8'); p.rect(1, 4, 2, 5, '#7a8a9a'); p.rect(13, 4, 2, 5, '#7a8a9a'); p.rect(6, 2, 4, 2, '#5a6a7a'); for (const [x, y] of [[4, 8], [8, 7], [11, 10], [6, 11]]) { p.set(x, y, '#4f8a3a'); p.set(x + 1, y - 1, '#6cc24e'); } return p.outline(OUT); },
  monocle() { const p = I(); p.circle(7, 7, 5, '#f4c430'); p.circle(7, 7, 3.6, '#bfeaff'); p.line(5, 5, 6, 4, '#ffffff'); p.line(11, 11, 15, 15, '#c8a46a'); return p.outline(OUT); },
  berrypouch() { const p = I(); p.ellipse(8, 10, 6, 5, '#a8703f'); p.rect(5, 3, 6, 3, '#a8703f'); p.rect(4, 5, 8, 1, '#c8453a'); p.circle(6, 3, 1.4, '#e0483e'); p.circle(9.5, 2.5, 1.4, '#8a4ad8'); p.circle(11, 4, 1.2, '#e0483e'); return p.outline(OUT); },

  // ---------------- catching & evolution
  berry() { const p = new PixelCanvas(11, 11); p.circle(4, 7, 2.8, '#e0483e'); p.circle(7.5, 6.5, 2.6, '#8a4ad8'); p.set(3, 6, '#ffb0b0'); p.set(7, 5, '#d8b0ff'); p.tri(5, 3, 9, 1, 8, 4, '#4fa34a'); p.line(5, 4, 5, 2, '#3a7a32'); return p.outline(OUT); },
  stone_fire() { return stone('#f06a2a', '#ffd06a', '#a8361a'); },
  spirit() { return spiritWisp(); },
  stone_water() { return stone('#3a8ae0', '#9ad8ff', '#1a4a90'); },
  stone_grass() { return stone('#4fb04a', '#b8f08a', '#2a6a2a'); },
  stone_storm() { return stone('#e8c030', '#fff6a0', '#9a7a10'); },
  stone_rock() { return stone('#a08a70', '#d8c8a8', '#5a4a3a'); },
  stone_fairy() { return stone('#e88ad8', '#ffd8f8', '#a04a98'); },
  stone_shadow() { return stone('#6a4ab0', '#b8a0f0', '#3a2470'); },
  stone_ice() { return stone('#7ad0f0', '#e8fbff', '#2a7aa0'); },
  stone_toxic() { return stone('#8a4ac0', '#c8f070', '#4a2470'); },
  stone_metal() { return stone('#8a98ac', '#e0e8f0', '#4a5466'); },

  // ---------------- misc
  egg() { const p = I(); p.ellipse(8, 9, 5, 6.5, '#fff6e0'); p.circle(6, 7, 1.4, '#6cc24e'); p.circle(10, 11, 1.6, '#f6a03a'); p.circle(10, 5, 1, '#5ab0f0'); p.set(5, 5, '#ffffff'); return p.outline(OUT); },
  coin() { const p = new PixelCanvas(9, 9); p.circle(4.5, 4.5, 4, '#f4c430'); p.circle(4.5, 4.5, 2.6, '#ffe07a'); p.rect(4, 3, 1, 3, '#c8901a'); return p.outline(OUT); },
  heart() { const p = new PixelCanvas(11, 10); p.circle(3, 3.5, 2.6, '#e0483e'); p.circle(8, 3.5, 2.6, '#e0483e'); p.tri(0.5, 4.5, 10.5, 4.5, 5.5, 9.5, '#e0483e'); p.set(2, 2, '#ffb0b0'); p.set(3, 2, '#ffffff'); return p.outline(OUT); },
  gem_s() { const p = new PixelCanvas(7, 9); p.tri(3.5, 0, 0, 4, 7, 4, '#7ad8ff'); p.tri(3.5, 9, 0, 4, 7, 4, '#3a9ae0'); p.set(2, 3, '#ffffff'); return p.outline('#1a3a6a'); },
  gem_m() { const p = new PixelCanvas(8, 10); p.tri(4, 0, 0, 4.5, 8, 4.5, '#7af08a'); p.tri(4, 10, 0, 4.5, 8, 4.5, '#2eb84a'); p.set(2, 3, '#ffffff'); return p.outline('#0e4a1a'); },
  gem_l() { const p = new PixelCanvas(10, 12); p.tri(5, 0, 0, 5.5, 10, 5.5, '#f07ae8'); p.tri(5, 12, 0, 5.5, 10, 5.5, '#b03ab8'); p.set(3, 3, '#ffffff'); p.set(3, 4, '#ffffff'); return p.outline('#4a0e4a'); },
  magnet_pick() { const p = new PixelCanvas(12, 12); for (let a = Math.PI; a <= Math.PI * 2; a += 0.05) for (let r = 2; r <= 4.5; r++) p.set(6 + Math.cos(a) * r, 6 + Math.sin(a) * r, '#e0483e'); p.rect(1, 6, 3, 4, '#e0483e'); p.rect(8, 6, 3, 4, '#e0483e'); p.rect(1, 9, 3, 2, '#e8eef8'); p.rect(8, 9, 3, 2, '#e8eef8'); return p.outline(OUT); },
  bomb_pick() { const p = new PixelCanvas(12, 12); p.circle(6, 7, 4.5, '#3a3a4a'); p.set(4, 5, '#9a9aa6'); p.rect(7, 1, 2, 2, '#c8a46a'); p.set(9, 0, '#ffe07a'); return p.outline(OUT); },
  chest_pick() { const p = new PixelCanvas(16, 14); p.rect(1, 5, 14, 8, '#e8b830'); p.rect(1, 1, 14, 5, '#ffd84a'); p.rect(1, 5, 14, 1, '#b08010'); p.rect(6, 4, 4, 4, '#c050ff'); return p.outline(OUT); },
};

// ---------------------------------------------------------------- projectiles
export const PROJ = {
  arrow() { const p = new PixelCanvas(12, 5); p.rect(2, 2, 8, 1, '#c48a52'); p.tri(9, 0, 9, 4, 12, 2, METAL); p.rect(0, 1, 3, 1, '#f3eedc'); p.rect(0, 3, 3, 1, '#f3eedc'); return p; },
  ember() { const p = new PixelCanvas(8, 8); p.circle(4, 4, 3.6, '#e0483e'); p.circle(4, 4, 2.4, '#f6a03a'); p.circle(4, 4, 1.2, '#ffe07a'); return p; },
  leaf() { const p = new PixelCanvas(9, 7); p.ellipse(4.5, 3.5, 4, 2.4, '#6cc24e'); p.line(1, 4, 8, 3, '#3a7a32'); return p.outline('#1d4a22'); },
  boomerang() { const p = new PixelCanvas(12, 12); p.tri(1, 3, 5, 1, 10, 10, '#d8843a'); p.tri(10, 10, 11, 6, 6, 6, '#d8843a'); p.line(2, 3, 9, 9, '#f6b86a'); return p.outline(OUT); },
  bomb() { const p = new PixelCanvas(9, 10); p.circle(4.5, 6, 3.6, '#3a3a4a'); p.set(3, 4, '#9a9aa6'); p.rect(4, 1, 1, 2, '#c8a46a'); p.set(5, 0, '#ffe07a'); return p.outline(OUT); },
  pebble() { const p = new PixelCanvas(5, 5); p.circle(2.5, 2.5, 2.2, '#9a9aa6'); p.set(1, 1, '#d0d0da'); return p.outline(OUT); },
  spore() { const p = new PixelCanvas(7, 7); p.circle(3.5, 3.5, 3, '#c88aff'); p.circle(3, 3, 1.4, '#f0d8ff'); return p.outline('#4a2a6a'); },
  imp_fire() { const p = new PixelCanvas(8, 8); p.circle(4, 4, 3.4, '#c050ff'); p.circle(4, 4, 2, '#ff8af0'); p.set(3, 3, '#ffffff'); return p; },
  boulder() { const p = new PixelCanvas(14, 14); p.circle(7, 7, 6, '#8a8478'); p.circle(5, 5, 2.6, '#b8b2a6'); p.set(9, 10, '#5e5a52'); p.set(10, 9, '#5e5a52'); return p.outline(OUT); },
  bubble() { const p = new PixelCanvas(8, 8); p.circle(4, 4, 3.5, '#8fe0ff'); p.circle(4, 4, 2.4, '#c8f2ff'); p.set(2, 2, '#ffffff'); return p.outline('#2f8fa8'); },
  fireball() { const p = new PixelCanvas(14, 14); p.circle(7, 7, 6.4, '#e0483e'); p.circle(7, 7, 4.8, '#f6a03a'); p.circle(6.5, 6.5, 2.8, '#ffe07a'); p.circle(6, 6, 1.2, '#ffffff'); return p; },
  meteor() { const p = new PixelCanvas(16, 16); p.circle(8, 8, 6, '#7a5a4a'); p.circle(6.5, 6.5, 3, '#a8826a'); p.set(10, 10, '#4a3a2a'); return p.outline('#e0483e'); },
  dark_orb() { const p = new PixelCanvas(8, 8); p.circle(4, 4, 3.6, '#5a2a8a'); p.circle(4, 4, 2.2, '#c050ff'); p.set(3, 3, '#ffffff'); return p; },
  root() { const p = new PixelCanvas(10, 14); p.tri(1, 14, 6, 14, 4, 2, '#7a4a2a'); p.tri(5, 14, 9, 14, 7, 5, '#5a3420'); p.set(4, 3, '#6cc24e'); return p.outline(OUT); },
};
