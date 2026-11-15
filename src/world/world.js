// The overworld: endless, generated in 32x32-tile chunks as you walk, from the run's seed (the same
// spot always comes out the same). Big zones, one per survivalmon type, set the look of the land and
// which wild survivalmons turn up. The village plaza sits at the start. Also: tile collision and the
// monster flow field, which only covers the area around the hero.
import { mulberry32, fbm, hash2, clamp } from '../core/util.js';
import { PC } from '../gfx/assets.js';

export const TILE = 16;
export const T = { GRASS: 0, DIRT: 1, FARM: 2, WATER: 3, DARK: 4, STONE: 5, SAND: 6, ASH: 7, GRAVEL: 8, FROST: 9, BLOSSOM: 10 };
// each zone's own ground, laid in patches over the grass
const ZONE_GROUND = { water: T.SAND, fire: T.ASH, rock: T.GRAVEL, storm: T.FROST, fairy: T.BLOSSOM };
export const SOLID = { NONE: 0, WALL: 1, WATER: 2, BORDER: 3 };
export const CHUNK = 32;            // tiles per chunk side
const ACTIVE_R = 2;                // chunks kept live around the hero (5 x 5)
const FLOW = 128;                  // flow field window, tiles per side
const ZONE_CELL = 44;              // zone cells, tiles

export const BUILDINGS = {
  cottage: { solid: [0, 4, 2, 4], door: [44, 88], sortY: 80, tw: 6, th: 6, sw: 88, sh: 86 },
  barn: { solid: [0, 6, 2, 5], door: [58, 102], sortY: 96, tw: 8, th: 7, sw: 116, sh: 98 },
  shrine: { solid: [0, 3, 2, 4], door: [36, 88], sortY: 80, tw: 5, th: 6, sw: 72, sh: 80 },
};

// Six zones. `mons` are the species that mostly live there (a zone can hold more than one, and a
// species doesn't have to belong to any zone: those turn up anywhere, just more rarely).
// `native` is the zone's own monster, which joins the Blight everywhere else spawns.
export const ZONES = {
  grass: { name: 'Leafy Meadow', mons: ['leafkit'], native: 'thornling', color: '#74c44c', note: 'Leafkit lives here' },
  water: { name: 'Lakelands', mons: ['puddlit', 'venewt'], native: 'bogcrab', color: '#4aa3df', note: 'Puddlit and Venewt live here' },
  rock: { name: 'Stony Quarry', mons: ['pebblet', 'ferrit'], native: 'sawbeetle', color: '#b8b0a0', note: 'Pebblet and Ferrit live here' },
  fire: { name: 'Ember Fields', mons: ['emberpup', 'duskit'], native: 'cinderimp', color: '#e0a060', note: 'Emberpup and Duskit live here' },
  storm: { name: 'Windy Highlands', mons: ['voltowl', 'snowpip'], native: 'snowgolem', color: '#9ac0d8', note: 'Voltowl and Snowpip live here' },
  fairy: { name: 'Blossom Glades', mons: ['glimmoth'], native: 'wiltsprite', color: '#f0a8d8', note: 'Glimmoth lives here' },
};
const ZONE_IDS = Object.keys(ZONES);

// what each zone grows: tree mix, forest level, ponds, houses, gathering spots
const LOOK = {
  grass: { forest: 0.6, trees: 0.03, ponds: 0.25, house: 0.45, flowers: 14, rocks: 8, nodes: { wood: 2, stone: 1 } },
  water: { forest: 0.68, trees: 0.02, ponds: 1, house: 0.3, flowers: 6, rocks: 6, nodes: { clay: 2, wood: 1 } },
  rock: { forest: 0.72, trees: 0.008, ponds: 0.05, house: 0.25, flowers: 2, rocks: 34, nodes: { stone: 2, iron: 1 } },
  fire: { forest: 0.74, trees: 0.015, ponds: 0.05, house: 0.3, flowers: 3, rocks: 16, nodes: { iron: 1, stone: 1, wood: 1 } },
  storm: { forest: 0.58, trees: 0.02, ponds: 0.15, house: 0.25, flowers: 4, rocks: 14, nodes: { stone: 1, iron: 1, wood: 1 } },
  fairy: { forest: 0.66, trees: 0.04, ponds: 0.3, house: 0.4, flowers: 34, rocks: 4, nodes: { wood: 1, clay: 1 } },
};

