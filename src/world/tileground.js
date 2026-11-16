// Overworld ground drawn from PixelLab Wang tilesets on a dual grid, cached in chunks.
// Dual grid: each drawn cell is centred on a tile corner and its 4 corners are the 4 tiles
// around that corner, so terrain edges line up exactly with tile (collision) edges.
import { WS, DECAL_ART } from '../gfx/art.js';
import { SPR } from '../gfx/assets.js';
import { T, TILE } from './world.js';

const CH = 16;                 // tiles per chunk side
const MAX_CHUNKS = 36;
// Draw order: later terrains sit on top where two meet.
const ORDER = [['dark', T.DARK], ['farm', T.FARM], ['sand', T.SAND], ['ash', T.ASH], ['gravel', T.GRAVEL], ['frost', T.FROST], ['blossom', T.BLOSSOM], ['dirt', T.DIRT], ['stone', T.STONE], ['water', T.WATER]];

function loadImage(src) {
  const lp = (window.__loadProgress ||= { total: 0, done: 0 }); // counted for the loading screen
  lp.total++;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { lp.done++; resolve(img); };
    img.onerror = () => { lp.done++; resolve(null); };
    img.src = src;
  });
}

export class TileGround {
  static async load(base = 'assets/sprites/tiles') {
    try {
      const cfg = await (await fetch(`${base}/tiles.json`)).json();
      const sheets = {};
      for (const [k, s] of Object.entries(cfg.sets)) {
        sheets[k] = await loadImage(`${base}/${s.overlay || s.img}`);
        if (!sheets[k]) return null;
      }
      const grass = await loadImage(`${base}/${cfg.sets.dirt.img}`);
      if (!grass) return null;
      return new TileGround(cfg, sheets, grass);
    } catch { return null; }
  }
  constructor(cfg, sheets, grass) {
    this.cfg = cfg; this.sheets = sheets; this.grass = grass;
    this.ts = cfg.size; // native tile size
    this.cache = new Map();
  }
  attach(world) { this.world = world; this.cache.clear(); }

  chunk(cx, cy) {
    const key = `${cx},${cy}`;
    let c = this.cache.get(key);
    if (c) { this.cache.delete(key); this.cache.set(key, c); return c; } // keep most recent last
    c = this.render(cx, cy);
    this.cache.set(key, c);
    if (this.cache.size > MAX_CHUNKS) this.cache.delete(this.cache.keys().next().value);
    return c;
  }

  render(cx, cy) {
    const w = this.world, ts = this.ts, size = CH * ts;
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    const tx0 = cx * CH, ty0 = cy * CH;
    // 1) uniform grass everywhere
    const [gx, gy] = this.cfg.grass;
    for (let y = 0; y < CH; y++) for (let x = 0; x < CH; x++) g.drawImage(this.grass, gx, gy, ts, ts, x * ts, y * ts, ts, ts);
    // 2) terrain overlays on the dual grid
    const at = (x, y) => w.tileAt(x, y);
    for (const [key, type] of ORDER) {
      if (!this.cfg.sets[key]) continue; // an older tiles.json without this ground
      const lut = this.cfg.sets[key].tiles, img = this.sheets[key];
      for (let vy = 0; vy <= CH; vy++) for (let vx = 0; vx <= CH; vx++) {
        const X = tx0 + vx, Y = ty0 + vy;
        const m = (at(X - 1, Y - 1) === type) * 8 + (at(X, Y - 1) === type) * 4 + (at(X - 1, Y) === type) * 2 + (at(X, Y) === type) * 1;
        if (!m) continue;
        const p = lut[m];
        if (!p) continue;
        g.drawImage(img, p[0], p[1], ts, ts, vx * ts - ts / 2, vy * ts - ts / 2, ts, ts);
      }
    }
    // everything below is placed in logical units
    g.scale(WS, WS);
    const ox = tx0 * TILE, oy = ty0 * TILE, span = CH * TILE;
    const near = (x, y, m) => x > ox - m && x < ox + span + m && y > oy - m && y < oy + span + m;
    // the endless world keeps decals per chunk: read the chunks this piece of ground overlaps
    const parts = w.infinite ? w.chunksIn(ox - 70, oy - 70, ox + span + 70, oy + span + 70) : [w];
    const baked = parts.flatMap((p) => p.baked), shadows = parts.flatMap((p) => p.shadows), tall = parts.flatMap((p) => p.bakedTall);
    // 3) decals (flowers, tufts, crops, lily pads, pebbles)
    for (const d of baked) {
      if (!near(d.x, d.y, 24)) continue;
      const art = d.name && DECAL_ART[d.name];
      if (art) g.drawImage(art.img, Math.round(d.x - ox), Math.round(d.y - oy), art.w, art.h);
      else { d.cv = d.cv || d.pc.toCanvas(); g.drawImage(d.cv, Math.round(d.x - ox), Math.round(d.y - oy)); }
    }
    // 4) soft shadows under trees and buildings (a: how dark, 1 = normal)
    g.fillStyle = 'rgba(20,40,10,0.22)';
    for (const s of shadows) {
      if (!near(s.x, s.y, s.rx + 2)) continue;
      g.globalAlpha = Math.min(1, s.a ?? 1);
      if (s.a > 1) g.fillStyle = `rgba(20,40,10,${(0.22 * s.a).toFixed(3)})`;
      g.beginPath(); g.ellipse(s.x - ox, s.y - oy, s.rx, s.ry, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(20,40,10,0.22)';
    }
    g.globalAlpha = 1;
    // 5) the border forest is baked in (it can never be walked behind)
    for (const it of tall) {
      const s = SPR[it.spr];
      if (!s || !near(it.x, it.y, 70)) continue;
      g.fillStyle = 'rgba(20,40,10,0.22)';
      g.beginPath(); g.ellipse(it.x - ox, it.y - oy - 1, 11, 4, 0, 0, Math.PI * 2); g.fill();
      g.drawImage(s.frames[0], Math.round(it.x - s.ax - ox), Math.round(it.y - s.ay - oy), s.w, s.h);
    }
    return cv;
  }

  draw(ctx, cam, view) {
    const span = CH * TILE;
    const c0 = Math.floor(cam.x / span), c1 = Math.floor((cam.x + view.w) / span);
    const r0 = Math.floor(cam.y / span), r1 = Math.floor((cam.y + view.h) / span);
    // a fixed map (the town) is clipped to its size; the endless world goes on in every direction
    const inf = this.world.infinite;
    const maxC = inf ? Infinity : Math.ceil(this.world.w / CH) - 1, maxR = inf ? Infinity : Math.ceil(this.world.h / CH) - 1;
    for (let cy = inf ? r0 : Math.max(0, r0); cy <= Math.min(maxR, r1); cy++) {
      for (let cx = inf ? c0 : Math.max(0, c0); cx <= Math.min(maxC, c1); cx++) {
        ctx.drawImage(this.chunk(cx, cy), cx * span - cam.x, cy * span - cam.y, span, span);
      }
    }
  }
}
