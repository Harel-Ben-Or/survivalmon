// Monsters and bosses.
import { ENEMIES, hpScale } from '../content/creatures.js';
import { XP_PACE } from '../systems/director.js';
import { SPECIES, TYPES } from '../content/species.js';
import { MON } from '../gfx/assets.js';
import { CREATURE, creatureMotion, drawCreature, ANIM_FPS } from '../gfx/art.js';

export const FAINT_TIME = 25;
export const WILD_TIME = 25; // seconds a wild survivalmon stays before it runs away
import { rand, TAU, dist2 } from '../core/util.js';
import { Audio } from '../core/audio.js';

let nextId = 1;
const COLORS = {
  slime: ['#6fd16a', '#3e9a46'], slime_blue: ['#5ab0f0', '#3a78c0'], slime_red: ['#f06a5a', '#ffd84a'], bat: ['#7a4fb0', '#9a6ad0'],
  shroom: ['#e0483e', '#f2e2c4'], shroom_blue: ['#4a7ad8', '#f2e2c4'], wisp: ['#cfeaff', '#8fb8e8'], beetle: ['#2f7f9f', '#6fc4e0'],
  wolf: ['#8d8fa6', '#5d5f78'], spore: ['#b07ad8', '#e6c8ff'], imp: ['#d84a3a', '#7a2a3a'], golem: ['#9a948a', '#6cc24e'],
  snowgolem: ['#e8f4ff', '#2a1a30'], sawbeetle: ['#b08a50', '#c0304a'], cinderimp: ['#ff7a3a', '#2a1a20'], wiltsprite: ['#7a5a8a', '#c0304a'],
  thornling: ['#4a3a30', '#c0304a'], bogcrab: ['#3a3a4a', '#c0304a'], poacher: ['#8a6a4a', '#d8c8a0'], slinger: ['#4a6a3a', '#d8c8a0'], drone: ['#9aa0aa', '#ff4a4a'],
};
// Survivalmons take this share of a monster's damage (they fight up close; the hero can dodge)
const PET_HIT = 0.5;
// How far the hero's lantern light reaches for night creatures
export const LANTERN = 70;
// Blight creatures splatter black ink and red sparks
const BLIGHT_COLORS = ['#1e1424', '#3a2448', '#c0304a'];

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
    // the Blight is weaker in daylight and stronger after dark (Game.darkness); wild survivalmons aren't the Blight
    this.g = g;
    this.blight = !opts.wild || !!opts.corrupted;
    const dk = this.blight ? this.darkMul('hp') : 1;
    const tier = g.tierMult || { hp: 1, dmg: 1, xp: 1 }; // the gate this run went through
    this.maxHp = this.hp = def.hp * hpMul * (this.elite ? 9 : 1) * dk * tier.hp;
    this.baseSpeed = def.speed * (this.boss ? 1 : rand(0.9, 1.1)) * (this.elite ? 1.08 : 1);
    this.baseDmg = def.dmg * (this.boss ? 1 : 1 + g.stage / 1200) * (this.elite ? 1.4 : 1) * tier.dmg;
    this.xp = def.xp * (this.elite ? 12 : 1) * XP_PACE * tier.xp;
    this.knockRes = this.elite ? Math.max(0.6, def.knockRes || 0) : def.knockRes || 0;
    this.flying = def.behavior === 'flyer' || !!def.flying;
    const look = opts.wild || def.look || type;
    this.spr = MON[look];
    this.art = CREATURE[look];
    if (!this.art && !this.spr) this.spr = MON.slime; // picture not loaded: never crash over it
    this.scale = def.scale || 1;
    this.hgt = (this.art ? this.art.ch : this.spr.h) * this.scale;
    // a survivalmon the Snare gang controls with the Blight: dark, it doesn't run away, and
    // defeating it frees it (it joins you like a caught one)
    this.corrupted = !!opts.corrupted;
    // A wild survivalmon: tougher, glows cyan, and is caught when you defeat it.
    this.wild = opts.wild || null;
    this.catchable = (!!opts.catchable || !!this.wild) && !this.boss;
    if (this.wild) { this.fleeT = this.corrupted ? Infinity : WILD_TIME; this.wildName = SPECIES[this.wild].name; }
    if (this.catchable) {
      this.maxHp = this.hp = def.hp * hpMul * 6 * tier.hp;
      this.xp = def.xp * 6 * XP_PACE * tier.xp;
      this.knockRes = Math.max(0.5, this.knockRes);
    }
    this.fainted = false; this.faintT = 0; this.moving = false;
    this.colors = this.corrupted ? ['#3a2448', '#c050ff', '#ffffff'] : this.wild ? [TYPES[SPECIES[this.wild].type].color, '#ffffff'] : COLORS[type] || BLIGHT_COLORS;
    this.atkT = -1; // time into its attack animation (-1 = not attacking)
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

  // Plays its attack animation, if it has one
  swing() { if (this.art?.anim?.attack && this.atkT < 0) this.atkT = 0; }

  update(g, dt) {
    const P = g.player;
    if (this.atkT >= 0) { this.atkT += dt; if (this.atkT * ANIM_FPS.attack >= 6) this.atkT = -1; }
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
    if (this.wild && !this.corrupted) {
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
    // poison stacks (the Poison element): each stack hurts every second until it wears off
    if (this.poison) {
      const p = this.poison;
      p.t -= dt;
      this.poisonAcc = (this.poisonAcc || 0) + p.dps * p.stacks * dt;
      if (Math.random() < dt * 5) g.particles.add({ x: this.x + rand(-4, 4), y: this.y - rand(4, 12), vx: 0, vy: -14, life: 0.4, color: Math.random() < 0.5 ? '#8ad04a' : '#c8f080' });
      if ((this.poisonTick = (this.poisonTick ?? 0.5) - dt) <= 0) {
        this.poisonTick = 0.5;
        if (this.poisonAcc > 0) g.damageEnemy(this, this.poisonAcc, { raw: true, small: true, silent: true, element: 'poison' });
        this.poisonAcc = 0;
      }
      if (p.t <= 0) this.poison = null;
      if (this.dead) return;
    }
    // glowing (the Light element): a few sparkles while it lasts
    if (this.glow > 0) {
      this.glow -= dt;
      if (Math.random() < dt * 6) g.particles.add({ x: this.x + rand(-6, 6), y: this.y - rand(4, 16), vx: 0, vy: -10, life: 0.4, color: Math.random() < 0.5 ? '#fff6c8' : '#ffe07a' });
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
    if (this.def.night && dist < LANTERN) {
      spd *= 0.75; // the hero's lantern burns night creatures: slower, and they take more damage (Combat.lightHurt)
      if (Math.random() < dt * 6) g.particles.add({ x: this.x + rand(-5, 5), y: this.y - rand(6, 16), vx: 0, vy: -18, life: 0.5, color: Math.random() < 0.5 ? '#e8d8ff' : '#9a70c0' });
    }
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
        this.swing();
        if (P.stats.thorns) g.damageEnemy(this, P.stats.thorns, { raw: true, knock: 120, fromX: P.x, fromY: P.y });
      }
    }
    // survivalmons it bumps into get hurt too
    if (!this.hidden && this.z < 8 && this.petCd <= 0 && !disabled) {
      for (const pet of P.pets) {
        if (pet.fainted) continue;
        const rr = this.r + 5;
        if (dist2(this.x, this.y, pet.x, pet.y) < rr * rr) { pet.hurt(this.dmg * PET_HIT); this.petCd = 0.7; this.swing(); break; }
      }
    }
  }

  // How much stronger the dark makes it right now (bosses feel half of it)
  darkMul(k) {
    if (!this.blight) return 1;
    const m = this.g.dark?.[k] ?? 1;
    return this.boss ? 1 + (m - 1) / 2 : m;
  }
  get dmg() { return this.baseDmg * this.darkMul('dmg'); }
  get speed() { return this.baseSpeed * this.darkMul('speed'); }

  draw(ctx, cam, t) {
    if (this.hidden) return;
    const a = this.art, s = this.spr;
    const fx = this.x - cam.x, fy = this.y - cam.y;
    const bodyW = (a ? a.cw : s.w) * this.scale, bodyH = (a ? a.ch : s.h) * this.scale;
    // shadow
    ctx.globalAlpha = 0.28; ctx.fillStyle = '#1a2a10';
    ctx.beginPath(); ctx.ellipse(fx, fy, Math.max(4, bodyW * 0.36), Math.max(2, bodyW * 0.13), 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    if (this.fainted) { this.drawFainted(ctx, fx, fy, t); return; }
    if (this.elite || this.catchable) {
      ctx.globalAlpha = 0.22 + 0.13 * Math.sin(t * 6);
      ctx.fillStyle = this.corrupted ? '#a040e0' : this.catchable ? '#7af0ff' : '#ffd84a';
      ctx.beginPath(); ctx.ellipse(fx, fy - bodyH / 2, bodyW * 0.7, bodyH * 0.62, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    let alpha;
    if ((this.state === 'windup' || this.state === 'swell') && Math.floor(t * 20) % 2) alpha = 0.6;
    if (this.alpha < 1) alpha = this.alpha;
    let top, left;
    if (a) {
      const m = creatureMotion(a.motion, t, this.moving, this.wob, !!a.anim);
      if (a.anim) { m.anim = a.anim.idle && !this.moving ? 'idle' : 'move'; m.at = t + this.wob; }
      if (this.state === 'swell' && a.anim?.attack) { m.anim = 'attack'; m.frame = Math.min(5, Math.floor((0.7 - this.timer) * 9)); }
      else if (this.atkT >= 0 && a.anim?.attack) { m.anim = 'attack'; m.frame = Math.floor(this.atkT * ANIM_FPS.attack); }
      m.sx *= this.scale; m.sy *= this.scale; m.bob *= this.scale;
      drawCreature(ctx, a, fx, fy - this.z, {
        left: this.face < 0, flash: this.flash > 0, alpha, ...m, blight: this.corrupted,
        outline: this.elite ? 'elite' : this.catchable && !this.corrupted ? 'catch' : undefined,
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
      ctx.fillStyle = this.corrupted ? '#c050ff' : '#7af0ff'; ctx.fillRect(Math.round(fx) - 2, my, 5, 5);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(fx) - 1, my + 1, 2, 2);
    }
    if ((this.elite || this.catchable) && this.hp < this.maxHp) {
      const w = 18, bx = Math.round(fx - w / 2), by = Math.round(fy + 3);
      ctx.fillStyle = '#2b1d24'; ctx.fillRect(bx - 1, by - 1, w + 2, 4);
      ctx.fillStyle = this.corrupted ? '#c050ff' : this.catchable ? '#7af0ff' : '#ffd84a';
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
      if (dist < 95 && e.timer <= 0) { e.state = 'windup'; e.timer = 0.45; e.lx = dx / dist; e.ly = dy / dist; e.swing(); }
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
      e.swing();
      const a = Math.atan2(dy, dx);
      g.spawnProjectile({ x: e.x, y: e.y, vx: Math.cos(a) * 85, vy: Math.sin(a) * 85, r: 3, dmg: d.projDmg * (1 + g.stage / 1200), life: 3, spr: d.proj, hostile: true, z: 8 });
    }
    if (dist > d.range) return seek(e, g, dx, dy, dist);
    if (dist < d.range * 0.6) return [-dx / dist, -dy / dist, e.speed * 0.6];
    return [-dy / dist * 0.4, dx / dist * 0.4];
  },

  // Nightshade Witch: floats at a distance and lobs globs of venom where the hero stands. A red ring
  // warns where each lands; it leaves a pool of poison that hurts the hero (and survivalmons) inside.
  witch(e, g, dt, dx, dy, dist) {
    const d = e.def;
    e.fireT -= dt;
    if (e.fireT <= 0 && dist < d.range + 50) {
      e.fireT = d.fireCd * rand(0.85, 1.15);
      e.swing();
      const P = g.player, T = 0.9, R = 22;
      const sx = e.x, sy = e.y - 12, tx = P.x + rand(-12, 12), ty = P.y + rand(-9, 9);
      const dmg = d.projDmg * (1 + g.stage / 1200) * (g.tierMult?.dmg || 1) * e.darkMul('dmg');
      g.spawnZone({ kind: 'hazard', x: tx, y: ty, r: R, life: T, tick: 99, firstTick: T });
      g.spawnProjectile({
        x: sx, y: sy, r: 0, dmg: 0, pierce: Infinity, life: T, spr: 'p_spore', fx: 'glob_venewt', fxSpin: true, seed: Math.random(), noHit: true, scale: 1.4,
        update(g2, p) { const k = Math.min(1, p.age / T); p.x = sx + (tx - sx) * k; p.y = sy + (ty - sy) * k; p.z = 10 + Math.sin(k * Math.PI) * 34; return true; },
        onExpire(g2) {
          Audio.play('fire');
          g2.particles.burst(tx, ty - 4, { n: 16, colors: ['#9af040', '#3a7a20', '#e0ffb0'], speed: 70, life: 0.5 });
          g2.spawnZone({
            kind: 'spores', fx: 'zone_venewt', seed: Math.random(), x: tx, y: ty, r: R, life: 4, tick: 0.5, firstTick: 0,
            onTick(g3, z) {
              const Q = g3.player;
              if (dist2(z.x, z.y, Q.x, Q.y) < (z.r + 2) ** 2) Q.hurt(dmg * 0.45, e);
              for (const pet of Q.pets) if (!pet.fainted && dist2(z.x, z.y, pet.x, pet.y) < z.r * z.r) pet.hurt(dmg * 0.3);
            },
          });
        },
      });
    }
    if (dist > d.range) return seek(e, g, dx, dy, dist);
    if (dist < d.range * 0.65) return [-dx / dist, -dy / dist, e.speed * 0.8];
    return [-dy / dist * 0.5, dx / dist * 0.5];
  },

  // ---------------------------------------------- bosses
  kingslime(e, g, dt, dx, dy, dist) {
    e.timer -= dt;
    if (e.state === 'chase') {
      if (e.timer <= 0) { e.state = 'prep'; e.timer = 0.6; e.swing(); }
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
        g.addEffect({ type: 'ring', x: e.x, y: e.y, R: 50, life: 0.4, color: e.def.minion === 'blob' ? '#8a3aa0' : '#6fd16a' });
        if (dist2(e.x, e.y, g.player.x, g.player.y) < 50 * 50) g.player.hurt(e.dmg * 1.2, e);
        for (let i = 0; i < 4; i++) g.spawnEnemy(e.def.minion || 'slime', e.x + rand(-20, 20), e.y + rand(-20, 20));
      }
      return [0, 0];
    }
    return [0, 0];
  },
  treant(e, g, dt, dx, dy, dist) {
    e.timer -= dt; e.t2 -= dt;
    if (e.timer <= 0) {
      e.timer = 3.2;
      e.swing();
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
      for (let i = 0; i < 6; i++) g.spawnEnemy(e.def.minion || 'shroom', e.x + rand(-30, 30), e.y + rand(-20, 20));
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
    if (e.t2 <= 0 && dist < 90) { e.t2 = 6; e.state = 'windup'; e.timer = 0.7; e.swing(); g.addEffect({ type: 'target', x: e.x, y: e.y, R: 80, life: 0.7 }); }
    return seek(e, g, dx, dy, dist);
  },

  // ---------------------------------------------- newer monsters
  // Walks up to you, swells for a moment, then bursts (hurting you and your survivalmons nearby)
  bloater(e, g, dt, dx, dy, dist) {
    if (e.state === 'swell') {
      e.timer -= dt;
      if (e.timer <= 0) burst(e, g);
      return [0, 0];
    }
    if (dist < 34) {
      e.state = 'swell'; e.timer = 0.7;
      g.addEffect({ type: 'target', x: e.x, y: e.y, R: e.def.boomR || 30, life: 0.7 });
      return [0, 0];
    }
    return seek(e, g, dx, dy, dist);
  },
  // Keeps its distance and throws nets that slow you down
  netter(e, g, dt, dx, dy, dist) {
    const d = e.def;
    e.fireT -= dt;
    if (e.fireT <= 0 && dist < d.range + 30) {
      e.fireT = d.fireCd * rand(0.85, 1.15);
      e.swing();
      throwNet(e, g, Math.atan2(dy, dx), d.projDmg * (1 + g.stage / 1200));
    }
    if (dist > d.range) return seek(e, g, dx, dy, dist);
    if (dist < d.range * 0.55) return [-dx / dist, -dy / dist, e.speed * 0.6];
    return [-dy / dist * 0.4, dx / dist * 0.4];
  },
  // Goes for a fainted survivalmon, grabs it and flies off with it. Defeat it to get the
  // survivalmon back on its feet. With no one to grab it just harasses you.
  drone(e, g, dt, dx, dy, dist) {
    const P = g.player;
    if (e.carry) {
      const pet = e.carry;
      pet.x = e.x; pet.y = e.y + 1;
      e.escT = (e.escT || 0) + dt;
      if (e.escT > 10 || dist > Math.max(g.view.w, g.view.h) * 0.8) {
        pet.carriedBy = null; e.carry = null; e.dead = true;
        g.toast(`The Cage Drone got away! ${pet.name} wriggled free, but it's still knocked out.`);
        return [0, 0];
      }
      return [-dx / dist, -dy / dist, e.speed * 0.75];
    }
    const target = P.pets.find((p) => p.fainted && !p.carriedBy);
    if (target) {
      const tx = target.x - e.x, ty = target.y - e.y, td = Math.hypot(tx, ty) || 1;
      if (td < 9) {
        e.carry = target; target.carriedBy = e; e.escT = 0; e.swing();
        g.feed(`A Cage Drone grabbed ${target.name}! Defeat it to get it back`, '#ff8a7a');
        Audio.play('zap');
        return [0, 0];
      }
      return [tx / td, ty / td, e.speed * 1.2];
    }
    return BEHAVIOR.flyer(e, g, dt, dx, dy, dist);
  },
  // The Snare gang's boss: calls in the gang, throws spreads of nets and stomps when you're close
  snareboss(e, g, dt, dx, dy, dist) {
    e.t2 -= dt; e.t3 -= dt; e.fireT -= dt;
    if (e.state === 'windup') {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = 'chase';
        g.shake(6, 0.35); Audio.play('explode');
        g.addEffect({ type: 'ring', x: e.x, y: e.y, R: 80, life: 0.45, color: '#c0304a' });
        if (dist < 80) g.player.hurt(e.dmg * 1.3, e);
      }
      return [0, 0];
    }
    if (e.t3 <= 0) {
      e.t3 = 12; e.swing();
      g.feed('Grimjaw calls the gang!', '#ff8a7a');
      for (const type of ['poacher', 'poacher', 'slinger', 'drone']) {
        const p = g.director.spawnPos(type === 'drone');
        if (p) g.spawnEnemy(type, p.x, p.y);
      }
    }
    if (e.fireT <= 0 && dist < 170) {
      e.fireT = 3.4; e.swing();
      const a = Math.atan2(dy, dx);
      for (const off of [-0.32, 0, 0.32]) throwNet(e, g, a + off, e.dmg * 0.3, 105);
    }
    if (e.t2 <= 0 && dist < 85) { e.t2 = 5; e.state = 'windup'; e.timer = 0.7; e.swing(); g.addEffect({ type: 'target', x: e.x, y: e.y, R: 80, life: 0.7 }); return [0, 0]; }
    return seek(e, g, dx, dy, dist);
  },
  alpha(e, g, dt, dx, dy, dist) {
    e.t3 -= dt;
    if (e.t3 <= 0) {
      e.t3 = 11;
      g.feed('The Alpha howls!', '#c8a8ff');
      for (let i = 0; i < 6; i++) { const p = g.director.spawnPos(false); if (p) g.spawnEnemy(e.def.minion || 'wolf', p.x, p.y); }
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
      e.swing();
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
      for (let i = 0; i < 8; i++) { const p = g.director.spawnPos(true); if (p) g.spawnEnemy(e.def.minion || 'wisp', p.x, p.y); }
    }
    if (dist < 90) return [-dx / dist, -dy / dist, e.speed * 0.6];
    return [dx / dist, dy / dist];
  },
};

// A Bloater bursting: hurts you and your survivalmons within reach, then it's gone.
function burst(e, g) {
  if (e.dead) return;
  const R = e.def.boomR || 30, P = g.player, dmg = (e.def.boomDmg || 14) * (1 + g.stage / 1200);
  g.addEffect({ type: 'explosion', x: e.x, y: e.y, R, life: 0.3, color: '#c0304a', glow: true });
  g.particles.burst(e.x, e.y - 4, { n: 22, colors: BLIGHT_COLORS, speed: 120, life: 0.5, size: 2 });
  g.shake(2, 0.2); Audio.play('explode');
  if (dist2(e.x, e.y, P.x, P.y) < R * R) P.hurt(dmg, e);
  for (const pet of P.pets) if (!pet.fainted && dist2(e.x, e.y, pet.x, pet.y) < R * R) pet.hurt(dmg * PET_HIT);
  e.burst = true;
  g.killEnemy(e, {});
}

// A thrown net: a hostile shot that slows whoever it hits
function throwNet(e, g, a, dmg, speed = 95) {
  g.spawnProjectile({ x: e.x, y: e.y - 4, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 5, dmg, life: 1.8, hostile: true, z: 8, slow: 1.6, draw: drawNet });
}
function drawNet(ctx, p, cam) {
  const x = Math.round(p.x - cam.x), y = Math.round(p.y - cam.y - p.z);
  ctx.save(); ctx.translate(x, y); ctx.rotate(p.age * 7);
  ctx.strokeStyle = '#e0d0a8'; ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i += 2) {
    ctx.beginPath(); ctx.moveTo(i + 0.5, -4); ctx.lineTo(i + 0.5, 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4, i + 0.5); ctx.lineTo(4, i + 0.5); ctx.stroke();
  }
  ctx.strokeStyle = '#6a4a2a'; ctx.strokeRect(-4.5, -4.5, 9, 9);
  ctx.restore();
}