const key = (cx, cy) => (cx + 32768) * 65536 + (cy + 32768);
const ihash = (a, b, c) => { let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return h >>> 0; };

export class World {
  constructor(seed = (Math.random() * 1e9) | 0) {
    this.seed = seed;
    this.infinite = true;
    this.chunks = new Map();
    this.objects = []; this.houses = []; this.nodes = []; this.lights = [];
    this.activeKey = null;
    this.houseCount = 0;
    // the village plaza is in the middle of chunk (0, 0)
    this.center = { tx: CHUNK / 2, ty: CHUNK / 2 };
    this.spawn = { x: this.center.tx * TILE + 8, y: (this.center.ty + 3) * TILE };
    this.flowDist = new Int16Array(FLOW * FLOW);
    this.flowX0 = 0; this.flowY0 = 0;
    this.flowFrom = -1;
    this.activate(this.spawn.x, this.spawn.y);
  }

  // ------------------------------------------------------------ chunks
  chunk(cx, cy) {
    const k = key(cx, cy);
    let c = this.chunks.get(k);
    if (!c) { c = new Chunk(this, cx, cy); this.chunks.set(k, c); }
    return c;
  }
  chunkOfTile(tx, ty) { return this.chunk(Math.floor(tx / CHUNK), Math.floor(ty / CHUNK)); }
  // Keep the chunks around the hero live; the scene lists (objects, houses, nodes, lights) hold only those.
  activate(px, py) {
    const cx = Math.floor(px / TILE / CHUNK), cy = Math.floor(py / TILE / CHUNK);
    const k = key(cx, cy);
    if (k === this.activeKey) return false;
    this.activeKey = k;
    const live = [];
    for (let y = cy - ACTIVE_R; y <= cy + ACTIVE_R; y++) for (let x = cx - ACTIVE_R; x <= cx + ACTIVE_R; x++) live.push(this.chunk(x, y));
    this.active = live;
    this.objects = live.flatMap((c) => c.objects);
    this.houses = live.flatMap((c) => c.houses);
    this.nodes = live.flatMap((c) => c.nodes);
    this.lights = live.flatMap((c) => c.lights);
    return true;
  }
  // Take an object off the map for good (a gathered spot).
  removeObject(o) {
    const c = o.chunk;
    if (c) { c.objects = c.objects.filter((x) => x !== o); c.nodes = c.nodes.filter((x) => x !== o); }
    this.objects = this.objects.filter((x) => x !== o);
    this.nodes = this.nodes.filter((x) => x !== o);
  }
  // Chunks overlapping a pixel rectangle (for drawing ground decals).
  chunksIn(x0, y0, x1, y1) {
    const out = [];
    const c0 = Math.floor(x0 / TILE / CHUNK), c1 = Math.floor(x1 / TILE / CHUNK);
    const r0 = Math.floor(y0 / TILE / CHUNK), r1 = Math.floor(y1 / TILE / CHUNK);
    for (let y = r0; y <= r1; y++) for (let x = c0; x <= c1; x++) out.push(this.chunk(x, y));
    return out;
  }

  tileAt(tx, ty) { const c = this.chunkOfTile(tx, ty); return c.tiles[(ty - c.ty0) * CHUNK + (tx - c.tx0)]; }
  solidAt(tx, ty) { const c = this.chunkOfTile(tx, ty); return c.solid[(ty - c.ty0) * CHUNK + (tx - c.tx0)]; }

