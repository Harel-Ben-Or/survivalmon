// House interiors, made new for every house the first time you walk in (a new run, new houses).
// Each one rolls its own size, where its door is, its floor and walls, sometimes an inner wall
// that splits off a side room, and a theme that picks the furniture: home, bedroom, library,
// kitchen or storeroom for cottages; hayloft, stable or storehouse for barns; altar hall or crypt
// for shrines. Now and then a trapdoor in the floor leads down to a basement full of gold.
//
// The rules every room follows:
//  1. Nothing stands on anything else, and a clear path runs in from the door.
//  2. Everything you can search can be reached from the door.
//  3. Big furniture (beds, shelves, cupboards, stoves, the clock) stands against the back wall.
//  4. A table, with a chair each side, stands out in the open middle of the room.
//  5. Barrels, crates and pots huddle in corners or line a side wall; chests, plants and candles
//     stand against a wall. Only hay heaps (barns) and gold (basements) lie out on the floor.
//  6. At most one rug a room (and one in a side room): under the table, at the foot of a bed or
//     in front of the altar, else in the open middle. Rugs never touch each other, the trapdoor,
//     the doorway or a wall, and nothing but the table and its chairs stands on one.
//  7. The trapdoor lies on open floor with nothing on it.
import { mulberry32, shuffle } from '../core/util.js';
import { SPR, PC } from '../gfx/assets.js';
import { ROOM_ART, WS } from '../gfx/art.js';

export const WALL_H = 40;
const T = 16;
const DOOR_W = 28;                     // the front doorway
const GAP_H = 30;                      // the doorway in an inner wall
export const BASEMENT_CHANCE = { cottage: 0.06, barn: 0.08, shrine: 0.1 };
const SIZE = { cottage: [11, 15, 9, 11], barn: [14, 18, 10, 12], shrine: [9, 13, 8, 10] }; // tiles: w min/max, h min/max
const THEMES = {
  cottage: ['home', 'home', 'bedroom', 'library', 'kitchen', 'storeroom'],
  barn: ['hayloft', 'stable', 'storehouse'],
  shrine: ['altar', 'crypt'],
};
const MATERIALS = {
  cottage: [['floor_wood', 'wall_wood'], ['floor_wood', 'wall_wood'], ['floor_wood', 'plaster'], ['floor_stone', 'wall_wood'], ['floor_wood', 'wall_stone']],
  barn: [['floor_barn', 'wall_barn'], ['floor_barn', 'barn_red']],
  shrine: [['floor_stone', 'wall_stone'], ['floor_stone', 'shrine_brick']],
};
// The basement's gold: [sprite, how big a haul]
const GOLD = [['gold_heap', 'big'], ['gold_gems', 'big'], ['gold_bars', 'big'], ['gold_crate', 'big'], ['gold_sack', 'mid'], ['gold_jar', 'mid'], ['gold_small', 'small'], ['gold_goblet', 'small']];

const overlap = (a, b, m = 3) => a.x < b.x + b.w + m && a.x + a.w + m > b.x && a.y < b.y + b.h + m && a.y + a.h + m > b.y;

