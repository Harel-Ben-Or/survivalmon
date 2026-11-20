// The town hub: the Village Square map (no combat), its collision and doors, plus the Game
// methods for walking it. Buildings that aren't built yet show "opens later".
// Every building stands on its own yard (dirt, gravel, cobbles or petals) with bushes and flowers
// along its base and trees in the gaps behind it, so it sits in the land instead of on top of it.
import { Input } from '../core/input.js';
import { Audio } from '../core/audio.js';
import { SPR, PC } from '../gfx/assets.js';
import { CREATURE, creatureMotion, drawCreature, drawStarShine, drawVfx, vfxHitTime, ANIM_FPS, snap, WS, NPC_ART, drawNpcArt, dir8 } from '../gfx/art.js';
import { eggCanvas, EGG_SIZE } from '../gfx/eggs.js';
import { UNLOCK_TEXT } from '../content/buildings.js';
import { SPECIES } from '../content/species.js';
import { attackFx } from '../content/attack_fx.js';
import { Shrine } from '../systems/shrine.js';
import { TileGround } from './tileground.js';
import { T, TILE } from './world.js';
import { mulberry32, rand, dist2, TAU } from '../core/util.js';
import { Player } from '../entities/player.js';
import { Pet } from '../entities/pet.js';
import { Box } from '../systems/collection.js';
import { Meta } from '../systems/meta.js';
import { NPCS, NPC_IDS } from '../content/npcs.js';
import { buildTownRoom, TOWN_ROOM_IDS } from './interior.js';
import { gateSide, gateName } from '../content/gates.js';

const GX = 20; // the North Gate's column: the road to the wild runs north from it
const GSX = 15; // the South Gate's column
// door = the tile the building's door opens onto; yard = the ground it stands on;
// always = open from the start, the others unlock as you play
const BUILDINGS = [
  // The gates (content/gates.js), all there from the start, each with its guard (content/npcs.js). They
  // lead to the wild (Choose your team), not into a room; a guard turns you back from a gate until
  // you've beaten the Night Lord past the gate before it.
  { id: 'gate', name: 'North Gate', spr: 'town_gate', door: [GX, 7], always: true, gate: 'north', tier: 0 },
  { id: 'gate_s', name: 'South Gate', spr: 'town_gate_s', door: [GSX, 31], always: true, gate: 'south', tier: 1 },
  { id: 'gate_e', name: 'East Gate', spr: 'town_gate_e', at: [654, 292], always: true, gate: 'east', tier: 2 },
  { id: 'gate_w', name: 'West Gate', spr: 'town_gate_w', at: [18, 292], always: true, gate: 'west', tier: 3 },
  { id: 'training', name: 'Training Hall', spr: 'town_training', door: [13, 8], always: true, yard: T.DIRT },
  { id: 'workshop', name: 'Workshop', spr: 'town_workshop', door: [27, 8], yard: T.GRAVEL },
  { id: 'shrine', name: 'Spirit Shrine', spr: 'shrine', door: [6, 9], yard: T.STONE },
  { id: 'clinic', name: 'Clinic', spr: 'town_clinic', door: [7, 16], yard: T.DIRT },
  { id: 'merchant', name: 'Merchant', spr: 'town_merchant', door: [28, 14], yard: T.STONE },
  { id: 'survidex', name: 'Survidex', spr: 'town_library', door: [34, 15], yard: T.STONE },
  { id: 'hatchery', name: 'Hatchery', spr: 'town_hatchery', door: [11, 23], always: true, yard: T.DIRT },
  { id: 'ranch', name: 'Ranch', spr: 'town_ranch', door: [25, 23], always: true, yard: T.DIRT }, // the pasture is beside it
];
// Props around each building, as [sprite, dx, dy] from the middle of its base (logical px)
const DECOR = {
  training: [['town_dummy', 54, 12], ['town_dummy', 66, 22], ['barrel', -52, 6]],
  workshop: [['node_wood', 58, -2], ['barrel_open', 52, 10], ['barrel', 64, 12], ['node_iron', 76, 4]],
  shrine: [['rock_big', -38, 8], ['rock', 40, 10], ['pot', 26, 6]],
  clinic: [['pot', -22, 6], ['pot', 22, 6]],
  merchant: [['barrel', -46, 0], ['barrel_open', -37, 8], ['pot', 44, 6], ['pot_broken', 52, 2]],
  survidex: [['pot', -20, 6], ['rock', 38, 6]],
  hatchery: [['hay', -58, 2]],
  ranch: [['hay', -50, 3]],
};
const FLOWERS = ['flower_r', 'flower_w', 'flower_y', 'flower_p', 'flower_b'];
const RANCH_MAX = 16; // survivalmons shown roaming the pasture
// where each gate's guard stands, from the gate's door: beside the way in, on the town side
// Each gate's guard stands in the middle of the gate, a step toward town, so starting a run always
// means talking to them (the gates themselves have no door prompt). How far in from the gate's middle,
// and which way they face.
const GUARD_STEP = { north: 14, south: 16, east: 24, west: 24 };
const GUARD_FACE = { north: 'south', south: 'south', east: 'west', west: 'east' };
// where you come back from a run: this far in from the gate's middle (clear of the South Gate's arch)
const SPAWN_STEP = { north: 46, south: 88, east: 46, west: 46 };
const SPOTS_MAX = 6;  // training dummies the Ranch can hold
// How far from its dummy each kind of attacker stands
const STAND = { shooter: 32, zapper: 34, lobber: 34, slam: 20, aura: 14, support: 14, roller: 30 };