  // ------------------------------------------------------------ zones
  zoneAt(tx, ty) {
    if (Math.hypot(tx - this.center.tx, ty - this.center.ty) < 22) return 'grass'; // around the village
    const ci = Math.floor(tx / ZONE_CELL), cj = Math.floor(ty / ZONE_CELL);
    let best = Infinity, zone = 'grass';
    for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
      const h = ihash(this.seed, i, j);
      const px = (i + 0.15 + 0.7 * ((h & 1023) / 1023)) * ZONE_CELL, py = (j + 0.15 + 0.7 * (((h >>> 10) & 1023) / 1023)) * ZONE_CELL;
      const d = (tx - px) ** 2 + (ty - py) ** 2;
      if (d < best) { best = d; zone = i === 0 && j === 0 ? 'grass' : ZONE_IDS[(h >>> 20) % ZONE_IDS.length]; }
    }
    return zone;
  }
  zoneAtPx(x, y) { return this.zoneAt(Math.floor(x / TILE), Math.floor(y / TILE)); }

  // ------------------------------------------------------------ collision
  blocks(tx, ty, flyer) {
    const s = this.solidAt(tx, ty);
    return flyer ? s === SOLID.BORDER : s !== 0;
  }
  // Move a circle-collider entity, sliding along solid tiles.
  move(ent, dx, dy, r, flyer = false) {
    ent.x += dx; this.resolve(ent, r, flyer);
    ent.y += dy; this.resolve(ent, r, flyer);
  }
  resolve(ent, r, flyer) {
    const tx0 = Math.floor((ent.x - r) / TILE), tx1 = Math.floor((ent.x + r) / TILE);
    const ty0 = Math.floor((ent.y - r) / TILE), ty1 = Math.floor((ent.y + r) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!this.blocks(tx, ty, flyer)) continue;
      const rx = tx * TILE, ry = ty * TILE;
      const nx = clamp(ent.x, rx, rx + TILE), ny = clamp(ent.y, ry, ry + TILE);
      const dx = ent.x - nx, dy = ent.y - ny;
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
  // It covers a FLOW x FLOW tile window centred on the hero, rebuilt when the hero changes tile.
  updateFlow(px, py) {
    const ptx = Math.floor(px / TILE), pty = Math.floor(py / TILE);
    const from = ptx * 100003 + pty;
    if (from === this.flowFrom) return;
    this.flowFrom = from;
    const x0 = this.flowX0 = ptx - FLOW / 2, y0 = this.flowY0 = pty - FLOW / 2;
    // the solid map for the window, read once
    const solid = this.flowSolid || (this.flowSolid = new Uint8Array(FLOW * FLOW));
    for (const c of this.chunksIn(x0 * TILE, y0 * TILE, (x0 + FLOW) * TILE - 1, (y0 + FLOW) * TILE - 1)) {
      const ax = Math.max(x0, c.tx0), bx = Math.min(x0 + FLOW, c.tx0 + CHUNK);
      const ay = Math.max(y0, c.ty0), by = Math.min(y0 + FLOW, c.ty0 + CHUNK);
      for (let ty = ay; ty < by; ty++) for (let tx = ax; tx < bx; tx++) solid[(ty - y0) * FLOW + (tx - x0)] = c.solid[(ty - c.ty0) * CHUNK + (tx - c.tx0)];
    }
    const dist = this.flowDist;
    dist.fill(32767);
    const q = this.flowQ || (this.flowQ = new Int32Array(FLOW * FLOW));
    let head = 0, tail = 0;
    const start = (pty - y0) * FLOW + (ptx - x0);
    dist[start] = 0; q[tail++] = start;
    while (head < tail) {
      const cur = q[head++];
      const cxx = cur % FLOW, cyy = (cur / FLOW) | 0;
      const nd = dist[cur] + 1;
      if (nd > 90) continue;
      for (let k = 0; k < 4; k++) {
        const nx = cxx + (k === 0 ? 1 : k === 1 ? -1 : 0), ny = cyy + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= FLOW || ny >= FLOW) continue;
        const ni = ny * FLOW + nx;
        if (solid[ni] || dist[ni] <= nd) continue;
        dist[ni] = nd; q[tail++] = ni;
      }
    }
  }
  // Steps from (x, y) to the hero, or 32767 when unknown (outside the window or cut off).
  flowAt(x, y) {
    const tx = Math.floor(x / TILE) - this.flowX0, ty = Math.floor(y / TILE) - this.flowY0;
    if (tx < 0 || ty < 0 || tx >= FLOW || ty >= FLOW) return 32767;
    return this.flowDist[ty * FLOW + tx];
  }
  // Direction (unit vector) a walker at (x,y) should move to approach the player
  flowDir(x, y) {
    const tx = Math.floor(x / TILE) - this.flowX0, ty = Math.floor(y / TILE) - this.flowY0;
    if (tx < 1 || ty < 1 || tx >= FLOW - 1 || ty >= FLOW - 1) return null;
    const dist = this.flowDist, solid = this.flowSolid;
    const here = dist[ty * FLOW + tx];
    let best = here, bx = 0, by = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oy) continue;
      const nx = tx + ox, ny = ty + oy;
      if (ox && oy && (solid[ty * FLOW + nx] || solid[ny * FLOW + tx])) continue;
      const d = dist[ny * FLOW + nx];
      if (d < best) { best = d; bx = ox; by = oy; }
    }
    if (best >= here) return null;
    const tx2 = (tx + this.flowX0 + bx) * TILE + 8, ty2 = (ty + this.flowY0 + by) * TILE + 8;
    const dx = tx2 - x, dy = ty2 - y, d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d };
  }
}

