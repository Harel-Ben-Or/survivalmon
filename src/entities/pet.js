// A survivalmon in a run: trails the hero, fights with every attack skill it has (its own unique
// skill plus any it inherited), carries its passive skills, and has its own HP. It can faint; the
// HP it ends the run with is saved, and the Clinic heals it.
import { CREATURE, creatureMotion, drawCreature, drawStarShine, snap, ANIM_FPS, vfxHitTime } from '../gfx/art.js';
import { attackFx } from '../content/attack_fx.js';
import { SPECIES, archType, LEVEL_HP, LEVEL_ATK } from '../content/species.js';
import { TIER_POWER, PASSIVES } from '../content/skills.js';
import { Box, statShape } from '../systems/collection.js';
import { rand, TAU } from '../core/util.js';
import { Audio } from '../core/audio.js';
import { armorCut } from '../systems/armor.js';

// Shot sprites that turn as they fly (the rest point where they go or stay upright)
const SPINNING = new Set(['p_blade']);

const TEAM0 = { dmg: 0, hp: 0, haste: 0, def: 0, crit: 0 };
// A roller's tuck into a ball before it sets off, and its unrolling after (seconds)
const CURL_T = 0.16, UNCURL_T = 0.16;

// A skill's numbers at its tier. S tier also gets a small twist that depends on how it attacks.
function tiered(sp, t) {
  const q = { ...sp.q }, k = TIER_POWER[t];
  q.dmg *= k;
  if (q.heal) q.heal *= k;
  if (q.bless) { const b = q.bless; q.bless = { ...b, heal: b.heal * k, dmg: (b.dmg || 0) * k, haste: (b.haste || 0) * k, def: (b.def || 0) * k }; }
  if (t === 4) {
    if (sp.arch === 'shooter' || sp.arch === 'lobber') q.count = (q.count || 1) + 1;
    else if (sp.arch === 'zapper') q.chains = (q.chains || 3) + 2;
    else if (sp.arch === 'roller') q.cd *= 0.75;
    else if (sp.arch === 'aura') q.radius = (q.radius || 30) + 8;
    else if (sp.arch === 'slam') q.radius = (q.radius || 36) + 10;
    else if (sp.arch === 'support') q.bless = { ...q.bless, cd: q.bless.cd * 0.75 };
  }
  return q;
}

