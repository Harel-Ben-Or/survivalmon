// Combat mixin for Game: projectiles, zones, visual effects, damage and kills.
import { TAU, rand, dist2, chance, choice } from '../core/util.js';
import { Audio } from '../core/audio.js';
import { SPR } from '../gfx/assets.js';
import { snap, drawCreature, ANIM_FPS, VFX, drawVfx } from '../gfx/art.js';
import { SPECIES, STONE_OF, MAX_PET_LEVEL } from '../content/species.js';
import { TIERS, PASSIVES, tierOdds } from '../content/skills.js';
import { SHARD_DROP } from '../content/shop.js';
import { Box, rollSkills } from './collection.js';
import { Meta } from './meta.js';
import { LANTERN } from '../entities/enemy.js';
import { dmgMarks, tryFreeze } from '../content/wcore.js';

export const Combat = {
  // ------------------------------------------------------------ queries
  nearestEnemy(x, y, maxD, filter) {
    let best = null, bd = maxD * maxD;
    this.enemyHash.query(x, y, maxD, (e) => {
      if (e.dead || (filter && !filter(e))) return;
      const d = dist2(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    });
    return best;
  },
  // A survivalmon's target: a Beacon Shot's glowing target when it's in reach, else the nearest foe
  petTarget(x, y, maxD, filter) {
    const b = this.beacon;
    if (b && !b.dead && b.glow > 0 && !b.hidden && dist2(x, y, b.x, b.y) < maxD * maxD && (!filter || filter(b))) return b;
    return this.nearestEnemy(x, y, maxD, filter);
  },
  enemiesInRadius(x, y, r, fn) {
    this.enemyHash.query(x, y, r + 24, (e) => {
      if (e.dead) return;
      const rr = r + e.r;
      if (dist2(x, y, e.x, e.y) <= rr * rr) fn(e);
    });
  },
  randomEnemies(x, y, maxD, n, exclude) {
    const pool = [];
    this.enemyHash.query(x, y, maxD, (e) => {
      if (!e.dead && e !== exclude && dist2(x, y, e.x, e.y) <= maxD * maxD) pool.push(e);
    });
    const out = [];
    while (out.length < n && pool.length) out.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
    return out;
  },

  // ------------------------------------------------------------ projectiles
  spawnProjectile(o) {
    const p = {
      vx: 0, vy: 0, r: 4, dmg: 0, pierce: 0, life: 1, rot: 0, z: 8, element: 'phys', knock: 0,
      ...o,
    };
    p.age = 0; p.maxLife = p.life; p.hitSet = new Set(); p.hitMap = new Map(); p.dead = false;
    this.projectiles.push(p);
    return p;
  },
  updateProjectiles(dt) {
    const P = this.player;
    for (const p of this.projectiles) {
      if (p.dead) continue;
      p.age += dt;
      if (p.age >= p.maxLife) { p.dead = true; p.onExpire?.(this, p); continue; }
      let custom = false;
      if (p.update) custom = p.update(this, p, dt) === true;
      if (!custom && !p.dead) {
        if (p.homing) {
          if (!p.target || p.target.dead) p.target = this.nearestEnemy(p.x, p.y, 170);
          if (p.target) {
            const want = Math.atan2(p.target.y - p.y, p.target.x - p.x);
            const cur = Math.atan2(p.vy, p.vx);
            let d = want - cur; d = Math.atan2(Math.sin(d), Math.cos(d));
            const turn = Math.max(-p.homing * dt, Math.min(p.homing * dt, d));
            const sp = Math.hypot(p.vx, p.vy);
            p.vx = Math.cos(cur + turn) * sp; p.vy = Math.sin(cur + turn) * sp;
          }
        }
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      if (p.spin) p.rot += p.spin * dt;
      else if (p.spr === 'p_arrow' || p.spr === 'p_leaf') p.rot = Math.atan2(p.vy, p.vx);
      if (p.trail && Math.random() < 36 * dt) this.particles.add({ x: p.x, y: p.y - p.z, vx: rand(-10, 10), vy: rand(-10, 10), life: 0.3, color: p.trail, size: 2 });
      if (p.dead || p.noHit) continue;
      if (p.hostile) {
        if (dist2(p.x, p.y, P.x, P.y) < (p.r + P.r) ** 2) {
          P.hurt(p.dmg, p);
          if (p.slow) {
            if (!P.netT && !this.netTold) { this.netTold = true; this.toast('Caught in a net! It slows you down for a moment.'); }
            P.netT = Math.max(P.netT || 0, p.slow);
          }
          p.dead = true;
          continue;
        }
        // shots can hit your survivalmons too
        for (const pet of P.pets) {
          if (pet.fainted || dist2(p.x, p.y, pet.x, pet.y - 4) >= (p.r + 5) ** 2) continue;
          pet.hurt(p.dmg);
          p.dead = true;
          break;
        }
        continue;
      }
      const kx = p.vx || p.vy ? p.vx / Math.hypot(p.vx, p.vy) : undefined;
      const ky = p.vx || p.vy ? p.vy / Math.hypot(p.vx, p.vy) : undefined;
      this.enemyHash.query(p.x, p.y, p.r + 24, (e) => {
        if (e.dead || p.dead) return;
        const rr = p.r + e.r;
        if (dist2(p.x, p.y, e.x, e.y) > rr * rr) return;
        if (p.hitCd) {
          const last = p.hitMap.get(e.id);
          if (last !== undefined && this.time - last < p.hitCd) return;
          p.hitMap.set(e.id, this.time);
        } else {
          if (p.hitSet.has(e.id)) return;
          p.hitSet.add(e.id);
        }
        // a main weapon's shot handles its own hit (its element and evolves); others hit plainly
        const res = p.hit ? p.hit(this, p, e) : this.damageEnemy(e, p.dmg, {
          element: p.element, knock: p.knock, kx, ky, fromX: P.x, fromY: P.y,
          burn: p.burn, chill: p.chill, freeze: p.freeze, stun: p.stun, pet: p.pet, petRef: p.petRef, src: p.src,
        });
        const keep = p.onHit ? p.onHit(this, p, e, res.crit) : false;
        if (!keep && !p.dead) {
          if (p.pierce <= 0) { p.dead = true; p.onExpire?.(this, p); }
          else p.pierce--;
        }
        if (p.dead) return false;
      });
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  },
  drawProjectiles(ctx, cam) {
    for (const p of this.projectiles) {
      if (p.draw) { p.draw(ctx, p, cam); continue; }
      if (p.fx && VFX[p.fx]) {
        const x = snap(p.x - cam.x), y = snap(p.y - cam.y - p.z);
        if (p.z > 10) { ctx.globalAlpha = 0.25; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, snap(p.y - cam.y), 4, 2, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
        drawVfx(ctx, p.fx, p.age + (p.seed || 0), x, y, { rot: p.fxSpin ? 0 : Math.atan2(p.vy, p.vx), scale: p.scale });
        continue;
      }
      if (!p.spr) continue;
      const s = SPR[p.spr] || SPR.p_bubble; // a shot whose picture is missing borrows the bubble's
      if (!s) continue;
      const x = snap(p.x - cam.x), y = snap(p.y - cam.y - p.z);
      if (p.z > 10 && !p.hostile) {
        ctx.globalAlpha = 0.25; ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(x, snap(p.y - cam.y), 4, 2, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      }
      if (p.rot || p.scale) {
        const k = p.scale || 1;
        ctx.save(); ctx.translate(x, y); if (p.rot) ctx.rotate(p.rot);
        ctx.drawImage(s.frames[0], -s.ax * k, -s.ay * k, s.w * k, s.h * k);
        ctx.restore();
      } else ctx.drawImage(s.frames[0], x - s.ax, y - s.ay, s.w, s.h);
    }
  },

  // ------------------------------------------------------------ zones
  spawnZone(o) {
    const z = { r: 20, life: 2, tick: 0.5, ...o };
    z.age = 0; z.t = o.firstTick ?? z.tick;
    this.zones.push(z);
    return z;
  },
  spawnFire(x, y, r, dur, dps) {
    return this.spawnZone({
      kind: 'fire', x, y, r, life: dur, tick: 0.35, glow: true, seed: (Math.random() * 1000) | 0,
      onTick: (g, z) => g.enemiesInRadius(z.x, z.y, z.r, (e) => g.damageEnemy(e, dps * 0.35, { element: 'fire', noCrit: true, small: true, silent: true })),
    });
  },
  updateZones(dt) {
    for (const z of this.zones) {
      z.age += dt;
      if (z.follow) { z.x = this.player.x; z.y = this.player.y; }
      z.t -= dt;
      while (z.t <= 0 && z.age <= z.life + 0.01) { z.t += z.tick; z.onTick?.(this, z); }
    }
    this.zones = this.zones.filter((z) => z.age < z.life);
  },
  drawZones(ctx, cam) {
    // Only what's on screen is drawn, and past 100 fires (a fire final form in a big crowd can leave
    // 300) only every 2nd or 3rd one: they overlap anyway, and every one of them still burns.
    const W = this.view?.w || 1e9, H = this.view?.h || 1e9;
    let fires = 0;
    if (this.zones.length > 100) for (const z of this.zones) if (z.kind === 'fire') fires++;
    const stride = fires > 100 ? Math.ceil(fires / 100) : 1;
    for (const z of this.zones) {
      if (z.invisible) continue;
      const x = Math.round(z.x - cam.x), y = Math.round(z.y - cam.y);
      if (x < -z.r - 12 || y < -z.r - 12 || x > W + z.r + 12 || y > H + z.r + 12) continue;
      if (z.kind === 'fire' && stride > 1 && (z.seed || 0) % stride) continue; // by its seed, so the same fires stay drawn
      const fade = Math.min(1, (z.life - z.age) * 3);
      if (z.fx && VFX[z.fx]) {
        // the pool art is drawn for a 24 px radius; it fades in and out
        drawVfx(ctx, z.fx, z.age + (z.seed || 0), x, y, { scale: z.r / 24, alpha: Math.min(1, z.age * 5, fade) * 0.9 });
        continue;
      }
      if (z.kind === 'fire') {
        ctx.globalAlpha = 0.25 * fade; ctx.fillStyle = '#f6702a';
        ctx.beginPath(); ctx.ellipse(x, y, z.r, z.r * 0.75, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = fade;
        const n = Math.max(4, Math.floor(z.r / 2));
        for (let i = 0; i < n; i++) {
          const a = ((i * 137.5 + z.seed) % 360) * (Math.PI / 180), d = ((i * 53 + z.seed) % 100) / 100 * z.r;
          const fx = x + Math.cos(a) * d, fy = y + Math.sin(a) * d * 0.75;
          const h = 2 + ((this.time * 10 + i) % 3) | 0;
          ctx.fillStyle = '#e0483e'; ctx.fillRect(fx - 1, fy - h, 3, h + 1);
          ctx.fillStyle = '#ffd84a'; ctx.fillRect(fx, fy - h + 1, 1, h - 1);
        }
      } else if (z.kind === 'thorns') {
        ctx.globalAlpha = 0.18 * fade; ctx.fillStyle = '#4f8a3a';
        ctx.beginPath(); ctx.ellipse(x, y, z.r, z.r * 0.8, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = fade;
        const grow = Math.min(1, z.age * 4);
        for (const [sx, sy, v] of z.spikes) {
          const h = Math.round((3 + v * 4) * grow);
          ctx.fillStyle = v > 0.5 ? '#3a7a32' : '#6a4a2a';
          ctx.fillRect(Math.round(x + sx), Math.round(y + sy - h), 1, h);
          ctx.fillRect(Math.round(x + sx) - 1, Math.round(y + sy - h + 2), 1, 1);
        }
      } else if (z.kind === 'spores') {
        ctx.globalAlpha = 0.22 * fade; ctx.fillStyle = '#b07ad8';
        ctx.beginPath(); ctx.ellipse(x, y, z.r, z.r * 0.75, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 0.8 * fade;
        for (let i = 0; i < 8; i++) {
          const a = i * 0.785 + this.time * 0.6, d = z.r * (0.3 + ((i * 37) % 60) / 100);
          ctx.fillStyle = i % 2 ? '#e6c8ff' : '#9af08a';
          ctx.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * 0.75 - ((this.time * 8 + i * 3) % 6)), 1, 1);
        }
      } else if (z.kind === 'poison' || z.kind === 'ice') {
        const poison = z.kind === 'poison';
        ctx.globalAlpha = 0.22 * fade; ctx.fillStyle = poison ? '#6ab03a' : '#9fdcff';
        ctx.beginPath(); ctx.ellipse(x, y, z.r, z.r * 0.75, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 0.85 * fade;
        const n = Math.max(3, Math.floor(z.r / 3));
        for (let i = 0; i < n; i++) {
          const a = i * 2.4 + (poison ? this.time * 0.5 : 0), d = z.r * (0.25 + ((i * 41) % 70) / 100);
          ctx.fillStyle = poison ? (i % 2 ? '#b8f070' : '#4a8a2a') : (i % 2 ? '#ffffff' : '#c8eeff');
          ctx.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * 0.75 - (poison ? (this.time * 6 + i * 2) % 5 : 0)), 1, 1);
        }
      } else if (z.kind === 'hazard') {
        const k = Math.min(1, z.age / (z.firstTick || 0.8));
        ctx.globalAlpha = 0.25 + 0.35 * k; ctx.strokeStyle = '#ff4a4a'; ctx.fillStyle = '#ff4a4a';
        ctx.beginPath(); ctx.ellipse(x, y, z.r, z.r * 0.75, 0, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 0.18 * k; ctx.beginPath(); ctx.ellipse(x, y, z.r * k, z.r * 0.75 * k, 0, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  },

  // ------------------------------------------------------------ visual effects
  addEffect(o) { const e = { ...o, age: 0, maxLife: o.life }; this.effects.push(e); return e; },
  // Plays an effects-tool animation with its origin at (x, y); returns the effect (or null without art)
  playFx(id, x, y, o = {}) {
    const v = VFX[id];
    if (!v) return null;
    return this.addEffect({ type: 'vfx', fx: id, x, y, life: v.loop ? o.life || 1 : v.dur, ...o });
  },
  // Runs fn after t seconds of game time (skipped if the run ends first)
  after(t, fn) { (this.timers ||= []).push({ t, fn }); },
  zap(points, life = 0.22, colors) {
    const jag = [];
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, ay] = points[i], [bx, by] = points[i + 1];
      const segs = Math.max(2, Math.floor(Math.hypot(bx - ax, by - ay) / 10));
      for (let s = 0; s <= segs; s++) {
        const k = s / segs;
        const j = s === 0 || s === segs ? 0 : 5;
        jag.push([ax + (bx - ax) * k + rand(-j, j), ay + (by - ay) * k + rand(-j, j) - 8]);
      }
    }
    this.addEffect({ type: 'zap', pts: jag, life, colors });
  },
  strike(x, y) {
    const pts = [];
    let cx = x + rand(-20, 20);
    for (let yy = y - 140; yy < y; yy += 12) { pts.push([cx, yy]); cx += rand(-7, 7); }
    pts.push([x, y - 4]);
    this.addEffect({ type: 'zap', pts, life: 0.2, wide: true });
    this.addEffect({ type: 'flashring', x, y, R: 14, life: 0.18, color: '#fff6c8' });
  },
  updateEffects(dt) {
    if (this.timers?.length) {
      const due = [];
      for (const tm of this.timers) { tm.t -= dt; if (tm.t <= 0) due.push(tm); }
      if (due.length) { this.timers = this.timers.filter((tm) => tm.t > 0); for (const tm of due) tm.fn(this); }
    }
    for (const e of this.effects) {
      e.age += dt;
      if (e.follow) { e.x = this.player.x; e.y = this.player.y; }
    }
    this.effects = this.effects.filter((e) => e.age < e.maxLife);
  },
  drawEffects(ctx, cam) {
    for (const e of this.effects) {
      const k = e.age / e.maxLife;
      const x = Math.round((e.x ?? 0) - cam.x), y = Math.round((e.y ?? 0) - cam.y);
      ctx.save();
      switch (e.type) {
        case 'slash': {
          const a0 = e.a - e.arc / 2;
          const sweep = e.arc * Math.min(1, k * 2.2);
          ctx.globalAlpha = 1 - k * 0.8;
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(x, y - 6, e.R * 0.85, e.R * 0.68, 0, a0, a0 + sweep); ctx.stroke();
          ctx.strokeStyle = '#c8a8ff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(x, y - 6, e.R * 0.65, e.R * 0.52, 0, a0, a0 + sweep); ctx.stroke();
          break;
        }
        case 'monfaint': {
          const t = e.age, n = e.art.anim.faint.length, landed = n / ANIM_FPS.faint, f = Math.floor(t * ANIM_FPS.faint);
          if (e.death) {
            // a defeated monster: plays its death, then fades out where it fell
            const fade = Math.max(0, Math.min(1, (e.maxLife - t) / 0.25)), s = e.scale || 1;
            drawCreature(ctx, e.art, x, y, { left: e.left, anim: 'faint', frame: f, alpha: fade, sx: s, sy: s });
            break;
          }
          const fade = t > landed + 0.35 ? Math.max(0, 1 - (t - landed - 0.35) / 0.3) : 1;
          const sc = 0.35 + 0.65 * fade;
          drawCreature(ctx, e.art, x, y, { left: e.left, anim: 'faint', frame: f, alpha: fade, sx: sc, sy: sc, blight: e.blight && t < landed });
          if (fade < 1) { ctx.globalAlpha = 1 - fade; ctx.fillStyle = '#bff8ff'; ctx.beginPath(); ctx.arc(x, y - 6, 3 + 9 * (1 - fade), 0, TAU); ctx.fill(); }
          break;
        }
        case 'ring': {
          const r = e.R * (0.2 + 0.8 * Math.sqrt(k));
          ctx.globalAlpha = 1 - k; ctx.strokeStyle = e.color; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(x, y - 4, r, r * 0.78, 0, 0, TAU); ctx.stroke();
          break;
        }
        case 'flashring': {
          ctx.globalAlpha = 1 - k; ctx.fillStyle = e.color;
          ctx.beginPath(); ctx.ellipse(x, y - 4, e.R * (0.5 + k), e.R * 0.6 * (0.5 + k), 0, 0, TAU); ctx.fill();
          break;
        }
        case 'target': {
          ctx.globalAlpha = 0.35 + 0.4 * Math.abs(Math.sin(k * 12)); ctx.strokeStyle = '#ff5a3a'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.ellipse(x, y, e.R, e.R * 0.75, 0, 0, TAU); ctx.stroke();
          break;
        }
        case 'vfx': {
          drawVfx(ctx, e.fx, e.age, x, y, { scale: e.scale, flip: e.flip, alpha: e.alpha });
          break;
        }
        case 'zap': {
          ctx.globalAlpha = 1 - k;
          ctx.strokeStyle = e.colors?.[0] || '#7ad8ff'; ctx.lineWidth = e.wide ? 3 : 2;
          ctx.beginPath(); e.pts.forEach(([px, py], i) => (i ? ctx.lineTo(px - cam.x, py - cam.y) : ctx.moveTo(px - cam.x, py - cam.y))); ctx.stroke();
          ctx.strokeStyle = e.colors?.[1] || '#ffffff'; ctx.lineWidth = 1;
          ctx.beginPath(); e.pts.forEach(([px, py], i) => (i ? ctx.lineTo(px - cam.x, py - cam.y) : ctx.moveTo(px - cam.x, py - cam.y))); ctx.stroke();
          break;
        }
        case 'explosion': {
          const r = e.R * (0.35 + 0.65 * Math.sqrt(k));
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = e.color || '#f6702a';
          ctx.beginPath(); ctx.ellipse(x, y - 4, r, r * 0.8, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ffe07a';
          ctx.beginPath(); ctx.ellipse(x, y - 4, r * 0.55 * (1 - k), r * 0.45 * (1 - k), 0, 0, TAU); ctx.fill();
          break;
        }
      }
      ctx.restore();
    }
  },

  // ------------------------------------------------------------ damage
  damageEnemy(e, base, o = {}) {
    if (e.dead || e.hidden || e.fainted) return { crit: false, dmg: 0 };
    const S = this.player.stats;
    let dmg = base * dmgMarks(this, e, o); // the main weapon's evolves: foes that take more from everything
    let crit = false;
    if (!o.raw) {
      dmg *= (o.pet ? S.petPower : S.might) * (1 + this.blessed().dmg);
      const critChance = S.crit + (o.critAdd || 0) + (o.pet ? (o.petRef?.pass.claw || 0) + (this.team?.crit || 0) : 0);
      if (!o.noCrit && Math.random() < critChance) { crit = true; dmg *= S.critMult + (o.critMultAdd || 0); }
      // a glowing foe (the Light element) takes more from your survivalmons
      if (o.pet && e.glow > 0) dmg *= 1 + (e.glowK || 0.25);
      if (o.element === 'fire') dmg *= S.burnMult;
      if (o.element === 'light') dmg *= S.lightning;
      if (o.shatter && e.freeze > 0) dmg *= 3;
      if (o.steam && (e.freeze > 0 || e.chill > 0)) dmg *= 2;
      dmg *= rand(0.92, 1.08);
    }
    if (e.def.night) dmg *= this.lightHurt(e, o);
    const hpBefore = Math.max(0, e.hp);
    e.hp -= dmg;
    e.flash = 0.1;
    if (o.petRef?.pass.vamp) o.petRef.heal(dmg * o.petRef.pass.vamp);
    if (o.burn) { e.burn = { dps: o.burn * S.burnMult * S.might, t: 3 * S.duration }; e.burnBy = o.petRef || null; } // whose burn it is (enemy.js passes it back as o.by)
    if (o.chill) e.chill = Math.max(e.chill, o.chill * S.duration);
    if (S.chillChance && Math.random() < S.chillChance) e.chill = Math.max(e.chill, 1.5);
    if (o.freeze) tryFreeze(e, o.freeze); // a boss is only chilled; no freeze again right after a thaw
    if (o.stun && !e.boss) e.stun = Math.max(e.stun, o.stun);
    if (o.root) e.root = Math.max(e.root, o.root);
    if (o.knock) {
      let kx = o.kx, ky = o.ky;
      if (kx === undefined) {
        const fx = o.fromX ?? this.player.x, fy = o.fromY ?? this.player.y;
        const d = Math.hypot(e.x - fx, e.y - fy) || 1;
        kx = (e.x - fx) / d; ky = (e.y - fy) / d;
      }
      const res = 1 - (e.knockRes || 0);
      e.kbx += kx * o.knock * res; e.kby += ky * o.knock * res;
    }
    const big = dmg >= 8 || crit;
    if (!o.small || big) this.particles.number(e.x, e.y - e.hgt * 0.5 + 10, dmg, crit ? 'crit' : o.element === 'fire' ? 'burn' : 'white');
    this.runStats.damage += dmg;
    // who did the damage (no overkill counted): your hero's weapons or your survivalmons
    const dealt = Math.min(dmg, hpBefore);
    if (o.pet || o.by) this.runStats.monDmg = (this.runStats.monDmg || 0) + dealt; else this.runStats.heroDmg = (this.runStats.heroDmg || 0) + dealt;
    if (e.hp <= 0) { if (e.wild) this.catchWild(e, o); else this.killEnemy(e, o); }
    else if (!o.silent) Audio.play('hit');
    // a weapon evolve that adds to your survivalmons' hits (Pip's sling)
    const h = this.wPetHit;
    if (o.pet && h && h.w === this.player?.main && dmg > 0) h.fn(this, e, { crit, dmg }, o);
    return { crit, dmg };
  },

  // Night creatures are weak to light: what's left of the daylight (+100% while the sun is still up,
  // none at full night), the hero's lantern (+30% near the hero), lightning and Fairy-type attacks (+50%)
  lightHurt(e, o) {
    let k = 2 - (this.dark?.night ?? 1);
    if (dist2(e.x, e.y, this.player.x, this.player.y) < LANTERN * LANTERN) k += 0.3;
    if (o.element === 'light' || (o.petRef && SPECIES[o.petRef.species]?.types?.includes('fairy'))) k += 0.5;
    return k;
  },

  killEnemy(e, o = {}) {
    if (e.dead) return;
    e.dead = true;
    const P = this.player, S = P.stats;
    P.kills++;
    Box.foeKilled(e.type, this.tier || 0);
    if (o.pet || o.by) P.spirit += (e.boss ? 20 : e.elite ? 2 : 0.2) * (this.tierMult?.spirit || 1); // Spirit for what your survivalmons defeat (their burns too)
    const cx = e.x, cy = e.y - 4;
    this.particles.burst(cx, cy - 4, { n: e.boss ? 60 : 8, colors: e.colors, speed: e.boss ? 140 : 70, life: 0.45, size: e.boss ? 2 : 1 });
    if (e.art?.anim?.faint && (e.boss || this.effects.length < 160)) {
      this.addEffect({ type: 'monfaint', x: e.x, y: e.y, art: e.art, left: e.face < 0, life: e.boss ? 1.6 : 1.0, death: true, scale: e.scale || 1 });
    }
    if (e.def.splits && !e.burst && Math.random() < (e.def.splitChance ?? 1)) for (let i = 0; i < 2; i++) this.spawnEnemy(e.def.splits, e.x + rand(-7, 7), e.y + rand(-5, 5));
    if (e.carry) this.rescuePet(e.carry);
    // drops
    this.dropXp(cx, cy, e.xp);
    this.gainCoins(e.boss ? 50 : e.elite ? 10 : 1, cx, cy - 10, e.boss || e.elite);
    if (chance(0.01 * S.luck)) this.spawnPickup('heart', cx, cy);
    if (chance(0.0018 * S.luck)) this.spawnPickup('magnet', cx, cy);
    if (chance(0.0012 * S.luck)) this.spawnPickup('bomb', cx, cy);
    // berries fill the team bar: 1 from 15% of monsters, 3 from an elite, 10 from a boss
    if (chance(0.15)) this.spawnPickup('berry', cx + rand(-4, 4), cy);
    if (e.elite) {
      this.spawnPickup('chest', cx, cy, 1);
      if (Math.random() < 0.08) this.dropGear(cx + 8, cy);
      if (Math.random() < 0.3) this.addMats({ [choice(['wood', 'stone', 'clay'])]: 2 });
      for (let i = 0; i < 3; i++) this.spawnPickup('berry', cx + rand(-10, 10), cy + rand(-6, 6));
      if (chance(0.03 * S.luck)) this.spawnPickup('stone', cx - 8, cy, this.rollStone());
    }
    if (this.tier >= 4) this.dropShards(e, cx, cy);
    if (e.boss) this.onBossDeath(e);
    if (S.healOnKill && chance(S.healOnKill)) P.heal(2);
    // what your survivalmons defeat goes into the run's mon EXP pool, split between them at the end
    // (1 EXP for every mon on the team, so once it's split each one gets 1 EXP per kill the team makes:
    // berries used to feed every survivalmon EXP; now the kills carry it all. This matches the old game's
    // pace; at 2 the bots' teams earned about 1.9x the old EXP per kill and neared Lv 70 by run 50)
    // (a survivalmon's burn that finishes a foe counts too: o.by)
    if (o.petRef || o.by) this.monPool = (this.monPool || 0) + Math.max(1, P.pets.length) * (this.tierMult?.petXp || 1);
    Audio.play('kill');
  },

  // Skyfall Shards, from the Lv 2 gates on (more at Lv 3 and 4): a boss drops some for sure, the
  // Night Lord more, an elite now and then and any other monster very rarely. Gear sets with shard
  // luck make all of it more likely.
  dropShards(e, x, y) {
    const lv = Math.floor(this.tier / 4), luck = 1 + (this.heroBonus?.shards || 0);
    let n = 0;
    if (e.boss) n = Math.floor((e.type === 'night_lord' ? SHARD_DROP.nightLord : SHARD_DROP.boss) * lv * luck + Math.random());
    else if (chance((e.elite ? SHARD_DROP.elite : SHARD_DROP.kill) * lv * luck)) n = 1;
    for (let i = 0; i < n; i++) this.spawnPickup('shard', x + rand(-10, 10), y + rand(-6, 6), 1);
  },

  // A Cage Drone went down: the survivalmon it was carrying gets back on its feet
  rescuePet(pet) {
    pet.carriedBy = null;
    if (!pet.fainted) return;
    pet.fainted = false; pet.hp = pet.maxHp * 0.35; pet.faintT = 0;
    this.player.recompute(); this.applyTeamPassives?.();
    this.feed(`You rescued ${pet.name}!`, '#9af08a');
    this.particles.burst(pet.x, pet.y - 8, { n: 20, colors: ['#9af08a', '#ffffff'], speed: 60, life: 0.6, up: 20 });
    Audio.play('heal');
  },

  // Every defeated monster pays straight into the run's purse (banked when the run ends).
  gainCoins(n, x, y, show) {
    const v = n * (this.coinMult || 1) * (this.tierMult?.coins || 1);
    this.player.coins += v;
    this.runStats.coins += v;
    if (show) this.particles.number(x, y, Math.round(v), 'crit');
  },

  // Defeating a wild survivalmon catches it: it joins your Ranch (and the team, if there's room).
  catchWild(e, o = {}) {
    if (e.dead) return;
    e.dead = true;
    const P = this.player, species = e.wild;
    P.kills++;
    P.spirit += 10 * (this.tierMult?.spirit || 1);
    this.dropXp(e.x, e.y - 4, e.xp);
    this.gainCoins(10, e.x, e.y - 14, true);
    this.particles.burst(e.x, e.y - 8, { n: 30, colors: ['#7af0ff', '#ffe07a', '#ffffff'], speed: 90, life: 0.6 });
    // it faints where it stood, then shrinks away in a flash of light as it's caught
    if (e.art?.anim?.faint) this.addEffect({ type: 'monfaint', x: e.x, y: e.y, art: e.art, left: e.face < 0, life: 1.4, blight: e.corrupted });
    // wild ones met later in a run are further grown
    const level = Math.min(MAX_PET_LEVEL, 1 + Math.floor(this.time / 60) + (this.tierMult?.wildLv || 0)); // past the newer gates they're far more grown
    const odds = e.lure ? tierOdds(this.tierOdds, e.lure) : this.tierOdds; // called by a Lure Horn II or better
    const mon = Box.add(species, { skills: rollSkills(species, { odds }), joinTeam: false, origin: 'wild', level, where: this.world.zoneAtPx(e.x, e.y) });
    P.caught.push(species);
    const joined = Box.toggleTeam(mon.id) && !!this.addPet(mon, true);
    if (!joined && Box.inTeam(mon.id)) Box.toggleTeam(mon.id);
    const skills = mon.skills.map((k) => `${k.k === 'u' ? SPECIES[k.sp].unique.name : PASSIVES[k.id].name} ${TIERS[k.t]}`).join(' · ');
    this.ui.catchCard(mon, { joined, freed: e.corrupted }); // its grades at a glance, instead of a banner
    this.ui.tip('caught', () => { this.ui.catchUntil = Math.max(this.ui.catchUntil, performance.now() + 3000); }); // the card stays a moment after Moss explains it
    if (Meta.unlock('survidex')) this.toast('The Survidex is open in town!');
    if (Math.random() < 0.04 * (this.tierMult?.stone || 1)) this.spawnPickup('stone', e.x, e.y - 8, STONE_OF[SPECIES[species].type]);
    if (Math.random() < 0.12) this.dropGear(e.x + 10, e.y);
    if (o.petRef || o.by) this.monPool = (this.monPool || 0) + 4 * Math.max(1, P.pets.length);
    // a freed survivalmon leaves 5 berries as its thanks
    for (let i = 0; i < 5; i++) this.spawnPickup('berry', e.x + rand(-12, 12), e.y + rand(-8, 8));
    Audio.play('hatch'); setTimeout(() => Audio.play('chest'), 250);
  },

  dropXp(x, y, total) {
    let left = Math.max(1, Math.round(total));
    while (left > 0) {
      const v = left >= 25 ? 25 : left >= 5 ? 5 : 1;
      left -= v;
      this.spawnPickup('xp', x + rand(-6, 6), y + rand(-4, 4), v);
    }
  },

  explode(x, y, r, dmg, o = {}) {
    this.enemiesInRadius(x, y, r, (e) => {
      if (e === o.exclude) return;
      this.damageEnemy(e, dmg, { ...o, fromX: x, fromY: y, knock: o.knock ?? 90, silent: true });
    });
    const color = o.element === 'light' ? '#bfeaff' : o.element === 'ice' ? '#bfeaff' : '#f6702a';
    if (!o.noFx) this.addEffect({ type: 'explosion', x, y, R: r, life: o.small ? 0.2 : 0.35, color, glow: true });
    if (!o.small) {
      this.particles.burst(x, y - 4, { n: Math.min(30, Math.floor(r / 2)), colors: ['#ffe07a', '#f6a03a', '#e0483e', '#5a4a4a'], speed: r * 3, life: 0.5, size: 2 });
      if (!o.noShake) this.shake(o.big ? 4 : 2, 0.2);
      Audio.play('explode');
    }
  },
};
export { choice };
