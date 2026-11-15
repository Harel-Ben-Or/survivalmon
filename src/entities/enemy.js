// Monsters and bosses.
import { ENEMIES, hpScale } from '../content/creatures.js';
import { XP_PACE } from '../systems/director.js';
import { SPECIES, TYPES } from '../content/species.js';
import { MON } from '../gfx/assets.js';
import { CREATURE, creatureMotion, drawCreature } from '../gfx/art.js';

export const FAINT_TIME = 25;
export const WILD_TIME = 25; // seconds a wild survivalmon stays before it runs away
import { rand, TAU, dist2 } from '../core/util.js';
import { Audio } from '../core/audio.js';

let nextId = 1;
const COLORS = {
  slime: ['#6fd16a', '#3e9a46'], slime_blue: ['#5ab0f0', '#3a78c0'], slime_red: ['#f06a5a', '#ffd84a'], bat: ['#7a4fb0', '#9a6ad0'],
  shroom: ['#e0483e', '#f2e2c4'], shroom_blue: ['#4a7ad8', '#f2e2c4'], wisp: ['#cfeaff', '#8fb8e8'], beetle: ['#2f7f9f', '#6fc4e0'],
  wolf: ['#8d8fa6', '#5d5f78'], spore: ['#b07ad8', '#e6c8ff'], imp: ['#d84a3a', '#7a2a3a'], golem: ['#9a948a', '#6cc24e'],
};

export class Enemy {
  constructor(g, type, x, y, opts = {}) {
    const def = ENEMIES[type];
    this.id = nextId++;
    this.type = type; this.def = def;
    this.x = x; this.y = y;
    this.r = def.r;
    this.boss = !!def.boss;
    this.elite = !!opts.elite;
    const hpMul = this.boss ? 1 + g.stage / 1500 : hpScale(g.stage);
    this.maxHp = this.hp = def.hp * hpMul * (this.elite ? 9 : 1);
    this.speed = def.speed * (this.boss ? 1 : rand(0.9, 1.1)) * (this.elite ? 1.08 : 1);
    this.dmg = def.dmg * (this.boss ? 1 : 1 + g.stage / 1200) * (this.elite ? 1.4 : 1);
    this.xp = def.xp * (this.elite ? 12 : 1) * XP_PACE;
    this.knockRes = this.elite ? Math.max(0.6, def.knockRes || 0) : def.knockRes || 0;
    this.flying = def.behavior === 'flyer' || !!def.flying;
    const look = opts.wild || type;
    this.spr = MON[look];
    this.art = CREATURE[look];
    this.hgt = this.art ? this.art.ch : this.spr.h;
    // A wild survivalmon: tougher, glows cyan, and is caught when you defeat it.
    this.wild = opts.wild || null;
    this.catchable = (!!opts.catchable || !!this.wild) && !this.boss;
    if (this.wild) { this.fleeT = WILD_TIME; this.wildName = SPECIES[this.wild].name; }
    if (this.catchable) {
      this.maxHp = this.hp = def.hp * hpMul * 6;
      this.xp = def.xp * 6 * XP_PACE;
      this.knockRes = Math.max(0.5, this.knockRes);
    }
    this.fainted = false; this.faintT = 0; this.moving = false;
    this.colors = this.wild ? [TYPES[SPECIES[this.wild].type].color, '#ffffff'] : COLORS[type] || ['#ffffff', '#cccccc'];
    this.petCd = 0;
    this.vx = 0; this.vy = 0; this.kbx = 0; this.kby = 0;
    this.anim = rand(0, 4); this.face = 1;
    this.flash = 0; this.chill = 0; this.freeze = 0; this.stun = 0; this.root = 0;
    this.burn = null; this.burnAcc = 0; this.burnTick = 0.5;
    this.state = 'chase'; this.timer = rand(1, 2.5); this.t2 = rand(3, 6); this.t3 = 8;
    this.fireT = rand(1, def.fireCd || 2);
    this.z = 0; this.hidden = false; this.alpha = def.alpha ?? 1;
    this.contactCd = 0;
    this.wob = rand(0, TAU);
    this.dead = false;
  }

