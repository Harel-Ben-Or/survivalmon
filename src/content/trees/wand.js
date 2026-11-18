// Lyra's Magic Wand tree (see evolve.js for how trees work, and the weapons doc for the design).
// Homing magic sparks that burst in a small blast. Like the other weapons it has no element until
// evolve 3, which follows the usual rules (wcore.js); the Fire finals add real fire. The tree keeps the
// id 'emberwand' so Lyra's hero weapon id still works. The sparks borrow an existing magic-looking shot
// picture (p_imp_fire) until the wand has its own.
import { Audio } from '../../core/audio.js';
import { TAU, rand } from '../../core/util.js';
import {
  ELEMENTS, addPoison, glowOn, wHit, biggestGroup, fireZone, poisonZone, lineHit, step, hookDamage, away, freezeE,
  zapAround, spots, dropTrail, mostHurtPet, capHeal,
} from '../wcore.js';

const REACH = 230;          // sparks go for foes this close
const SPARK = 'p_imp_fire'; // the spark's picture
const GLOW = '#c88aff', MAGIC = '#b070ff', ZAP = ['#c88aff', '#ffffff'];
const live = (e) => !e.dead && !e.hidden && !e.fainted;
const colorOf = (st) => (st.el ? ELEMENTS[st.el].color : MAGIC);

// Magic ground: hurts foes standing in it (dps damage a second)
function magicZone(g, x, y, r, dur, dps) {
  return g.spawnZone({
    kind: 'spores', x, y, r, life: dur, tick: 0.35, firstTick: 0.05,
    onTick: (g2, z) => g2.enemiesInRadius(z.x, z.y, z.r, (e) => g2.damageEnemy(e, dps * 0.35, { noCrit: true, small: true, silent: true })),
  });
}

