// Pip's Pebble Sling tree (see evolve.js for how trees work, and the weapons doc for the design).
// Pebbles bounce from foe to foe, and Pip looks after the mons.
import { Audio } from '../../core/audio.js';
import { TAU, rand } from '../../core/util.js';
import {
  ELEMENTS, addPoison, glowOn, wHit, chainBolt, fireZone, poisonZone, lineHit, fanAngles, step, hookDamage, away, freezeE,
  strikeAt, zapAround, dropTrail, mostHurtPet, healPets, teamDelta,
} from '../wcore.js';

const REACH = 230; // Pip shoots at the nearest foe this close
const HOP = 110;   // a bounce goes to the nearest new foe this close
const FIRE = ['#ffe07a', '#f6a03a', '#e0483e'];
const live = (e) => !e.dead && !e.hidden && !e.fainted;

// ------------------------------------------------------------ the sling
export const SLING = {
  name: 'Pebble Sling', icon: 'sling',
  base: { dmg: 14, cd: 0.85, n: 1, bounces: 1, bounceUp: 0, speed: 260, life: 1.2, r: 3, scale: 1, knock: 40, pierce: 0 },
  steps: {
    2: step('+4 damage', (s) => { s.dmg += 4; }),
    3: step('+1 bounce', (s) => { s.bounces += 1; }),
  },
  r1: {
    super: {
      name: 'Super Bounce', desc: '+2 bounces, and each bounce does 15% more than the last. For chains through a crowd.',
      apply: (s) => { s.bounces += 2; s.bounceUp = 0.15; },
      steps: {
        5: step('+4 damage', (s) => { s.dmg += 4; }),
        6: step('+1 pebble', (s) => { s.n += 1; }),
        7: step('+2 bounces', (s) => { s.bounces += 2; }),
      },
      r2: {
        treat: {
          name: 'Treat Toss', desc: 'Every 4th bounce, a treat flies to your most hurt mon and heals it 5 HP.',
          apply: (s) => { s.treatEvery = 4; s.treatHeal = 5; },
          steps: { 9: step('Every 3rd bounce', (s) => { s.treatEvery = 3; }), 10: step('Treats heal 8 HP', (s) => { s.treatHeal = 8; }), 11: step('+4 damage', (s) => { s.dmg += 4; }) },
          finals: {
            fire: { name: 'Spicy Treats', desc: 'A mon that eats one does +30% damage for 4 s.' },
            ice: { name: 'Cool Treats', desc: 'A mon that eats one takes 30% less damage for 4 s.' },
            poison: { name: 'Venom Treats', desc: 'For 4 s, every hit from a mon that ate one adds a poison stack.' },
            bolt: { name: 'Fizzy Treats', desc: 'A mon that eats one attacks 30% faster for 4 s.' },
            glow: { name: 'Golden Treats', desc: 'Treats heal twice as much, and one revives a fainted mon with 25% HP (once every 30 s).' },
          },
        },
        pep: {
          name: 'Pep Pebble', desc: 'Each bounce makes your mons attack 2% faster for 4 s, up to +30%.',
          apply: (s) => { s.pepCap = 0.3; },
          steps: { 9: step('Up to +45%', (s) => { s.pepCap = 0.45; }), 10: step('Each bounce also gives your mons +2% damage, up to +30%', (s) => { s.pepDmg = true; }), 11: step('+4 damage', (s) => { s.dmg += 4; }) },
          finals: {
            fire: { name: 'Fired Up', desc: 'At full pep, your mons\' hits set foes burning.' },
            ice: { name: 'Cool Head', desc: 'At full pep, your mons take 25% less damage.' },
            poison: { name: 'Sour Pep', desc: 'At full pep, your mons\' hits add poison stacks.' },
            bolt: { name: 'Charged Up', desc: 'At full pep, your mons\' hits zap a second foe, 40% damage.' },
            glow: { name: 'Cheer', desc: 'At full pep, your mons heal 1 HP a second.' },
          },
        },
        skip: {
          name: 'Skipping Stone', desc: 'For 2 s after it\'s thrown, a pebble has no bounce limit.',
          apply: (s) => { s.skipT = 2; },
          steps: { 9: step('No limit for 3 s', (s) => { s.skipT = 3; }), 10: step('+1 pebble', (s) => { s.n += 1; }), 11: step('+4 damage', (s) => { s.dmg += 4; }) },
          finals: {
            fire: { name: 'Hot Stone', desc: 'Each bounce leaves a small fire for 2 s.' },
            ice: { name: 'Ice Skipper', desc: 'Each bounce counts as 2 hits toward freezing.' },
            poison: { name: 'Toxic Skipper', desc: 'Each bounce adds 2 poison stacks.' },
            bolt: { name: 'Thunder Skipper', desc: 'Every 3rd bounce calls a lightning strike, 80% damage.' },
            glow: { name: 'Glow Skipper', desc: 'Every foe it bounces off glows for 6 s.' },
          },
        },
      },
    },
    scatter: {
      name: 'Scatter Shot', desc: '5 small pebbles in a wide spread (40°) that reach 150 px, 50% damage each. They don\'t bounce, but push foes back.',
      apply: (s) => { s.scatter = true; s.n = 5; s.dmg *= 0.5; s.bounces = 0; s.life = 150 / s.speed; s.knock = 120; s.spread = (40 * Math.PI) / 180; s.scale = 0.8; s.r = 2.5; },
      steps: {
        5: step('+2 pebbles', (s) => { s.n += 2; }),
        6: step('+3 damage', (s) => { s.dmg += 3; }),
        7: step('Pebbles pierce 1 foe', (s) => { s.pierce = 1; }),
      },
      r2: {
        stagger: {
          name: 'Stagger Shot', desc: 'Pebbles push foes 3× as far. A foe pushed into another stuns both for 0.5 s.',
          apply: (s) => { s.knock *= 3; s.staggerT = 0.5; },
          steps: { 9: step('Stuns for 0.8 s', (s) => { s.staggerT = 0.8; }), 10: step('+2 pebbles', (s) => { s.n += 2; }), 11: step('+3 damage', (s) => { s.dmg += 3; }) },
          finals: {
            fire: { name: 'Hot Gravel', desc: 'Stunned foes burn twice as hard.' },
            ice: { name: 'Hail Shot', desc: 'Stuns become freezes of 1 s.' },
            poison: { name: 'Mud Shot', desc: 'Stunned foes get 3 poison stacks.' },
            bolt: { name: 'Shock Shot', desc: 'A foe pushed into another zaps both, 100% damage.' },
            glow: { name: 'Daze Light', desc: 'Stunned foes glow for 6 s: your mons do +40% to them.' },
          },
        },
        rockfall: {
          name: 'Rockfall', desc: 'Every 6 s, 12 pebbles fall from the sky on random foes within 150 px, 100% damage each.',
          apply: (s) => { s.fallEvery = 6; s.fallN = 12; },
          steps: { 9: step('+6 falling pebbles', (s) => { s.fallN += 6; }), 10: step('Rockfall every 4 s', (s) => { s.fallEvery = 4; }), 11: step('+3 damage', (s) => { s.dmg += 3; }) },
          finals: {
            fire: { name: 'Ember Fall', desc: 'Each falling pebble leaves a small fire for 2 s.' },
            ice: { name: 'Sleet', desc: 'Each falling pebble counts as 2 hits toward freezing.' },
            poison: { name: 'Spore Fall', desc: 'Each falling pebble leaves a poison puddle for 3 s.' },
            bolt: { name: 'Storm Fall', desc: 'A lightning strike follows each falling pebble, 60% damage.' },
            glow: { name: 'Lucky Fall', desc: 'Each falling pebble that hits heals your mons 1 HP.' },
          },
        },
        point: {
          name: 'Point Blank', desc: 'Pebbles do up to double damage to foes within 50 px: the closer, the more.',
          apply: (s) => { s.pbMax = 2; },
          steps: { 9: step('Up to triple', (s) => { s.pbMax = 3; }), 10: step('+2 pebbles', (s) => { s.n += 2; }), 11: step('+3 damage', (s) => { s.dmg += 3; }) },
          finals: {
            fire: { name: 'Dragon Breath', desc: 'At close range, the pebbles turn into a cone of fire 60 px long.' },
            ice: { name: 'Cold Blast', desc: 'Close-range hits freeze for 1 s.' },
            poison: { name: 'Toxic Blast', desc: 'Close-range hits add 3 poison stacks.' },
            bolt: { name: 'Shock Blast', desc: 'Close-range hits zap 3 more foes.' },
            glow: { name: 'Brave Blast', desc: 'Close-range hits heal you 1 HP each.' },
          },
        },
      },
    },
    boulder: {
      name: 'Boulder', desc: 'One big rock that rolls along the ground through every foe for 200 px, 2.5× damage, but you throw 60% slower.',
      apply: (s) => { s.boulder = true; s.dmg *= 2.5; s.cd *= 1.4 / 0.85; s.bounces = 0; s.roll = 200; s.r = 8; s.knock = 80; },
      steps: {
        5: step('+10 damage', (s) => { s.dmg += 10; }),
        6: step('Boulder 30% bigger', (s) => { s.r *= 1.3; }),
        7: step('Rolls 50% farther', (s) => { s.roll = 300; }),
      },
      r2: {
        avalanche: {
          name: 'Avalanche', desc: 'When it stops, the boulder breaks into 4 rocks that roll on in different directions for 100 px, 50% damage.',
          apply: (s) => { s.rocks = 4; s.rockK = 0.5; },
          steps: { 9: step('+2 rocks', (s) => { s.rocks += 2; }), 10: step('Rocks do 75%', (s) => { s.rockK = 0.75; }), 11: step('+10 damage', (s) => { s.dmg += 10; }) },
          finals: {
            fire: { name: 'Lava Rocks', desc: 'The rocks leave trails of lava for 2 s.' },
            ice: { name: 'Snow Slide', desc: 'The rocks freeze every foe they hit for 1 s.' },
            poison: { name: 'Mudslide', desc: 'The rocks leave trails of poison mud for 3 s.' },
            bolt: { name: 'Thunder Rocks', desc: 'The rocks throw sparks at foes they pass, 40% damage.' },
            glow: { name: 'Glowstone', desc: 'Everything the boulder and rocks hit glows for 6 s: your mons do +40% to them.' },
          },
        },
        snowball: {
          name: 'Snowballer', desc: 'It grows as it rolls: +10% size and damage for each foe it hits, up to double.',
          apply: (s) => { s.growCap = 2; },
          steps: { 9: step('Grows up to triple', (s) => { s.growCap = 3; }), 10: step('+10 damage', (s) => { s.dmg += 10; }), 11: step('Throws 20% faster', (s) => { s.cd *= 0.8; }) },
          finals: {
            fire: { name: 'Magma Ball', desc: 'At full size, it bursts into fire 80 px across.' },
            ice: { name: 'Frozen Ball', desc: 'Foes it hits get stuck inside, frozen, and roll along until it stops.' },
            poison: { name: 'Rot Ball', desc: 'It leaves a poison trail as wide as itself for 3 s.' },
            bolt: { name: 'Thunderball', desc: 'At full size, it zaps 2 foes every 0.2 s, 40% damage.' },
            glow: { name: 'Sunball', desc: 'When it stops at full size, it heals you 5 HP.' },
          },
        },
        hopper: {
          name: 'Hopper', desc: 'It hops 3 times instead of rolling. Each landing hits everything within 50 px and stuns for 0.4 s.',
          apply: (s) => { s.hops = 3; s.hopR = 50; s.hopStun = 0.4; },
          steps: { 9: step('+2 hops', (s) => { s.hops += 2; }), 10: step('Landings 30% bigger', (s) => { s.hopR = 65; }), 11: step('+10 damage', (s) => { s.dmg += 10; }) },
          finals: {
            fire: { name: 'Volcano Hop', desc: 'Each landing leaves fire 50 px across for 2 s.' },
            ice: { name: 'Frost Hop', desc: 'Each landing freezes every foe in it for 1 s.' },
            poison: { name: 'Toad Hop', desc: 'Each landing leaves a poison cloud for 3 s.' },
            bolt: { name: 'Thunder Hop', desc: 'Each landing calls lightning on 3 foes nearby, 50% damage.' },
            glow: { name: 'Happy Hop', desc: 'Each landing heals your mons within 80 px 2 HP.' },
          },
        },
      },
    },
  },
  fire: slingFire,
  tick: slingTick,
};

