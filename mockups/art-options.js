// Art-direction preview: the same little scene drawn three ways.
import { buildAssets, HERO, PET, MON, SPR, ICON, PC, drawNumber } from '../src/gfx/assets.js';
import { hash2 } from '../src/core/util.js';

const INK = '#2b1d24';
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- pixel scenes (A, C)
function pixelScene(cv, polished) {
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  const W = cv.width, H = cv.height;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const h = hash2(x, y, 3);
    g.fillStyle = h < 0.03 ? '#5fae3e' : h < 0.045 ? '#92d862' : (hash2(x >> 4, y >> 4, 9) < 0.5 ? '#74c44c' : '#6dbd48');
    g.fillRect(x, y, 1, 1);
  }
  for (let x = 0; x < W; x++) {
    const top = 74 + Math.round(Math.sin(x * 0.13) * 1.5 + hash2(x, 1, 2) * 1.4), bot = 92 + Math.round(Math.cos(x * 0.11) * 1.5);
    g.fillStyle = '#539a38'; g.fillRect(x, top - 1, 1, 1);
    g.fillStyle = '#b38a56'; g.fillRect(x, top, 1, 1); g.fillRect(x, bot, 1, 1);
    g.fillStyle = '#e3c48c'; g.fillRect(x, top + 1, 1, bot - top - 1);
    if (hash2(x, 5, 7) < 0.15) { g.fillStyle = '#d4b07a'; g.fillRect(x, top + 3 + ((x * 7) % 10), 1, 1); }
  }
  const put = (spr, x, y) => g.drawImage(spr.frames[0], Math.round(x - spr.ax), Math.round(y - spr.ay));
  for (const [k, x, y] of [['flower_r', 120, 30], ['flower_y', 128, 34], ['flower_w', 20, 96], ['flower_p', 180, 100], ['tuft', 60, 40], ['tuft', 150, 60]]) g.drawImage(PC[k].toCanvas(), x, y);
  put(SPR.tree_green_1, 30, 64);
  put(SPR.bush_1, 176, 50);
  put(SPR.tree_autumn_0, 186, 28);
  const pet = PET.emberpup, hero = HERO.rowan, slime = MON.slime;
  if (polished) {
    g.globalAlpha = 0.5; g.fillStyle = '#ffb030';
    g.beginPath(); g.ellipse(66, 86, 12, 4, 0, 0, TAU); g.fill();
    g.globalAlpha = 1; g.strokeStyle = '#ffd84a'; g.lineWidth = 1;
    g.beginPath(); g.ellipse(66, 86, 12, 4, 0, 0, TAU); g.stroke();
  }
  g.globalAlpha = 0.3; g.fillStyle = '#1a2a10';
  for (const [x, y, r] of [[66, 86, 6], [96, 86, 6], [152, 86, 7]]) { g.beginPath(); g.ellipse(x, y, r, 2.5, 0, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
  g.drawImage(pet.right[0], 66 - pet.ax, 86 - pet.ay);
  g.drawImage(hero.dirs.right[1], 96 - hero.ax, 86 - hero.ay);
  g.drawImage(slime.L[1], 152 - slime.ax, 86 - slime.ay);
  g.drawImage(SPR.p_ember.frames[0], 124, 70);
  for (const [x, y] of [[112, 96], [118, 99], [170, 72]]) g.drawImage(ICON.gem_s, x, y);
  drawNumber(g, 14, 152, 52, 'crit', 2);
  if (polished) {
    g.fillStyle = '#fff6c8';
    for (const [x, y] of [[58, 66], [76, 70], [150, 58], [104, 58]]) { g.fillRect(x, y - 1, 1, 3); g.fillRect(x - 1, y, 3, 1); }
  }
}

// ---------------------------------------------------------------- cartoon helpers (B, C)
function stroke(g, lw = 5) { g.lineWidth = lw; g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
function ell(g, x, y, rx, ry, fill, lw = 5, rot = 0) {
  g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fillStyle = fill; g.fill(); if (lw) stroke(g, lw);
}
// fill a path, shade its lower-right part, then outline it
function toon(g, build, fill, shade, shadeFn, lw = 5) {
  const p = new Path2D(); build(p);
  g.fillStyle = fill; g.fill(p);
  if (shade) { g.save(); g.clip(p); g.fillStyle = shade; g.beginPath(); shadeFn(g); g.fill(); g.restore(); }
  if (lw) { g.lineWidth = lw; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke(p); }
}
function eye(g, x, y, rx, ry, iris, lx = 2, ly = 1) {
  ell(g, x, y, rx, ry, '#ffffff', 3.5);
  g.fillStyle = iris; g.beginPath(); g.ellipse(x + lx, y + ly, rx * 0.74, ry * 0.8, 0, 0, TAU); g.fill();
  g.fillStyle = '#140a10'; g.beginPath(); g.ellipse(x + lx, y + ly + 1, rx * 0.4, ry * 0.48, 0, 0, TAU); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + lx - rx * 0.32, y + ly - ry * 0.36, rx * 0.3, 0, TAU); g.fill();
  g.beginPath(); g.arc(x + lx + rx * 0.28, y + ly + ry * 0.32, rx * 0.14, 0, TAU); g.fill();
}
function flamePath(p, x, y, w, h, lean) {
  p.moveTo(x - w / 2, y);
  p.bezierCurveTo(x - w * 0.75, y - h * 0.45, x - w * 0.15 + lean * 0.3, y - h * 0.6, x + lean, y - h);
  p.bezierCurveTo(x + w * 0.2 + lean * 0.5, y - h * 0.62, x + w * 0.8, y - h * 0.42, x + w / 2, y);
  p.quadraticCurveTo(x, y + w * 0.4, x - w / 2, y);
}
function flame(g, x, y, w, h, lean, cols, lw = 4) {
  toon(g, (p) => flamePath(p, x, y, w, h, lean), cols[0], null, null, lw);
  toon(g, (p) => flamePath(p, x, y - h * 0.05, w * 0.62, h * 0.68, lean * 0.7), cols[1], null, null, 0);
  toon(g, (p) => flamePath(p, x, y - h * 0.08, w * 0.3, h * 0.38, lean * 0.5), cols[2], null, null, 0);
}
function shadow(g, x, y, rx) { g.fillStyle = 'rgba(30,70,20,.28)'; g.beginPath(); g.ellipse(x, y, rx, rx * 0.22, 0, 0, TAU); g.fill(); }

const PUP = { fur: '#f59a3c', furD: '#d8702a', cream: '#fff0d4', ear: '#ffc89a', fl: ['#e8432e', '#ff9a2a', '#ffe680'] };
const PUP_BLUE = { fur: '#e2502e', furD: '#a83220', cream: '#ffe2a8', ear: '#ffb08a', fl: ['#2a6aff', '#5ab8ff', '#e8f8ff'] };

function cartoonPup(g, x, y, s, pal = PUP) {
  g.save(); g.translate(x, y); g.scale(s, s);
  shadow(g, 4, 0, 48);
  g.save(); g.translate(-36, -30); g.rotate(-0.55); flame(g, 0, 0, 34, 66, -10, pal.fl); g.restore();
  ell(g, -24, -12, 11, 13, pal.furD); ell(g, 18, -10, 10, 12, pal.furD);
  toon(g, (p) => p.ellipse(-4, -34, 40, 29, 0, 0, TAU), pal.fur, pal.furD, (c) => c.ellipse(8, -12, 46, 20, -0.2, 0, TAU));
  ell(g, 6, -27, 20, 14, pal.cream, 0);
  for (const fx of [6, 24]) {
    toon(g, (p) => p.roundRect(fx - 6, -30, 13, 26, 6), pal.fur, null, null, 4.5);
    ell(g, fx + 1, -5, 9, 6, pal.cream, 4);
  }
  toon(g, (p) => { p.moveTo(4, -92); p.lineTo(-10, -132); p.quadraticCurveTo(16, -118, 28, -100); p.closePath(); }, pal.fur, null, null, 4.5);
  toon(g, (p) => { p.moveTo(7, -97); p.lineTo(-4, -122); p.quadraticCurveTo(12, -112, 20, -101); p.closePath(); }, pal.ear, null, null, 0);
  toon(g, (p) => { p.moveTo(36, -100); p.lineTo(58, -130); p.quadraticCurveTo(64, -108, 60, -88); p.closePath(); }, pal.fur, null, null, 4.5);
  toon(g, (p) => { p.moveTo(42, -100); p.lineTo(56, -120); p.quadraticCurveTo(59, -106, 56, -92); p.closePath(); }, pal.ear, null, null, 0);
  toon(g, (p) => p.ellipse(24, -74, 39, 34, 0, 0, TAU), pal.fur, pal.furD, (c) => c.ellipse(42, -46, 40, 18, -0.3, 0, TAU));
  flame(g, 22, -104, 14, 24, 3, pal.fl, 3.5);
  ell(g, 46, -60, 19, 13, pal.cream, 4);
  ell(g, 61, -65, 5.5, 4.5, INK, 0);
  g.beginPath(); g.moveTo(46, -55); g.quadraticCurveTo(52, -50, 58, -54); stroke(g, 3);
  g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(49, -53); g.lineTo(51, -48); g.lineTo(53, -52.5); g.fill();
  eye(g, 12, -78, 9.5, 12.5, '#5a2a14', 3, 1);
  eye(g, 37, -80, 10.5, 13.5, '#5a2a14', 3, 1);
  g.fillStyle = 'rgba(255,110,120,.45)';
  g.beginPath(); g.ellipse(4, -60, 7, 4, 0, 0, TAU); g.fill();
  g.restore();
}

function cartoonHero(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  shadow(g, 0, 0, 38);
  toon(g, (p) => p.roundRect(-17, -40, 15, 30, 6), '#3d5aa8', null, null, 4.5);
  toon(g, (p) => p.roundRect(3, -40, 15, 30, 6), '#34509a', null, null, 4.5);
  toon(g, (p) => p.roundRect(-21, -15, 20, 15, 6), '#6a4026', null, null, 4.5);
  toon(g, (p) => p.roundRect(2, -15, 20, 15, 6), '#6a4026', null, null, 4.5);
  toon(g, (p) => p.roundRect(-36, -80, 13, 34, 7), '#e04a3a', null, null, 4.5);
  ell(g, -29, -46, 7.5, 7, '#f9d2a6', 4);
  toon(g, (p) => p.roundRect(-25, -84, 50, 48, 14), '#e04a3a', '#b8352a', (c) => c.rect(8, -90, 30, 60));
  toon(g, (p) => { p.moveTo(-25, -76); p.lineTo(-8, -76); p.lineTo(-12, -40); p.lineTo(-25, -40); p.closePath(); }, '#8a5a32', null, null, 4);
  toon(g, (p) => { p.moveTo(25, -76); p.lineTo(8, -76); p.lineTo(12, -40); p.lineTo(25, -40); p.closePath(); }, '#7a4e2a', null, null, 4);
  toon(g, (p) => p.rect(-25, -45, 50, 9), '#4a2a1a', null, null, 4);
  toon(g, (p) => p.roundRect(-6, -46, 12, 10, 2), '#f4c430', null, null, 3);
  toon(g, (p) => { p.moveTo(-14, -86); p.lineTo(14, -86); p.lineTo(0, -66); p.closePath(); }, '#f4c430', null, null, 4);
  toon(g, (p) => p.roundRect(23, -86, 13, 30, 7), '#e04a3a', null, null, 4.5);
  ell(g, 30, -56, 7.5, 7, '#f9d2a6', 4);
  ell(g, -42, -120, 8, 10, '#f9d2a6', 4); ell(g, 42, -120, 8, 10, '#f9d2a6', 4);
  toon(g, (p) => p.ellipse(0, -122, 44, 40, 0, 0, TAU), '#f9d2a6', '#eab48a', (c) => c.ellipse(20, -92, 40, 18, -0.3, 0, TAU));
  toon(g, (p) => {
    p.moveTo(-44, -124); p.quadraticCurveTo(-48, -150, -30, -156);
    for (let i = 0; i < 5; i++) { const bx = -30 + i * 15; p.quadraticCurveTo(bx + 4, -142, bx + 8, -150); p.quadraticCurveTo(bx + 10, -138, bx + 15, -156); }
    p.quadraticCurveTo(48, -150, 44, -124); p.quadraticCurveTo(40, -138, 32, -140); p.lineTo(-32, -140); p.quadraticCurveTo(-40, -138, -44, -124); p.closePath();
  }, '#6b3e26', null, null, 4.5);
  eye(g, -15, -114, 9, 12, '#3a6ad0', 2, 1); eye(g, 15, -114, 9, 12, '#3a6ad0', 2, 1);
  g.beginPath(); g.moveTo(-23, -131); g.lineTo(-9, -133); stroke(g, 3.5);
  g.beginPath(); g.moveTo(9, -133); g.lineTo(23, -131); stroke(g, 3.5);
  g.beginPath(); g.moveTo(-7, -97); g.quadraticCurveTo(1, -90, 9, -97); stroke(g, 3.5);
  g.fillStyle = 'rgba(255,110,120,.45)';
  g.beginPath(); g.ellipse(-27, -100, 7, 4, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(27, -100, 7, 4, 0, 0, TAU); g.fill();
  toon(g, (p) => p.ellipse(0, -150, 66, 15, 0, 0, TAU), '#b06a32', '#8a4e22', (c) => c.rect(-70, -150, 140, 20));
  toon(g, (p) => { p.moveTo(-34, -152); p.quadraticCurveTo(-36, -190, -14, -192); p.quadraticCurveTo(0, -182, 14, -192); p.quadraticCurveTo(36, -190, 34, -152); p.closePath(); }, '#c47a3c', '#a8622c', (c) => c.rect(14, -200, 30, 50));
  toon(g, (p) => p.rect(-34, -166, 68, 10), '#4a2a1a', null, null, 4);
  g.beginPath(); g.moveTo(-22, -180); g.quadraticCurveTo(-24, -170, -20, -168); g.strokeStyle = 'rgba(255,230,190,.8)'; g.lineWidth = 4; g.stroke();
  g.restore();
}

function cartoonSlime(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  shadow(g, 0, 0, 48);
  toon(g, (p) => { p.moveTo(-46, -2); p.bezierCurveTo(-52, -44, -22, -78, 0, -80); p.bezierCurveTo(24, -78, 52, -44, 46, -2); p.quadraticCurveTo(0, 8, -46, -2); p.closePath(); },
    '#7ad86a', '#4fb04a', (c) => c.ellipse(20, 0, 48, 34, -0.3, 0, TAU));
  g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(-22, -54, 11, 6, -0.6, 0, TAU); g.fill();
  g.beginPath(); g.arc(-8, -66, 3.5, 0, TAU); g.fill();
  eye(g, -16, -38, 9, 12, '#2a6a2a', -3, 1); eye(g, 12, -38, 9, 12, '#2a6a2a', -3, 1);
  g.beginPath(); g.moveTo(-26, -55); g.lineTo(-8, -50); stroke(g, 4); g.beginPath(); g.moveTo(22, -55); g.lineTo(4, -50); stroke(g, 4);
  toon(g, (p) => p.ellipse(-2, -18, 11, 7, 0, 0, TAU), '#5a1a2a', null, null, 3.5);
  g.fillStyle = '#ff7a9a'; g.beginPath(); g.ellipse(-2, -15, 6, 3, 0, 0, TAU); g.fill();
  g.restore();
}

function cartoonTree(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  shadow(g, 0, 0, 50);
  toon(g, (p) => { p.moveTo(-14, 0); p.lineTo(-10, -70); p.lineTo(10, -70); p.lineTo(14, 0); p.closePath(); }, '#8a5a32', '#6a4024', (c) => c.rect(2, -80, 20, 90), 5);
  const blobs = [[-34, -100, 30], [30, -102, 30], [0, -128, 36], [-20, -150, 26], [22, -148, 26], [0, -86, 30]];
  g.fillStyle = INK;
  for (const [bx, by, r] of blobs) { g.beginPath(); g.arc(bx, by, r + 3, 0, TAU); g.fill(); }
  for (const [bx, by, r] of blobs) { g.fillStyle = '#4fb34a'; g.beginPath(); g.arc(bx, by, r, 0, TAU); g.fill(); }
  g.save();
  g.beginPath(); for (const [bx, by, r] of blobs) { g.moveTo(bx + r, by); g.arc(bx, by, r, 0, TAU); } g.clip();
  g.fillStyle = '#358a3a'; g.beginPath(); g.ellipse(18, -70, 70, 40, -0.3, 0, TAU); g.fill();
  g.fillStyle = '#7ad860';
  for (const [bx, by, r] of blobs) { g.beginPath(); g.arc(bx - r * 0.3, by - r * 0.35, r * 0.38, 0, TAU); g.fill(); }
  g.restore();
  g.restore();
}

function gem(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  toon(g, (p) => { p.moveTo(0, -18); p.lineTo(11, -6); p.lineTo(0, 10); p.lineTo(-11, -6); p.closePath(); }, '#6ad8ff', '#2a8ae0', (c) => c.rect(0, -20, 14, 32), 3.5);
  g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.moveTo(-5, -8); g.lineTo(0, -14); g.lineTo(-1, -6); g.fill();
  g.restore();
}

function cartoonScene(cv) {
  const g = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#8fdc62'); bg.addColorStop(1, '#5fbf4a');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,.12)';
  for (const [x, y, r] of [[120, 60, 70], [520, 90, 90], [300, 30, 50], [660, 300, 80]]) { g.beginPath(); g.ellipse(x, y, r, r * 0.5, 0, 0, TAU); g.fill(); }
  // dirt path
  g.beginPath(); g.moveTo(0, 268); g.bezierCurveTo(200, 240, 480, 300, W, 262); g.lineTo(W, 342); g.bezierCurveTo(480, 372, 220, 318, 0, 346); g.closePath();
  g.fillStyle = '#f0d49a'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#c8a064'; g.stroke();
  for (let i = 0; i < 26; i++) { g.fillStyle = i % 2 ? '#e2bf80' : '#fae6b8'; g.beginPath(); g.ellipse((i * 97) % W, 285 + ((i * 37) % 45), 5, 3, 0, 0, TAU); g.fill(); }
  // grass tufts & flowers
  for (let i = 0; i < 18; i++) {
    const x = (i * 131 + 40) % W, y = 40 + ((i * 71) % 190);
    g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x - 3, y - 9); g.lineTo(x, y); g.lineTo(x + 3, y - 11); g.lineTo(x + 6, y); g.strokeStyle = '#3f9a3a'; g.lineWidth = 3; g.stroke();
  }
  for (const [x, y, c] of [[250, 120, '#ff7a9a'], [270, 128, '#ffd84a'], [610, 210, '#ffffff'], [70, 360, '#c88aff'], [420, 380, '#ff7a9a']]) {
    for (let k = 0; k < 5; k++) { g.fillStyle = c; g.beginPath(); g.arc(x + Math.cos(k * 1.256) * 5, y + Math.sin(k * 1.256) * 5, 4, 0, TAU); g.fill(); }
    g.fillStyle = '#ffb030'; g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill();
  }
  cartoonTree(g, 70, 250, 1.05);
  cartoonTree(g, 650, 180, 0.8);
  // pet glow ring
  g.save(); g.globalAlpha = 0.55; g.fillStyle = '#ffb030'; g.beginPath(); g.ellipse(190, 336, 58, 15, 0, 0, TAU); g.fill(); g.restore();
  g.lineWidth = 3; g.strokeStyle = '#ffe680'; g.beginPath(); g.ellipse(190, 336, 58, 15, 0, 0, TAU); g.stroke();
  cartoonPup(g, 186, 334, 0.82);
  cartoonHero(g, 330, 340, 0.92);
  cartoonSlime(g, 580, 336, 0.9);
  // ember projectile
  const fx = 470, fy = 250;
  const glow = g.createRadialGradient(fx, fy, 2, fx, fy, 30); glow.addColorStop(0, 'rgba(255,220,120,.9)'); glow.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = glow; g.beginPath(); g.arc(fx, fy, 30, 0, TAU); g.fill();
  g.save(); g.translate(fx, fy); g.rotate(-Math.PI / 2 - 0.25); flame(g, 0, 10, 22, 40, 0, PUP.fl, 3.5); g.restore();
  gem(g, 410, 372, 1); gem(g, 440, 384, 0.8); gem(g, 650, 362, 1);
  g.font = '44px "Lilita One"'; g.textAlign = 'center';
  g.lineWidth = 9; g.strokeStyle = INK; g.strokeText('24', 590, 214); g.fillStyle = '#ffd84a'; g.fillText('24', 590, 214);
  for (const [x, y] of [[150, 240], [240, 268], [600, 238]]) { g.fillStyle = '#fff6c8'; g.beginPath(); g.moveTo(x, y - 9); g.lineTo(x + 3, y - 3); g.lineTo(x + 9, y); g.lineTo(x + 3, y + 3); g.lineTo(x, y + 9); g.lineTo(x - 3, y + 3); g.lineTo(x - 9, y); g.lineTo(x - 3, y - 3); g.fill(); }
}

function medal(cv) {
  const g = cv.getContext('2d');
  cartoonPup(g, 30, 156, 1.15, PUP_BLUE);
}

async function main() {
  buildAssets();
  try { await document.fonts.load('44px "Lilita One"'); } catch { /* font unavailable offline */ }
  pixelScene(document.getElementById('sceneA'), true);
  pixelScene(document.getElementById('sceneC'), false);
  const ia = document.getElementById('iconA').getContext('2d');
  ia.imageSmoothingEnabled = false; ia.drawImage(ICON.fireball, 0, 0, 64, 64);
  cartoonScene(document.getElementById('sceneB'));
  medal(document.getElementById('medalB'));
  medal(document.getElementById('medalC'));
  window.mockReady = true;
}
main();