// ------------------------------------------------------------ the wand
export const WAND = {
  name: 'Magic Wand', icon: 'emberwand',
  base: { dmg: 14, cd: 0.9, n: 1, blastR: 14, blastK: 0.5, speed: 140, homing: 7, scale: 1, r: 4 },
  steps: {
    2: step('+4 damage', (s) => { s.dmg += 4; }),
    3: step('Blast 25% bigger', (s) => { s.blastR *= 1.25; }),
  },
  r1: {
    trail: {
      name: 'Spark Trail', desc: 'Where a spark bursts, the ground stays magic for 2.5 s, 30 px across, hurting foes on it. For holding ground.',
      apply: (s) => { s.trailT = 2.5; s.trailR = 15; s.trailDps = 6; },
      steps: {
        5: step('+1 spark', (s) => { s.n += 1; }),
        6: step('Magic lasts longer', (s) => { s.trailT = 4; }),
        7: step('+4 damage', (s) => { s.dmg += 4; }),
      },
      r2: {
        chain: {
          name: 'Chain Spark', desc: 'When a foe hit by a spark dies, the magic jumps to 2 foes within 60 px, hitting each for 50%.',
          apply: (s) => { s.jumpN = 2; s.jumpK = 0.5; },
          steps: { 9: step('Jumps to 3 foes', (s) => { s.jumpN = 3; }), 10: step('Jumps hit 50% harder', (s) => { s.jumpK = 0.75; }), 11: step('+4 damage', (s) => { s.dmg += 4; }) },
          finals: {
            fire: { name: 'Wildfire', desc: 'Jumps set foes burning, and a foe that dies burning passes it on again, with no limit.' },
            ice: { name: 'Frost Chain', desc: 'Each jump also freezes the new foe for 1 s.' },
            poison: { name: 'Plague Chain', desc: 'Each jump also carries the dead foe\'s poison stacks.' },
            bolt: { name: 'Arc Chain', desc: 'Each jump is a bolt that hits every foe between, 40% damage.' },
            glow: { name: 'Spirit Chain', desc: 'Every jump heals you 1 HP, up to 4 HP a second.' },
          },
        },
        wall: {
          name: 'Magic Wall', desc: 'Every 5 s, a wall of magic 120 px long rises between you and the biggest group for 3 s. It hurts twice as hard as the trail.',
          apply: (s) => { s.wallEvery = 5; s.wallL = 120; s.wallT = 3; },
          steps: { 9: step('Wall 50% longer', (s) => { s.wallL = 180; }), 10: step('Wall every 3.5 s', (s) => { s.wallEvery = 3.5; }), 11: step('+4 damage', (s) => { s.dmg += 4; }) },
          finals: {
            fire: { name: 'Firewall', desc: 'The wall is fire: foes that touch it burn and are pushed back 40 px.' },
            ice: { name: 'Frost Wall', desc: 'Foes that cross it freeze for 1 s.' },
            poison: { name: 'Toxic Wall', desc: 'When the wall fades, it leaves a poison cloud for 3 s.' },
            bolt: { name: 'Storm Wall', desc: 'The wall zaps a foe within 80 px every 0.3 s, 40% damage.' },
            glow: { name: 'Sun Wall', desc: 'Foes that cross it glow for 6 s: your mons do +40% to them.' },
          },
        },
        orbs: {
          name: 'Orb Ring', desc: '3 magic orbs circle Lyra, 40 px out, and burst on anything that touches them. Each comes back 3 s after it bursts.',
          apply: (s) => { s.ringN = 3; s.ringBack = 3; },
          steps: { 9: step('+2 orbs', (s) => { s.ringN += 2; }), 10: step('They come back in 2 s', (s) => { s.ringBack = 2; }), 11: step('+4 damage', (s) => { s.dmg += 4; }) },
          finals: {
            fire: { name: 'Flame Halo', desc: 'The orbs are fire: they burst twice as big and leave fire for 2 s.' },
            ice: { name: 'Frost Halo', desc: 'Orb bursts freeze for 1 s.' },
            poison: { name: 'Venom Ring', desc: 'Orb bursts leave poison puddles for 3 s.' },
            bolt: { name: 'Spark Ring', desc: 'The orbs zap any foe within 60 px every 0.5 s, 40% damage.' },
            glow: { name: 'Sun Ring', desc: 'Each orb burst heals you 1 HP.' },
          },
        },
      },
    },
    big: {
      name: 'Big Burst', desc: 'One big spark with 1.5× damage and a 40 px blast at full damage, but you shoot 30% slower. For packed groups.',
      apply: (s) => { s.dmg *= 1.5; s.blastR = 40; s.blastK = 1; s.cd /= 0.75; s.scale = 2; s.r = 6; },
      steps: {
        5: step('+6 damage', (s) => { s.dmg += 6; }),
        6: step('Blast 25% bigger', (s) => { s.blastR = 50; }),
        7: step('Shoots 15% faster', (s) => { s.cd *= 0.85; }),
      },
      r2: {
        nova: {
          name: 'Supernova', desc: 'Every 4th shot is a supernova: 3× the blast size and double damage.',
          apply: (s) => { s.novaEvery = 4; s.novaK = 2; },
          steps: { 9: step('Every 3rd shot', (s) => { s.novaEvery = 3; }), 10: step('Supernova does triple damage', (s) => { s.novaK = 3; }), 11: step('+6 damage', (s) => { s.dmg += 6; }) },
          finals: {
            fire: { name: 'Solar Flare', desc: 'The supernova leaves a sea of fire 60 px across for 3 s.' },
            ice: { name: 'Cold Nova', desc: 'The supernova freezes everything in it for 1.5 s.' },
            poison: { name: 'Toxic Nova', desc: 'The supernova adds 5 poison stacks to everything in it.' },
            bolt: { name: 'Plasma Nova', desc: 'The supernova throws bolts at 8 foes just outside it, 50% damage.' },
            glow: { name: 'Dawn Nova', desc: 'You heal 1 HP for each foe the supernova hits, up to 15.' },
          },
        },
        cluster: {
          name: 'Cluster Burst', desc: 'Each blast throws 4 small sparks 50 px out, which burst again for 40% damage.',
          apply: (s) => { s.clusterN = 4; s.clusterK = 0.4; },
          steps: { 9: step('+2 small sparks', (s) => { s.clusterN += 2; }), 10: step('Small sparks do 60%', (s) => { s.clusterK = 0.6; }), 11: step('+6 damage', (s) => { s.dmg += 6; }) },
          finals: {
            fire: { name: 'Fireworks', desc: 'Small sparks are fire: they burst 50% bigger and leave fire for 2 s.' },
            ice: { name: 'Hail Cluster', desc: 'Each small spark freezes the first foe it hits for 1 s.' },
            poison: { name: 'Spore Cluster', desc: 'Small sparks leave poison puddles for 3 s.' },
            bolt: { name: 'Storm Cluster', desc: 'Small sparks become lightning that chases foes, so none miss.' },
            glow: { name: 'Glow Cluster', desc: 'Everything the small sparks hit glows for 6 s: your mons do +40% to them.' },
          },
        },
        meteor: {
          name: 'Meteor Burst', desc: 'Bursts fall from the sky onto the biggest group instead of flying (a shadow shows where), knocking foes down for 0.5 s.',
          apply: (s) => { s.downT = 0.5; s.meteors = 1; },
          steps: { 9: step('Knocked down for 1 s', (s) => { s.downT = 1; }), 10: step('+1 meteor on a second group', (s) => { s.meteors = 2; }), 11: step('+6 damage', (s) => { s.dmg += 6; }) },
          finals: {
            fire: { name: 'Magma Meteor', desc: 'The meteor is fire, and each landing leaves lava 50 px across for 3 s.' },
            ice: { name: 'Comet', desc: 'The meteor is ice, and everything it lands on freezes for 1.5 s.' },
            poison: { name: 'Toxic Meteor', desc: 'Each landing leaves a poison crater for 4 s.' },
            bolt: { name: 'Thunder Meteor', desc: 'Lightning strikes 4 foes around each landing, 50% damage.' },
            glow: { name: 'Sun Meteor', desc: 'Foes it hits glow for 6 s: your mons do +40% to them.' },
          },
        },
      },
    },
    swarm: {
      name: 'Spark Swarm', desc: '3 small sparks that each go for a different foe, 60% damage each. For hitting many foes.',
      apply: (s) => { s.n = 3; s.dmg *= 0.6; s.scale = 0.75; s.swarm = true; },
      steps: {
        5: step('+1 spark', (s) => { s.n += 1; }),
        6: step('+3 damage', (s) => { s.dmg += 3; }),
        7: step('Faster sparks', (s) => { s.speed *= 1.5; s.homing = 12; }),
      },
      r2: {
        wisps: {
          name: 'Wisps', desc: 'A spark whose foe dies before it lands keeps flying for 2 s to find a new one.',
          apply: (s) => { s.searchT = 2; },
          steps: { 9: step('Search for 3 s', (s) => { s.searchT = 3; }), 10: step('+1 spark', (s) => { s.n += 1; }), 11: step('+3 damage', (s) => { s.dmg += 3; }) },
          finals: {
            fire: { name: 'Fireflies', desc: 'Wisps catch fire and leave a short trail of fire, 1.5 s.' },
            ice: { name: 'Frost Wisps', desc: 'Wisps chill every foe they fly past.' },
            poison: { name: 'Venom Wisps', desc: 'Each wisp hit adds 2 poison stacks.' },
            bolt: { name: 'Lightning Bugs', desc: 'While flying, wisps zap foes within 50 px, 40% damage.' },
            glow: { name: 'Glow Wisps', desc: 'Everything wisps hit glows for 6 s: your mons do +40% to them.' },
          },
        },
        charge: {
          name: 'Charge', desc: 'Each spark that hits a foe charges it one level, up to 5: it takes 10% more damage from everything per level, for 3 s.',
          apply: (s) => { s.chargeCap = 5; s.chargeT = 3; },
          steps: { 9: step('Up to 7 levels', (s) => { s.chargeCap = 7; }), 10: step('Charge lasts 5 s', (s) => { s.chargeT = 5; }), 11: step('+3 damage', (s) => { s.dmg += 3; }) },
          finals: {
            fire: { name: 'Furnace', desc: 'A foe charged to 5 or more explodes in fire when it dies, 100% damage within 60 px.' },
            ice: { name: 'Frost Snap', desc: 'Freezing a charged foe sets its charge off at once: 30% damage per level.' },
            poison: { name: 'Toxic Smoke', desc: 'Charged foes give off poison smoke 40 px around them.' },
            bolt: { name: 'Static Charge', desc: 'Every 0.5 s, a charged foe zaps a foe next to it, 10% damage per level.' },
            glow: { name: 'Radiant Charge', desc: 'You heal 1 HP each time a foe reaches the top charge level.' },
          },
        },
        familiar: {
          name: 'Familiar', desc: 'A small familiar floats next to Lyra and shoots its own sparks, half as many as you, at full damage.',
          apply: (s) => { s.familiars = 1; s.famK = 0.5; },
          steps: { 9: step('The familiar shoots as many sparks as you', (s) => { s.famK = 1; }), 10: step('+1 familiar', (s) => { s.familiars += 1; }), 11: step('+3 damage', (s) => { s.dmg += 3; }) },
          finals: {
            fire: { name: 'Phoenix', desc: 'Every 4 s the familiar dives through foes as a phoenix, setting everything in its path burning.' },
            ice: { name: 'Frost Familiar', desc: 'Its sparks freeze for 1 s.' },
            poison: { name: 'Bog Familiar', desc: 'Its sparks leave poison puddles for 3 s.' },
            bolt: { name: 'Storm Familiar', desc: 'It shoots bolts instead, each chaining to 3 foes.' },
            glow: { name: 'Spirit Familiar', desc: 'Every 2 s it heals your most hurt mon 3 HP.' },
          },
        },
      },
    },
  },
  fire: wandFire,
  tick: wandTick,
};

