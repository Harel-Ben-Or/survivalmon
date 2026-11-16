// The player-controlled hero: movement, stats, inventory, weapons and spells.
import { Input } from '../core/input.js';
import { Audio } from '../core/audio.js';
import { HERO } from '../gfx/assets.js';
import { HERO_ART, drawHero, dir8, DIR8, snap } from '../gfx/art.js';
import { HEROES } from '../content/heroes.js';
import { WEAPONS } from '../content/weapons.js';
import { SPELLS } from '../content/spells.js';
import { ARTIFACTS } from '../content/artifacts.js';
import { TAU, rand } from '../core/util.js';
import { armorCut } from '../systems/armor.js';

export const SLOTS = { weapon: 4, spell: 3, artifact: 6, pet: 3 };
export const xpFor = (L) => Math.floor(4 + L * 4 + Math.pow(L, 1.75));

export class Player {
  constructor(g, heroId) {
    this.g = g;
    this.hero = HEROES.find((h) => h.id === heroId);
    this.spr = HERO[heroId];
    this.x = 0; this.y = 0; this.r = 5;
    this.dir = 'down'; this.faceAngle = Math.PI / 2; this.anim = 0; this.moving = false;
    this.level = 1; this.xp = 0; this.xpNext = xpFor(1); this.pendingLevels = 0; this.bonusPicks = 0;
    this.bonus = {};
    this.weapons = []; this.spells = []; this.artifacts = []; this.pets = [];
    this.coins = 0; this.kills = 0;
    this.orbs = { twig: 2 + (this.hero.orbs || 0), stone: 0, star: 0 };
    this.caught = [];
    this.iframes = 0; this.flash = 0;
    this.dashCd = 0; this.dashT = 0; this.dashVx = 0; this.dashVy = 0;
    this.regenBoost = null;
    this.reviveUsed = false;
    this.trail = [];
    this.recompute();
    this.hp = this.stats.maxHp;
  }

  // ------------------------------------------------------------ inventory
  find(cat, id) {
    const list = cat === 'weapon' ? this.weapons : cat === 'spell' ? this.spells : cat === 'artifact' ? this.artifacts : this.pets;
    return list.find((i) => i.id === id);
  }
  list(cat) { return cat === 'weapon' ? this.weapons : cat === 'spell' ? this.spells : cat === 'artifact' ? this.artifacts : this.pets; }
  has(id) {
    return this.weapons.some((w) => w.id === id) || this.spells.some((s) => s.id === id) ||
      this.artifacts.some((a) => a.id === id) || this.pets.some((p) => p.id === id && !p.fainted);
  }
  addItem(cat, id, levels = 1) {
    const owned = this.find(cat, id);
    const max = cat === 'weapon' ? WEAPONS[id].max : cat === 'spell' ? SPELLS[id].max : ARTIFACTS[id].max;
    if (owned) owned.level = Math.min(max, owned.level + levels);
    else {
      const item = { id, level: Math.min(max, levels), cd: cat === 'spell' ? 0 : 0.3 };
      this.list(cat).push(item);
    }
    this.recompute();
  }
  removeItem(cat, id) {
    const L = this.list(cat);
    const i = L.findIndex((x) => x.id === id);
    if (i >= 0) L.splice(i, 1);
    this.recompute();
  }

  // ------------------------------------------------------------ stats
  recompute() {
    const m = {};
    const add = (mods) => { for (const [k, v] of Object.entries(mods)) m[k] = (m[k] || 0) + v; };
    add(this.hero.mods);
    add(this.bonus);
    for (const a of this.artifacts) add(ARTIFACTS[a.id].mods(a.level));
    for (const p of this.pets) if (!p.fainted) add(p.passives());
    const prevMax = this.stats?.maxHp;
    const g = (k) => m[k] || 0;
    this.stats = {
      maxHp: Math.max(20, Math.round(100 + g('maxHp'))),
      speed: 64 * Math.min(1.9, 1 + g('speed')),
      haste: g('haste'),
      cooldown: Math.max(0.4, 1 - g('haste')),
      might: 1 + g('might'),
      area: 1 + g('area'),
      amount: Math.round(g('amount')),
      projSpeed: 1 + g('projSpeed'),
      duration: 1 + g('duration'),
      crit: Math.min(0.9, 0.05 + g('crit')),
      critMult: 1.75 + g('critMult'),
      magnet: 30 * (1 + g('magnet')),
      luck: 1 + g('luck'),
      growth: 1 + g('growth'),
      petPower: 1 + g('petPower'),
      petXp: 1 + g('petXp'),
      regen: g('regen'),
      armor: g('armor'),
      burnMult: 1 + g('burn'),
      chillChance: g('chill'),
      lightning: 1 + g('lightning'),
      chainBonus: g('chain'),
      thorns: g('thorns'),
      healOnKill: g('healOnKill'),
      heartMult: 1 + g('heart'),
      reviveHp: g('reviveHp'),
    };
    if (prevMax && this.stats.maxHp > prevMax) this.hp += this.stats.maxHp - prevMax;
    if (this.hp > this.stats.maxHp) this.hp = this.stats.maxHp;
    this.g.refreshCombos?.();
  }

