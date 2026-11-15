// Paints the whole overworld ground into one big canvas, pixel by pixel,
// with organic (noise-wobbled) borders between grass, dirt, farmland, water and stone.
import { valueNoise, hash2 } from '../core/util.js';
import { col } from '../gfx/pixel.js';
import { PC, SPR } from '../gfx/assets.js';
import { T, TILE } from './world.js';

const C = (h) => col(h);
const PAL = {
  grass: [C('#6dbd48'), C('#74c44c'), C('#7ccb51')], grassDk: C('#5fae3e'), grassLt: C('#92d862'), grassEdge: C('#539a38'),
  dark: [C('#56a23c'), C('#5aa83e'), C('#61af43')], darkDk: C('#4a9234'), darkLt: C('#70bd4c'),
  dirt: C('#e3c48c'), dirtDk: C('#d4b07a'), dirtLt: C('#efd8a8'), dirtE1: C('#b38a56'), dirtE2: C('#cfa872'),
  farm: [C('#6b4329'), C('#8a5a36'), C('#97643c'), C('#97643c'), C('#a8724a'), C('#8a5a36')], farmE: C('#5a3a22'),
  water: C('#4aa3df'), waterDeep: C('#4196d4'), waterHi: C('#7fc6f0'), waterE1: C('#2f5f8f'), waterE2: C('#a6def8'), waterE3: C('#62b4e8'),
  stone: C('#c9c3b3'), stoneHi: C('#ddd7c7'), stoneDk: C('#b7b0a0'), mortar: C('#9d9585'), stoneE: C('#857d6d'),
};