// ------------------------------------------------------------ shooting
function slingFire(g, w, st) {
  const P = g.player, S = P.stats;
  const t = g.nearestEnemy(P.x, P.y, st.scatter ? 170 : REACH, live);
  if (!t) return false;
  const a = Math.atan2(t.y - P.y, t.x - P.x);
  if (st.boulder) {
    for (const b of fanAngles(a, 1 + S.amount, 0.3)) (st.r2 === 'hopper' ? hopper : boulder)(g, w, st, b);
  } else {
    const n = st.n + S.amount;
    const angles = st.scatter ? fanAngles(a, n, n > 1 ? st.spread / (n - 1) : 0) : fanAngles(a, n, 0.2);
    if (st.r2 === 'point' && st.el === 'fire' && Math.hypot(t.x - P.x, t.y - P.y) < 50) dragonBreath(g, st, angles);
    else for (const b of angles) pebble(g, w, st, b);
  }
  Audio.play('shoot');
}
function pebble(g, w, st, a) {
  const P = g.player, sp = st.speed * P.stats.projSpeed;
  const p = g.spawnProjectile({
    x: P.x, y: P.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: st.r, dmg: st.dmg, pierce: st.pierce, life: st.life,
    spr: 'p_pebble', scale: st.scale, src: 'sling', knock: st.knock,
  });
  p.st = st; p.w = w; p.hit = pebbleHit; p.onHit = bounceOn; p.bounces = st.bounces; p.nB = 0; p.born = g.time; p.sp = sp;
  return p;
}
// Every pebble hit
function pebbleHit(g, p, e) {
  const st = p.st, P = g.player, w = p.w;
  // each bounce does more than the last (Super Bounce); the growth stops at the normal bounce count, so
  // Skipping Stone's unlimited bounces don't multiply without end
  let dmg = p.dmg * (1 + st.bounceUp) ** Math.min(p.nB, st.bounces);
  const sp = Math.hypot(p.vx, p.vy) || 1;
  const x = { kx: p.vx / sp, ky: p.vy / sp, knock: p.knock };
  if (st.r2 === 'skip') { if (st.el === 'ice') x.iceHits = 2; if (st.el === 'poison') x.stacks = 2; x.glowT = 6; }
  let close = false;
  if (st.r2 === 'point') {
    const d = Math.hypot(e.x - P.x, e.y - P.y);
    if (d < 50) {
      close = true;
      dmg *= 1 + (st.pbMax - 1) * (1 - d / 50);
      if (st.el === 'ice') x.freeze = 1;
      if (st.el === 'poison') x.stacks = 3;
    }
  }
  if (st.r2 === 'stagger' && st.el === 'fire' && e.stun > 0) x.burnK = 2;
  const res = wHit(g, e, dmg, st, x);
  if (e.dead) return res;
  if (close) {
    if (st.el === 'bolt') chainBolt(g, e, dmg * 0.4, 3, 80, st);
    if (st.el === 'glow') P.heal(1);
  }
  if (st.r2 === 'stagger') { const L = w.pushed || (w.pushed = []); if (L.length < 60) L.push({ e, until: g.time + 0.35 }); }
  return res;
}
// After a hit: on to the nearest new foe while it has bounces left
function bounceOn(g, p, e) {
  const st = p.st, w = p.w;
  const free = st.r2 === 'skip' && g.time - p.born < st.skipT; // Skipping Stone: no limit for a while
  if (p.bounces <= 0 && !free) return false;
  const next = g.nearestEnemy(p.x, p.y, HOP, (o) => o !== e && live(o) && !p.hitSet.has(o.id));
  if (!next) return false;
  if (!free) p.bounces--;
  p.nB++;
  w.bounceN = (w.bounceN || 0) + 1;
  if (st.r2 === 'treat' && w.bounceN % st.treatEvery === 0) treat(g, w, st, e.x, e.y);
  if (st.r2 === 'pep') { const L = w.pep || (w.pep = []); L.push(g.time + 4); if (L.length > 30) L.shift(); }
  if (st.r2 === 'skip') {
    if (st.el === 'fire') fireZone(g, e.x, e.y, 8, 2, st.dmg * 0.25);
    if (st.el === 'bolt' && w.bounceN % 3 === 0) { g.strike(e.x, e.y); if (!e.dead) g.damageEnemy(e, p.dmg * (1 + st.bounceUp) ** Math.min(p.nB - 1, st.bounces) * 0.8, { element: 'light', small: true, silent: true }); }
  }
  const a = Math.atan2(next.y - p.y, next.x - p.x);
  p.vx = Math.cos(a) * p.sp; p.vy = Math.sin(a) * p.sp; p.age = 0;
  return true;
}

