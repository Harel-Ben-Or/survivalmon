// The opening: how the story begins (the Starfall), in 15 short scenes. The wild and its survivalmons,
// Brightnest the rangers' village, Hearthvale behind its walls, the five trainees and Hollis's last
// test; your night alone, the Night Star falling and breaking in two, the small piece hitting
// Brightnest; the run home, the ruins, Hollis and the egg basket. It plays on a new game, where you
// pick the one egg you carry and the escape that follows is the first run, and again from the town
// menu. playEnding shows the Scar, after the West Gate Lv 4. Scenes are drawn on a full-screen canvas over 256x144 backdrops
// (assets/sprites/story/), with the words typing out in a box along the bottom.
// Tap (or E / Enter / Space) finishes the words, then moves on; Skip jumps to the egg (or ends).
import { HERO_ART, CREATURE, drawCreature } from '../gfx/art.js';
import { Meta } from '../systems/meta.js';
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
  const names = ['valley', 'crash', 'props', 'camp', 'ruins', 'scar', 'hollis', 'wild', 'brightnest', 'hearthvale', 'campdusk', 'impact', 'dawn'];
  const imgs = await Promise.all(names.map((n) => loadImage(`${base}/${n}.png`)));
  const A = Object.fromEntries(names.map((n, i) => [n, imgs[i]]));
  const P = {};
  if (A.props) PROPS.forEach((n, i) => { const c = cut(A.props, i * 64, 0, 64, 64); if (!blank(c)) P[n] = c; });
  // a picture that hasn't loaded falls back to one that has
  const FALLBACK = { wild: 'valley', brightnest: 'camp', hearthvale: 'valley', campdusk: 'camp', impact: 'valley', dawn: 'valley' };
  for (const [k, f] of Object.entries(FALLBACK)) if (!A[k]) A[k] = A[f];
  return (art = { ...A, P });
}

// The scenes. t = seconds into the scene. text = the words; at = when they start typing;
// auto = moves on by itself after that long. Positions are in backdrop units.
const CRATER = { x: 160, y: 96 }, HERO = { x: 92, y: 134 }, HK = 0.6; // the ruins: the crater, where you stand, hero scale
const HOLLIS = { x: 128, y: 136 };
const EGG_SPOTS = [[108, 142], [118, 140], [140, 141], [150, 139], [129, 143]]; // the egg basket by Hollis
const CAMP = { x: 104, y: 124 }, STAR = { x: 146, y: 18 }, VILLAGE = { x: 216, y: 66 }, VK = 0.5;
const ROAD = 134;                   // the valley picture's road, where you walk at night
const FIRE = { x: 103, y: 118 };    // the campfire in camp / campdusk
// the five trainees in a row in front of the tents: you in the middle
const TRAINEES = [['rowanf', 'Rowan'], ['bram', 'Bram'], ['rowan', null], ['lyra', 'Lyra'], ['pip', 'Pip']];