// A room being furnished: placement with collision, keep-clear zones and a reachability check
function makeRoom(kind, theme, pw, ph, rng) {
  const ri = (a, b) => Math.floor(a + rng() * (b - a + 1));
  const room = {
    kind, theme, pw, ph, doorX: null, walls: [], furniture: [], containers: [], spawn: null,
    windows: [], rugs: [], torches: [], webs: [], stalls: [], part: null, hatch: null, canvas: null,
  };
  const solids = [], clear = [], rugZones = [];
  // Where the hero can walk from the door (or the ladder), on a grid of 4px cells; returns a test
  // for "can the hero get within d px of (x, y)"
  const reachMap = () => {
    const C = 4, r = 5, W = Math.ceil(pw / C), H = Math.ceil(ph / C);
    const block = new Uint8Array(W * H);
    for (const s of [...room.walls, ...solids]) {
      const x0 = Math.max(0, Math.floor((s.x - r) / C)), x1 = Math.min(W - 1, Math.floor((s.x + s.w + r) / C));
      const y0 = Math.max(0, Math.floor((s.y - r) / C)), y1 = Math.min(H - 1, Math.floor((s.y + s.h + r) / C));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) block[y * W + x] = 1;
    }
    const seen = new Uint8Array(W * H), q = [];
    const sx = Math.floor(room.spawn.x / C), sy = Math.floor(room.spawn.y / C);
    seen[sy * W + sx] = 1; q.push(sx, sy);
    while (q.length) {
      const y = q.pop(), x = q.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[k] || block[k]) continue;
        seen[k] = 1; q.push(nx, ny);
      }
    }
    return (px, py, d) => {
      for (let y = Math.floor((py - d) / C); y <= Math.floor((py + d) / C); y++) for (let x = Math.floor((px - d) / C); x <= Math.floor((px + d) / C); x++) {
        if (x < 0 || y < 0 || x >= W || y >= H || !seen[y * W + x]) continue;
        if ((x * C + 2 - px) ** 2 + (y * C + 2 - py) ** 2 < d * d) return true;
      }
      return false;
    };
  };
  // Everything searchable, and the trapdoor, can still be reached?
  const allReachable = (extra) => {
    const near = reachMap();
    return [...room.containers, ...(extra ? [extra] : [])].every((c) => near(c.x + c.w / 2, c.y + c.h, 20))
      && (!room.hatch || near(room.hatch.cx, room.hatch.cy, 14));
  };
  const place = (spr, x, y, opts = {}) => {
    const s = SPR[spr];
    if (!s) return null;
    const item = { spr, x: Math.round(x), y: Math.round(y), w: s.w, h: s.h, ...opts };
    const base = opts.solidH ?? Math.min(s.h, 14);
    item.solid = opts.wall ? { x: item.x, y: WALL_H, w: s.w, h: Math.max(4, item.y + s.h - WALL_H) } : { x: item.x + 1, y: item.y + s.h - base, w: s.w - 2, h: base };
    if (item.x < 8 || item.x + s.w > pw - 8 || item.y + s.h > ph - 10 || item.y + s.h < WALL_H + 2) return null;
    const box = opts.flat ? { x: item.x, y: item.y, w: s.w, h: s.h } : item.solid;
    if (clear.some((r) => overlap(r, box, 0))) return null;
    if (solids.some((r) => overlap(r, box, opts.tight ? 1 : 3))) return null;
    if (!opts.onRug && rugZones.some((r) => overlap(r, { x: item.x, y: item.y, w: s.w, h: s.h }, 1))) return null;
    if (opts.flat) {
      // a trapdoor: nothing may stand on it, and the hero must be able to reach it
      if (room.spawn && !reachMap()(item.x + s.w / 2, item.y + s.h / 2, 14)) return null;
      clear.push({ x: item.x - 4, y: item.y - 4, w: s.w + 8, h: s.h + 8 });
    } else {
      // nothing may cut off anything searchable from the door
      solids.push(item.solid);
      if (room.spawn && !allReachable(opts.container ? item : null)) { solids.pop(); return null; }
    }
    room.furniture.push(item);
    if (opts.container) room.containers.push(item);
    return item;
  };
  // Somewhere free on the floor of a part of the room (x0..x1), trying a few spots
  const scatter = (spr, x0, x1, opts = {}, tries = 24, y0 = WALL_H + 4, y1 = ph - 12) => {
    const s = SPR[spr];
    if (!s) return null;
    for (let i = 0; i < tries; i++) {
      const it = place(spr, ri(x0 + 2, Math.max(x0 + 2, x1 - s.w - 2)), ri(y0, Math.max(y0, y1 - s.h)), opts);
      if (it) return it;
    }
    return null;
  };
  // Along the back wall of a part of the room, left to right with random gaps
  const backWall = (list, x0, x1) => {
    let x = x0 + ri(2, 14);
    for (const [spr, opts] of list) {
      const s = SPR[spr];
      if (!s) continue;
      if (x + s.w > x1 - 2) break;
      const y = spr.startsWith('bed') ? WALL_H - 6 : WALL_H + 6 - s.h; // a bed's head touches the wall
      if (place(spr, x, y, { wall: true, ...opts })) x += s.w + ri(2, 16);
      else x += 8;
    }
  };
  // A few barrels, crates and pots huddled in a corner of a part of the room
  const storage = (x0, x1, n, kinds = ['barrel', 'crate', 'pot']) => {
    const corners = shuffle([[x0 + 4, WALL_H + 6, 1], [x1 - 20, WALL_H + 6, -1], [x0 + 4, ph - 30, 1], [x1 - 20, ph - 30, -1]], rng);
    for (const [cx, cy, dir] of corners) {
      let placed = 0;
      for (let i = 0; i < n * 2 && placed < n; i++) {
        const kind = kinds[ri(0, kinds.length - 1)], s = SPR[kind];
        if (!s) continue;
        const y = cy < ph / 2 ? cy + (placed % 2) * 14 : ph - 12 - s.h - (placed % 2) * 14;
        if (place(kind, cx + dir * (placed >> 1) * 16 + dir * (placed % 2) * 6, y, { container: true, type: kind })) placed++;
      }
      if (placed) return;
    }
  };
  // Lined up along the left or right wall of a part of the room
  const sideWall = (x0, x1, kinds, n, container = true) => {
    const left = rng() < 0.5;
    let y = WALL_H + ri(6, 20);
    for (let i = 0; i < n * 3 && y < ph - 30; i++) {
      const k = kinds[ri(0, kinds.length - 1)], s = SPR[k];
      if (!s) continue;
      if (place(k, left ? x0 + 2 : x1 - s.w - 2, y, container ? { container: true, type: k } : {})) { y += s.h + ri(1, 4); n--; if (!n) break; } else y += 6;
    }
  };
  // Somewhere free against a wall of a part of the room (x0..x1): in front of the back wall,
  // beside a side wall or along the front wall, never out in the middle of the floor
  const edge = (spr, x0, x1, opts = {}, tries = 40) => {
    const s = SPR[spr];
    if (!s) return null;
    for (let i = 0; i < tries; i++) {
      const side = ri(0, 3);
      let x, foot;
      if (side === 0) { x = ri(x0 + 2, x1 - s.w - 2); foot = WALL_H + ri(8, 30); }
      else if (side === 3) { x = ri(x0 + 2, x1 - s.w - 2); foot = ph - 11 - ri(0, 3); }
      else { x = side === 1 ? x0 + ri(1, 4) : x1 - s.w - ri(1, 4); foot = ri(WALL_H + 16, ph - 12); }
      const it = place(spr, x, foot - s.h, opts);
      if (it) return it;
    }
    return null;
  };
  const chest = (x0, x1, tier) => edge(`chest_${tier}`, x0, x1, { container: true, type: 'chest', tier });
  // Rugs: where one centred on (cx, cy) would lie, or null if it would touch a wall, the doorway,
  // the trapdoor, another rug, or any furniture but `under` (a table and its chairs)
  const rugRect = (name, cx, cy, under = []) => {
    const a = ROOM_ART[name] || PC[name], w = a?.w || 48, h = a?.h || 30;
    const r = { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h };
    if (r.x < 10 || r.x + w > pw - 10 || r.y < WALL_H + 6 || r.y + h > ph - 14) return null;
    // (a rug may lie on the path in from the door, just not on the doormat)
    if (room.walls.some((s) => overlap(s, r, 2)) || clear.some((z) => !z.door && overlap(z, r, 2)) || rugZones.some((z) => overlap(z, r, 8))) return null;
    if (room.doorX != null && overlap({ x: room.doorX - 16, y: ph - 26, w: 32, h: 26 }, r, 2)) return null;
    if (room.furniture.some((f) => !under.includes(f) && overlap(f, r, 1))) return null;
    return r;
  };
  const rug = (name, cx, cy, under) => {
    const r = rugRect(name, cx, cy, under);
    if (!r) return false;
    rugZones.push(r);
    room.rugs.push({ name, x: r.x + r.w / 2, y: r.y + r.h / 2 });
    return true;
  };
  // A rug in the open middle of a part of the room, spreading out from the centre
  const rugIn = (name, x0, x1, tries = 30) => {
    const mx = (x0 + x1) / 2, my = (WALL_H + ph) / 2 + 4, sx = (x1 - x0) / 2 - 26, sy = (ph - WALL_H) / 2 - 18;
    for (let i = 1; i <= tries; i++) {
      const k = i / tries;
      if (rug(name, mx + (rng() * 2 - 1) * k * sx, my + (rng() * 2 - 1) * k * sy)) return true;
    }
    return false;
  };
  // A table with a chair each side, out in the open middle; with a rug under it if one is wanted
  const tableSet = (x0, x1, rugName = null) => {
    const s = SPR.table;
    if (!s) return null;
    const xa = x0 + 16, xb = x1 - 16 - s.w, ya = WALL_H + 22, yb = ph - 30 - s.h;
    if (xb < xa || yb < ya) return null;
    for (let i = 0; i < 48; i++) {
      const k = Math.min(1, (i + 4) / 28); // start near the middle, spread out
      const x = (xa + xb) / 2 + (rng() * 2 - 1) * k * (xb - xa) / 2, y = (ya + yb) / 2 + (rng() * 2 - 1) * k * (yb - ya) / 2;
      // while there are tries left, only spots where the rug fits too
      if (rugName && i < 36 && !rugRect(rugName, x + s.w / 2, y + 13)) continue;
      const t = place('table', x, y, { solidH: 12, onRug: true });
      if (!t) continue;
      const c1 = place('chair', t.x - 13, t.y + 4, { solidH: 6, tight: true, onRug: true });
      const c2 = place('chair', t.x + t.w + 1, t.y + 4, { solidH: 6, tight: true, onRug: true });
      if (rugName) rug(rugName, t.x + t.w / 2, t.y + 13, [t, c1, c2]);
      return t;
    }
    return null;
  };
  // A last check (placement already keeps everything reachable): anything cut off is taken out
  const finish = () => {
    const near = reachMap();
    const cut = room.containers.filter((c) => !near(c.x + c.w / 2, c.y + c.h, 20));
    if (cut.length) {
      room.containers = room.containers.filter((c) => !cut.includes(c));
      room.furniture = room.furniture.filter((f) => !cut.includes(f));
      for (const c of cut) solids.splice(solids.indexOf(c.solid), 1);
    }
    if (room.hatch && !near(room.hatch.cx, room.hatch.cy, 14)) {
      room.furniture = room.furniture.filter((f) => f !== room.hatch.item);
      room.hatch = null;
    }
    room.solids = [...room.walls, ...solids];
    return room;
  };
  return { room, place, scatter, edge, backWall, storage, sideWall, chest, tableSet, rug, rugIn, finish, solids, clear, ri };
}

