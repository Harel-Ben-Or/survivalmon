// Rowan's Boomerang tree (see evolve.js for how trees work, and the weapons doc for the design).
// It flies out and back and hits each foe on both ways. Twin Throw and Big Rang keep that flight;
// Seeker Rang flies from foe to foe instead and then comes home.
import { Audio } from '../../core/audio.js';
import { TAU } from '../../core/util.js';
import {
  ELEMENTS, glowOn, wHit, fireZone, poisonZone, lineHit, fanAngles, step, hookDamage, away, freezeE, strikeAt,
  zapAround, ringSpots, dropTrail,
} from '../wcore.js';

const ACC = 420;        // how hard a thrown boomerang turns home (px/s², as the old one)
const REACH = 220;      // Rowan throws at the nearest foe this close
const HOP = 90;         // a seeker's bounce reaches this far
const SEEK_SPEED = 260; // a seeker's speed (px/s)
const ORBIT_W = 6.5;    // how fast an orbit goes round (radians a second)

// ------------------------------------------------------------ the boomerang
export const BOOMERANG = {
  name: 'Boomerang', icon: 'boomerang',
  base: { dmg: 16, cd: 1.6, n: 1, range: 100, r: 6, scale: 1, knock: 70, spd: 1 },
  steps: {
    2: step('+5 damage', (s) => { s.dmg += 5; }),
    3: step('Flies 25% farther', (s) => { s.range *= 1.25; }),
  },
  r1: {
    twin: {
      name: 'Twin Throw', desc: 'Throws 2 boomerangs in opposite directions, one at the nearest foe and one behind you. For being surrounded.',
      apply: (s) => { s.n = 2; s.twin = true; },
      steps: {
        5: step('+1 boomerang', (s) => { s.n += 1; }),
        6: step('+5 damage', (s) => { s.dmg += 5; }),
        7: step('Throws 20% faster', (s) => { s.cd *= 0.8; }),
      },
      r2: {
        whirl: {
          name: 'Whirl', desc: 'At the far end, each boomerang spins for 0.8 s, pulling foes in and hitting them for 50%.',
          apply: (s) => { s.spinT = 0.8; s.pullR = 40; s.spinK = 0.5; },
          steps: { 9: step('Spins 50% longer', (s) => { s.spinT = 1.2; }), 10: step('Pulls from farther', (s) => { s.pullR = 60; }), 11: step('+5 damage', (s) => { s.dmg += 5; }) },
          finals: {
            fire: { name: 'Fire Whirl', desc: 'Each spin leaves a patch of fire 40 px across for 3 s.' },
            ice: { name: 'Snow Devil', desc: 'Foes pulled into the spin freeze for 1 s when it ends.' },
            poison: { name: 'Toxic Twister', desc: 'Every spin hit adds a poison stack, so a full spin piles on 5.' },
            bolt: { name: 'Storm Eye', desc: 'While it spins, it shoots a bolt at a foe within 80 px every 0.2 s.' },
            glow: { name: 'Lantern Spin', desc: 'Everything pulled in glows for 6 s: your mons do +40% to them.' },
          },
        },
        orbit: {
          name: 'Orbit', desc: 'On the way back, each boomerang circles you once, 60 px out, hitting every foe it passes.',
          apply: (s) => { s.circles = 1; s.orbitR = 60; },
          steps: { 9: step('Circles twice', (s) => { s.circles = 2; }), 10: step('Orbit 30% wider', (s) => { s.orbitR = 78; }), 11: step('+5 damage', (s) => { s.dmg += 5; }) },
          finals: {
            fire: { name: 'Blazing Orbit', desc: 'The circle leaves a ring of fire around you for 2 s.' },
            ice: { name: 'Frost Orbit', desc: 'Every foe the orbit hits freezes for 1 s.' },
            poison: { name: 'Venom Orbit', desc: 'The circle leaves a ring of poison for 3 s.' },
            bolt: { name: 'Static Orbit', desc: 'Circling boomerangs are linked by lightning that hits every foe between them.' },
            glow: { name: 'Guardian Orbit', desc: 'You heal 1 HP for each foe the orbit hits, up to 8 a throw.' },
          },
        },
        burst: {
          name: 'Return Burst', desc: 'When you catch a boomerang, it bursts into 6 small blades that fly out 100 px (50% damage).',
          apply: (s) => { s.blades = 6; s.bladeK = 0.5; s.bladePierce = 0; },
          steps: { 9: step('+3 blades', (s) => { s.blades += 3; }), 10: step('Blades pierce 2 foes', (s) => { s.bladePierce = 2; }), 11: step('+5 damage', (s) => { s.dmg += 5; }) },
          finals: {
            fire: { name: 'Flame Fan', desc: 'Each blade leaves a small fire where it stops, for 2 s.' },
            ice: { name: 'Frost Fan', desc: 'Each blade freezes the first foe it hits for 1 s.' },
            poison: { name: 'Thorn Fan', desc: 'Blades add 2 poison stacks instead of 1.' },
            bolt: { name: 'Thunder Fan', desc: 'Each blade ends with a lightning strike.' },
            glow: { name: 'Sun Fan', desc: 'Blades go through every foe and make them glow.' },
          },
        },
      },
    },
    big: {
      name: 'Big Rang', desc: 'One boomerang twice as big with 1.6× damage that pushes foes 3× as far, but flies 30% slower.',
      apply: (s) => { s.dmg *= 1.6; s.r = 12; s.scale = 2; s.knock *= 3; s.spd = 0.7; },
      steps: {
        5: step('+8 damage', (s) => { s.dmg += 8; }),
        6: step('25% bigger', (s) => { s.r = 15; s.scale = 2.5; }),
        7: step('Throws 20% faster', (s) => { s.cd *= 0.8; }),
      },
      r2: {
        crush: {
          name: 'Crusher', desc: 'Foes it hits are stunned for 0.6 s: they stop moving and attacking.',
          apply: (s) => { s.stun = 0.6; },
          steps: { 9: step('Stuns for 1 s', (s) => { s.stun = 1; }), 10: step('+8 damage', (s) => { s.dmg += 8; }), 11: step('Stunned foes take 30% more damage from everything', (s) => { s.crushK = 0.3; }) },
          finals: {
            fire: { name: 'Magma Crusher', desc: 'Stunned foes burn twice as hard.' },
            ice: { name: 'Glacier Crusher', desc: 'Stuns become freezes of 1.5 s.' },
            poison: { name: 'Rot Crusher', desc: 'Each hit adds 3 poison stacks.' },
            bolt: { name: 'Thunder Crusher', desc: 'Each stun also calls lightning on the foe for 60% damage.' },
            glow: { name: 'Dawn Crusher', desc: 'Stunned foes glow for 6 s: your mons do +40% to them.' },
          },
        },
        plow: {
          name: 'Plow Rang', desc: 'On the way out, it scoops up the foes it hits (up to 6, never bosses) and drops them at the far end.',
          apply: (s) => { s.carryN = 6; },
          steps: { 9: step('Carries 10 foes', (s) => { s.carryN = 10; }), 10: step('Dropped foes take 100% damage when they land', (s) => { s.dropHit = true; }), 11: step('+8 damage', (s) => { s.dmg += 8; }) },
          finals: {
            fire: { name: 'Firebreak', desc: 'The path it plows burns for 3 s.' },
            ice: { name: 'Snow Drift', desc: 'Dropped foes are frozen for 1 s when they land.' },
            poison: { name: 'Bog Plow', desc: 'Dropped foes land in a poison pool for 4 s.' },
            bolt: { name: 'Live Wire', desc: 'Carried foes are shocked every 0.25 s while they ride.' },
            glow: { name: "Shepherd's Rang", desc: 'Dropped foes glow for 4 s: your mons do +40% to them.' },
          },
        },
        quake: {
          name: 'Quake Rang', desc: 'When you catch it, a shockwave bursts 70 px around you for 70% damage and pushes foes back.',
          apply: (s) => { s.quakeR = 70; },
          steps: { 9: step('Shockwave 30% bigger', (s) => { s.quakeR = 90; }), 10: step('+8 damage', (s) => { s.dmg += 8; }), 11: step('A second shockwave at the far end', (s) => { s.quake2 = true; }) },
          finals: {
            fire: { name: 'Eruption', desc: 'Each shockwave leaves a ring of fire for 2 s.' },
            ice: { name: 'Frost Quake', desc: 'Each shockwave freezes every foe in it for 1 s.' },
            poison: { name: 'Spore Quake', desc: 'Each shockwave leaves a poison cloud the same size for 3 s.' },
            bolt: { name: 'Thunderclap', desc: 'Each shockwave sends bolts to 6 foes just outside it.' },
            glow: { name: 'Dawn Quake', desc: 'You heal 2 HP for each foe a shockwave hits, up to 12.' },
          },
        },
      },
    },
    seek: {
      name: 'Seeker Rang', desc: 'A small boomerang that bounces from foe to foe (up to 4) before it comes back, with full damage, thrown 25% more often. For picking off foes.',
      apply: (s) => { s.bounces = 4; s.r = 4; s.scale = 0.75; s.knock = 40; s.cd *= 0.75; },
      steps: {
        5: step('+2 bounces', (s) => { s.bounces += 2; }),
        6: step('+4 damage', (s) => { s.dmg += 4; }),
        7: step('+1 boomerang', (s) => { s.n += 1; }),
      },
      r2: {
        echo: {
          name: 'Echo Rang', desc: 'Every foe it hits is marked. When you catch it, every marked foe takes 50% damage again.',
          apply: (s) => { s.echoK = 0.5; },
          steps: { 9: step('Echo does 75%', (s) => { s.echoK = 0.75; }), 10: step('+4 damage', (s) => { s.dmg += 4; }), 11: step('The echo hits twice', (s) => { s.echo2 = true; }) },
          finals: {
            fire: { name: 'Fire Echo', desc: 'The echo sets marked foes burning twice as hard.' },
            ice: { name: 'Cold Echo', desc: 'The echo freezes marked foes for 1 s.' },
            poison: { name: 'Venom Echo', desc: 'The echo adds 2 poison stacks to each marked foe.' },
            bolt: { name: 'Thunder Echo', desc: 'The echo is a lightning strike on each marked foe.' },
            glow: { name: 'Bright Echo', desc: 'Marked foes glow from the first hit until 3 s after the echo.' },
          },
        },
        split: {
          name: 'Splitter Rang', desc: 'On its 3rd foe, it splits into 2 boomerangs that keep bouncing on their own.',
          apply: (s) => { s.splitAt = 3; s.splitN = 2; },
          steps: { 9: step('Splits on the 2nd foe', (s) => { s.splitAt = 2; }), 10: step('Splits into 3', (s) => { s.splitN = 3; }), 11: step('+4 damage', (s) => { s.dmg += 4; }) },
          finals: {
            fire: { name: 'Wildfire Rang', desc: 'Each split sets off a burst of fire 30 px across.' },
            ice: { name: 'Hailstone Rang', desc: 'Each split boomerang freezes the first foe it hits for 1 s.' },
            poison: { name: 'Plague Rang', desc: 'Split boomerangs go for foes with no poison first.' },
            bolt: { name: 'Fork Rang', desc: 'Split boomerangs are linked by lightning that hits every foe between them.' },
            glow: { name: 'Prism Rang', desc: 'It splits into 1 more, and every split makes foes glow.' },
          },
        },
        pinball: {
          name: 'Pinball', desc: 'It doesn\'t come straight back: for 3 s it bounces between foes with no bounce limit.',
          apply: (s) => { s.pinT = 3; },
          steps: { 9: step('Bounces for 4 s', (s) => { s.pinT = 4; }), 10: step('+4 damage', (s) => { s.dmg += 4; }), 11: step('Each bounce makes it 5% faster and stronger, up to +50%', (s) => { s.pinUp = true; }) },
          finals: {
            fire: { name: 'Fireball', desc: 'It leaves a trail of fire along its path for 2 s.' },
            ice: { name: 'Ice Puck', desc: 'Each bounce counts as 2 hits toward freezing.' },
            poison: { name: 'Toxic Pinball', desc: 'It leaves a trail of poison for 3 s.' },
            bolt: { name: 'Ball Lightning', desc: 'While it flies, it zaps the nearest foe within 60 px every 0.3 s.' },
            glow: { name: 'Lucky Ball', desc: 'Every 4th bounce heals you 1 HP.' },
          },
        },
      },
    },
  },
  fire: rangFire,
  tick: rangTick,
};

