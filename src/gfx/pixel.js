// PixelCanvas: a tiny software pixel buffer for crisp, hand-drawn-looking sprites.
// Colors are '#rrggbb' strings (or null/'' for transparent).
const colorCache = new Map();
export function col(hex) {
  if (!hex) return 0;
  let c = colorCache.get(hex);
  if (c !== undefined) return c;
  let r, g, b, a = 255;
  if (hex.length === 9) a = parseInt(hex.slice(7, 9), 16);
  const n = parseInt(hex.slice(1, 7), 16);
  r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255;
  c = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  colorCache.set(hex, c);
  return c;
}

export class PixelCanvas {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.data = new Uint32Array(w * h);
  }
  clone() { const p = new PixelCanvas(this.w, this.h); p.data.set(this.data); return p; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x, y, c) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[y * this.w + x] = typeof c === 'number' ? c : col(c);
  }
  get(x, y) { x |= 0; y |= 0; return this.inb(x, y) ? this.data[y * this.w + x] : 0; }
  isSet(x, y) { return (this.get(x, y) >>> 24) > 0; }
  rect(x, y, w, h, c) {
    const v = col(c);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, v);
  }
  // Fill ellipse with pixel-center test
  ellipse(cx, cy, rx, ry, c) {
    const v = col(c);
    const x0 = Math.floor(cx - rx - 1), x1 = Math.ceil(cx + rx + 1);
    const y0 = Math.floor(cy - ry - 1), y1 = Math.ceil(cy + ry + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) this.set(x, y, v);
    }
  }
  circle(cx, cy, r, c) { this.ellipse(cx, cy, r, r, c); }
  line(x0, y0, x1, y1, c) {
    const v = col(c);
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, v);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  tri(x0, y0, x1, y1, x2, y2, c) {
    const v = col(c);
    const minX = Math.floor(Math.min(x0, x1, x2)), maxX = Math.ceil(Math.max(x0, x1, x2));
    const minY = Math.floor(Math.min(y0, y1, y2)), maxY = Math.ceil(Math.max(y0, y1, y2));
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (area === 0) return;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area;
      const w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 >= -0.01 && w1 >= -0.01 && w2 >= -0.01) this.set(x, y, v);
    }
  }
  // Recolor existing pixels where fn(x,y,colorUint) returns a new hex color.
  paint(fn) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = y * this.w + x;
      if (!(this.data[i] >>> 24)) continue;
      const r = fn(x, y, this.data[i]);
      if (r) this.data[i] = col(r);
    }
  }
  // Recolor pixels inside an ellipse that are already set (useful for shading).
  shadeEllipse(cx, cy, rx, ry, c) {
    const v = col(c);
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1 && this.isSet(x, y)) this.data[y * this.w + x] = v;
      }
  }
  replace(from, to) {
    const a = col(from), b = col(to);
    for (let i = 0; i < this.data.length; i++) if (this.data[i] === a) this.data[i] = b;
  }
  // 1px outline around opaque pixels (4-neighbourhood).
  outline(c, diag = false) {
    const v = col(c);
    const src = this.data.slice();
    const w = this.w, h = this.h;
    const op = (x, y) => x >= 0 && y >= 0 && x < w && y < h && (src[y * w + x] >>> 24) > 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (op(x, y)) continue;
      if (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1) ||
        (diag && (op(x - 1, y - 1) || op(x + 1, y - 1) || op(x - 1, y + 1) || op(x + 1, y + 1)))) {
        this.data[y * w + x] = v;
      }
    }
    return this;
  }
  blit(other, dx, dy) {
    for (let y = 0; y < other.h; y++) for (let x = 0; x < other.w; x++) {
      const c = other.data[y * other.w + x];
      if (c >>> 24) this.set(dx + x, dy + y, c);
    }
    return this;
  }
  flipX() {
    const p = new PixelCanvas(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++)
      p.data[y * this.w + (this.w - 1 - x)] = this.data[y * this.w + x];
    return p;
  }
  // Solid-color silhouette (for hit flashes)
  silhouette(c) {
    const p = this.clone(); const v = col(c);
    for (let i = 0; i < p.data.length; i++) if (p.data[i] >>> 24) p.data[i] = v;
    return p;
  }
  // Recolor outline pixels (by matching the outline color) to another color
  scaled(s) {
    const p = new PixelCanvas(this.w * s, this.h * s);
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++)
      p.data[y * p.w + x] = this.data[Math.floor(y / s) * this.w + Math.floor(x / s)];
    return p;
  }
  toCanvas() {
    const cv = document.createElement('canvas');
    cv.width = this.w; cv.height = this.h;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.data);
    ctx.putImageData(img, 0, 0);
    return cv;
  }
}