export function buildInterior(house, seed) {
  const rng = mulberry32(seed);
  const pick = (a, b) => Math.floor(a + rng() * (b - a + 1));
  const kind = house.kind, [w0, w1, h0, h1] = SIZE[kind];
  const tw = pick(w0, w1), th = pick(h0, h1);
  const theme = THEMES[kind][pick(0, THEMES[kind].length - 1)];
  const pw = tw * T, ph = th * T;
  const R = makeRoom(kind, theme, pw, ph, rng);
  const { room, place, scatter, edge, backWall, storage, sideWall, chest, tableSet, rug, rugIn, clear, solids, ri } = R;
  [room.floor, room.wall] = MATERIALS[kind][ri(0, MATERIALS[kind].length - 1)];

  // an inner wall splitting off a side room (bigger cottages, now and then)
  let main = [8, pw - 8], side = null;
  if (kind === 'cottage' && tw >= 13 && rng() < 0.5) {
    const left = rng() < 0.5, sw = ri(4, 5) * T;
    const x = left ? sw : pw - sw, gapY = ri(WALL_H + 8, ph - 12 - GAP_H - 8);
    room.part = { x, gapY };
    const a = { x: x - 3, y: WALL_H, w: 6, h: gapY - WALL_H }, b = { x: x - 3, y: gapY + GAP_H, w: 6, h: ph - 10 - gapY - GAP_H };
    room.walls.push(a, b); solids.push(a, b);
    clear.push({ x: x - 24, y: gapY - 2, w: 48, h: GAP_H + 4 });
    main = left ? [x + 3, pw - 8] : [8, x - 3];
    side = left ? [8, x - 3] : [x + 3, pw - 8];
  }
  // the front door, somewhere along the main room's front wall
  room.doorX = kind === 'barn' ? Math.floor(pw / 2) + ri(-2, 2) * 8 : ri(main[0] + 26, main[1] - 26);
  const dx = room.doorX;
  room.walls.push(
    { x: 0, y: 0, w: pw, h: WALL_H + 4 },
    { x: 0, y: 0, w: 8, h: ph }, { x: pw - 8, y: 0, w: 8, h: ph },
    { x: 0, y: ph - 10, w: dx - DOOR_W / 2, h: 10 }, { x: dx + DOOR_W / 2, y: ph - 10, w: pw - dx - DOOR_W / 2, h: 10 },
  );
  room.spawn = { x: dx, y: ph - 20 };
  clear.push({ x: dx - 18, y: ph - 48, w: 36, h: 48, door: true });

  // now and then, a trapdoor down to a basement: laid first so nothing stands on it
  if (rng() < BASEMENT_CHANCE[kind]) {
    const [x0, x1] = side && rng() < 0.5 ? side : main;
    const item = scatter('trapdoor', x0, x1, { flat: true }, 40, WALL_H + 10, ph - 30);
    if (item) room.hatch = { item, cx: item.x + item.w / 2, cy: item.y + item.h / 2 };
  }

  const [m0, m1] = main;
  const tier = () => (rng() < 0.08 ? 'gold' : rng() < 0.3 ? 'silver' : 'wood');
  const C = (type, extra = {}) => ({ container: true, type, ...extra });
  const RUGS = ['rug_r', 'rug_b', 'rug_g'];
  if (kind === 'cottage') {
    const bed = () => ['bed_r', 'bed_b', 'bed_g'][ri(0, 2)];
    const heat = rng() < 0.5 ? 'fireplace' : 'stove';
    const rugName = RUGS[ri(0, 2)];
    // a rug at the foot of one of the beds
    const bedRug = () => {
      for (const b of shuffle(room.furniture.filter((f) => f.spr.startsWith('bed')), rng)) if (rug(rugName, b.x + b.w / 2, b.y + b.h + 17)) return true;
      return false;
    };
    let wantRug = false;
    if (theme === 'home') {
      backWall(shuffle([[bed(), { wall: false, solidH: 30 }], ['bookshelf', C('bookshelf')], [heat, {}], ['cupboard', C('cupboard')], ['clock', {}], ['plant', {}]], rng), m0, m1);
      wantRug = rng() < 0.8;
      tableSet(m0, m1, wantRug ? rugName : null);
      storage(m0, m1, ri(1, 3));
      if (rng() < 0.6) edge('plant', m0, m1);
    } else if (theme === 'bedroom') {
      backWall(shuffle([[bed(), { wall: false, solidH: 30 }], [bed(), { wall: false, solidH: 30 }], ['cupboard', C('cupboard')], ['clock', {}], ['plant', {}]], rng), m0, m1);
      wantRug = rng() < 0.8;
      if (wantRug) bedRug();
      storage(m0, m1, ri(1, 2), ['pot', 'crate']);
    } else if (theme === 'library') {
      backWall(shuffle([['bookshelf', C('bookshelf')], ['bookshelf', C('bookshelf')], ['bookshelf', C('bookshelf')], ['bookshelf', C('bookshelf')], ['clock', {}], ['plant', {}]], rng), m0, m1);
      wantRug = rng() < 0.8;
      tableSet(m0, m1, wantRug ? rugName : null);
      for (let i = ri(0, 2); i > 0; i--) edge('plant', m0, m1);
    } else if (theme === 'kitchen') {
      backWall(shuffle([['stove', {}], ['cupboard', C('cupboard')], ['cupboard', C('cupboard')], [heat === 'stove' ? 'fireplace' : 'stove', {}], ['wine_rack', {}], ['plant', {}]], rng), m0, m1);
      wantRug = rng() < 0.5;
      tableSet(m0, m1, wantRug ? rugName : null);
      storage(m0, m1, ri(2, 4), ['barrel', 'pot', 'pot', 'crate']);
      storage(m0, m1, ri(1, 3), ['barrel', 'crate']);
    } else {
      // storeroom: mostly things to search, and no rug
      backWall(shuffle([['cupboard', C('cupboard')], ['bookshelf', C('bookshelf')], ['cupboard', C('cupboard')], ['wine_rack', {}]], rng), m0, m1);
      if (rng() < 0.5) edge('barrel_side', m0, m1, { solidH: 10 });
      for (let i = 0; i < 3; i++) storage(m0, m1, ri(2, 4));
      for (let i = ri(1, 3); i > 0; i--) { const k = ['barrel', 'crate'][ri(0, 1)]; edge(k, m0, m1, C(k)); }
    }
    // no table (or no room by the beds) for the rug: the open middle, before the clutter comes in
    if (wantRug && !room.rugs.length) rugIn(rugName, m0, m1);
    // clutter: more to search along a side wall, and a pot plant or two
    if (rng() < 0.75) sideWall(m0, m1, theme === 'library' ? ['pot', 'crate'] : ['barrel', 'crate', 'pot', 'barrel'], ri(2, 3));
    storage(m0, m1, ri(1, 2));
    if (rng() < 0.5) edge('plant', m0, m1);
    chest(m0, m1, tier());
    if (theme === 'storeroom' && rng() < 0.5) chest(m0, m1, 'wood');
    if (side) {
      // the side room: a little bedroom (maybe a rug at the bed's foot) or a store
      const [s0, s1] = side;
      if (rng() < 0.5) {
        const b = place(bed(), s0 + ri(2, 8), WALL_H - 6, { solidH: 30 });
        scatter('cupboard', s0, s1, C('cupboard'), 10, WALL_H - 14, WALL_H + 20);
        if (b && rng() < 0.5) rug(RUGS[ri(0, 2)], Math.max(s0 + 26, Math.min(s1 - 26, b.x + b.w / 2)), b.y + b.h + 17);
        if (rng() < 0.5) edge('plant', s0, s1);
      } else {
        storage(s0, s1, ri(2, 4));
        storage(s0, s1, ri(1, 3));
      }
      if (rng() < 0.5) chest(s0, s1, tier());
    }
    // the wall decoration
    room.painting = rng() < 0.7 ? { n: ri(0, 1), x: ri(m0 + 16, m1 - 32) } : null;
  } else if (kind === 'barn') {
    if (theme === 'stable') {
      // stalls along the back wall, each with hay or something to search in it
      const stallW = ri(40, 52);
      for (let x = 14 + stallW; x < pw - 30; x += stallW) {
        const wall = { x: x - 2, y: WALL_H, w: 4, h: 36 };
        room.walls.push(wall); solids.push(wall); room.stalls.push(x);
      }
      for (let x = 14; x + 30 < pw - 8; x += stallW) {
        const r = rng(), k = r < 0.8 ? 'crate' : 'barrel';
        if (r < 0.55) place('hay', x + ri(6, 14), WALL_H + ri(6, 12), {});
        else place(k, x + ri(8, 16), WALL_H + ri(6, 12), C(k));
      }
      for (let i = ri(2, 4); i > 0; i--) scatter('hay', 8, pw - 8, {}, 12, WALL_H + 44);
      storage(8, pw - 8, ri(2, 3));
      sideWall(8, pw - 8, ['barrel', 'crate'], ri(2, 3));
    } else if (theme === 'storehouse') {
      // aisles of crates and barrels
      for (let row = WALL_H + 8; row < ph - 44; row += ri(30, 38)) {
        for (let x = 20 + ri(0, 12); x < pw - 40; x += ri(18, 26)) {
          if (Math.abs(x - dx) < 30) continue;
          const k = ['crate', 'barrel', 'crate'][ri(0, 2)];
          if (rng() < 0.75) place(k, x, row, C(k));
        }
      }
    } else {
      // hayloft: hay along the back wall and in heaps
      backWall(Array.from({ length: 12 }, () => { const k = rng() < 0.5 ? 'crate' : 'barrel'; return rng() < 0.65 ? ['hay', { wall: false }] : [k, C(k, { wall: false })]; }), 8, pw - 8);
      for (let i = ri(3, 6); i > 0; i--) scatter('hay', 8, pw - 8);
      storage(8, pw - 8, ri(1, 3));
    }
    chest(8, pw - 8, rng() < 0.3 ? 'silver' : 'wood');
    chest(8, pw - 8, rng() < 0.25 ? 'gold' : 'wood');
  } else {
    // shrines: the altar, and pots, plants and candles; a crypt has pillars and cobwebs
    const ax = theme === 'crypt' ? ri(30, pw - 60) : Math.floor(pw / 2) - 14;
    const altar = place('altar', ax, WALL_H - 6, { solidH: 14, ...C('altar', { tier: 'gold' }) });
    // an altar hall has a rug laid in front of the altar, and candles either side of it
    if (theme === 'altar' && altar) {
      rug('rug_b', altar.x + altar.w / 2, altar.y + altar.h + 17);
      const cs = SPR.candles;
      if (cs && rng() < 0.7) for (const x of [altar.x - cs.w - 4, altar.x + altar.w + 4]) place('candles', x, WALL_H + 6 - cs.h + 8, { solidH: 6 });
    }
    if (theme === 'crypt') {
      for (const x of [ri(20, 40), pw - ri(36, 56)]) for (const y of [WALL_H + 26, ph - 46]) if (rng() < 0.7) place('pillar', x, y, { solidH: 12 });
      room.webs.push(0, 1);
    }
    for (let i = ri(2, 4); i > 0; i--) edge('pot', 8, pw - 8, C('pot'));
    for (let i = ri(1, 3); i > 0; i--) edge(rng() < 0.5 ? 'candles' : 'plant', 8, pw - 8, { solidH: 6 });
    chest(8, pw - 8, rng() < 0.2 ? 'gold' : 'silver');
  }
  // windows where the wall isn't covered by tall furniture
  const tall = room.furniture.filter((f) => f.y < WALL_H - 10).map((f) => [f.x - 4, f.x + f.w + 4]);
  const want = kind === 'barn' ? ri(1, 3) : ri(1, 3);
  for (let i = 0; i < 30 && room.windows.length < want; i++) {
    const x = ri(24, pw - 24);
    if (tall.some(([a, b]) => x + 12 > a && x - 12 < b) || room.windows.some((wx) => Math.abs(wx - x) < 34)) continue;
    if (room.part && Math.abs(x - room.part.x) < 16) continue;
    room.windows.push(x);
  }
  if (kind === 'shrine') room.torches = [ri(16, 30), pw - ri(24, 38)];
  R.finish();
  room.canvas = paintRoom(room, rng);
  return room;
}