// ------------------------------------------------------------ shooting
function wandFire(g, w, st) {
  const P = g.player, S = P.stats;
  if (st.r2 === 'meteor') return meteorFire(g, w, st);
  const t = g.nearestEnemy(P.x, P.y, REACH, live);
  if (!t) return false;
  w.shots = (w.shots || 0) + 1;
  const n = st.n + S.amount;
  const nova = st.r2 === 'nova' && w.shots % st.novaEvery === 0;
  const foes = st.swarm ? [t, ...g.randomEnemies(P.x, P.y, REACH, n - 1, t).filter(live)] : [t];
  for (let i = 0; i < n; i++) spark(g, w, st, P.x, P.y, foes[i % foes.length], { nova });
  if (st.r2 === 'familiar') familiarFire(g, w, st, n);
  Audio.play('shoot');
}
// One spark. o: { nova, fam }
function spark(g, w, st, x, y, t, o = {}) {
  const S = g.player.stats, sp = st.speed * S.projSpeed;
  const a = Math.atan2(t.y - y, t.x - x) + rand(-0.8, 0.8);
  const p = g.spawnProjectile({
    x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: st.r, dmg: st.dmg * (o.nova ? st.novaK : 1), pierce: 0, life: 2.2,
    spr: SPARK, scale: st.scale * (o.nova ? 1.5 : 1), src: 'emberwand', homing: st.homing, target: t, glow: GLOW, knock: 20,
  });
  p.st = st; p.w = w; p.hit = sparkHit; p.update = sparkFly; p.nova = o.nova; p.fam = o.fam;
  return p;
}
function sparkFly(g, p, dt) {
  const st = p.st;
  if (!p.lost && p.target && p.target.dead) {
    p.lost = true;
    if (st.r2 === 'wisps') { p.wisp = true; p.maxLife = p.age + st.searchT; p.target = null; p.homing = Math.max(p.homing, 9); p.trX = undefined; }
    else p.homing = 0; // its foe is gone: it flies on straight
  }
  if (p.wisp) {
    if (st.el === 'fire') dropTrail(p, 16, (x, y) => fireZone(g, x, y, 8, 1.5, st.dmg * 0.25));
    if (st.el === 'ice') g.enemiesInRadius(p.x, p.y, 12, (e) => { e.chill = Math.max(e.chill, 1.5); });
    if (st.el === 'bolt' && (p.zapT = (p.zapT ?? 0) - dt) <= 0) { p.zapT = 0.3; zapAround(g, p.x, p.y, 50, 1, st.dmg * 0.4); }
  }
  return false; // the game moves it (it homes in)
}

