// Uniform-grid spatial hash for fast neighbour queries.
export class SpatialHash {
  constructor(cell = 32) { this.cell = cell; this.map = new Map(); }
  clear() { this.map.clear(); }
  key(cx, cy) { return cx * 73856093 ^ cy * 19349663; }
  insert(obj) {
    const cx = Math.floor(obj.x / this.cell), cy = Math.floor(obj.y / this.cell);
    const k = this.key(cx, cy);
    let b = this.map.get(k);
    if (!b) { b = []; this.map.set(k, b); }
    b.push(obj);
  }
  // Calls fn(obj) for objects in cells overlapping the circle's bounding box.
  query(x, y, r, fn) {
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const b = this.map.get(this.key(cx, cy));
      if (!b) continue;
      for (let i = 0; i < b.length; i++) if (fn(b[i]) === false) return;
    }
  }
}
