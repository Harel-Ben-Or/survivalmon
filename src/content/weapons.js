// Auto-firing weapons. Each has per-level stats and a fire() or update() behaviour.
import { TAU, rand, choice } from '../core/util.js';
import { Audio } from '../core/audio.js';
import { ICON, SPR } from '../gfx/assets.js';
import { snap } from '../gfx/art.js';

function fan(base, n, step) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(base + (i - (n - 1) / 2) * step);
  return out;
}

export const WEAPONS = {
  bow: {
    name: 'Hunter Bow', icon: 'bow', element: 'phys', max: 5,
    desc: 'Fires arrows at the nearest foe.',
    stats: (L) => ({ dmg: 10 + 3 * L, cd: +(0.95 - 0.07 * L).toFixed(2), count: 1 + Math.floor((L - 1) / 2), pierce: L >= 4 ? 1 : 0 }),
    labels: { dmg: 'Damage', cd: 'Cooldown', count: 'Arrows', pierce: 'Pierce' },
    fire(g, w, st) {
      const P = g.player, S = P.stats;
      const t = g.nearestEnemy(P.x, P.y, 250);
      if (!t) return false;
      let pierce = st.pierce, speed = 240 * S.projSpeed;
      if (g.combo('windarcher')) { pierce += 2; speed *= 1.5; }
      const base = Math.atan2(t.y - P.y, t.x - P.x);
      for (const a of fan(base, st.count + S.amount, 0.13)) {
        g.spawnProjectile({ x: P.x, y: P.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 4, dmg: st.dmg, pierce, life: 1.3, spr: 'p_arrow', rot: a, src: 'bow', knock: 50 });
      }
      Audio.play('shoot');
    },
  },

  pitchfork: {
    name: 'Pitchfork', icon: 'pitchfork', element: 'phys', max: 5,
    desc: 'Thrusts forward, piercing everything in a line.',
    stats: (L) => ({ dmg: 15 + 5 * L, cd: +(1.15 - 0.07 * L).toFixed(2), range: 34 + 5 * L, count: L >= 5 ? 4 : L >= 3 ? 2 : 1 }),
    labels: { dmg: 'Damage', cd: 'Cooldown', range: 'Reach', count: 'Directions' },
    fire(g, w, st) {
      const P = g.player, S = P.stats;
      const n = st.count + S.amount;
      const t = g.nearestEnemy(P.x, P.y, 90);
      const base = t ? Math.atan2(t.y - P.y, t.x - P.x) : P.faceAngle;
      const bulwark = g.combo('bulwark');
      for (let i = 0; i < n; i++) {
        const a = base + (i * TAU) / n;
        const range = st.range * S.area;
        g.spawnProjectile({
          x: P.x, y: P.y, r: 7 * S.area, dmg: st.dmg, pierce: Infinity, life: 0.24, src: 'pitchfork', rot: a,
          knock: bulwark ? 260 : 120, stun: bulwark ? 0.5 : 0, z: 6,
          update(g2, p) {
            const k = 1 - Math.pow(1 - Math.min(1, p.age / p.maxLife), 3);
            p.x = g2.player.x + Math.cos(a) * range * k;
            p.y = g2.player.y + Math.sin(a) * range * k;
            return true;
          },
          draw(ctx, p, cam) {
            const P2 = g.player;
            ctx.save();
            ctx.translate(snap(p.x - cam.x), snap(p.y - cam.y - 7));
            ctx.rotate(a + Math.PI / 4);
            ctx.drawImage(ICON.pitchfork, -12, -4);
            ctx.restore();
            void P2;
          },
        });
      }
      Audio.play('swing');
    },
  },

  emberwand: {
    name: 'Ember Wand', icon: 'emberwand', element: 'fire', max: 5,
    desc: 'Homing embers that burst and set foes ablaze.',
    stats: (L) => ({ dmg: 10 + 4 * L, cd: +(0.95 - 0.06 * L).toFixed(2), count: 1 + Math.floor(L / 3), burn: 3 + L }),
    labels: { dmg: 'Damage', cd: 'Cooldown', count: 'Embers', burn: 'Burn DPS' },
    fire(g, w, st) {
      const P = g.player, S = P.stats;
      const t = g.nearestEnemy(P.x, P.y, 230);
      if (!t) return false;
      const n = st.count + S.amount;
      const inferno = g.combo('inferno');
      for (let i = 0; i < n; i++) {
        const a = Math.atan2(t.y - P.y, t.x - P.x) + rand(-0.8, 0.8);
        const sp = 140 * S.projSpeed;
        g.spawnProjectile({
          x: P.x, y: P.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 4, dmg: st.dmg, pierce: 0, life: 2.2,
          spr: 'p_ember', src: 'emberwand', element: 'fire', burn: st.burn, homing: 7, target: t, glow: '#f6a03a',
          onHit(g2, p, e) {
            g2.explode(p.x, p.y, 14 * S.area, st.dmg * 0.5, { element: 'fire', burn: st.burn, small: true, exclude: e });
            if (inferno) g2.spawnFire(p.x, p.y, 14 * S.area, 2.5, st.burn);
          },
        });
      }
      Audio.play('fire');
    },
  },

  boomerang: {
    name: 'Boomerang', icon: 'boomerang', element: 'phys', max: 5,
    desc: 'Flies out and comes back, hitting all in its path.',
    stats: (L) => ({ dmg: 12 + 4 * L, cd: +(1.7 - 0.1 * L).toFixed(2), count: 1 + Math.floor((L - 1) / 2), range: 85 + 10 * L }),
    labels: { dmg: 'Damage', cd: 'Cooldown', count: 'Boomerangs', range: 'Range' },
    fire(g, w, st) {
      const P = g.player, S = P.stats;
      const t = g.nearestEnemy(P.x, P.y, 220);
      const base = t ? Math.atan2(t.y - P.y, t.x - P.x) : P.faceAngle;
      const twin = g.combo('twinfang');
      const n = st.count + S.amount + (twin ? 1 : 0);
      const acc = 420;
      const v0 = Math.sqrt(2 * acc * st.range * S.area);
      fan(base, n, twin ? Math.PI / Math.max(1, n - 1) : 0.45).forEach((a) => {
        g.spawnProjectile({
          x: P.x, y: P.y, vx: Math.cos(a) * v0, vy: Math.sin(a) * v0, r: 6 * Math.sqrt(S.area), dmg: st.dmg * (twin ? 1.3 : 1),
          pierce: Infinity, hitCd: 0.35, life: 4, spr: 'p_boomerang', spin: 18, src: 'boomerang', knock: 70,
          update(g2, p, dt) {
            const P2 = g2.player;
            const dx = P2.x - p.x, dy = P2.y - p.y, d = Math.hypot(dx, dy) || 1;
            p.vx += (dx / d) * acc * dt; p.vy += (dy / d) * acc * dt;
            if (p.age > 0.4 && d < 10) p.dead = true;
            return false;
          },
        });
      });
      Audio.play('swing');
    },
  },

  leaves: {
    name: 'Spirit Leaves', icon: 'leaves', element: 'nature', max: 5,
    desc: 'Enchanted leaves orbit around you.',
    stats: (L) => ({ dmg: 7 + 3 * L, count: 2 + L, radius: 30 + 3 * L, spin: +(2.8 + 0.2 * L).toFixed(1) }),
    labels: { dmg: 'Damage', count: 'Leaves', radius: 'Radius', spin: 'Spin' },
    update(g, w, st, dt) {
      const P = g.player, S = P.stats;
      const bramble = g.combo('bramble');
      const n = st.count + S.amount + (bramble ? 2 : 0);
      const R = st.radius * Math.sqrt(S.area);
      w.angle = (w.angle || 0) + st.spin * dt;
      w.hits = w.hits || new Map();
      w.pos = [];
      const dmg = st.dmg * (bramble ? 2 : 1);
      for (let i = 0; i < n; i++) {
        const a = w.angle + (i * TAU) / n;
        const lx = P.x + Math.cos(a) * R, ly = P.y - 4 + Math.sin(a) * R * 0.8;
        w.pos.push([lx, ly, a]);
        g.enemiesInRadius(lx, ly + 4, 7 * S.area, (e) => {
          const last = w.hits.get(e.id) ?? -9;
          if (g.time - last < 0.5) return;
          w.hits.set(e.id, g.time);
          g.damageEnemy(e, dmg, { knock: 70, fromX: P.x, fromY: P.y, src: 'leaves' });
        });
      }
      if (w.hits.size > 400) w.hits.clear();
    },
    draw(ctx, g, w, cam) {
      if (!w.pos) return;
      const big = g.combo('bramble');
      for (const [x, y, a] of w.pos) {
        ctx.save();
        ctx.translate(snap(x - cam.x), snap(y - cam.y - 4));
        ctx.rotate(a * 2);
        const sp = SPR.p_leaf;
        if (big) ctx.scale(1.5, 1.5);
        ctx.drawImage(sp.frames[0], -sp.ax, -sp.ay, sp.w, sp.h);
        ctx.restore();
      }
    },
  },

  thornaura: {
    name: 'Bramble Aura', icon: 'thornaura', element: 'nature', max: 5,
    desc: 'A ring of thorns damages nearby foes.',
    stats: (L) => ({ dmg: 4 + 2 * L, tick: +(0.5 - 0.02 * L).toFixed(2), radius: 32 + 5 * L }),
    labels: { dmg: 'Damage/tick', tick: 'Tick rate', radius: 'Radius' },
    update(g, w, st, dt) {
      const P = g.player, S = P.stats;
      w.t = (w.t ?? 0) - dt;
      w.R = st.radius * S.area;
      if (w.t > 0) return;
      w.t = st.tick;
      const frost = g.combo('frostbite');
      g.enemiesInRadius(P.x, P.y, w.R, (e) => {
        const mult = frost && e.chill > 0 ? 1.5 : 1;
        g.damageEnemy(e, st.dmg * mult, { knock: 18, fromX: P.x, fromY: P.y, chill: frost ? 1.2 : 0, src: 'thornaura', small: true });
      });
    },
    draw(ctx, g, w, cam) {
      const P = g.player;
      if (!w.R) return;
      const cx = snap(P.x) - cam.x, cy = snap(P.y) - cam.y - 2;
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = g.combo('frostbite') ? '#8fd8ff' : '#7ad050';
      ctx.beginPath(); ctx.ellipse(cx, cy, w.R, w.R * 0.8, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#5a8a3a';
      const n = Math.floor(w.R / 4);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + g.time * 0.8;
        ctx.fillRect(snap(cx + Math.cos(a) * w.R), snap(cy + Math.sin(a) * w.R * 0.8), 2, 2);
      }
      ctx.restore();
    },
  },

  lightrod: {
    name: 'Storm Rod', icon: 'lightrod', element: 'light', max: 5,
    desc: 'Calls lightning down on random foes.',
    stats: (L) => ({ dmg: 18 + 7 * L, cd: +(1.7 - 0.12 * L).toFixed(2), count: 1 + Math.floor(L / 2) }),
    labels: { dmg: 'Damage', cd: 'Cooldown', count: 'Strikes' },
    fire(g, w, st) {
      const P = g.player, S = P.stats;
      const targets = g.randomEnemies(P.x, P.y, 210, st.count + S.amount);
      if (!targets.length) return false;
      const god = g.combo('thundergod');
      for (const e of targets) {
        g.strike(e.x, e.y);
        g.explode(e.x, e.y, 14 * S.area, st.dmg, { element: 'light', small: true, noShake: true });
        if (god) {
          const near = g.randomEnemies(e.x, e.y, 70, 2, e);
          for (const n2 of near) { g.zap([[e.x, e.y], [n2.x, n2.y]]); g.damageEnemy(n2, st.dmg * 0.6, { element: 'light' }); }
        }
      }
      Audio.play('zap');
    },
  },

  bombs: {
    name: 'Bomb Satchel', icon: 'bombs', element: 'fire', max: 5,
    desc: 'Lobs bombs that explode in a wide blast.',
    stats: (L) => ({ dmg: 24 + 8 * L, cd: +(2.3 - 0.15 * L).toFixed(2), count: 1 + Math.floor(L / 2), radius: 26 + 3 * L }),
    labels: { dmg: 'Damage', cd: 'Cooldown', count: 'Bombs', radius: 'Blast' },
    fire(g, w, st) {
      const P = g.player, S = P.stats;
      const n = st.count + S.amount;
      const targets = g.randomEnemies(P.x, P.y, 170, n);
      const napalm = g.combo('napalm');
      for (let i = 0; i < n; i++) {
        const e = targets[i];
        const tx = e ? e.x : P.x + rand(-80, 80), ty = e ? e.y : P.y + rand(-60, 60);
        const T = 0.6;
        const sx = P.x, sy = P.y;
        g.spawnProjectile({
          x: sx, y: sy, r: 0, dmg: 0, pierce: Infinity, life: T, spr: 'p_bomb', src: 'bombs', noHit: true,
          update(g2, p) {
            const k = Math.min(1, p.age / T);
            p.x = sx + (tx - sx) * k; p.y = sy + (ty - sy) * k;
            p.z = 6 + Math.sin(k * Math.PI) * 36;
            return true;
          },
          onExpire(g2, p) {
            g2.explode(p.x, p.y, st.radius * S.area, st.dmg, { element: 'fire', burn: 4 });
            if (napalm) g2.spawnFire(p.x, p.y, st.radius * S.area * 0.8, 3, 8);
          },
        });
      }
      Audio.play('swing');
    },
  },

  scythe: {
    name: 'Crescent Blade', icon: 'scythe', element: 'phys', max: 5,
    desc: 'Sweeps a wide arc in front of you.',
    stats: (L) => ({ dmg: 16 + 6 * L, cd: +(1.4 - 0.08 * L).toFixed(2), radius: 40 + 5 * L, count: L >= 4 ? 2 : 1 }),
    labels: { dmg: 'Damage', cd: 'Cooldown', radius: 'Radius', count: 'Sweeps' },
    fire(g, w, st) {
      const P = g.player, S = P.stats;
      const t = g.nearestEnemy(P.x, P.y, 120);
      const base = t ? Math.atan2(t.y - P.y, t.x - P.x) : P.faceAngle;
      const n = st.count + S.amount;
      const R = st.radius * S.area, arc = 2.2;
      for (let i = 0; i < n; i++) {
        const a = base + (i * TAU) / n;
        g.addEffect({ type: 'slash', x: P.x, y: P.y, a, R, arc, life: 0.2, follow: true });
        g.enemiesInRadius(P.x, P.y, R, (e) => {
          let d = Math.atan2(e.y - P.y, e.x - P.x) - a;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          if (Math.abs(d) <= arc / 2) g.damageEnemy(e, st.dmg, { knock: 110, fromX: P.x, fromY: P.y, src: 'scythe' });
        });
      }
      Audio.play('swing');
    },
  },

  sling: {
    name: 'Pebble Sling', icon: 'sling', element: 'phys', max: 5,
    desc: 'Pebbles ricochet from foe to foe.',
    stats: (L) => ({ dmg: 10 + 4 * L, cd: +(0.9 - 0.05 * L).toFixed(2), bounces: 1 + Math.floor(L / 2), count: 1 + Math.floor((L - 1) / 3) }),
    labels: { dmg: 'Damage', cd: 'Cooldown', bounces: 'Bounces', count: 'Pebbles' },
    fire(g, w, st) {
      const P = g.player, S = P.stats;
      const t = g.nearestEnemy(P.x, P.y, 230);
      if (!t) return false;
      const rico = g.combo('ricochet');
      const sp = 260 * S.projSpeed;
      const base = Math.atan2(t.y - P.y, t.x - P.x);
      for (const a of fan(base, st.count + S.amount, 0.2)) {
        g.spawnProjectile({
          x: P.x, y: P.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 3, dmg: st.dmg, pierce: 0, life: 1.2,
          spr: 'p_pebble', src: 'sling', knock: 40, bounces: st.bounces + (rico ? 2 : 0),
          onHit(g2, p, e, crit) {
            if (p.bounces <= 0 && !(rico && crit)) return false;
            p.bounces--;
            const next = g2.nearestEnemy(p.x, p.y, 110, (o) => o !== e && !p.hitSet.has(o.id));
            if (!next) return false;
            const a2 = Math.atan2(next.y - p.y, next.x - p.x);
            p.vx = Math.cos(a2) * sp; p.vy = Math.sin(a2) * sp; p.age = 0;
            return true;
          },
        });
      }
      Audio.play('shoot');
    },
  },
};

export const WEAPON_IDS = Object.keys(WEAPONS);
export { fan, choice };
