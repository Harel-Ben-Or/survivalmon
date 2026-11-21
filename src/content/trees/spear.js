// Bram's Ranger's Spear tree (see evolve.js for how trees work, and the weapons doc for the design).
// The tree keeps the id 'pitchfork' so Bram's hero weapon id still works; the thrust is drawn with the
// pitchfork's icon until the spear has its own picture.
import { Audio } from '../../core/audio.js';
import { TAU } from '../../core/util.js';
import { ICON } from '../../gfx/assets.js';
import { snap, dir8 } from '../../gfx/art.js';
import {
  ELEMENTS, addPoison, glowOn, wHit, fireZone, poisonZone, lineHit, step, hookDamage, away, freezeE, strikeAt,
  zapAround, spots, ringSpots, dropTrail, ringWave, coneHit, capHeal,
} from '../wcore.js';

const REACH = 90; // Bram thrusts at the nearest foe this close (or straight ahead)

// ------------------------------------------------------------ the spear
export const SPEAR = {
  name: "Ranger's Spear", icon: 'pitchfork',
  base: { dmg: 20, cd: 0.95, n: 1, reach: 55, w: 7, knock: 120 }, // reach 55 (from 45) and a 0.95 s thrust (from 1.1): melee needs a little help early
  steps: {
    2: step('+6 damage', (s) => { s.dmg += 6; }),
    3: step('Reach +30%', (s) => { s.reach *= 1.3; }),
  },
  r1: {
    sweep: {
      name: 'Sweep', desc: 'A half-circle swing 60 px around your front instead of a thrust, 110% damage. For crowds around you.',
      apply: (s) => { s.sweep = true; s.dmg *= 1.1; s.sweepR = 60; s.arc = Math.PI; },
      steps: {
        5: step('+5 damage', (s) => { s.dmg += 5; }),
        6: step('Full circle', (s) => { s.arc = TAU; }),
        7: step('Sweep 25% bigger', (s) => { s.sweepR = 75; }),
      },
      r2: {
        whirl: {
          name: 'Whirlwind', desc: 'Every 6 s, Bram spins for 1.5 s while you keep moving, hitting everything within 75 px for 50%.',
          apply: (s) => { s.whirlEvery = 6; s.whirlT = 1.5; s.whirlK = 0.5; },
          steps: { 9: step('Spin every 4.5 s', (s) => { s.whirlEvery = 4.5; }), 10: step('Spin lasts 2.5 s', (s) => { s.whirlT = 2.5; }), 11: step('+5 damage', (s) => { s.dmg += 5; }) },
          finals: {
            fire: { name: 'Fire Tornado', desc: 'The spin leaves a trail of fire behind you for 2 s.' },
            ice: { name: 'Snowstorm', desc: 'While it spins, every foe within 110 px is chilled.' },
            poison: { name: 'Toxic Tornado', desc: 'Where the spin ends, it leaves a poison cloud 75 px across for 3 s.' },
            bolt: { name: 'Thunder Spin', desc: 'Every spin hit also zaps 1 more foe within 100 px.' },
            glow: { name: 'Radiant Spin', desc: 'You heal 1 HP for each foe the spin hits, up to 4 HP a second.' },
          },
        },
        counter: {
          name: 'Counter', desc: 'When something hits you, the spear sweeps all around you at once for 150% damage. Once a second at most.',
          apply: (s) => { s.counterK = 1.5; },
          steps: { 9: step('Counter does 200%', (s) => { s.counterK = 2; }), 10: step('Counters block half the hit', (s) => { s.block = true; }), 11: step('+5 damage', (s) => { s.dmg += 5; }) },
          finals: {
            fire: { name: 'Burning Pride', desc: 'A counter sets every foe it hits burning twice as hard.' },
            ice: { name: 'Frozen Guard', desc: 'A counter freezes every foe it hits for 1 s.' },
            poison: { name: 'Thorn Guard', desc: 'Any foe that hits you gets 3 poison stacks, counter or not.' },
            bolt: { name: 'Storm Guard', desc: 'A counter also sends bolts to 5 foes within 120 px.' },
            glow: { name: 'Holy Guard', desc: 'Each counter heals you 3 HP.' },
          },
        },
        wave: {
          name: 'Wave Sweep', desc: 'Each sweep also sends a wave 60 px farther out, 60% damage.',
          apply: (s) => { s.waveD = 60; s.waveK = 0.6; },
          steps: { 9: step('Waves go 50% farther', (s) => { s.waveD = 90; }), 10: step('Waves do 80%', (s) => { s.waveK = 0.8; }), 11: step('+5 damage', (s) => { s.dmg += 5; }) },
          finals: {
            fire: { name: 'Flame Wave', desc: 'Each wave leaves a ring of fire for 2 s.' },
            ice: { name: 'Frost Wave', desc: 'Each wave hit counts as 2 hits toward freezing.' },
            poison: { name: 'Rot Wave', desc: 'Each wave leaves a poison mist for 3 s.' },
            bolt: { name: 'Thunder Wave', desc: 'Each wave ends with 3 lightning strikes on foes at its edge.' },
            glow: { name: 'Dawn Wave', desc: 'Foes the wave hits glow for 6 s: your mons do +40% to them.' },
          },
        },
      },
    },
    long: {
      name: 'Long Thrust', desc: 'Twice the reach, and the tip, the last third of the line, does double damage. For lines and bosses.',
      apply: (s) => { s.reach *= 2; s.tipK = 2; },
      steps: {
        5: step('+6 damage', (s) => { s.dmg += 6; }),
        6: step('Thrusts front and back', (s) => { s.back = true; }),
        7: step('Thrusts 15% faster', (s) => { s.cd *= 0.85; }),
      },
      r2: {
        impale: {
          name: 'Impale', desc: '+8 damage. The first foe hit is pinned for 1 s and takes 50% more damage from everything. Bosses are slowed instead.',
          apply: (s) => { s.pinT = 1; s.pinN = 1; s.dmg += 8; },
          steps: { 9: step('Pins for 1.5 s', (s) => { s.pinT = 1.5; }), 10: step('Pins the first 2 foes', (s) => { s.pinN = 2; }), 11: step('+6 damage', (s) => { s.dmg += 6; }) },
          finals: {
            fire: { name: 'Branding Spear', desc: 'Pinned foes burn 3× as hard.' },
            ice: { name: 'Ice Spike', desc: 'Pinned foes are frozen solid, and foes next to them are chilled.' },
            poison: { name: 'Venom Spike', desc: 'Pinning adds 5 poison stacks at once.' },
            bolt: { name: 'Lightning Rod', desc: 'A pinned foe is struck by lightning every 0.3 s while it\'s pinned.' },
            glow: { name: 'Beacon Spike', desc: 'Pinned foes glow bright, and your mons attack them first with +40% damage.' },
          },
        },
        throw: {
          name: 'Spear Throw', desc: 'Every 4th thrust, Bram throws the spear instead: it flies 300 px through everything for 200% damage.',
          apply: (s) => { s.throwEvery = 4; s.throwK = 2; s.throwN = 1; },
          steps: { 9: step('Throw every 3rd thrust', (s) => { s.throwEvery = 3; }), 10: step('The throw does 300%', (s) => { s.throwK = 3; }), 11: step('Throws 2 spears in a V', (s) => { s.throwN = 2; }) },
          finals: {
            fire: { name: 'Flaming Javelin', desc: 'The thrown spear leaves a line of fire for 2 s.' },
            ice: { name: 'Ice Javelin', desc: 'The thrown spear freezes every foe it passes for 1 s.' },
            poison: { name: 'Venom Javelin', desc: 'The thrown spear leaves a poison trail for 3 s.' },
            bolt: { name: 'Thunder Javelin', desc: 'At the end of its flight it bursts into lightning, bolts to 6 foes nearby.' },
            glow: { name: 'Sun Javelin', desc: 'Every foe on its line glows for 6 s: your mons do +40% to them.' },
          },
        },
        crack: {
          name: 'Earthsplitter', desc: 'Each thrust cracks the ground along its line; 0.4 s later the crack bursts for 60% damage.',
          apply: (s) => { s.crackK = 0.6; s.crackL = 1; },
          steps: { 9: step('Burst does 100%', (s) => { s.crackK = 1; }), 10: step('Crack 30% longer', (s) => { s.crackL = 1.3; }), 11: step('+6 damage', (s) => { s.dmg += 6; }) },
          finals: {
            fire: { name: 'Lava Crack', desc: 'The crack turns to lava for 3 s, burning foes on it.' },
            ice: { name: 'Glacier Crack', desc: 'The burst freezes every foe on it for 1 s.' },
            poison: { name: 'Toxic Rift', desc: 'The crack leaks poison for 3 s.' },
            bolt: { name: 'Thunder Rift', desc: 'The burst is lightning, and it jumps to foes beside the line.' },
            glow: { name: 'Dawn Rift', desc: 'You heal 1 HP for each foe the burst hits, up to 6.' },
          },
        },
      },
    },
    flurry: {
      name: 'Flurry', desc: '3 quick thrusts in a row, 0.15 s apart, 50% damage each. For tearing down one foe.',
      apply: (s) => { s.n = 3; s.dmg *= 0.5; s.gap = 0.15; },
      steps: {
        5: step('+1 thrust', (s) => { s.n += 1; }),
        6: step('+4 damage', (s) => { s.dmg += 4; }),
        7: step('Flurry 20% faster', (s) => { s.cd *= 0.8; }),
      },
      r2: {
        finisher: {
          name: 'Finisher', desc: 'The last thrust of each flurry is a big one: double reach and 300% damage.',
          apply: (s) => { s.finK = 3; s.finReach = 2; },
          steps: { 9: step('Finisher does 400%', (s) => { s.finK = 4; }), 10: step('Finisher stuns for 0.5 s', (s) => { s.finStun = 0.5; }), 11: step('+4 damage', (s) => { s.dmg += 4; }) },
          finals: {
            fire: { name: 'Dragon Finisher', desc: 'The finisher breathes a cone of fire 80 px ahead.' },
            ice: { name: 'Glacial Finisher', desc: 'The finisher freezes every foe it hits for 1.5 s.' },
            poison: { name: 'Viper Finisher', desc: 'The finisher doubles the poison stacks on every foe it hits (up to 10).' },
            bolt: { name: 'Thunder Finisher', desc: 'The finisher calls a lightning strike at its tip, 150% damage within 30 px.' },
            glow: { name: 'Sunrise Finisher', desc: 'The finisher heals you 2 HP for each foe it hits.' },
          },
        },
        armor: {
          name: 'Armor Break', desc: 'Each hit cracks the foe\'s armor: it takes 5% more damage from everything, up to +30%, for 4 s.',
          apply: (s) => { s.brkCap = 0.3; },
          steps: { 9: step('Breaks up to 45%', (s) => { s.brkCap = 0.45; }), 10: step('+1 thrust', (s) => { s.n += 1; }), 11: step('+4 damage', (s) => { s.dmg += 4; }) },
          finals: {
            fire: { name: 'Melt', desc: 'Broken armor also makes burns 50% hotter.' },
            ice: { name: 'Shatter', desc: 'A frozen foe with fully broken armor takes triple damage from the next hit.' },
            poison: { name: 'Corrode', desc: 'Each poison stack also counts as 5% armor break.' },
            bolt: { name: 'Conductor', desc: 'Bolts do double damage to foes with fully broken armor.' },
            glow: { name: 'Expose', desc: 'Armor break counts double for your mons\' hits.' },
          },
        },
        lunge: {
          name: 'Lunge', desc: 'Every 5 s, Bram dashes 60 px to the nearest foe and flurries on landing. Nothing can hurt him in the dash.',
          apply: (s) => { s.lungeEvery = 5; s.lungeX = 0; },
          steps: { 9: step('Lunge every 3.5 s', (s) => { s.lungeEvery = 3.5; }), 10: step('The lunge flurry has 2 more thrusts', (s) => { s.lungeX = 2; }), 11: step('+4 damage', (s) => { s.dmg += 4; }) },
          finals: {
            fire: { name: 'Comet Lunge', desc: 'The dash leaves a trail of fire for 2 s.' },
            ice: { name: 'Frost Lunge', desc: 'Every foe near the landing spot (40 px) freezes for 1 s.' },
            poison: { name: 'Viper Lunge', desc: 'The dash leaves a poison trail for 3 s.' },
            bolt: { name: 'Bolt Lunge', desc: 'Bram dashes as a lightning bolt, hitting everything on the way for 100% damage.' },
            glow: { name: 'Dawn Lunge', desc: 'Each lunge heals you 3 HP.' },
          },
        },
      },
    },
  },
  fire: spearFire,
  tick: spearTick,
};