// ------------------------------------------------------------ every hit, and the blast
// Every wand hit goes through here. direct: a spark hit it (not a blast), which charges it.
function wandHit(g, w, e, dmg, st, x, direct) {
  const fr0 = e.freeze > 0;
  if (direct && st.r2 === 'charge') charge(g, w, st, e);
  const res = wHit(g, e, dmg, st, x);
  if (e.dead) return res;
  if (st.r2 === 'chain') { e.wMark = { until: g.time + 3, jumped: false }; track(w, e); }
  // Frost Snap: freezing a charged foe sets its charge off
  const c = e.wCharge;
  if (st.r2 === 'charge' && st.el === 'ice' && !fr0 && e.freeze > 0 && c && c.until > g.time && c.n > 0) {
    g.addEffect({ type: 'flashring', x: e.x, y: e.y, R: 12, life: 0.2, color: ELEMENTS.ice.color });
    const n = c.n;
    c.n = 0;
    g.damageEnemy(e, st.dmg * 0.3 * n, { element: 'ice', silent: true });
  }
  return res;
}
function track(w, e) { const B = w.marked || (w.marked = new Set()); if (B.size < 300) B.add(e); }
function charge(g, w, st, e) {
  hookDamage(g);
  const c = e.wCharge && e.wCharge.until > g.time ? e.wCharge : (e.wCharge = { n: 0, k: 0.1 });
  const before = c.n;
  c.n = Math.min(st.chargeCap, c.n + 1); c.until = g.time + st.chargeT * g.player.stats.duration;
  if (st.el === 'glow' && before < st.chargeCap && c.n === st.chargeCap) g.player.heal(1);
  track(w, e);
}
function sparkHit(g, p, e) {
  const st = p.st;
  const x = { small: !!(p.mini || p.orb), knock: p.knock };
  if (p.wisp) { if (st.el === 'poison') x.stacks = 2; x.glowT = 6; x.glowK = 0.4; }
  if (p.nova) { if (st.el === 'ice') x.freeze = 1.5; if (st.el === 'poison') x.stacks = 5; }
  if ((p.fam || p.orb) && st.el === 'ice') x.freeze = 1;
  if (p.mini) { if (st.el === 'ice' && !p.froze) { x.freeze = 1; p.froze = true; } x.glowT = 6; x.glowK = 0.4; }
  const res = wandHit(g, p.w, e, p.dmg, st, x, !p.mini);
  burst(g, p, e);
  return res;
}
function burst(g, p, e) {
  if (p.burst) return;
  p.burst = true;
  const st = p.st, S = g.player.stats, w = p.w, x0 = p.x, y0 = p.y;
  let R = (p.blastR || st.blastR) * S.area;
  if (p.nova) R *= 3;
  if (p.orb && st.el === 'fire') R *= 2;
  const k = p.blastK ?? st.blastK;
  let n = e ? 1 : 0;
  g.enemiesInRadius(x0, y0, R, (o) => {
    if (o === e || !live(o)) return;
    n++;
    const x = { ...away(x0, y0, o), knock: 50, small: true, silent: true };
    if (p.nova) { if (st.el === 'ice') x.freeze = 1.5; if (st.el === 'poison') x.stacks = 5; }
    if (p.orb && st.el === 'ice') x.freeze = 1;
    if (p.mini) { x.glowT = 6; x.glowK = 0.4; }
    wandHit(g, w, o, p.dmg * k, st, x, false);
  });
  const fiery = (p.orb || p.mini) && st.el === 'fire';
  g.addEffect({ type: 'explosion', x: x0, y: y0, R, life: p.nova ? 0.4 : 0.22, color: p.nova || fiery ? colorOf(st) : MAGIC, glow: true });
  if (st.trailT) magicZone(g, x0, y0, st.trailR * S.area, st.trailT, st.trailDps);
  if (st.r2 === 'cluster' && !p.mini) cluster(g, p);
  if (p.mini) {
    if (st.el === 'fire') fireZone(g, x0, y0, 10, 2, st.dmg * 0.25);
    if (st.el === 'poison') poisonZone(g, x0, y0, 12, 3, st.dmg * 0.15);
  }
  if (p.nova) {
    if (st.el === 'fire') fireZone(g, x0, y0, 30, 3, st.dmg * 0.25);
    if (st.el === 'bolt') zapAround(g, x0, y0, R + 60, 8, p.dmg * 0.5, R);
    if (st.el === 'glow' && n) g.player.heal(Math.min(15, n));
    g.shake(3, 0.2);
    Audio.play('explode');
  }
  if (p.orb) {
    if (st.el === 'fire') fireZone(g, x0, y0, 12, 2, st.dmg * 0.25);
    if (st.el === 'poison') poisonZone(g, x0, y0, 14, 3, st.dmg * 0.15);
    if (st.el === 'glow') g.player.heal(1);
  }
  if (p.fam && st.el === 'poison') poisonZone(g, x0, y0, 12, 3, st.dmg * 0.15);
}