// ------------------------------------------------------------ throwing
function rangFire(g, w, st) {
  const P = g.player, S = P.stats;
  const t = g.nearestEnemy(P.x, P.y, REACH, (e) => !e.hidden && !e.fainted);
  if (!t) return false;
  const a = Math.atan2(t.y - P.y, t.x - P.x), n = st.n + S.amount;
  const grp = { heal: 0, ring: null }; // what one throw shares (Guardian Orbit's heal, who leaves the ring)
  w.live = (w.live || []).filter((p) => !p.dead);
  if (st.r1 === 'seek') {
    const taken = new Set([t]);
    for (let i = 0; i < n; i++) {
      const f = i === 0 ? t : g.nearestEnemy(P.x, P.y, REACH, (e) => !taken.has(e) && !e.hidden && !e.fainted) || t;
      taken.add(f);
      seeker(g, w, st, P.x, P.y, f, grp, false);
    }
  } else {
    const angles = st.twin ? Array.from({ length: n }, (_, i) => a + (i * TAU) / n) : fanAngles(a, n, 0.45);
    for (const b of angles) rang(g, w, st, b, grp);
  }
  Audio.play('swing');
}

// A thrown boomerang (Twin Throw, Big Rang and levels 1-3): out, then home. Modes: out, spin, back, orbit.
function rang(g, w, st, a, grp) {
  const P = g.player, S = P.stats;
  const k = st.spd * S.projSpeed, acc = ACC * k * k; // slower or faster, it still reaches as far
  const v0 = Math.sqrt(2 * acc * st.range * S.area);
  const p = g.spawnProjectile({
    x: P.x, y: P.y, vx: Math.cos(a) * v0, vy: Math.sin(a) * v0, r: st.r * Math.sqrt(S.area), dmg: st.dmg, pierce: Infinity,
    life: 7, spr: 'p_boomerang', spin: 18 * st.spd, scale: st.scale, src: 'boomerang', knock: st.knock,
  });
  p.st = st; p.w = w; p.grp = grp; p.acc = acc; p.mode = 'out';
  p.hit = rangHit; p.update = rangMove; p.onExpire = dropAll;
  if (st.r2 === 'plow') p.carry = [];
  w.live.push(p);
  return p;
}
function rangMove(g, p, dt) {
  const P = g.player, st = p.st;
  if (p.mode === 'spin') return spinning(g, p, dt);
  if (p.mode === 'orbit') return orbiting(g, p, dt);
  const dx = P.x - p.x, dy = P.y - p.y, d = Math.hypot(dx, dy) || 1;
  if (p.mode === 'out') {
    p.vx += (dx / d) * p.acc * dt; p.vy += (dy / d) * p.acc * dt;
    if (p.vx * dx + p.vy * dy > 0) { farEnd(g, p); if (p.mode !== 'back') return true; }
  } else {
    // on the way home it speeds up straight at you, so it always gets back
    if (st.r2 === 'orbit' && !p.orbited && d <= st.orbitR * P.stats.area) { startOrbit(g, p); return true; }
    const sp = Math.min(Math.hypot(p.vx, p.vy) + p.acc * dt, 700);
    if (d <= sp * dt + 10) { catchRang(g, p); return true; }
    p.vx = (dx / d) * sp; p.vy = (dy / d) * sp;
  }
  p.x += p.vx * dt; p.y += p.vy * dt;
  if (p.carry?.length) carryAlong(g, p, dt);
  if (st.r2 === 'plow' && st.el === 'fire' && p.mode === 'out') dropTrail(p, 20, (x, y) => fireZone(g, x, y, 12, 3, st.dmg * 0.25));
  return true;
}
// The far end of the flight: it hits everything again on the way back
function farEnd(g, p) {
  const st = p.st;
  p.hitSet.clear();
  p.mode = 'back';
  if (p.carry) dropAll(g, p);
  if (st.quake2) quake(g, st, p.x, p.y);
  if (st.r2 === 'whirl') {
    p.mode = 'spin'; p.spinLeft = st.spinT; p.tickT = 0; p.pulled = new Set(); p.noHit = true; p.spin = 34;
    if (st.el === 'fire') fireZone(g, p.x, p.y, 20, 3, st.dmg * 0.25);
  }
}
function catchRang(g, p) {
  if (p.dead) return;
  p.dead = true;
  const st = p.st, P = g.player;
  dropAll(g, p);
  if (st.r2 === 'burst') blades(g, st, P.x, P.y);
  if (st.r2 === 'quake') quake(g, st, P.x, P.y);
  if (st.r2 === 'echo') echo(g, p);
  g.fx?.caught?.(p); // (gear sets that reward a catch)
}