// ------------------------------------------------------------ attacking
const aim = (g) => {
  const P = g.player, t = g.nearestEnemy(P.x, P.y, REACH, (e) => !e.hidden && !e.fainted);
  return t ? Math.atan2(t.y - P.y, t.x - P.x) : P.faceAngle;
};
function spearFire(g, w, st) {
  const P = g.player, S = P.stats, a = aim(g);
  w.thrusts = (w.thrusts || 0) + 1;
  if (st.r1 === 'sweep') {
    const n = st.arc < TAU ? 1 + S.amount : 1;
    for (let i = 0; i < n; i++) sweep(g, w, st, a + (i * TAU) / n);
  } else if (st.r1 === 'flurry') flurry(g, w, st, st.n);
  else {
    const n = (st.back ? 2 : 1) + S.amount;
    const throwNow = st.r2 === 'throw' && w.thrusts % st.throwEvery === 0;
    for (let i = 0; i < n; i++) {
      const b = a + (i * TAU) / n;
      if (i === 0 && throwNow) javelins(g, st, b);
      else thrust(g, w, st, b);
      if (st.r2 === 'crack') crack(g, st, P.x, P.y, b);
    }
  }
  Audio.play('swing');
}
// One thrust: the spearhead shoots out along angle a and every foe on its line is hit once.
// o: { reach, dmg, life, fin, scale }
function thrust(g, w, st, a, o = {}) {
  const P = g.player, S = P.stats;
  const p = g.spawnProjectile({
    x: P.x, y: P.y, r: st.w * Math.sqrt(S.area), dmg: o.dmg ?? st.dmg, pierce: Infinity, life: o.life || 0.24,
    src: 'pitchfork', rot: a, knock: st.knock, z: 6, noHit: true, scale: o.scale,
  });
  p.st = st; p.w = w; p.a = a; p.reach = (o.reach || st.reach) * S.area; p.fin = o.fin; p.pins = 0;
  p.update = thrustMove; p.draw = drawSpear; p.img = g.shot?.spear || null; // (a set spear thrusts as its own picture)
  if (o.fin && st.el === 'bolt') p.onExpire = (g2, q) => strikeAt(g2, q.x, q.y, 30, q.st.dmg * 1.5);
  return p;
}
// The spearhead moves out fast, then slows; it hits along the whole stretch it covered this frame
function thrustMove(g, p) {
  const P = g.player, k = 1 - Math.pow(1 - Math.min(1, p.age / p.maxLife), 3);
  const nx = P.x + Math.cos(p.a) * p.reach * k, ny = P.y + Math.sin(p.a) * p.reach * k;
  const found = [];
  lineHit(g, p.x, p.y, nx, ny, p.r, (e) => { if (!p.hitSet.has(e.id) && !e.hidden && !e.fainted) { p.hitSet.add(e.id); found.push(e); } });
  if (found.length > 1) found.sort((u, v) => (u.x - P.x) ** 2 + (u.y - P.y) ** 2 - ((v.x - P.x) ** 2 + (v.y - P.y) ** 2));
  for (const e of found) spearHit(g, p, e);
  p.x = nx; p.y = ny;
  return true;
}
function drawSpear(ctx, p, cam) {
  ctx.save();
  ctx.translate(snap(p.x - cam.x), snap(p.y - cam.y - 7));
  ctx.rotate(p.a + Math.PI / 4);
  if (p.scale) ctx.scale(p.scale, p.scale);
  if (p.img) ctx.drawImage(p.img, -12, -4, 16, 16); else ctx.drawImage(ICON.pitchfork, -12, -4);
  ctx.restore();
}
function sweep(g, w, st, a) {
  const P = g.player, R = st.sweepR * P.stats.area, arc = st.arc;
  g.addEffect({ type: 'slash', color: g.charging ? '#ffe07a' : g.shot?.slash, x: P.x, y: P.y, a, R, arc, life: 0.2, follow: true });
  g.enemiesInRadius(P.x, P.y, R, (e) => {
    if (e.hidden || e.fainted) return;
    if (arc < TAU) {
      let d = Math.atan2(e.y - P.y, e.x - P.x) - a;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) > arc / 2) return;
    }
    wHit(g, e, st.dmg, st, { ...away(P.x, P.y, e), knock: st.knock, silent: true });
  });
  if (st.r2 === 'wave') wave(g, st, R);
  Audio.play('hit');
}
function flurry(g, w, st, n) {
  for (let i = 0; i < n; i++) {
    g.after(i * st.gap, (g2) => {
      const fin = st.r2 === 'finisher' && i === n - 1, S = g2.player.stats, a = aim(g2), m = 1 + S.amount;
      for (let j = 0; j < m; j++) {
        const b = a + (j * TAU) / m;
        thrust(g2, w, st, b, { life: fin ? 0.2 : 0.13, fin, reach: fin ? st.reach * st.finReach : st.reach, dmg: fin ? st.dmg * st.finK : st.dmg, scale: fin ? 1.4 : undefined });
        if (fin && st.el === 'fire') dragonBreath(g2, st, b);
      }
      if (i) Audio.play('swing');
    });
  }
}

