// Gear-set effects in a run. Every set (content/gear.js) has three bonuses (2, 4 and 6 pieces worn).
// Their plain stats are added up by Meta.heroTeamBonus; everything that HAPPENS in a run is here, by
// the set's id, so a bonus's text there and its effect here must say the same thing.
// makeFx(g, hero) builds the run's handlers from the sets the hero wears (null when none is on), and
// the game calls them at its hooks (all optional: a hook nobody uses is null):
//   wstat(s)                    the weapon's stats, after its levels and evolves (evolve.js wStats)
//   pre(w, st) -> st            before an attack: may hand back changed stats for it
//   fired(w, st, ok, charged)   after it (ok: it found a target; charged: a Legendary set's 5th attack)
//   cdK()                       multiplies the weapon's cooldown
//   hitX(e, st, x)              before a weapon hit: may change its extras (x)
//   hit(e, res, dmg, st, x)     after a weapon hit (st.charged: it came from a Legendary set's charged attack)
//   dmgK(e, o), critAdd(e, o)   every hit on a foe (not raw ones): damage multiplier, extra crit chance
//   kill(e, o)                  a foe fell
//   dash(), caught(p), berry(n), chest(), wild(), levelUp(), petFaint(pet), tick(dt), draw(ctx, cam)
//   block(dmg) -> true          the hero's hit is blocked
//   hurtK(), speedK(), petHurtK(pet)   multipliers: damage the hero takes, move speed, damage a mon takes
// and reads fx.dashK (dash recharge), fx.berryK (berry drops) and fx.chestCoinK (coins in chests).
import { Audio } from '../core/audio.js';
import { TAU, rand, dist2, choice } from '../core/util.js';
import { HERO_SETS, SET_PIECES } from '../content/gear.js';
import { TREES, wStats } from '../content/evolve.js';
import { wHit, strongest, fireZone, ringWave, teamDelta, mostHurtPet, tryFreeze, chainBolt, dropTrail, away } from '../content/wcore.js';
import { Meta } from './meta.js';

const RAINBOW = ['#ff5a5a', '#ffb040', '#ffe07a', '#7af08a', '#7ad8ff', '#b070ff'];
const PULLED = { xp: 1, coin: 1, heart: 1, berry: 1, shard: 1 };