// ------------------------------------------------------------ Twin Throw: Whirl, Orbit, Return Burst
function spinning(g, p, dt) {
  const st = p.st, R = st.pullR * g.player.stats.area;
  p.spinLeft -= dt;
  // pulls foes in (bosses are too heavy)
  g.enemiesInRadius(p.x, p.y, R, (e) => {
    if (e.hidden || e.fainted) return;
    if (!p.pulled.has(e)) { p.pulled.add(e); if (st.el === 'glow') glowOn(e, 6, 0.4); }
    if (e.boss) return;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
    if (d > 3) { const m = Math.min(d - 2, 110 * (1 - (e.knockRes || 0)) * dt); g.world.move(e, (dx / d) * m, (dy / d) * m, Math.min(e.r, 7), e.flying); }
  });
  if ((p.tickT -= dt) <= 0) {
    p.tickT += 0.2;
    g.enemiesInRadius(p.x, p.y, R, (e) => wHit(g, e, st.dmg * st.spinK, st, { knock: 0, small: true, silent: true, glowT: 6, glowK: 0.4 }));
    if (st.el === 'bolt') zapAround(g, p.x, p.y, 80, 1, st.dmg * 0.4);
  }
  if (p.spinLeft <= 0) {
    if (st.el === 'ice') for (const e of p.pulled) freezeE(e, 1);
    p.mode = 'back'; p.noHit = false; p.spin = 18; p.vx = 0; p.vy = 0; p.pulled = null;
  }
  return true;
}
function startOrbit(g, p) {
  const P = g.player;
  p.mode = 'orbit'; p.orbited = true; p.oa = Math.atan2(p.y - P.y, p.x - P.x);
  p.oLeft = p.st.circles * TAU; p.oLap = 0; p.hitSet.clear(); p.trX = undefined;
  if (!p.grp.ring) p.grp.ring = p; // the first one round leaves the ring (Blazing and Venom Orbit)
}
function orbiting(g, p, dt) {
  const P = g.player, st = p.st, R = st.orbitR * P.stats.area, da = ORBIT_W * dt;
  p.oa += da; p.oLeft -= da; p.oLap += da;
  if (p.oLap >= TAU) { p.oLap -= TAU; p.hitSet.clear(); p.lap2 = true; } // each circle hits every foe again
  p.x = P.x + Math.cos(p.oa) * R; p.y = P.y + Math.sin(p.oa) * R;
  if (p.grp.ring === p && !p.lap2) {
    if (st.el === 'fire') dropTrail(p, 26, (x, y) => fireZone(g, x, y, 12, 2, st.dmg * 0.25));
    if (st.el === 'poison') dropTrail(p, 26, (x, y) => poisonZone(g, x, y, 12, 3, st.dmg * 0.15));
  }
  if (p.oLeft <= 0) catchRang(g, p);
  return true;
}
function blades(g, st, x, y) {
  const n = st.blades, a0 = Math.random() * TAU, sp = 250;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU;
    const b = g.spawnProjectile({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 3, dmg: st.dmg * st.bladeK, pierce: st.el === 'glow' ? Infinity : st.bladePierce,
      life: 100 / sp, spr: 'p_boomerang', scale: 0.5, spin: 30, src: 'boomerang', knock: 30,
    });
    b.st = st; b.blade = true; b.hit = rangHit;
    if (st.el === 'fire') b.onExpire = (g2, q) => fireZone(g2, q.x, q.y, 8, 2, q.st.dmg * 0.25);
    if (st.el === 'bolt') b.onExpire = (g2, q) => strikeAt(g2, q.x, q.y, 16, q.st.dmg * 0.5);
  }
  g.addEffect({ type: 'flashring', x, y, R: 12, life: 0.15, color: '#ffffff' });
}