// ------------------------------------------------------------ every hit
function spearHit(g, p, e) {
  const st = p.st, P = g.player;
  let dmg = p.dmg;
  const x = { kx: Math.cos(p.a), ky: Math.sin(p.a), knock: p.knock };
  const pinned = e.wPin && e.wPin.until > g.time;
  let pin = false;
  if (p.jav) {
    if (st.el === 'ice') x.freeze = 1;
    x.glowT = 6; x.glowK = 0.4;
  } else {
    // the tip, the last third of the line, hits twice as hard
    if (st.tipK && (e.x - P.x) * Math.cos(p.a) + (e.y - P.y) * Math.sin(p.a) >= p.reach * (2 / 3)) dmg *= st.tipK;
    if (p.fin) {
      if (st.finStun) x.stun = st.finStun;
      if (st.el === 'ice') x.freeze = 1.5;
    }
    if (st.r2 === 'impale' && p.pins < st.pinN) {
      p.pins++; pin = true;
      if (e.boss) x.chill = st.pinT;
      if (st.el === 'ice') x.freeze = st.pinT;
      if (st.el === 'poison') x.stacks = 5;
    }
  }
  if (pinned || pin) { x.knock = 0; if (st.el === 'fire') x.burnK = 3; }
  const res = wHit(g, e, dmg, st, x);
  if (e.dead) return res;
  if (pin) pinFoe(g, p.w, st, e);
  if (st.r2 === 'armor') breakArmor(g, st, e);
  if (p.fin) {
    if (st.el === 'poison' && e.poison) { e.poison.cap = Math.max(e.poison.cap, 10); e.poison.stacks = Math.min(10, e.poison.stacks * 2); }
    if (st.el === 'glow') P.heal(2);
  }
  return res;
}