// Type cards picked this run (g.typeUp): more damage for that attack type, plus the type's perk.
export const TYPE_PERK = { shot: 0.92, charge: 0.9, area: 0.12, support: 0.9 }; // cooldown factor per card, or size per card
const AREA_R = { aura: 30, slam: 36, lobber: 22 };
function typedUp(q, arch, type, ups) {
  const u = ups?.[type];
  if (!u?.n && !u?.dmg) return q; // type cards picked this run (n), and damage from them and the hero's gear sets
  q.dmg *= 1 + u.dmg;
  if (type === 'shot' || type === 'charge') q.cd = (q.cd || 1) * Math.pow(TYPE_PERK[type], u.n);
  else if (type === 'chain') q.chains = (q.chains || 3) + u.n;
  else if (type === 'area') q.radius = (q.radius || AREA_R[arch] || 30) * (1 + TYPE_PERK.area * u.n);
  else if (type === 'support' && q.bless) q.bless = { ...q.bless, cd: q.bless.cd * Math.pow(TYPE_PERK.support, u.n), heal: q.bless.heal * (1 + u.dmg) };
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
    this.attacks = this.mon.skills.filter((s) => s.k === 'u' && SPECIES[s.sp]).map((s) => {
      const arch = SPECIES[s.sp].arch, type = archType(arch);
      return { s, arch, type, q: typedUp(tiered(SPECIES[s.sp], this.tierOf(s)), arch, type, this.g.typeUp), fx: attackFx(s.sp), cd: rand(0.5, 1.5), healT: rand(2, 5) };
    });
    this.q = this.attacks[0]?.q || {};
    this.guard = this.attacks.some((a) => a.arch === 'aura');
    this.shape = statShape(this.mon); // HP, Attack, Speed and Defense by attack type
    const prev = this.maxHp;
    this.maxHp = Math.round(sp.hp * this.shape.hp * (1 + LEVEL_HP * (this.mon.level - 1)) * (1 + (this.pass.heart || 0)) * Box.speciesMul(sp.id) * Box.starMul(this.mon) * (1 + this.team.hp));
    if (prev && this.hp > 0) this.hp = Math.min(this.maxHp, this.hp * (this.maxHp / prev));
  }
  // A skill's tier in this run: its rolled tier plus any level-up boosts (S is the top)
  tierOf(s) { return Math.min(4, s.t + (this.boost?.get(s) || 0)); }
  get team() { return this.g.team || TEAM0; }
  get name() { return this.mon.nick || this.sp.name; }
  get power() {
    return this.shape.atk * this.growth * (1 + 0.02 * (this.g.player.level - 1)) * (1 + this.team.dmg + (this.g.cry || 0));
  }
  // Level and species upgrades, without the attack-type shape (heals use this)
  get growth() { return (1 + LEVEL_ATK * (this.mon.level - 1)) * Box.speciesMul(this.species) * Box.starMul(this.mon); }
  // Added to the hero's stats while this survivalmon is on the team
  passives() {
    let armor = 0, magnet = 0;
    for (const a of this.attacks) { armor += a.q.armor || 0; magnet += a.q.magnet || 0; }
    return { armor, magnet };
  }

  hurt(dmg) {
    if (this.fainted || this.g.mode !== 'world') return;
    // the hero's armor shields the team too, at half strength
    const d = dmg * (1 - this.shape.def) * (1 - (this.pass.hide || 0)) * (1 - this.team.def) * (1 - this.g.blessed().def) * armorCut((this.g.player?.stats.armor || 0) * 0.5);
    this.g.noteChar?.(this, 'taken', Math.min(d, Math.max(0, this.hp)));
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
    this.hp = 0;
    this.fainted = true;
    this.faintT = 0;
    this.atkT = -1;
    this.state = 'follow';
    this.g.toast(`${this.name} fainted! Heal it at the Clinic.`);
    if (this.g.mode === 'world') this.g.ui.tip('faint');
    this.g.player.recompute();
    this.g.applyTeamPassives?.();
    this.g.particles.burst(this.x, this.y - 6, { n: 12, color: '#ffffff', speed: 40, life: 0.5 });
    Audio.play('hurt');
  }
  // by: the survivalmon whose heal it is (none: the hero's, for the run summary)
  heal(n, by = null) {
    if (this.fainted || n <= 0) return;
    const was = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + n);
    this.g.noteChar?.(by, 'healed', this.hp - was);
  }

  gainXp(n) {
    const g = this.g;
    const levels = Box.addXp(this.mon, n * g.player.stats.petXp);
    if (!levels.length) return;
    this.refresh();
    g.player.recompute();
    g.particles.burst(this.x, this.y - 8, { n: 14, colors: ['#ffe07a', '#ffffff'], speed: 50, life: 0.6, up: 20 });
    g.particles.text(this.x, this.y - (this.art?.ch || 20) - 6, `Lv ${levels[levels.length - 1]}!`, '#ffe07a');
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
    if (!this.fainted && g.mode === 'world' && this.calmT > 3 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.03 * dt);
    const trail = P.trail;
    const need = (index + 1) * 10;
    const side = P.faceAngle + (index % 2 ? -0.8 : 0.8);
    let tp = trail.length > need ? trail[need]
      : { x: P.x - Math.cos(side) * 22 * (index + 1), y: P.y - Math.sin(side) * 9 * (index + 1) };
    // in a story scene, stand beside the hero (on the trail it can end up right in front, hiding them)
    if (g.scene) tp = { x: P.x + (g.scene.petSide || 1) * (index % 2 ? -1 : 1) * 20 * (1 + (index >> 1)), y: P.y + 3 };
    // an aura survivalmon steps into foes that come close to the hero, so its aura has something to hit
    else if (this.guard && !this.fainted && !inRoom) { const e = g.nearestEnemy(P.x, P.y, 80); if (e) tp = e; }
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
    const rate = (g.combo('bestfriends') ? 1.5 : 1) * this.shape.spd / ((1 - (this.pass.swift || 0)) * (1 - this.team.haste) * (1 - g.blessed().haste));
    for (const a of this.attacks) {
      a.cd -= dt * rate;
      if (a.cd <= 0) a.cd = ARCH[a.arch](this, g, a.q, a.fx || {}) ?? 0.4;
      if (a.q.heal) {
        a.healT -= dt;
        if (a.healT <= 0) {
          a.healT = a.q.healCd || 9;
          const amt = a.q.heal * this.power;
          P.heal(amt + P.stats.maxHp * 0.03, this);
          for (const o of P.pets) o.heal(amt * 2, this);
          g.particles.burst(P.x, P.y - 10, { n: 10, color: '#9af08a', speed: 30, life: 0.6, up: 20 });
        }
      }
    }
  }

  updateRoll(dt) {
    const g = this.g, q = this.rollQ || this.q;
    this.moving = true;
    if (this.rollPhase === 'curl') {
      // tucking in on the spot; then off at the foe (wherever it has got to)
      this.phaseT -= dt;
      if (this.phaseT > 0) return;
      const t = this.rollTarget, sp = Math.hypot(this.vx, this.vy);
      if (t && !t.dead && t.hp > 0) { const a = Math.atan2(t.y - this.y, t.x - this.x); this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp; }
      this.face = this.vx >= 0 ? 1 : -1;
      this.rollPhase = 'roll'; this.rollTarget = null;
      g.particles.burst(this.x - this.face * 4, this.y - 1, { n: 6, colors: ['#d8c8a0', '#b8a888'], speed: 40, life: 0.3, up: 6 });
      return;
    }
    if (this.rollPhase === 'uncurl') {
      // the last bit of speed runs out as it unrolls
      this.phaseT -= dt;
      const k = Math.exp(-10 * dt);
      this.vx *= k; this.vy *= k;
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.spinA += (Math.hypot(this.vx, this.vy) * dt) / Math.max(4, this.art.ch / 2);
      if (this.phaseT <= 0) { this.state = 'follow'; this.rollPhase = null; }
      return;
    }
    this.rollT -= dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.anim += dt * 12;
    if (this.spinA != null) {
      // turns as far as it travels, like a real ball, and kicks up dust behind it
      this.spinA += (Math.hypot(this.vx, this.vy) * dt) / Math.max(4, this.art.ch / 2);
      if (Math.random() < 30 * dt) g.particles.add({ x: this.x - this.face * 5 + rand(-2, 2), y: this.y - rand(0, 3), vx: -this.vx * 0.15 + rand(-8, 8), vy: rand(-14, -4), life: 0.35, color: Math.random() < 0.5 ? '#d8c8a0' : '#b8a888', size: Math.random() < 0.3 ? 2 : 1 });
    }
    if (!q.leap) g.enemiesInRadius(this.x, this.y, 12, (e) => {
      if (this.hits.has(e.id)) return;
      this.hits.add(e.id);
      const sp = Math.hypot(this.vx, this.vy) || 1;
      const rockslide = this.id === 'pebblet' && g.combo('rockslide');
      g.damageEnemy(e, q.dmg * this.power, {
        pet: true, petRef: this, knock: q.knock || 100, kx: this.vx / sp, ky: this.vy / sp,
        stun: Math.max(q.stun || 0, rockslide ? 0.6 : 0), chill: q.chill, burn: q.burn,
      });
      if (q.leech) g.player.heal(q.leech, this);
      // an evolution's charge ends in a big crash on the first foe it smashes into
      if (this.rollFx?.sig && !this.crashed) {
        this.crashed = true;
        landSig(this, g, this.rollFx.sig, e.x, e.y, 40, q.dmg * this.power * 0.5, { ...q, knock: 30 });
      }
    });
    if (this.rollT <= 0) {
      if (this.rollPhase === 'roll' && this.spinA != null && q.spin && this.art?.anim?.curl) { this.rollPhase = 'uncurl'; this.phaseT = UNCURL_T; }
      else { this.state = 'follow'; this.rollPhase = null; }
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
    const shine = (this.mon.stars || 0) >= 5; // all five stars: it shines gold
    if (shine) drawStarShine(ctx, x, y, a.ch, this.g.realTime, this.seed, 'glow');
    // drawn frames: flyers always flap, the rest step while moving and breathe while still
    m.anim = a.motion === 'fly' || this.moving || this.state === 'roll' ? 'move' : 'idle';
    m.at = this.g.realTime + this.seed;
    if (this.atkT >= 0 && a.anim?.attack) { m.anim = 'attack'; m.frame = Math.floor(this.atkT * ANIM_FPS.attack); }
    if (this.state === 'roll' && this.rollQ?.hop) m.bob += Math.sin(Math.max(0, this.rollT) / (this.rollQ.time || 0.6) * Math.PI) * (this.rollQ.leap ? 14 : 10);
    if (this.hopT > 0) m.bob += Math.sin(this.hopT / 0.3 * Math.PI) * 8;
    if (this.state === 'roll' && this.rollQ?.spin && a.anim?.ball && this.spinA != null) {
      // tucks in, rolls as a turning ball (bouncing a little over the ground), then unrolls
      const n = a.anim.curl.length, left = this.face < 0;
      if (this.rollPhase === 'curl') drawCreature(ctx, a, x, y, { left, anim: 'curl', frame: Math.floor((1 - this.phaseT / CURL_T) * n) });
      else if (this.rollPhase === 'uncurl') drawCreature(ctx, a, x, y, { left, anim: 'curl', frame: Math.floor((this.phaseT / UNCURL_T) * n) });
      else {
        const i = Math.floor(this.spinA / (TAU / a.anim.ball.length));
        drawCreature(ctx, a, x, y, { left, anim: 'ball', frame: ((i % a.anim.ball.length) + a.anim.ball.length) % a.anim.ball.length, bob: Math.abs(Math.sin(this.spinA * 0.5)) * 1.5 });
      }
    } else if (this.state === 'roll' && this.rollQ?.spin) {
      ctx.save(); ctx.translate(x, Math.round(y - a.ch / 2)); ctx.rotate(this.anim);
      drawCreature(ctx, a, 0, a.ch / 2, { left: this.face < 0 });
      ctx.restore();
    } else drawCreature(ctx, a, x, y, { left: this.face < 0, flash: this.flash > 0, ...m });
    if (shine) drawStarShine(ctx, x, y, a.ch, this.g.realTime, this.seed);
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
// Each takes the skill's numbers (q) and its pictures (fx, see content/attack_fx.js) and returns the
// cooldown until the next attack. An evolution's own skill (fx.sig) is one big animated signature move.
const ARCH = {
  shooter(pet, g, q, fx) {
    const t = g.petTarget(pet.x, pet.y, q.range || 150);
    if (!t) return 0.3;
    if (fx.sig) return sigShot(pet, g, q, fx, t);
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
        life: q.life || 1.6, spr: fx.proj ? undefined : q.proj, fx: fx.proj, fxSpin: fx.spin, scale: fx.scale, seed: Math.random(),
        ...(!fx.proj && SPINNING.has(q.proj) ? { rot: Math.random() * TAU, spin: 16 } : {}), // a blade turns as it flies
        element: q.element || 'phys', burn: q.burn, chill: q.chill, freeze, stun: q.stun,
        homing: q.homing, target: t, pierce: q.pierce || 0, knock: q.knock || 30, pet: true, petRef: pet, z: 6, glow: q.glow,
        onHit: boom || zap ? (g2, p, e) => {
          if (boom) g2.explode(p.x, p.y, 16, q.dmg * pet.power * 0.5, { element: q.element, pet: true, petRef: pet, small: true, exclude: e });
          if (zap) chain(g2, pet, e, zap, q.dmg * pet.power * 0.4, {}, BOLT_FX);
        } : undefined,
      });
    }
    if (q.element === 'fire') Audio.play('fire'); else Audio.play('shoot');
    pet.swing();
    return q.cd;
  },
  zapper(pet, g, q, fx) {
    const first = g.petTarget(pet.x, pet.y, q.range || 150);
    if (!first) return 0.3;
    const n = (q.chains || 3) + (pet.id === 'voltowl' && g.combo('stormwings') ? 4 : 0);
    const extra = { burn: q.burn, chill: q.chill, stun: q.stun };
    pet.swing();
    Audio.play('zap');
    if (fx.sig) {
      // the strike lands on the first foe, then the lightning jumps on from there
      const x = first.x, y = first.y;
      landSig(pet, g, fx.sig, x, y, 34, q.dmg * pet.power * 1.6, { ...q, element: 'light' }, (g2) => {
        const seen = new Set([first.id]);
        const next = g2.nearestEnemy(x, y, 80, (o) => !seen.has(o.id));
        if (next) chain(g2, pet, next, n, q.dmg * pet.power, extra, fx, [[x, y]], seen);
      });
      return q.cd * 1.25;
    }
    chain(g, pet, first, n, q.dmg * pet.power, extra, fx, [[pet.x, pet.y - 4]]);
    return q.cd;
  },
  roller(pet, g, q, fx) {
    const t = g.petTarget(pet.x, pet.y, q.range || 140);
    if (!t) return 0.3;
    const a = Math.atan2(t.y - pet.y, t.x - pet.x);
    pet.state = 'roll'; pet.rollT = q.time || 0.6; pet.hits.clear(); pet.rollQ = q; pet.rollFx = fx; pet.crashed = false;
    pet.vx = Math.cos(a) * (q.speed || 220); pet.vy = Math.sin(a) * (q.speed || 220);
    pet.face = pet.vx >= 0 ? 1 : -1;
    // one with drawn curl-up frames tucks into a ball first, then sets off at its foe
    if (q.spin && pet.art?.anim?.curl) { pet.rollPhase = 'curl'; pet.phaseT = CURL_T; pet.rollTarget = t; pet.spinA = 0; }
    else { pet.rollPhase = 'roll'; pet.spinA = null; }
    return pet.id === 'pebblet' && g.combo('rockslide') ? q.cd / 2 : q.cd;
  },
  aura(pet, g, q, fx) {
    let hit = false;
    const R = q.radius || 30;
    g.enemiesInRadius(pet.x, pet.y, R, (e) => {
      hit = true;
      const frz = q.freezeChance && Math.random() < q.freezeChance ? 1.2 : 0;
      g.damageEnemy(e, q.dmg * pet.power, { pet: true, petRef: pet, small: true, silent: true, chill: q.chill, burn: q.burn, freeze: frz });
    });
    for (let i = 0; i < 3; i++) {
      const ang = rand(0, TAU), d = rand(0, R);
      g.particles.add({ x: pet.x + Math.cos(ang) * d, y: pet.y - 4 + Math.sin(ang) * d * 0.7, vx: rand(-6, 6), vy: rand(4, 14), life: 0.6, color: Math.random() < 0.5 ? q.color || '#ffffff' : '#ffffff' });
    }
    // the dust is always on; every few seconds of fighting it gives a visible pulse
    pet.auraT = (pet.auraT || 0) + (q.tick || 0.5);
    if (hit && pet.auraT >= 2.5) { pet.auraT = 0; pet.swing(); }
    // an evolution also bursts out in its big signature move every few seconds
    if (fx.sig) {
      pet.novaT = (pet.novaT || 0) + (q.tick || 0.5);
      if (pet.novaT >= 3.2 && g.petTarget(pet.x, pet.y, R * 1.6)) {
        pet.novaT = 0; pet.swing();
        landSig(pet, g, fx.sig, pet.x, pet.y, R * 1.7, q.dmg * pet.power * 3, { ...q, knock: 30 });
      }
    }
    return q.tick || 0.5;
  },
  // A support's dust still nicks foes around it; every few seconds it blesses the hero and the team
  support(pet, g, q, fx) {
    ARCH.aura(pet, g, q, fx);
    const b = q.bless, P = g.player, tick = q.tick || 0.5;
    if (!b) return tick;
    pet.blessT = (pet.blessT ?? b.cd * 0.4) - tick;
    const needed = g.nearestEnemy(P.x, P.y, 220) || P.hp < P.stats.maxHp || P.pets.some((o) => !o.fainted && o.hp < o.maxHp);
    if (pet.blessT <= 0 && needed) { pet.blessT = b.cd; bless(pet, g, b, q.color); }
    return tick;
  },
  slam(pet, g, q, fx) {
    const R = q.radius || 36;
    if (!g.petTarget(pet.x, pet.y, R * 1.2)) {
      // nobody close: leap onto a foe a little further off; the slam follows right after it lands
      const t = g.petTarget(pet.x, pet.y, 120);
      if (!t) return 0.3;
      const T = 0.5, a = Math.atan2(t.y - pet.y, t.x - pet.x), d = Math.hypot(t.x - pet.x, t.y - pet.y);
      pet.state = 'roll'; pet.rollT = T; pet.hits.clear(); pet.rollQ = { ...q, hop: true, leap: true, time: T }; pet.rollFx = fx; pet.crashed = true;
      pet.vx = (Math.cos(a) * d) / T; pet.vy = (Math.sin(a) * d) / T;
      pet.face = pet.vx >= 0 ? 1 : -1;
      return 0.15;
    }
    if (pet.art?.anim?.attack) pet.swing(); else pet.hopT = 0.3;
    if (fx.sig) {
      landSig(pet, g, fx.sig, pet.x, pet.y, R * 1.2, q.dmg * pet.power * 1.1, { ...q, knock: q.knock || 200 });
      return q.cd;
    }
    g.explode(pet.x, pet.y, R, q.dmg * pet.power, { pet: true, petRef: pet, knock: q.knock || 200, stun: q.stun, root: q.root, chill: q.chill, burn: q.burn, small: true, noFx: !!fx.slam });
    if (fx.slam) g.playFx(fx.slam, pet.x, pet.y);
    else g.addEffect({ type: 'ring', x: pet.x, y: pet.y, R, life: 0.35, color: q.root ? '#6cc24e' : q.chill ? '#8fe0ff' : '#c4beb4' });
    g.shake(1.5, 0.12);
    return q.cd;
  },
  lobber(pet, g, q, fx) {
    // an evolution's eruption bursts under some of the foes; the rest still get a lobbed blob
    const n = q.count || 1, big = fx.sig ? Math.max(1, Math.ceil(n / 2)) : 0;
    const targets = g.randomEnemies(pet.x, pet.y, q.range || 140, n);
    if (!targets.length) return 0.3;
    pet.swing();
    const pool = (g3, x, y) => g3.spawnZone({
      kind: 'spores', fx: fx.zone, seed: Math.random(), x, y, r: q.radius || 22, life: q.dur || 3, tick: q.tick || 0.5,
      onTick: (g4, z) => g4.enemiesInRadius(z.x, z.y, z.r, (e) => g4.damageEnemy(e, q.dmg * pet.power, { pet: true, petRef: pet, small: true, silent: true, stun: q.stun, burn: q.burn, chill: q.chill })),
    });
    targets.forEach((t, i) => {
      const sx = pet.x, sy = pet.y, tx = t.x, ty = t.y, T = 0.5;
      if (i < big) {
        // the eruption bursts out under the foe, then its pool lingers there
        landSig(pet, g, fx.sig, tx, ty, (q.radius || 22) * 1.5, q.dmg * pet.power * 2.5, { ...q, knock: 15 }, (g2) => pool(g2, tx, ty));
        return;
      }
      g.spawnProjectile({
        x: sx, y: sy, r: 0, dmg: 0, pierce: Infinity, life: T, spr: fx.glob ? undefined : 'p_spore', fx: fx.glob, fxSpin: true, seed: Math.random(), noHit: true,
        update(g2, p) { const k = Math.min(1, p.age / T); p.x = sx + (tx - sx) * k; p.y = sy + (ty - sy) * k; p.z = 6 + Math.sin(k * Math.PI) * 26; return true; },
        onExpire(g2) { pool(g2, tx, ty); },
      });
    });
    return big ? q.cd * 1.2 : q.cd;
  },
};
const BOLT_FX = { bolt: ['#ffe680', '#ffffff'] };

