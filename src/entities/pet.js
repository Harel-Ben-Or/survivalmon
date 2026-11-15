// A survivalmon in a run: trails the hero, fights with every attack skill it has (its own unique
// skill plus any it inherited), carries its passive skills, and has its own HP. It can faint; the
// HP it ends the run with is saved, and the Clinic heals it.
import { CREATURE, creatureMotion, drawCreature, snap, ANIM_FPS } from '../gfx/art.js';
import { SPECIES } from '../content/species.js';
import { TIER_POWER, PASSIVES } from '../content/skills.js';
import { Box } from '../systems/collection.js';
import { rand, TAU } from '../core/util.js';
import { Audio } from '../core/audio.js';

const TEAM0 = { dmg: 0, hp: 0, haste: 0, def: 0, crit: 0 };

// A skill's numbers at its tier. S tier also gets a small twist that depends on how it attacks.
function tiered(sp, t) {
  const q = { ...sp.q }, k = TIER_POWER[t];
  q.dmg *= k;
  if (q.heal) q.heal *= k;
  if (t === 4) {
    if (sp.arch === 'shooter' || sp.arch === 'lobber') q.count = (q.count || 1) + 1;
    else if (sp.arch === 'zapper') q.chains = (q.chains || 3) + 2;
    else if (sp.arch === 'roller') q.cd *= 0.75;
    else if (sp.arch === 'aura') q.radius = (q.radius || 30) + 8;
    else if (sp.arch === 'slam') q.radius = (q.radius || 36) + 10;
  }
  return q;
}

export class Pet {
  constructor(g, mon) {
    this.g = g; this.mon = mon;
    this.boost = new Map(); // skill -> extra tiers from level-up cards (this run only)
    this.refresh();
    const P = g.player;
    this.x = P.x + rand(-10, 10); this.y = P.y + rand(-10, 10);
    this.hp = this.maxHp * (mon.hp ?? 1);
    this.fainted = this.hp <= 0;
    this.face = 1; this.anim = rand(0, 2); this.seed = rand(0, 10);
    this.state = 'follow'; this.rollT = 0; this.hits = new Set();
    this.moving = false; this.hopT = 0; this.flash = 0; this.windUsed = false;
    this.atkT = -1;                      // time into its attack animation (-1 = not attacking)
    this.faintT = this.fainted ? 99 : 0; // time since it fainted (already down: show it lying there)
  }
  // Plays the attack animation (if it has one) as a skill fires
  swing() { if (this.art?.anim?.attack) this.atkT = 0; }
  // Re-read species, skills and stats after a level up or evolution.
  refresh() {
    const sp = this.sp = SPECIES[this.mon.species];
    this.species = sp.id;
    this.id = sp.line; // combos refer to the species line (Emberpup, not Cinderhound)
    this.art = CREATURE[sp.id];
    this.pass = {};
    for (const s of this.mon.skills) if (s.k === 'p') this.pass[s.id] = Math.max(this.pass[s.id] || 0, PASSIVES[s.id].vals[this.tierOf(s)]);
    this.attacks = this.mon.skills.filter((s) => s.k === 'u' && SPECIES[s.sp]).map((s) => ({
      s, arch: SPECIES[s.sp].arch, q: tiered(SPECIES[s.sp], this.tierOf(s)), cd: rand(0.5, 1.5), healT: rand(2, 5),
    }));
    this.q = this.attacks[0]?.q || {};
    const prev = this.maxHp;
    this.maxHp = Math.round(sp.hp * (1 + 0.12 * (this.mon.level - 1)) * (1 + (this.pass.heart || 0)) * Box.speciesMul(sp.id) * (1 + this.team.hp));
    if (prev && this.hp > 0) this.hp = Math.min(this.maxHp, this.hp * (this.maxHp / prev));
  }
  // A skill's tier in this run: its rolled tier plus any level-up boosts (S is the top)
  tierOf(s) { return Math.min(4, s.t + (this.boost?.get(s) || 0)); }
  get team() { return this.g.team || TEAM0; }
  get name() { return this.sp.name; }
  get power() {
    return (1 + 0.1 * (this.mon.level - 1)) * (1 + 0.04 * (this.g.player.level - 1)) * Box.speciesMul(this.species) * (1 + this.team.dmg + (this.g.cry || 0));
  }
  // Added to the hero's stats while this survivalmon is on the team
  passives() {
    let armor = 0, magnet = 0;
    for (const a of this.attacks) { armor += a.q.armor || 0; magnet += a.q.magnet || 0; }
    return { armor, magnet };
  }