// ------------------------------------------------------------ Sweep: Whirlwind, Counter, Wave Sweep
function wave(g, st, R) {
  const P = g.player, R1 = R + st.waveD * P.stats.area, x0 = P.x, y0 = P.y, color = st.el ? ELEMENTS[st.el].color : '#ffffff';
  ringWave(g, x0, y0, R, R1, 0.25, (e) => {
    if (e.hidden || e.fainted) return;
    wHit(g, e, st.dmg * st.waveK, st, { ...away(x0, y0, e), knock: 60, small: true, silent: true, iceHits: st.el === 'ice' ? 2 : 1, glowT: 6, glowK: 0.4 });
  }, color);
  if (st.el === 'fire') ringSpots(x0, y0, R1, 14, (x, y) => fireZone(g, x, y, 10, 2, st.dmg * 0.25));
  if (st.el === 'poison') ringSpots(x0, y0, R1 - 8, 9, (x, y) => poisonZone(g, x, y, 14, 3, st.dmg * 0.15));
  if (st.el === 'bolt') {
    g.after(0.25, (g2) => {
      const edge = g2.randomEnemies(x0, y0, R1 + 25, 12).filter((e) => Math.abs(Math.hypot(e.x - x0, e.y - y0) - R1) <= 25).slice(0, 3);
      for (const e of edge) strikeAt(g2, e.x, e.y, 12, st.dmg * 0.5);
    });
  }
}
function whirlTick(g, w, st, dt) {
  const P = g.player, S = P.stats;
  if ((w.whirlCd = (w.whirlCd ?? 1) - dt) <= 0) { w.whirlCd = st.whirlEvery * S.cooldown; w.spinLeft = st.whirlT; w.spinTick = 0; w.trX = undefined; }
  if (!(w.spinLeft > 0)) return;
  w.spinLeft -= dt;
  const R = (st.sweepR || 75) * S.area;
  if ((w.spinTick -= dt) <= 0) {
    w.spinTick += 0.25;
    g.addEffect({ type: 'slash', color: g.charging ? '#ffe07a' : g.shot?.slash, x: P.x, y: P.y, a: (g.time * 9) % TAU, R, arc: TAU, life: 0.22, follow: true });
    g.enemiesInRadius(P.x, P.y, R, (e) => {
      if (e.hidden || e.fainted) return;
      wHit(g, e, st.dmg * st.whirlK, st, { ...away(P.x, P.y, e), knock: 60, small: true, silent: true });
      if (st.el === 'bolt') zapAround(g, e.x, e.y, 100, 1, st.dmg * st.whirlK * 0.4, 0, e);
      if (st.el === 'glow') capHeal(g, w.healCap || (w.healCap = {}), 1, 4);
    });
    if (st.el === 'ice') g.enemiesInRadius(P.x, P.y, 110, (e) => { e.chill = Math.max(e.chill, 0.5); });
    Audio.play('swing');
  }
  if (st.el === 'fire') dropTrail(w, 16, (x, y) => fireZone(g, x, y, 12, 2, st.dmg * 0.25), P.x, P.y);
  if (w.spinLeft <= 0 && st.el === 'poison') poisonZone(g, P.x, P.y, 37.5, 3, st.dmg * 0.15);
}
// Counter: Bram reacts to being hit. The hero's hurt() is wrapped once (on this run's hero) to see it.
function hookHurt(g) {
  const P = g.player;
  if (!P || typeof P.hurt !== 'function' || P.hurt.wHook) return;
  const cur = P.hurt;
  const fn = function (dmg, src) {
    const w = this.main, st = w?.st;
    const on = w?.id === 'pitchfork' && st?.r2 === 'counter' && g.mode === 'world';
    const ready = on && !((w.counterT || 0) > g.time);
    if (ready && st.block) dmg *= 0.5; // the hit that sets it off only does half
    const hit = cur.call(this, dmg, src);
    if (hit && on) {
      if (st.el === 'poison' && src?.def && !src.dead && !src.hostile) addPoison(src, 0.15 * st.dmg, 3, 5);
      if (ready) { w.counterT = g.time + 1; counter(g, st); }
    }
    return hit;
  };
  fn.wHook = true;
  P.hurt = fn;
}
function counter(g, st) {
  const P = g.player, R = (st.sweepR || 75) * P.stats.area;
  let n = 0;
  g.addEffect({ type: 'slash', color: g.charging ? '#ffe07a' : g.shot?.slash, x: P.x, y: P.y, a: P.faceAngle, R, arc: TAU, life: 0.22, follow: true });
  g.addEffect({ type: 'ring', x: P.x, y: P.y, R, life: 0.25, color: st.el ? ELEMENTS[st.el].color : '#ffffff' });
  g.enemiesInRadius(P.x, P.y, R, (e) => {
    if (e.hidden || e.fainted) return;
    n++;
    wHit(g, e, st.dmg * st.counterK, st, { ...away(P.x, P.y, e), knock: 160, silent: true, burnK: st.el === 'fire' ? 2 : 1, freeze: st.el === 'ice' ? 1 : 0 });
  });
  if (st.el === 'bolt') zapAround(g, P.x, P.y, 120, 5, st.dmg * 0.5);
  if (st.el === 'glow') P.heal(3);
  g.shake(2, 0.12);
  Audio.play('swing');
  return n;
}