// The basement: a dark stone cellar under the house with heaps of gold, reached by a ladder.
export function buildBasement(house, seed) {
  const rng = mulberry32(seed ^ 0x5bd1e995);
  const tw = 11 + Math.floor(rng() * 4), th = 9 + Math.floor(rng() * 2);
  const pw = tw * T, ph = th * T;
  const R = makeRoom('basement', 'cellar', pw, ph, rng);
  const { room, place, scatter, edge, clear, ri } = R;
  room.floor = 'floor_stone'; room.wall = 'wall_stone'; room.dark = true;
  room.walls.push({ x: 0, y: 0, w: pw, h: WALL_H + 4 }, { x: 0, y: 0, w: 8, h: ph }, { x: pw - 8, y: 0, w: 8, h: ph }, { x: 0, y: ph - 10, w: pw, h: 10 });
  // the ladder back up, against the back wall
  const L = SPR.ladder, lx = ri(24, pw - 24 - (L?.w || 20));
  if (L) place('ladder', lx, WALL_H + 8 - L.h, { solidH: 4, wall: true });
  room.ladder = { x: lx + (L?.w || 20) / 2, y: WALL_H + 14 };
  room.spawn = { x: room.ladder.x, y: WALL_H + 22 };
  clear.push({ x: lx - 12, y: WALL_H, w: (L?.w || 20) + 24, h: 36 });
  // the gold
  for (const [spr, size] of shuffle([...GOLD], rng).slice(0, ri(4, 6))) scatter(spr, 8, pw - 8, { container: true, type: 'gold', size, solidH: 8 }, 40);
  scatter('chest_gold', 8, pw - 8, { container: true, type: 'chest', tier: 'gold' }, 40);
  // the cellar: pillars, old barrels, a wine rack, candles
  for (let i = ri(0, 2); i > 0; i--) scatter('pillar', 8, pw - 8, { solidH: 12 });
  for (let i = ri(1, 2); i > 0; i--) edge('barrel_side', 8, pw - 8, { solidH: 10 });
  if (rng() < 0.6) scatter('wine_rack', 8, pw - 8, { wall: true }, 12, WALL_H + 8 - (SPR.wine_rack?.h || 26), WALL_H + 8);
  for (let i = ri(2, 3); i > 0; i--) edge('candles', 8, pw - 8, { solidH: 6 });
  room.torches = [ri(16, Math.floor(pw / 2) - 20), ri(Math.floor(pw / 2) + 20, pw - 24)];
  room.webs = [0, 1];
  R.finish();
  room.canvas = paintRoom(room, rng);
  return room;
}