function scenes(replay) {
  const list = [
    // the world before the Starfall
    { id: 'wild', bg: 'wild', at: 0.8, text: 'Beyond the town walls lies the wild: endless forests, lakes and hills, home to the survivalmons.' },
    { id: 'brightnest', bg: 'brightnest', at: 0.6, text: 'Deep in the wild lies Brightnest, the rangers\' village. Every ranger hatches a partner from an egg, and the two stay together for life.' },
    { id: 'hearthvale', bg: 'hearthvale', at: 0.6, text: 'At the edge of the wild stands Hearthvale. Its people have always feared survivalmons, and they keep their gate shut.' },
    { id: 'trainees', bg: 'campdusk', at: 0.8, text: 'Brightnest has five trainees: Rowan, Bram, Lyra, Pip, and you, {name}. One week from now, you will all be rangers.' },
    { id: 'test', bg: 'campdusk', at: 0.6, text: '"One last test," says Hollis, your mentor. "A night alone in the wild, each of you. {name}, you go first."' },
    // the Starfall
    { id: 'night', bg: 'valley', at: 1.2, text: 'You walked into the dark alone, scared and proud. The wild was quiet. Too quiet.' },
    { id: 'star', bg: 'valley', at: 1.6, text: 'Then a new star lit up the sky. It grew brighter... and brighter. It was falling.', sound: [[0.4, 'starfall']] },
    { id: 'split', bg: 'valley', at: 0.3, text: 'High above the hills it broke in two. The big piece flew on, far to the west...' },
    { id: 'impact', bg: 'valley', at: 1.7, text: '...and the small piece fell on Brightnest.', sound: [[1.05, 'impact']] },
    { id: 'runhome', bg: 'dawn', at: 0.6, text: 'You ran all night, toward the glow on the hills.' },
    // the ruins
    { id: 'ruins', bg: 'ruins', at: 2.2, text: 'At dawn, Brightnest was gone. No rangers, no survivalmons. Only ruins, and a crater still smoking.' },
    { id: 'hollis', bg: 'ruins', at: 0.5, text: 'Only Hollis lay in the rubble. "{name}... you\'re alive. Creatures crawled out of the star. Our mons turned on us. Everyone... is gone."' },
    { id: 'eggs', bg: 'ruins', at: 0.4, text: replay ? '"The eggs survived. Take one. Only one, quickly."' : '"The eggs survived. Take one. Only one, quickly." Which egg do you take?', pick: !replay },
    { id: 'wren', bg: 'ruins', at: 0.4, text: '"Go to Hearthvale. Find Granny Wren and tell her my name. Help them see the good in survivalmons..."' },
  ];
  if (replay) list.push({ id: 'end', bg: 'ruins', at: 0.3, text: 'Hollis closed his eyes. And that is where your story begins.' });
  else list.push({ id: 'run', bg: 'ruins', at: 0.1, text: '"Now run!"', big: true, auto: 1.8 });
  return list;
}