export class Town {
  constructor() {
    this.w = 42; this.h = 34;
    this.pw = this.w * TILE; this.ph = this.h * TILE;
    this.tiles = new Uint8Array(this.w * this.h);
    this.baked = []; this.bakedTall = []; this.shadows = [];
    this.objects = []; this.solids = []; this.doors = []; this.ranch = []; this.dummies = []; this.trainees = [];
    this.rng = mulberry32(11);
    this.noiseGrid = Array.from({ length: 64 * 64 }, () => this.rng());
    this.build();
  }
  r() { return this.rng(); }
  pick(list) { return list[Math.floor(this.r() * list.length)]; }
  tileAt(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.tiles[y * this.w + x] : T.DARK; }
  set(x, y, t) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.tiles[y * this.w + x] = t; }
  rect(t, x0, y0, x1, y1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, t); }
  disc(t, cx, cy, r) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if (Math.hypot(x - cx, y - cy) <= r) this.set(x, y, t);
  }
  // A winding path through the given tile points; half-tile points give a 2-tile-wide path
  road(t, pts, r = 0.75) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay) * 3);
      for (let k = 0; k <= n; k++) this.disc(t, ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n, r);
    }
  }
  // Smooth value noise in 0..1, about 4 tiles per bump
  noise(x, y) {
    const fx = x / 4, fy = y / 4, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const v = (a, b) => this.noiseGrid[(b & 63) * 64 + (a & 63)];
    const s = (t) => t * t * (3 - 2 * t), u = s(tx), w = s(ty);
    return (v(ix, iy) * (1 - u) + v(ix + 1, iy) * u) * (1 - w) + (v(ix, iy + 1) * (1 - u) + v(ix + 1, iy + 1) * u) * w;
  }
  solid(x, y, w, h) { this.solids.push({ x, y, w, h }); }
  // A prop standing on (x, y) with a small footprint at its base
  prop(spr, x, y, fw = 10, fh = 5, fade = false) {
    if (!SPR[spr]) return;
    this.objects.push({ spr, x, y, sortY: y, fade });
    if (fw) this.solid(x - fw / 2, y - fh, fw, fh);
  }
  tree(spr, x, y) { this.prop(spr, x, y, 6, 3, true); this.shadows.push({ x, y: y - 1, rx: 13, ry: 5 }); } // only the trunk blocks
  decal(name, x, y) { this.baked.push({ name, pc: PC[name], x: Math.round(x), y: Math.round(y) }); }

  building(b) {
    const s = SPR[b.spr], [x, y] = b.at || [b.door[0] * TILE + 8, b.door[1] * TILE + 4];
    this.objects.push({ spr: b.spr, img: grounded(s), x, y, sortY: y, fade: true });
    // a soft shadow round the base, darkest right where the walls meet the ground
    this.shadows.push({ x, y: y - 2, rx: s.w * 0.52, ry: 8, a: 0.7 });
    this.shadows.push({ x, y: y - 1, rx: s.w * 0.46, ry: 3, a: 1.1 });
    if (b.gate === 'north' || b.gate === 'south') {
      // only the two posts block; past the arch the road runs into the forest
      this.solid(x - s.w / 2 + 2, y - 12, 18, 10);
      this.solid(x + s.w / 2 - 20, y - 12, 18, 10);
      if (b.gate === 'north') this.solid(x - s.w / 2, 0, s.w, y - 30);
      this.doors.push({ ...b, x, y: y - 16, py: y - s.h + 6, mid: [x, y], toTown: [0, b.gate === 'north' ? 1 : -1], baseY: y });
      return;
    }
    if (b.gate) {
      // east and west: seen side-on, flush on the town's edge: two posts one behind the other (the far
      // one up the screen), the beam between them; the way through is between their feet
      const m = b.gate === 'east' ? 1 : -1;
      this.solid(x + m * 1 - 8, y - 9, 16, 8);
      this.solid(x + m * 4 - 8, y - 59, 16, 8);
      this.doors.push({ ...b, x: x + m * 2.5, y: y - 30, py: y - s.h + 4, mid: [x + m * 2.5, y - 30], toTown: [-m, 0], baseY: y });
      return;
    }
    // walls: the lower half of the sprite, a little in from its corners (eaves and bushes don't snag
    // you); the roof above it can hide the hero walking behind
    this.solid(x - s.w * 0.38, y - s.h * 0.5, s.w * 0.76, s.h * 0.5 - 5);
    this.doors.push({ ...b, x, y: y + 4, py: y - 30 });
    this.skirt(b, x, y, s);
  }
  // Ground the building: its yard under it, bushes on its front corners, flowers and tufts along
  // its base (clear of the door) and its own props round it.
  skirt(b, x, y, s) {
    const hw = s.w / 2, [tx, ty] = b.door, th = Math.floor(hw / TILE);
    if (b.yard !== undefined) { this.rect(b.yard, tx - th, ty - 2, tx + th, ty); this.rect(b.yard, tx - 1, ty + 1, tx + 1, ty + 1); }
    for (const side of [-1, 1]) {
      const bx = x + side * (hw - 6 - this.r() * 4);
      this.prop(this.r() < 0.5 ? 'bush_0' : 'bush_1', bx, y + 3, 0);
      this.shadows.push({ x: bx, y: y + 2, rx: 8, ry: 3 });
    }
    for (let px = x - hw + 4; px < x + hw - 4; px += 4 + this.r() * 6) {
      if (Math.abs(px - x) < 18) continue;
      this.decal(this.r() < 0.55 ? this.pick(FLOWERS) : this.pick(['tuft', 'tuft', 'tuft_d']), px - 3, y - 2 + this.r() * 5);
    }
    for (const [spr, dx, dy] of DECOR[b.id] || []) {
      this.prop(spr, x + dx, y + dy, 0); // barrels, hay, dummies by the doors: you walk past them, never stuck
      this.shadows.push({ x: x + dx, y: y + dy - 1, rx: Math.max(5, (SPR[spr]?.w || 10) * 0.4), ry: 2.5 });
    }
  }
  fenceRect(x0, y0, x1, y1, gaps = []) {
    const gap = (x, y) => gaps.some(([gx, gy]) => gx === x && gy === y);
    for (let x = x0; x <= x1; x++) for (const y of [y0, y1]) {
      if (gap(x, y)) continue;
      this.objects.push({ spr: 'fence_h', x: x * TILE + 8, y: y * TILE + 13, sortY: y * TILE + 13 });
      this.solid(x * TILE, y * TILE + 8, TILE, 6);
    }
    for (let y = y0 + 1; y < y1; y++) for (const x of [x0, x1]) {
      if (gap(x, y)) continue;
      this.objects.push({ spr: 'fence_v', x: x * TILE + 8, y: y * TILE + 16, sortY: y * TILE + 16 });
      this.solid(x * TILE + 5, y * TILE, 6, TILE);
    }
  }
  // Thick forest on every edge (the gap at the gate is left open). Its shade spills into the town
  // in ragged patches, so the woods fade into the grass instead of ending in a straight line.
  forest() {
    const kinds = ['tree_dark_0', 'tree_dark_1', 'tree_green_0', 'tree_green_1', 'pine_0', 'pine_1', 'tree_dark_2'];
    const gaps = { n: [GX - 3, GX + 2], s: [GSX - 3, GSX + 2], e: [9, 20], w: [9, 20] };
    const gateGap = (side, t) => !!gaps[side] && t >= gaps[side][0] && t <= gaps[side][1];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const e = Math.min(x, y, this.w - 1 - x, this.h - 1 - y);
      const side = y <= 1 ? 'n' : y >= this.h - 2 ? 's' : x <= 1 ? 'w' : 'e';
      if (e <= 1 && !gateGap(side, side === 'n' || side === 's' ? x : y)) this.set(x, y, T.DARK);
      else if (e <= 3 && this.noise(x, y) > (e === 2 ? 0.42 : 0.66)) this.set(x, y, T.DARK);
    }
    for (let y = -1; y <= this.h + 1; y += 1.15) for (let x = -1; x <= this.w + 1; x += 1.4) {
      const e = Math.min(x, y, this.w - 1 - x, this.h - 1 - y);
      if (e > 1.2) continue;
      const side = y <= 1.2 ? 'n' : y >= this.h - 2.2 ? 's' : x <= 1.2 ? 'w' : 'e';
      const t = Math.round(side === 'n' || side === 's' ? x : y);
      if (gateGap(side, t) || gateGap(side, t - 1) || gateGap(side, t + 1)) continue;
      const jx = (x + (this.r() - 0.5) * 0.6) * TILE + 8, jy = (y + (this.r() - 0.5) * 0.4) * TILE + 14;
      this.objects.push({ spr: this.pick(kinds), x: jx, y: jy, sortY: jy });
    }
    const band = 2 * TILE + 6;
    this.solid(0, 0, (GX - 3) * TILE, band); this.solid((GX + 3) * TILE, 0, this.pw - (GX + 3) * TILE, band);
    this.solid(0, 0, band, this.ph); this.solid(this.pw - band, 0, band, this.ph);
    this.solid(0, this.ph - band - 4, this.pw, band + 4);
  }
  flowers(n, x0, y0, x1, y1) {
    const names = [...FLOWERS, 'tuft', 'tuft', 'tuft', 'tuft_d', 'tuft_d'];
    for (let i = 0; i < n; i++) {
      const tx = x0 + Math.floor(this.r() * (x1 - x0 + 1)), ty = y0 + Math.floor(this.r() * (y1 - y0 + 1));
      const t = this.tileAt(tx, ty);
      if (t !== T.GRASS && t !== T.BLOSSOM && t !== T.DARK) continue;
      this.decal(this.pick(names), tx * TILE + Math.floor(this.r() * 10), ty * TILE + Math.floor(this.r() * 10));
    }
  }

  build() {
    const at = (tx, ty, dy = 14) => [tx * TILE + 8, ty * TILE + dy];
    this.forest();
    // the roads: north out of the gate, round the square, and a path to every door
    this.road(T.DIRT, [[GX, 0], [GX, 9]], 1);
    this.road(T.DIRT, [[16.5, 10.5], [14.5, 9.5], [13, 9]]);                      // Training Hall
    this.road(T.DIRT, [[13, 10.5], [9.5, 10.5], [6.5, 10]]);                       // on to the Spirit Shrine
    this.road(T.DIRT, [[23.5, 10.5], [25.5, 9.5], [27, 9]]);                       // Workshop
    this.road(T.DIRT, [[16.5, 15.5], [12.5, 16.5], [7.5, 17]]);                    // Clinic
    this.road(T.DIRT, [[24, 15.5], [30, 16.5], [34, 16]]);                         // Survidex
    this.road(T.DIRT, [[GX + 0.5, 17], [GX, 20.5], [17, 22], [14, 23.5], [11, 24]]); // Hatchery
    this.road(T.DIRT, [[22.5, 17.5], [22.5, 21.5], [24.5, 24]]);                  // Ranch
    this.road(T.DIRT, [[16.5, 22.6], [15.5, 26], [GSX, 30]]);                      // South Gate
    this.road(T.DIRT, [[34, 16], [37, 16.4], [40.6, 16.4]]);                        // on past the Survidex to the East Gate
    this.road(T.DIRT, [[7.5, 17], [4.5, 16.4], [1.2, 16.4]]);                        // West Gate
    this.disc(T.STONE, GX, 13, 4.2);                                                // the square
    this.rect(T.STONE, 25, 14, 30, 15);                                             // the market stall's paving
    // a pond in the south with lily pads on it
    this.disc(T.WATER, 20.5, 25, 1.7);
    for (const [x, y] of [[19.5, 24.3], [21.2, 25.1], [20.1, 25.8]]) this.decal(this.pick(['lily_0', 'lily_1', 'lily_2']), x * TILE, y * TILE);
    // the water only (two boxes round the oval, so you can walk past its grassy corners)
    this.solid(19 * TILE + 2, 24.4 * TILE, 4 * TILE - 4, 1.6 * TILE); this.solid(19.6 * TILE + 2, 23.6 * TILE + 4, 2.8 * TILE - 4, 3 * TILE - 4);
    for (const b of BUILDINGS) {
      if (SPR[b.spr]) this.building(b);
      else if (b.door) this.doors.push({ ...b, x: b.door[0] * TILE + 8, y: b.door[1] * TILE + 8, py: b.door[1] * TILE - 26 }); // art missing: the door still works
    }
    // the square: the well in the middle and a lamp at each corner
    const [wx, wy] = at(GX, 13); this.prop('well', wx, wy, 22, 7);
    this.shadows.push({ x: wx, y: wy - 2, rx: 16, ry: 5 });
    for (const [x, y] of [[16, 9.6], [24.6, 9.6], [15.6, 17], [21.4, 19.6]]) { const [px, py] = at(x, y); this.prop('lamp', px, py, 0); }
    // Ranch: the pasture beside the Ranch house, where every survivalmon you own roams, with the
    // training dummies in it (you go in through the house)
    this.fenceRect(27, 18, 38, 26); // its west side runs into the house's wall
    this.pasture = { x0: 28 * TILE + 4, y0: 19 * TILE + 8, x1: 38 * TILE - 4, y1: 26 * TILE + 2 };
    for (const [x, y] of [[28.8, 25.6], [29.9, 25.8]]) this.prop('hay', x * TILE, y * TILE, 0);
    this.nests = [[15.4, 23.3], [16.6, 23.7], [17.8, 23.3]].map(([x, y]) => ({ x: x * TILE, y: y * TILE }));
    // trees in the gaps behind the buildings, and a few in the open
    for (const [s, x, y] of [
      ['tree_green_0', 9.6, 6.6], ['tree_dark_0', 16.9, 6.1], ['tree_green_1', 24.1, 6.1], ['tree_autumn_0', 31.6, 5.6],
      ['tree_green_0', 31.6, 11.4], ['pine_0', 3.4, 14.6], ['tree_pink_1', 3.6, 21.4], ['tree_dark_1', 37.4, 12.6],
      ['tree_pink_0', 24.4, 28.6], ['tree_autumn_0', 6.2, 12.2], ['tree_green_0', 7.4, 27.4], ['pine_1', 36.4, 4.8], ['tree_green_1', 37.6, 9.4],
      ['tree_dark_0', 10.6, 30.2], ['tree_green_1', 20.2, 30.6], ['pine_0', 31.4, 29.8], ['tree_autumn_0', 37.2, 29.2], ['tree_green_0', 28.2, 31.2],
    ]) this.tree(s, x * TILE, y * TILE);
    for (const [s, x, y] of [['bush_1', 21.3, 23.2], ['bush_0', 19, 23.4], ['stump', 14.6, 19.6], ['rock_big', 35.4, 12.4], ['bush_1', 9.2, 20.6], ['rock', 17.6, 19],
      ['bush_0', 22.6, 29.4], ['rock', 33.6, 30.4], ['stump', 4.8, 29.6]]) {
      this.prop(s, x * TILE, y * TILE, 0); this.shadows.push({ x: x * TILE, y: y * TILE - 1, rx: 7, ry: 2.5 }); // walk-through
    }
    this.flowers(150, 2, 2, this.w - 3, this.h - 3);
    // a flower meadow round the Hatchery
    for (let i = 0; i < 26; i++) {
      const a = this.r() * TAU, d = 52 + this.r() * 26, x = 11 * TILE + 8 + Math.cos(a) * d, y = 22 * TILE + Math.sin(a) * d * 0.6;
      const t = this.tileAt(Math.floor(x / TILE), Math.floor(y / TILE));
      if (t === T.GRASS || t === T.DARK) this.decal(this.pick(['flower_p', 'flower_w', 'flower_p', 'flower_y', 'flower_b']), x, y);
    }
    this.spawn = { x: GX * TILE + 8, y: 18.5 * TILE };
    this.gateSpawn = { x: GX * TILE + 8, y: 9 * TILE + 4 };
    // where you come back from a run through each gate
    this.gateSpawns = {};
    for (const d of this.doors) if (d.gate) this.gateSpawns[d.gate] = { x: d.mid[0] + d.toTown[0] * SPAWN_STEP[d.gate], y: d.mid[1] + d.toTown[1] * SPAWN_STEP[d.gate] };
    this.gateSpawn = this.gateSpawns.north || this.gateSpawn;
  }

  // ---------------------------------------------------------------- the villagers
  // Open ground the villagers wander between: clear of buildings, the pond, the pasture and the forest
  walkSpots() {
    if (this.spots) return this.spots;
    const spots = [], P = this.pasture;
    for (let ty = 7; ty < this.h - 3; ty++) for (let tx = 3; tx < this.w - 3; tx++) {
      const x = tx * TILE + 8, y = ty * TILE + 8, t = this.tileAt(tx, ty);
      if (t === T.DARK || t === T.WATER) continue;
      if (P && x > P.x0 - 12 && x < P.x1 + 12 && y > P.y0 - 12 && y < P.y1 + 12) continue;
      if (this.clearAt(x, y, 9)) spots.push({ x, y });
    }
    return (this.spots = spots);
  }
  // Is (x, y) hidden behind a building or tree, inside its picture above its base? (the renderer fades
  // one when the hero or the team is there; a survivalmon picking where to stand avoids these spots)
  hides(x, y) {
    for (const o of this.objects) {
      if (!o.fade || y >= o.sortY - 1) continue;
      const s = SPR[o.spr];
      if (s && y > o.y - s.ay + 6 && x > o.x - s.ax + 3 && x < o.x - s.ax + s.w - 3) return true;
    }
    return false;
  }
  clearAt(x, y, r = 6) {
    const x0 = x - r, x1 = x + r, y0 = y - 4, y1 = y + 2;
    return !this.solids.some((s) => x0 < s.x + s.w && x1 > s.x && y0 < s.y + s.h && y1 > s.y);
  }
  // Nothing in the way walking straight from a to b?
  clearLine(ax, ay, bx, by) {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 6);
    for (let i = 1; i <= n; i++) if (!this.clearAt(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n)) return false;
    return true;
  }
  // The wanderers, the guard by the gate and the Merchant at the stall (once it has opened)
  makeVillagers(merchantOpen) {
    const spots = this.walkSpots(), rng = mulberry32(77);
    this.solids = this.solids.filter((s) => !s.npc);
    this.npcs = [];
    NPC_IDS.filter((id) => NPCS[id].home === 'roam').forEach((id, i) => {
      const s = spots[Math.floor(rng() * spots.length)];
      this.npcs.push({ id, x: s.x, y: s.y, tx: s.x, ty: s.y, dir: 'south', moving: false, wait: 0.5 + rng() * 3, seed: i * 1.7 });
    });
    const stand = (id, x, y, dir = 'south', sortY) => {
      this.npcs.push({ id, x, y, dir, still: true, seed: x * 0.13, sortY, face: dir });
      this.solids.push({ x: x - 6, y: y - 5, w: 12, h: 7, npc: true });
    };
    const stall = this.doors.find((d) => d.id === 'merchant');
    for (const id of NPC_IDS.filter((i) => NPCS[i].gate)) {
      const side = NPCS[id].gate, d = this.doors.find((x) => x.gate === side), k = GUARD_STEP[side];
      if (d?.mid) stand(id, d.mid[0] + d.toTown[0] * k, d.mid[1] + d.toTown[1] * k, GUARD_FACE[side], side === 'south' ? d.baseY + 1 : undefined);
    }
    if (stall && merchantOpen) stand('mags', stall.x - 30, stall.y + 4);
  }
  updateVillagers(dt, P) {
    for (const n of this.npcs || []) {
      if (n.scene) continue; // in a story scene: it moves them
      if (n.still || n.talking) { n.moving = false; if (n.face && !n.talking) n.dir = n.face; continue; } // a guard turns back to their post
      const near = Math.hypot(P.x - n.x, P.y - n.y) < 20;
      if (n.wait > 0 || near) {
        n.wait -= dt; n.moving = false;
        if (n.wait <= 0 && !near) this.pickWalk(n);
        continue;
      }
      const dx = n.tx - n.x, dy = n.ty - n.y, d = Math.hypot(dx, dy);
      if (d < 1.5) { n.moving = false; n.wait = 1.5 + Math.random() * 4; continue; }
      const step = Math.min(20 * dt, d), nx = n.x + (dx / d) * step, ny = n.y + (dy / d) * step;
      if (!this.clearAt(nx, ny)) { n.tx = n.x; n.ty = n.y; n.wait = 0.6; continue; }
      n.x = nx; n.y = ny; n.moving = true;
      n.dir = Math.abs(dx) > Math.abs(dy) * 1.2 ? (dx > 0 ? 'east' : 'west') : dy > 0 ? 'south' : 'north';
    }
  }
  // Somewhere new to walk to, 30 to 150 px away, in a straight clear line
  pickWalk(n) {
    const spots = this.walkSpots();
    for (let i = 0; i < 24; i++) {
      const s = spots[Math.floor(Math.random() * spots.length)], d = Math.hypot(s.x - n.x, s.y - n.y);
      if (d < 30 || d > 150 || !this.clearLine(n.x, n.y, s.x, s.y)) continue;
      n.tx = s.x; n.ty = s.y;
      return;
    }
    n.wait = 1;
  }

  // ---------------------------------------------------------------- the Ranch
  // Where training spot i is: two dummies back to back on each row, with their trainees facing
  // them from either side (face: which way the trainee looks)
  dummyAt(i) {
    const col = i % 2, row = i >> 1;
    return { x: col ? 548 : 508, y: 20.2 * TILE + row * 28, face: col ? -1 : 1, hitT: 0 };
  }
  // Survivalmons that aren't in the team live at the Ranch: those in training hit a dummy each,
  // the rest wander the pasture. Returns true when the ground under the dummies changed.
  fillRanch(mons) {
    const spots = Math.min(SPOTS_MAX, Box.trainSpots());
    const dirt = spots !== this.yardSpots;
    if (dirt) {
      // a patch of worn dirt under each dummy and its trainee
      this.yardSpots = spots;
      for (let i = 0; i < SPOTS_MAX; i++) {
        const d = this.dummyAt(i), tx = Math.floor(d.x / TILE), ty = Math.floor(d.y / TILE);
        this.rect(i < spots ? T.DIRT : T.GRASS, d.face > 0 ? tx - 2 : tx, ty, d.face > 0 ? tx : tx + 2, ty);
      }
    }
    this.dummies = Array.from({ length: spots }, (_, i) => this.dummyAt(i));
    const training = mons.filter((m) => Box.isTraining(m.id)).slice(0, spots);
    this.trainees = training.map((m, i) => trainee(m, this.dummies[i]));
    // each roaming survivalmon keeps to one stretch of free grass, so it never walks through the dummies
    const free = this.freeGround(), area = (r) => (r.x1 - r.x0) * (r.y1 - r.y0), total = free.reduce((n, r) => n + area(r), 0);
    const home = () => { let k = Math.random() * total; for (const r of free) if ((k -= area(r)) <= 0) return r; return free[0]; };
    this.ranch = mons.filter((m) => !training.includes(m)).slice(0, RANCH_MAX).map((m) => {
      const r = home(), spot = () => [rand(r.x0, r.x1), rand(r.y0, r.y1)];
      const [x, y] = spot(), [tx, ty] = spot();
      return { species: m.species, stars: m.stars || 0, x, y, tx, ty, spot, wait: rand(0, 3), left: Math.random() < 0.5, seed: rand(0, 10), moving: false };
    });
    return dirt;
  }
  // The pasture's grass round the training dummies, as rectangles: below them, west and east of them
  freeGround() {
    const R = this.pasture;
    if (!this.dummies.length) return [R];
    const xs = this.dummies.map((d) => d.x), ys = this.dummies.map((d) => d.y);
    const Y = { x0: Math.min(...xs) - 58, x1: Math.max(...xs) + 58, y1: Math.max(...ys) + 22 };
    const out = [{ x0: R.x0, y0: Y.y1, x1: R.x1, y1: R.y1 }, { x0: R.x0, y0: R.y0, x1: Y.x0, y1: R.y1 }, { x0: Y.x1, y0: R.y0, x1: R.x1, y1: R.y1 }]
      .filter((r) => r.x1 - r.x0 >= 14 && r.y1 - r.y0 >= 14);
    return out.length ? out : [R];
  }
  updateRanch(dt, g) {
    for (const m of this.ranch) {
      if (m.wait > 0) { m.wait -= dt; m.moving = false; continue; }
      const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy);
      if (d < 2) { m.wait = rand(1.5, 5); [m.tx, m.ty] = m.spot(); m.moving = false; continue; }
      m.x += (dx / d) * 18 * dt; m.y += (dy / d) * 18 * dt;
      m.moving = true;
      if (Math.abs(dx) > 1) m.left = dx < 0;
    }
    for (const d of this.dummies) d.hitT = Math.max(0, d.hitT - dt);
    for (const t of this.trainees) trainStep(t, dt, g);
  }
}

