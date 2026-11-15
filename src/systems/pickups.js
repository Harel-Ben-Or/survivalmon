// Pickups mixin for Game: EXP gems, coins, hearts, magnets, bombs, chests, eggs.
import { rand, dist2, TAU } from '../core/util.js';
import { Audio } from '../core/audio.js';
import { SPR, ICON } from '../gfx/assets.js';
import { ICON_ART, snap } from '../gfx/art.js';
import { STONES } from '../content/species.js';
import { SETS, SLOT_ICON } from '../content/gear.js';
import { WEAPONS } from '../content/weapons.js';

// A gear piece shows its slot's icon (or the weapon it is)
export const gearIcon = (v) => SLOT_ICON[v.slot] || WEAPONS[v.slot === 'main' ? SETS[v.hero].mainW : SETS[v.hero].offW].icon;

const SPRITE = { xp1: 'gem_s', xp5: 'gem_m', xp25: 'gem_l', coin: 'coin', heart: 'heart', magnet: 'magnet_pick', bomb: 'bomb_pick', chest: 'chest_pick', egg: 'egg' };

export const Pickups = {
  spawnPickup(kind, x, y, value = 1) {
    if (kind === 'xp') {
      const gems = this.pickupCount.xp;
      if (gems > 320) {
        // merge into an existing far-away gem to keep things fast
        for (let i = 0; i < 6; i++) {
          const o = this.pickups[(Math.random() * this.pickups.length) | 0];
          if (o && o.kind === 'xp' && !o.magnet) { o.value += value; o.icon = o.value >= 25 ? 'xp25' : o.value >= 5 ? 'xp5' : 'xp1'; return; }
        }
      }
      this.pickupCount.xp = gems + 1;
    }
    const a = rand(0, TAU), s = rand(10, 40);
    const icon = kind === 'xp' ? (value >= 25 ? 'xp25' : value >= 5 ? 'xp5' : 'xp1')
      : kind === 'stone' ? STONES[value].icon : kind === 'gear' ? gearIcon(value) : kind;
    this.pickups.push({ kind, x, y, value, icon, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, magnet: false, bob: rand(0, TAU) });
  },
  updatePickups(dt) {
    const P = this.player, S = P.stats;
    const mr2 = S.magnet * S.magnet;
    for (const k of this.pickups) {
      k.t += dt;
      k.x += k.vx * dt; k.y += k.vy * dt;
      k.vx *= 1 - 5 * dt; k.vy *= 1 - 5 * dt;
      const d2 = dist2(k.x, k.y, P.x, P.y);
      const pullable = k.kind === 'xp' || k.kind === 'coin' || k.kind === 'heart' || k.kind === 'berry';
      if (pullable && (k.magnet || d2 < mr2) && k.t > 0.25) {
        k.magnet = true;
        const d = Math.sqrt(d2) || 1;
        const sp = 140 + k.t * 40;
        k.x += ((P.x - k.x) / d) * sp * dt;
        k.y += ((P.y - 4 - k.y) / d) * sp * dt;
      }
      if (d2 < 100 && k.t > 0.25) this.collect(k);
    }
    this.pickups = this.pickups.filter((k) => !k.taken);
    let xp = 0; for (const k of this.pickups) if (k.kind === 'xp') xp++;
    this.pickupCount.xp = xp;
  },
  collect(k) {
    const P = this.player, S = P.stats;
    k.taken = true;
    switch (k.kind) {
      case 'xp': P.addXp(k.value); Audio.play('gem'); break;
      case 'coin': P.coins += k.value; this.runStats.coins += k.value; Audio.play('coin'); break;
      case 'heart': P.heal(20 * S.heartMult); Audio.play('heal'); break;
      case 'magnet': for (const o of this.pickups) if (o.kind === 'xp') { o.magnet = true; o.t = Math.max(o.t, 0.3); } Audio.play('levelup'); break;
      case 'bomb':
        this.addEffect({ type: 'flashring', x: P.x, y: P.y, R: 260, life: 0.5, color: '#ffffff' });
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Math.abs(e.x - P.x) < this.view.w / 2 + 20 && Math.abs(e.y - P.y) < this.view.h / 2 + 20)
            this.damageEnemy(e, e.boss ? 300 : 99999, { raw: true, silent: true });
        }
        this.shake(6, 0.4); Audio.play('explode'); break;
      case 'chest': this.openWorldChest(k.value); break;
      case 'egg': this.findEgg(k.x, k.y); break;
      case 'gear': this.collectGear(k.value); break;
      case 'berry': this.feedTeam(1); break;
      case 'stone': this.gainStone(k.value); break;
    }
  },
  drawPickups(ctx, cam) {
    for (const k of this.pickups) {
      const key = SPRITE[k.icon] || k.icon;
      const art = ICON_ART[key], s = SPR[key];
      const img = art ? art.img : s ? s.frames[0] : ICON[key];
      if (!img) continue;
      const w = art ? art.w : img.width, h = art ? art.h : img.height;
      const bob = k.kind === 'xp' ? 0 : Math.round(Math.sin(this.time * 4 + k.bob) * 1.5);
      const x = snap(k.x - cam.x - w / 2), y = snap(k.y - cam.y - h - 2 + bob);
      if (x < -20 || y < -20 || x > this.view.w + 20 || y > this.view.h + 20) continue;
      if (k.kind === 'chest' || k.kind === 'egg' || k.kind === 'stone' || k.kind === 'gear') {
        ctx.globalAlpha = 0.35 + 0.2 * Math.sin(this.time * 6);
        ctx.fillStyle = '#ffe07a';
        ctx.beginPath(); ctx.ellipse(x + w / 2, y + h, 12, 5, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.drawImage(img, x, y, w, h);
    }
  },
};