  hurt(dmg) {
    if (this.fainted || this.g.mode !== 'world') return;
    const d = dmg * (1 - (this.pass.hide || 0)) * (1 - this.team.def);
    this.hp -= d;
    this.flash = 0.12;
    this.calmT = 0;
    if (this.hp > 0) return;
    if (this.pass.wind && !this.windUsed) {
      this.windUsed = true;
      this.hp = this.maxHp * this.pass.wind;
      this.g.toast(`${this.name} got back up! (Second Wind)`);
      this.g.particles.burst(this.x, this.y - 8, { n: 14, colors: ['#9af08a', '#ffffff'], speed: 50, life: 0.5, up: 20 });
      return;
    }
    if (this.g.reviveFeather) {
      this.g.reviveFeather = false;
      this.hp = this.maxHp * 0.5;
      this.g.toast(`${this.name} got back up! (Revive Feather)`);
      return;
    }
    this.hp = 0;
    this.fainted = true;
    this.faintT = 0;
    this.atkT = -1;
    this.state = 'follow';
    this.g.toast(`${this.name} fainted! Heal it at the Clinic.`);
    this.g.player.recompute();
    this.g.applyTeamPassives?.();
    this.g.particles.burst(this.x, this.y - 6, { n: 12, color: '#ffffff', speed: 40, life: 0.5 });
    Audio.play('hurt');
  }
  heal(n) {
    if (this.fainted || n <= 0) return;
    this.hp = Math.min(this.maxHp, this.hp + n);
  }

  gainXp(n) {
    const g = this.g;
    const levels = Box.addXp(this.mon, n * g.player.stats.petXp);
    if (!levels.length) return;
    this.refresh();
    g.player.recompute();
    g.particles.burst(this.x, this.y - 8, { n: 14, colors: ['#ffe07a', '#ffffff'], speed: 50, life: 0.6, up: 20 });
    g.toast(`${this.name} grew to Lv ${levels[levels.length - 1]}!`);
    Audio.play('levelup');
    g.checkEvolve();
  }

  update(dt, index, inRoom) {
    const g = this.g, P = g.player;
    this.flash = Math.max(0, this.flash - dt);
    // carried off by a Cage Drone: it moves us; we just hang there
    if (this.carriedBy) { if (!this.carriedBy.dead) { if (this.fainted) this.faintT += dt; return; } this.carriedBy = null; }
    if (this.atkT >= 0) { this.atkT += dt; if (this.atkT * ANIM_FPS.attack >= 6) this.atkT = -1; }
    if (this.fainted) this.faintT += dt;
    // out of the fight for a few seconds, a survivalmon slowly gets its breath back
    this.calmT = (this.calmT || 0) + dt;
    if (!this.fainted && g.mode === 'world' && this.calmT > 4 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.02 * dt);
    const trail = P.trail;
    const need = (index + 1) * 10;
    const side = P.faceAngle + (index % 2 ? -0.8 : 0.8);
    const tp = trail.length > need ? trail[need]
      : { x: P.x - Math.cos(side) * 22 * (index + 1), y: P.y - Math.sin(side) * 9 * (index + 1) };
    this.hopT = Math.max(0, this.hopT - dt);
    if (this.state === 'roll' && !this.fainted) { this.updateRoll(dt); return; }
    const dx = tp.x - this.x, dy = tp.y - this.y;
    const d = Math.hypot(dx, dy);
    this.moving = d > 3;
    if (d > 300) { this.x = tp.x; this.y = tp.y; }
    else if (d > 1) {
      const sp = Math.min(d * 7, Math.max(P.stats.speed * 1.25, d * 4)) * (this.fainted ? 0.6 : 1);
      this.x += (dx / d) * sp * dt; this.y += (dy / d) * sp * dt;
      if (Math.abs(dx) > 1) this.face = dx > 0 ? 1 : -1;
    }
    this.anim += dt * (this.moving ? 8 : 2);
    if (inRoom || this.fainted) return;
    const rate = (g.combo('bestfriends') ? 1.5 : 1) / ((1 - (this.pass.swift || 0)) * (1 - this.team.haste));
    for (const a of this.attacks) {
      a.cd -= dt * rate;
      if (a.cd <= 0) a.cd = ARCH[a.arch](this, g, a.q) ?? 0.4;
      if (a.q.heal) {
        a.healT -= dt;
        if (a.healT <= 0) {
          a.healT = a.q.healCd || 9;
          const amt = a.q.heal * this.power;
          P.heal(amt + P.stats.maxHp * 0.03);
          for (const o of P.pets) o.heal(amt * 2);
          g.particles.burst(P.x, P.y - 10, { n: 10, color: '#9af08a', speed: 30, life: 0.6, up: 20 });
        }
      }
    }
  }