// A blessing: heals the hero and the team, then boosts everyone for a few seconds (damage, attack
// speed or defense; several supports keep the best of each)
function bless(pet, g, b, color = '#9af0c8') {
  const P = g.player, amt = b.heal * pet.growth;
  P.heal(amt + P.stats.maxHp * 0.02, pet);
  for (const o of P.pets) o.heal(amt * 1.5, pet);
  g.bless(b);
  pet.swing();
  g.addEffect({ type: 'ring', x: P.x, y: P.y, R: 28, life: 0.5, color });
  for (const o of [P, ...P.pets]) if (!o.fainted) g.particles.burst(o.x, o.y - 8, { n: 8, colors: [color, '#ffffff'], speed: 26, life: 0.7, up: 24 });
  Audio.play('heal');
}

// Evolved shooters: one or two big animated missiles that burst where they land
function sigShot(pet, g, q, fx, t) {
  const count = q.count || 1, n = count >= 3 ? 2 : 1;
  const dmg = (q.dmg * pet.power * count) / n;
  const base = Math.atan2(t.y - pet.y, t.x - pet.x), sp = (q.speed || 150) * 0.85;
  for (let i = 0; i < n; i++) {
    const a = base + (i - (n - 1) / 2) * 0.25;
    g.spawnProjectile({
      x: pet.x, y: pet.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 7, dmg: dmg * 0.45, life: (q.range || 150) / sp + 0.25,
      fx: fx.missile, spr: fx.missile ? undefined : q.proj, scale: fx.missile ? undefined : 2, seed: Math.random(),
      element: q.element || 'phys', homing: Math.max(q.homing || 0, 6), target: t, pierce: 0, knock: 40, pet: true, petRef: pet, z: 8, glow: q.glow,
      onExpire: (g2, p) => landSig(pet, g2, fx.sig, p.x, p.y, 34, dmg * 0.45, { ...q, knock: 35 }),
    });
  }
  if (q.element === 'fire') Audio.play('fire'); else Audio.play('shoot');
  pet.swing();
  return q.cd * 1.15;
}