export function makeFx(g, hero) {
  const H = {}, s = {}, fx = { s, n: {}, dashK: 1, berryK: 1, chestCoinK: 1, sets: {} };
  const tally = (k) => { fx.n[k] = (fx.n[k] || 0) + 1; }; // how often each effect went off (for tools/fxtest.js)
  const on = (k, fn) => (H[k] ||= []).push(fn);
  const P = () => g.player, W = () => g.player.main, ST = () => wStats(g.player.main);
  const live = (e) => !e.dead && !e.hidden && !e.fainted;
  // a hit from a set's effect: k times the weapon's damage, with its element. It never sets effects off again.
  const hitW = (e, k, x = {}) => wHit(g, e, ST().dmg * k, ST(), { small: true, silent: true, ...x, fx: true });
  const around = (x, y, r, fn) => g.enemiesInRadius(x, y, r, (e) => { if (live(e)) fn(e); });
  const near = (r) => g.nearestEnemy(P().x, P().y, r, live);
  const mine = (o) => !o.pet && !o.petRef && !o.by && !o.bomb; // the hero's own kill: the weapon, what it leaves behind, a bleed
  const pets = () => P().pets.filter((p) => !p.fainted && !p.carriedBy);
  const pip = (e, color, t) => { e.fxPip = color; e.fxPipT = g.time + t; }; // a small mark over a foe's head
  const say = (text, color = '#ffe07a', o = P()) => g.particles.text(o.x, o.y - 28, text, color);
  const ring = (x, y, R, color, life = 0.35) => g.addEffect({ type: 'ring', x, y, R, life, color });
  // Timed boosts for the whole team (g.team: dmg, haste, def). Each has its own share, taken off when it ends.
  const buffs = {};
  const buff = (id, key, v, dur = Infinity) => { const b = (buffs[id] ||= { key, holder: {} }); b.v = v; b.until = g.time + dur; teamDelta(g, b.holder, key, v); };
  on('tick', () => { for (const b of Object.values(buffs)) if (b.v && b.until <= g.time) { b.v = 0; teamDelta(g, b.holder, b.key, 0); } });
  // fn() every sec seconds, but only while a foe is within `need` px (it waits for one otherwise)
  const every = (sec, fn, need = 220) => {
    const T = () => (typeof sec === 'function' ? sec() : sec);
    let t = T() * 0.5;
    on('tick', (dt) => { if ((t -= dt) > 0) return; if (need && !near(need)) { t = 0.5; return; } t = T(); fn(); });
  };
  // Every Nth attack that goes off: mod(st) -> the stats it attacks with, done(st, w) right after it
  const nth = (N, mod, done) => {
    let n = 0;
    on('pre', (w, st) => (n === N - 1 && mod ? mod(st) : null));
    on('fired', (w, st, ok) => { if (!ok) return; if (n === N - 1) { n = 0; done?.(st, w); } else n++; });
  };
  // Every N hits' worth of the weapon's damage: fn(e, st). A hit counts by its size (a splash for 40% of
  // the weapon's damage is 0.4 of a hit), so it works the same for single arrows, sweeps and meteors.
  const part = (dmg, st) => Math.min(1, dmg / st.dmg);
  const nthHit = (N, fn) => {
    let n = 0, t = 0;
    on('hit', (e, res, dmg, st) => { n += part(dmg, st); if (e.dead || n < N || g.time < t) return; n = 0; t = g.time + 0.15; fn(e, st); });
  };
  // A small shot from a set's effect (a split spark, a turret's pebble): it seeks t and hits plainly
  const mini = (spr, st, x, y, t, o = {}) => {
    const sp = o.speed || 200, w = o.spread ?? 0.5, a = Math.atan2(t.y - y, t.x - x) + rand(-w, w);
    const p = g.spawnProjectile({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 3, dmg: o.dmg ?? st.dmg * 0.5, pierce: 0, life: o.life || 1.6,
      spr, scale: o.scale ?? 0.7, src: W().id, homing: o.homing ?? 9, target: t, glow: o.glow, knock: 10,
    });
    p.fxMini = true;
    p.hit = (g2, q, e) => { const r = wHit(g2, e, q.dmg, st, { small: true, fx: true }); o.onHit?.(e); return r; };
    return p;
  };
  // Something that drops out of the sky onto (x, y), or onto a foe as it moves: land(x, y) when it arrives
  const fall = (x, y, pic, land, t = null) => {
    const T = 0.34;
    g.spawnProjectile({
      x, y, r: 0, dmg: 0, life: T, noHit: true, z: 150,
      update(g2, p) { if (t && !t.dead) { p.x = t.x; p.y = t.y; } p.z = 150 * (1 - p.age / T); return true; },
      draw(ctx, p, cam) {
        // a ring on the ground closes in on where it will land; the thing itself comes down at a slant
        const gx = Math.round(p.x - cam.x), gy = Math.round(p.y - cam.y), r = 5 + 12 * (p.z / 150);
        ctx.save(); ctx.globalAlpha = 0.6; ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(gx, gy, r, r * 0.55, 0, 0, TAU); ctx.stroke(); ctx.restore();
        pic(ctx, gx + Math.round(p.z * 0.35), gy - 6 - Math.round(p.z));
      },
      onExpire(g2, p) { land(p.x, p.y); },
    });
  };
  const starPic = (ctx, x, y) => {
    ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffe9a0';
    for (let i = 1; i <= 5; i++) ctx.fillRect(x + i * 3 - 1, y - i * 8 - 2, 3, 8); // its tail, back up the way it came
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#c8922a'; ctx.fillRect(x - 2, y - 9, 5, 19); ctx.fillRect(x - 9, y - 2, 19, 5); ctx.fillRect(x - 4, y - 4, 9, 9);
    ctx.fillStyle = '#ffd24a'; ctx.fillRect(x - 1, y - 8, 3, 17); ctx.fillRect(x - 8, y - 1, 17, 3); ctx.fillRect(x - 3, y - 3, 7, 7);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y - 2, 5, 5);
  };
  // a diving falcon, seen from above: dark-edged pale wings swept back, a gold beak pointing down
  const birdPic = (ctx, x, y) => {
    ctx.fillStyle = '#2b3a5a';
    ctx.fillRect(x - 3, y - 8, 7, 15); ctx.fillRect(x - 8, y - 10, 5, 8); ctx.fillRect(x + 4, y - 10, 5, 8); ctx.fillRect(x - 12, y - 13, 5, 6); ctx.fillRect(x + 8, y - 13, 5, 6);
    ctx.fillStyle = '#c8dcff';
    ctx.fillRect(x - 2, y - 7, 5, 12); ctx.fillRect(x - 7, y - 9, 4, 6); ctx.fillRect(x + 4, y - 9, 4, 6); ctx.fillRect(x - 11, y - 12, 4, 4); ctx.fillRect(x + 8, y - 12, 4, 4);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 2, 3, 5);
    ctx.fillStyle = '#ffd84a'; ctx.fillRect(x - 1, y + 5, 3, 3);
  };
  // A falling star: k times the weapon's damage to everything within R of where it lands
  const star = (x, y, k = 3, R = 28, t = null) => fall(x, y, starPic, (lx, ly) => {
    tally('star');
    around(lx, ly, R, (e) => hitW(e, k, { knock: 80, ...away(lx, ly, e) }));
    g.addEffect({ type: 'explosion', x: lx, y: ly, R, life: 0.3, color: '#a8c8ff', glow: true });
    g.particles.burst(lx, ly - 4, { n: 14, colors: ['#ffe9a0', '#ffffff', '#a8c8ff'], speed: 90, life: 0.5 });
    g.shake(2, 0.12); Audio.play('explode');
  }, t);
  // A blast of k times the weapon's damage around (x, y)
  const blast = (x, y, R, k, color) => {
    around(x, y, R, (e) => hitW(e, k, { knock: 60, ...away(x, y, e) }));
    g.addEffect({ type: 'explosion', x, y, R, life: 0.3, color, glow: true });
  };

  const SETS = {
    // ============================================================ You: the bow
    ranger(L) {
      on('wstat', (w) => { w.speed *= 1.25; w.range *= 1.25; });
      if (L < 2) return;
      on('hit', (e) => { if (!e.dead) { if (!(e.fxMark > g.time)) { ring(e.x, e.y, 9, '#7fd07a', 0.25); tally('mark'); } e.fxMark = g.time + 4; pip(e, '#7fd07a', 4); } });
      on('dmgK', (e, o) => (o.pet && e.fxMark > g.time ? 1.2 : 1));
      if (L >= 3) on('kill', (e) => { if (e.fxMark > g.time) { buff('pack', 'haste', 0.2, 4); tally('pack'); } });
    },
    gale(L) {
      on('cdK', () => (P().moving ? 0.87 : 1));
      if (L < 2) return;
      fx.dashK *= 0.75;
      on('dash', () => {
        const p = P();
        ring(p.x, p.y, 50, '#d8f2ff');
        around(p.x, p.y, 46, (e) => { hitW(e, 1, { knock: 240, ...away(p.x, p.y, e) }); tally('gust'); });
        if (L >= 3) s.slip = g.time + 2;
      });
      if (L >= 3) on('pre', (w, st) => (g.time < s.slip ? (tally('slip'), { ...st, pierce: Infinity }) : null));
    },
    prospector(L) {
      on('kill', (e, o) => {
        if (!mine(o) || Math.random() >= (s.blasting && L >= 3 ? 0.12 : 0.03)) return;
        const m = choice(['wood', 'stone', 'clay']);
        g.addMats({ [m]: 1 }); tally('paydirt');
        g.particles.text(e.x, e.y - 14, `+${m[0].toUpperCase()}${m.slice(1)}`, '#d8a868');
      });
      if (L < 2) return;
      nth(6, null, () => { s.bolt = true; });
      on('hit', (e) => {
        if (!s.bolt) return;
        s.bolt = false; s.blasting = true; tally('bolt');
        blast(e.x, e.y, L >= 3 ? 39 : 26, 1.2, '#f6a03a');
        s.blasting = false;
        g.shake(2, 0.12); Audio.play('explode');
      });
    },
    hawkeye(L) {
      if (L >= 2) on('dmgK', (e, o) => {
        if (o.src !== 'main') return 1;
        const p = P(), d = Math.hypot(e.x - p.x, e.y - p.y);
        return 1 + 0.4 * Math.max(0, Math.min(1, (d - 60) / 160));
      });
      if (L >= 3) {
        on('hit', (e, res) => { if (res.crit && !e.dead) { e.fxWeak = g.time + 4; pip(e, '#ffd84a', 4); tally('weak'); } });
        on('critAdd', (e, o) => (o.pet && e.fxWeak > g.time ? 0.4 : 0));
      }
    },
    nightstalker(L) {
      on('dmgK', (e, o) => (o.src === 'main' && e.hp >= e.maxHp ? 1.4 : 1));
      if (L >= 2) {
        on('dmgK', (e, o) => (o.src === 'main' ? 1 + 0.25 * (g.dark?.sunset || 0) : 1));
        on('speedK', () => 1 + 0.1 * (g.dark?.sunset || 0));
      }
      if (L >= 3) {
        on('dash', () => { s.shadow = true; g.particles.burst(P().x, P().y - 8, { n: 10, colors: ['#7a48c8', '#b070ff'], speed: 40, life: 0.4 }); });
        on('pre', (w, st) => (s.shadow ? (tally('shadow'), { ...st, dmg: st.dmg * 1.5, critAdd: (st.critAdd || 0) + 1 }) : null));
        on('fired', (w, st, ok) => { if (ok) s.shadow = false; });
      }
    },
    skyfall(L) {
      every(() => (L >= 2 ? 6 : 10), () => { const p = P(), t = strongest(g, p.x, p.y, 200); if (t) star(t.x, t.y, 3, 28, t); }, 200);
      if (L < 3) return;
      on('fired', (w, st, ok, charged) => { if (charged) s.star = true; });
      on('hit', (e, res, dmg, st) => { if (s.star && st.charged) { s.star = false; star(e.x, e.y); tally('starArrow'); } });
    },
    // ============================================================ Rowan: the boomerang
    scout(L) {
      on('wstat', (w) => { w.spd *= 1.2; });
      if (L < 2) return;
      on('fired', (w, st, ok) => { if (ok) s.catches = 0; });
      on('caught', () => {
        const w = W();
        if ((s.catches = (s.catches || 0) + 1) <= 2) { w.cd = Math.max(0.05, w.cd - 0.1 * ST().cd * P().stats.cooldown); tally('catch'); }
        if (L >= 3) buff('signal', 'haste', 0.15, 3);
      });
    },
    whirlwind(L) {
      on('wstat', (w) => { w.r *= 1.25; w.scale *= 1.25; });
      if (L < 2) return;
      on('fired', (w, st, ok) => { if (ok) s.spin = 0; });
      on('hit', () => { s.spin = (s.spin || 0) + 1; });
      on('dmgK', (e, o) => (o.src === 'main' ? 1 + Math.min(0.5, 0.05 * (s.spin || 0)) : 1));
      if (L >= 3) {
        const flying = () => !!W().live?.some((p) => !p.dead);
        on('hurtK', () => (flying() ? 0.8 : 1));
        on('speedK', () => (flying() ? 1.1 : 1));
      }
    },
    treasure(L) {
      let t = 0;
      on('tick', (dt) => {
        if ((t -= dt) > 0) return;
        t = 0.1;
        const rangs = W().live?.filter((p) => !p.dead);
        if (!rangs?.length) return;
        for (const k of g.pickups) {
          if (k.magnet || k.taken || k.t < 0.25 || !PULLED[k.kind]) continue;
          for (const p of rangs) if (dist2(k.x, k.y, p.x, p.y) < 18 * 18) { k.magnet = true; tally('fetch'); break; }
        }
      });
      if (L >= 2) fx.chestCoinK *= 1.5;
      if (L < 3) return;
      on('chest', () => {
        if ((s.fever || 0) >= 8) return;
        s.fever = (s.fever || 0) + 1;
        buff('fever', 'dmg', 0.05 * s.fever);
        say(`Treasure Fever +${5 * s.fever}%`, '#ffd84a');
      });
      on('dmgK', (e, o) => (o.src === 'main' ? 1 + 0.05 * (s.fever || 0) : 1));
    },
    falcon(L) {
      on('fired', (w, st, ok) => { if (ok) s.talon = true; });
      on('hitX', (e, st, x) => { if (s.talon) { s.talon = false; x.critAdd = (x.critAdd || 0) + 1; tally('talon'); } });
      if (L >= 2) on('wstat', (w) => { w.critMultAdd = (w.critMultAdd || 0) + 0.4; });
      if (L >= 3) every(8, () => {
        const p = P(), t = strongest(g, p.x, p.y, 220);
        if (!t) return;
        fall(t.x, t.y, birdPic, (x, y) => {
          const e = !t.dead ? t : g.nearestEnemy(x, y, 30, live);
          if (e) { hitW(e, 4, { stun: 1, small: false }); tally('dive'); }
          g.addEffect({ type: 'flashring', x, y, R: 16, life: 0.25, color: '#c8dcff' });
          g.particles.burst(x, y - 6, { n: 10, colors: ['#c8dcff', '#ffffff'], speed: 60, life: 0.45, up: 10 });
          Audio.play('hit');
        }, t);
      });
    },
    sabertooth(L) {
      const bleeders = new Set();
      let t = 0;
      on('hit', (e, res) => {
        if (e.dead || !(res.dmg > 0)) return;
        const b = (e.fxBleed ||= { dps: 0, until: 0 });
        b.dps = Math.max(b.until > g.time ? b.dps : 0, res.dmg * 0.15); b.until = g.time + 3;
        if (bleeders.size < 250) bleeders.add(e);
        pip(e, '#e04848', 3);
      });
      on('tick', (dt) => {
        if ((t -= dt) > 0) return;
        t = 0.5;
        for (const e of bleeders) {
          if (e.dead || e.fxBleed.until <= g.time) { bleeders.delete(e); continue; }
          g.damageEnemy(e, e.fxBleed.dps * 0.5, { raw: true, small: true, silent: true, fxDot: true }); tally('bleed');
        }
      });
      if (L >= 2) on('dmgK', (e, o) => (o.pet && e.fxBleed?.until > g.time ? 1.25 : 1));
      if (L >= 3) {
        on('kill', (e) => { if (e.fxBleed?.until > g.time) { s.frenzy = Math.min(8, (g.time < s.frenzyT ? s.frenzy : 0) + 1); s.frenzyT = g.time + 5; } });
        on('cdK', () => (g.time < s.frenzyT ? 1 / (1 + 0.05 * s.frenzy) : 1));
      }
    },
    sunwheel(L) {
      on('caught', () => { P().heal(1); for (const p of pets()) p.heal(p.maxHp * 0.01); tally('warmth'); });
      if (L >= 2) nthHit(8, (e) => { blast(e.x, e.y, 30, 1.5, '#ffd24a'); Audio.play('explode'); tally('flare'); });
      if (L >= 3) on('tick', () => {
        const rangs = W().live;
        if (rangs) for (const p of rangs) if (p.charged && !p.dead) dropTrail(p, 16, (x, y) => { fireZone(g, x, y, 10, 2.5, ST().dmg * 0.25); tally('scorch'); });
      });
    },
    // ============================================================ Bram: the spear
    farmhand(L) {
      on('wstat', (w) => { w.reach *= 1.15; if (w.sweepR) w.sweepR *= 1.15; });
      if (L >= 2) on('petHurtK', (pet) => (dist2(pet.x, pet.y, P().x, P().y) < 70 * 70 ? 0.8 : 1));
      if (L >= 3) {
        nth(4, (st) => ({ ...st, dmg: st.dmg * 1.5 }), () => { s.hay = g.time + 0.6; tally('hay'); });
        on('hitX', (e, st, x) => { if (g.time < s.hay) x.stun = Math.max(x.stun || 0, 0.8); });
      }
    },
    stampede(L) {
      if (L >= 2) fx.dashK *= 0.75;
      on('dash', () => { s.ram = new Set(); s.ramN = 0; });
      on('tick', () => {
        const p = P();
        if (!(p.dashT > 0) || !s.ram) return;
        around(p.x, p.y, 20, (e) => {
          if (s.ram.has(e)) return;
          s.ram.add(e); tally('ram');
          hitW(e, 1.5, { knock: 220, small: false, ...away(p.x, p.y, e) });
          if (++s.ramN === 3 && L >= 3) { buff('stampede', 'haste', 0.25, 4); ring(p.x, p.y, 60, '#ff9a7a', 0.5); tally('stampede'); }
        });
      });
    },
    harvest(L) {
      fx.berryK *= 1.4;
      if (L < 2) return;
      nth(3, null, () => {
        const p = P(), R = 62;
        g.addEffect({ type: 'slash', color: '#ffe07a', x: p.x, y: p.y, a: 0, R, arc: TAU, life: 0.25, follow: true });
        s.reap = true; tally('reap');
        around(p.x, p.y, R, (e) => hitW(e, 0.6, { knock: 60, ...away(p.x, p.y, e) }));
        s.reap = false;
      });
      if (L >= 3) on('kill', (e) => { if (s.reap) { g.gainCoins(2 * (e.boss ? 50 : e.elite ? 10 : 1), e.x, e.y - 16, false); tally('bounty'); } });
    },
    bulwark(L) {
      s.block = 3; // (the run starts with the shield nearly ready)
      const ready = () => g.time >= s.block;
      on('block', () => {
        if (!ready()) return false;
        const p = P();
        s.block = g.time + (L >= 3 ? 6 : 10);
        g.addEffect({ type: 'flashring', x: p.x, y: p.y, R: 18, life: 0.25, color: '#b8d0f0' });
        say('Block!', '#b8d0f0'); tally('block');
        Audio.play('hit');
        if (L >= 2) { around(p.x, p.y, 50, (e) => hitW(e, 2.5, { stun: 1, knock: 160, small: false, ...away(p.x, p.y, e) })); ring(p.x, p.y, 52, '#b8d0f0'); g.shake(2, 0.12); }
        return true;
      });
      if (L >= 3) on('petHurtK', () => (ready() ? 0.8 : 1));
      // the shield, while it is ready: a pale ring at the hero's feet
      on('draw', (ctx, cam) => {
        if (!ready()) return;
        const p = P(), x = Math.round(p.x - cam.x), y = Math.round(p.y - cam.y);
        ctx.save(); ctx.globalAlpha = 0.45 + 0.15 * Math.sin(g.time * 4); ctx.strokeStyle = '#b8d0f0'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(x, y, 11, 4.5, 0, 0, TAU); ctx.stroke(); ctx.restore();
      });
    },
    warlord(L) {
      on('kill', (e, o) => { if (mine(o)) { s.lust = Math.min(10, (g.time < s.lustT ? s.lust : 0) + 1); s.lustT = g.time + 6; } });
      on('dmgK', (e, o) => (o.src === 'main' && g.time < s.lustT ? 1 + 0.03 * s.lust : 1));
      if (L >= 2) every(20, () => { const p = P(); buff('cry', 'dmg', 0.25, 6); tally('cry'); ring(p.x, p.y, 70, '#ff6a5a', 0.6); ring(p.x, p.y, 40, '#ff6a5a', 0.4); Audio.play('swing'); });
      if (L >= 3) on('dmgK', (e, o) => (o.src === 'main' && e.hp < e.maxHp * 0.3 ? 2 : 1));
    },
    titan(L) {
      on('dmgK', (e, o) => (o.src === 'main' ? 1 + Math.min(0.4, Math.max(0, (P().stats.maxHp - 100) / 1000)) : 1));
      if (L < 3) return;
      on('fired', (w, st, ok, charged) => {
        if (!charged) return;
        tally('quake');
        const p = P(), x = p.x, y = p.y;
        ringWave(g, x, y, 12, 85, 0.3, (e) => { if (live(e)) hitW(e, 1, { stun: 1, knock: 60, ...away(x, y, e) }); }, '#ffb040');
        g.shake(4, 0.25);
      });
    },
    // ============================================================ Lyra: the wand
    apprentice(L) {
      on('wstat', (w) => { w.speed *= 1.25; w.blastR *= 1.15; });
      if (L < 2) return;
      const k = L >= 3 ? 2 : 1;
      const SPELLS = [
        (e, st) => { fireZone(g, e.x, e.y, 18, 3, st.dmg * 0.5 * k); g.addEffect({ type: 'explosion', x: e.x, y: e.y, R: 18, life: 0.25, color: '#f6702a' }); },
        (e) => { around(e.x, e.y, 28, (o) => tryFreeze(o, k)); g.addEffect({ type: 'flashring', x: e.x, y: e.y, R: 24, life: 0.3, color: '#8fd8ff' }); },
        (e, st) => { g.strike(e.x, e.y); around(e.x, e.y, 30, (o) => g.damageEnemy(o, st.dmg * k, { element: 'light', small: true, silent: true })); },
      ];
      nthHit(L >= 3 ? 6 : 10, (e, st) => { choice(SPELLS)(e, st); tally('spell'); });
    },
    moon(L) {
      const night = () => g.dark?.sunset || 0;
      on('petHurtK', () => 1 - 0.15 * night());
      if (L < 2) return;
      let t = 0;
      on('hit', () => {
        if (g.time < t) return;
        const pet = mostHurtPet(g);
        if (!pet || pet.hp >= pet.maxHp) return;
        t = g.time + 0.2; tally('moon');
        pet.heal(pet.maxHp * 0.01 * (L >= 3 && night() > 0.5 ? 2 : 1));
        g.particles.add({ x: pet.x + rand(-4, 4), y: pet.y - 10, vx: 0, vy: -18, life: 0.5, color: '#c8d8ff', size: 2 });
      });
      if (L >= 3) on('dmgK', (e, o) => (o.src === 'main' ? 1 + 0.25 * night() : 1));
    },
    starlit(L) {
      if (L >= 2) on('levelUp', () => {
        const p = P(), st = ST();
        const foes = g.randomEnemies(p.x, p.y, 230, 8).filter(live);
        tally('wish');
        for (const t of foes) mini('p_imp_fire', st, p.x, p.y, t, { dmg: st.dmg, scale: 0.9, glow: '#ffc8e8', spread: 1.2 });
        g.particles.burst(p.x, p.y - 10, { n: 16, colors: ['#ffb8e0', '#ffffff', '#ffe07a'], speed: 70, life: 0.6, up: 20 });
      });
      if (L >= 3) on('kill', (e, o) => {
        if (!mine(o)) return;
        const v = e.xp * 0.25, n = Math.floor(v) + (Math.random() < v % 1 ? 1 : 0);
        if (n > 0) { g.dropXp(e.x, e.y - 4, n); tally('stardust'); }
      });
    },
    storm(L) {
      nthHit(8, (e, st) => {
        tally('static');
        g.strike(e.x, e.y);
        around(e.x, e.y, 22, (o) => g.damageEnemy(o, st.dmg * 1.2, { element: 'light', small: true, silent: true }));
        if (L >= 2 && !e.dead) chainBolt(g, e, st.dmg * 0.6, 2, 90, st);
      });
      if (L < 3) return;
      every(20, () => { const p = P(); s.storm = g.time + 5; ring(p.x, p.y, 90, '#a8c8ff', 0.6); Audio.play('boss'); }, 170);
      let t = 0;
      on('tick', (dt) => {
        if (!(g.time < s.storm) || (t -= dt) > 0) return;
        t = 0.5;
        const p = P(), e = g.randomEnemies(p.x, p.y, 170, 1).find(live);
        if (!e) return;
        g.strike(e.x, e.y); tally('storm');
        around(e.x, e.y, 18, (o) => g.damageEnemy(o, ST().dmg * 0.8, { element: 'light', small: true, silent: true }));
      });
    },
    prism(L) {
      const dazzle = L >= 2 ? (f) => { if (!f.dead) { f.fxDazzle = g.time + 3; pip(f, '#ff9af0', 3); tally('dazzle'); } } : null;
      let n = 0, t = 0;
      on('hit', (e, res, dmg, st) => {
        if (Math.random() >= 0.2 * part(dmg, st)) return;
        if (g.time > t) { t = g.time + 0.3; n = 0; }
        if (++n > 3) return; // (a blast that hits a whole crowd at once splits a few times, not thirty)
        for (const o of g.randomEnemies(e.x, e.y, 120, 2, e).filter(live)) { mini('p_imp_fire', st, e.x, e.y, o, { dmg: dmg * 0.5, glow: '#ffffff', onHit: dazzle }); tally('split'); }
      });
      if (L >= 2) on('dmgK', (e) => (e.fxDazzle > g.time ? 1.15 : 1));
      if (L >= 3) on('kill', (e, o) => {
        if (!mine(o) || s.burst || g.time < s.burstT) return;
        s.burst = true; s.burstT = g.time + 0.25; tally('rainbow');
        around(e.x, e.y, 32, (f) => hitW(f, 0.4));
        s.burst = false;
        g.addEffect({ type: 'flashring', x: e.x, y: e.y, R: 22, life: 0.25, color: choice(RAINBOW) });
      });
    },
    aurora(L) {
      every(() => (L >= 2 ? 6 : 8), () => {
        const p = P(), x = p.x, y = p.y;
        ringWave(g, x, y, 10, 95, 0.5, (e) => { if (live(e)) hitW(e, 1, { chill: 2, knock: 30, ...away(x, y, e) }); }, '#8affd8');
        ring(x, y, 80, '#ff9ae0', 0.7); tally('veil');
        if (L < 2) return;
        let any = false;
        for (const q of pets()) if (dist2(q.x, q.y, x, y) < 95 * 95) { any = true; q.heal(q.maxHp * 0.06); g.particles.burst(q.x, q.y - 8, { n: 6, colors: ['#8affd8', '#ff9ae0'], speed: 26, life: 0.5, up: 20 }); }
        if (any) buff('aurora', 'haste', 0.2, 4);
      }, 150);
      if (L < 3) return;
      on('fired', (w, st, ok, charged) => { if (charged) s.great = true; });
      on('hit', (e, res, dmg, cst) => {
        if (!s.great || !cst.charged) return;
        s.great = false; tally('great');
        const st = ST();
        for (const t of g.randomEnemies(e.x, e.y, 140, 6, e).filter(live)) mini('p_imp_fire', st, e.x, e.y, t, { dmg: st.dmg * 0.75, glow: '#8affd8', spread: 1 });
        g.addEffect({ type: 'flashring', x: e.x, y: e.y, R: 20, life: 0.25, color: '#8affd8' });
      });
    },
    // ============================================================ Pip: the sling
    tamer(L) {
      const again = (pet) => { for (const a of pet.attacks) a.cd = 0; };
      on('kill', (e, o) => {
        if (!mine(o) || g.time < s.praise) return;
        let best = null, bd = Infinity;
        for (const p of pets()) { const d = dist2(p.x, p.y, e.x, e.y); if (d < bd) { bd = d; best = p; } }
        if (!best) return;
        s.praise = g.time + 1; tally('praise');
        again(best);
        g.particles.burst(best.x, best.y - 14, { n: 5, colors: ['#ffe07a', '#ffffff'], speed: 24, life: 0.4, up: 16 });
      });
      if (L >= 2) every(12, () => { const p = P(); for (const q of pets()) again(q); tally('whistle'); ring(p.x, p.y, 60, '#7fd07a', 0.5); ring(p.x, p.y, 34, '#ffffff', 0.35); Audio.play('swing'); });
      if (L >= 3) { let t = 0; on('tick', (dt) => { if ((t -= dt) > 0) return; t = 0.5; buff('friends', 'dmg', 0.06 * pets().length); }); }
    },
    nurture(L) {
      on('berry', (n) => { for (const p of pets()) p.heal(p.maxHp * 0.02 * n); tally('berry'); });
      if (L >= 2) {
        nth(6, null, () => { s.berry = true; });
        on('hit', () => {
          if (!s.berry) return;
          s.berry = false;
          const pet = mostHurtPet(g);
          if (!pet) return;
          pet.heal(pet.maxHp * 0.08); tally('berryShot');
          g.particles.burst(pet.x, pet.y - 8, { n: 10, colors: ['#ff5a8a', '#ffb8d8', '#ffffff'], speed: 30, life: 0.6, up: 24 });
        });
      }
      if (L >= 3) on('petFaint', (pet) => {
        if (pet.fxCared) return;
        pet.fxCared = true;
        const run = g.runId;
        g.after(10, (g2) => {
          if (g2.runId !== run || !pet.fainted || pet.carriedBy || !g2.player?.pets.includes(pet)) return;
          pet.fainted = false; pet.hp = pet.maxHp * 0.4; pet.faintT = 0; tally('care');
          g2.player.recompute(); g2.applyTeamPassives?.();
          g2.feed(`${pet.name} is back on its feet!`, '#ffb8d8');
          g2.particles.burst(pet.x, pet.y - 8, { n: 20, colors: ['#ffb8d8', '#ffffff'], speed: 60, life: 0.6, up: 20 });
          Audio.play('heal');
        });
      });
    },
    lucky(L) {
      on('hit', (e, res, dmg, st) => { if (Math.random() < 0.05 * part(dmg, st)) { g.gainCoins(2, e.x, e.y - 12, true); tally('lucky'); } });
      if (L >= 3) on('kill', (e, o) => {
        if (!mine(o) || Math.random() >= 1 / 30) return;
        g.gainCoins(10, e.x, e.y - 14, true); tally('jackpot');
        g.particles.burst(e.x, e.y - 6, { n: 18, colors: ['#ffd040', '#ffe07a', '#ffffff'], speed: 80, life: 0.6, up: 30 });
        Audio.play('coin');
      });
    },
    wildheart(L) {
      if (L >= 2) on('wild', () => {
        if ((s.call || 0) >= 5) return;
        s.call = (s.call || 0) + 1;
        buff('call', 'dmg', 0.08 * s.call); tally('call');
        say(`Call of the Wild +${8 * s.call}%`, '#a8e070');
      });
      if (L >= 3) nthHit(6, (e, st) => {
        const spikes = Array.from({ length: 34 }, () => { const a = rand(0, TAU), d = Math.sqrt(Math.random()) * 21; return [Math.cos(a) * d, Math.sin(a) * d * 0.8, 0.4 + 0.6 * Math.random()]; });
        tally('bramble');
        g.spawnZone({
          kind: 'thorns', x: e.x, y: e.y, r: 22, life: 4, tick: 0.5, firstTick: 0.1, spikes,
          onTick: (g2, z) => around(z.x, z.y, z.r, (o) => { g2.damageEnemy(o, st.dmg * 0.4, { small: true, silent: true, noCrit: true }); o.chill = Math.max(o.chill, 0.7); }),
        });
      });
    },
    tinkerer(L) {
      nth(4, null, (st, w) => g.after(0.12, (g2) => { if (g2.player?.main === w && g2.mode === 'world') { TREES[w.id].fire(g2, w, st); tally('double'); } }));
      if (L < 2) return;
      const fast = L >= 3;
      every(18, () => {
        const p = P(), st = ST();
        ring(p.x + 16, p.y + 6, 16, '#e0b060', 0.3); tally('turret');
        s.turret = g.spawnProjectile({
          x: p.x + 16, y: p.y + 6, r: 0, dmg: 0, life: 8, noHit: true, z: 0, cd: 0.4, aim: 0,
          update(g2, q, dt) {
            if ((q.cd -= dt) > 0) return true;
            const t = g2.nearestEnemy(q.x, q.y, 170, live);
            q.cd = t ? (fast ? 0.25 : 0.5) : 0.2;
            if (t) { q.aim = Math.atan2(t.y - q.y, t.x - q.x); mini('p_pebble', st, q.x, q.y - 10, t, { dmg: st.dmg * 0.6, speed: 260, life: 0.9, homing: 0, spread: 0.05, scale: 0.8 }); tally('turretShot'); }
            return true;
          },
          draw(ctx, q, cam) {
            const x = Math.round(q.x - cam.x), y = Math.round(q.y - cam.y);
            ctx.save();
            if (q.maxLife - q.age < 1.5 && Math.floor(q.age * 8) % 2) ctx.globalAlpha = 0.45; // it blinks as it runs down
            ctx.fillStyle = 'rgba(26,42,16,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 9, 3, 0, 0, TAU); ctx.fill();
            // three legs, a brass box with a steel band and a blinking light, and a barrel that turns to its target
            ctx.fillStyle = '#2b1d24'; ctx.fillRect(x - 8, y - 4, 3, 6); ctx.fillRect(x + 6, y - 4, 3, 6); ctx.fillRect(x - 1, y - 3, 3, 6); ctx.fillRect(x - 7, y - 16, 15, 13);
            ctx.fillStyle = '#8a6a3a'; ctx.fillRect(x - 7, y - 3, 1, 4); ctx.fillRect(x + 7, y - 3, 1, 4); ctx.fillRect(x, y - 2, 1, 4);
            ctx.fillStyle = '#e0b060'; ctx.fillRect(x - 6, y - 15, 13, 11);
            ctx.fillStyle = '#ffd88a'; ctx.fillRect(x - 6, y - 15, 13, 2);
            ctx.fillStyle = '#8aa0c0'; ctx.fillRect(x - 6, y - 8, 13, 2);
            ctx.fillStyle = Math.floor(q.age * 4) % 2 ? '#ff5a5a' : '#ffe07a'; ctx.fillRect(x - 1, y - 13, 3, 3);
            ctx.translate(x, y - 10); ctx.rotate(q.aim);
            ctx.fillStyle = '#2b1d24'; ctx.fillRect(3, -3, 12, 6); ctx.fillStyle = '#c8d0d8'; ctx.fillRect(4, -2, 10, 4); ctx.fillStyle = '#ffffff'; ctx.fillRect(4, -2, 10, 1);
            ctx.restore();
          },
        });
      });
      if (fast) on('cdK', () => (s.turret && !s.turret.dead ? 1 / 1.2 : 1));
    },
    wildking(L) {
      let t = 0;
      on('tick', (dt) => { if ((t -= dt) > 0) return; t = 0.5; s.court = pets().length; });
      on('dmgK', (e, o) => (o.src === 'main' ? 1 + 0.08 * (s.court || 0) : 1));
      if (L >= 2) on('kill', (e) => {
        if (!e.elite && !e.boss) return;
        tally('kingsCall');
        for (const p of pets()) { p.heal(p.maxHp * 0.2); g.particles.burst(p.x, p.y - 8, { n: 8, colors: ['#8affa0', '#ffffff'], speed: 26, life: 0.6, up: 22 }); }
      });
      if (L < 3) return;
      on('fired', (w, st, ok, charged) => { if (charged) s.roar = true; });
      on('hit', (e, res, dmg, st) => {
        if (!s.roar || !st.charged) return;
        s.roar = false; tally('roar');
        buff('roar', 'haste', 0.2, 4);
        const h = P();
        ring(h.x, h.y, 60, '#ffcf40', 0.5);
        for (const q of pets()) g.particles.burst(q.x, q.y - 10, { n: 8, colors: ['#ffcf40', '#ffffff'], speed: 34, life: 0.5, up: 18 });
      });
    },
  };

  let any = false;
  for (const set of HERO_SETS[hero] || []) {
    const n = Meta.setWorn(hero, set), L = SET_PIECES.filter((p) => n >= p).length;
    if (!L || !SETS[set]) continue;
    fx.sets[set] = L; any = true;
    SETS[set](L);
  }
  if (!any) return null;

  const run = (k) => { const L = H[k]; return L ? (...a) => { for (const f of L) f(...a); } : null; };
  const mul = (k) => { const L = H[k]; return L ? (...a) => { let v = 1; for (const f of L) v *= f(...a); return v; } : null; };
  for (const k of ['wstat', 'fired', 'hitX', 'hit', 'kill', 'dash', 'caught', 'berry', 'chest', 'wild', 'levelUp', 'petFaint', 'tick', 'draw']) fx[k] = run(k);
  for (const k of ['dmgK', 'cdK', 'hurtK', 'speedK', 'petHurtK']) fx[k] = mul(k);
  fx.pre = H.pre ? (w, st) => { let v = st; for (const f of H.pre) v = f(w, v) || v; return v; } : null;
  fx.critAdd = H.critAdd ? (e, o) => { let v = 0; for (const f of H.critAdd) v += f(e, o); return v; } : null;
  fx.block = H.block ? (d) => H.block.some((f) => f(d)) : null;
  return fx;
}