function paintRoom(room, rng) {
  const { pw, ph, doorX, kind } = room;
  const cv = document.createElement('canvas');
  cv.width = pw * WS; cv.height = ph * WS;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.scale(WS, WS);
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const tile = (art, x0, y0, x1, y1) => {
    for (let y = y0; y < y1; y += art.h) for (let x = x0; x < x1; x += art.w) g.drawImage(art.img, x, y, art.w, art.h);
  };
  const floorArt = ROOM_ART[room.floor], wallArt = ROOM_ART[room.wall];

  // floor
  if (floorArt) tile(floorArt, 0, WALL_H, pw, ph);
  else {
    const base = kind === 'barn' ? ['#b8905a', '#b08854'] : ['#c8935a', '#bf8a52'];
    for (let y = WALL_H; y < ph; y += 8) {
      R(0, y, pw, 8, base[((y - WALL_H) / 8) % 2]);
      R(0, y, pw, 1, '#a87a48');
    }
  }
  if (kind === 'barn') for (let i = 0; i < 120; i++) R(Math.floor(rng() * pw), WALL_H + Math.floor(rng() * (ph - WALL_H)), 2, 1, rng() < 0.5 ? '#e8c35a' : '#d4ac48');
  // rugs
  for (const r of room.rugs) {
    const art = ROOM_ART[r.name];
    if (art) g.drawImage(art.img, Math.round(r.x - art.w / 2), Math.round(r.y - art.h / 2), art.w, art.h);
    else if (PC[r.name]) { const rug = PC[r.name]; g.drawImage(rug.toCanvas(), r.x - rug.w / 2, r.y - rug.h / 2); }
  }
  // back wall
  if (wallArt) {
    tile(wallArt, 0, 0, pw, WALL_H);
    if (room.wall === 'wall_wood') {
      // timber frame and a wood-panelled lower wall over the plaster
      for (let x = 20; x < pw; x += 44) { R(x, 0, 4, WALL_H, '#6e4426'); R(x, 0, 1, WALL_H, '#8a5a32'); }
      R(0, WALL_H - 12, pw, 12, '#9a6438'); R(0, WALL_H - 12, pw, 1, '#c08a50');
      for (let x = 0; x < pw; x += 10) R(x, WALL_H - 11, 1, 10, '#7a4a2a');
    }
    R(0, 0, pw, 5, '#3a2418');
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, WALL_H - 10, pw, 10);
    R(0, WALL_H - 2, pw, 2, '#4a2a1a');
  } else if (room.wall === 'shrine_brick') {
    R(0, 0, pw, WALL_H, '#7a768a');
    for (let y = 4; y < WALL_H; y += 8) for (let x = (y / 8) % 2 ? 0 : 8; x < pw; x += 16) { R(x, y, 16, 1, '#5e5a70'); R(x, y, 1, 8, '#5e5a70'); }
    R(0, 0, pw, 4, '#3a364a');
  } else if (room.wall === 'barn_red') {
    for (let x = 0; x < pw; x += 6) R(x, 0, 6, WALL_H, x % 12 ? '#a8443a' : '#9a3a32');
    R(0, 0, pw, 4, '#4a2a1a'); R(0, WALL_H - 6, pw, 6, '#7a2a24');
  } else {
    // plaster with a wooden skirting
    R(0, 0, pw, WALL_H, '#e8d4a8');
    for (let x = 0; x < pw; x += 8) R(x, 5, 2, WALL_H - 13, '#dcc496');
    R(0, 0, pw, 5, '#4a2a1a');
    R(0, WALL_H - 9, pw, 9, '#9a6438'); R(0, WALL_H - 9, pw, 1, '#b07a48'); R(0, WALL_H - 1, pw, 1, '#6e4426');
  }
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, WALL_H, pw, 4);
  // windows (stained glass in shrines), a painting, torches
  const win = ROOM_ART[kind === 'shrine' ? 'window_stained' : 'window'];
  for (const x of room.windows) {
    if (win) g.drawImage(win.img, Math.round(x - win.w / 2), 7, win.w, win.h);
    else { R(x - 9, 8, 18, 16, '#6e4426'); R(x - 7, 10, 14, 12, '#8fd3ff'); }
  }
  if (room.painting) {
    const pnt = SPR[`painting_${room.painting.n}`];
    if (pnt) g.drawImage(pnt.frames[0], room.painting.x, 7, pnt.w, pnt.h);
  }
  const torch = ROOM_ART.torch;
  for (const x of room.torches) {
    if (torch) g.drawImage(torch.img, Math.round(x - torch.w / 2), 8, torch.w, torch.h);
    else { R(x - 3, 12, 6, 14, '#5e5a70'); R(x - 1, 8, 2, 4, '#ffe07a'); }
  }
  // cobwebs in the top corners
  const web = SPR.cobweb;
  if (web) for (const side of room.webs) {
    g.save();
    if (side) { g.translate(pw - 6, 4); g.scale(-1, 1); } else g.translate(6, 4);
    g.globalAlpha = 0.8; g.drawImage(web.frames[0], 0, 0, web.w * 0.8, web.h * 0.8);
    g.restore();
  }
  // a cellar is damp and dim
  if (kind === 'basement') { g.fillStyle = 'rgba(20,14,30,0.35)'; g.fillRect(0, 0, pw, ph); }
  // stable stalls: low plank walls out from the back wall
  for (const x of room.stalls) {
    R(x - 2, WALL_H - 8, 4, 44, '#7a4a2a'); R(x - 2, WALL_H - 8, 1, 44, '#a8703e'); R(x + 1, WALL_H - 8, 1, 44, '#4a2a1a');
    R(x - 3, WALL_H + 32, 6, 5, '#5a3820'); R(x - 3, WALL_H + 32, 6, 1, '#8a5a32');
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + 2, WALL_H, 3, 36);
  }
  // the inner wall of a side room
  if (room.part) {
    const { x, gapY } = room.part;
    const col = (y0, y1) => { R(x - 3, y0, 6, y1 - y0, '#5a3820'); R(x - 3, y0, 2, y1 - y0, '#8a5a32'); R(x + 2, y0, 1, y1 - y0, '#3a2014'); };
    col(0, gapY); col(gapY + GAP_H, ph - 10);
    R(x - 4, gapY - 3, 8, 3, '#3a2014'); // the wall's end, seen from above
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x + 3, WALL_H, 4, gapY - WALL_H); g.fillRect(x + 3, gapY + GAP_H, 4, ph - 10 - gapY - GAP_H);
  }
  // side and front walls
  R(0, 0, 6, ph, '#4a2a1a'); R(6, WALL_H, 2, ph - WALL_H, '#6e4426');
  R(pw - 6, 0, 6, ph, '#4a2a1a'); R(pw - 8, WALL_H, 2, ph - WALL_H, '#3a2014');
  R(0, ph - 10, pw, 10, '#4a2a1a'); R(0, ph - 10, pw, 2, '#6e4426');
  // doorway with daylight (a cellar has none)
  if (doorX != null) {
    R(doorX - 14, ph - 10, 28, 10, '#ffe8a8'); R(doorX - 14, ph - 10, 28, 3, '#fff6d0');
    R(doorX - 12, ph - 18, 24, 8, '#c8453a'); R(doorX - 10, ph - 16, 20, 4, '#e0583e');
  }
  return cv;
}