export function paintGround(world) {
  const PW = world.pw, PH = world.ph, W = world.w, H = world.h;
  const tiles = world.tiles;
  const types = new Uint8Array(PW * PH);
  const s = world.seed;

  // Pass 1: per-pixel terrain type (wobbly borders only where tiles differ)
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    const t = tiles[ty * W + tx];
    let uniform = true;
    for (let oy = -1; oy <= 1 && uniform; oy++) for (let ox = -1; ox <= 1; ox++) {
      const nx = tx + ox, ny = ty + oy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (tiles[ny * W + nx] !== t) { uniform = false; break; }
    }
    const x0 = tx * TILE, y0 = ty * TILE;
    if (uniform) {
      for (let y = y0; y < y0 + TILE; y++) types.fill(t, y * PW + x0, y * PW + x0 + TILE);
      continue;
    }
    for (let y = y0; y < y0 + TILE; y++) for (let x = x0; x < x0 + TILE; x++) {
      const sx = x + (valueNoise(x * 0.21, y * 0.21, s + 3) - 0.5) * 7;
      const sy = y + (valueNoise(x * 0.21 + 31, y * 0.21 + 17, s + 3) - 0.5) * 7;
      const stx = Math.min(W - 1, Math.max(0, Math.floor(sx / TILE)));
      const sty = Math.min(H - 1, Math.max(0, Math.floor(sy / TILE)));
      types[y * PW + x] = tiles[sty * W + stx];
    }
  }

  // Pass 2: colour
  const buf = new Uint32Array(PW * PH);
  const at = (x, y) => (x < 0 || y < 0 || x >= PW || y >= PH ? -1 : types[y * PW + x]);
  const diff = (x, y, t, d) => {
    const a = at(x + d, y), b = at(x - d, y), c = at(x, y + d), e = at(x, y - d);
    return (a !== t && a !== -1) || (b !== t && b !== -1) || (c !== t && c !== -1) || (e !== t && e !== -1);
  };
  const nearType = (x, y, want) => at(x + 1, y) === want || at(x - 1, y) === want || at(x, y + 1) === want || at(x, y - 1) === want;

  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    const i = y * PW + x;
    const t = types[i];
    const hsh = hash2(x, y, s);
    let c;
    if (t === T.GRASS || t === T.DARK) {
      const dark = t === T.DARK;
      const m = valueNoise(x * 0.035, y * 0.035, s + 11);
      const shades = dark ? PAL.dark : PAL.grass;
      c = shades[m < 0.38 ? 0 : m < 0.68 ? 1 : 2];
      if (hsh < 0.022) c = dark ? PAL.darkDk : PAL.grassDk;
      else if (hsh < 0.032) c = dark ? PAL.darkLt : PAL.grassLt;
      if (diff(x, y, t, 1)) {
        const other = nearType(x, y, T.DIRT) || nearType(x, y, T.STONE) || nearType(x, y, T.FARM) || nearType(x, y, T.WATER);
        if (other) c = PAL.grassEdge;
      }
    } else if (t === T.DIRT) {
      if (diff(x, y, t, 1)) c = PAL.dirtE1;
      else if (diff(x, y, t, 2)) c = PAL.dirtE2;
      else c = hsh < 0.06 ? PAL.dirtDk : hsh < 0.09 ? PAL.dirtLt : PAL.dirt;
    } else if (t === T.FARM) {
      c = diff(x, y, t, 1) ? PAL.farmE : PAL.farm[y % 6];
      if (hsh < 0.03 && !diff(x, y, t, 1)) c = PAL.farm[0];
    } else if (t === T.WATER) {
      if (diff(x, y, t, 1)) c = PAL.waterE1;
      else if (diff(x, y, t, 2)) c = PAL.waterE2;
      else if (diff(x, y, t, 3)) c = PAL.waterE3;
      else {
        c = valueNoise(x * 0.05, y * 0.05, s + 21) < 0.45 ? PAL.waterDeep : PAL.water;
        if (y % 4 === 0 && (x + ((y / 4) | 0) * 7) % 19 < 3) c = PAL.waterHi;
      }
    } else if (t === T.STONE) {
      if (diff(x, y, t, 1)) c = PAL.stoneE;
      else {
        // irregular cobbles: rows of 6px, stones of varying width with rounded corners
        const row = (y / 6) | 0, ry = y % 6;
        const off = Math.floor(hash2(row, 7, s) * 8);
        const xx = x + off, cell = (xx / 8) | 0, rx = xx % 8;
        const corner = (rx === 0 || rx === 7) && (ry === 0 || ry === 4);
        if (ry === 5 || rx === 7 || corner) c = PAL.mortar;
        else if (ry === 0 || rx === 0) c = PAL.stoneHi;
        else if (ry === 4) c = PAL.stoneDk;
        else c = hash2(cell, row, s) < 0.35 ? PAL.stoneDk : PAL.stone;
      }
    }
    buf[i] = c;
  }

  // Pass 3: decals (tufts, flowers, crops, lily pads, pebbles)
  const blit = (pc, dx, dy) => {
    dx |= 0; dy |= 0;
    for (let yy = 0; yy < pc.h; yy++) {
      const Y = dy + yy;
      if (Y < 0 || Y >= PH) continue;
      for (let xx = 0; xx < pc.w; xx++) {
        const v = pc.data[yy * pc.w + xx];
        if (!(v >>> 24)) continue;
        const X = dx + xx;
        if (X < 0 || X >= PW) continue;
        buf[Y * PW + X] = v;
      }
    }
  };
  for (const d of world.baked) blit(d.pc, d.x, d.y);

  // Pass 4: soft pixel shadows under trees/buildings
  const darken = (v, f) => {
    const r = v & 255, g = (v >>> 8) & 255, b = (v >>> 16) & 255;
    return ((255 << 24) | ((b * f) << 16) | ((g * f) << 8) | (r * f)) >>> 0;
  };
  const shadow = (cx, cy, rx, ry) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (x < 0 || y < 0 || x >= PW || y >= PH) continue;
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) buf[y * PW + x] = darken(buf[y * PW + x], 0.78);
    }
  };
  for (const sh of world.shadows) shadow(sh.x, sh.y, sh.rx, sh.ry);

  // Pass 5: border forest baked in (never reachable by the player)
  for (const it of world.bakedTall) {
    const pc = PC[it.spr], sp = SPR[it.spr];
    shadow(it.x, it.y - 1, 11, 4);
    blit(pc, it.x - sp.ax, it.y - sp.ay);
  }

  const cv = document.createElement('canvas');
  cv.width = PW; cv.height = PH;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(PW, PH);
  new Uint32Array(img.data.buffer).set(buf);
  ctx.putImageData(img, 0, 0);
  return cv;
}

// Tiny overview map: one pixel per tile.
export function paintMinimap(world) {
  const cv = document.createElement('canvas');
  cv.width = world.w; cv.height = world.h;
  const ctx = cv.getContext('2d');
  const colors = { [T.GRASS]: '#74c44c', [T.DARK]: '#4f9a3a', [T.DIRT]: '#e3c48c', [T.FARM]: '#8a5a36', [T.WATER]: '#4aa3df', [T.STONE]: '#c8c2b4' };
  for (let ty = 0; ty < world.h; ty++) for (let tx = 0; tx < world.w; tx++) {
    ctx.fillStyle = colors[world.tiles[ty * world.w + tx]];
    ctx.fillRect(tx, ty, 1, 1);
  }
  ctx.fillStyle = '#2e6a2a';
  for (const o of world.objects) if (o.tree) ctx.fillRect(Math.floor(o.x / TILE), Math.floor(o.y / TILE), 1, 1);
  for (let ty = 0; ty < world.h; ty++) for (let tx = 0; tx < world.w; tx++) {
    if (world.solid[ty * world.w + tx] === 3) { ctx.fillStyle = '#245f2b'; ctx.fillRect(tx, ty, 1, 1); }
  }
  return cv;
}