// ------------------------------------------------------------ Spark Trail: Chain Spark, Magic Wall, Orb Ring
function chainTick(g, w, st) {
  if (!w.marked?.size) return;
  for (const e of w.marked) {
    const m = e.wMark;
    if (!e.dead) { if (!m || m.until <= g.time) w.marked.delete(e); continue; }
    w.marked.delete(e);
    if (!m || m.until <= g.time) continue;
    if (m.jumped && !(st.el === 'fire' && e.burn)) continue; // only Wildfire passes a jump on again
    for (const o of g.randomEnemies(e.x, e.y, 60, st.jumpN, e)) {
      if (!live(o)) continue;
      if (st.el === 'bolt') lineHit(g, e.x, e.y, o.x, o.y, 6, (q) => { if (q !== o) g.damageEnemy(q, st.dmg * 0.4, { element: 'light', small: true, silent: true }); });
      g.zap([[e.x, e.y], [o.x, o.y]], 0.2, st.el === 'bolt' ? undefined : st.el === 'fire' ? ['#f6702a', '#ffe07a'] : ZAP);
      wHit(g, o, st.dmg * st.jumpK, st, { small: true, silent: true, knock: 30, ...away(e.x, e.y, o), element: st.el === 'bolt' ? 'light' : undefined });
      if (o.dead) continue;
      o.wMark = { until: g.time + 3, jumped: true };
      track(w, o);
      if (st.el === 'ice') freezeE(o, 1);
      if (st.el === 'poison' && e.poison?.stacks > 0) addPoison(o, e.poison.dps, e.poison.stacks, e.poison.cap);
      if (st.el === 'glow') capHeal(g, w.healCap || (w.healCap = {}), 1, 4);
    }
  }
}
function wallTick(g, w, st, dt) {
  if ((w.wallCd = (w.wallCd ?? 1) - dt) > 0) return;
  const P = g.player, S = P.stats, c = biggestGroup(g, P.x, P.y, REACH);
  if (!c) { w.wallCd = 0.5; return; }
  w.wallCd = st.wallEvery * S.cooldown;
  // across the way from you to the group, halfway there
  const dx = c.x - P.x, dy = c.y - P.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  const m = Math.max(24, Math.min(90, d * 0.5)), cx = P.x + ux * m, cy = P.y + uy * m, L = st.wallL * S.area;
  const ax = cx + (uy * L) / 2, ay = cy - (ux * L) / 2, bx = cx - (uy * L) / 2, by = cy + (ux * L) / 2;
  const fire = st.el === 'fire', dps = st.trailDps * 2; // twice as hard as the trail
  spots(ax, ay, bx, by, 16, (x, y) => (fire ? fireZone(g, x, y, 10, st.wallT, dps) : magicZone(g, x, y, 10, st.wallT, dps)));
  if (st.el === 'fire' || st.el === 'ice' || st.el === 'glow' || st.el === 'bolt') {
    const crossed = new Set(), pushed = new Map();
    let zapT = 0;
    g.spawnZone({
      kind: 'wall', invisible: true, x: cx, y: cy, r: L / 2, life: st.wallT, tick: 0.1, firstTick: 0.05,
      onTick: (g2, z) => {
        lineHit(g2, ax, ay, bx, by, 6, (e) => {
          if (!live(e)) return;
          if (fire) {
            // Firewall: it burns (the Fire rule: 25% of a hit a second) and pushes foes back 40 px
            const bdps = 0.25 * st.dmg * S.burnMult * S.might;
            if (!e.burn || e.burn.dps <= bdps) e.burn = { dps: bdps, t: 3 * S.duration };
            if (!(pushed.get(e) > g2.time)) { pushed.set(e, g2.time + 0.5); const k = 1 - (e.knockRes || 0); e.kbx += ux * 360 * k; e.kby += uy * 360 * k; }
          }
          if (crossed.has(e)) return;
          crossed.add(e);
          if (st.el === 'ice') freezeE(e, 1);
          if (st.el === 'glow') glowOn(e, 6, 0.4);
        });
        if (st.el === 'bolt' && (zapT -= z.tick) <= 0) {
          zapT = 0.3;
          const k = Math.random(), px = ax + (bx - ax) * k, py = ay + (by - ay) * k;
          const o = g2.nearestEnemy(px, py, 80, live);
          if (o) { g2.zap([[px, py], [o.x, o.y]], 0.2); g2.damageEnemy(o, st.dmg * 0.4, { element: 'light', small: true, silent: true }); }
        }
      },
    });
  }
  if (st.el === 'poison') g.after(st.wallT, (g2) => spots(ax, ay, bx, by, 24, (x, y) => poisonZone(g2, x, y, 16, 3, st.dmg * 0.15)));
  Audio.play('fire');
}
function orbTick(g, w, st) {
  const rs = w.rs || (w.rs = []);
  for (let i = 0; i < st.ringN; i++) {
    const s = rs[i] || (rs[i] = { p: null, back: 0 });
    if ((!s.p || s.p.dead) && g.time >= s.back) s.p = makeOrb(g, w, i, s);
  }
}
function makeOrb(g, w, i, slot) {
  const P = g.player, st = w.st;
  const p = g.spawnProjectile({ x: P.x, y: P.y, r: 5, dmg: st.dmg, pierce: 0, life: 1e9, spr: SPARK, scale: 1.3, src: 'emberwand', glow: GLOW, knock: 30 });
  p.st = st; p.w = w; p.orb = true; p.slot = slot; p.i = i; p.update = orbMove;
  p.hit = (g2, q, e) => { q.st = q.w.st; q.dmg = q.st.dmg; q.slot.back = g2.time + q.st.ringBack; return sparkHit(g2, q, e); };
  return p;
}
function orbMove(g, p, dt) {
  const w = p.w, st = w.st, P = g.player;
  if (P.main !== w || st?.r2 !== 'orbs') { p.dead = true; return true; }
  const a = g.time * 3 + (p.i * TAU) / st.ringN, R = 40 * P.stats.area;
  p.x = P.x + Math.cos(a) * R; p.y = P.y + Math.sin(a) * R;
  if (st.el === 'fire') p.spr = 'p_ember';
  if (st.el === 'bolt' && (p.zapT = (p.zapT ?? 0.5) - dt) <= 0) { p.zapT = 0.5; zapAround(g, p.x, p.y, 60, 1, st.dmg * 0.4); }
  return true;
}

