// The opening: how the story begins (the Starfall). It plays on a new game, where the player picks
// the egg they carry in the middle of it and the escape that follows is the first run, and again
// from the town menu. Scenes are drawn on a full-screen canvas over 256x144 backdrops
// (assets/sprites/story/), with the words typing out in a box along the bottom.
// Tap (or E / Enter / Space) finishes the words, then moves on; Skip jumps to the egg (or ends).
import { HERO_ART, CREATURE, drawCreature } from '../gfx/art.js';
import { eggURL, eggCanvas } from '../gfx/eggs.js';
import { SPECIES, STARTERS, TYPES } from '../content/species.js';
import { Audio } from '../core/audio.js';

const BW = 256, BH = 144;           // backdrop size: every scene is drawn in these units
const TYPE_SPEED = 38;              // letters a second
// story/props.png, 64px cells in this order (the later ones are for the chapters to come)
const PROPS = ['cart', 'cart_tipped', 'crater', 'shard', 'wheel', 'straw', 'lamp', 'sign', 'net', 'cage', 'ink', 'campfire', 'tent', 'flag', 'tracks', 'supplies'];
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => 1 - (1 - v) ** 3;
const lerp = (a, b, t) => a + (b - a) * t;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let art = null;
function loadImage(src) {
  return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}
const cut = (img, x, y, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, x, y, w, h, 0, 0, w, h); return c; };
const blank = (c) => !c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v);
async function loadStoryArt(base = 'assets/sprites/story') {
  if (art) return art;
  const [valley, crash, props] = await Promise.all(['valley', 'crash', 'props'].map((n) => loadImage(`${base}/${n}.png`)));
  const P = {};
  if (props) PROPS.forEach((n, i) => { const c = cut(props, i * 64, 0, 64, 64); if (!blank(c)) P[n] = c; });
  return (art = { valley, crash, P });
}

// The scenes. t = seconds into the scene. text = the words; at = when they start typing;
// auto = moves on by itself after that long. Positions are in backdrop units.
const CRATER = { x: 122, y: 42 }, HERO = { x: 128, y: 116 }, HK = 0.65; // the crash: crater, where the hero lies, hero scale
const EGG_SPOTS = [[96, 126], [109, 136], [147, 136], [160, 126], [128, 140]];
const ROAD = 139, VK = 0.6; // the valley: the road's line, hero scale

function scenes(replay) {
  const list = [
    { id: 'valley', bg: 'valley', at: 0.8, text: 'Every summer, the rangers carry eggs from the hills down to the village.' },
    { id: 'road', bg: 'valley', at: 1.2, text: 'A young ranger had made the trip a dozen times. Tonight, the sky felt wrong.' },
    { id: 'star', bg: 'valley', at: 2.6, text: 'Then a star fell. It did not burn out. It came down.', sound: [[0.5, 'starfall']] },
    { id: 'impact', bg: 'valley', auto: 1.8, sound: [[0, 'impact']] },
    { id: 'wake', bg: 'crash', at: 4.0, text: 'The ranger woke in the grass. Five eggs had made it through the night.' },
    { id: 'eggs', bg: 'crash', at: 0.4, text: replay ? 'There was only room to carry one.' : 'There was only room to carry one. Which egg do you take?', pick: !replay },
    { id: 'blobs', bg: 'crash', at: 1.6, text: 'Something crawled out of the smoke.', sound: [[0.4, 'hurt']] },
  ];
  if (replay) list.push({ id: 'end', bg: 'crash', at: 0.3, text: 'The village lamps were still burning, not far away. That is where your story begins.' });
  else list.push({ id: 'run', bg: 'crash', at: 0.1, text: 'Run!', big: true, auto: 1.6 });
  return list;
}

