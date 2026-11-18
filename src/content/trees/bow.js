// The Hunter Bow's tree (see evolve.js for how trees work, and the weapons doc for the design).
import { Audio } from '../../core/audio.js';
import { TAU, rand } from '../../core/util.js';
import { ELEMENTS, addPoison, wHit, strongest, biggestGroup, fireZone, poisonZone, iceZone, lineHit, fanAngles, step } from '../wcore.js';

// ------------------------------------------------------------ the bow
export const BOW = {
  name: 'Hunter Bow', icon: 'bow', proj: 'arrows',
  base: { dmg: 12, cd: 0.9, n: 1, pierce: 0, speed: 240, life: 1.3, r: 4, range: 250, knock: 50 },
  steps: {
    2: step('+4 damage', (s) => { s.dmg += 4; }),
    3: step('Shoots 15% faster', (s) => { s.cd *= 0.85; }),
  },
  r1: {
    volley: {
      name: 'Volley', desc: '3 arrows in a fan, each with 80% damage. For crowds.',
      apply: (s) => { s.n = 3; s.dmg *= 0.8; },
      steps: {
        5: step('+1 arrow', (s) => { s.n += 1; }),
        6: step('+3 damage per arrow', (s) => { s.dmg += 3; }),
        7: step('Arrows pierce 1 foe', (s) => { s.pierce += 1; }),
      },
      r2: {
        rain: {
          name: 'Arrow Rain', desc: 'Every 4th volley, 8 arrows also rain down on the biggest group.',
          apply: (s) => { s.rainEvery = 4; s.rainN = 8; },
          steps: { 9: step('+4 falling arrows', (s) => { s.rainN += 4; }), 10: step('Rain every 3rd volley', (s) => { s.rainEvery = 3; }), 11: step('+4 damage per arrow', (s) => { s.dmg += 4; }) },
          finals: {
            fire: { name: 'Meteor Rain', desc: 'Each falling arrow leaves fire on the ground for 3 s.' },
            ice: { name: 'Hailstorm', desc: 'Hail falls instead, and the rain circle stays icy for 3 s.' },
            poison: { name: 'Acid Rain', desc: 'The rain circle turns into a poison puddle for 4 s.' },
            bolt: { name: 'Thunder Rain', desc: 'A lightning strike follows each falling arrow.' },
            glow: { name: 'Sunshower', desc: 'Everything the rain hits glows for 6 s: your mons do +40% to them.' },
          },
        },
        splinter: {
          name: 'Splinter', desc: 'Each arrow breaks into 3 small shards when it hits (40% damage).',
          apply: (s) => { s.shards = 3; s.shardK = 0.4; s.shardPierce = 0; },
          steps: { 9: step('+1 shard', (s) => { s.shards += 1; }), 10: step('Shards do 60% damage', (s) => { s.shardK = 0.6; }), 11: step('Shards pierce 1 foe', (s) => { s.shardPierce = 1; }) },
          finals: {
            fire: { name: 'Ember Burst', desc: 'Each shard leaves a small fire where its flight ends.' },
            ice: { name: 'Ice Shatter', desc: 'Hitting a frozen foe bursts it into 4 extra shards.' },
            poison: { name: 'Thorn Spray', desc: 'Shards add 2 poison stacks instead of 1.' },
            bolt: { name: 'Spark Shards', desc: 'Shards chase the nearest foe, so none miss.' },
            glow: { name: 'Prism', desc: 'Shards become rays of light that go through every foe.' },
          },
        },
        ring: {
          name: 'Ring Volley', desc: 'Every 5 s, a ring of 12 arrows bursts out around you.',
          apply: (s) => { s.ringEvery = 5; s.ringN = 12; s.ringPierce = 0; },
          steps: { 9: step('+6 ring arrows', (s) => { s.ringN += 6; }), 10: step('Ring every 3.5 s', (s) => { s.ringEvery = 3.5; }), 11: step('Ring arrows pierce 2 foes', (s) => { s.ringPierce = 2; }) },
          finals: {
            fire: { name: 'Ring of Fire', desc: 'The ring leaves a circle of fire around you for 2 s.' },
            ice: { name: 'Frost Nova', desc: 'Every foe the ring hits freezes for 1 s.' },
            poison: { name: 'Toxic Ring', desc: 'A poison cloud around you for 3 s after each ring.' },
            bolt: { name: 'Storm Crown', desc: 'Half a second later, a ring of lightning follows the first.' },
            glow: { name: 'Halo', desc: 'You heal 1 HP for each foe the ring hits, up to 10 a ring.' },
          },
        },
      },
    },
    long: {
      name: 'Longshot', desc: 'One heavy arrow with 2.5× damage that flies through a whole line of foes. Shoots 40% slower.',
      apply: (s) => { s.dmg *= 2.5; s.pierce = Infinity; s.speed *= 1.5; s.life = 400 / s.speed; s.range = 320; s.cd *= 1.4; },
      steps: {
        5: step('+10 damage', (s) => { s.dmg += 10; }),
        6: step('Arrow 50% wider', (s) => { s.r = 6; }),
        7: step('Shoots 15% faster', (s) => { s.cd *= 0.85; }),
      },
      r2: {
        wind: {
          name: 'Wind Arrow', desc: 'The arrow pushes back every foe it passes.',
          apply: (s) => { s.knock = 260; },
          steps: { 9: step('Pushes 50% farther', (s) => { s.knock = 390; }), 10: step('Pushed foes are dazed for 0.5 s', (s) => { s.daze = 0.5; }), 11: step('+10 damage', (s) => { s.dmg += 10; }) },
          finals: {
            fire: { name: 'Firestorm', desc: 'The arrow leaves a line of fire along its path for 2 s.' },
            ice: { name: 'Blizzard', desc: 'Pushed foes freeze for 1 s instead of being dazed.' },
            poison: { name: 'Toxic Gale', desc: 'The arrow leaves a poison trail along its path for 3 s.' },
            bolt: { name: 'Gale Bolt', desc: 'Lightning runs back down the arrow\'s path for 50% damage.' },
            glow: { name: 'Dawn Wind', desc: 'Pushed foes glow for 6 s: your mons do +40% to them.' },
          },
        },
        blast: {
          name: 'Blast Tip', desc: 'The arrow explodes at the foe it was aimed at (40 px), then flies on.',
          apply: (s) => { s.blastR = 40; },
          steps: { 9: step('Blast 40% bigger', (s) => { s.blastR = 56; }), 10: step('A second blast at the end of its flight', (s) => { s.blast2 = true; }), 11: step('+10 damage', (s) => { s.dmg += 10; }) },
          finals: {
            fire: { name: 'Fire Bomb', desc: 'Each blast leaves burning ground for 3 s.' },
            ice: { name: 'Ice Bomb', desc: 'Everything in a blast freezes for 1 s.' },
            poison: { name: 'Gas Bomb', desc: 'Each blast leaves a poison cloud for 4 s.' },
            bolt: { name: 'Thunder Bomb', desc: 'Each blast throws bolts at 5 foes nearby.' },
            glow: { name: 'Flash Bomb', desc: 'A flash that blinds every foe in the blast for 1 s, and makes them glow.' },
          },
        },
        hunt: {
          name: 'Headhunter', desc: 'Aims at the foe with the most HP, with double damage to big foes.',
          apply: (s) => { s.huntMult = 2; },
          steps: { 9: step('+10 damage', (s) => { s.dmg += 10; }), 10: step('Triple damage to big foes', (s) => { s.huntMult = 3; }), 11: step('Shoots 15% faster', (s) => { s.cd *= 0.85; }) },
          finals: {
            fire: { name: 'Searing Shot', desc: 'Each hit makes the target\'s burn 25% stronger, up to 3×.' },
            ice: { name: 'Glacier Shot', desc: 'The target is slowed for 3 s, even a boss.' },
            poison: { name: 'Viper Shot', desc: 'Each hit adds 2 poison stacks, and the target can hold 10.' },
            bolt: { name: 'Sky Spear', desc: 'Each hit also calls lightning on the target for 50% damage.' },
            glow: { name: 'Beacon Shot', desc: 'Your mons attack the target first and do +40% damage to it.' },
          },
        },
      },
    },
    quick: {
      name: 'Quickdraw', desc: 'Shoots twice as fast, each arrow with 70% damage, and +10% crit chance.',
      apply: (s) => { s.cd *= 0.5; s.dmg *= 0.7; s.critAdd = (s.critAdd || 0) + 0.1; },
      steps: {
        5: step('+3 damage', (s) => { s.dmg += 3; }),
        6: step('+10% crit chance', (s) => { s.critAdd += 0.1; }),
        7: step('+1 arrow, side by side', (s) => { s.n += 1; }),
      },
      r2: {
        rico: {
          name: 'Ricochet', desc: 'After a hit, each arrow bounces on to 2 more foes.',
          apply: (s) => { s.bounces = 2; s.bounceUp = 0; },
          steps: { 9: step('+1 bounce', (s) => { s.bounces += 1; }), 10: step('+3 damage', (s) => { s.dmg += 3; }), 11: step('Each bounce does 15% more than the last', (s) => { s.bounceUp = 0.15; }) },
          finals: {
            fire: { name: 'Skipping Flame', desc: 'Each bounce leaves a small fire for 2 s.' },
            ice: { name: 'Cold Snap', desc: 'Bounces do double damage to chilled and frozen foes.' },
            poison: { name: 'Plague Bounce', desc: 'Bounces go for foes with no poison first.' },
            bolt: { name: 'Chain Lightning', desc: 'The arrow bounces as lightning, 6 times.' },
            glow: { name: 'Ray Bounce', desc: '+1 bounce, and bounces go for foes that aren\'t glowing yet.' },
          },
        },
        luck: {
          name: 'Lucky Shot', desc: 'Every crit fires a free arrow at another foe. Free arrows can crit too.',
          apply: (s) => { s.luckyN = 1; },
          steps: { 9: step('+10% crit chance', (s) => { s.critAdd += 0.1; }), 10: step('Crits fire 2 free arrows', (s) => { s.luckyN = 2; }), 11: step('+50% crit damage', (s) => { s.critMultAdd = (s.critMultAdd || 0) + 0.5; }) },
          finals: {
            fire: { name: 'Hot Streak', desc: '+15% crit chance against burning foes.' },
            ice: { name: 'Cold Eye', desc: 'Crits freeze the foe for 1 s, and hits on frozen foes always crit.' },
            poison: { name: 'Lucky Venom', desc: 'Crits add 3 poison stacks instead of 1.' },
            bolt: { name: 'Lucky Strike', desc: 'Every crit also calls lightning on the foe.' },
            glow: { name: 'Gleam', desc: 'Every crit heals you 1 HP, up to 5 HP a second.' },
          },
        },
        hawk: {
          name: 'Hawk Eye', desc: 'Arrows curve toward their target. Each hit on the same foe does 10% more, up to +100%.',
          apply: (s) => { s.homing = 6; s.hawkCap = 1; },
          steps: { 9: step('+3 damage', (s) => { s.dmg += 3; }), 10: step('Stack goes up to +200%', (s) => { s.hawkCap = 2; }), 11: step('Shoots 15% faster', (s) => { s.cd *= 0.85; }) },
          finals: {
            fire: { name: 'Kindling', desc: 'The burn grows with your stack, up to 3× at full.' },
            ice: { name: 'Frostbite', desc: 'A full stack freezes the foe for 1 s and starts the stack over.' },
            poison: { name: 'Deep Venom', desc: 'At a full stack, every hit adds 2 stacks, and the foe can hold 10.' },
            bolt: { name: 'Overcharge', desc: 'At a full stack, every hit also strikes with lightning.' },
            glow: { name: 'True Sight', desc: 'Your mons get the same bonus as your stack against that foe.' },
          },
        },
      },
    },
  },
  fire: bowFire,
  tick: bowTick,
};

