// Hatch and evolve animations, drawn on a <canvas> inside a modal. Each returns a promise that
// resolves when the animation has played out; a tap, click or E/Enter/Space skips to the end.
import { creatureArt, silhouette } from '../gfx/art.js';
import { eggCanvas, eggHalves, crackPixels, EGG_SIZE } from '../gfx/eggs.js';
import { SPECIES, TYPES } from '../content/species.js';
import { Audio } from '../core/audio.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => 1 - (1 - v) ** 3;
const back = (v) => { const c = 1.9; return 1 + (c + 1) * (v - 1) ** 3 + c * (v - 1) ** 2; };
const hexA = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};

// One running animation: sizes the canvas to its box, runs draw(t, dt) every frame until `length`.
class Scene {
  constructor(canvas, length) {
    this.c = canvas; this.length = length; this.t = 0; this.parts = [];
    this.W = Math.max(160, canvas.clientWidth || 240); this.H = Math.max(130, canvas.clientHeight || 200);
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(this.W * this.dpr); canvas.height = Math.round(this.H * this.dpr);
    this.g = canvas.getContext('2d');
    this.cues = [];
  }
  // Run something once when the clock passes `at`
  cue(at, fn) { this.cues.push({ at, fn }); }
  run(draw) {
    return new Promise((resolve) => {
      let last = performance.now(), done = false;
      const finish = () => {
        if (done) return;
        done = true;
        this.c.removeEventListener('click', finish);
        window.removeEventListener('keydown', onKey, true);
        resolve();
      };
      // the skip key must not also reach the screen that comes next
      const onKey = (e) => {
        if (e.code !== 'KeyE' && e.code !== 'Enter' && e.code !== 'Space') return;
        e.preventDefault(); e.stopPropagation();
        finish();
      };
      this.skip = finish;
      this.c.addEventListener('click', finish);
      window.addEventListener('keydown', onKey, true);
      const frame = (now) => {
        if (done) return;
        if (!this.c.isConnected) { finish(); return; }
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        this.t += dt;
        for (const q of this.cues) if (!q.done && this.t >= q.at) { q.done = true; q.fn(); }
        const g = this.g;
        g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        g.imageSmoothingEnabled = false;
        g.clearRect(0, 0, this.W, this.H);
        draw(this.t, dt);
        this.drawParts(dt);
        if (this.t >= this.length) { finish(); return; }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  }
  // ---- small helpers shared by both scenes
  burst(x, y, n, colors, speed, { size = 3, life = 0.8, grav = 260, up = 0, kind = 'chip' } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up, life: life * (0.6 + Math.random() * 0.6), age: 0,
        size, grav, color: colors[(Math.random() * colors.length) | 0], kind, spin: Math.random() * 6 });
    }
  }
  // Specks that fly in from a ring and vanish at the centre
  gather(x, y, n, colors, radius) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = radius * (0.8 + Math.random() * 0.5), life = 0.5 + Math.random() * 0.3;
      this.parts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, vx: -Math.cos(a) * r / life, vy: -Math.sin(a) * r / life,
        life, age: 0, size: 3, grav: 0, color: colors[(Math.random() * colors.length) | 0], kind: 'dot' });
    }
  }
  drawParts(dt) {
    const g = this.g;
    this.parts = this.parts.filter((p) => (p.age += dt) < p.life);
    for (const p of this.parts) {
      p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const a = 1 - p.age / p.life;
      g.globalAlpha = p.kind === 'chip' ? Math.min(1, a * 2) : a;
      g.fillStyle = p.color;
      if (p.kind === 'star') this.star(p.x, p.y, p.size * (0.6 + 0.4 * Math.sin(p.age * 14 + p.spin)), p.color);
      else g.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
    }
    g.globalAlpha = 1;
  }
  // 4-point twinkle
  star(x, y, r, color) {
    const g = this.g; g.fillStyle = color;
    const s = Math.max(1, Math.round(r));
    g.fillRect(Math.round(x - s), Math.round(y) - 1, s * 2, 2);
    g.fillRect(Math.round(x) - 1, Math.round(y - s), 2, s * 2);
  }
  rays(x, y, n, len, angle, color, alpha) {
    if (alpha <= 0) return;
    const g = this.g;
    g.save(); g.translate(x, y); g.rotate(angle); g.globalAlpha = alpha; g.fillStyle = color;
    for (let i = 0; i < n; i++) {
      g.rotate((Math.PI * 2) / n);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(len, -len * 0.13); g.lineTo(len, len * 0.13); g.closePath(); g.fill();
    }
    g.restore();
  }
  glow(x, y, r, color, alpha) {
    if (alpha <= 0) return;
    const g = this.g, grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, hexA(color, alpha)); grd.addColorStop(1, hexA(color, 0));
    g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  flash(alpha) {
    if (alpha <= 0) return;
    this.g.fillStyle = `rgba(255,255,255,${alpha})`; this.g.fillRect(0, 0, this.W, this.H);
  }
  // Draws a sprite anchored at its bottom centre, at a whole-number scale, optionally rotated
  sprite(img, x, y, k, { rot = 0, alpha = 1, white = null, whiteA = 0 } = {}) {
    const g = this.g, w = img.width * k, h = img.height * k;
    g.save(); g.translate(Math.round(x), Math.round(y)); if (rot) g.rotate(rot);
    g.globalAlpha = alpha;
    g.drawImage(img, -Math.round(w / 2), -h, w, h);
    if (white && whiteA > 0) { g.globalAlpha = alpha * Math.min(1, whiteA); g.drawImage(white, -Math.round(w / 2), -h, w, h); }
    g.restore();
  }
  // Whole-number scale that fits a sprite into a box
  fit(img, box) { return Math.max(1, Math.floor(box / Math.max(img.width, img.height))); }
}