// Helper to build a sprite record from PixelCanvas frames.
// anchor: ax, ay in pixels (usually bottom-center at the feet).
// Draws the same shapes onto a bigger canvas so a sprite can be re-rendered larger
// with crisp 1px pixels (used for evolved creatures). Same API as PixelCanvas.
class ScaledCanvas {
  constructor(w, h, k) { this.k = k; this.w = w; this.h = h; this.inner = new PixelCanvas(Math.ceil(w * k), Math.ceil(h * k)); this.cur = null; }
  S(v) { return v * this.k; }
  set(x, y, c) { const k = this.k; this.inner.rect(Math.floor(x * k), Math.floor(y * k), Math.max(1, Math.round(k)), Math.max(1, Math.round(k)), c); }
  get(x, y) {
    if (this.cur && x === this.cur.x && y === this.cur.y) return this.cur.v;
    return this.inner.get(Math.floor((x + 0.5) * this.k), Math.floor((y + 0.5) * this.k));
  }
  isSet(x, y) { return (this.get(x, y) >>> 24) > 0; }
  rect(x, y, w, h, c) {
    if (w <= 0 || h <= 0) return;
    const k = this.k, x0 = Math.floor(x * k), y0 = Math.floor(y * k);
    this.inner.rect(x0, y0, Math.ceil((x + w) * k) - x0, Math.ceil((y + h) * k) - y0, c);
  }
  ellipse(cx, cy, rx, ry, c) { this.inner.ellipse(cx * this.k, cy * this.k, rx * this.k, ry * this.k, c); }
  circle(cx, cy, r, c) { this.ellipse(cx, cy, r, r, c); }
  line(x0, y0, x1, y1, c) { const k = this.k; this.inner.line(x0 * k, y0 * k, x1 * k, y1 * k, c); }
  tri(x0, y0, x1, y1, x2, y2, c) { const k = this.k; this.inner.tri(x0 * k, y0 * k, x1 * k, y1 * k, x2 * k, y2 * k, c); }
  paint(fn) {
    const k = this.k;
    this.inner.paint((X, Y, v) => {
      const x = Math.floor(X / k), y = Math.floor(Y / k);
      this.cur = { x, y, v };
      const r = fn(x, y, v);
      this.cur = null;
      return r;
    });
  }
  shadeEllipse(cx, cy, rx, ry, c) { this.inner.shadeEllipse(cx * this.k, cy * this.k, rx * this.k, ry * this.k, c); }
  replace(a, b) { this.inner.replace(a, b); return this; }
  outline(c, diag) { this.inner.outline(c, diag); return this; }
}

let mkScale = 1;
// Factory used by creature drawing code instead of `new PixelCanvas`.
export function mk(w, h) { return mkScale === 1 ? new PixelCanvas(w, h) : new ScaledCanvas(w, h, mkScale); }
// Run a drawing function at a bigger scale; returns plain PixelCanvas (or an array of them).
export function drawScaled(k, fn) {
  const prev = mkScale;
  mkScale = k;
  try {
    const r = fn();
    const unwrap = (x) => (x instanceof ScaledCanvas ? x.inner : x);
    return Array.isArray(r) ? r.map(unwrap) : unwrap(r);
  } finally { mkScale = prev; }
}
export function recolor(pc, map) {
  for (const [a, b] of Object.entries(map)) pc.replace(a, b);
  return pc;
}

export function makeSprite(frames, ax, ay, extra = {}) {
  const w = frames[0].w, h = frames[0].h;
  return {
    w, h,
    ax: ax ?? Math.floor(w / 2), ay: ay ?? h - 1,
    frames: frames.map((f) => f.toCanvas()),
    flash: frames.map((f) => f.silhouette('#ffffff').toCanvas()),
    ...extra,
  };
}
