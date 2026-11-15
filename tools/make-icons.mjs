// Generates the app / home-screen icons from the game's own pixel art.
// Usage: node tools/make-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { PixelCanvas } from '../src/gfx/pixel.js';
import { drawHero, HERO_LOOKS, PET_DRAW } from '../src/gfx/sprites_chars.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'icons');
fs.mkdirSync(outDir, { recursive: true });

// 32x32 base art: grass tile, the ranger and an Emberpup friend
const base = new PixelCanvas(32, 32);
base.rect(0, 0, 32, 32, '#6dbd48');
for (let i = 0; i < 40; i++) base.set((i * 13 + 5) % 32, (i * 7 + 3) % 32, i % 3 ? '#5fae3e' : '#92d862');
base.rect(0, 0, 32, 2, '#539a38'); base.rect(0, 30, 32, 2, '#539a38');
base.blit(drawHero(HERO_LOOKS.rowan, 'down', 0), 1, 5);
base.blit(PET_DRAW.emberpup(0).flipX(), 12, 13);

function png(pc, scale, pad = 0) {
  const w = pc.w * scale + pad * 2, h = pc.h * scale + pad * 2;
  const rgba = Buffer.alloc(w * h * 4);
  const bg = [0x6d, 0xbd, 0x48, 255];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = Math.floor((x - pad) / scale), sy = Math.floor((y - pad) / scale);
    const inside = sx >= 0 && sy >= 0 && sx < pc.w && sy < pc.h;
    const v = inside ? pc.data[sy * pc.w + sx] : 0;
    const i = (y * w + x) * 4;
    if (inside && v >>> 24) { rgba[i] = v & 255; rgba[i + 1] = (v >>> 8) & 255; rgba[i + 2] = (v >>> 16) & 255; rgba[i + 3] = 255; }
    else rgba.set(bg, i);
  }
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = { 'icon-192.png': [6, 0], 'icon-512.png': [14, 32], 'apple-touch-icon.png': [5, 10] };
for (const [name, [scale, pad]] of Object.entries(out)) {
  fs.writeFileSync(path.join(outDir, name), png(base, scale, pad));
  console.log('wrote icons/' + name);
}