export async function playOpening({ root = document.body, replay = false, onPick = null } = {}) {
  const A = await loadStoryArt();
  const name = Meta.playerName;
  const list = scenes(replay).map((sc) => (sc.text ? { ...sc, text: sc.text.replaceAll('{name}', name) } : sc));
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
  const heroArt = HERO_ART.rowan; // you: the boy or the girl (setHeroLook)
  // a hero sprite (you, or another trainee by id): standing (dir), or walking (walk = frame clock, wdir)
  const someone = (id, x, y, k, o = {}) => {
    const a = HERO_ART[id];
    if (!a) return;
    let img = a.dirs.south;
    const wd = o.wdir || 'east';
    if (o.walk != null && a.walk?.[wd]) img = a.walk[wd][Math.floor(o.walk) % a.walk[wd].length];
    else if (o.dir) img = a.dirs[o.dir] || img;
    g.drawImage(img, Math.round(x - (a.ax * k)), Math.round(y - a.ay * k), img.width * k, img.height * k);
  };
  const hero = (x, y, k, o = {}) => someone('rowan', x, y, k, o);
  // a survivalmon (or a creature) walking or idling at backdrop scale
  const mon = (id, x, y, k, time, o = {}) => {
    const c = CREATURE[id];
    if (c) drawCreature(g, c, x, y, { anim: o.idle ? 'idle' : 'move', at: time, sx: k, sy: k, left: !!o.left });
  };
  // a name under someone, in small pixel letters
  const label = (text, x, y, color = '#fff6e8') => {
    g.font = '600 6px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'top';
    g.fillStyle = 'rgba(20,12,16,.75)'; const w = g.measureText(text).width + 4; g.fillRect(Math.round(x - w / 2), Math.round(y), Math.round(w), 8);
    g.fillStyle = color; g.fillText(text, Math.round(x), Math.round(y + 1));
  };
  // Hollis standing (his picture faces south), or lying in the rubble (hollis())
  const hollisUp = (x, y, k = 0.55) => {
    const img = A.hollis;
    if (img) g.drawImage(img, Math.round(x - img.width * k / 2), Math.round(y - img.height * k), img.width * k, img.height * k);
  };
  // the Night Star (or a piece of it): a glowing ball with a dark heart
  const starBall = (x, y, r, a = 1) => {
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(255,240,255,${a})`); grd.addColorStop(0.35, `rgba(230,100,210,${0.85 * a})`); grd.addColorStop(1, 'rgba(110,30,190,0)');
    g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
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
    if (s.id === 'impact') shake = t > 1 ? Math.max(0, 1 - (t - 1) / 1.2) * 5 : 0;
    g.save();
    if (shake) g.translate(Math.round((Math.random() - 0.5) * shake * 2), Math.round((Math.random() - 0.5) * shake * 2));
    if (bg) g.drawImage(bg, 0, 0, BW, BH); else { g.fillStyle = s.bg === 'valley' ? '#13183a' : '#5a7a3a'; g.fillRect(0, 0, BW, BH); }
    if (s.bg === 'camp' || s.bg === 'valley') twinkle(performance.now() / 1000);
    switch (s.id) {
      case 'wild': {
        // survivalmons going about their day: walking, hopping, an owl overhead
        tint('255,240,200', 0.15 * (1 - clamp01(t / 1.5)));
        mon('puddlit', lerp(-30, 96, clamp01(t / 14)), 136, 0.6, t + 0.4);
        mon('voltowl', lerp(-30, 280, clamp01(t / 10)), 40 + Math.sin(t * 2) * 4, 0.55, t);
        break;
      }
      case 'brightnest': {
        // the village's survivalmons about their day
        mon('glimmoth', lerp(-20, 300, clamp01(t / 12)), 70 + Math.sin(t * 3) * 5, 0.5, t);
        mon('pebblet', lerp(280, 150, clamp01(t / 10)), 138, 0.55, t, { left: true });
        break;
      }
      case 'hearthvale': {
        // birds over the walls; the gate stays shut
        for (let n = 0; n < 4; n++) {
          const bx = ((t * 14 + n * 47) % 300) - 30, by = 26 + n * 7 + Math.sin(t * 3 + n) * 2;
          g.fillStyle = '#2b1d24'; g.fillRect(Math.round(bx), Math.round(by), 2, 1); g.fillRect(Math.round(bx) + 2, Math.round(by) - 1, 2, 1); g.fillRect(Math.round(bx) - 2, Math.round(by) - 1, 2, 1);
        }
        break;
      }
      case 'trainees': {
        // the five of you around the fire, names under each
        TRAINEES.forEach(([id, nm], n) => {
          const x = 52 + n * 38, y = 136 + (n === 2 ? 2 : 0), bob = Math.sin(t * 2 + n) > 0.95 ? 1 : 0;
          someone(id, x, y - bob, VK, { dir: 'south' });
          if (t > 0.6 + n * 0.25) label(nm || name, x, y + 1, id === 'rowan' ? '#ffd84a' : '#fff6e8');
        });
        break;
      }
      case 'test': {
        // Hollis in front of the tents; the five face him
        hollisUp(FIRE.x + 22, 118, 0.6);
        TRAINEES.forEach(([id], n) => someone(id, 52 + n * 38, 138, VK, { dir: 'north' }));
        break;
      }
      case 'night': {
        // you walk along the road into the dark, alone
        const p = clamp01(t / 7), x = lerp(-12, 118, ease(p));
        hero(x, ROAD, VK, p < 1 ? { walk: t * 8 } : { dir: 'east' });
        tint('8,10,30', 0.25 + 0.1 * p);
        break;
      }
      case 'star': {
        // you stop and look up: a new star swells and pulses, then starts to fall
        tint('8,10,30', 0.3);
        hero(118, ROAD, VK, { dir: 'north' });
        const glow = clamp01(t / 2.5), fall = clamp01((t - 3) / 3);
        tint('120,50,190', 0.22 * glow);
        starBall(STAR.x + 10 * fall, STAR.y + 6 * fall, 4 + 9 * glow + Math.sin(t * 14) * glow * 1.5 + 6 * fall);
        break;
      }
      case 'split': {
        // it breaks in two: the big piece arcs away west, the small one curves down toward the village
        tint('8,10,30', 0.3);
        tint('120,50,190', 0.22);
        hero(118, ROAD, VK, { dir: 'north' });
        const p = clamp01(t / 4.5), e = p * p, cx = STAR.x + 10, cy = STAR.y + 6;
        if (t < 0.35) { starBall(cx, cy, 21 + t * 20); tint('255,220,255', 0.5 * (1 - t / 0.35)); break; }
        const bx = lerp(cx, -60, e), by = cy - 14 * Math.sin(p * Math.PI) + 10 * e;    // west, out of the picture
        const sx = lerp(cx, VILLAGE.x - 30, e * 0.7), sy = lerp(cy, VILLAGE.y - 30, e * 0.7); // toward the village
        trail.push([bx, by, sx, sy]); if (trail.length > 30) trail.shift();
        trail.forEach(([ax, ay, qx, qy], n) => { const a = n / trail.length; g.fillStyle = `rgba(230,120,255,${a * 0.75})`; g.fillRect(Math.round(ax), Math.round(ay), 3, 3); g.fillRect(Math.round(qx), Math.round(qy), 2, 2); });
        starBall(bx, by, 16); starBall(sx, sy, 8);
        break;
      }
      case 'impact': {
        // the small piece comes down on Brightnest: a streak, a white flash, then the fire on the hill
        const hit = 1.05;
        if (t < hit) {
          trail = trail.slice(-10);
          tint('8,10,30', 0.3);
          const p = clamp01(t / hit), x = lerp(VILLAGE.x - 30, VILLAGE.x, p * p), y = lerp(VILLAGE.y - 30, VILLAGE.y, p * p);
          trail.push([x, y]); if (trail.length > 14) trail.shift();
          trail.forEach(([ax, ay], n) => { g.fillStyle = `rgba(240,140,255,${(n / trail.length) * 0.8})`; g.fillRect(Math.round(ax), Math.round(ay), 2, 2); });
          starBall(x, y, 9);
          hero(118, ROAD, VK, { dir: 'north' });
        } else {
          trail = [];
          if (A.impact && A.impact !== A.valley) g.drawImage(A.impact, 0, 0, BW, BH);
          else {
            // no picture: a pillar of light and fire over the village
            const k = clamp01((t - hit) / 1.5);
            starBall(VILLAGE.x, VILLAGE.y, 20 + 60 * k, 0.9);
            g.fillStyle = `rgba(255,200,255,${0.6 * (1 - k)})`; g.fillRect(VILLAGE.x - 6, 0, 12, VILLAGE.y);
          }
          // the shockwave rolling over the hills
          const r = (t - hit) * 140;
          g.strokeStyle = `rgba(255,220,255,${Math.max(0, 0.7 - (t - hit) * 0.5)})`; g.lineWidth = 2;
          g.beginPath(); g.ellipse(VILLAGE.x, VILLAGE.y + 4, r, r * 0.35, 0, 0, Math.PI * 2); g.stroke();
          if (Math.random() < 0.6) parts.push({ x: VILLAGE.x + (Math.random() - 0.5) * 30, y: VILLAGE.y, vx: (Math.random() - 0.5) * 20, vy: -10 - Math.random() * 20, r: 1 + Math.random(), life: 1.5 + Math.random(), age: 0, c: '255,170,90', a: 0.9 });
          drawParts(dt);
          hero(118, ROAD, VK, { dir: 'north' });
          tint('255,255,255', Math.max(0, 1 - (t - hit) / 0.5));
        }
        break;
      }
      case 'runhome': {
        // you run: faster steps, a little dust
        const p = clamp01(t / 5), x = lerp(-16, 272, p);
        hero(x, 136, VK, { walk: t * 14 });
        if (Math.random() < 0.5) parts.push({ x: x - 6, y: 136, vx: -8, vy: -3, r: 1, life: 0.5, age: 0, c: '170,150,130', a: 0.5 });
        drawParts(dt);
        break;
      }
      case 'ruins': {
        smoke(dt, 4);
        drawParts(dt);
        const p = clamp01((t - 0.3) / 2.4);
        hero(lerp(-16, HERO.x, ease(p)), HERO.y, HK, p < 1 ? { walk: t * 9 } : { dir: 'east' });
        tint('0,0,0', 0.6 * (1 - clamp01(t / 1.2)));
        break;
      }
      case 'hollis': case 'eggs': case 'wren': case 'run': case 'end': {
        smoke(dt, 4);
        drawParts(dt);
        hollis(s.id === 'end' ? clamp01(t / 2) : 0);
        hero(HERO.x, HERO.y, HK, { dir: s.id === 'run' ? 'west' : 'east' });
        STARTERS.slice(0, 5).forEach((id, n) => {
          if (s.id === 'hollis') return; // the basket comes out with his words about the eggs
          const [x, y] = EGG_SPOTS[n];
          if (picked && id === picked && s.id !== 'eggs') return; // carried now
          eggAt(x, y, id, t, s.id === 'eggs' && choosing === id);
        });
        if (s.id === 'run') {
          const blob = CREATURE.blob, bt = (blobClock += dt);
          for (let n = 0; n < 3; n++) {
            const p = clamp01((bt - n * 0.4) / 3), bx = lerp(CRATER.x + (n - 1) * 10, HERO.x + 40 + n * 12, ease(p) * 0.8), by = lerp(CRATER.y + 4, HERO.y - 4, ease(p) * 0.8);
            if (blob && bt > n * 0.4) drawCreature(g, blob, bx, by, { anim: 'move', at: bt + n, sx: 2 * HK, sy: 2 * HK, left: true });
          }
          tint('60,20,90', 0.15 * clamp01(t / 1.5));
        }
        break;
      }
      default: break;
    }
    g.restore();
  };
  // Hollis, hurt, lying in the rubble (his own picture if there is one, else a dark shape)
  const hollis = (fade = 0) => {
    const img = A.hollis, k = 0.55;
    g.save(); g.globalAlpha = 1 - fade * 0.7;
    g.translate(HOLLIS.x, HOLLIS.y - 4); g.rotate(-Math.PI / 2);
    if (img) g.drawImage(img, -img.width * k / 2, -img.height * k, img.width * k, img.height * k);
    else { g.fillStyle = '#3a4a2a'; g.fillRect(-14, -8, 28, 8); }
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

// The ending: the Scar, after the West Gate Lv 4. A few pictures with words; tap to go on.
export async function playEnding({ root = document.body } = {}) {
  const A = await loadStoryArt();
  const pages = [
    'Past the last gate, the west road ended at the Scar: where the big piece of the Night Star came down.',
    'Its heart was still beating, deep in the crater. For every creature you defeated, it made another.',
    'There was no way to stop them. No way to break it.',
    'The only way is to survive.',
  ];
  const el = document.createElement('div');
  el.className = 'story';
  el.innerHTML = '<canvas class="story-cv"></canvas><div class="story-cap"><p></p><span class="story-next">▶</span></div>';
  root.appendChild(el);
  const cv = el.querySelector('canvas'), g = cv.getContext('2d'), capP = el.querySelector('.story-cap p'), cap = el.querySelector('.story-cap');
  let i = 0, shown = 0, t = 0, last = performance.now(), done = false, resolveIt;
  const finished = new Promise((r) => { resolveIt = r; });
  const next = () => {
    if (shown < pages[i].length) { shown = pages[i].length; return; }
    i++; shown = 0; t = 0;
    if (i >= pages.length) { done = true; el.remove(); window.removeEventListener('keydown', onKey, true); resolveIt(); }
  };
  const onKey = (e) => { if (['KeyE', 'Enter', 'Space'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); next(); } };
  el.addEventListener('click', () => { Audio.unlock(); next(); });
  window.addEventListener('keydown', onKey, true);
  Audio.play('starfall');
  const frame = (now) => {
    if (done) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    const W = el.clientWidth, H = el.clientHeight, dpr = Math.min(3, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const band = Math.round(Math.min(96, H * 0.22) * dpr);
    let k = Math.min(cv.width / BW, (cv.height - band) / BH); if (k >= 2) k = Math.floor(k);
    const top = Math.max(0, Math.round((cv.height - band - BH * k) / 2));
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
    g.setTransform(k, 0, 0, k, Math.round((cv.width - BW * k) / 2), top);
    g.imageSmoothingEnabled = false;
    if (A.scar) g.drawImage(A.scar, 0, 0, BW, BH);
    // the heart beats: a slow red-purple pulse over the picture, stronger on the last page
    const beat = Math.max(0, Math.sin(performance.now() / 1000 * 3.2)) ** 6;
    g.fillStyle = `rgba(180,40,160,${(i >= 3 ? 0.18 : 0.08) * beat})`; g.fillRect(0, 0, BW, BH);
    if (i === 0) { g.fillStyle = `rgba(0,0,0,${Math.max(0, 1 - t / 1.5)})`; g.fillRect(0, 0, BW, BH); }
    shown = Math.min(pages[i].length, shown + dt * TYPE_SPEED);
    const n = Math.floor(shown);
    if (capP.dataset.n !== `${i}:${n}`) { capP.textContent = pages[i].slice(0, n); capP.dataset.n = `${i}:${n}`; }
    cap.classList.toggle('ready', n >= pages[i].length);
    cap.classList.toggle('big', i === pages.length - 1);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return finished;
}
