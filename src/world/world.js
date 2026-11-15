// Overworld generation, tile collision and the monster flow field.
import { mulberry32, fbm, clamp } from '../core/util.js';
import { PC } from '../gfx/assets.js';

export const TILE = 16;
export const T = { GRASS: 0, DIRT: 1, FARM: 2, WATER: 3, DARK: 4, STONE: 5 };
export const SOLID = { NONE: 0, WALL: 1, WATER: 2, BORDER: 3 };
const MAPW = 112, MAPH = 112, BORDER = 5;

export const BUILDINGS = {
  cottage: { solid: [0, 4, 2, 4], door: [44, 88], sortY: 80, tw: 6, th: 6, sw: 88, sh: 86 },
  barn: { solid: [0, 6, 2, 5], door: [58, 102], sortY: 96, tw: 8, th: 7, sw: 116, sh: 98 },
  shrine: { solid: [0, 3, 2, 4], door: [36, 88], sortY: 80, tw: 5, th: 6, sw: 72, sh: 80 },
};

export class World {
  constructor(seed = (Math.random() * 1e9) | 0) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.w = MAPW; this.h = MAPH;
    this.pw = MAPW * TILE; this.ph = MAPH * TILE;
    const n = MAPW * MAPH;
    this.tiles = new Uint8Array(n);
    this.solid = new Uint8Array(n);
    this.reserved = new Uint8Array(n);
    this.objects = [];
    this.baked = [];       // { pc, x, y } decals baked into the ground canvas
    this.bakedTall = [];   // tall sprites baked (border trees), drawn after decals
    this.shadows = [];     // { x, y, rx, ry }
    this.houses = [];
    this.lights = [];
    this.flowDist = new Int16Array(n);
    this.flowFrom = -1;
    this.generate();
  }

  idx(tx, ty) { return ty * this.w + tx; }
  inb(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h; }
  tileAt(tx, ty) { return this.inb(tx, ty) ? this.tiles[this.idx(tx, ty)] : T.DARK; }
  solidAt(tx, ty) { return this.inb(tx, ty) ? this.solid[this.idx(tx, ty)] : SOLID.BORDER; }
  r() { return this.rng(); }
  ri(a, b) { return Math.floor(a + this.rng() * (b - a + 1)); }

  // ------------------------------------------------------------ generation
  generate() {
    const { w, h } = this;
    for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
      const i = this.idx(tx, ty);
      const edge = Math.min(tx, ty, w - 1 - tx, h - 1 - ty);
      if (edge < BORDER) { this.solid[i] = SOLID.BORDER; this.tiles[i] = T.DARK; this.reserved[i] = 1; }
      else if (fbm(tx * 0.07, ty * 0.07, this.seed + 5) > 0.6) this.tiles[i] = T.DARK;
    }
    const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
    this.center = { tx: cx, ty: cy };
    // Plaza
    for (let ty = cy - 5; ty <= cy + 5; ty++) for (let tx = cx - 5; tx <= cx + 5; tx++) {
      const d = Math.hypot(tx - cx, ty - cy);
      if (d <= 4.6) this.setTile(tx, ty, T.STONE);
      if (d <= 7.5) this.reserved[this.idx(tx, ty)] = 1;
    }
    this.placeBuildings();
    this.carvePaths();
    this.placeFarms();
    this.placePonds();
    this.placeVillageProps();
    this.placeTrees();
    this.placeBorder();
    this.placeDecor();
    this.placeNodes();
    this.spawn = { x: cx * TILE + 8, y: (cy + 3) * TILE };
  }

  setTile(tx, ty, t) { if (this.inb(tx, ty)) this.tiles[this.idx(tx, ty)] = t; }
  free(tx, ty, w = 1, h = 1, margin = 0) {
    for (let y = ty - margin; y < ty + h + margin; y++) for (let x = tx - margin; x < tx + w + margin; x++) {
      if (!this.inb(x, y)) return false;
      const i = this.idx(x, y);
      if (this.reserved[i] || this.solid[i]) return false;
    }
    return true;
  }
  reserve(tx, ty, w, h) {
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) if (this.inb(x, y)) this.reserved[this.idx(x, y)] = 1;
  }

  placeBuildings() {
    const kinds = ['cottage', 'cottage', 'cottage', 'shrine', 'barn', 'cottage', 'barn', 'cottage', 'cottage', 'cottage', 'cottage', 'cottage'];
    const { cx, cy } = { cx: this.center.tx, cy: this.center.ty };
    let houseNum = 0;
    kinds.forEach((kind, k) => {
      const B = BUILDINGS[kind];
      for (let attempt = 0; attempt < 800; attempt++) {
        let tx, ty;
        if (k < 3) {
          const a = (k / 3) * Math.PI * 2 + this.r() * 0.8 - 0.4 - Math.PI / 2;
          const d = 9 + this.r() * 4;
          tx = Math.round(cx + Math.cos(a) * d - B.tw / 2); ty = Math.round(cy + Math.sin(a) * d - B.th / 2);
        } else {
          tx = this.ri(BORDER + 2, this.w - BORDER - B.tw - 2);
          ty = this.ri(BORDER + 1, this.h - BORDER - B.th - 3);
        }
        if (!this.free(tx - 1, ty, B.tw + 2, B.th + 2, 0)) continue;
        const bcx = tx + B.tw / 2, bcy = ty + B.th / 2;
        const minD = k < 3 ? 7 : 15;
        if (this.houses.some((o) => Math.hypot(o.tx + o.B.tw / 2 - bcx, o.ty + o.B.th / 2 - bcy) < minD)) continue;
        if (k >= 3 && Math.hypot(bcx - cx, bcy - cy) < 14) continue;
        const px = tx * TILE, py = ty * TILE;
        const spr = kind === 'cottage' ? `house_${houseNum++ % 6}` : kind;
        const house = {
          id: this.houses.length, kind, B, tx, ty, px, py, spr,
          doorX: px + B.door[0], doorY: py + B.door[1],
          sortY: py + B.sortY, looted: false, visited: false, interior: null,
        };
        this.houses.push(house);
        const [c0, c1, r0, r1] = B.solid;
        for (let y = ty + r0; y <= ty + r1; y++) for (let x = tx + c0; x <= tx + c1; x++) this.solid[this.idx(x, y)] = SOLID.WALL;
        this.reserve(tx - 1, ty, B.tw + 2, B.th + 2);
        this.objects.push({ spr, x: px + B.sw / 2, y: py + B.sh - 1, sortY: house.sortY, fade: true, house });
        this.shadows.push({ x: px + (B.tw * TILE) / 2, y: py + B.sortY, rx: B.tw * 8, ry: 5 });
        this.lights.push({ x: house.doorX + 12, y: house.doorY - 26, r: 34 });
        break;
      }
    });
  }

  carvePaths() {
    const { tx: cx, ty: cy } = this.center;
    const nodes = [[cx, cy]];
    const order = [...this.houses].sort((a, b) => Math.hypot(a.tx - cx, a.ty - cy) - Math.hypot(b.tx - cx, b.ty - cy));
    for (const hs of order) {
      const dx = Math.floor(hs.doorX / TILE), dy = Math.floor(hs.doorY / TILE);
      let best = nodes[0], bd = Infinity;
      for (const n of nodes) { const d = Math.hypot(n[0] - dx, n[1] - dy); if (d < bd) { bd = d; best = n; } }
      this.carve(dx, dy, best[0], best[1]);
      nodes.push([dx, dy + 1]);
    }
    // Roads leading off toward the edges
    this.carve(cx, cy, cx + this.ri(-6, 6), BORDER);
    this.carve(cx, cy, cx + this.ri(-6, 6), this.h - BORDER - 1);
    this.carve(cx, cy, BORDER, cy + this.ri(-6, 6));
    this.carve(cx, cy, this.w - BORDER - 1, cy + this.ri(-6, 6));
  }
  carve(ax, ay, bx, by) {
    let x = ax, y = ay, guard = 0;
    const paint = () => {
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
        const X = x + i, Y = y + j;
        if (!this.inb(X, Y)) continue;
        const k = this.idx(X, Y);
        if (this.solid[k]) continue;
        if (this.tiles[k] !== T.STONE) this.tiles[k] = T.DIRT;
        this.reserved[k] = 1;
      }
    };
    while ((x !== bx || y !== by) && guard++ < 2000) {
      paint();
      const dx = bx - x, dy = by - y;
      const wx = Math.abs(dx), wy = Math.abs(dy);
      if (wx && (!wy || this.r() < wx / (wx + wy))) x += Math.sign(dx); else y += Math.sign(dy);
    }
    paint();
  }

  placeFarms() {
    const crops = ['carrot', 'cabbage', 'wheat', 'pumpkin', 'sprout'];
    let farms = 0;
    for (const hs of this.houses) {
      if (hs.kind === 'shrine' || (this.r() < 0.35 && hs.kind !== 'barn')) continue;
      for (let attempt = 0; attempt < 10; attempt++) {
        const fw = this.ri(5, 8), fh = this.ri(3, 5);
        const left = this.r() < 0.5;
        const x0 = left ? hs.tx - fw - 2 : hs.tx + hs.B.tw + 2;
        const y0 = hs.ty + this.ri(1, 3);
        if (!this.free(x0 - 1, y0 - 1, fw + 2, fh + 2, 1)) continue;
        const kind = crops[this.ri(0, crops.length - 1)];
        for (let y = y0; y < y0 + fh; y++) for (let x = x0; x < x0 + fw; x++) {
          this.setTile(x, y, T.FARM);
          const pc = PC[`crop_${kind}`];
          if ((y - y0) % 1 === 0 && this.r() < 0.9) this.baked.push({ pc, name: `crop_${kind}`, x: x * TILE + 2, y: y * TILE + 2 });
        }
        // fence ring with a gap on the side facing the house
        const gapY = y0 + Math.floor(fh / 2);
        for (let x = x0 - 1; x <= x0 + fw; x++) { this.fence(x, y0 - 1, 'h'); this.fence(x, y0 + fh, 'h'); }
        for (let y = y0; y < y0 + fh; y++) {
          const gx = left ? x0 + fw : x0 - 1;
          if (!(y === gapY || y === gapY - 1)) this.fence(gx, y, 'v');
          this.fence(left ? x0 - 1 : x0 + fw, y, 'v');
        }
        this.reserve(x0 - 2, y0 - 2, fw + 4, fh + 4);
        // hay bales / scarecrow-ish props
        if (this.r() < 0.7) this.prop('hay', x0 + (left ? -2 : fw + 1), y0 + fh + 1, true);
        farms++;
        break;
      }
    }
    return farms;
  }
  fence(tx, ty, dir) {
    if (!this.inb(tx, ty) || this.solid[this.idx(tx, ty)]) return;
    this.solid[this.idx(tx, ty)] = SOLID.WALL;
    this.reserved[this.idx(tx, ty)] = 1;
    if (dir === 'h') this.objects.push({ spr: 'fence_h', x: tx * TILE + 8, y: ty * TILE + 13, sortY: ty * TILE + 13 });
    else this.objects.push({ spr: 'fence_v', x: tx * TILE + 8, y: ty * TILE + 16, sortY: ty * TILE + 16 });
  }
  prop(spr, tx, ty, solid = true, extra = {}) {
    if (!this.inb(tx, ty)) return false;
    const i = this.idx(tx, ty);
    if (this.solid[i] || (this.tiles[i] === T.WATER)) return false;
    if (solid) this.solid[i] = SOLID.WALL;
    this.reserved[i] = 1;
    const x = tx * TILE + 8, y = ty * TILE + 14;
    this.objects.push({ spr, x, y, sortY: y, ...extra });
    return true;
  }

  placePonds() {
    let made = 0;
    for (let attempt = 0; attempt < 200 && made < 4; attempt++) {
      const r = 3 + this.r() * 3;
      const pcx = this.ri(BORDER + 8, this.w - BORDER - 8), pcy = this.ri(BORDER + 8, this.h - BORDER - 8);
      const R = Math.ceil(r) + 2;
      if (!this.free(pcx - R, pcy - R, R * 2 + 1, R * 2 + 1)) continue;
      const water = [];
      for (let y = pcy - R; y <= pcy + R; y++) for (let x = pcx - R; x <= pcx + R; x++) {
        const d = Math.hypot((x - pcx) * 0.85, y - pcy) / r + (fbm(x * 0.4, y * 0.4, this.seed + 9) - 0.5) * 0.7;
        if (d < 1) water.push([x, y]);
      }
      for (const [x, y] of water) {
        this.setTile(x, y, T.WATER);
        this.solid[this.idx(x, y)] = SOLID.WATER;
      }
      this.reserve(pcx - R, pcy - R, R * 2 + 1, R * 2 + 1);
      for (const [x, y] of water) {
        const inner = [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => this.tileAt(x + a, y + b) === T.WATER);
        if (inner && this.r() < 0.18) { const name = `lily_${this.ri(0, 2)}`; this.baked.push({ pc: PC[name], name, x: x * TILE + this.ri(1, 5), y: y * TILE + this.ri(2, 6) }); }
      }
      made++;
    }
  }

  placeVillageProps() {
    const { tx: cx, ty: cy } = this.center;
    // Well in the plaza
    this.solid[this.idx(cx, cy)] = SOLID.WALL; this.solid[this.idx(cx - 1, cy)] = SOLID.WALL;
    this.objects.push({ spr: 'well', x: cx * TILE, y: cy * TILE + 15, sortY: cy * TILE + 15 });
    this.shadows.push({ x: cx * TILE, y: cy * TILE + 14, rx: 13, ry: 4 });
    // Lamps around the plaza
    for (const [ox, oy] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) {
      if (this.solidAt(cx + ox, cy + oy) === 0) {
        this.solid[this.idx(cx + ox, cy + oy)] = SOLID.WALL;
        const x = (cx + ox) * TILE + 8, y = (cy + oy) * TILE + 15;
        this.objects.push({ spr: 'lamp', x, y, sortY: y });
        this.lights.push({ x, y: y - 24, r: 46 });
      }
    }
    this.prop('sign', cx + 3, cy + 6, true);
    // Crates and barrels beside houses, carts by barns
    for (const hs of this.houses) {
      const sideX = this.r() < 0.5 ? hs.tx - 1 : hs.tx + hs.B.tw - (hs.kind === 'cottage' ? 1 : 0);
      const baseY = hs.ty + hs.B.solid[3];
      const props = hs.kind === 'barn' ? ['hay', 'hay', 'crate', 'barrel'] : ['crate', 'barrel', 'pot'];
      let n = this.ri(1, props.length);
      for (let k = 0; k < n; k++) {
        const spr = props[k];
        const tx = sideX, ty = baseY - k;
        const i = this.idx(tx, ty);
        if (!this.inb(tx, ty) || this.solid[i] || this.tiles[i] === T.WATER || this.tiles[i] === T.FARM) continue;
        this.solid[i] = SOLID.WALL;
        this.objects.push({ spr, x: tx * TILE + 8, y: ty * TILE + 15, sortY: ty * TILE + 15 });
      }
      if (hs.kind === 'barn') {
        const tx = hs.tx + hs.B.tw + 1, ty = hs.ty + hs.B.th - 1;
        if (this.free(tx, ty, 2, 1)) {
          this.solid[this.idx(tx, ty)] = SOLID.WALL; this.solid[this.idx(tx + 1, ty)] = SOLID.WALL;
          this.objects.push({ spr: 'cart', x: tx * TILE + 16, y: ty * TILE + 15, sortY: ty * TILE + 15 });
        }
      }
    }
  }

  treeSprite(tx, ty) {
    const dark = this.tiles[this.idx(tx, ty)] === T.DARK;
    const r = this.r();
    if (dark) return r < 0.25 ? `pine_${this.ri(0, 1)}` : r < 0.35 ? `tree_big_${this.ri(0, 1)}` : `tree_dark_${this.ri(0, 3)}`;
    if (r < 0.1) return `tree_autumn_${this.ri(0, 1)}`;
    if (r < 0.15) return `tree_pink_${this.ri(0, 1)}`;
    if (r < 0.22) return `pine_${this.ri(0, 1)}`;
    return `tree_green_${this.ri(0, 3)}`;
  }

  placeTrees() {
    const occupied = new Set();
    const near = (tx, ty, d) => {
      for (let y = ty - d; y <= ty + d; y++) for (let x = tx - d; x <= tx + d; x++) if (occupied.has(x * 1000 + y)) return true;
      return false;
    };
    for (let i = 0; i < 5000; i++) {
      const tx = this.ri(BORDER, this.w - BORDER - 1), ty = this.ri(BORDER, this.h - BORDER - 1);
      const k = this.idx(tx, ty);
      if (this.reserved[k] || this.solid[k]) continue;
      const t = this.tiles[k];
      if (t !== T.GRASS && t !== T.DARK) continue;
      const forest = fbm(tx * 0.07, ty * 0.07, this.seed + 5);
      const p = forest > 0.6 ? 0.7 : forest > 0.53 ? 0.18 : 0.025;
      if (this.r() > p) continue;
      if (near(tx, ty, 1) || (forest <= 0.6 && near(tx, ty, 2))) continue;
      occupied.add(tx * 1000 + ty);
      this.solid[k] = SOLID.WALL;
      const spr = this.treeSprite(tx, ty);
      const x = tx * TILE + 8 + this.ri(-2, 2), y = ty * TILE + 14;
      this.objects.push({ spr, x, y, sortY: y, fade: true, tree: true });
      this.shadows.push({ x, y: y - 1, rx: 11, ry: 4 });
    }
  }

  placeBorder() {
    const items = [];
    for (let y = -8; y < this.ph + 16; y += 15) for (let x = -8; x < this.pw + 16; x += 17) {
      const jx = x + ((this.r() * 10) | 0) - 5, jy = y + ((this.r() * 8) | 0) - 4;
      const tx = Math.floor(jx / TILE), ty = Math.floor(jy / TILE);
      const edge = Math.min(tx, ty, this.w - 1 - tx, this.h - 1 - ty);
      if (edge >= BORDER) continue;
      const spr = this.r() < 0.35 ? `pine_${this.ri(0, 1)}` : `tree_dark_${this.ri(0, 3)}`;
      const bottomInner = ty >= this.h - BORDER && ty <= this.h - BORDER + 2;
      if (bottomInner) this.objects.push({ spr, x: jx, y: jy, sortY: jy, fade: true, tree: true });
      else items.push({ spr, x: jx, y: jy });
    }
    items.sort((a, b) => a.y - b.y);
    this.bakedTall = items;
  }

  // Gathering spots (wood, stone, clay near water, rare iron): stand next to one to collect it.
  placeNodes() {
    this.nodes = [];
    const SPRITE = { wood: 'node_wood', stone: 'rock_big', clay: 'node_clay', iron: 'node_iron' };
    const kinds = [['wood', 9], ['stone', 7], ['clay', 4], ['iron', 3]];
    for (const [kind, n] of kinds) {
      for (let placed = 0, tries = 0; placed < n && tries < 400; tries++) {
        const tx = this.ri(BORDER + 3, this.w - BORDER - 4), ty = this.ri(BORDER + 3, this.h - BORDER - 4);
        if (!this.free(tx, ty, 1, 1, 1) || this.tiles[this.idx(tx, ty)] === T.WATER) continue;
        if (kind === 'clay' && !this.nearWater(tx, ty, 5) && tries < 300) continue;
        if (Math.hypot(tx - this.center.tx, ty - this.center.ty) < 8) continue;
        if (this.prop(SPRITE[kind], tx, ty, false, { node: { kind, t: 0 } })) { this.nodes.push(this.objects[this.objects.length - 1]); placed++; }
      }
    }
  }
  nearWater(tx, ty, r) {
    for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) if (this.tileAt(x, y) === T.WATER) return true;
    return false;
  }

  placeDecor() {
    const grassy = (tx, ty) => {
      const k = this.idx(tx, ty);
      const t = this.tiles[k];
      return (t === T.GRASS || t === T.DARK) && !this.solid[k];
    };
    const flowers = ['flower_r', 'flower_w', 'flower_y', 'flower_p', 'flower_b'];
    for (let i = 0; i < 3500; i++) {
      const tx = this.ri(BORDER, this.w - BORDER - 1), ty = this.ri(BORDER, this.h - BORDER - 1);
      if (!grassy(tx, ty)) continue;
      const name = this.tiles[this.idx(tx, ty)] === T.DARK ? 'tuft_d' : 'tuft';
      this.baked.push({ pc: PC[name], name, x: tx * TILE + this.ri(0, 11), y: ty * TILE + this.ri(0, 12) });
    }
    for (let c = 0; c < 140; c++) {
      const tx = this.ri(BORDER, this.w - BORDER - 1), ty = this.ri(BORDER, this.h - BORDER - 1);
      const fl = flowers[this.ri(0, flowers.length - 1)];
      const n = this.ri(3, 9);
      for (let i = 0; i < n; i++) {
        const x = tx + this.ri(-1, 1), y = ty + this.ri(-1, 1);
        if (!this.inb(x, y) || !grassy(x, y) || this.tiles[this.idx(x, y)] === T.DARK) continue;
        this.baked.push({ pc: PC[fl], name: fl, x: x * TILE + this.ri(0, 11), y: y * TILE + this.ri(0, 11) });
      }
    }
    for (let i = 0; i < 160; i++) {
      const tx = this.ri(BORDER, this.w - BORDER - 1), ty = this.ri(BORDER, this.h - BORDER - 1);
      const t = this.tileAt(tx, ty);
      if (t === T.GRASS || t === T.DIRT) this.baked.push({ pc: PC.rock_s, name: 'rock_s', x: tx * TILE + this.ri(0, 4), y: ty * TILE + this.ri(0, 7) });
    }
    // bushes (walk-through), big rocks and stumps (solid)
    for (let i = 0; i < 400; i++) {
      const tx = this.ri(BORDER, this.w - BORDER - 1), ty = this.ri(BORDER, this.h - BORDER - 1);
      const k = this.idx(tx, ty);
      if (this.reserved[k] || this.solid[k] || !grassy(tx, ty)) continue;
      const r = this.r();
      if (r < 0.55) {
        const x = tx * TILE + 8, y = ty * TILE + 13;
        this.objects.push({ spr: `bush_${this.ri(0, 1)}`, x, y, sortY: y });
        this.reserved[k] = 1;
      } else if (r < 0.8) { this.prop('rock_big', tx, ty, true); this.shadows.push({ x: tx * TILE + 8, y: ty * TILE + 13, rx: 9, ry: 3 }); }
      else this.prop('stump', tx, ty, true);
    }
  }

  // ------------------------------------------------------------ collision
  blocks(tx, ty, flyer) {
    const s = this.solidAt(tx, ty);
    return flyer ? s === SOLID.BORDER : s !== 0;
  }
  // Move a circle-collider entity, sliding along solid tiles.
  move(ent, dx, dy, r, flyer = false) {
    ent.x += dx; this.resolve(ent, r, flyer);
    ent.y += dy; this.resolve(ent, r, flyer);
    ent.x = clamp(ent.x, r, this.pw - r); ent.y = clamp(ent.y, r, this.ph - r);
  }
  resolve(ent, r, flyer) {
    const tx0 = Math.floor((ent.x - r) / TILE), tx1 = Math.floor((ent.x + r) / TILE);
    const ty0 = Math.floor((ent.y - r) / TILE), ty1 = Math.floor((ent.y + r) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!this.blocks(tx, ty, flyer)) continue;
      const rx = tx * TILE, ry = ty * TILE;
      const nx = clamp(ent.x, rx, rx + TILE), ny = clamp(ent.y, ry, ry + TILE);
      let dx = ent.x - nx, dy = ent.y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 === 0) {
        // centre inside the tile: push out along the shortest axis
        const l = ent.x - rx, rr = rx + TILE - ent.x, t = ent.y - ry, b = ry + TILE - ent.y;
        const m = Math.min(l, rr, t, b);
        if (m === l) ent.x = rx - r; else if (m === rr) ent.x = rx + TILE + r;
        else if (m === t) ent.y = ry - r; else ent.y = ry + TILE + r;
        continue;
      }
      const d = Math.sqrt(d2);
      ent.x = nx + (dx / d) * r; ent.y = ny + (dy / d) * r;
    }
  }
  walkable(x, y) { return this.solidAt(Math.floor(x / TILE), Math.floor(y / TILE)) === 0; }

  // ------------------------------------------------------------ flow field (BFS toward the player)
  updateFlow(px, py) {
    const ptx = Math.floor(px / TILE), pty = Math.floor(py / TILE);
    const from = this.idx(clamp(ptx, 0, this.w - 1), clamp(pty, 0, this.h - 1));
    if (from === this.flowFrom) return;
    this.flowFrom = from;
    const dist = this.flowDist;
    dist.fill(32767);
    const q = new Int32Array(this.w * this.h);
    let head = 0, tail = 0;
    dist[from] = 0; q[tail++] = from;
    const W = this.w;
    while (head < tail) {
      const cur = q[head++];
      const cxx = cur % W, cyy = (cur / W) | 0;
      const nd = dist[cur] + 1;
      if (nd > 90) continue;
      for (let k = 0; k < 4; k++) {
        const nx = cxx + (k === 0 ? 1 : k === 1 ? -1 : 0), ny = cyy + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= W || ny >= this.h) continue;
        const ni = ny * W + nx;
        if (this.solid[ni] || dist[ni] <= nd) continue;
        dist[ni] = nd; q[tail++] = ni;
      }
    }
  }
  // Direction (unit vector) a walker at (x,y) should move to approach the player
  flowDir(x, y) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (!this.inb(tx, ty)) return null;
    const W = this.w, dist = this.flowDist;
    const here = dist[ty * W + tx];
    let best = here, bx = 0, by = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oy) continue;
      const nx = tx + ox, ny = ty + oy;
      if (!this.inb(nx, ny)) continue;
      if (ox && oy && (this.solid[ty * W + nx] || this.solid[ny * W + tx])) continue;
      const d = dist[ny * W + nx];
      if (d < best) { best = d; bx = ox; by = oy; }
    }
    if (best >= here) return null;
    const tx2 = (tx + bx) * TILE + 8, ty2 = (ty + by) * TILE + 8;
    const dx = tx2 - x, dy = ty2 - y, d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d };
  }
}