// ------------------------------------------------------------ Big Burst: Cluster Burst, Meteor Burst
function cluster(g, p) {
  const st = p.st, n = st.clusterN, a0 = Math.random() * TAU, sp = 150, storm = st.el === 'bolt', fire = st.el === 'fire';
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU;
    const q = g.spawnProjectile({
      x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 3, dmg: p.dmg * st.clusterK, pierce: 0,
      life: storm ? 0.9 : 50 / sp, spr: fire ? 'p_ember' : SPARK, scale: 0.6, src: 'emberwand', glow: GLOW, knock: 10,
      homing: storm ? 10 : 0, trail: storm ? '#ffe36a' : null,
    });
    q.st = st; q.w = p.w; q.mini = true; q.blastR = fire ? 21 : 14; q.blastK = 1;
    q.hit = sparkHit; q.onExpire = (g2, m) => burst(g2, m, null);
  }
}
function meteorFire(g, w, st) {
  const P = g.player, c = biggestGroup(g, P.x, P.y, REACH);
  if (!c) return false;
  const done = [c];
  meteor(g, w, st, c.x, c.y);
  const extra = st.meteors - 1 + P.stats.amount;
  for (let i = 0; i < extra; i++) {
    const c2 = groupAway(g, P.x, P.y, REACH, done, 70);
    if (!c2) break;
    done.push(c2);
    meteor(g, w, st, c2.x, c2.y);
  }
  Audio.play('shoot');
}
// The biggest group at least gap px from every spot in not
function groupAway(g, x, y, r, not, gap) {
  const list = [];
  g.enemiesInRadius(x, y, r, (e) => { if (live(e) && list.length < 40 && not.every((c) => (c.x - e.x) ** 2 + (c.y - e.y) ** 2 > gap * gap)) list.push(e); });
  let best = null, bn = -1;
  for (const e of list) {
    let n = 0;
    for (const o of list) if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 < 1600) n++;
    if (n > bn) { bn = n; best = e; }
  }
  return best;
}
function meteor(g, w, st, x, y) {
  const R = st.blastR * g.player.stats.area, T = 0.5;
  const spr = st.el === 'ice' ? 'p_ice' : st.el === 'fire' ? 'p_meteor' : SPARK;
  g.addEffect({ type: 'target', x, y, R, life: T }); // the shadow shows where
  g.spawnProjectile({
    x, y, r: 0, dmg: 0, life: T, noHit: true, spr, z: 150, scale: spr === SPARK ? 2.4 : 1.4, src: 'emberwand', glow: GLOW,
    update(g2, p) { p.z = 150 * (1 - p.age / T); return true; },
    onExpire: (g2) => meteorLand(g2, w, st, x, y, R),
  });
}
function meteorLand(g, w, st, x, y, R) {
  g.enemiesInRadius(x, y, R, (e) => {
    if (!live(e)) return;
    wandHit(g, w, e, st.dmg * st.blastK, st, { ...away(x, y, e), knock: 80, small: true, silent: true, stun: st.downT, freeze: st.el === 'ice' ? 1.5 : 0, glowT: 6, glowK: 0.4 }, false);
  });
  g.addEffect({ type: 'explosion', x, y, R, life: 0.35, color: colorOf(st), glow: true });
  g.particles.burst(x, y - 4, { n: 18, colors: st.el === 'fire' ? ['#ffe07a', '#f6a03a', '#e0483e'] : ['#ffffff', GLOW, MAGIC], speed: R * 3, life: 0.5, size: 2 });
  if (st.el === 'fire') fireZone(g, x, y, 25, 3, st.dmg * 0.25);
  if (st.el === 'poison') poisonZone(g, x, y, R, 4, st.dmg * 0.15);
  if (st.el === 'bolt') for (const e of g.randomEnemies(x, y, R + 50, 4)) { g.strike(e.x, e.y); g.damageEnemy(e, st.dmg * 0.5, { element: 'light', small: true, silent: true }); }
  g.shake(3, 0.2);
  Audio.play('explode');
}