// ------------------------------------------------------------ Long Thrust: Impale, Spear Throw, Earthsplitter
function pinFoe(g, w, st, e) {
  if (e.boss) return; // a boss is only slowed (chilled by the hit)
  hookDamage(g);
  e.wPin = { k: 0.5, until: g.time + st.pinT };
  e.root = Math.max(e.root, st.pinT); e.kbx = 0; e.kby = 0;
  g.addEffect({ type: 'flashring', x: e.x, y: e.y, R: 10, life: 0.2, color: st.el ? ELEMENTS[st.el].color : '#ffffff' });
  if (st.el === 'ice') g.enemiesInRadius(e.x, e.y, 30, (o) => { if (o !== e) o.chill = Math.max(o.chill, 2); });
  if (st.el === 'bolt') (w.rods || (w.rods = [])).push({ e, until: g.time + st.pinT, t: 0 });
  if (st.el === 'glow') { glowOn(e, Math.max(3, st.pinT), 0.4); g.beacon = e; }
}
function javelins(g, st, a) {
  const P = g.player, S = P.stats, sp = 400 * S.projSpeed, L = 300;
  for (const b of st.throwN === 2 ? [a - 0.2, a + 0.2] : [a]) {
    const p = g.spawnProjectile({
      x: P.x, y: P.y, vx: Math.cos(b) * sp, vy: Math.sin(b) * sp, r: 6, dmg: st.dmg * st.throwK, pierce: Infinity,
      life: L / sp, src: 'pitchfork', rot: b, knock: 80, z: 6, scale: 1.2,
    });
    p.st = st; p.a = b; p.jav = true; p.hit = spearHit; p.draw = drawSpear;
    if (st.el === 'fire') p.update = (g2, q) => { dropTrail(q, 20, (x, y) => fireZone(g2, x, y, 10, 2, q.st.dmg * 0.25)); return false; };
    if (st.el === 'poison') p.update = (g2, q) => { dropTrail(q, 20, (x, y) => poisonZone(g2, x, y, 10, 3, q.st.dmg * 0.15)); return false; };
    if (st.el === 'bolt') p.onExpire = (g2, q) => { g2.addEffect({ type: 'flashring', x: q.x, y: q.y, R: 14, life: 0.2, color: ELEMENTS.bolt.color }); zapAround(g2, q.x, q.y, 100, 6, q.st.dmg * 0.5); };
  }
}
function crack(g, st, x, y, a) {
  const L = st.reach * g.player.stats.area * st.crackL, bx = x + Math.cos(a) * L, by = y + Math.sin(a) * L;
  g.zap([[x, y + 8], [bx, by + 8]], 0.45, ['#6a4a2a', '#d8c8a0']); // the crack, along the ground
  g.after(0.4, (g2) => {
    let n = 0;
    const hit = new Set();
    lineHit(g2, x, y, bx, by, 8, (e) => {
      if (e.hidden || e.fainted) return;
      hit.add(e); n++;
      wHit(g2, e, st.dmg * st.crackK, st, { knock: 50, small: true, silent: true, freeze: st.el === 'ice' ? 1 : 0, element: st.el === 'bolt' ? 'light' : undefined });
    });
    spots(x, y, bx, by, 22, (sx, sy) => g2.addEffect({ type: 'explosion', x: sx, y: sy, R: 9, life: 0.22, color: st.el ? ELEMENTS[st.el].color : '#b08a5a' }));
    if (st.el === 'bolt') {
      g2.zap([[x, y], [bx, by]], 0.25);
      // it jumps to foes beside the line
      lineHit(g2, x, y, bx, by, 40, (e) => {
        if (hit.has(e) || e.hidden || e.fainted) return;
        const t = Math.max(0, Math.min(1, ((e.x - x) * (bx - x) + (e.y - y) * (by - y)) / (L * L || 1)));
        g2.zap([[x + (bx - x) * t, y + (by - y) * t], [e.x, e.y]], 0.2);
        g2.damageEnemy(e, st.dmg * st.crackK * 0.5, { element: 'light', small: true, silent: true });
      });
    }
    if (st.el === 'fire') spots(x, y, bx, by, 18, (sx, sy) => fireZone(g2, sx, sy, 9, 3, st.dmg * 0.25));
    if (st.el === 'poison') spots(x, y, bx, by, 18, (sx, sy) => poisonZone(g2, sx, sy, 10, 3, st.dmg * 0.15));
    if (st.el === 'glow' && n) g2.player.heal(Math.min(6, n));
    g2.shake(1.5, 0.1);
  });
}