const typeColor = (species) => TYPES[SPECIES[species]?.types?.[0]]?.color || '#ffe07a';
const typeColors = (species) => (SPECIES[species]?.types || []).map((t) => TYPES[t].color);

// ------------------------------------------------------------------ hatching
// The egg settles, wobbles three times as cracks spread along its seam, glows, then the top of
// the shell pops off and the survivalmon appears in a flash.
export function playHatch(canvas, species) {
  const egg = eggCanvas(species), mon = creatureArt(species);
  if (!egg || !mon) return Promise.resolve();
  const S = new Scene(canvas, 4.1);
  const { W, H } = S, cx = W / 2, by = Math.round(H * 0.84);
  const ke = Math.max(2, Math.round((H * 0.56) / EGG_SIZE));
  const km = S.fit(mon, H * 0.64);
  const halves = eggHalves(egg), crack = crackPixels(egg);
  const eggWhite = silhouette(egg, '#ffffff'), monWhite = silhouette(mon, '#ffffff');
  const color = typeColor(species), colors = [...typeColors(species), '#ffffff', '#ffe07a'];
  const shellColors = sampleColors(egg);
  // egg pixel (x, y) -> canvas position, for an upright egg standing at (cx, by); BOT is the row under the egg
  const BOT = 30;
  const at = (x, y) => [cx + (x + 0.5 - EGG_SIZE / 2) * ke, by + (y + 0.5 - BOT) * ke];
  const WOBBLES = [[0.55, 1.0, 0.12], [1.25, 1.75, 0.19], [1.95, 2.5, 0.27]];
  const POP = 2.95;
  WOBBLES.forEach(([a, b], i) => {
    S.cue(a, () => Audio.play('swing'));
    S.cue(b - 0.05, () => {
      Audio.play('hit');
      const n = Math.ceil(crack.length * (i + 1) / 3);
      for (let j = 0; j < 3; j++) { const [x, y] = crack[Math.min(n - 1, (Math.random() * n) | 0)]; const [px, py] = at(x, y); S.burst(px, py, 2, shellColors, 70, { size: ke, life: 0.5, up: 60 }); }
    });
  });
  S.cue(2.55, () => Audio.play('freeze'));
  S.cue(POP, () => {
    Audio.play('open'); Audio.play('hatch');
    for (const [x, y] of crack) { const [px, py] = at(x, y); if (Math.random() < 0.6) S.burst(px, py, 1, shellColors, 160, { size: ke, life: 0.9, up: 120 }); }
    S.burst(cx, by - 14 * ke, 26, colors, 170, { size: 3, life: 1.1, grav: 40, kind: 'star' });
  });
  for (let i = 0; i < 8; i++) S.cue(POP + 0.35 + i * 0.09, () => {
    const a = Math.random() * Math.PI * 2, r = (0.4 + Math.random() * 0.4) * mon.height * km;
    S.parts.push({ x: cx + Math.cos(a) * r, y: by - mon.height * km * 0.5 + Math.sin(a) * r * 0.7, vx: 0, vy: -10, life: 0.7, age: 0, size: 3 + (Math.random() * 3 | 0), grav: 0, color: '#ffffff', kind: 'star', spin: 0 });
  });

  return S.run((t) => {
    // background glow and rays build up while the egg glows, then fade after the reveal
    const build = clamp01((t - 1.9) / 1.0), fade = 1 - clamp01((t - POP - 0.6) / 0.8);
    S.glow(cx, by - 14 * ke, H * 0.62, color, 0.15 + 0.45 * build * fade);
    S.rays(cx, by - 14 * ke, 12, H * 0.9, t * 0.6, '#ffffff', 0.2 * build * fade);
    // floor shadow
    S.g.fillStyle = 'rgba(0,0,0,.25)';
    S.g.beginPath(); S.g.ellipse(cx, by + 2, 11 * ke * (t < POP ? 1 : 0.9 + 0.2 * clamp01((t - POP) / 0.3)), 2.5 * ke, 0, 0, Math.PI * 2); S.g.fill();

    if (t < POP) {
      // drop in, then wobble
      const drop = ease(clamp01(t / 0.35)), dy = (1 - drop) * -H * 0.5 + (t > 0.35 && t < 0.5 ? Math.sin((t - 0.35) / 0.15 * Math.PI) * -3 * ke : 0);
      let rot = 0;
      for (const [a, b, amp] of WOBBLES) if (t >= a && t <= b) { const u = (t - a) / (b - a); rot = Math.sin(u * Math.PI * 4) * amp * Math.sin(u * Math.PI); }
      if (t > 2.5) rot = Math.sin(t * 70) * 0.04;
      const glowA = clamp01((t - 2.5) / (POP - 2.5)) * 0.9;
      const g = S.g;
      g.save(); g.translate(cx, by + dy); g.rotate(rot);
      const w = EGG_SIZE * ke, ox = -w / 2, oy = -BOT * ke;
      g.drawImage(egg, ox, oy, w, w);
      // cracks spread along the seam, one third per wobble
      let shown = 0;
      WOBBLES.forEach(([, b], i) => { if (t >= b - 0.05) shown = Math.ceil(crack.length * (i + 1) / 3); });
      g.fillStyle = '#1a0f0a';
      for (let i = 0; i < shown; i++) { const [x, y] = crack[i]; g.fillRect(ox + x * ke, oy + y * ke, ke, ke); }
      if (glowA > 0) { g.globalAlpha = glowA; g.drawImage(eggWhite, ox, oy, w, w); g.globalAlpha = 1; }
      g.restore();
    } else {
      const u = t - POP;
      // the survivalmon: a white shape that pops up, then fills in with colour
      const grow = back(clamp01(u / 0.4));
      const k = Math.max(1, Math.round(km * Math.max(0.35, grow)));
      S.sprite(mon, cx, by, k, { white: monWhite, whiteA: 1 - clamp01((u - 0.25) / 0.5) });
      // the bottom shell stays a moment, then fades; the top flies off
      const lowA = 1 - clamp01((u - 0.5) / 0.4);
      const drop = (EGG_SIZE - BOT) * ke;
      if (lowA > 0) S.sprite(halves.low, cx, by + drop, ke, { alpha: lowA });
      const topA = 1 - clamp01((u - 0.45) / 0.35);
      if (topA > 0) S.sprite(halves.top, cx + 90 * u, by + drop - 230 * u + 420 * u * u, ke, { rot: 4 * u, alpha: topA });
      S.flash(0.95 * (1 - clamp01(u / 0.35)));
    }
  });
}