// ---------------------------------------------------------------- one chunk of land
class Chunk {
  constructor(world, cx, cy) {
    this.world = world; this.cx = cx; this.cy = cy;
    this.tx0 = cx * CHUNK; this.ty0 = cy * CHUNK;
    const n = CHUNK * CHUNK;
    this.tiles = new Uint8Array(n); this.solid = new Uint8Array(n); this.reserved = new Uint8Array(n);
    this.objects = []; this.baked = []; this.shadows = []; this.bakedTall = [];
    this.houses = []; this.nodes = []; this.lights = [];
    this.seed = world.seed;
    this.rng = mulberry32(ihash(world.seed, cx, cy));
    this.generate();
  }
  r() { return this.rng(); }
  ri(a, b) { return Math.floor(a + this.rng() * (b - a + 1)); }
  inb(tx, ty) { return tx >= this.tx0 && ty >= this.ty0 && tx < this.tx0 + CHUNK && ty < this.ty0 + CHUNK; }
  idx(tx, ty) { return (ty - this.ty0) * CHUNK + (tx - this.tx0); }
  // inside the chunk only: neighbours are never generated from here, so outside reads as grass
  tileAt(tx, ty) { return this.inb(tx, ty) ? this.tiles[this.idx(tx, ty)] : T.GRASS; }
  setTile(tx, ty, t) { if (this.inb(tx, ty)) this.tiles[this.idx(tx, ty)] = t; }
  free(tx, ty, w = 1, h = 1, margin = 0) {
    for (let y = ty - margin; y < ty + h + margin; y++) for (let x = tx - margin; x < tx + w + margin; x++) {
      if (!this.inb(x, y)) return false;
      const i = this.idx(x, y);
      if (this.reserved[i] || this.solid[i]) return false;
    }
    return true;
  }
  reserve(tx, ty, w, h) { for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) if (this.inb(x, y)) this.reserved[this.idx(x, y)] = 1; }
  add(o) { o.chunk = this; this.objects.push(o); return o; }
  prop(spr, tx, ty, solid = true, extra = {}) {
    if (!this.inb(tx, ty)) return null;
    const i = this.idx(tx, ty);
    if (this.solid[i] || this.tiles[i] === T.WATER) return null;
    if (solid) this.solid[i] = SOLID.WALL;
    this.reserved[i] = 1;
    const x = tx * TILE + 8, y = ty * TILE + 14;
    return this.add({ spr, x, y, sortY: y, ...extra });
  }
  // a random tile inside the chunk, keeping `m` tiles from its edges
  spot(m = 1) { return [this.tx0 + this.ri(m, CHUNK - 1 - m), this.ty0 + this.ri(m, CHUNK - 1 - m)]; }
  zone(tx, ty) { return this.world.zoneAt(tx, ty); }

  // ------------------------------------------------------------ generation
  generate() {
    const W = this.world, s = this.seed;
    const village = this.cx === 0 && this.cy === 0;
    // ground
    for (let ty = this.ty0; ty < this.ty0 + CHUNK; ty++) for (let tx = this.tx0; tx < this.tx0 + CHUNK; tx++) {
      const z = this.zone(tx, ty), L = LOOK[z];
      let t = T.GRASS;
      const forest = fbm(tx * 0.07, ty * 0.07, s + 5);
      const patch = fbm(tx * 0.09, ty * 0.09, s + 11);
      // the zone's own ground covers much of it (the lakes get theirs as beaches round the water)
      const own = { rock: 0.44, storm: 0.48, fire: 0.42, fairy: 0.5, water: 0.6 }[z];
      if (own !== undefined && patch > own) t = ZONE_GROUND[z];
      if (forest > L.forest) t = T.DARK;
      // winding trails across the land
      const road = fbm(tx * 0.017, ty * 0.017, s + 21);
      if (Math.abs(road - 0.5) < 0.011) t = T.DIRT;
      this.tiles[this.idx(tx, ty)] = t;
    }
    if (village) this.makeVillage();
    this.placePonds();
    if (!village) this.placeHouse();
    this.placeTrees();
    this.placeDecor();
    this.placeNodes();
  }
  look() { return LOOK[this.zone(this.tx0 + CHUNK / 2, this.ty0 + CHUNK / 2)]; }

  makeVillage() {
    const { tx: cx, ty: cy } = this.world.center;
    for (let ty = cy - 8; ty <= cy + 8; ty++) for (let tx = cx - 8; tx <= cx + 8; tx++) {
      const d = Math.hypot(tx - cx, ty - cy);
      if (d <= 4.6) this.setTile(tx, ty, T.STONE);
      else if (this.tileAt(tx, ty) === T.DARK) this.setTile(tx, ty, T.GRASS);
      if (d <= 7.5) this.reserved[this.idx(tx, ty)] = 1;
    }
    // well and lamps on the plaza
    this.solid[this.idx(cx, cy)] = SOLID.WALL; this.solid[this.idx(cx - 1, cy)] = SOLID.WALL;
    this.add({ spr: 'well', x: cx * TILE, y: cy * TILE + 15, sortY: cy * TILE + 15 });
    this.shadows.push({ x: cx * TILE, y: cy * TILE + 14, rx: 13, ry: 4 });
    for (const [ox, oy] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) {
      this.solid[this.idx(cx + ox, cy + oy)] = SOLID.WALL;
      const x = (cx + ox) * TILE + 8, y = (cy + oy) * TILE + 15;
      this.add({ spr: 'lamp', x, y, sortY: y });
      this.lights.push({ x, y: y - 24, r: 46 });
    }
    this.prop('sign', cx + 3, cy + 6, true);
    // three cottages around the plaza, joined to it by dirt paths
    for (let k = 0; k < 3; k++) {
      const B = BUILDINGS.cottage;
      for (let attempt = 0; attempt < 200; attempt++) {
        const a = (k / 3) * Math.PI * 2 + this.r() * 0.8 - 0.4 - Math.PI / 2;
        const d = 9 + this.r() * 3;
        const tx = Math.round(cx + Math.cos(a) * d - B.tw / 2), ty = Math.round(cy + Math.sin(a) * d - B.th / 2);
        if (this.addHouse('cottage', tx, ty)) break;
      }
    }
    for (const hs of this.houses) this.carve(Math.floor(hs.doorX / TILE), Math.floor(hs.doorY / TILE), cx, cy);
    // roads out of the village in four directions
    this.carve(cx, cy, cx + this.ri(-3, 3), this.ty0);
    this.carve(cx, cy, cx + this.ri(-3, 3), this.ty0 + CHUNK - 1);
    this.carve(cx, cy, this.tx0, cy + this.ri(-3, 3));
    this.carve(cx, cy, this.tx0 + CHUNK - 1, cy + this.ri(-3, 3));
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
    while ((x !== bx || y !== by) && guard++ < 400) {
      paint();
      const dx = bx - x, dy = by - y, wx = Math.abs(dx), wy = Math.abs(dy);
      if (wx && (!wy || this.r() < wx / (wx + wy))) x += Math.sign(dx); else y += Math.sign(dy);
    }
    paint();
  }

  // A loot house (the clock stops inside). Returns it, or null if it didn't fit.
  addHouse(kind, tx, ty) {
    const B = BUILDINGS[kind];
    if (!this.free(tx - 1, ty, B.tw + 2, B.th + 2, 0)) return null;
    const px = tx * TILE, py = ty * TILE;
    const n = this.world.houseCount++;
    const spr = kind === 'cottage' ? `house_${ihash(this.seed, tx, ty) % 6}` : kind;
    const house = {
      id: ihash(this.seed, tx, ty) % 1000000, kind, B, tx, ty, px, py, spr, n,
      doorX: px + B.door[0], doorY: py + B.door[1],
      sortY: py + B.sortY, looted: false, visited: false, interior: null,
    };
    this.houses.push(house);
    const [c0, c1, r0, r1] = B.solid;
    for (let y = ty + r0; y <= ty + r1; y++) for (let x = tx + c0; x <= tx + c1; x++) if (this.inb(x, y)) this.solid[this.idx(x, y)] = SOLID.WALL;
    this.reserve(tx - 1, ty, B.tw + 2, B.th + 2);
    this.add({ spr, x: px + B.sw / 2, y: py + B.sh - 1, sortY: house.sortY, fade: true, house });
    this.shadows.push({ x: px + (B.tw * TILE) / 2, y: py + B.sortY, rx: B.tw * 8, ry: 5 });
    this.lights.push({ x: house.doorX + 12, y: house.doorY - 26, r: 34 });
    // a patch of dirt at the door, and a few crates or barrels beside the house
    const dx = Math.floor(house.doorX / TILE), dy = Math.floor(house.doorY / TILE);
    for (let y = dy; y <= dy + 1; y++) for (let x = dx - 1; x <= dx; x++) if (this.inb(x, y) && !this.solid[this.idx(x, y)] && this.tileAt(x, y) !== T.WATER) this.setTile(x, y, T.DIRT);
    const sideX = this.r() < 0.5 ? tx - 1 : tx + B.tw - (kind === 'cottage' ? 1 : 0);
    const props = kind === 'barn' ? ['hay', 'crate', 'barrel'] : ['crate', 'barrel', 'pot'];
    for (let k = 0, n2 = this.ri(1, props.length); k < n2; k++) {
      const x = sideX, y = ty + B.solid[3] - k;
      if (!this.inb(x, y) || this.solid[this.idx(x, y)] || this.tileAt(x, y) === T.WATER) continue;
      this.solid[this.idx(x, y)] = SOLID.WALL;
      this.add({ spr: props[k], x: x * TILE + 8, y: y * TILE + 15, sortY: y * TILE + 15 });
    }
    return house;
  }
  placeHouse() {
    const L = this.look();
    if (this.r() > L.house) return;
    const z = this.zone(this.tx0 + CHUNK / 2, this.ty0 + CHUNK / 2);
    const kind = z === 'fairy' && this.r() < 0.5 ? 'shrine' : z === 'grass' && this.r() < 0.3 ? 'barn' : 'cottage';
    const B = BUILDINGS[kind];
    for (let attempt = 0; attempt < 40; attempt++) {
      const tx = this.tx0 + this.ri(2, CHUNK - B.tw - 3), ty = this.ty0 + this.ri(1, CHUNK - B.th - 3);
      const h = this.addHouse(kind, tx, ty);
      if (!h) continue;
      if (kind !== 'shrine' && z === 'grass' && this.r() < 0.5) this.placeFarm(h);
      return;
    }
  }
  placeFarm(hs) {
    const crops = ['carrot', 'cabbage', 'wheat', 'pumpkin', 'sprout'];
    for (let attempt = 0; attempt < 8; attempt++) {
      const fw = this.ri(4, 6), fh = this.ri(3, 4);
      const left = this.r() < 0.5;
      const x0 = left ? hs.tx - fw - 2 : hs.tx + hs.B.tw + 2, y0 = hs.ty + this.ri(1, 2);
      if (!this.free(x0 - 1, y0 - 1, fw + 2, fh + 2, 1)) continue;
      const kind = crops[this.ri(0, crops.length - 1)];
      for (let y = y0; y < y0 + fh; y++) for (let x = x0; x < x0 + fw; x++) {
        this.setTile(x, y, T.FARM);
        if (this.r() < 0.9) this.baked.push({ pc: PC[`crop_${kind}`], name: `crop_${kind}`, x: x * TILE + 2, y: y * TILE + 2 });
      }
      this.reserve(x0 - 1, y0 - 1, fw + 2, fh + 2);
      return;
    }
  }

  placePonds() {
    const L = this.look();
    const tries = L.ponds >= 1 ? this.ri(2, 4) : this.r() < L.ponds ? 1 : 0;
    for (let p = 0; p < tries; p++) {
      for (let attempt = 0; attempt < 30; attempt++) {
        const r = L.ponds >= 1 ? 3 + this.r() * 4 : 2.5 + this.r() * 2.5;
        const R = Math.ceil(r) + 2;
        const pcx = this.tx0 + this.ri(R + 1, CHUNK - R - 2), pcy = this.ty0 + this.ri(R + 1, CHUNK - R - 2);
        if (!this.free(pcx - R, pcy - R, R * 2 + 1, R * 2 + 1)) continue;
        const water = [];
        for (let y = pcy - R; y <= pcy + R; y++) for (let x = pcx - R; x <= pcx + R; x++) {
          const d = Math.hypot((x - pcx) * 0.85, y - pcy) / r + (fbm(x * 0.4, y * 0.4, this.seed + 9) - 0.5) * 0.7;
          if (d < 1) water.push([x, y]);
        }
        for (const [x, y] of water) { this.setTile(x, y, T.WATER); this.solid[this.idx(x, y)] = SOLID.WATER; }
        if (this.zone(pcx, pcy) === 'water') {
          for (let y = pcy - R; y <= pcy + R; y++) for (let x = pcx - R; x <= pcx + R; x++) {
            if (!this.inb(x, y) || this.solid[this.idx(x, y)]) continue;
            let near = false;
            for (let j = -2; j <= 2 && !near; j++) for (let i = -2; i <= 2 && !near; i++) near = this.tileAt(x + i, y + j) === T.WATER;
            if (near) this.setTile(x, y, T.SAND);
          }
        }
        this.reserve(pcx - R, pcy - R, R * 2 + 1, R * 2 + 1);
        for (const [x, y] of water) {
          const inner = [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => this.tileAt(x + a, y + b) === T.WATER);
          if (inner && this.r() < 0.18) { const name = `lily_${this.ri(0, 2)}`; this.baked.push({ pc: PC[name], name, x: x * TILE + this.ri(1, 5), y: y * TILE + this.ri(2, 6) }); }
        }
        break;
      }
    }
  }

  treeSprite(tx, ty, z) {
    const dark = this.tileAt(tx, ty) === T.DARK, r = this.r();
    if (z === 'fire') return r < 0.75 ? `tree_autumn_${this.ri(0, 1)}` : `tree_dark_${this.ri(0, 3)}`;
    if (z === 'storm') return r < 0.75 ? `pine_${this.ri(0, 1)}` : `tree_dark_${this.ri(0, 3)}`;
    if (z === 'fairy') return r < 0.65 ? `tree_pink_${this.ri(0, 1)}` : `tree_green_${this.ri(0, 3)}`;
    if (z === 'rock') return r < 0.6 ? `pine_${this.ri(0, 1)}` : `tree_dark_${this.ri(0, 3)}`;
    if (dark) return r < 0.25 ? `pine_${this.ri(0, 1)}` : r < 0.35 ? `tree_big_${this.ri(0, 1)}` : `tree_dark_${this.ri(0, 3)}`;
    if (r < 0.08) return `tree_autumn_${this.ri(0, 1)}`;
    if (r < 0.14) return `tree_pink_${this.ri(0, 1)}`;
    if (r < 0.22) return `pine_${this.ri(0, 1)}`;
    return `tree_green_${this.ri(0, 3)}`;
  }
  placeTrees() {
    const occupied = new Set();
    const near = (tx, ty, d) => {
      for (let y = ty - d; y <= ty + d; y++) for (let x = tx - d; x <= tx + d; x++) if (occupied.has(x * 100003 + y)) return true;
      return false;
    };
    for (let i = 0; i < 420; i++) {
      const [tx, ty] = this.spot(0);
      const k = this.idx(tx, ty);
      if (this.reserved[k] || this.solid[k]) continue;
      const t = this.tiles[k];
      if (t === T.WATER || t === T.FARM || t === T.STONE || t === T.SAND) continue;
      const z = this.zone(tx, ty), L = LOOK[z];
      const forest = fbm(tx * 0.07, ty * 0.07, this.seed + 5);
      const p = t === T.DARK ? 0.7 : forest > L.forest - 0.07 ? 0.18 : t === T.DIRT ? L.trees * 0.4 : L.trees;
      if (this.r() > p) continue;
      if (near(tx, ty, 1) || (t !== T.DARK && near(tx, ty, 2))) continue;
      occupied.add(tx * 100003 + ty);
      this.solid[k] = SOLID.WALL;
      const x = tx * TILE + 8 + this.ri(-2, 2), y = ty * TILE + 14;
      this.add({ spr: this.treeSprite(tx, ty, z), x, y, sortY: y, fade: true, tree: true });
      this.shadows.push({ x, y: y - 1, rx: 11, ry: 4 });
    }
  }

  placeDecor() {
    const L = this.look();
    const open = (tx, ty) => { const k = this.idx(tx, ty), t = this.tiles[k]; return (t === T.GRASS || t === T.DARK) && !this.solid[k]; };
    for (let i = 0; i < 300; i++) {
      const [tx, ty] = this.spot(0);
      if (!open(tx, ty)) continue;
      const name = this.tiles[this.idx(tx, ty)] === T.DARK ? 'tuft_d' : 'tuft';
      this.baked.push({ pc: PC[name], name, x: tx * TILE + this.ri(0, 11), y: ty * TILE + this.ri(0, 12) });
    }
    const flowers = ['flower_r', 'flower_w', 'flower_y', 'flower_p', 'flower_b'];
    for (let c = 0; c < L.flowers; c++) {
      const [tx, ty] = this.spot(1);
      const fl = flowers[this.ri(0, flowers.length - 1)];
      for (let i = 0, n = this.ri(3, 9); i < n; i++) {
        const x = tx + this.ri(-1, 1), y = ty + this.ri(-1, 1);
        if (!this.inb(x, y) || this.solid[this.idx(x, y)]) continue;
        const ft = this.tiles[this.idx(x, y)];
        if (ft !== T.GRASS && ft !== T.BLOSSOM) continue;
        this.baked.push({ pc: PC[fl], name: fl, x: x * TILE + this.ri(0, 11), y: y * TILE + this.ri(0, 11) });
      }
    }
    for (let i = 0; i < L.rocks; i++) {
      const [tx, ty] = this.spot(0);
      const t = this.tileAt(tx, ty);
      if (t !== T.WATER && t !== T.FARM) this.baked.push({ pc: PC.rock_s, name: 'rock_s', x: tx * TILE + this.ri(0, 4), y: ty * TILE + this.ri(0, 7) });
    }
    // bushes (walk-through), big rocks and stumps (solid)
    const z = this.zone(this.tx0 + CHUNK / 2, this.ty0 + CHUNK / 2);
    const rockShare = z === 'rock' ? 0.75 : z === 'storm' ? 0.45 : 0.25, stumpShare = z === 'fire' ? 0.4 : 0.15;
    for (let i = 0; i < 34; i++) {
      const [tx, ty] = this.spot(0);
      const k = this.idx(tx, ty);
      if (this.reserved[k] || this.solid[k] || this.tiles[k] === T.WATER || this.tiles[k] === T.FARM) continue;
      const r = this.r();
      if (r < 1 - rockShare - stumpShare) {
        if (!open(tx, ty)) continue;
        const x = tx * TILE + 8, y = ty * TILE + 13;
        this.add({ spr: `bush_${this.ri(0, 1)}`, x, y, sortY: y });
        this.reserved[k] = 1;
      } else if (r < 1 - stumpShare) { if (this.prop('rock_big', tx, ty, true)) this.shadows.push({ x: tx * TILE + 8, y: ty * TILE + 13, rx: 9, ry: 3 }); }
      else this.prop('stump', tx, ty, true);
    }
  }

  // Gathering spots (wood, stone, clay, iron): stand next to one to collect it.
  placeNodes() {
    const SPRITE = { wood: 'node_wood', stone: 'rock_big', clay: 'node_clay', iron: 'node_iron' };
    const { tx: vx, ty: vy } = this.world.center;
    for (const [kind, n] of Object.entries(this.look().nodes)) {
      for (let placed = 0, tries = 0; placed < n && tries < 40; tries++) {
        const [tx, ty] = this.spot(2);
        if (!this.free(tx, ty, 1, 1, 1) || this.tileAt(tx, ty) === T.WATER) continue;
        if (Math.hypot(tx - vx, ty - vy) < 8) continue;
        const o = this.prop(SPRITE[kind], tx, ty, false, { node: { kind, t: 0 } });
        if (o) { this.nodes.push(o); placed++; }
      }
    }
  }
}

// kept for anything that hashes tiles the old way
export { hash2 };