  update(g, dt) {
    const P = g.player;
    if (this.fainted) {
      this.faintT -= dt;
      this.flash = 0;
      if (Math.random() < dt * 4) g.particles.add({ x: this.x + rand(-8, 8), y: this.y - rand(2, 10), vx: 0, vy: -12, life: 0.6, color: '#bff8ff' });
      if (this.faintT <= 0) {
        this.dead = true;
        g.particles.burst(this.x, this.y - 6, { n: 16, color: '#ffffff', speed: 70, life: 0.4 });
        g.toast(`The wild ${this.def.name} woke up and ran away...`);
      }
      return;
    }
    this.flash = Math.max(0, this.flash - dt);
    this.chill = Math.max(0, this.chill - dt);
    this.freeze = Math.max(0, this.freeze - dt);
    this.stun = Math.max(0, this.stun - dt);
    this.root = Math.max(0, this.root - dt);
    this.contactCd = Math.max(0, this.contactCd - dt);
    this.petCd = Math.max(0, this.petCd - dt);
    if (this.wild) {
      this.fleeT -= dt;
      if (this.fleeT <= 0) {
        this.dead = true;
        g.particles.burst(this.x, this.y - 6, { n: 16, color: '#ffffff', speed: 70, life: 0.4 });
        g.toast(`The wild ${this.wildName} ran away...`);
        return;
      }
    }

    if (this.burn) {
      this.burn.t -= dt;
      this.burnAcc += this.burn.dps * dt;
      this.burnTick -= dt;
      if (Math.random() < dt * 8) g.particles.add({ x: this.x + rand(-4, 4), y: this.y - rand(4, 12), vx: 0, vy: -20, life: 0.35, color: Math.random() < 0.5 ? '#f6a03a' : '#e0483e' });
      if (this.burnTick <= 0) {
        this.burnTick = 0.5;
        if (this.burnAcc > 0) g.damageEnemy(this, this.burnAcc, { raw: true, small: true, silent: true, element: 'fire' });
        this.burnAcc = 0;
      }
      if (this.burn && this.burn.t <= 0) this.burn = null;
      if (this.dead) return;
    }

    const dx = P.x - this.x, dy = P.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    let mx = 0, my = 0;
    let spd = this.speed;
    const disabled = this.freeze > 0 || this.stun > 0;

    if (!disabled) {
      const fn = BEHAVIOR[this.def.behavior || 'chase'] || BEHAVIOR.chase;
      const res = fn(this, g, dt, dx, dy, dist);
      mx = res[0]; my = res[1]; spd = res[2] ?? spd;
    }
    if (this.chill > 0) spd *= 0.5;
    if (this.root > 0) spd *= 0.15;
    this.anim += dt * (this.def.anim || 6) * (disabled ? 0 : this.chill > 0 ? 0.5 : 1);
    if (Math.abs(mx) > 0.1) this.face = mx > 0 ? 1 : -1;
    this.moving = !disabled && (Math.abs(mx) + Math.abs(my) > 0.1);

    // separation from neighbours
    let sx = 0, sy = 0;
    if (!this.boss) {
      const rr = this.r * 2;
      g.enemyHash.query(this.x, this.y, rr, (o) => {
        if (o === this || o.dead) return;
        const ox = this.x - o.x, oy = this.y - o.y;
        const d2 = ox * ox + oy * oy;
        const min = this.r + o.r;
        if (d2 >= min * min || d2 === 0) return;
        const d = Math.sqrt(d2);
        const push = (min - d) / min;
        sx += (ox / d) * push; sy += (oy / d) * push;
      });
    }
    const vx = mx * spd + sx * 40 + this.kbx;
    const vy = my * spd + sy * 40 + this.kby;
    const decay = Math.exp(-9 * dt);
    this.kbx *= decay; this.kby *= decay;
    g.world.move(this, vx * dt, vy * dt, Math.min(this.r, 7), this.flying);

    // contact damage
    const reach = this.r + P.r - 1;
    if (!this.hidden && this.z < 8 && dist2(this.x, this.y, P.x, P.y) < reach * reach && this.contactCd <= 0 && !disabled) {
      if (P.hurt(this.dmg, this)) {
        this.contactCd = 0.6;
        if (P.stats.thorns) g.damageEnemy(this, P.stats.thorns, { raw: true, knock: 120, fromX: P.x, fromY: P.y });
      }
    }
    // survivalmons it bumps into get hurt too
    if (!this.hidden && this.z < 8 && this.petCd <= 0 && !disabled) {
      for (const pet of P.pets) {
        if (pet.fainted) continue;
        const rr = this.r + 5;
        if (dist2(this.x, this.y, pet.x, pet.y) < rr * rr) { pet.hurt(this.dmg * 0.7); this.petCd = 0.7; break; }
      }
    }
  }

