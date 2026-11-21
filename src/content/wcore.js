// Shared pieces for the main weapons' trees: the five elements and hit/status helpers.
import { TAU } from '../core/util.js';

// The five elements, the same rules for every weapon. Internal ids: fire, ice, poison, bolt, glow.
export const ELEMENTS = {
  fire: { name: 'Fire', color: '#f6702a', desc: 'Hits set foes burning for 3 s, for 25% of the hit each second.' },
  ice: { name: 'Ice', color: '#8fd8ff', desc: 'Hits chill foes for 2 s. Three hits in that time freeze a foe for 1 s.' },
  poison: { name: 'Poison', color: '#8ad04a', desc: 'Each hit adds a poison stack (up to 5): 15% of the hit each second for 4 s.' },
  bolt: { name: 'Lightning', color: '#ffe36a', desc: 'Each hit sends a bolt to 2 other foes nearby, for 25% of the hit.' },
  glow: { name: 'Light', color: '#fff6c8', desc: 'Foes you hit glow for 3 s. Your survivalmons do +25% damage to glowing foes.' },
};
export const ELEMENT_IDS = Object.keys(ELEMENTS);

// ------------------------------------------------------------ status helpers (used by every tree)
// Adds poison stacks to a foe; each stack does dps damage a second for 4 s (enemy.js ticks it).
export function addPoison(e, dps, n = 1, cap = 5) {
  if (e.dead) return;
  const p = e.poison || (e.poison = { stacks: 0, dps: 0, t: 0, cap: 5 });
  p.cap = Math.max(p.cap, cap);
  p.dps = Math.max(p.dps * (p.t > 0 ? 1 : 0), dps);
  p.stacks = Math.min(p.cap, p.stacks + n);
  p.t = 4;
}
export function glowOn(e, t = 3, k = 0.25) {
  if (e.dead) return;
  if (!(e.glow > 0)) e.glowK = 0;
  e.glow = Math.max(e.glow || 0, t);
  e.glowK = Math.max(e.glowK || 0, k);
}
// A bolt from foe e to n other foes within r, each taking dmg (lightning, no further chains)
export function chainBolt(g, e, dmg, n = 2, r = 80, st = null) {
  const near = g.randomEnemies(e.x, e.y, r, n, e);
  for (const o of near) {
    g.zap([[e.x, e.y], [o.x, o.y]], 0.2);
    g.damageEnemy(o, dmg, { element: 'light', small: true, silent: true, critAdd: st?.critAdd || 0 });
  }
}
// One hit from a main weapon, with its element. x: { knock, kx, ky, stun, freeze, chill, critAdd,
// stacks, cap, burnK, burn, glowT, glowK, iceHits, noChain, small, silent, element }
export function wHit(g, e, dmg, st, x = {}) {
  if (!e || e.dead || e.hidden || e.fainted) return { crit: false, dmg: 0 };
  // the gear sets worn (systems/setfx.js) hear of every weapon hit; a hit they make themselves (x.fx) doesn't count
  const F = x.fx ? null : g.fx;
  F?.hitX?.(e, st, x);
  const el = st.el;
  const o = {
    knock: x.knock ?? st.knock ?? 0, kx: x.kx, ky: x.ky, stun: x.stun, freeze: x.freeze, chill: x.chill,
    critAdd: (st.critAdd || 0) + (x.critAdd || 0), critMultAdd: st.critMultAdd || 0,
    small: x.small, silent: x.silent, element: x.element || 'phys', src: 'main',
  };
  if (el === 'fire') o.burn = 0.25 * dmg * (x.burnK || 1);
  if (x.burn) o.burn = Math.max(o.burn || 0, x.burn); // a weapon that always burns (the wand) brings its own
  if (el === 'ice') {
    o.chill = Math.max(o.chill || 0, 2);
    if (!(e.iceT > g.time)) e.iceN = 0;
    e.iceN = (e.iceN || 0) + (x.iceHits || 1); e.iceT = g.time + 2;
    if (e.iceN >= 3) { o.freeze = Math.max(o.freeze || 0, 1); e.iceN = 0; }
  }
  const res = g.damageEnemy(e, dmg, o);
  if (el === 'poison') addPoison(e, 0.15 * dmg, x.stacks || 1, x.cap || 5);
  if (el === 'bolt' && !x.noChain) chainBolt(g, e, dmg * 0.25, 2, 80, st); // 25%: at 30% it still cleared crowds 30% faster than the other elements
  if (el === 'glow') glowOn(e, x.glowT || 3, x.glowK || 0.25);
  F?.hit?.(e, res, dmg, st, x);
  return res;
}
// The foe with the most HP within r (bosses first, then elites)
export function strongest(g, x, y, r) {
  let best = null, bv = -1;
  g.enemiesInRadius(x, y, r, (e) => { if (e.hidden || e.fainted) return; const v = e.hp + (e.boss ? 1e6 : e.elite ? 1e4 : 0); if (v > bv) { bv = v; best = e; } });
  return best;
}
// The spot with the most foes around it (a foe with the most neighbours within 40 px)
export function biggestGroup(g, x, y, r) {
  const list = [];
  g.enemiesInRadius(x, y, r, (e) => { if (!e.hidden && !e.fainted && list.length < 40) list.push(e); });
  let best = null, bn = -1;
  for (const e of list) {
    let n = 0;
    for (const o of list) if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 < 1600) n++;
    if (n > bn) { bn = n; best = e; }
  }
  return best;
}
export function fireZone(g, x, y, r, dur, dps) { return g.spawnFire(x, y, r, dur, dps); }
export function poisonZone(g, x, y, r, dur, dps, follow = false) {
  return g.spawnZone({ kind: 'poison', x, y, r, life: dur, tick: 1, firstTick: 0.05, follow, onTick: (g2, z) => g2.enemiesInRadius(z.x, z.y, z.r, (e) => addPoison(e, dps, 1, 5)) });
}
export function iceZone(g, x, y, r, dur) {
  return g.spawnZone({ kind: 'ice', x, y, r, life: dur, tick: 0.5, firstTick: 0.05, onTick: (g2, z) => g2.enemiesInRadius(z.x, z.y, z.r, (e) => { e.chill = Math.max(e.chill, 1); }) });
}
// Hits every foe within r of the line from (ax, ay) to (bx, by)
export function lineHit(g, ax, ay, bx, by, r, fn) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
  const cx = (ax + bx) / 2, cy = (ay + by) / 2, R = Math.sqrt(L2) / 2 + r + 12;
  g.enemiesInRadius(cx, cy, R, (e) => {
    const t = Math.max(0, Math.min(1, ((e.x - ax) * dx + (e.y - ay) * dy) / L2));
    if ((ax + dx * t - e.x) ** 2 + (ay + dy * t - e.y) ** 2 <= (r + e.r) ** 2) fn(e);
  });
}
export const pick = (list, n) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };

export function fanAngles(base, n, step) { const out = []; for (let i = 0; i < n; i++) out.push(base + (i - (n - 1) / 2) * step); return out; }
export const step = (text, apply) => ({ text, apply });

// ------------------------------------------------------------ more helpers (boomerang, spear, wand, sling)
// The push direction from a point to a foe (wHit's kx, ky)
export function away(x, y, e) { const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy) || 1; return { kx: dx / d, ky: dy / d }; }
// Freezes a foe for t s (a boss is only chilled). A foe that's frozen, or thawed less than THAW_GUARD s
// ago, can't be frozen again: fast area hits used to keep whole crowds frozen for good (an Ice final on
// the spear's Wave or the wand's Nova lasted about 70% longer than any other element). Returns whether it froze.
export const THAW_GUARD = 1.5;
export function tryFreeze(e, t) {
  if (e.dead || !(t > 0)) return false;
  if (e.boss) { e.chill = Math.max(e.chill || 0, t); return false; }
  if (e.freeze > 0 || e.freezeGuard > 0) return false;
  e.freeze = t; e.freezeGuard = t + THAW_GUARD;
  return true;
}
export function freezeE(e, t) { tryFreeze(e, t); }
// A lightning strike at (x, y): every foe within r takes dmg
export function strikeAt(g, x, y, r, dmg) {
  g.strike(x, y);
  g.enemiesInRadius(x, y, r, (e) => g.damageEnemy(e, dmg, { element: 'light', small: true, silent: true }));
}
// Bolts from (x, y) to n random foes within r (and farther than r0 from it), dmg each
export function zapAround(g, x, y, r, n, dmg, r0 = 0, not = null) {
  const pool = g.randomEnemies(x, y, r, n * 3 + 4, not).filter((e) => (e.x - x) ** 2 + (e.y - y) ** 2 >= r0 * r0).slice(0, n);
  for (const o of pool) { g.zap([[x, y], [o.x, o.y]], 0.2); g.damageEnemy(o, dmg, { element: 'light', small: true, silent: true }); }
  return pool.length;
}
// Calls fn(x, y) along the line from (ax, ay) to (bx, by), about every gap px
export function spots(ax, ay, bx, by, gap, fn) {
  const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / gap));
  for (let i = 0; i <= n; i++) fn(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n);
}
// Calls fn(x, y) at n points around a circle
export function ringSpots(x, y, R, n, fn) { for (let i = 0; i < n; i++) { const a = (i / n) * TAU; fn(x + Math.cos(a) * R, y + Math.sin(a) * R); } }
// Leaves something every gap px that o (a shot, the hero) travels: fn(x, y). The state lives on o.
export function dropTrail(o, gap, fn, x = o.x, y = o.y) {
  if (o.trX === undefined) { o.trX = x; o.trY = y; return; }
  if ((x - o.trX) ** 2 + (y - o.trY) ** 2 < gap * gap) return;
  o.trX = x; o.trY = y; fn(x, y);
}
// A ring that grows from r0 to r1 around (x, y) over dur s: fn(e) once for each foe it passes
export function ringWave(g, x, y, r0, r1, dur, fn, color = '#ffffff') {
  const hit = new Set();
  g.addEffect({ type: 'ring', x, y, R: r1, life: dur + 0.1, color });
  return g.spawnZone({
    kind: 'wave', invisible: true, x, y, r: r1, life: dur, tick: 0.04, firstTick: 0,
    onTick: (g2, z) => {
      const R = r0 + (r1 - r0) * Math.min(1, z.age / dur);
      g2.enemiesInRadius(z.x, z.y, R, (e) => {
        if (hit.has(e) || (e.x - z.x) ** 2 + (e.y - z.y) ** 2 < r0 * r0) return;
        hit.add(e); fn(e);
      });
    },
  });
}
// Every foe in a cone: within R of (x, y) and within half (radians) either side of angle a
export function coneHit(g, x, y, a, R, half, fn) {
  g.enemiesInRadius(x, y, R, (e) => {
    let d = Math.atan2(e.y - y, e.x - x) - a;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    if (Math.abs(d) <= half || (e.x - x) ** 2 + (e.y - y) ** 2 < 4 * e.r * e.r) fn(e);
  });
}
// The survivalmon with the lowest share of its HP left (not fainted ones)
export function mostHurtPet(g) {
  let best = null, bv = 2;
  for (const p of g.player.pets) { if (p.fainted || p.carriedBy) continue; const v = p.hp / p.maxHp; if (v < bv) { bv = v; best = p; } }
  return best;
}
// Heals each survivalmon (not fainted) n HP; with r, only those within r of (x, y)
export function healPets(g, n, x, y, r) {
  for (const p of g.player.pets) if (!p.fainted && (r === undefined || (p.x - x) ** 2 + (p.y - y) ** 2 <= r * r)) p.heal(n);
}
// Heals the hero n HP, but at most cap HP in each win s (the count lives on h)
export function capHeal(g, h, n, cap, win = 1) {
  if (!(h.t > g.time - win)) { h.t = g.time; h.n = 0; }
  const k = Math.min(n, cap - h.n);
  if (k > 0) { h.n += k; g.player.heal(k); }
}
// A short boost to the whole team (g.team: dmg, haste, def): sets this weapon's share of g.team[key] to v.
// Only the delta is added, and it is kept on holder, so exactly that comes off again (a new run starts
// with a new team object, so nothing is left behind).
export function teamDelta(g, holder, key, v) {
  if (!g.team) return;
  const td = holder.td && holder.td.team === g.team ? holder.td : (holder.td = { team: g.team });
  const d = v - (td[key] || 0);
  if (!d) return;
  g.team[key] = (g.team[key] || 0) + d;
  td[key] = v;
}
// Marks the trees leave on foes, which Combat.damageEnemy reads (dmgMarks), for evolves that change
// how much a foe takes from everything or that add to your survivalmons' hits:
//   e.wCrush {k, until}: takes k more while stunned or frozen (Crusher)
//   e.wPin {k, until}: takes k more while pinned (Impale)
//   e.brk {v, cap, until, el}: armor break, takes v more, plus its element's twist (Armor Break)
//   e.wCharge {n, k, until}: takes n × k more (the wand's Charge)
//   pet.wSpicyT: that survivalmon does +30% until then (Spicy Treats)
// After a survivalmon's hit lands, g.wPetHit.fn(g, e, res, o) runs while g.wPetHit.w is the hero's weapon.
export function dmgMarks(g, e, o = {}) {
  const t = g.time;
  let k = 1;
  if (e.wCrush && e.wCrush.until > t && (e.stun > 0 || e.freeze > 0)) k *= 1 + e.wCrush.k;
  if (e.wPin && e.wPin.until > t) k *= 1 + e.wPin.k;
  if (e.wCharge && e.wCharge.until > t) k *= 1 + e.wCharge.k * e.wCharge.n;
  const b = e.brk && e.brk.until > t ? e.brk : null;
  if (b) {
    const v = Math.min(b.cap, b.v + (b.el === 'poison' && e.poison ? 0.05 * e.poison.stacks : 0));
    const full = v >= b.cap - 1e-6;
    k *= 1 + (o.pet && b.el === 'glow' ? 2 * v : v);
    if (b.el === 'fire' && o.raw && o.element === 'fire') k *= 1.5;
    if (b.el === 'bolt' && full && o.element === 'light') k *= 2;
    if (b.el === 'ice' && full && e.freeze > 0 && !o.raw && !(e.wShatT > t)) { k *= 3; e.wShatT = t + 1; }
  }
  if (o.petRef && o.petRef.wSpicyT > t) k *= 1.3;
  return k;
}
// Combat.damageEnemy reads these marks itself (dmgMarks), so nothing needs wrapping any more; the
// trees still call this where they leave a mark.
export function hookDamage() {}