// ------------------------------------------------------------ Super Bounce: Treat Toss, Pep Pebble
function treat(g, w, st, x, y) {
  const P = g.player, golden = st.el === 'glow';
  let pet = null, revive = false;
  if (golden && !(w.reviveT > g.time)) { pet = P.pets.find((q) => q.fainted && !q.carriedBy) || null; revive = !!pet; }
  if (!pet) pet = mostHurtPet(g);
  if (!pet) return;
  if (revive) w.reviveT = g.time + 30; // kept for this treat, so a second one doesn't revive too
  g.spawnProjectile({
    x, y, r: 0, dmg: 0, life: 2, noHit: true, z: 10, src: 'sling', gold: golden,
    update(g2, q, dt) {
      const dx = pet.x - q.x, dy = pet.y - q.y, d = Math.hypot(dx, dy) || 1, m = 200 * dt;
      if (d <= m + 2) { q.dead = true; eatTreat(g2, w, st, pet, revive); return true; }
      q.x += (dx / d) * m; q.y += (dy / d) * m;
      q.z = 6 + Math.sin(Math.min(1, q.age / 0.45) * Math.PI) * 12;
      return true;
    },
    draw: drawTreat,
  });
}
function drawTreat(ctx, q, cam) {
  const x = Math.round(q.x - cam.x), y = Math.round(q.y - cam.y - q.z);
  ctx.fillStyle = '#3a1a2a'; ctx.fillRect(x - 2, y - 2, 5, 5);
  ctx.fillStyle = q.gold ? '#ffd84a' : '#e0486a'; ctx.fillRect(x - 1, y - 1, 3, 3);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 1, 1, 1);
}
function eatTreat(g, w, st, pet, revive) {
  const P = g.player;
  if (revive) {
    if (pet.fainted && !pet.carriedBy) {
      pet.fainted = false; pet.hp = pet.maxHp * 0.25; pet.faintT = 0;
      P.recompute(); g.applyTeamPassives?.();
      g.particles.burst(pet.x, pet.y - 8, { n: 16, colors: ['#ffd84a', '#ffffff'], speed: 50, life: 0.6, up: 20 });
      Audio.play('heal');
    } else w.reviveT = 0; // it got up some other way: the revive is still there
    return;
  }
  if (pet.fainted) return;
  pet.heal(st.treatHeal * (st.el === 'glow' ? 2 : 1));
  const T = 4;
  if (st.el === 'fire') { hookDamage(g); pet.wSpicyT = g.time + T; }   // the damage hook reads it
  if (st.el === 'poison') pet.wVenomT = g.time + T;                     // read by this tree's mon-hit hook
  if (st.el === 'ice') petBuff(g, w, pet, 'hide', 0.3, T);             // takes 30% less
  if (st.el === 'bolt') petBuff(g, w, pet, 'swift', 1 - 1 / 1.3, T);   // attacks 30% faster
  g.particles.burst(pet.x, pet.y - 8, { n: 6, colors: [st.el ? ELEMENTS[st.el].color : '#e0486a', '#ffffff'], speed: 30, life: 0.5, up: 16 });
}
// A short boost to one mon through a field pet.js already reads (pass.hide: damage taken; pass.swift:
// attack speed). k is the share it takes off what's left; exactly that delta comes off when it ends. If the
// mon's skills were re-read meanwhile, it has a new pass object and the delta went with the old one.
function petBuff(g, w, pet, key, k, T) {
  const L = w.buffs || (w.buffs = []);
  const b = L.find((o) => o.pet === pet && o.key === key && o.pass === pet.pass);
  if (b) { b.until = g.time + T; return; }
  const had = key in pet.pass, v = pet.pass[key] || 0, d = (1 - v) * k;
  pet.pass[key] = v + d;
  L.push({ pet, key, d, had, pass: pet.pass, until: g.time + T });
}
function buffTick(g, w) {
  if (!w.buffs?.length) return;
  w.buffs = w.buffs.filter((b) => {
    const same = b.pet.pass === b.pass;
    if (same && b.until > g.time) return true;
    if (same) {
      const v = b.pass[b.key] - b.d;
      if (!b.had && Math.abs(v) < 1e-9) delete b.pass[b.key]; else b.pass[b.key] = v;
    }
    return false;
  });
}
function pepTick(g, w, st, dt) {
  const L = w.pep || (w.pep = []);
  while (L.length && L[0] <= g.time) L.shift();
  const v = 0.02 * L.length;
  w.pepFull = L.length > 0 && v >= st.pepCap - 1e-9;
  // tracked deltas on the team: exactly what this adds comes off again
  teamDelta(g, w, 'haste', Math.min(st.pepCap, v));
  teamDelta(g, w, 'dmg', st.pepDmg ? Math.min(0.3, v) : 0);
  teamDelta(g, w, 'def', st.el === 'ice' && w.pepFull ? 0.25 : 0);
  if (w.pepFull && st.el === 'glow') healPets(g, dt);
}
// What happens after one of your mons lands a hit (Pep Pebble's full-pep finals, Venom Treats)
function petHitFn(w) {
  return (g, e, res, o) => {
    const st = w.st;
    if (!st || e.dead) return;
    if (st.r2 === 'treat' && st.el === 'poison' && o.petRef?.wVenomT > g.time) addPoison(e, 0.15 * res.dmg, 1, 5);
    if (st.r2 !== 'pep' || !w.pepFull) return;
    if (st.el === 'fire') { const dps = 0.25 * res.dmg; if (!e.burn || e.burn.dps <= dps) e.burn = { dps, t: 3 * g.player.stats.duration }; }
    if (st.el === 'poison') addPoison(e, 0.15 * res.dmg, 1, 5);
    if (st.el === 'bolt') {
      const o2 = g.randomEnemies(e.x, e.y, 80, 1, e)[0];
      if (o2 && live(o2)) { g.zap([[e.x, e.y], [o2.x, o2.y]], 0.15); g.damageEnemy(o2, res.dmg * 0.4, { raw: true, element: 'light', small: true, silent: true }); }
    }
  };
}