// An evolution's big move: plays its animation at (x, y) and deals the damage the moment it lands
export function landSig(pet, g, id, x, y, R, dmg, q, then) {
  if (!g.playFx(id, x, y)) {
    g.addEffect({ type: 'ring', x, y, R, life: 0.4, color: '#ffffff' });
  }
  g.after(vfxHitTime(id), (g2) => {
    g2.explode(x, y, R, dmg, {
      pet: true, petRef: pet, small: true, noFx: true, element: q.element, burn: q.burn, chill: q.chill, stun: q.stun,
      root: q.root, freeze: q.freeze || (q.freezeChance && Math.random() < q.freezeChance ? 1.2 : 0), knock: q.knock || 70,
    });
    g2.shake(1.5, 0.12);
    Audio.play('explode');
    then?.(g2);
  });
}

// Lightning that jumps from one foe to the next nearest it hasn't hit yet, in the breed's colours.
// Each jump hits 15% softer than the one before.
function chain(g, pet, first, n, dmg, extra, fx = {}, pts = [[first.x, first.y]], seen = new Set()) {
  let cur = first;
  while (cur && n-- > 0) {
    seen.add(cur.id); pts.push([cur.x, cur.y]);
    g.damageEnemy(cur, dmg, { pet: true, petRef: pet, element: 'light', ...extra });
    dmg *= 0.85;
    if (fx.hit) g.playFx(fx.hit, cur.x, cur.y - 6);
    const from = cur;
    cur = g.nearestEnemy(from.x, from.y, 80, (o) => !seen.has(o.id));
  }
  if (pts.length > 1) g.zap(pts, 0.2, fx.bolt);
}