// ------------------------------------------------------------ Big Rang: Plow Rang, Quake Rang
function carryAlong(g, p, dt) {
  const st = p.st;
  let shock = false;
  if (st.el === 'bolt' && (p.wireT = (p.wireT ?? 0.25) - dt) <= 0) { p.wireT += 0.25; shock = true; }
  for (let i = p.carry.length - 1; i >= 0; i--) {
    const e = p.carry[i];
    const tx = p.x + Math.cos(i * 2.4) * 5, ty = p.y + Math.sin(i * 2.4) * 4;
    if (e.dead || (tx - e.x) ** 2 + (ty - e.y) ** 2 > 40 * 40) { e.wCarried = null; p.carry.splice(i, 1); continue; } // fell off (a wall)
    g.world.move(e, tx - e.x, ty - e.y, Math.min(e.r, 7), e.flying);
    e.kbx = 0; e.kby = 0; e.stun = Math.max(e.stun, 0.1);
    if (shock) { g.zap([[p.x, p.y], [e.x, e.y]], 0.12); g.damageEnemy(e, st.dmg * 0.4, { element: 'light', small: true, silent: true }); }
  }
}
function dropAll(g, p) {
  if (!p.carry?.length) return;
  const st = p.st;
  let any = false;
  for (const e of p.carry) {
    e.wCarried = null;
    if (e.dead) continue;
    any = true;
    if (st.dropHit) wHit(g, e, st.dmg, st, { knock: 0, small: true, silent: true, freeze: st.el === 'ice' ? 1 : 0 });
    else if (st.el === 'ice') freezeE(e, 1);
    if (st.el === 'glow') glowOn(e, 4, 0.4);
  }
  p.carry.length = 0;
  if (!any) return;
  if (st.el === 'poison') poisonZone(g, p.x, p.y, 30, 4, st.dmg * 0.15);
  g.addEffect({ type: 'flashring', x: p.x, y: p.y, R: 18, life: 0.2, color: st.el ? ELEMENTS[st.el].color : '#d8c8a0' });
  g.shake(1.5, 0.1);
}
function quake(g, st, x, y) {
  const R = st.quakeR * g.player.stats.area;
  let n = 0;
  g.enemiesInRadius(x, y, R, (e) => {
    if (e.hidden || e.fainted) return;
    n++;
    wHit(g, e, st.dmg * 0.7, st, { ...away(x, y, e), knock: 150, small: true, silent: true, freeze: st.el === 'ice' ? 1 : 0 });
  });
  g.addEffect({ type: 'ring', x, y, R, life: 0.35, color: st.el ? ELEMENTS[st.el].color : '#d8c8a0' });
  g.addEffect({ type: 'flashring', x, y, R: R * 0.5, life: 0.2, color: '#ffffff' });
  if (st.el === 'fire') ringSpots(x, y, R, 12, (fx, fy) => fireZone(g, fx, fy, 10, 2, st.dmg * 0.25));
  if (st.el === 'poison') poisonZone(g, x, y, R, 3, st.dmg * 0.15);
  if (st.el === 'bolt') zapAround(g, x, y, R + 60, 6, st.dmg * 0.5, R);
  if (st.el === 'glow' && n) g.player.heal(Math.min(12, 2 * n));
  g.shake(3, 0.2);
  Audio.play('explode');
}