// ---------------------------------------------------------------- the town's buildings
// Each building in town has a room laid out by hand, with its keeper standing in it (talk to them
// to use the building). items: [sprite, x, foot y, options]; npc: where the keeper stands.
const BACK = WALL_H + 6; // the foot of anything standing against the back wall
const TOWN_ROOMS = {
  hatchery: {
    w: 13, h: 10, floor: 'floor_wood', wall: 'wall_wood', who: 'wren', npc: [104, 84], windows: [64, 150],
    rugs: [['rug_g', 104, 112]],
    items: [['fireplace', 36, BACK + 2], ['tp_incubator', 104, BACK + 4], ['plant', 178, BACK], ['chair', 64, 60, { solidH: 6 }],
      ['tp_nest', 58, 104, { solidH: 8 }], ['tp_nest', 154, 98, { solidH: 8 }], ['tp_nest', 166, 128, { solidH: 8 }], ['hay', 184, 72], ['hay', 30, 132]],
  },
  training: {
    w: 14, h: 10, floor: 'floor_wood', wall: 'wall_wood', who: 'hale', npc: [112, 82], windows: [80, 146],
    items: [['tp_rack', 34, BACK], ['tp_bench', 112, BACK + 4], ['tp_rack', 190, BACK], ['town_dummy', 54, 104], ['town_dummy', 170, 104],
      ['tp_bag', 30, 136], ['town_dummy', 196, 136], ['barrel', 74, BACK + 6], ['crate', 152, BACK + 6]],
  },
  workshop: {
    w: 14, h: 10, floor: 'floor_stone', wall: 'wall_stone', who: 'tamsin', npc: [130, 86], windows: [112],
    items: [['tp_forge', 50, BACK + 4], ['tp_workbench', 162, BACK + 2], ['tp_rack', 202, BACK], ['tp_anvil', 100, 90],
      ['node_iron', 30, 124], ['node_wood', 196, 128], ['barrel', 24, 80], ['crate', 190, 96]],
  },
  shrine: {
    w: 13, h: 10, kind: 'shrine', floor: 'floor_stone', wall: 'shrine_brick', who: 'sol', npc: [104, 96], windows: [66, 142], torches: [22, 186],
    rugs: [['rug_b', 104, 122]],
    items: [['altar', 104, BACK - 2], ['candles', 72, BACK + 6, { solidH: 6 }], ['candles', 136, BACK + 6, { solidH: 6 }], ['tp_offering', 104, 76, { solidH: 8 }],
      ['tp_lantern', 32, 70], ['tp_lantern', 176, 70], ['pillar', 38, 128], ['pillar', 170, 128]],
  },
  clinic: {
    w: 13, h: 10, floor: 'floor_wood', wall: 'plaster', who: 'poppy', npc: [150, 76], windows: [110],
    rugs: [['rug_r', 60, 104]],
    items: [['bed_r', 30, 64, { solidH: 28 }], ['bed_b', 56, 64, { solidH: 28 }], ['bed_g', 82, 64, { solidH: 28 }], ['tp_medshelf', 150, BACK], ['tp_herbs', 186, BACK],
      ['tp_bench', 158, 128, { solidH: 8 }], ['plant', 22, 134], ['plant', 190, 104], ['pot', 120, 50]],
  },
  survidex: {
    w: 14, h: 10, floor: 'floor_wood', wall: 'wall_wood', who: 'quill', npc: [112, 82], windows: [],
    rugs: [['rug_b', 112, 124]], painting: { n: 1, x: 140 },
    items: [['bookshelf', 26, BACK], ['bookshelf', 52, BACK], ['tp_case', 112, BACK + 2], ['clock', 82, BACK], ['bookshelf', 172, BACK], ['bookshelf', 198, BACK],
      ['tp_desk', 112, 100, { solidH: 10 }], ['plant', 22, 132], ['plant', 202, 132]],
  },
  watchtower: {
    w: 12, h: 9, floor: 'floor_wood', wall: 'wall_stone', who: 'marlo', npc: [96, 76], windows: [46, 146],
    rugs: [['rug_b', 96, 108]],
    items: [['tp_desk', 96, 92, { solidH: 10 }], ['bookshelf', 24, BACK], ['clock', 70, BACK], ['tp_lantern', 124, BACK + 4], ['bookshelf', 170, BACK],
      ['barrel', 20, 120], ['crate', 174, 122], ['plant', 18, 96], ['plant', 176, 96]],
  },
  hall: {
    w: 14, h: 10, floor: 'floor_stone', wall: 'wall_stone', who: 'brann', npc: [112, 80], windows: [62, 162],
    rugs: [['rug_r', 112, 116]], painting: { n: 0, x: 104 },
    items: [['tp_case', 30, BACK + 2], ['tp_case', 194, BACK + 2], ['tp_lantern', 82, BACK + 4], ['tp_lantern', 142, BACK + 4],
      ['statue_emberpup', 46, 100, { solidH: 8 }], ['statue_leafkit_l', 178, 100, { solidH: 8 }],
      ['statue_puddlit', 46, 138, { solidH: 8 }], ['statue_voltowl_l', 178, 138, { solidH: 8 }],
      ['plant', 18, 134], ['plant', 206, 134]],
  },
  ranch: {
    w: 14, h: 10, kind: 'barn', floor: 'floor_barn', wall: 'barn_red', who: 'dell', npc: [112, 86], windows: [60, 164],
    items: [['hay', 28, BACK + 4], ['hay', 50, BACK + 6], ['tp_trough', 100, BACK + 6], ['tp_saddle', 150, BACK + 4], ['hay', 194, BACK + 4],
      ['barrel', 206, 84], ['crate', 22, 100], ['hay', 36, 134], ['barrel', 196, 132]],
  },
};
export const TOWN_ROOM_IDS = Object.keys(TOWN_ROOMS);