  updateRoll(dt) {
    const g = this.g, q = this.rollQ || this.q;
    this.rollT -= dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.anim += dt * 12;
    this.moving = true;
    g.enemiesInRadius(this.x, this.y, 8, (e) => {
      if (this.hits.has(e.id)) return;
      this.hits.add(e.id);
      const sp = Math.hypot(this.vx, this.vy) || 1;
      const rockslide = this.id === 'pebblet' && g.combo('rockslide');
      g.damageEnemy(e, q.dmg * this.power, {
        pet: true, petRef: this, knock: q.knock || 100, kx: this.vx / sp, ky: this.vy / sp,
        stun: Math.max(q.stun || 0, rockslide ? 0.6 : 0), chill: q.chill, burn: q.burn,
      });
      if (q.leech) g.player.heal(q.leech);
    });
    if (this.rollT <= 0) {
      this.state = 'follow';
      if (q.splash) {
        g.explode(this.x, this.y, q.splash, q.dmg * this.power * 0.5, { pet: true, petRef: this, small: true, element: 'water' });
        g.addEffect({ type: 'ring', x: this.x, y: this.y, R: q.splash, life: 0.3, color: '#8fe0ff' });
      }
    }
  }

  draw(ctx, cam) {
    const x = snap(this.x) - cam.x, y = snap(this.y) - cam.y;
    const a = this.art;
    ctx.globalAlpha = 0.28; ctx.fillStyle = '#1a2a10';
    ctx.beginPath(); ctx.ellipse(x, y, a ? Math.max(5, a.cw * 0.34) : 5, a ? Math.max(2, a.cw * 0.12) : 2, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    if (!a) return;
    if (this.fainted) {
      if (a.anim?.faint) {
        // collapses once, then lies there with dizzy stars circling
        const n = a.anim.faint.length, f = Math.floor(this.faintT * ANIM_FPS.faint), down = f >= n;
        drawCreature(ctx, a, x, y, { left: this.face < 0, anim: 'faint', frame: f, alpha: down ? 0.7 : 1 });
        if (down) {
          ctx.fillStyle = '#ffe07a';
          for (let i = 0; i < 3; i++) {
            const ang = this.g.realTime * 4 + (i * TAU) / 3, sx = Math.round(x + Math.cos(ang) * 6), sy = Math.round(y - a.ch * 0.45 - 3 + Math.sin(ang) * 2);
            ctx.fillRect(sx, sy - 1, 1, 3); ctx.fillRect(sx - 1, sy, 3, 1);
          }
        }
        return;
      }
      drawCreature(ctx, a, x, y, { left: this.face < 0, alpha: 0.45, sx: 1.05, sy: 0.8 });
      if (Math.floor(this.g.realTime * 2 + this.seed) % 2) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 4, y - a.ch - 2, 2, 1); ctx.fillRect(x + 5, y - a.ch - 3, 1, 1); }
      return;
    }
    const m = creatureMotion(a.motion, this.g.realTime, this.moving, this.seed, !!a.anim);
    // drawn frames: flyers always flap, the rest step while moving and breathe while still
    m.anim = a.motion === 'fly' || this.moving || this.state === 'roll' ? 'move' : 'idle';
    m.at = this.g.realTime + this.seed;
    if (this.atkT >= 0 && a.anim?.attack) { m.anim = 'attack'; m.frame = Math.floor(this.atkT * ANIM_FPS.attack); }
    if (this.state === 'roll' && this.rollQ?.hop) m.bob += Math.sin(Math.max(0, this.rollT) / 0.55 * Math.PI) * 10;
    if (this.hopT > 0) m.bob += Math.sin(this.hopT / 0.3 * Math.PI) * 8;
    if (this.state === 'roll' && this.rollQ?.spin) {
      ctx.save(); ctx.translate(x, Math.round(y - a.ch / 2)); ctx.rotate(this.anim);
      drawCreature(ctx, a, 0, a.ch / 2, { left: this.face < 0 });
      ctx.restore();
    } else drawCreature(ctx, a, x, y, { left: this.face < 0, flash: this.flash > 0, ...m });
    // a small HP bar once it's been hurt
    if (this.hp < this.maxHp && this.g.mode === 'world') {
      const w = 14, bx = Math.round(x - w / 2), by = Math.round(y + 2);
      ctx.fillStyle = '#2b1d24'; ctx.fillRect(bx - 1, by - 1, w + 2, 3);
      ctx.fillStyle = this.hp / this.maxHp < 0.3 ? '#ff5a5a' : '#9af08a';
      ctx.fillRect(bx, by, Math.max(0, Math.round((w * this.hp) / this.maxHp)), 1);
    }
  }
}