// ------------------------------------------------------------------ evolving
// Light gathers in, the survivalmon turns into a white shape that flickers between its old and
// new forms faster and faster, a flash, and the new form fills in with colour.
export function playEvolve(canvas, fromId, intoId) {
  const from = creatureArt(fromId), into = creatureArt(intoId);
  if (!from || !into) return Promise.resolve();
  const S = new Scene(canvas, 5.0);
  const { W, H } = S, cx = W / 2, by = Math.round(H * 0.86);
  const k = Math.max(1, Math.min(S.fit(from, H * 0.66), S.fit(into, H * 0.66)));
  const fromW = silhouette(from, '#ffffff'), intoW = silhouette(into, '#ffffff');
  const color = typeColor(intoId), colors = [...typeColors(intoId), '#ffffff', '#ffe07a'];
  const midY = by - Math.max(from.height, into.height) * k * 0.5;
  const SWAP_A = 1.2, SWAP_B = 3.5, FLASH = 3.75;
  for (let i = 0; i < 9; i++) S.cue(0.1 + i * 0.12, () => S.gather(cx, midY, 9, colors, H * 0.55));
  S.cue(0.05, () => Audio.play('combo'));
  S.cue(SWAP_A, () => Audio.play('freeze'));
  S.cue(2.6, () => Audio.play('zap'));
  S.cue(FLASH, () => {
    Audio.play('explode');
    S.burst(cx, midY, 34, colors, 200, { size: 3, life: 1.2, grav: 30, kind: 'star' });
  });
  S.cue(FLASH + 0.3, () => Audio.play('victory'));
  // swaps speed up from about once a second to ten times a second
  const swaps = (u) => { const d = SWAP_B - SWAP_A; return 1.0 * u + ((10 - 1.0) / d) * u * u / 2; };

  return S.run((t) => {
    const build = clamp01(t / 1.4), after = clamp01((t - FLASH) / 1.0);
    S.glow(cx, midY, H * 0.65, color, (0.2 + 0.45 * build) * (1 - after * 0.5));
    S.rays(cx, midY, 14, H, t * (0.4 + build * 1.6), '#ffffff', 0.22 * build * (1 - after));
    // ring shockwave at the flash
    if (t > FLASH && t < FLASH + 0.6) {
      const u = (t - FLASH) / 0.6, g = S.g;
      g.strokeStyle = `rgba(255,255,255,${1 - u})`; g.lineWidth = 4 * (1 - u) + 1;
      g.beginPath(); g.ellipse(cx, midY, u * W * 0.6, u * H * 0.5, 0, 0, Math.PI * 2); g.stroke();
    }
    let img = from, white = fromW, whiteA = clamp01((t - 0.7) / 0.5), pulse = 1;
    if (t >= SWAP_A && t < FLASH) {
      const u = Math.min(t, SWAP_B) - SWAP_A;
      const showInto = t >= SWAP_B || Math.floor(swaps(u) * 2) % 2 === 1;
      img = showInto ? into : from; white = showInto ? intoW : fromW; whiteA = 1;
      pulse = 1 + 0.06 * Math.sin(t * 18);
    } else if (t >= FLASH) {
      img = into; white = intoW; whiteA = 1 - clamp01((t - FLASH - 0.25) / 0.6);
    }
    const kk = Math.max(1, Math.round(k * pulse));
    S.sprite(img, cx, by, kk, { white, whiteA });
    if (t >= FLASH) S.flash(1 - clamp01((t - FLASH) / 0.45));
    else if (t > SWAP_B) S.flash(0.7 * clamp01((t - SWAP_B) / (FLASH - SWAP_B)));
  });
}

// A few shell colours to make the flying chips from
function sampleColors(src) {
  const d = src.getContext('2d').getImageData(0, 0, EGG_SIZE, EGG_SIZE).data, out = [];
  for (let y = 12; y < 20; y += 2) for (let x = 8; x < 24; x += 3) {
    const i = (y * EGG_SIZE + x) * 4;
    if (d[i + 3] > 200 && (d[i] + d[i + 1] + d[i + 2]) / 3 > 90) out.push(`rgb(${d[i]},${d[i + 1]},${d[i + 2]})`);
  }
  return out.length ? out : ['#fff6e0'];
}