  addXp(n) {
    this.xp += n * this.stats.growth;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = xpFor(this.level);
      this.pendingLevels++;
    }
  }

  heal(n) {
    if (n <= 0) return;
    const before = this.hp;
    this.hp = Math.min(this.stats.maxHp, this.hp + n);
    const healed = Math.round(this.hp - before);
    if (healed >= 1) this.g.particles.number(this.x, this.y - 6, healed, 'heal');
  }

  hurt(dmg, src) {
    if (this.iframes > 0 || this.dashT > 0 || this.g.mode !== 'world') return false;
    const d = Math.max(1, Math.round(dmg * armorCut(this.stats.armor)));
    this.hp -= d;
    this.iframes = 0.6; this.flash = 0.15;
    this.g.particles.number(this.x, this.y - 4, d, 'hurt');
    this.g.particles.burst(this.x, this.y - 8, { n: 6, color: '#ff5a5a', speed: 60, life: 0.3 });
    this.g.shake(3, 0.15);
    this.g.runStats.taken += d;
    Audio.play('hurt');
    if (this.hp <= 0) {
      if (this.stats.reviveHp > 0 && !this.reviveUsed) {
        this.reviveUsed = true;
        this.hp = Math.round(this.stats.maxHp * Math.min(1, this.stats.reviveHp));
        this.iframes = 2.5;
        this.g.banner('Phoenix Feather! You rise again!', '#f6a03a');
        this.g.explode(this.x, this.y, 110, 200, { element: 'fire', big: true, knock: 300 });
      } else {
        this.hp = 0;
        this.g.gameOver();
      }
    }
    void src;
    return true;
  }

  // ------------------------------------------------------------ update
  update(dt, solids) {
    const g = this.g, S = this.stats;
    this.iframes = Math.max(0, this.iframes - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);

    const mv = Input.moveVector();
    this.moving = !!(mv.x || mv.y);
    if (this.moving) {
      this.faceAngle = Math.atan2(mv.y, mv.x);
      if (Math.abs(mv.x) > Math.abs(mv.y) + 0.01) this.dir = mv.x > 0 ? 'right' : 'left';
      else this.dir = mv.y > 0 ? 'down' : 'up';
      // Turn the sprite only once the stick is clearly past the halfway line between two of the
      // 8 facings, so a thumb resting near the line doesn't flick the hero back and forth.
      const cur = this.d8 ? DIR8.indexOf(this.d8) * (Math.PI / 4) : null;
      const off = cur === null ? Infinity : Math.abs(((this.faceAngle - cur + 3 * Math.PI) % TAU) - Math.PI);
      if (off > Math.PI / 8 + 0.15) this.d8 = dir8(this.faceAngle);
    }
    if (Input.wasPressed('Space') && this.dashCd <= 0 && this.dashT <= 0) {
      const a = this.moving ? this.faceAngle : this.faceAngle;
      this.dashT = 0.16; this.dashCd = 2.0 * S.cooldown;
      this.dashVx = Math.cos(a) * 270; this.dashVy = Math.sin(a) * 270;
      Audio.play('dash');
    }
    let vx = mv.x * S.speed, vy = mv.y * S.speed;
    if (this.netT > 0) {
      this.netT = Math.max(0, this.netT - dt);
      vx *= 0.45; vy *= 0.45;
      if (Math.random() < 12 * dt) g.particles.add({ x: this.x + rand(-5, 5), y: this.y - rand(2, 14), vx: 0, vy: 8, life: 0.3, color: '#d8c8a0', size: 1 });
    }
    if (this.dashT > 0) {
      this.dashT -= dt;
      vx = this.dashVx; vy = this.dashVy;
      if (Math.random() < 60 * dt) g.particles.add({ x: this.x + rand(-3, 3), y: this.y - rand(2, 14), vx: 0, vy: 0, life: 0.25, color: '#ffffff', size: 1 });
    }
    if (solids) moveInRoom(this, vx * dt, vy * dt, solids);
    else g.world.move(this, vx * dt, vy * dt, this.r);
    // step rate follows how fast you actually go (half-pushed stick, speed boosts)
    this.anim = this.moving ? this.anim + dt * 9 * Math.max(0.55, Math.min(1.4, Math.hypot(mv.x, mv.y) * S.speed / 64)) : 0;

    // trail for following pets
    const last = this.trail[0];
    if (!last || Math.hypot(last.x - this.x, last.y - this.y) > 2) {
      this.trail.unshift({ x: this.x, y: this.y });
      if (this.trail.length > 120) this.trail.pop();
    }
    if (solids) return;

    // regen
    let regen = S.regen;
    if (this.regenBoost) { regen += this.regenBoost.amount; this.regenBoost.t -= dt; if (this.regenBoost.t <= 0) this.regenBoost = null; }
    if (regen > 0) this.hp = Math.min(S.maxHp, this.hp + regen * dt);

    // weapons
    for (const w of this.weapons) {
      const def = WEAPONS[w.id];
      const st = def.stats(w.level);
      if (def.update) { def.update(g, w, st, dt); continue; }
      w.cd -= dt;
      if (w.cd <= 0) {
        const r = def.fire(g, w, st);
        w.cd = r === false ? 0.15 : st.cd * S.cooldown;
      }
    }
    // spells
    this.spells.forEach((s, i) => {
      s.cd = Math.max(0, s.cd - dt);
      const key = ['Digit1', 'Digit2', 'Digit3'][i];
      const want = Input.wasPressed(key) || Input.wasPressed(['Numpad1', 'Numpad2', 'Numpad3'][i]) ||
        (g.settings.autoCast && g.nearestEnemy(this.x, this.y, 130));
      if (want && s.cd <= 0) this.cast(s);
    });
  }

  cast(s) {
    const def = SPELLS[s.id];
    const st = def.stats(s.level);
    if (def.cast(this.g, s, st) !== false) {
      s.cd = st.cd * this.stats.cooldown;
      this.g.runStats.casts++;
    }
  }

  draw(ctx, cam) {
    const s = this.spr, art = HERO_ART[this.hero.id];
    const frame = this.moving ? Math.floor(this.anim) % 4 : 0;
    const x = snap(this.x) - cam.x, y = snap(this.y) - cam.y;
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#1a2a10';
    ctx.beginPath(); ctx.ellipse(x, y, art ? 8 : 6, art ? 3 : 2.5, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    if (this.iframes > 0 && this.flash <= 0 && Math.floor(this.iframes * 20) % 2 === 0) ctx.globalAlpha = 0.45;
    if (art) {
      // Walk cycle frames when we have them (frame 0 doubles as the standing pose so the size never
      // pops); otherwise a small step bounce stands in.
      const d8 = this.d8 || dir8(this.faceAngle), step = Math.sin(this.anim * Math.PI / 2);
      const breathe = { bob: 0, sx: 1, sy: 1 + Math.sin(this.g.realTime * 2.2) * 0.015 };
      const m = art.walk[d8] ? (this.moving ? { walk: this.anim * 0.8 } : { walk: 0, ...breathe })
        : this.moving ? { bob: Math.abs(step) * 1.5, sx: 1, sy: 1 + Math.abs(step) * 0.02 } : breathe;
      drawHero(ctx, art, x, y, d8, { flash: this.flash > 0, ...m });
    } else {
      const set = this.flash > 0 ? s.flash : s.dirs;
      ctx.drawImage(set[this.dir][frame], x - s.ax, y - s.ay);
    }
    ctx.globalAlpha = 1;
  }

  drawHpBar(ctx, cam) {
    const S = this.stats;
    if (this.hp >= S.maxHp) return;
    const w = 18, x = snap(this.x) - cam.x - w / 2, y = snap(this.y) - cam.y + 3;
    ctx.fillStyle = '#2b1d24'; ctx.fillRect(x - 1, y - 1, w + 2, 4);
    ctx.fillStyle = '#5a2a2a'; ctx.fillRect(x, y, w, 2);
    ctx.fillStyle = this.hp / S.maxHp < 0.3 ? '#ff5a5a' : '#7af08a';
    ctx.fillRect(x, y, Math.max(0, Math.round((w * this.hp) / S.maxHp)), 2);
  }
}

// Circle vs list of rects (interiors)
export function moveInRoom(ent, dx, dy, rects) {
  const r = ent.r;
  const step = (axis, d) => {
    ent[axis] += d;
    for (const R of rects) {
      const nx = Math.max(R.x, Math.min(ent.x, R.x + R.w));
      const ny = Math.max(R.y, Math.min(ent.y, R.y + R.h));
      const ox = ent.x - nx, oy = ent.y - ny;
      const d2 = ox * ox + oy * oy;
      if (d2 >= r * r) continue;
      if (d2 === 0) { if (axis === 'x') ent.x -= d; else ent.y -= d; continue; }
      const dd = Math.sqrt(d2);
      ent.x = nx + (ox / dd) * r; ent.y = ny + (oy / dd) * r;
    }
  };
  step('x', dx); step('y', dy);
}