export function buildTownRoom(id) {
  const spec = TOWN_ROOMS[id];
  if (!spec) return null;
  const pw = spec.w * T, ph = spec.h * T, dx = Math.floor(pw / 2);
  const room = {
    kind: spec.kind || 'cottage', theme: 'town', pw, ph, doorX: dx, walls: [], furniture: [], containers: [], spawn: { x: dx, y: ph - 20 },
    windows: spec.windows || [], rugs: (spec.rugs || []).map(([name, x, y]) => ({ name, x, y })), torches: spec.torches || [], webs: [], stalls: [],
    part: null, hatch: null, painting: spec.painting || null, floor: spec.floor, wall: spec.wall, npcs: [], canvas: null,
  };
  room.walls.push(
    { x: 0, y: 0, w: pw, h: WALL_H + 4 }, { x: 0, y: 0, w: 8, h: ph }, { x: pw - 8, y: 0, w: 8, h: ph },
    { x: 0, y: ph - 10, w: dx - DOOR_W / 2, h: 10 }, { x: dx + DOOR_W / 2, y: ph - 10, w: pw - dx - DOOR_W / 2, h: 10 },
  );
  const solids = [];
  for (const [spr, fx, fy, o = {}] of spec.items) {
    const s = SPR[spr];
    if (!s) continue;
    const x = Math.round(fx - s.w / 2), y = Math.round(fy - s.h), base = Math.min(s.h, o.solidH ?? 12);
    const item = { spr, x, y, w: s.w, h: s.h, solid: { x: x + 1, y: y + s.h - base, w: s.w - 2, h: base } };
    room.furniture.push(item);
    solids.push(item.solid);
  }
  const [nx, ny] = spec.npc;
  room.npcs.push({ id: spec.who, x: nx, y: ny, dir: 'south', seed: nx * 0.37 });
  solids.push({ x: nx - 7, y: ny - 6, w: 14, h: 8 });
  room.solids = [...room.walls, ...solids];
  room.canvas = paintRoom(room, mulberry32(id.length * 977 + 5));
  return room;
}