// ------------------------------------------------------------ Scatter Shot: Stagger Shot, Rockfall, Point Blank
function staggerTick(g, w, st) {
  if (!w.pushed?.length) return;
  w.pushed = w.pushed.filter(({ e, until }) => {
    if (e.dead || until < g.time) return false;
    if (Math.hypot(e.kbx, e.kby) < 60) return true; // only while it is still flying back
    const o = g.nearestEnemy(e.x, e.y, e.r + 14, (m) => m !== e && live(m) && (m.x - e.x) ** 2 + (m.y - e.y) ** 2 < (m.r + e.r) ** 2);
    if (!o) return true;
    staggered(g, st, e); staggered(g, st, o);
    if (st.el === 'bolt') { g.zap([[e.x, e.y], [o.x, o.y]], 0.2); for (const f of [e, o]) g.damageEnemy(f, st.dmg, { element: 'light', small: true, silent: true }); }
    return false;
  });
}
function staggered(g, st, e) {
  if (st.el === 'ice') freezeE(e, 1);
  else if (!e.boss) e.stun = Math.max(e.stun, st.staggerT);
  if (st.el === 'fire' && e.burn && !(e.wGravelT > g.time)) { e.burn.dps *= 2; e.wGravelT = g.time + st.staggerT; }
  if (st.el === 'poison') addPoison(e, 0.15 * st.dmg, 3, 5);
  if (st.el === 'glow') glowOn(e, 6, 0.4);
  g.addEffect({ type: 'flashring', x: e.x, y: e.y, R: 8, life: 0.15, color: st.el ? ELEMENTS[st.el].color : '#ffffff' });
}
function rockTick(g, w, st, dt) {
  if ((w.fallCd = (w.fallCd ?? 2) - dt) > 0) return;
  const P = g.player, foes = [];
  g.enemiesInRadius(P.x, P.y, 150, (e) => { if (live(e) && foes.length < 60) foes.push(e); });
  if (!foes.length) { w.fallCd = 0.5; return; }
  w.fallCd = st.fallEvery * P.stats.cooldown;
  for (let i = 0; i < st.fallN; i++) {
    const e = foes[(Math.random() * foes.length) | 0], x = e.x + rand(-4, 4), y = e.y + rand(-3, 3);
    g.after(i * 0.05 + rand(0, 0.1), (g2) => fallPebble(g2, st, e, x, y));
  }
}
function fallPebble(g, st, e, x0, y0) {
  const T = 0.3;
  g.spawnProjectile({
    x: e.dead ? x0 : e.x, y: e.dead ? y0 : e.y, r: 0, dmg: 0, life: T, noHit: true, spr: 'p_pebble', z: 120, scale: 1.4, src: 'sling',
    update(g2, p) {
      if (!e.dead) { p.x += (e.x - p.x) * 0.3; p.y += (e.y - p.y) * 0.3; } // it falls on its foe
      p.z = 120 * (1 - p.age / T);
      return true;
    },
    onExpire(g2, p) {
      let hit = 0;
      g2.enemiesInRadius(p.x, p.y, 10, (o) => { if (!live(o)) return; hit++; wHit(g2, o, st.dmg, st, { small: true, silent: true, knock: 20, iceHits: st.el === 'ice' ? 2 : 1 }); });
      g2.addEffect({ type: 'flashring', x: p.x, y: p.y, R: 8, life: 0.15, color: st.el ? ELEMENTS[st.el].color : '#d0d0da' });
      if (st.el === 'fire') fireZone(g2, p.x, p.y, 8, 2, st.dmg * 0.25);
      if (st.el === 'poison') poisonZone(g2, p.x, p.y, 10, 3, st.dmg * 0.15);
      if (st.el === 'bolt') strikeAt(g2, p.x, p.y, 16, st.dmg * 0.6);
      if (st.el === 'glow' && hit) healPets(g2, 1);
    },
  });
}
// Dragon Breath: up close, each pebble becomes a jet of fire 60 px long instead
function dragonBreath(g, st, angles) {
  const P = g.player, R = 60 * P.stats.area;
  for (const a of angles) {
    const found = [];
    lineHit(g, P.x, P.y, P.x + Math.cos(a) * R, P.y + Math.sin(a) * R, st.r + 1, (e) => { if (live(e)) found.push(e); });
    found.sort((u, v) => (u.x - P.x) ** 2 + (u.y - P.y) ** 2 - ((v.x - P.x) ** 2 + (v.y - P.y) ** 2));
    for (const e of found.slice(0, 1 + st.pierce)) {
      const d = Math.hypot(e.x - P.x, e.y - P.y), k = d < 50 ? 1 + (st.pbMax - 1) * (1 - d / 50) : 1;
      wHit(g, e, st.dmg * k, st, { kx: Math.cos(a), ky: Math.sin(a), knock: st.knock * 0.3, small: true, silent: true });
    }
    for (let i = 0; i < 3; i++) {
      const dd = rand(6, R);
      g.particles.add({ x: P.x + Math.cos(a) * dd, y: P.y + Math.sin(a) * dd - 6, vx: Math.cos(a) * 50, vy: Math.sin(a) * 50, life: 0.3, color: FIRE[i % 3], size: 2 });
    }
  }
  Audio.play('fire');
}

