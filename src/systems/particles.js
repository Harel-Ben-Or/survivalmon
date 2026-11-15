// Pixel particles and floating damage numbers.
import { rand, TAU } from '../core/util.js';
import { drawNumber } from '../gfx/assets.js';
import { snap } from '../gfx/art.js';

export class Particles {
  constructor() { this.list = []; this.nums = []; }
  clear() { this.list.length = 0; this.nums.length = 0; }
  add(p) {
    if (this.list.length > 900) return;
    p.age = 0; p.size = p.size ?? 1; p.gravity = p.gravity ?? 0; p.z = p.z ?? 0;
    this.list.push(p);
  }
  burst(x, y, { n = 8, color = '#ffffff', speed = 60, life = 0.4, up = 0, size = 1, gravity = 0, colors } = {}) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(speed * 0.3, speed);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.75 - up, life: rand(life * 0.6, life), color: colors ? colors[i % colors.length] : color, size, gravity });
    }
  }
  number(x, y, value, kind = 'white') {
    if (this.nums.length > 120) this.nums.shift();
    this.nums.push({ x: x + rand(-4, 4), y, value, kind, age: 0, life: kind === 'crit' ? 0.8 : 0.6 });
  }
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.age += dt;
      if (p.age >= p.life) { L[i] = L[L.length - 1]; L.pop(); continue; }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 1 - 2.5 * dt; p.vy *= 1 - 2.5 * dt;
    }
    const N = this.nums;
    for (let i = N.length - 1; i >= 0; i--) {
      const n = N[i];
      n.age += dt;
      if (n.age >= n.life) N.splice(i, 1);
    }
  }
  draw(ctx, cam) {
    for (const p of this.list) {
      const a = 1 - p.age / p.life;
      ctx.globalAlpha = a > 0.5 ? 1 : a * 2;
      ctx.fillStyle = p.color;
      const s = p.size;
      ctx.fillRect(snap(p.x - cam.x - s / 2), snap(p.y - cam.y - s / 2), s, s);
    }
    ctx.globalAlpha = 1;
  }
  drawNumbers(ctx, cam) {
    for (const n of this.nums) {
      const k = n.age / n.life;
      const rise = Math.min(1, k * 3) * 10 + k * 4;
      if (k > 0.75) ctx.globalAlpha = (1 - k) * 4;
      drawNumber(ctx, n.value, n.x - cam.x, n.y - cam.y - 18 - rise, n.kind, n.kind === 'crit' ? 2 : 1);
      ctx.globalAlpha = 1;
    }
  }
}