// ------------------------------------------------------------ Spark Swarm: Charge, Familiar
function chargeTick(g, w, st, dt) {
  if (!w.marked?.size) return;
  let zap = false, smoke = false;
  if (st.el === 'bolt' && (w.zT = (w.zT ?? 0.5) - dt) <= 0) { w.zT += 0.5; zap = true; }
  if (st.el === 'poison' && (w.smT = (w.smT ?? 1) - dt) <= 0) { w.smT += 1; smoke = true; }
  for (const e of w.marked) {
    const c = e.wCharge, on = c && c.until > g.time && c.n > 0;
    if (e.dead) {
      w.marked.delete(e);
      if (st.el === 'fire' && on && c.n >= 5) furnace(g, w, st, e);
      continue;
    }
    if (!on) { w.marked.delete(e); continue; }
    if (zap) { // Static Charge
      const o = g.nearestEnemy(e.x, e.y, 40, (q) => q !== e && live(q));
      if (o) { g.zap([[e.x, e.y], [o.x, o.y]], 0.15); g.damageEnemy(o, st.dmg * 0.1 * c.n, { element: 'light', small: true, silent: true }); }
    }
    if (smoke) { // Toxic Smoke
      g.enemiesInRadius(e.x, e.y, 40, (o) => addPoison(o, 0.15 * st.dmg, 1, 5));
      g.particles.burst(e.x, e.y - 8, { n: 4, colors: ['#8ad04a', '#4a6a3a'], speed: 20, life: 0.6, up: 10 });
    }
  }
}
function furnace(g, w, st, e) {
  const R = 60 * g.player.stats.area;
  g.enemiesInRadius(e.x, e.y, R, (o) => { if (live(o)) wandHit(g, w, o, st.dmg, st, { ...away(e.x, e.y, o), knock: 90, small: true, silent: true }, false); });
  g.addEffect({ type: 'explosion', x: e.x, y: e.y, R, life: 0.35, color: ELEMENTS.fire.color, glow: true });
  fireZone(g, e.x, e.y, 20, 2, st.dmg * 0.25);
  g.shake(2.5, 0.15);
  Audio.play('explode');
}
function familiarTick(g, w, st, dt) {
  w.fams = (w.fams || []).filter((s) => !s.dead);
  while (w.fams.length < st.familiars) w.fams.push(makeFamiliar(g, w, w.fams.length));
  for (const s of w.fams) {
    if (st.el === 'glow' && (s.healT = (s.healT ?? 2) - dt) <= 0) {
      s.healT = 2;
      const pet = mostHurtPet(g);
      if (pet && pet.hp < pet.maxHp) { pet.heal(3); g.particles.burst(pet.x, pet.y - 8, { n: 6, colors: ['#fff6c8', '#9af08a'], speed: 26, life: 0.5, up: 16 }); }
    }
    if (st.el === 'fire' && !s.dive && (s.diveT = (s.diveT ?? 4) - dt) <= 0) { s.diveT = 4; startDive(g, s); }
  }
}
function makeFamiliar(g, w, i) {
  const P = g.player;
  const s = g.spawnProjectile({ x: P.x, y: P.y, r: 0, life: 1e9, noHit: true, spr: SPARK, scale: 1.6, src: 'emberwand', glow: GLOW, z: 14 });
  s.w = w; s.i = i; s.update = familiarMove;
  return s;
}
function familiarMove(g, s, dt) {
  const w = s.w, P = g.player;
  if (P.main !== w || w.st?.r2 !== 'familiar') { s.dead = true; return true; }
  if (s.dive) return diving(g, s, dt);
  const side = s.i % 2 ? -1 : 1, tx = P.x + side * (14 + 8 * Math.floor(s.i / 2)), ty = P.y - 4 + Math.sin(g.time * 3 + s.i) * 3;
  const k = Math.min(1, dt * 8);
  s.x += (tx - s.x) * k; s.y += (ty - s.y) * k;
  return true;
}
function familiarFire(g, w, st, n) {
  const m = Math.max(1, Math.ceil(n * st.famK));
  for (const s of w.fams || []) {
    if (s.dead || s.dive) continue;
    const foes = g.randomEnemies(s.x, s.y, REACH, m).filter(live);
    for (let i = 0; i < m && foes.length; i++) {
      const t = foes[i % foes.length];
      if (st.el === 'bolt') stormBolt(g, w, st, s, t);
      else spark(g, w, st, s.x, s.y, t, { fam: true });
    }
  }
}
// Storm Familiar: a bolt that chains on to 3 more foes
function stormBolt(g, w, st, s, t) {
  const hit = new Set();
  let from = s, cur = t;
  for (let i = 0; i < 4 && cur; i++) {
    g.zap([[from.x, from.y], [cur.x, cur.y]], 0.2);
    hit.add(cur);
    wandHit(g, w, cur, st.dmg, st, { small: i > 0, silent: true, noChain: true, element: 'light' }, true);
    from = cur;
    cur = g.nearestEnemy(cur.x, cur.y, 80, (o) => !hit.has(o) && live(o));
  }
}
// Phoenix: a dive through the biggest group and back, setting everything it passes burning
function startDive(g, s) {
  const c = biggestGroup(g, s.x, s.y, 180);
  if (!c) { s.diveT = 1; return; }
  const dx = c.x - s.x, dy = c.y - s.y, d = Math.hypot(dx, dy) || 1;
  s.dive = { tx: c.x + (dx / d) * 40, ty: c.y + (dy / d) * 40, back: false, hit: new Set() };
  s.spr = 'p_fireball'; s.scale = 1; s.trail = '#f6a03a';
  Audio.play('fire');
}
function diving(g, s, dt) {
  const D = s.dive, st = s.w.st, P = g.player, sp = 360;
  const tx = D.back ? P.x : D.tx, ty = D.back ? P.y - 4 : D.ty;
  const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy) || 1, m = Math.min(d, sp * dt);
  const nx = s.x + (dx / d) * m, ny = s.y + (dy / d) * m;
  if (!D.back) {
    lineHit(g, s.x, s.y, nx, ny, 10, (e) => {
      if (D.hit.has(e) || !live(e)) return;
      D.hit.add(e);
      wandHit(g, s.w, e, st.dmg, st, { small: true, silent: true, knock: 40 }, false);
    });
  }
  s.x = nx; s.y = ny;
  if (d <= m + 1) { if (D.back) { s.dive = null; s.trail = null; s.spr = SPARK; s.scale = 1.6; } else D.back = true; }
  return true;
}

// ------------------------------------------------------------ every frame
function wandTick(g, w, st, dt) {
  if (st.r2 === 'chain') chainTick(g, w, st);
  else if (st.r2 === 'charge') chargeTick(g, w, st, dt);
  else if (st.r2 === 'wall') wallTick(g, w, st, dt);
  else if (st.r2 === 'orbs') orbTick(g, w, st);
  else if (st.r2 === 'familiar') familiarTick(g, w, st, dt);
}
