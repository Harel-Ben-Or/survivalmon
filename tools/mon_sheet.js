// Draws every survivalmon (species, same-species breeds, mixed breeds and their evolutions) on one
// sheet and saves it to mockups/snapshots/survivalmons.png through the dev server.
// Run in the dev page console: import('/tools/mon_sheet.js')
import { CREATURE } from '../src/gfx/art.js';
import { SPECIES, TYPES, BASE_IDS, PURE_IDS, MIXED_IDS } from '../src/content/species.js';

const W = 1080, COLS = 3, GAP = 20, PAD = 24, CW = (W - 2 * PAD - (COLS - 1) * GAP) / COLS;
const INK = '#2b1d24', BG = '#18262b', CARD = '#24434a', TEXT = '#f3eedc', MUTED = '#a9c2bd', GOLD = '#ffd84a';
const pureOf = Object.fromEntries(PURE_IDS.map((id) => [SPECIES[id].pair[0], id]));
const rows1 = Math.ceil(BASE_IDS.length / COLS), rows2 = Math.ceil(MIXED_IDS.length / COLS);
const H1 = 196, H2 = 236;
const H = 110 + 50 + rows1 * (H1 + GAP) + 60 + rows2 * (H2 + GAP) + 10;

const c = document.createElement('canvas');
c.width = W; c.height = H;
const ctx = c.getContext('2d');
ctx.imageSmoothingEnabled = false;
ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);

function sprite(id, cx, bottom, box) {
  const a = CREATURE[id];
  if (!a) return;
  const w = a.cw * 2, h = a.ch * 2, x0 = a.ax - w / 2, y0 = a.ay - h;
  const s = Math.min(box / w, box / h);
  ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(cx, bottom - 2, (w * s) * 0.36, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.drawImage(a.R, x0, y0, w, h, Math.round(cx - (w * s) / 2), Math.round(bottom - h * s), Math.round(w * s), Math.round(h * s));
}
function text(t, x, y, font, color, align = 'center') {
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillText(t, x, y);
}
function chips(types, cx, y) {
  ctx.font = '800 12px Nunito, sans-serif';
  const ws = types.map((t) => ctx.measureText(TYPES[t].name).width + 14);
  let x = cx - (ws.reduce((a, b) => a + b, 0) + (ws.length - 1) * 4) / 2;
  types.forEach((t, i) => {
    ctx.fillStyle = TYPES[t].color; ctx.beginPath(); ctx.roundRect(x, y - 13, ws[i], 18, 4); ctx.fill();
    text(TYPES[t].name, x + ws[i] / 2, y, '800 12px Nunito, sans-serif', INK);
    x += ws[i] + 4;
  });
}
function card(x, y, w, h) {
  ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(x - 3, y - 3, w + 6, h + 6, 10); ctx.fill();
  ctx.fillStyle = CARD; ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
}
function arrow(cx, cy) {
  ctx.fillStyle = GOLD; ctx.beginPath(); ctx.moveTo(cx - 8, cy - 9); ctx.lineTo(cx + 8, cy); ctx.lineTo(cx - 8, cy + 9); ctx.closePath(); ctx.fill();
}

await document.fonts.load('600 40px Fredoka'); await document.fonts.load('800 16px Nunito');
text('Survivalmon', W / 2, 62, '600 48px Fredoka, sans-serif', GOLD);
text('All 42: 6 species, 6 same-species breeds, 15 mixed breeds and their 15 evolutions', W / 2, 92, '700 17px Nunito, sans-serif', MUTED);

let y = 140;
text('Species  →  same-species breed (e.g. Voltowl + Voltowl)', PAD, y, '600 24px Fredoka, sans-serif', TEXT, 'left');
y += 22;
BASE_IDS.forEach((id, i) => {
  const x = PAD + (i % COLS) * (CW + GAP), yy = y + Math.floor(i / COLS) * (H1 + GAP);
  card(x, yy, CW, H1);
  const p = pureOf[id];
  sprite(id, x + CW * 0.25, yy + 120, 96); sprite(p, x + CW * 0.75, yy + 126, 112);
  arrow(x + CW / 2, yy + 80);
  text(SPECIES[id].name, x + CW * 0.25, yy + 150, '800 18px Nunito, sans-serif', TEXT);
  text(SPECIES[p].name, x + CW * 0.75, yy + 150, '800 18px Nunito, sans-serif', TEXT);
  chips(SPECIES[id].types, x + CW / 2, yy + 180);
});
y += rows1 * (H1 + GAP) + 34;
text('Mixed breeds  →  evolution (with a stone)', PAD, y, '600 24px Fredoka, sans-serif', TEXT, 'left');
y += 22;
MIXED_IDS.forEach((id, i) => {
  const sp = SPECIES[id], x = PAD + (i % COLS) * (CW + GAP), yy = y + Math.floor(i / COLS) * (H2 + GAP);
  card(x, yy, CW, H2);
  // parents
  const [a, b] = sp.pair;
  sprite(a, x + CW / 2 - 40, yy + 42, 34); sprite(b, x + CW / 2 + 40, yy + 42, 34);
  text('+', x + CW / 2, yy + 34, '800 20px Nunito, sans-serif', MUTED);
  sprite(id, x + CW * 0.25, yy + 160, 100); sprite(sp.evo, x + CW * 0.75, yy + 166, 116);
  arrow(x + CW / 2, yy + 118);
  text(sp.name, x + CW * 0.25, yy + 190, '800 18px Nunito, sans-serif', TEXT);
  text(SPECIES[sp.evo].name, x + CW * 0.75, yy + 190, '800 18px Nunito, sans-serif', TEXT);
  chips(sp.types, x + CW / 2, yy + 220);
});

const res = await fetch('/__snapshot', { method: 'POST', body: JSON.stringify({ name: 'survivalmons', data: c.toDataURL('image/png') }) });
window.__sheet = { status: await res.text(), w: W, h: H, missing: [...BASE_IDS, ...PURE_IDS, ...MIXED_IDS, ...MIXED_IDS.map((m) => SPECIES[m].evo)].filter((m) => !CREATURE[m]) };