// ---------------------------------------------------------------- fighting styles
// Each takes the skill's numbers (q) and returns the cooldown until the next attack.
const ARCH = {
  shooter(pet, g, q) {
    const t = g.nearestEnemy(pet.x, pet.y, q.range || 150);
    if (!t) return 0.3;
    let n = q.count || 1;
    if (pet.id === 'emberpup' && g.combo('kindred')) n += 2;
    const freeze = Math.max(q.freeze || 0, pet.id === 'puddlit' && g.combo('tidepool') ? 1.2 : 0);
    const base = Math.atan2(t.y - pet.y, t.x - pet.x);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.32;
      const sp = q.speed || 150;
      const zap = q.zapOnHit, boom = q.explode;
      g.spawnProjectile({
        x: pet.x, y: pet.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: q.r || 4, dmg: q.dmg * pet.power,
        life: q.life || 1.6, spr: q.proj, element: q.element || 'phys', burn: q.burn, chill: q.chill, freeze, stun: q.stun,
        homing: q.homing, target: t, pierce: q.pierce || 0, knock: q.knock || 30, pet: true, petRef: pet, z: 6, glow: q.glow,
        onHit: boom || zap ? (g2, p, e) => {
          if (boom) g2.explode(p.x, p.y, 16, q.dmg * pet.power * 0.5, { element: q.element, pet: true, petRef: pet, small: true, exclude: e });
          if (zap) chain(g2, pet, e, zap, q.dmg * pet.power * 0.4, {});
        } : undefined,
      });
    }
    if (q.element === 'fire') Audio.play('fire'); else Audio.play('shoot');
    pet.swing();
    return q.cd;
  },
  zapper(pet, g, q) {
    const first = g.nearestEnemy(pet.x, pet.y, q.range || 150);
    if (!first) return 0.3;
    const n = (q.chains || 3) + (pet.id === 'voltowl' && g.combo('stormwings') ? 4 : 0);
    const pts = [[pet.x, pet.y - 4]];
    chain(g, pet, first, n, q.dmg * pet.power, { burn: q.burn, chill: q.chill, stun: q.stun }, pts);
    Audio.play('zap');
    pet.swing();
    return q.cd;
  },
  roller(pet, g, q) {
    const t = g.nearestEnemy(pet.x, pet.y, q.range || 140);
    if (!t) return 0.3;
    const a = Math.atan2(t.y - pet.y, t.x - pet.x);
    pet.state = 'roll'; pet.rollT = q.time || 0.6; pet.hits.clear(); pet.rollQ = q;
    pet.vx = Math.cos(a) * (q.speed || 220); pet.vy = Math.sin(a) * (q.speed || 220);
    pet.face = pet.vx >= 0 ? 1 : -1;
    return pet.id === 'pebblet' && g.combo('rockslide') ? q.cd / 2 : q.cd;
  },
  aura(pet, g, q) {
    let hit = false;
    g.enemiesInRadius(pet.x, pet.y, q.radius || 30, (e) => {
      hit = true;
      const frz = q.freezeChance && Math.random() < q.freezeChance ? 1.2 : 0;
      g.damageEnemy(e, q.dmg * pet.power, { pet: true, petRef: pet, small: true, silent: true, chill: q.chill, burn: q.burn, freeze: frz });
    });
    for (let i = 0; i < 3; i++) {
      const ang = rand(0, TAU), d = rand(0, q.radius || 30);
      g.particles.add({ x: pet.x + Math.cos(ang) * d, y: pet.y - 4 + Math.sin(ang) * d * 0.7, vx: rand(-6, 6), vy: rand(4, 14), life: 0.6, color: Math.random() < 0.5 ? q.color || '#ffffff' : '#ffffff' });
    }
    // the dust is always on; every few seconds of fighting it gives a visible pulse
    pet.auraT = (pet.auraT || 0) + (q.tick || 0.5);
    if (hit && pet.auraT >= 2.5) { pet.auraT = 0; pet.swing(); }
    return q.tick || 0.5;
  },
  slam(pet, g, q) {
    const R = q.radius || 36;
    if (!g.nearestEnemy(pet.x, pet.y, R * 1.2)) return 0.3;
    if (pet.art?.anim?.attack) pet.swing(); else pet.hopT = 0.3;
    g.explode(pet.x, pet.y, R, q.dmg * pet.power, { pet: true, petRef: pet, knock: q.knock || 200, stun: q.stun, root: q.root, chill: q.chill, burn: q.burn, small: true });
    g.addEffect({ type: 'ring', x: pet.x, y: pet.y, R, life: 0.35, color: q.root ? '#6cc24e' : q.chill ? '#8fe0ff' : '#c4beb4' });
    g.shake(1.5, 0.12);
    return q.cd;
  },
  lobber(pet, g, q) {
    const n = q.count || 1;
    const targets = g.randomEnemies(pet.x, pet.y, q.range || 140, n);
    if (!targets.length) return 0.3;
    pet.swing();
    for (const t of targets) {
      const sx = pet.x, sy = pet.y, tx = t.x, ty = t.y, T = 0.5;
      g.spawnProjectile({
        x: sx, y: sy, r: 0, dmg: 0, pierce: Infinity, life: T, spr: 'p_spore', noHit: true,
        update(g2, p) { const k = Math.min(1, p.age / T); p.x = sx + (tx - sx) * k; p.y = sy + (ty - sy) * k; p.z = 6 + Math.sin(k * Math.PI) * 26; return true; },
        onExpire(g2) {
          g2.spawnZone({
            kind: 'spores', x: tx, y: ty, r: q.radius || 22, life: q.dur || 3, tick: q.tick || 0.5,
            onTick: (g3, z) => g3.enemiesInRadius(z.x, z.y, z.r, (e) => g3.damageEnemy(e, q.dmg * pet.power, { pet: true, petRef: pet, small: true, silent: true, stun: q.stun, burn: q.burn, chill: q.chill })),
          });
        },
      });
    }
    return q.cd;
  },
};

// Lightning that jumps from one foe to the next nearest it hasn't hit yet.
function chain(g, pet, first, n, dmg, extra, pts = [[first.x, first.y]]) {
  let cur = first;
  const seen = new Set();
  while (cur && n-- > 0) {
    seen.add(cur.id); pts.push([cur.x, cur.y]);
    g.damageEnemy(cur, dmg, { pet: true, petRef: pet, element: 'light', ...extra });
    const from = cur;
    cur = g.nearestEnemy(from.x, from.y, 80, (o) => !seen.has(o.id));
  }
  if (pts.length > 1) g.zap(pts, 0.2);
}
