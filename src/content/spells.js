// Manually cast spells (keys 1/2/3).
import { TAU, rand } from '../core/util.js';
import { Audio } from '../core/audio.js';

export const SPELLS = {
  fireball: {
    name: 'Fireball', icon: 'fireball', element: 'fire', max: 5,
    desc: 'Hurls a blazing orb that explodes in a big blast.',
    stats: (L) => ({ dmg: 45 + 15 * L, cd: +(7 - 0.4 * L).toFixed(1), radius: 40 + 4 * L }),
    labels: { dmg: 'Damage', cd: 'Cooldown', radius: 'Blast' },
    cast(g, s, st) {
      const P = g.player, S = P.stats;
      const t = g.nearestEnemy(P.x, P.y, 280);
      const a = t ? Math.atan2(t.y - P.y, t.x - P.x) : P.faceAngle;
      const steam = g.combo('steamburst');
      const R = st.radius * S.area * (steam ? 1.5 : 1);
      const sp = 180 * S.projSpeed;
      g.spawnProjectile({
        x: P.x, y: P.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 7, dmg: 0, pierce: 0, life: 1.4,
        spr: 'p_fireball', src: 'fireball', element: 'fire', glow: '#f6a03a', light: 50, trail: '#f6a03a',
        onHit(g2, p) { p.dead = true; return false; },
        onExpire(g2, p) {
          g2.explode(p.x, p.y, R, st.dmg, { element: 'fire', burn: 8, steam, big: true });
        },
      });
      Audio.play('fire');
      return true;
    },
  },

  frostnova: {
    name: 'Frost Nova', icon: 'frostnova', element: 'ice', max: 5,
    desc: 'Freezes every foe around you solid.',
    stats: (L) => ({ dmg: 15 + 6 * L, cd: +(11 - 0.6 * L).toFixed(1), radius: 80 + 8 * L, freeze: +(2.2 + 0.3 * L).toFixed(1) }),
    labels: { dmg: 'Damage', cd: 'Cooldown', radius: 'Radius', freeze: 'Freeze (s)' },
    cast(g, s, st) {
      const P = g.player, S = P.stats;
      const R = st.radius * S.area;
      g.addEffect({ type: 'ring', x: P.x, y: P.y, R, life: 0.4, color: '#bfeaff' });
      g.enemiesInRadius(P.x, P.y, R, (e) => {
        g.damageEnemy(e, st.dmg, { element: 'ice', freeze: st.freeze * S.duration });
      });
      g.particles.burst(P.x, P.y - 6, { n: 30, color: '#d8f4ff', speed: R * 1.6, life: 0.5 });
      Audio.play('freeze');
      return true;
    },
  },

  chainlight: {
    name: 'Chain Lightning', icon: 'chainlight', element: 'light', max: 5,
    desc: 'A bolt that leaps between many foes.',
    stats: (L) => ({ dmg: 35 + 12 * L, cd: +(5.5 - 0.3 * L).toFixed(1), chains: 6 + L }),
    labels: { dmg: 'Damage', cd: 'Cooldown', chains: 'Chains' },
    cast(g, s, st) {
      const P = g.player, S = P.stats;
      const shatter = g.combo('shatter');
      let cur = g.nearestEnemy(P.x, P.y, 170);
      if (!cur) return false;
      const pts = [[P.x, P.y]];
      const seen = new Set();
      let n = st.chains + S.chainBonus + (shatter ? 3 : 0);
      while (cur && n-- > 0) {
        seen.add(cur.id);
        pts.push([cur.x, cur.y]);
        g.damageEnemy(cur, st.dmg, { element: 'light', shatter });
        const from = cur;
        cur = g.nearestEnemy(from.x, from.y, 100, (o) => !seen.has(o.id));
      }
      g.zap(pts, 0.3);
      Audio.play('zap');
      return true;
    },
  },

  heal: {
    name: 'Healing Bloom', icon: 'heal', element: 'nature', max: 5,
    desc: 'Restores health and keeps healing for a while.',
    stats: (L) => ({ heal: +(0.22 + 0.04 * L).toFixed(2), cd: +(20 - L).toFixed(0), regen: 3 + L }),
    labels: { heal: 'Heal (% HP)', cd: 'Cooldown', regen: 'Regen/s' },
    cast(g, s, st) {
      const P = g.player, S = P.stats;
      const og = g.combo('overgrowth');
      P.heal(P.stats.maxHp * st.heal * (og ? 1.5 : 1));
      P.regenBoost = { amount: st.regen, t: 4 * S.duration };
      g.addEffect({ type: 'ring', x: P.x, y: P.y, R: 50, life: 0.5, color: '#9af08a' });
      g.particles.burst(P.x, P.y - 8, { n: 24, color: '#9af08a', speed: 50, life: 0.8, up: 30 });
      if (og) {
        g.addEffect({ type: 'ring', x: P.x, y: P.y, R: 95 * S.area, life: 0.45, color: '#f5a0c8' });
        g.enemiesInRadius(P.x, P.y, 95 * S.area, (e) => g.damageEnemy(e, 40 + 10 * s.level, { element: 'nature', knock: 260, fromX: P.x, fromY: P.y }));
      }
      Audio.play('heal');
      return true;
    },
  },

  meteor: {
    name: 'Meteor Shower', icon: 'meteor', element: 'fire', max: 5,
    desc: 'Rains meteors around you for a few seconds.',
    stats: (L) => ({ dmg: 40 + 12 * L, cd: +(22 - 1.2 * L).toFixed(1), count: 10 + 2 * L, radius: 26 + 2 * L }),
    labels: { dmg: 'Damage', cd: 'Cooldown', count: 'Meteors', radius: 'Blast' },
    cast(g, s, st) {
      const P = g.player, S = P.stats;
      const cata = g.combo('cataclysm');
      const count = st.count + (cata ? 4 : 0);
      const R = st.radius * S.area * (cata ? 1.6 : 1);
      g.spawnZone({
        x: P.x, y: P.y, r: 0, life: 3, tick: 3 / count, invisible: true,
        onTick(g2) {
          const P2 = g2.player;
          const pick = g2.randomEnemies(P2.x, P2.y, 180, 1)[0];
          const tx = pick ? pick.x + rand(-10, 10) : P2.x + rand(-140, 140);
          const ty = pick ? pick.y + rand(-10, 10) : P2.y + rand(-90, 90);
          g2.addEffect({ type: 'target', x: tx, y: ty, R, life: 0.5 });
          g2.spawnProjectile({
            x: tx, y: ty, r: 0, dmg: 0, pierce: Infinity, life: 0.5, spr: 'p_meteor', noHit: true, z: 140, glow: '#f6a03a',
            update(g3, p) { p.z = 140 * (1 - p.age / p.maxLife); p.x = tx - p.z * 0.4; return true; },
            onExpire(g3) { g3.explode(tx, ty, R, st.dmg, { element: 'fire', burn: 5 }); },
          });
        },
      });
      return true;
    },
  },

  gale: {
    name: 'Gale Burst', icon: 'gale', element: 'wind', max: 5,
    desc: 'A gust that blasts foes away and dazes them.',
    stats: (L) => ({ dmg: 20 + 8 * L, cd: +(9 - 0.5 * L).toFixed(1), radius: 100 + 10 * L }),
    labels: { dmg: 'Damage', cd: 'Cooldown', radius: 'Radius' },
    cast(g, s, st) {
      const P = g.player, S = P.stats;
      const R = st.radius * S.area;
      g.addEffect({ type: 'ring', x: P.x, y: P.y, R, life: 0.35, color: '#ffffff' });
      g.addEffect({ type: 'ring', x: P.x, y: P.y, R: R * 0.7, life: 0.3, color: '#c8f0ff' });
      g.enemiesInRadius(P.x, P.y, R, (e) => {
        g.damageEnemy(e, st.dmg, { element: 'wind', knock: 420, fromX: P.x, fromY: P.y, stun: 0.6 });
      });
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * TAU;
        g.particles.add({ x: P.x, y: P.y - 6, vx: Math.cos(a) * 220, vy: Math.sin(a) * 180, life: 0.4, color: '#ffffff', size: 1 });
      }
      Audio.play('dash');
      return true;
    },
  },

  thornfield: {
    name: 'Thorn Field', icon: 'thornfield', element: 'nature', max: 5,
    desc: 'Brambles erupt around you, rooting and cutting foes.',
    stats: (L) => ({ dmg: 6 + 3 * L, cd: +(14 - 0.8 * L).toFixed(1), radius: 60 + 6 * L, dur: +(5 + 0.5 * L).toFixed(1) }),
    labels: { dmg: 'Damage/tick', cd: 'Cooldown', radius: 'Radius', dur: 'Duration' },
    cast(g, s, st) {
      const P = g.player, S = P.stats;
      const R = st.radius * S.area;
      const spikes = [];
      for (let i = 0; i < Math.floor(R / 3); i++) {
        const a = rand(0, TAU), d = Math.sqrt(Math.random()) * R;
        spikes.push([Math.cos(a) * d, Math.sin(a) * d * 0.8, rand(0, 1)]);
      }
      g.spawnZone({
        x: P.x, y: P.y, r: R, life: st.dur * S.duration, tick: 0.4, kind: 'thorns', spikes,
        onTick(g2, z) {
          g2.enemiesInRadius(z.x, z.y, z.r, (e) => {
            g2.damageEnemy(e, st.dmg, { element: 'nature', root: 0.6, small: true });
          });
        },
      });
      Audio.play('swing');
      return true;
    },
  },
};

export const SPELL_IDS = Object.keys(SPELLS);