  draw(ctx, cam, t) {
    if (this.hidden) return;
    const a = this.art, s = this.spr;
    const fx = this.x - cam.x, fy = this.y - cam.y;
    const bodyW = a ? a.cw : s.w, bodyH = a ? a.ch : s.h;
    // shadow
    ctx.globalAlpha = 0.28; ctx.fillStyle = '#1a2a10';
    ctx.beginPath(); ctx.ellipse(fx, fy, Math.max(4, bodyW * 0.36), Math.max(2, bodyW * 0.13), 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    if (this.fainted) { this.drawFainted(ctx, fx, fy, t); return; }
    if (this.elite || this.catchable) {
      ctx.globalAlpha = 0.22 + 0.13 * Math.sin(t * 6);
      ctx.fillStyle = this.catchable ? '#7af0ff' : '#ffd84a';
      ctx.beginPath(); ctx.ellipse(fx, fy - bodyH / 2, bodyW * 0.7, bodyH * 0.62, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    let alpha;
    if (this.state === 'windup' && Math.floor(t * 20) % 2) alpha = 0.6;
    if (this.alpha < 1) alpha = this.alpha;
    let top, left;
    if (a) {
      const m = creatureMotion(a.motion, t, this.moving, this.wob);
      drawCreature(ctx, a, fx, fy - this.z, {
        left: this.face < 0, flash: this.flash > 0, alpha, ...m,
        outline: this.elite ? 'elite' : this.catchable ? 'catch' : undefined,
      });
      top = fy - this.z - m.bob - bodyH; left = fx - bodyW / 2;
    } else {
      const f = Math.floor(this.anim) % s.R.length, lf = this.face < 0;
      const img = this.flash > 0 ? (lf ? s.LF[f] : s.RF[f]) : this.elite ? (lf ? s.LE[f] : s.RE[f]) : (lf ? s.L[f] : s.R[f]);
      const hover = this.flying ? 6 + Math.sin(t * 4 + this.wob) * 2 : 0;
      left = Math.round(fx - s.ax); top = Math.round(fy - s.ay - hover - this.z);
      if (alpha !== undefined) ctx.globalAlpha = alpha;
      ctx.drawImage(img, left, top);
      ctx.globalAlpha = 1;
    }
    if (this.freeze > 0) {
      ctx.globalAlpha = 0.42; ctx.fillStyle = '#bfeaff';
      ctx.fillRect(left - 1, top + 1, bodyW + 2, bodyH - 1);
      ctx.globalAlpha = 0.85; ctx.fillStyle = '#ffffff';
      ctx.fillRect(left + 1, top + 2, 2, 1);
      ctx.globalAlpha = 1;
    } else if (this.chill > 0 && Math.floor(t * 4 + this.wob) % 3 === 0) {
      ctx.fillStyle = '#bfeaff'; ctx.fillRect(left + ((t * 30 + this.id) % bodyW | 0), top + 2, 1, 1);
    }
    if (this.stun > 0) {
      ctx.fillStyle = '#ffe07a';
      for (let i = 0; i < 3; i++) {
        const ang = t * 6 + (i * TAU) / 3;
        ctx.fillRect(Math.round(fx + Math.cos(ang) * 6), Math.round(top - 3 + Math.sin(ang) * 2), 1, 1);
      }
    }
    if (this.catchable) {
      const my = Math.round(top - 6 + Math.sin(t * 4) * 1.5);
      ctx.fillStyle = '#2b1d24'; ctx.fillRect(Math.round(fx) - 3, my - 1, 7, 7);
      ctx.fillStyle = '#7af0ff'; ctx.fillRect(Math.round(fx) - 2, my, 5, 5);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(fx) - 1, my + 1, 2, 2);
    }
    if ((this.elite || this.catchable) && this.hp < this.maxHp) {
      const w = 18, bx = Math.round(fx - w / 2), by = Math.round(fy + 3);
      ctx.fillStyle = '#2b1d24'; ctx.fillRect(bx - 1, by - 1, w + 2, 4);
      ctx.fillStyle = this.catchable ? '#7af0ff' : '#ffd84a';
      ctx.fillRect(bx, by, Math.max(0, Math.round((w * this.hp) / this.maxHp)), 2);
    }
  }

  // Knocked out, lying on its side with dizzy stars, waiting to be caught.
  drawFainted(ctx, fx, fy, t) {
    const a = this.art;
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    ctx.globalAlpha = 0.35 + 0.3 * pulse; ctx.strokeStyle = '#7af0ff'; ctx.lineWidth = 1;
    const rr = Math.max(10, (a ? a.ch : 14) * 0.75);
    ctx.beginPath(); ctx.ellipse(fx, fy, rr, rr * 0.4, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
    let h;
    if (a) {
      ctx.save();
      ctx.translate(fx, fy - a.cw / 2);
      ctx.rotate(this.face < 0 ? -Math.PI / 2 : Math.PI / 2);
      ctx.drawImage(this.face < 0 ? a.L : a.R, -(this.face < 0 ? a.w - a.ax : a.ax) / 2, -a.ay / 2 + a.ch / 2, a.w / 2, a.h / 2);
      ctx.restore();
      h = a.cw;
    } else {
      const s = this.spr; ctx.drawImage(s.R[0], Math.round(fx - s.ax), Math.round(fy - s.ay)); h = s.h;
    }
    ctx.fillStyle = '#ffe07a';
    for (let i = 0; i < 3; i++) {
      const ang = t * 5 + (i * TAU) / 3;
      const sx = Math.round(fx + Math.cos(ang) * 7), sy = Math.round(fy - h - 4 + Math.sin(ang) * 2);
      ctx.fillRect(sx, sy - 1, 1, 3); ctx.fillRect(sx - 1, sy, 3, 1);
    }
    // time left before it wakes up
    const frac = Math.max(0, this.faintT / FAINT_TIME);
    ctx.strokeStyle = '#2b1d24'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(fx, fy - h - 12, 4, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#7af0ff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(fx, fy - h - 12, 4, -Math.PI / 2, -Math.PI / 2 + TAU * frac); ctx.stroke();
  }
}

// ---------------------------------------------------------------- behaviours
// Each returns [dirX, dirY, speed?]
function seek(e, g, dx, dy, dist) {
  if (e.flying || dist < 40) return [dx / dist, dy / dist];
  const f = g.world.flowDir(e.x, e.y);
  return f ? [f.x, f.y] : [dx / dist, dy / dist];
}

const BEHAVIOR = {
  chase(e, g, dt, dx, dy, dist) { return seek(e, g, dx, dy, dist); },
  tank(e, g, dt, dx, dy, dist) { return seek(e, g, dx, dy, dist); },
  flyer(e, g, dt, dx, dy, dist) {
    e.wob += dt * 3;
    const px = -dy / dist, py = dx / dist;
    const w = Math.sin(e.wob) * 0.5;
    return [dx / dist + px * w, dy / dist + py * w];
  },
  charger(e, g, dt, dx, dy, dist) {
    e.timer -= dt;
    if (e.state === 'chase') {
      if (dist < 95 && e.timer <= 0) { e.state = 'windup'; e.timer = 0.45; e.lx = dx / dist; e.ly = dy / dist; }
      return seek(e, g, dx, dy, dist);
    }
    if (e.state === 'windup') { if (e.timer <= 0) { e.state = 'dash'; e.timer = 0.45; } return [0, 0]; }
    if (e.state === 'dash') {
      if (e.timer <= 0) { e.state = 'chase'; e.timer = rand(2, 3); }
      if (Math.random() < 30 * dt) g.particles.add({ x: e.x, y: e.y - 2, vx: 0, vy: 0, life: 0.25, color: '#c8c0b0' });
      return [e.lx, e.ly, 175];
    }
    return [0, 0];
  },
  ranged(e, g, dt, dx, dy, dist) {
    const d = e.def;
    e.fireT -= dt;
    if (e.fireT <= 0 && dist < d.range + 40) {
      e.fireT = d.fireCd * rand(0.85, 1.15);
      const a = Math.atan2(dy, dx);
      g.spawnProjectile({ x: e.x, y: e.y, vx: Math.cos(a) * 85, vy: Math.sin(a) * 85, r: 3, dmg: d.projDmg * (1 + g.stage / 1200), life: 3, spr: d.proj, hostile: true, z: 8 });
    }
    if (dist > d.range) return seek(e, g, dx, dy, dist);
    if (dist < d.range * 0.6) return [-dx / dist, -dy / dist, e.speed * 0.6];
    return [-dy / dist * 0.4, dx / dist * 0.4];
  },

  // ---------------------------------------------- bosses
  kingslime(e, g, dt, dx, dy, dist) {
    e.timer -= dt;
    if (e.state === 'chase') {
      if (e.timer <= 0) { e.state = 'prep'; e.timer = 0.6; }
      return seek(e, g, dx, dy, dist);
    }
    if (e.state === 'prep') {
      e.anim = 1;
      if (e.timer <= 0) {
        e.state = 'leap'; e.timer = 0.9;
        e.sx = e.x; e.sy = e.y; e.tx = g.player.x; e.ty = g.player.y;
        g.addEffect({ type: 'target', x: e.tx, y: e.ty, R: 46, life: 0.9 });
      }
      return [0, 0];
    }
    if (e.state === 'leap') {
      const k = 1 - e.timer / 0.9;
      e.x = e.sx + (e.tx - e.sx) * k; e.y = e.sy + (e.ty - e.sy) * k;
      e.z = Math.sin(k * Math.PI) * 60;
      if (e.timer <= 0) {
        e.z = 0; e.state = 'chase'; e.timer = rand(2.5, 3.5);
        g.shake(5, 0.3); Audio.play('explode');
        g.addEffect({ type: 'ring', x: e.x, y: e.y, R: 50, life: 0.4, color: '#6fd16a' });
        if (dist2(e.x, e.y, g.player.x, g.player.y) < 50 * 50) g.player.hurt(e.dmg * 1.2, e);
        for (let i = 0; i < 4; i++) g.spawnEnemy('slime', e.x + rand(-20, 20), e.y + rand(-20, 20));
      }
      return [0, 0];
    }
    return [0, 0];
  },
  treant(e, g, dt, dx, dy, dist) {
    e.timer -= dt; e.t2 -= dt;
    if (e.timer <= 0) {
      e.timer = 3.2;
      const P = g.player;
      for (let i = 0; i < 6; i++) {
        const x = P.x + (i === 0 ? 0 : rand(-70, 70)), y = P.y + (i === 0 ? 0 : rand(-50, 50));
        g.spawnZone({
          kind: 'hazard', x, y, r: 16, life: 1.0, tick: 5, firstTick: 0.85,
          onTick(g2, z) {
            g2.particles.burst(z.x, z.y - 4, { n: 10, colors: ['#7a4a2a', '#4fa34a'], speed: 60, life: 0.4 });
            g2.addEffect({ type: 'flashring', x: z.x, y: z.y, R: 14, life: 0.25, color: '#7a4a2a' });
            if (dist2(z.x, z.y, g2.player.x, g2.player.y) < 18 * 18) g2.player.hurt(e.dmg, e);
          },
        });
      }
    }
    if (e.t2 <= 0) {
      e.t2 = 9;
      for (let i = 0; i < 6; i++) g.spawnEnemy('shroom', e.x + rand(-30, 30), e.y + rand(-20, 20));
    }
    return seek(e, g, dx, dy, dist);
  },
  colossus(e, g, dt, dx, dy, dist) {
    e.timer -= dt; e.t2 -= dt;
    if (e.state === 'windup') {
      if (e.timer <= 0) {
        e.state = 'chase'; e.timer = 2.4;
        g.shake(6, 0.35); Audio.play('explode');
        g.addEffect({ type: 'ring', x: e.x, y: e.y, R: 80, life: 0.45, color: '#c4beb4' });
        if (dist < 80) g.player.hurt(e.dmg * 1.3, e);
      }
      return [0, 0];
    }
    if (e.timer <= 0) {
      e.timer = 2.6;
      const a = Math.atan2(dy, dx);
      for (const off of [-0.25, 0, 0.25]) g.spawnProjectile({ x: e.x, y: e.y, vx: Math.cos(a + off) * 115, vy: Math.sin(a + off) * 115, r: 6, dmg: e.dmg * 0.65, life: 3.5, spr: 'p_boulder', hostile: true, spin: 6, z: 14 });
    }
    if (e.t2 <= 0 && dist < 90) { e.t2 = 6; e.state = 'windup'; e.timer = 0.7; g.addEffect({ type: 'target', x: e.x, y: e.y, R: 80, life: 0.7 }); }
    return seek(e, g, dx, dy, dist);
  },
  alpha(e, g, dt, dx, dy, dist) {
    e.t3 -= dt;
    if (e.t3 <= 0) {
      e.t3 = 11;
      g.banner('The Alpha howls!', '#c8a8ff');
      for (let i = 0; i < 6; i++) { const p = g.director.spawnPos(false); if (p) g.spawnEnemy('wolf', p.x, p.y); }
    }
    const r = BEHAVIOR.charger(e, g, dt, dx, dy, dist);
    if (e.state === 'dash') return [r[0], r[1], 270];
    if (e.state === 'chase' && e.timer > 1.2) e.timer = 1.2;
    return r;
  },
  nightlord(e, g, dt, dx, dy, dist) {
    e.timer -= dt; e.t2 -= dt; e.t3 -= dt;
    if (e.hidden) {
      if (e.timer <= 0) {
        e.hidden = false;
        const a = rand(0, TAU);
        e.x = g.player.x + Math.cos(a) * 110; e.y = g.player.y + Math.sin(a) * 80;
        g.particles.burst(e.x, e.y - 20, { n: 30, colors: ['#c050ff', '#3a2a5a'], speed: 90, life: 0.5 });
        e.timer = 2;
      }
      return [0, 0];
    }
    if (e.timer <= 0) {
      e.timer = 2.1;
      const n = 16, off = rand(0, TAU);
      for (let i = 0; i < n; i++) {
        const a = off + (i * TAU) / n;
        g.spawnProjectile({ x: e.x, y: e.y, vx: Math.cos(a) * 75, vy: Math.sin(a) * 75, r: 3, dmg: e.dmg * 0.6, life: 5, spr: 'p_dark_orb', hostile: true, z: 18 });
      }
      Audio.play('zap');
    }
    if (e.t2 <= 0) {
      e.t2 = 6.5;
      e.hidden = true; e.timer = 0.8;
      g.particles.burst(e.x, e.y - 20, { n: 30, colors: ['#c050ff', '#3a2a5a'], speed: 90, life: 0.5 });
      return [0, 0];
    }
    if (e.t3 <= 0) {
      e.t3 = 9;
      for (let i = 0; i < 8; i++) { const p = g.director.spawnPos(true); if (p) g.spawnEnemy('wisp', p.x, p.y); }
    }
    if (dist < 90) return [-dx / dist, -dy / dist, e.speed * 0.6];
    return [dx / dist, dy / dist];
  },
};