// One arrow (or shard / free arrow). o: { target, shard, free, gen, ring, dmg, pierce, scale, life, homing, ... }
function arrow(g, st, x, y, a, o = {}) {
  const sp = (o.speed || st.speed) * g.player.stats.projSpeed;
  const p = g.spawnProjectile({
    x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: o.r || st.r, dmg: o.dmg ?? st.dmg, pierce: o.pierce ?? st.pierce,
    life: o.life || st.life, spr: 'p_arrow', rot: a, src: 'bow', knock: st.knock, scale: o.scale,
    homing: o.homing ?? st.homing, target: o.target, trail: o.trail,
  });
  p.st = st; p.hit = bowHit; p.target0 = o.target; p.shard = o.shard; p.free = o.free; p.gen = o.gen || 0; p.ring = o.ring; p.bounce = 0;
  if (st.r2 === 'rico' && !o.shard && !o.ring) { p.bounces = st.bounces + (st.el === 'glow' ? 1 : 0); p.onHit = bounceOn; }
  if (st.r2 === 'wind' && !o.free) { p.path = [[x, y]]; p.update = windTrail; p.onExpire = windEnd; }
  if (st.r2 === 'blast' && st.blast2) p.onExpire = (g2, q) => blastAt(g2, q.st, q.x, q.y);
  if (o.shard) {
    if (st.el === 'fire') p.onExpire = (g2, q) => fireZone(g2, q.x, q.y, 8, 2, q.st.dmg * 0.25);
    if (st.el === 'bolt') { p.homing = 9; p.target = null; }
    if (st.el === 'glow') p.pierce = Infinity;
  }
  return p;
}
function bowFire(g, w, st) {
  const P = g.player, S = P.stats;
  const t = st.r2 === 'hunt' ? strongest(g, P.x, P.y, 300) : g.nearestEnemy(P.x, P.y, st.range);
  if (!t) return false;
  const a = Math.atan2(t.y - P.y, t.x - P.x);
  w.shots = (w.shots || 0) + 1;
  if (st.r1 === 'long') arrow(g, st, P.x, P.y, a, { target: t });
  else if (st.r1 === 'quick') {
    const n = st.n + S.amount;
    for (let i = 0; i < n; i++) { const off = (i - (n - 1) / 2) * 6; arrow(g, st, P.x - Math.sin(a) * off, P.y + Math.cos(a) * off, a, { target: t }); }
  } else for (const b of fanAngles(a, st.n + S.amount, st.r1 === 'volley' ? 0.14 : 0.13)) arrow(g, st, P.x, P.y, b, { target: t });
  if (st.r2 === 'rain' && w.shots % st.rainEvery === 0) arrowRain(g, st);
  Audio.play('shoot');
}
function bowTick(g, w, st, dt) {
  if (st.r2 !== 'ring') return;
  w.ringT = (w.ringT ?? 1.5) - dt;
  if (w.ringT > 0) return;
  w.ringT = st.ringEvery * g.player.stats.cooldown;
  ringBurst(g, st, false);
}
function ringBurst(g, st, bolt) {
  const P = g.player, n = bolt ? 18 : st.ringN, id = (g.ringId = (g.ringId || 0) + 1);
  g.ringHeal = { id, n: 0 };
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + (bolt ? TAU / n / 2 : 0);
    const p = arrow(g, st, P.x, P.y, a, { ring: id, pierce: st.ringPierce, dmg: bolt ? st.dmg * 0.5 : st.dmg, trail: bolt ? '#fff6c8' : null });
    if (bolt) p.boltRing = true;
  }
  if (!bolt) {
    if (st.el === 'fire') fireZone(g, P.x, P.y, 60, 2, st.dmg * 0.25);
    if (st.el === 'poison') poisonZone(g, P.x, P.y, 70, 3, st.dmg * 0.15);
    if (st.el === 'bolt') g.after(0.5, (g2) => ringBurst(g2, st, true));
  }
  g.addEffect({ type: 'ring', x: P.x, y: P.y, R: 40, life: 0.3, color: bolt ? '#fff6c8' : '#ffffff' });
  Audio.play('swing');
}
function arrowRain(g, st) {
  const P = g.player, c = biggestGroup(g, P.x, P.y, 260);
  if (!c) return;
  const cx = c.x, cy = c.y;
  if (st.el === 'ice') iceZone(g, cx, cy, 34, 3);
  if (st.el === 'poison') poisonZone(g, cx, cy, 34, 4, st.dmg * 0.15);
  for (let i = 0; i < st.rainN; i++) {
    const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * 30;
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.8;
    g.after(i * 0.04 + rand(0, 0.15), (g2) => fallArrow(g2, st, x, y));
  }
}
function fallArrow(g, st, x, y) {
  const T = 0.3;
  g.spawnProjectile({
    x, y, r: 0, dmg: 0, life: T, noHit: true, spr: st.el === 'ice' ? 'p_bubble' : 'p_arrow', rot: Math.PI / 2, z: 120, src: 'bow',
    update(g2, p) { p.z = 120 * (1 - p.age / T); return true; },
    onExpire(g2, p) {
      g2.enemiesInRadius(p.x, p.y, 12, (e) => wHit(g2, e, st.dmg, st, { small: true, silent: true, glowT: 6, glowK: 0.4, knock: 20 }));
      g2.addEffect({ type: 'flashring', x: p.x, y: p.y, R: 10, life: 0.15, color: st.el ? ELEMENTS[st.el].color : '#ffffff' });
      if (st.el === 'fire') fireZone(g2, p.x, p.y, 12, 3, st.dmg * 0.25);
      if (st.el === 'bolt') { g2.strike(p.x, p.y); g2.enemiesInRadius(p.x, p.y, 16, (e) => g2.damageEnemy(e, st.dmg, { element: 'light', small: true, silent: true })); }
    },
  });
}
function shardBurst(g, st, e, a, n) {
  for (let i = 0; i < n; i++) {
    const b = a + (n > 1 ? (i / (n - 1) - 0.5) * 1.4 : 0) + rand(-0.1, 0.1);
    const p = arrow(g, st, e.x, e.y, b, { shard: true, dmg: st.dmg * st.shardK, pierce: st.shardPierce, scale: 0.6, life: 80 / st.speed, r: 3 });
    p.hitSet.add(e.id);
  }
}
function blastAt(g, st, x, y) {
  const R = st.blastR;
  g.enemiesInRadius(x, y, R, (e) => {
    wHit(g, e, st.dmg, st, { small: true, silent: true, freeze: st.el === 'ice' ? 1 : 0, stun: st.el === 'glow' ? 1 : 0, glowT: 3, knock: 60 });
  });
  g.addEffect({ type: 'explosion', x, y, R, life: 0.3, color: st.el ? ELEMENTS[st.el].color : '#f6a03a', glow: true });
  if (st.el === 'fire') fireZone(g, x, y, R, 3, st.dmg * 0.25);
  if (st.el === 'poison') poisonZone(g, x, y, R, 4, st.dmg * 0.15);
  if (st.el === 'bolt') {
    for (const o of g.randomEnemies(x, y, 100, 5)) { g.zap([[x, y], [o.x, o.y]], 0.2); g.damageEnemy(o, st.dmg * 0.5, { element: 'light', small: true, silent: true }); }
  }
  g.shake(2, 0.15); Audio.play('explode');
}
function windTrail(g, p) {
  const last = p.path[p.path.length - 1];
  if ((p.x - last[0]) ** 2 + (p.y - last[1]) ** 2 > 400) {
    p.path.push([p.x, p.y]);
    if (p.st.el === 'fire') fireZone(g, p.x, p.y, 10, 2, p.st.dmg * 0.25);
    if (p.st.el === 'poison') poisonZone(g, p.x, p.y, 10, 3, p.st.dmg * 0.15);
  }
  return false;
}
function windEnd(g, p) {
  if (p.st.el !== 'bolt') return;
  const pts = [...p.path, [p.x, p.y]], st = p.st;
  g.after(0.3, (g2) => {
    g2.zap([...pts].reverse(), 0.25);
    for (let i = 0; i < pts.length - 1; i++) lineHit(g2, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 8, (e) => g2.damageEnemy(e, st.dmg * 0.5, { element: 'light', small: true, silent: true }));
  });
}
// A ricochet: the arrow turns to the next foe (onHit keeps it alive while bounces are left)
function bounceOn(g, p, e) {
  const st = p.st;
  if (st.el === 'fire') fireZone(g, e.x, e.y, 8, 2, st.dmg * 0.25);
  if (p.bounces <= 0) return false;
  const pref = st.el === 'poison' ? (o) => !(o.poison?.stacks > 0) : st.el === 'glow' ? (o) => !(o.glow > 0) : null;
  const ok = (o) => o !== e && !p.hitSet.has(o.id);
  const next = (pref && g.nearestEnemy(p.x, p.y, 110, (o) => ok(o) && pref(o))) || g.nearestEnemy(p.x, p.y, 110, ok);
  if (!next) return false;
  p.bounces--; p.bounce++;
  const a = Math.atan2(next.y - p.y, next.x - p.x), sp = Math.hypot(p.vx, p.vy);
  p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.age = 0; p.rot = a;
  return true;
}
// Every hit from a bow arrow lands here (the projectile's hit hook)
function bowHit(g, p, e) {
  const st = p.st, P = g.player;
  const sp = Math.hypot(p.vx, p.vy) || 1, kx = p.vx / sp, ky = p.vy / sp;
  let dmg = p.dmg;
  const x = { kx, ky, knock: p.knock };
  if (p.shard || p.ring || p.free) x.small = true;
  if (p.boltRing) x.element = 'light';
  // route bonuses before the hit
  if (st.r2 === 'hunt' && (e.boss || e.elite)) dmg *= st.huntMult;
  if (st.r2 === 'rico' && p.bounce) { dmg *= (1 + st.bounceUp) ** p.bounce; if (st.el === 'ice' && (e.chill > 0 || e.freeze > 0)) dmg *= 2; }
  let hawk = null;
  if (st.r2 === 'hawk' && !p.shard) {
    hawk = e.hawk && g.time - e.hawk.t < 2 ? e.hawk : (e.hawk = { n: 0, t: 0 });
    const bonus = Math.min(st.hawkCap, hawk.n * 0.1);
    dmg *= 1 + bonus;
    hawk.n++; hawk.t = g.time; hawk.full = bonus >= st.hawkCap;
    if (st.el === 'fire') x.burnK = 1 + 2 * (bonus / st.hawkCap);
    if (st.el === 'glow') x.glowK = Math.max(0.25, bonus);
    if (hawk.full && st.el === 'poison') { x.stacks = 2; x.cap = 10; }
  }
  if (st.r2 === 'wind' && !p.free) {
    if (st.el === 'ice' && st.daze) x.freeze = 1; else if (st.daze) x.stun = st.daze;
    if (st.el === 'glow') { x.glowT = 6; x.glowK = 0.4; }
  }
  if (st.r2 === 'hunt' && p.target0 === e) {
    if (st.el === 'fire') { e.burnBoost = Math.min(3, (e.burnBoost || 1) + 0.25); x.burnK = e.burnBoost; }
    if (st.el === 'ice') x.chill = 3;
    if (st.el === 'poison') { x.stacks = 2; x.cap = 10; }
    if (st.el === 'glow') { x.glowK = 0.4; g.beacon = e; }
  }
  if (st.r2 === 'luck') {
    if (st.el === 'fire' && e.burn) x.critAdd = 0.15;
    if (st.el === 'ice' && e.freeze > 0) x.critAdd = 1;
  }
  if (st.r2 === 'splinter' && p.shard && st.el === 'poison') x.stacks = 2;
  if (st.r2 === 'ring' && p.ring && st.el === 'ice' && !p.boltRing) x.freeze = 1;
  const wasFrozen = e.freeze > 0;
  // Chain Lightning: the first hit jumps on as lightning instead of bouncing
  if (st.r2 === 'rico' && st.el === 'bolt' && !p.bounce && p.bounces > 0) {
    const res = wHit(g, e, dmg, st, { ...x, noChain: true });
    let cur = e, prev = null;
    for (let i = 0; i < 6; i++) {
      const nx = g.nearestEnemy(cur.x, cur.y, 110, (o) => o !== cur && o !== prev);
      if (!nx) break;
      g.zap([[cur.x, cur.y], [nx.x, nx.y]], 0.2);
      wHit(g, nx, dmg, st, { small: true, silent: true, noChain: true, element: 'light' });
      prev = cur; cur = nx;
    }
    p.bounces = 0;
    return res;
  }
  const res = wHit(g, e, dmg, st, x);
  // after the hit
  if (st.r2 === 'splinter' && !p.shard) shardBurst(g, st, e, Math.atan2(ky, kx), st.shards);
  if (st.r2 === 'splinter' && st.el === 'ice' && wasFrozen && !(e.shatterT > g.time)) { e.shatterT = g.time + 1; shardBurst(g, st, e, Math.random() * TAU, 4); }
  if (st.r2 === 'blast' && p.target0 === e && !p.blasted) { p.blasted = true; blastAt(g, st, e.x, e.y); }
  if (st.r2 === 'hunt' && p.target0 === e && st.el === 'bolt') { g.strike(e.x, e.y); g.damageEnemy(e, dmg * 0.5, { element: 'light', small: true, silent: true }); }
  if (hawk?.full) {
    if (st.el === 'ice') { e.freeze = Math.max(e.freeze, e.boss ? 0 : 1); if (e.boss) e.chill = Math.max(e.chill, 1); hawk.n = 0; }
    if (st.el === 'bolt') { g.strike(e.x, e.y); g.damageEnemy(e, dmg * 0.5, { element: 'light', small: true, silent: true }); }
  }
  if (p.ring && st.el === 'glow' && g.ringHeal?.id === p.ring && g.ringHeal.n < 10) { g.ringHeal.n++; P.heal(1); }
  if (st.r2 === 'luck' && res.crit) {
    if (st.el === 'ice') { if (e.boss) e.chill = Math.max(e.chill, 1); else e.freeze = Math.max(e.freeze, 1); }
    if (st.el === 'poison') addPoison(e, 0.15 * dmg, 2, 5);
    if (st.el === 'bolt') { g.strike(e.x, e.y); g.damageEnemy(e, dmg, { element: 'light', small: true, silent: true }); }
    if (st.el === 'glow' && (g.gleamT || 0) <= g.time) { g.gleamN = (g.gleamT || 0) + 1 > g.time ? (g.gleamN || 0) : 0; if ((g.gleamN = (g.gleamN || 0) + 1) >= 5) g.gleamT = g.time + 1; P.heal(1); }
    if (p.gen < 3) {
      const others = g.randomEnemies(e.x, e.y, 150, st.luckyN, e);
      for (const o of others) arrow(g, st, e.x, e.y, Math.atan2(o.y - e.y, o.x - e.x), { free: true, gen: p.gen + 1, target: o, homing: 8 }).hitSet.add(e.id);
    }
  }
  return res;
}