// ---------------------------------------------------------------- training at the dummies
// A survivalmon in training stands by its dummy and hits it with its own attack, over and over.
function trainee(mon, d) {
  const skill = mon.skills.find((s) => s.k === 'u' && SPECIES[s.sp]);
  const sp = SPECIES[skill?.sp] || SPECIES[mon.species], arch = sp.arch || 'shooter';
  return {
    mon, species: mon.species, arch, fx: attackFx(sp.id || skill?.sp || mon.species), q: sp.q || {}, d,
    x: d.x - d.face * (STAND[arch] || 36), y: d.y + 1, cd: rand(0.4, 1.6), n: 0, seed: rand(0, 10),
    atkT: -1, shot: null, dash: 0,
  };
}
function hitDummy(t, g) {
  const d = t.d;
  d.hitT = 0.4;
  g.particles.burst(d.x, d.y - 14, { n: 7, colors: [t.fx.color || '#ffffff', '#ffffff'], speed: 45, life: 0.35, up: 10 });
}
function trainStep(t, dt, g) {
  const d = t.d, fx = t.fx;
  if (t.atkT >= 0) { t.atkT += dt; if (t.atkT * ANIM_FPS.attack >= 8) t.atkT = -1; }
  if (t.hop > 0) t.hop = Math.max(0, t.hop - dt);
  if (t.shot) {
    t.shot.t += dt;
    if (t.shot.t >= t.shot.dur) {
      if (t.shot.zone) g.playFx(t.shot.zone, d.x, d.y, { life: 0.7 });
      t.shot = null; hitDummy(t, g);
    }
  }
  if (t.dash > 0) {
    const was = t.dash;
    t.dash = Math.max(0, t.dash - dt);
    if (was > 0.4 && t.dash <= 0.4) hitDummy(t, g); // the charge reaches the dummy
  }
  t.cd -= dt;
  if (t.cd > 0) return;
  t.cd = rand(1.7, 2.6); t.n++;
  if (CREATURE[t.species]?.anim?.attack) t.atkT = 0;
  const f = d.face, mx = t.x + 6 * f, my = t.y - 6;
  // an evolution shows off its signature move now and then
  if (fx.sig && t.n % 3 === 0) {
    g.playFx(fx.sig, d.x, d.y, { scale: 0.7 });
    g.after(vfxHitTime(fx.sig), () => hitDummy(t, g));
    return;
  }
  switch (t.arch) {
    case 'shooter':
      t.shot = { t: 0, dur: Math.abs(d.x - mx) / Math.max(120, t.q.speed || 150), proj: fx.proj, spr: t.q.proj, scale: fx.scale };
      break;
    case 'zapper':
      g.zap([[mx, my + 4], [d.x, d.y - 4]], 0.22, fx.bolt);
      if (fx.hit) g.playFx(fx.hit, d.x, d.y - 12);
      hitDummy(t, g);
      break;
    case 'lobber':
      t.shot = { t: 0, dur: 0.5, arc: 18, glob: fx.glob, zone: fx.zone, color: fx.color };
      break;
    case 'slam':
      if (fx.slam) g.playFx(fx.slam, d.x - 6 * f, d.y, { scale: 0.8 });
      else g.addEffect({ type: 'ring', x: d.x - 6 * f, y: d.y, R: 16, life: 0.35, color: fx.color || '#ffffff' });
      t.hop = 0.25;
      hitDummy(t, g);
      break;
    case 'aura':
    case 'support':
      g.addEffect({ type: 'ring', x: t.x, y: t.y, R: STAND.aura + 8, life: 0.45, color: fx.color || '#ffffff' });
      hitDummy(t, g);
      break;
    case 'roller':
      t.dash = CREATURE[t.species]?.anim?.ball ? 0.75 : 0.6; // one that curls up first takes a moment more
      break;
  }
}
// Where a trainee stands right now (a charger rushes at its dummy and back)
function traineePos(t) {
  if (t.dash > 0) {
    const reach = t.d.x - 10 * t.d.face - t.x, k = t.dash > 0.6 ? 0 : t.dash > 0.4 ? 1 - (t.dash - 0.4) / 0.2 : t.dash / 0.4;
    return [t.x + reach * k, t.y];
  }
  return [t.x, t.y];
}
function drawTrainee(ctx, t, cam, now) {
  const a = CREATURE[t.species];
  if (!a) return;
  const [px, py] = traineePos(t), x = snap(px) - cam.x, y = snap(py) - cam.y;
  ctx.globalAlpha = 0.28; ctx.fillStyle = '#1a2a10';
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(5, a.cw * 0.34), Math.max(2, a.cw * 0.12), 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  const o = { left: t.d.face < 0, ...creatureMotion(a.motion, now, t.dash > 0, t.seed, !!a.anim), at: now + t.seed };
  if (t.atkT >= 0 && a.anim?.attack) { o.anim = 'attack'; o.frame = Math.floor(t.atkT * ANIM_FPS.attack); }
  else o.anim = a.motion === 'fly' || t.dash > 0 ? 'move' : 'idle';
  if (t.hop > 0) o.bob = (o.bob || 0) + Math.sin((t.hop / 0.25) * Math.PI) * 5;
  if (t.dash > 0 && a.anim?.ball) {
    // a roller tucks into a ball, rolls at the dummy and back, and unrolls
    const n = a.anim.curl.length, nb = a.anim.ball.length;
    if (t.dash > 0.6) { o.anim = 'curl'; o.frame = Math.floor(((0.75 - t.dash) / 0.15) * n); }
    else if (t.dash < 0.12) { o.anim = 'curl'; o.frame = Math.floor((t.dash / 0.12) * n); }
    else {
      const turn = ((px - t.x) * t.d.face) / Math.max(4, a.ch / 2), i = Math.floor(turn / (TAU / nb));
      o.anim = 'ball'; o.frame = ((i % nb) + nb) % nb; o.bob = Math.abs(Math.sin(turn * 0.5)) * 1.5;
    }
  }
  drawCreature(ctx, a, x, y, o);
}
// The shot (or lobbed blob) on its way to the dummy
function drawShot(ctx, t, cam, now) {
  const s = t.shot;
  if (!s) return;
  const k = Math.min(1, s.t / s.dur), x0 = t.x + 6 * t.d.face, y0 = t.y - 8, x1 = t.d.x - 2 * t.d.face, y1 = t.d.y - 14;
  const x = x0 + (x1 - x0) * k - cam.x, y = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * (s.arc || 0) - cam.y;
  if (s.proj) drawVfx(ctx, s.proj, now, x, y, { scale: s.scale, rot: t.d.face < 0 ? Math.PI : 0 });
  else if (s.glob) drawVfx(ctx, s.glob, now, x, y);
  else if (s.spr && SPR[s.spr]) { const p = SPR[s.spr]; ctx.drawImage(p.frames[0], snap(x - p.ax), snap(y - p.ay), p.w, p.h); }
  else { ctx.fillStyle = s.color || t.fx.color || '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, TAU); ctx.fill(); }
}
function drawDummy(ctx, d, cam) {
  const s = SPR.town_dummy;
  if (!s) return;
  const x = snap(d.x - cam.x), y = snap(d.y - cam.y);
  ctx.globalAlpha = 0.25; ctx.fillStyle = '#1a2a10';
  ctx.beginPath(); ctx.ellipse(x, y - 1, 7, 2.5, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  // a hit rocks it on its post
  const tilt = d.hitT > 0 ? Math.sin(d.hitT * 34) * 0.22 * (d.hitT / 0.4) : 0;
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
  ctx.drawImage(s.frames[0], -s.ax, -s.ay, s.w, s.h);
  ctx.restore();
}

// A building drawn a little darker towards its base, as if the ground and grass round it shade it
const groundedCache = new Map();
function grounded(s) {
  const src = s.frames[0];
  if (groundedCache.has(src)) return groundedCache.get(src);
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  const grad = g.createLinearGradient(0, c.height * 0.72, 0, c.height);
  grad.addColorStop(0, 'rgba(26,40,18,0)');
  grad.addColorStop(1, 'rgba(26,40,18,0.32)');
  g.fillStyle = grad; g.fillRect(0, 0, c.width, c.height);
  groundedCache.set(src, c);
  return c;
}

// ---------------------------------------------------------------- Game methods for town mode
export const TownMode = {
  toTown(fromRun = false) {
    if (!this.town) {
      this.town = new Town();
      const tg = this.tileGround;
      this.townGround = tg ? new TileGround(tg.cfg, tg.sheets, tg.grass) : null;
    }
    // the ground tiles failed to load at start (a bad connection): try again, and lay them when they come
    if (!this.townGround && !this.groundRetry) {
      this.groundRetry = TileGround.load().then((tg) => {
        this.groundRetry = null;
        if (!tg) return;
        this.tileGround ||= tg;
        if (this.tileGround === tg) tg.attach(this.world);
        this.townGround = new TileGround(tg.cfg, tg.sheets, tg.grass);
        this.townGround.attach(this.town);
      });
    }
    this.resetRunState();
    if (this.scene) this.endScene(true); // nothing from the run's scene comes along into town
    this.mode = 'town'; this.modal = null; this.boss = null;
    const P = this.player = new Player(this, Meta.hero);
    const at = fromRun ? this.town.gateSpawns[gateSide(this.tier || 0)] || this.town.gateSpawn : this.town.spawn;
    P.x = at.x; P.y = at.y; P.dir = 'down'; P.faceAngle = Math.PI / 2;
    for (const mon of Box.team()) P.pets.push(new Pet(this, mon));
    P.pets.forEach((pet, i) => { pet.x = P.x + (i % 2 ? -1 : 1) * 18 * (1 + (i >> 1)); pet.y = P.y + 6; });
    this.townRoom = null; this.room = null;
    this.town.makeVillagers(Meta.isUnlocked('merchant'));
    this.fillTownRanch();
    this.townGround?.attach(this.town);
    this.snapCamera();
    this.ui.showTown();
    this.townArrival();
  },
  // The Ranch shows every survivalmon that isn't walking with you; redraws the ground when the
  // number of training dummies changed.
  fillTownRanch() {
    const resting = Box.mons.filter((m) => !Box.inTeam(m.id));
    this.ranchKey = ranchKey(resting);
    if (this.town.fillRanch(resting)) this.townGround?.attach(this.town);
  },
  // Bring the survivalmons walking with you in line with the box, every time the town view comes
  // back: healed at the Clinic, trained, evolved or swapped in the team, they show it right away.
  syncTownPets() {
    const P = this.player;
    if (this.mode !== 'town' || !P) return;
    const old = new Map(P.pets.map((p) => [p.mon, p]));
    const pets = Box.team().map((mon) => {
      let pet = old.get(mon);
      if (!pet) { pet = new Pet(this, mon); pet.x = P.x; pet.y = P.y + 8; return pet; }
      pet.refresh();
      const hp = pet.maxHp * (mon.hp ?? 1);
      if (hp > 0 && pet.fainted) {
        pet.fainted = false; pet.faintT = 0; pet.state = 'follow';
        this.particles.burst(pet.x, pet.y - 8, { n: 14, colors: ['#9af08a', '#ffffff'], speed: 50, life: 0.5, up: 20 });
      } else if (hp <= 0 && !pet.fainted) { pet.fainted = true; pet.faintT = 99; pet.atkT = -1; }
      pet.hp = hp;
      return pet;
    });
    P.pets.length = 0; P.pets.push(...pets);
    const resting = Box.mons.filter((m) => !Box.inTeam(m.id));
    if (ranchKey(resting) !== this.ranchKey) this.fillTownRanch();
  },
  // "Run again" from the end screen: hatches, unlocks and research are checked first.
  runAgain() {
    const hatching = Box.eggs.some((e) => e.progress >= e.need);
    this.toTown(true);
    if (!hatching) this.startRun(Meta.hero);
  },
  // News waiting in town: eggs that hatched, buildings that opened, research that finished.
  townArrival() {
    const notes = [];
    if (this.unlockNote) { notes.push(this.unlockNote); this.unlockNote = null; }
    if (Box.migratedCoins) { notes.push(`Monsters can't be kept any more: your old monster catches became ${Box.migratedCoins} coins.`); Box.migratedCoins = 0; }
    const lv = Shrine.settle();
    if (lv) notes.push(`Spirit Shrine research finished: better skill tiers (level ${lv}).`);
    const hatched = Box.hatchReady();
    if (hatched.length && Meta.unlock('merchant')) notes.push('The Merchant opened a stall by the square.');
    if (Box.mons.length >= 3 && Meta.unlock('shrine')) notes.push('The Spirit Shrine is open: upgrades for every survivalmon.');
    // new heroes
    // your friends: one is found past each gate, the first time you win at its Lv 1 (old saves keep theirs)
    const found = [];
    for (const [h, tier] of [['rowanf', 0], ['bram', 1], ['lyra', 2], ['pip', 3]]) if (Meta.gates > tier && Meta.unlockHero(h)) found.push(h);
    const opened = Meta.data.gateNew;
    if (opened) {
      Meta.data.gateNew = 0; Meta.save();
      const guard = NPC_IDS.find((i) => NPCS[i].gate === gateSide(opened));
      notes.push(`${guard ? NPCS[guard].name : 'The guard'} will let you through the ${gateName(opened)} now.`);
    }
    const show = () => {
      for (const n of notes) this.toast(n);
      this.ui.showTown();
      // the story: Hearthvale's gate the first time, a friend you found, the Scar after the last gate
      if (this.ui.storyBeats(found)) return;
      if (!Meta.named && Meta.hero === 'rowan') this.ui.openNaming(); // Ollie asks who you are (then Moss shows you round)
      else this.ui.tip('town');
      // the beginner's guide: a first survivalmon, a new gate, an achievement earned out in the wild
      if (hatched.length) this.ui.tip('hatched');
      if (opened) this.ui.tip('gates');
      if (this.achvTip) { this.achvTip = false; this.ui.tip('achv'); }
    };
    if (hatched.length) {
      this.fillTownRanch();
      const P = this.player;
      for (const mon of hatched) if (Box.inTeam(mon.id) && !P.pets.some((p) => p.mon === mon)) { const pet = new Pet(this, mon); pet.x = P.x; pet.y = P.y + 8; P.pets.push(pet); }
      this.ui.showHatched(hatched, show);
    } else show();
  },

  updateTown(dt) {
    if (this.townRoom) { this.updateTownRoom(dt); return; }
    const P = this.player, town = this.town;
    P.update(dt, town.solids);
    P.pets.forEach((p, i) => p.update(dt, i, true));
    town.updateRanch(dt, this);
    town.updateVillagers(dt, P);
    this.updateEffects(dt);
    this.particles.update(dt);
    this.followCamera(dt);
    // the nearest door, or someone to talk to if they're closer
    let near = null, bd = 22 * 22, who = null, wd = 24 * 24;
    for (const d of town.doors) {
      if (d.gate) continue; // a gate's guard is the way out
      const dd = dist2(P.x, P.y, d.x, d.y);
      if (dd < bd) { bd = dd; near = d; }
    }
    for (const n of town.npcs) {
      const dd = dist2(P.x, P.y, n.x, n.y + 4);
      if (dd < wd) { wd = dd; who = n; }
    }
    const act = Input.wasPressed('KeyE') || Input.wasPressed('Enter');
    if (who && (!near || wd < bd)) {
      this.ui.prompt(`Talk to ${NPCS[who.id].name}`, who.x, who.y - 34);
      if (act) this.talkTo(who);
    } else if (near) {
      near.open = near.gate ? near.tier <= Meta.gates : near.always || Meta.isUnlocked(near.id);
      this.ui.prompt(near.open ? near.name : `${near.name} · ${near.gate ? 'guarded' : 'closed'}`, near.x, near.py);
      if (act) this.enterBuilding(near);
    } else this.ui.prompt(null);
  },

  enterBuilding(d) {
    // a gate you haven't earned yet: its guard stops you
    if (d.gate && d.tier > Meta.gates) {
      const guard = this.town.npcs.find((n) => NPCS[n.id].gate === d.gate);
      if (guard) this.talkTo(guard); else this.toast(`${d.name}: beat the Night Lord past the gate before it first.`);
      return;
    }
    if (!d.open) { this.toast(`${d.name}: ${UNLOCK_TEXT[d.id] || 'opens later'}.`); return; }
    this.ui.prompt(null);
    Meta.visitPlace(d.id);
    // most buildings are rooms with their keeper inside; the Merchant is the stall, served by Mags
    if (TOWN_ROOM_IDS.includes(d.id)) { this.enterTownRoom(d); return; }
    const mags = d.id === 'merchant' && this.town.npcs.find((n) => n.id === 'mags');
    if (mags) { this.talkTo(mags); return; }
    Audio.play('door');
    if (d.gate) { this.ui.showTeam(d.gate); return; }
    const screens = { merchant: 'showMerchant' };
    this.ui[screens[d.id]]?.();
  },

  // ---------------------------------------------------------------- talking and the rooms
  // Turn to face the hero and open the talk box
  talkTo(n) {
    const P = this.player;
    n.dir = dir8(Math.atan2(P.y - n.y, P.x - n.x));
    n.talking = true;
    this.ui.prompt(null);
    if (NPCS[n.id]?.gate === 'north') Meta.visitPlace('gate'); // the tour's last stop: Ollie lets you out
    Audio.play('click');
    this.ui.openTalk(n);
  },
  enterTownRoom(d) {
    const P = this.player;
    this.townRooms ||= {};
    const room = (this.townRooms[d.id] ||= buildTownRoom(d.id));
    this.townRoom = room; this.room = room; this.townDoor = d;
    this.roomOff = { x: Math.floor((this.view.w - room.pw) / 2), y: Math.floor((this.view.h - room.ph) / 2) };
    P.x = room.spawn.x; P.y = room.spawn.y - 6; P.dir = 'up'; P.faceAngle = -Math.PI / 2; P.d8 = null;
    P.trail = []; P.dashT = 0; P.dashA = null; P.ghosts.length = 0;
    P.pets.forEach((pet, i) => { pet.x = Math.max(16, Math.min(room.pw - 16, P.x + (i % 2 ? -1 : 1) * 18 * (1 + (i >> 1)))); pet.y = P.y + 4; pet.state = 'follow'; });
    for (const n of room.npcs) { n.talking = false; n.dir = 'south'; }
    this.ui.prompt(null);
    Audio.play('door');
  },
  leaveTownRoom() {
    const P = this.player, d = this.townDoor;
    this.townRoom = null; this.room = null;
    P.x = d.x; P.y = d.y + 8; P.dir = 'down'; P.faceAngle = Math.PI / 2; P.d8 = null; P.trail = [];
    P.pets.forEach((pet, i) => { pet.x = P.x + (i % 2 ? -1 : 1) * 18 * (1 + (i >> 1)); pet.y = P.y + 4; pet.state = 'follow'; });
    this.snapCamera();
    this.ui.prompt(null);
    Audio.play('door');
  },
  updateTownRoom(dt) {
    const P = this.player, room = this.townRoom;
    P.update(dt, room.solids);
    P.pets.forEach((p, i) => p.update(dt, i, true));
    this.updateEffects(dt);
    this.particles.update(dt);
    const n = room.npcs[0], act = Input.wasPressed('KeyE') || Input.wasPressed('Enter');
    if (n && !n.talking) n.dir = 'south';
    if (n && dist2(P.x, P.y, n.x, n.y + 6) < 32 * 32) {
      this.ui.prompt(`Talk to ${NPCS[n.id].name}`, n.x, n.y - 34);
      if (act) this.talkTo(n);
    } else if (P.y > room.ph - 30 && Math.abs(P.x - room.doorX) < 16) this.ui.prompt('Leave', room.doorX, room.ph + 16);
    else this.ui.prompt(null);
    if (P.y > room.ph - 13 && Math.abs(P.x - room.doorX) < 14) this.leaveTownRoom();
  },

  renderTown() {
    if (this.townRoom) { this.renderHouse(); return; }
    const ctx = this.ctx, V = this.view, town = this.town, P = this.player, now = this.realTime;
    const cam = this.renderCam();
    ctx.fillStyle = '#245f2b'; ctx.fillRect(0, 0, V.w, V.h);
    this.townGround?.draw(ctx, cam, V);
    const list = [];
    for (const o of town.objects) {
      const s = SPR[o.spr];
      const left = o.x - s.ax, top = o.y - s.ay;
      if (left > cam.x + V.w || left + s.w < cam.x || top > cam.y + V.h || top + s.h < cam.y) continue;
      list.push({ y: o.sortY, o, s, left, top });
    }
    for (const m of town.ranch) list.push({ y: m.y, m });
    for (const d of town.dummies) list.push({ y: d.y, dummy: d });
    for (const t of town.trainees) list.push({ y: t.y, trainee: t });
    Box.eggs.forEach((e, i) => { const n = town.nests[i]; if (n) list.push({ y: n.y, egg: e, n }); });
    for (const p of P.pets) list.push({ y: p.y, pet: p });
    for (const n of town.npcs || []) if (!n.hidden) list.push({ y: n.scene ? n.y : n.sortY ?? n.y, npc: n });
    for (const a of this.sceneActors || []) list.push({ y: a.y, actor: a });
    list.push({ y: P.y, hero: P });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.o) {
        // see the hero (and the team) through a roof or tree they walk behind
        const hid = (q) => q.y < it.o.sortY - 1 && q.y > it.top + 6 && q.x > it.left + 3 && q.x < it.left + it.s.w - 3;
        const behind = it.o.fade && (hid(P) || P.pets.some(hid));
        ctx.globalAlpha = behind ? 0.55 : 1;
        ctx.drawImage(it.o.img || it.s.frames[0], snap(it.left - cam.x), snap(it.top - cam.y), it.s.w, it.s.h);
        ctx.globalAlpha = 1;
      } else if (it.m) {
        const m = it.m, a = CREATURE[m.species];
        if (!a) continue;
        const x = snap(m.x) - cam.x, y = snap(m.y) - cam.y;
        ctx.globalAlpha = 0.28; ctx.fillStyle = '#1a2a10';
        ctx.beginPath(); ctx.ellipse(x, y, Math.max(5, a.cw * 0.34), Math.max(2, a.cw * 0.12), 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
        if (m.stars >= 5) drawStarShine(ctx, x, y, a.ch, now, m.seed, 'glow');
        drawCreature(ctx, a, x, y, { left: m.left, ...creatureMotion(a.motion, now, m.moving, m.seed, !!a.anim), anim: a.motion === 'fly' || m.moving ? 'move' : 'idle', at: now + m.seed });
        if (m.stars >= 5) drawStarShine(ctx, x, y, a.ch, now, m.seed);
      } else if (it.dummy) drawDummy(ctx, it.dummy, cam);
      else if (it.trainee) drawTrainee(ctx, it.trainee, cam, now);
      else if (it.actor) this.drawSceneActor(ctx, it.actor, cam, now);
      else if (it.npc) {
        const n = it.npc, a = NPC_ART[n.id];
        if (!a) continue;
        const x = snap(n.x) - cam.x, y = snap(n.y) - cam.y;
        ctx.globalAlpha = 0.28; ctx.fillStyle = '#1a2a10';
        ctx.beginPath(); ctx.ellipse(x, y, 7, 2.5, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
        drawNpcArt(ctx, a, x, y, n.dir, now + n.seed, n.moving);
        if (n.emote) this.drawSceneEmote(ctx, n, cam);
      }
      else if (it.egg) {
        // the egg's own patterned shell (32px art at 16 logical px; its bottom row is 30)
        const art = eggCanvas(it.egg.species), x = snap(it.n.x - cam.x), y = snap(it.n.y - cam.y), n = EGG_SIZE / WS;
        const wob = it.egg.progress >= it.egg.need ? Math.sin(now * 12) * 0.6 : 0;
        if (art) ctx.drawImage(art, x - n / 2 + wob, y - 30 / WS, n, n);
        ctx.fillStyle = '#2b1d24'; ctx.fillRect(x - 6, y + 1, 12, 3);
        ctx.fillStyle = '#ffd84a'; ctx.fillRect(x - 5, y + 2, Math.round(10 * it.egg.progress / it.egg.need), 1);
      } else if (it.pet) it.pet.draw(ctx, cam);
      else it.hero.draw(ctx, cam);
    }
    for (const t of town.trainees) drawShot(ctx, t, cam, now);
    this.drawEffects(ctx, cam);
    this.particles.draw(ctx, cam);
  },
};
// What the Ranch shows depends on who rests there, who trains and how many dummies there are
const ranchKey = (resting) => `${resting.map((m) => `${m.id}:${m.species}:${m.stars || 0}${Box.isTraining(m.id) ? 't' : ''}`).join()}|${Box.trainSpots()}`;