// ------------------------------------------------------------ Boulder: Avalanche, Snowballer, Hopper
function boulder(g, w, st, a) {
  const P = g.player, sp = 160 * P.stats.projSpeed;
  const p = g.spawnProjectile({
    x: P.x, y: P.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: st.r, dmg: st.dmg, pierce: Infinity, life: st.roll / sp,
    spr: 'p_boulder', scale: st.r / 7, spin: Math.cos(a) >= 0 ? 7 : -7, src: 'sling', knock: st.knock, z: 4,
  });
  p.st = st; p.w = w; p.grow = 1; p.r0 = p.r; p.s0 = p.scale; p.hit = boulderHit; p.update = boulderRoll; p.onExpire = boulderStop;
  if (st.r2 === 'snowball' && st.el === 'ice') p.carry = [];
  return p;
}
function boulderRoll(g, p, dt) {
  const st = p.st;
  if (p.carry?.length) {
    // Frozen Ball: what it hit rolls along inside it
    for (let i = p.carry.length - 1; i >= 0; i--) {
      const e = p.carry[i];
      if (e.dead) { p.carry.splice(i, 1); continue; }
      g.world.move(e, p.x + Math.cos(i * 2.4) * 3 - e.x, p.y + Math.sin(i * 2.4) * 3 - e.y, Math.min(e.r, 7), e.flying);
      e.freeze = Math.max(e.freeze, 0.15); e.kbx = 0; e.kby = 0;
    }
  }
  if (p.rock) {
    if (st.el === 'fire') dropTrail(p, 18, (x, y) => fireZone(g, x, y, 8, 2, st.dmg * 0.25));
    if (st.el === 'poison') dropTrail(p, 18, (x, y) => poisonZone(g, x, y, 9, 3, st.dmg * 0.15));
    if (st.el === 'bolt' && (p.zapT = (p.zapT ?? 0) - dt) <= 0) { p.zapT = 0.25; zapAround(g, p.x, p.y, 50, 1, st.dmg * 0.4); }
  } else if (st.r2 === 'snowball') {
    if (st.el === 'poison') dropTrail(p, 20, (x, y) => poisonZone(g, x, y, p.r, 3, st.dmg * 0.15));
    if (st.el === 'bolt' && p.grow >= st.growCap - 1e-6 && (p.zapT = (p.zapT ?? 0) - dt) <= 0) { p.zapT = 0.2; zapAround(g, p.x, p.y, 70, 2, p.dmg * p.grow * 0.4); }
  }
  return false; // the game rolls it on
}
function boulderHit(g, p, e) {
  const st = p.st, sp = Math.hypot(p.vx, p.vy) || 1;
  const x = { kx: p.vx / sp, ky: p.vy / sp, knock: p.knock };
  if (p.rock && st.el === 'ice') x.freeze = 1;
  if (st.r2 === 'avalanche') { x.glowT = 6; x.glowK = 0.4; }
  if (p.carry) { if (e.boss) x.freeze = 1; else if (p.carry.length < 10) { p.carry.push(e); x.knock = 0; } }
  const res = wHit(g, e, p.dmg * (p.grow || 1), st, x);
  if (st.r2 === 'snowball' && !p.rock) {
    const full = p.grow >= st.growCap - 1e-6;
    p.grow = Math.min(st.growCap, p.grow + 0.1); p.r = p.r0 * p.grow; p.scale = p.s0 * p.grow;
    if (!full && p.grow >= st.growCap - 1e-6 && st.el === 'fire') magma(g, p);
  }
  return res;
}
// Magma Ball: once it's full size, a burst of fire 80 px across
function magma(g, p) {
  const st = p.st, R = 40 * g.player.stats.area;
  g.enemiesInRadius(p.x, p.y, R, (e) => { if (live(e)) wHit(g, e, p.dmg * p.grow, st, { ...away(p.x, p.y, e), knock: 80, small: true, silent: true }); });
  g.addEffect({ type: 'explosion', x: p.x, y: p.y, R, life: 0.35, color: ELEMENTS.fire.color, glow: true });
  g.shake(2.5, 0.15);
  Audio.play('explode');
}
function boulderStop(g, p) {
  const st = p.st;
  if (p.carry?.length) { for (const e of p.carry) freezeE(e, 0.5); p.carry.length = 0; }
  if (p.rock) return;
  if (st.r2 === 'avalanche') rocks(g, p);
  if (st.r2 === 'snowball' && st.el === 'glow' && p.grow >= st.growCap - 1e-6) g.player.heal(5);
  g.addEffect({ type: 'flashring', x: p.x, y: p.y, R: p.r + 4, life: 0.2, color: '#b8b2a6' });
}
function rocks(g, p) {
  const st = p.st, n = st.rocks, a0 = Math.random() * TAU, sp = 140;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU;
    const q = g.spawnProjectile({
      x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 5, dmg: st.dmg * st.rockK, pierce: Infinity, life: 100 / sp,
      spr: 'p_boulder', scale: 0.6, spin: 9, src: 'sling', knock: 50, z: 3,
    });
    q.st = st; q.w = p.w; q.rock = true; q.hit = boulderHit; q.update = boulderRoll; q.onExpire = boulderStop;
  }
  Audio.play('hit');
}
function hopper(g, w, st, a) {
  const P = g.player, T = 0.32, sp = st.roll / st.hops / T;
  const p = g.spawnProjectile({
    x: P.x, y: P.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: st.r, dmg: st.dmg, pierce: Infinity, life: st.hops * T + 0.05,
    noHit: true, spr: 'p_boulder', scale: st.r / 7, spin: Math.cos(a) >= 0 ? 6 : -6, src: 'sling', z: 4,
  });
  p.st = st; p.hopN = 0; p.T = T;
  p.update = (g2, q, dt) => {
    q.x += q.vx * dt; q.y += q.vy * dt;
    q.z = 4 + Math.sin(((q.age % q.T) / q.T) * Math.PI) * 26;
    while (q.hopN < q.st.hops && q.age >= (q.hopN + 1) * q.T) { q.hopN++; hopLand(g2, q.st, q.x, q.y); }
    return true;
  };
  p.onExpire = (g2, q) => { while (q.hopN < q.st.hops) { q.hopN++; hopLand(g2, q.st, q.x, q.y); } };
}
function hopLand(g, st, x, y) {
  const R = st.hopR * g.player.stats.area;
  g.enemiesInRadius(x, y, R, (e) => { if (live(e)) wHit(g, e, st.dmg, st, { ...away(x, y, e), knock: 60, small: true, silent: true, stun: st.hopStun, freeze: st.el === 'ice' ? 1 : 0 }); });
  g.addEffect({ type: 'ring', x, y, R, life: 0.3, color: st.el ? ELEMENTS[st.el].color : '#d8c8a0' });
  g.particles.burst(x, y - 2, { n: 10, colors: ['#d8c8a0', '#b8a888'], speed: 50, life: 0.35, up: 8 });
  if (st.el === 'fire') fireZone(g, x, y, 25, 2, st.dmg * 0.25);
  if (st.el === 'poison') poisonZone(g, x, y, R, 3, st.dmg * 0.15);
  if (st.el === 'bolt') for (const e of g.randomEnemies(x, y, R + 40, 3)) { g.strike(e.x, e.y); g.damageEnemy(e, st.dmg * 0.5, { element: 'light', small: true, silent: true }); }
  if (st.el === 'glow') healPets(g, 2, x, y, 80);
  g.shake(1.5, 0.1);
  Audio.play('hit');
}

// ------------------------------------------------------------ every frame
function slingTick(g, w, st, dt) {
  buffTick(g, w);
  if (st.r2 === 'pep') pepTick(g, w, st, dt);
  if ((st.r2 === 'pep' && (st.el === 'fire' || st.el === 'poison' || st.el === 'bolt')) || (st.r2 === 'treat' && (st.el === 'fire' || st.el === 'poison'))) {
    hookDamage(g);
    if (g.wPetHit?.w !== w) g.wPetHit = { w, fn: petHitFn(w) };
  }
  if (st.r2 === 'stagger') staggerTick(g, w, st);
  if (st.r2 === 'rockfall') rockTick(g, w, st, dt);
}