// ------------------------------------------------------------ Seeker Rang: Echo, Splitter, Pinball
function seeker(g, w, st, x, y, t, grp, split) {
  const sp = SEEK_SPEED * g.player.stats.projSpeed, a = Math.atan2(t.y - y, t.x - x);
  const p = g.spawnProjectile({
    x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: st.r, dmg: st.dmg, pierce: Infinity,
    life: 9, spr: 'p_boomerang', scale: st.scale, spin: 22, src: 'boomerang', knock: st.knock,
  });
  p.st = st; p.w = w; p.grp = grp; p.hit = rangHit; p.onHit = seekNext; p.update = seekMove;
  p.mode = 'seek'; p.target = t; p.nHit = 0; p.sp = sp; p.split = split; p.marked = [];
  if (st.r2 === 'pinball') { p.pinT = st.pinT; p.pinN = 0; p.pinK = 1; p.hitCd = 0.35; } // it may hit a foe again
  w.live.push(p);
  return p;
}
function seekMove(g, p, dt) {
  const P = g.player, st = p.st;
  let tx = P.x, ty = P.y;
  if (p.mode === 'seek') {
    if (st.r2 === 'pinball' && (p.pinT -= dt) <= 0) p.mode = 'back';
    else {
      if (!p.target || p.target.dead) p.target = nextFoe(g, p, null);
      if (p.target) { tx = p.target.x; ty = p.target.y; } else p.mode = 'back';
    }
  }
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1;
  const sp = p.sp * (p.pinK || 1) * (p.mode === 'back' ? 1.3 : 1);
  if (p.mode === 'back' && d <= sp * dt + 10) { catchRang(g, p); return true; }
  p.vx = (dx / d) * sp; p.vy = (dy / d) * sp;
  p.x += p.vx * dt; p.y += p.vy * dt;
  if (st.r2 === 'pinball') {
    if (st.el === 'fire') dropTrail(p, 28, (x, y) => fireZone(g, x, y, 9, 2, st.dmg * 0.25));
    if (st.el === 'poison') dropTrail(p, 28, (x, y) => poisonZone(g, x, y, 10, 3, st.dmg * 0.15));
    if (st.el === 'bolt' && (p.zapT = (p.zapT ?? 0.3) - dt) <= 0) {
      p.zapT += 0.3;
      const o = g.nearestEnemy(p.x, p.y, 60, (e) => !e.hidden && !e.fainted);
      if (o) { g.zap([[p.x, p.y], [o.x, o.y]], 0.18); g.damageEnemy(o, st.dmg * 0.4, { element: 'light', small: true, silent: true }); }
    }
  }
  return true;
}
// After a seeker's hit: on to the next foe, or home
function seekNext(g, p, e) {
  if (p.mode !== 'seek') return true; // on the way home it goes through foes
  const st = p.st;
  p.nHit++;
  if (st.r2 === 'pinball') {
    p.pinN++;
    if (st.pinUp) p.pinK = Math.min(1.5, 1 + 0.05 * p.pinN);
    if (st.el === 'glow' && p.pinN % 4 === 0) g.player.heal(1);
    if (e === p.target || !p.target) { p.target = nextFoe(g, p, e); if (!p.target) p.mode = 'back'; }
    return true;
  }
  if (st.r2 === 'split' && !p.split && p.nHit === st.splitAt) splitRang(g, p, e);
  if (p.nHit >= st.bounces) { p.mode = 'back'; return true; }
  if (e === p.target) { p.target = nextFoe(g, p, e); if (!p.target) p.mode = 'back'; }
  return true;
}
function nextFoe(g, p, e) {
  const st = p.st, now = g.time, avoid = p.avoid;
  p.avoid = null;
  const base = (o) => o !== e && !o.hidden && !o.fainted && !avoid?.has(o);
  const ok = st.r2 === 'pinball' ? (o) => base(o) && !(now - (p.hitMap.get(o.id) ?? -9) < 0.6) : (o) => base(o) && !p.hitSet.has(o.id);
  const pref = p.split && st.el === 'poison' ? (o) => ok(o) && !(o.poison?.stacks > 0) : null;
  return (pref && g.nearestEnemy(p.x, p.y, HOP, pref)) || g.nearestEnemy(p.x, p.y, HOP, ok)
    || (st.r2 === 'pinball' ? g.nearestEnemy(p.x, p.y, HOP, base) : null);
}
function splitRang(g, p, e) {
  const st = p.st, n = st.splitN + (st.el === 'glow' ? 1 : 0);
  const sib = [p], taken = new Set();
  p.split = true; p.sib = sib;
  for (let i = 1; i < n; i++) {
    const t = g.nearestEnemy(e.x, e.y, HOP, (o) => o !== e && !o.hidden && !o.fainted && !p.hitSet.has(o.id) && !taken.has(o));
    if (!t) break;
    taken.add(t);
    const q = seeker(g, p.w, st, e.x, e.y, t, p.grp, true);
    for (const id of p.hitSet) q.hitSet.add(id);
    q.nHit = p.nHit; q.sib = sib; sib.push(q);
  }
  p.avoid = taken; // the first one doesn't chase what the new ones went for
  if (st.el === 'fire') { fireZone(g, e.x, e.y, 15, 2, st.dmg * 0.25); g.addEffect({ type: 'explosion', x: e.x, y: e.y, R: 15, life: 0.25, color: ELEMENTS.fire.color }); }
  if (st.el === 'glow') { g.enemiesInRadius(e.x, e.y, 40, (o) => glowOn(o, 6, 0.4)); g.addEffect({ type: 'flashring', x: e.x, y: e.y, R: 20, life: 0.2, color: ELEMENTS.glow.color }); }
}
function echo(g, p) {
  const st = p.st, foes = p.marked.filter((e) => !e.dead);
  if (!foes.length) return;
  const once = (g2) => {
    for (const e of foes) {
      if (e.dead) continue;
      const x = { knock: 0, small: true, silent: true };
      if (st.el === 'fire') x.burnK = 2;
      if (st.el === 'ice') x.freeze = 1;
      if (st.el === 'poison') x.stacks = 2;
      if (st.el === 'bolt') { g2.strike(e.x, e.y); x.element = 'light'; }
      g2.addEffect({ type: 'flashring', x: e.x, y: e.y, R: 10, life: 0.2, color: st.el ? ELEMENTS[st.el].color : '#ffffff' });
      wHit(g2, e, st.dmg * st.echoK, st, x);
      if (st.el === 'glow' && !e.dead) e.glow = 3; // glows until 3 s after the echo
    }
  };
  once(g);
  if (st.echo2) g.after(0.25, once);
  Audio.play('hit');
}