export async function playOpening({ root = document.body, replay = false, onPick = null } = {}) {
  const A = await loadStoryArt();
  const list = scenes(replay);
  const el = document.createElement('div');
  el.className = 'story';
  el.innerHTML = `<canvas class="story-cv"></canvas>
    <button class="btn small secondary story-skip">Skip ▸▸</button>
    <div class="story-pick hidden"></div>
    <div class="story-cap hidden"><p></p><span class="story-next">▶</span></div>`;
  root.appendChild(el);
  const cv = el.querySelector('canvas'), g = cv.getContext('2d');
  const cap = el.querySelector('.story-cap'), capP = cap.querySelector('p'), pickEl = el.querySelector('.story-pick');
  let i = 0, t = 0, shown = 0, picked = null, choosing = null, done = null, last = performance.now();
  const parts = [];
  const S = () => list[i];
  const cueDone = new Set();

  // the egg choice: five eggs to tap, then "Carry it"
  const showPick = () => {
    pickEl.innerHTML = `<div class="story-eggs">${STARTERS.map((id) => `<button class="story-egg ${choosing === id ? 'sel' : ''}" data-egg="${id}"><img class="px" src="${eggURL(id, 2)}" alt=""><span>${esc(SPECIES[id].name)}</span></button>`).join('')}</div>
      ${choosing ? `<div class="story-egg-info"><b>${esc(SPECIES[choosing].name)} egg</b> ${SPECIES[choosing].types.map((ty) => `<span class="rar type-pill" style="background:${TYPES[ty].color}">${TYPES[ty].name}</span>`).join(' ')} <span>${esc(SPECIES[choosing].desc)}</span></div>
        <button class="btn story-carry">Carry the ${esc(SPECIES[choosing].name)} egg</button>` : '<div class="story-egg-info"><span>Tap an egg to look at it.</span></div>'}`;
    pickEl.classList.remove('hidden');
  };
  const go = (n) => {
    i = n; t = 0; shown = 0; cueDone.clear();
    cap.classList.add('hidden'); pickEl.classList.add('hidden');
    if (i >= list.length) { finish(); return; }
    cap.classList.toggle('big', !!S().big);
  };
  const next = () => {
    const s = S();
    if (!s) return;
    if (s.pick && !picked) return; // the egg comes first
    if (!s.text && s.auto) return;  // a moment with no words (the impact) plays out by itself
    if (s.text && t >= s.at && shown < s.text.length) { shown = s.text.length; return; } // finish the words
    if (s.text && t < s.at) return;
    go(i + 1);
  };
  const finish = () => {
    if (done) return;
    done = true;
    window.removeEventListener('keydown', onKey, true);
    el.remove();
    resolveIt(picked);
  };
  const onKey = (e) => {
    if (!['KeyE', 'Enter', 'Space', 'NumpadEnter'].includes(e.code)) return;
    e.preventDefault(); e.stopPropagation();
    Audio.unlock();
    if (S()?.pick && !picked) { if (choosing) choose(choosing); return; }
    next();
  };
  const choose = (id) => {
    picked = id;
    Audio.play('hatch');
    pickEl.classList.add('hidden');
    onPick?.(id);
    go(i + 1);
  };
  el.addEventListener('click', (e) => {
    Audio.unlock();
    const egg = e.target.closest('[data-egg]');
    if (egg) { choosing = egg.dataset.egg; Audio.play('click'); showPick(); return; }
    if (e.target.closest('.story-carry')) { choose(choosing); return; }
    if (e.target.closest('.story-skip')) {
      if (replay) { finish(); return; }
      const k = list.findIndex((s) => s.pick);
      if (i < k) go(k); else if (picked) go(list.length - 1);
      return;
    }
    if (e.target.closest('.story-pick')) return;
    next();
  });
  window.addEventListener('keydown', onKey, true);

  // ---------------------------------------------------------------- drawing
  const heroArt = HERO_ART.rowan;
  const hero = (x, y, k, o = {}) => {
    if (!heroArt) return;
    let img = heroArt.dirs.south;
    if (o.walk && heroArt.walk?.east) img = heroArt.walk.east[Math.floor(o.walk) % heroArt.walk.east.length];
    else if (o.dir) img = heroArt.dirs[o.dir] || img;
    g.drawImage(img, Math.round(x - (heroArt.ax * k)), Math.round(y - heroArt.ay * k), img.width * k, img.height * k);
  };
  const prop = (name, x, y, k = 1, flip = false) => {
    const c = A.P[name];
    if (!c) return;
    g.save(); g.translate(Math.round(x), Math.round(y)); if (flip) g.scale(-1, 1);
    g.drawImage(c, -c.width * k / 2, -c.height * k, c.width * k, c.height * k); g.restore();
  };
  const stars = Array.from({ length: 34 }, (_, n) => ({ x: (n * 73) % BW, y: (n * 37) % 52, p: n * 0.7 }));
  const twinkle = (time) => {
    for (const s of stars) { g.globalAlpha = 0.35 + 0.35 * Math.sin(time * 2 + s.p); g.fillStyle = '#fff7d6'; g.fillRect(s.x, s.y, 1, 1); }
    g.globalAlpha = 1;
  };
  const smoke = (dt, rate = 6) => {
    if (Math.random() < rate * dt) parts.push({ x: CRATER.x + (Math.random() - 0.5) * 14, y: CRATER.y, vx: 1 + (Math.random() - 0.5) * 4, vy: -6 - Math.random() * 5, r: 2 + Math.random() * 2, life: 3 + Math.random() * 2, age: 0, c: '150,140,160', a: 0.35 });
  };
  const drawParts = (dt) => {
    for (let n = parts.length - 1; n >= 0; n--) {
      const p = parts[n];
      p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 1.5;
      if (p.age > p.life) { parts.splice(n, 1); continue; }
      g.fillStyle = `rgba(${p.c},${(1 - p.age / p.life) * (p.a ?? 0.45)})`;
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
    }
  };
  const tint = (color, a) => { if (a <= 0) return; g.fillStyle = `rgba(${color},${a})`; g.fillRect(0, 0, BW, BH); };
  let trail = [], blobClock = 0;

  const drawScene = (s, dt) => {
    const bg = A[s.bg];
    let shake = 0;
    if (s.id === 'impact') shake = Math.max(0, 1 - t / 0.9) * 4;
    g.save();
    if (shake) g.translate(Math.round((Math.random() - 0.5) * shake * 2), Math.round((Math.random() - 0.5) * shake * 2));
    if (bg) g.drawImage(bg, 0, 0, BW, BH); else { g.fillStyle = s.bg === 'valley' ? '#13183a' : '#5a7a3a'; g.fillRect(0, 0, BW, BH); }
    if (s.bg === 'valley') twinkle(performance.now() / 1000);
    switch (s.id) {
      case 'valley': tint('8,10,30', 0.35 * (1 - clamp01(t / 2))); break;
      case 'road': {
        const p = clamp01(t / 7), x = lerp(-20, 120, p);
        hero(x, ROAD, VK, { walk: t * 9 });
        prop('cart', x + 22, ROAD + 2, VK);
        break;
      }
      case 'star': {
        hero(120, ROAD, VK, { dir: 'north-west' }); prop('cart', 142, ROAD + 2, VK);
        const p = clamp01((t - 0.5) / 2.0), e = p * p;
        const sx = lerp(268, 92, e), sy = lerp(-14, 90, e);
        tint('120,50,190', 0.22 * clamp01((t - 0.6) / 1.6));
        if (p > 0 && p < 1) {
          trail.push([sx, sy]); if (trail.length > 26) trail.shift();
          trail.forEach(([x, y], n) => { const a = n / trail.length; g.fillStyle = `rgba(${170 + 60 * a},${80 + 60 * a},255,${a * 0.8})`; g.fillRect(Math.round(x - a * 2), Math.round(y - a * 2), Math.max(1, Math.round(a * 4)), Math.max(1, Math.round(a * 4))); });
          const grd = g.createRadialGradient(sx, sy, 0, sx, sy, 10); grd.addColorStop(0, 'rgba(255,240,255,1)'); grd.addColorStop(0.4, 'rgba(200,120,255,.8)'); grd.addColorStop(1, 'rgba(120,40,200,0)');
          g.fillStyle = grd; g.fillRect(sx - 10, sy - 10, 20, 20);
        }
        if (p >= 1) { trail = []; tint('230,200,255', 0.25 * Math.max(0, 1 - (t - 2.5) * 2)); }
        break;
      }
      case 'impact': {
        tint('120,50,190', 0.22);
        const a = t < 0.15 ? 1 : Math.max(0, 1 - (t - 0.15) / 0.6);
        tint('255,255,255', a);
        tint('0,0,0', clamp01((t - 0.7) / 0.8));
        break;
      }
      case 'wake': {
        smoke(dt);
        // lying on one side in the grass, then sitting up and standing
        const up = ease(clamp01((t - 3.2) / 0.5));
        if (up < 1 && heroArt) {
          const img = heroArt.dirs.south, k = HK;
          g.save(); g.translate(HERO.x + 15 * (1 - up), HERO.y - 6 * (1 - up) - up * 2); g.rotate(-Math.PI / 2 * (1 - up)); // lying across the spot, head to the left
          g.drawImage(img, Math.round(-heroArt.ax * k), Math.round(-heroArt.ay * k), img.width * k, img.height * k);
          g.restore();
        } else hero(HERO.x, HERO.y, HK);
        for (const [x, y] of EGG_SPOTS) eggAt(x, y, null, t);
        drawParts(dt);
        // eyes opening: two slow blinks
        const open = t < 0.6 ? 0 : t < 1.1 ? (t - 0.6) / 0.5 * 0.6 : t < 1.4 ? 0.6 - (t - 1.1) / 0.3 * 0.5 : clamp01(0.1 + (t - 1.4) / 0.8);
        const lid = (1 - ease(open)) * BH / 2;
        g.fillStyle = '#000'; g.fillRect(0, 0, BW, lid); g.fillRect(0, BH - lid, BW, lid);
        tint('255,220,180', 0.12 * (1 - clamp01((t - 1.5) / 1.5)));
        break;
      }
      case 'eggs': case 'blobs': case 'run': case 'end': {
        smoke(dt);
        hero(HERO.x, HERO.y, HK, { dir: s.id === 'eggs' ? 'south' : 'north' });
        const eggs = STARTERS.slice(0, 5);
        eggs.forEach((id, n) => {
          const [x, y] = EGG_SPOTS[n];
          if (picked && id === picked && s.id !== 'eggs') return; // carried now
          eggAt(x, y, id, t, s.id === 'eggs' && choosing === id);
        });
        if (s.id !== 'eggs') {
          const blob = CREATURE.blob, bt = (blobClock += dt); // keeps counting into "Run!"
          for (let n = 0; n < 3; n++) {
            const p = clamp01((bt - n * 0.5) / 4), bx = lerp(CRATER.x + (n - 1) * 10, HERO.x + (n - 1) * 26, ease(p) * 0.7), by = lerp(CRATER.y + 4, HERO.y - 16, ease(p) * 0.7);
            if (blob && bt > n * 0.5) drawCreature(g, blob, bx, by, { anim: 'move', at: bt + n, sx: 2 * HK, sy: 2 * HK, left: bx > HERO.x });
          }
          tint('60,20,90', 0.12 * clamp01(t / 2));
        }
        drawParts(dt);
        break;
      }
    }
    g.restore();
  };
  // an egg in the grass (the ones still lying there, or the one you're looking at bouncing)
  const eggAt = (x, y, id, time, sel = false) => {
    const c = eggCanvas(id || STARTERS[EGG_SPOTS.findIndex(([ex, ey]) => ex === x && ey === y)] || STARTERS[0]);
    if (!c) return;
    const k = 0.4, hop = sel ? Math.abs(Math.sin(time * 6)) * 3 : 0;
    g.fillStyle = 'rgba(20,30,10,.3)'; g.beginPath(); g.ellipse(x, y, 5, 1.6, 0, 0, Math.PI * 2); g.fill();
    g.drawImage(c, Math.round(x - c.width * k / 2), Math.round(y - c.height * k + 2 - hop), c.width * k, c.height * k);
  };

  // ---------------------------------------------------------------- the loop
  let resolveIt;
  const finished = new Promise((r) => { resolveIt = r; });
  const tick = (dt) => {
    if (done) return;
    const s = S();
    if (!s) return;
    t += dt;
    for (const [at, name] of s.sound || []) if (t >= at && !cueDone.has(at)) { cueDone.add(at); Audio.play(name); }
    // size the canvas to the screen and cover it with the 256x144 scene
    const W = el.clientWidth, H = el.clientHeight, dpr = Math.min(3, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    // the whole scene fits above a band kept for the words, at a whole-pixel scale when it is big enough
    const band = Math.round(Math.min(96, H * 0.22) * dpr);
    let k = Math.min(cv.width / BW, (cv.height - band) / BH);
    if (k >= 2) k = Math.floor(k);
    const top = Math.max(0, Math.round((cv.height - band - BH * k) / 2));
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
    g.setTransform(k, 0, 0, k, Math.round((cv.width - BW * k) / 2), top);
    g.save(); g.beginPath(); g.rect(0, 0, BW, BH); g.clip();
    g.imageSmoothingEnabled = false;
    drawScene(s, dt);
    g.restore();
    // the words
    if (s.text && t >= s.at) {
      if (cap.classList.contains('hidden')) cap.classList.remove('hidden');
      shown = Math.min(s.text.length, shown + dt * TYPE_SPEED);
      const n = Math.floor(shown);
      if (capP.dataset.n !== String(n)) { capP.textContent = s.text.slice(0, n); capP.dataset.n = String(n); }
      cap.classList.toggle('ready', n >= s.text.length);
      if (s.pick && n >= s.text.length && !picked && pickEl.classList.contains('hidden')) showPick();
    }
    if (s.auto && t >= s.auto && (!s.text || shown >= s.text.length)) go(i + 1);
  };
  const frame = (now) => {
    if (done) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    tick(dt);
    requestAnimationFrame(frame);
  };
  playOpening.tick = tick; // lets a test step the scenes when the page has no animation frames
  requestAnimationFrame(frame);
  return finished;
}
