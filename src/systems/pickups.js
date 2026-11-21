// Pickups mixin for Game: EXP gems, coins, hearts, magnets, bombs, chests, eggs.
import { rand, dist2, TAU } from '../core/util.js';
import { Audio } from '../core/audio.js';
import { SPR, ICON } from '../gfx/assets.js';
import { ICON_ART, snap } from '../gfx/art.js';
import { STONES } from '../content/species.js';
import { GEAR_SETS, TIERS, gearIcon } from '../content/gear.js';
import { TILE } from '../world/world.js';

// A gear drop by tier: [beam half-width, beam height, sparkles, how much bigger the piece floats]
const GEAR_DROP = { r: [3.5, 32, 4, 1.2], e: [5, 44, 7, 1.3], l: [7, 64, 11, 1.5] };

const SPRITE = { xp1: 'gem_s', xp5: 'gem_m', xp25: 'gem_l', coin: 'coin', heart: 'heart', magnet: 'magnet_pick', bomb: 'bomb_pick', chest: 'chest_pick', egg: 'egg' };

export const Pickups = {
  spawnPickup(kind, x, y, value = 1) {
    if (kind === 'xp') {
      const gems = this.pickupCount.xp;
      if (gems > 320) {
        // Too many gems on the ground (they never fade): this one joins a gem right where it fell, or
        // else takes over the gem farthest from you, so the EXP always lands where the fighting is.
        // (It used to join a random gem, usually far behind you: past 320 gems, kills gave nothing.)
        const P = this.player;
        let near = null, nd = 36 * 36, far = null, fd = -1;
        for (const o of this.pickups) {
          if (o.kind !== 'xp' || o.magnet || o.taken) continue;
          const d = (o.x - x) ** 2 + (o.y - y) ** 2;
          if (d < nd) { nd = d; near = o; }
          const dp = P ? (o.x - P.x) ** 2 + (o.y - P.y) ** 2 : 0;
          if (dp > fd) { fd = dp; far = o; }
        }
        const icon = (v) => (v >= 25 ? 'xp25' : v >= 5 ? 'xp5' : 'xp1');
        if (near) { near.value += value; near.icon = icon(near.value); return; }
        if (far) { value += far.value; far.taken = true; } // the far one goes, its EXP comes along
      }
      this.pickupCount.xp = gems + 1;
    }
    const a = rand(0, TAU), s = rand(10, 40);
    const icon = kind === 'xp' ? (value >= 25 ? 'xp25' : value >= 5 ? 'xp5' : 'xp1')
      : kind === 'stone' ? STONES[value].icon : kind === 'gear' ? gearIcon(value.set, value.slot) : kind;
    this.pickups.push({ kind, x, y, value, icon, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, magnet: false, bob: rand(0, TAU) });
    if (kind === 'gear') { // it lands with a flash in its tier's colour (an Epic or Legendary one is heard too)
      const T = GEAR_SETS[value.set]?.tier || 'r';
      this.addEffect({ type: 'flashring', x, y, R: T === 'l' ? 34 : T === 'e' ? 24 : 16, life: 0.35, color: TIERS[T].color });
      if (T !== 'r') { this.particles.burst(x, y - 6, { n: T === 'l' ? 26 : 14, colors: [TIERS[T].color, '#ffffff'], speed: 70, life: 0.6, up: 30 }); Audio.play(T === 'l' ? 'levelup' : 'chest'); }
    }
  },
  updatePickups(dt) {
    const P = this.player, S = P.stats;
    const mr2 = S.magnet * S.magnet;
    for (const k of this.pickups) {
      if (k.taken) continue; // folded into a newer gem (see spawnPickup), going away this frame
      k.t += dt;
      k.x += k.vx * dt; k.y += k.vy * dt;
      k.vx *= 1 - 5 * dt; k.vy *= 1 - 5 * dt;
      // a drop that came down in water (or inside a rock or a tree) washes up on the nearest shore
      if (!k.settled && k.t > 0.3) {
        k.settled = true;
        if (!this.world.walkable(k.x, k.y)) k.shore = this.shoreNear(k.x, k.y);
      }
      if (k.shore && !k.magnet) {
        const dx = k.shore.x - k.x, dy = k.shore.y - k.y, d = Math.hypot(dx, dy);
        if (d < 1.5) k.shore = null;
        else {
          const sp = Math.max(40, Math.min(150, d * 4)) * dt;
          k.x += (dx / d) * Math.min(d, sp); k.y += (dy / d) * Math.min(d, sp);
          if (Math.random() < 10 * dt) this.particles.add({ x: k.x + rand(-3, 3), y: k.y, vx: rand(-6, 6), vy: rand(-8, -2), life: 0.35, color: '#d8f2ff', size: 1 });
        }
      }
      const d2 = dist2(k.x, k.y, P.x, P.y);
      const pullable = k.kind === 'xp' || k.kind === 'coin' || k.kind === 'heart' || k.kind === 'berry' || k.kind === 'shard';
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
  // The middle of the nearest tile you can stand on (searching outward ring by ring), or null
  shoreNear(x, y) {
    const W = this.world, tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    for (let r = 1; r <= 30; r++) {
      let best = null, bd = Infinity;
      const tryTile = (i, j) => {
        if (W.solidAt(tx + i, ty + j) !== 0) return;
        const cx = (tx + i + 0.5) * TILE, cy = (ty + j + 0.5) * TILE, d = (cx - x) ** 2 + (cy - y) ** 2;
        if (d < bd) { bd = d; best = { x: cx, y: cy }; }
      };
      for (let i = -r; i <= r; i++) { tryTile(i, -r); tryTile(i, r); }
      for (let j = -r + 1; j < r; j++) { tryTile(-r, j); tryTile(r, j); }
      // a little scatter inside the tile, so several drops don't stack on one spot
      if (best) return { x: best.x + rand(-4, 4), y: best.y + rand(-3, 3) };
    }
    return null;
  },
  collect(k) {
    const P = this.player, S = P.stats;
    k.taken = true;
    switch (k.kind) {
      case 'xp': P.addXp(k.value); Audio.play('gem'); break;
      case 'coin': { const v = k.value * (this.tierMult?.coins || 1); P.coins += v; this.runStats.coins += v; Audio.play('coin'); break; }
      case 'heart': P.heal(20 * S.heartMult); Audio.play('heal'); break;
      case 'magnet': for (const o of this.pickups) if (o.kind === 'xp') { o.magnet = true; o.t = Math.max(o.t, 0.3); } Audio.play('levelup'); break;
      case 'bomb':
        this.addEffect({ type: 'flashring', x: P.x, y: P.y, R: 260, life: 0.5, color: '#ffffff' });
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Math.abs(e.x - P.x) < this.view.w / 2 + 20 && Math.abs(e.y - P.y) < this.view.h / 2 + 20)
            this.damageEnemy(e, e.boss ? 300 : 99999, { raw: true, silent: true, bomb: true });
        }
        this.shake(6, 0.4); Audio.play('explode'); break;
      case 'chest': this.openWorldChest(k.value); break;
      case 'egg': this.findEgg(k.x, k.y); break;
      case 'gear':
        this.particles.burst(k.x, k.y - 8, { n: 16, colors: [TIERS[GEAR_SETS[k.value.set]?.tier || 'r'].color, '#ffffff'], speed: 60, life: 0.5, up: 24 });
        this.collectGear(k.value); break;
      case 'berry': this.feedTeam(1); break;
      case 'stone': this.gainStone(k.value); break;
      case 'shard':
        P.shards = (P.shards || 0) + k.value;
        this.feed(`+${k.value} Skyfall Shard`, '#c8a8ff');
        this.ui.tip('shard');
        this.particles.burst(k.x, k.y - 6, { n: 14, colors: ['#c8a8ff', '#8fd0ff', '#ffffff'], speed: 60, life: 0.5, up: 20 });
        Audio.play('gem'); break;
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
      if (k.kind === 'gear') { this.drawGearDrop(ctx, k, snap(k.x - cam.x), snap(k.y - cam.y), img, w, h, bob); continue; }
      if (k.kind === 'chest' || k.kind === 'egg' || k.kind === 'stone' || k.kind === 'shard') {
        ctx.globalAlpha = 0.35 + 0.2 * Math.sin(this.time * 6);
        ctx.fillStyle = k.kind === 'shard' ? '#b08aff' : '#ffe07a';
        ctx.beginPath(); ctx.ellipse(x + w / 2, y + h, 12, 5, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.drawImage(img, x, y, w, h);
    }
  },
  // A gear piece on the ground: a beam of light, a ring and rising sparkles in its tier's colour (pale
  // blue, purple, or gold with slowly turning rays), the piece itself floating a little bigger.
  drawGearDrop(ctx, k, cx, gy, img, w, h, bob) {
    const T = GEAR_SETS[k.value.set]?.tier || 'r', col = TIERS[T].color, [bw, bh0, sparks, big] = GEAR_DROP[T];
    const t = this.time + k.bob, pulse = 0.5 + 0.5 * Math.sin(t * 5), grow = Math.min(1, k.t / 0.25), bh = bh0 * (0.9 + 0.1 * pulse) * grow;
    ctx.save();
    // the beam itself first, in plain colour (light added on bright grass would wash out), then its glow
    let g = ctx.createLinearGradient(0, gy - bh, 0, gy);
    g.addColorStop(0, col + '00'); g.addColorStop(0.5, col + '66'); g.addColorStop(1, col + 'd0');
    ctx.fillStyle = g; ctx.fillRect(cx - bw, gy - bh, bw * 2, bh);
    ctx.globalCompositeOperation = 'lighter';
    const R = (bw + 12) * (1 + 0.08 * pulse);
    ctx.save(); ctx.translate(cx, gy); ctx.scale(1, 0.42);
    g = ctx.createRadialGradient(0, 0, 1, 0, 0, R);
    g.addColorStop(0, col + 'aa'); g.addColorStop(1, col + '00');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill(); ctx.restore();
    g = ctx.createLinearGradient(0, gy - bh, 0, gy);
    g.addColorStop(0, col + '00'); g.addColorStop(0.55, col + '40'); g.addColorStop(1, col + '90');
    ctx.fillStyle = g; ctx.fillRect(cx - bw * 1.6, gy - bh, bw * 3.2, bh);
    g = ctx.createLinearGradient(0, gy - bh, 0, gy);
    g.addColorStop(0, '#ffffff00'); g.addColorStop(0.5, '#ffffff60'); g.addColorStop(1, '#ffffffe0');
    ctx.fillStyle = g; ctx.fillRect(cx - Math.max(0.5, bw / 4), gy - bh, Math.max(1, bw / 2), bh);
    if (T === 'l') { // turning rays behind a Legendary piece
      ctx.fillStyle = col + '30';
      for (let i = 0; i < 8; i++) {
        const a = t * 0.5 + (i / 8) * TAU;
        ctx.beginPath(); ctx.moveTo(cx, gy - 9);
        ctx.lineTo(cx + Math.cos(a - 0.1) * 24, gy - 9 + Math.sin(a - 0.1) * 24); ctx.lineTo(cx + Math.cos(a + 0.1) * 24, gy - 9 + Math.sin(a + 0.1) * 24); ctx.fill();
      }
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(10,8,20,.4)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(cx, gy, 9 + bw * 0.4, 3.6 + bw * 0.16, 0, 0, TAU); ctx.stroke(); // a dark edge, so the ring reads on bright ground
    ctx.strokeStyle = col; ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.7 + 0.3 * pulse; ctx.beginPath(); ctx.ellipse(cx, gy, 9 + bw * 0.4, 3.6 + bw * 0.16, 0, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1;
    if (T !== 'r') { const k2 = (t * 0.8) % 1; ctx.globalAlpha = 0.5 * (1 - k2); ctx.beginPath(); ctx.ellipse(cx, gy, (9 + bw * 0.4) * (1 + k2), (3.6 + bw * 0.16) * (1 + k2), 0, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
    const dw = w * big, dh = h * big;
    ctx.drawImage(img, snap(cx - dw / 2), snap(gy - dh - 3 + bob), dw, dh);
    for (let i = 0; i < sparks; i++) { // sparkles rise along the beam
      const ph = (t * 0.55 + i / sparks) % 1, sx = cx + Math.sin(i * 12.9898 + k.bob) * (bw + 7), sy = gy - 4 - ph * bh * 0.9, s = i % 3 ? 0.5 : 1;
      ctx.globalAlpha = Math.sin(ph * Math.PI);
      ctx.fillStyle = col; ctx.fillRect(snap(sx - s - 0.5), snap(sy - 0.25), s * 2 + 1, 0.5); ctx.fillRect(snap(sx - 0.25), snap(sy - s - 0.5), 0.5, s * 2 + 1);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(snap(sx - 0.25), snap(sy - 0.25), 0.5, 0.5);
    }
    ctx.globalAlpha = 1;
  },
};