// ------------------------------------------------------------ every hit
function rangHit(g, p, e) {
  const st = p.st, P = g.player;
  let dmg = p.dmg;
  const x = { knock: p.knock };
  if (p.blade) {
    x.small = true;
    if (st.el === 'ice' && !p.froze) { x.freeze = 1; p.froze = true; }
    if (st.el === 'poison') x.stacks = 2;
    return wHit(g, e, dmg, st, x);
  }
  if (p.mode === 'orbit' && st.el === 'ice') x.freeze = 1;
  if (st.r2 === 'crush') {
    if (st.el === 'ice') x.freeze = 1.5; else x.stun = st.stun;
    if (st.el === 'fire' && !e.boss) x.burnK = 2;
    if (st.el === 'poison') x.stacks = 3;
    if (st.el === 'glow' && !e.boss) { x.glowT = 6; x.glowK = 0.4; }
    if (st.crushK) { hookDamage(g); e.wCrush = { k: st.crushK, until: g.time + (st.el === 'ice' ? 1.5 : st.stun) + 0.05 }; }
  }
  if (st.r2 === 'plow' && p.mode === 'out' && p.carry && p.carry.length < st.carryN && !e.boss && !e.wCarried) { p.carry.push(e); e.wCarried = p; x.knock = 0; }
  if (st.r2 === 'echo' && !p.marked.includes(e)) { p.marked.push(e); if (st.el === 'glow') glowOn(e, 9, 0.25); }
  if (st.r2 === 'split' && p.split && st.el === 'ice' && !p.froze) { x.freeze = 1; p.froze = true; }
  if (st.r2 === 'pinball') { dmg *= p.pinK || 1; if (st.el === 'ice') x.iceHits = 2; }
  const res = wHit(g, e, dmg, st, x);
  if (p.mode === 'orbit' && st.el === 'glow' && p.grp.heal < 8) { p.grp.heal++; P.heal(1); }
  if (st.r2 === 'crush' && st.el === 'bolt' && !e.boss && !e.dead) { g.strike(e.x, e.y); g.damageEnemy(e, dmg * 0.6, { element: 'light', small: true, silent: true }); }
  return res;
}