// ------------------------------------------------------------ Flurry: Finisher, Armor Break, Lunge
function dragonBreath(g, st, a) {
  const P = g.player, R = 80 * P.stats.area;
  coneHit(g, P.x, P.y, a, R, 0.45, (e) => { if (!e.hidden && !e.fainted) wHit(g, e, st.dmg, st, { small: true, silent: true, knock: 30, kx: Math.cos(a), ky: Math.sin(a) }); });
  for (const [d, r] of [[22, 10], [46, 14], [70, 18]]) fireZone(g, P.x + Math.cos(a) * d * P.stats.area, P.y + Math.sin(a) * d * P.stats.area, r, 1.5, st.dmg * 0.25);
  g.particles.burst(P.x + Math.cos(a) * 30, P.y + Math.sin(a) * 30 - 6, { n: 16, colors: ['#ffe07a', '#f6a03a', '#e0483e'], speed: 90, life: 0.35 });
}
function breakArmor(g, st, e) {
  hookDamage(g);
  const b = e.brk && e.brk.until > g.time ? e.brk : (e.brk = { v: 0 });
  b.v = Math.min(st.brkCap, b.v + 0.05); b.cap = st.brkCap; b.until = g.time + 4; b.el = st.el;
}
function lungeTick(g, w, st, dt) {
  if ((w.lungeCd = (w.lungeCd ?? 1.5) - dt) > 0) return;
  const P = g.player, t = g.nearestEnemy(P.x, P.y, 140, (e) => !e.hidden && !e.fainted);
  if (!t) { w.lungeCd = 0.3; return; }
  w.lungeCd = st.lungeEvery * P.stats.cooldown;
  const a = Math.atan2(t.y - P.y, t.x - P.x), d = Math.max(0, Math.min(60, Math.hypot(t.x - P.x, t.y - P.y) - 8));
  const sp = 300, T = Math.max(0.06, d / sp), x0 = P.x, y0 = P.y;
  // the hero's own dash carries the lunge: it moves him and nothing can hurt him while it lasts
  P.dashT = T; P.dashVx = Math.cos(a) * sp; P.dashVy = Math.sin(a) * sp; P.dashA = 0; P.ghostT = 0; P.d8 = dir8(a);
  g.after(T, (g2) => {
    const Q = g2.player, x1 = Q.x, y1 = Q.y;
    if (st.el === 'fire') spots(x0, y0, x1, y1, 15, (x, y) => fireZone(g2, x, y, 10, 2, st.dmg * 0.25));
    if (st.el === 'poison') spots(x0, y0, x1, y1, 15, (x, y) => poisonZone(g2, x, y, 10, 3, st.dmg * 0.15));
    if (st.el === 'bolt') {
      g2.zap([[x0, y0], [x1, y1]], 0.25);
      lineHit(g2, x0, y0, x1, y1, 10, (e) => { if (!e.hidden && !e.fainted) wHit(g2, e, st.dmg, st, { small: true, silent: true, element: 'light', knock: 40 }); });
    }
    if (st.el === 'ice') { g2.enemiesInRadius(x1, y1, 40, (e) => freezeE(e, 1)); g2.addEffect({ type: 'ring', x: x1, y: y1, R: 40, life: 0.3, color: ELEMENTS.ice.color }); }
    if (st.el === 'glow') Q.heal(3);
    flurry(g2, w, st, st.n + st.lungeX);
  });
}

// ------------------------------------------------------------ every frame
function spearTick(g, w, st, dt) {
  if (st.r2 === 'whirl') whirlTick(g, w, st, dt);
  else if (st.r2 === 'counter') hookHurt(g);
  else if (st.r2 === 'lunge') lungeTick(g, w, st, dt);
  else if (st.r2 === 'impale' && w.rods?.length) {
    // Lightning Rod: each pinned foe is struck every 0.3 s while it's pinned
    w.rods = w.rods.filter((r) => !r.e.dead && r.until > g.time);
    for (const r of w.rods) {
      if ((r.t -= dt) > 0) continue;
      r.t += 0.3;
      g.strike(r.e.x, r.e.y);
      g.damageEnemy(r.e, st.dmg * 0.4, { element: 'light', small: true, silent: true });
    }
  }
}