// ------------------------------------------------------------ every frame: lightning links
function rangTick(g, w, st, dt) {
  if (!w.live?.length) return;
  w.live = w.live.filter((p) => !p.dead);
  if (st.el !== 'bolt' || (st.r2 !== 'orbit' && st.r2 !== 'split')) return;
  if ((w.linkT = (w.linkT || 0) - dt) > 0) return;
  w.linkT = 0.25;
  if (st.r2 === 'orbit') {
    // Static Orbit: the circling boomerangs are linked (a lone one links to you)
    const orb = w.live.filter((p) => p.mode === 'orbit');
    link(g, st, orb.length === 1 ? [orb[0], g.player] : orb, orb.length >= 3, 0.5);
  } else {
    // Fork Rang: each set of split boomerangs is linked
    const groups = new Set();
    for (const p of w.live) if (p.sib) groups.add(p.sib);
    for (const sib of groups) link(g, st, sib.filter((p) => !p.dead), false, 0.4);
  }
}
function link(g, st, pts, loop, k) {
  const n = pts.length;
  if (n < 2) return;
  for (let i = 0; i < (loop ? n : n - 1); i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    g.zap([[a.x, a.y], [b.x, b.y]], 0.2);
    lineHit(g, a.x, a.y, b.x, b.y, 6, (e) => g.damageEnemy(e, st.dmg * k, { element: 'light', small: true, silent: true }));
  }
}
