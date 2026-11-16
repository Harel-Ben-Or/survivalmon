// House interiors, made new for every house. Each one rolls its own size, where its door is, its
// floor and walls, sometimes an inner wall that splits off a side room, and a theme that picks the
// furniture and where it stands: home, bedroom, library, kitchen or storeroom for cottages;
// hayloft, stable or storehouse for barns; altar hall or crypt for shrines. Everything you can
// search is checked to be reachable from the door.
// Now and then a trapdoor in the floor leads down to a basement full of gold (buildBasement).
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
  const solids = [], clear = [];
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
  const chest = (x0, x1, tier) => scatter(`chest_${tier}`, x0, x1, { container: true, type: 'chest', tier }, 40);
  const tableSet = (x0, x1) => {
    for (let i = 0; i < 20; i++) {
      const t = scatter('table', x0 + 14, x1 - 14, { solidH: 12 }, 1, WALL_H + 22, ph - 30);
      if (!t) continue;
      place('chair', t.x - 13, t.y + 4, { solidH: 6, tight: true });
      place('chair', t.x + t.w + 1, t.y + 4, { solidH: 6, tight: true });
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
  return { room, place, scatter, backWall, storage, sideWall, chest, tableSet, finish, solids, clear, ri };
}

export function buildInterior(house, seed) {
  const rng = mulberry32(seed);
  const pick = (a, b) => Math.floor(a + rng() * (b - a + 1));
  const kind = house.kind, [w0, w1, h0, h1] = SIZE[kind];
  const tw = pick(w0, w1), th = pick(h0, h1);
  const theme = THEMES[kind][pick(0, THEMES[kind].length - 1)];
  const pw = tw * T, ph = th * T;
  const R = makeRoom(kind, theme, pw, ph, rng);
  const { room, place, scatter, backWall, storage, sideWall, chest, tableSet, clear, solids, ri } = R;
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
  clear.push({ x: dx - 18, y: ph - 48, w: 36, h: 48 });

  // now and then, a trapdoor down to a basement: laid first so nothing stands on it
  if (rng() < BASEMENT_CHANCE[kind]) {
    const [x0, x1] = side && rng() < 0.5 ? side : main;
    const item = scatter('trapdoor', x0, x1, { flat: true }, 40, WALL_H + 10, ph - 30);
    if (item) room.hatch = { item, cx: item.x + item.w / 2, cy: item.y + item.h / 2 };
  }

  const [m0, m1] = main;
  const tier = () => (rng() < 0.08 ? 'gold' : rng() < 0.3 ? 'silver' : 'wood');
  const C = (type, extra = {}) => ({ container: true, type, ...extra });
  if (kind === 'cottage') {
    const bed = () => ['bed_r', 'bed_b', 'bed_g'][ri(0, 2)];
    const heat = rng() < 0.5 ? 'fireplace' : 'stove';
    if (theme === 'home') {
      backWall(shuffle([[bed(), { wall: false, solidH: 30 }], ['bookshelf', C('bookshelf')], [heat, {}], ['cupboard', C('cupboard')], ['clock', {}], ['plant', {}]], rng), m0, m1);
      tableSet(m0, m1);
      storage(m0, m1, ri(1, 3));
      if (rng() < 0.6) scatter('plant', m0, m1);
    } else if (theme === 'bedroom') {
      backWall(shuffle([[bed(), { wall: false, solidH: 30 }], [bed(), { wall: false, solidH: 30 }], ['cupboard', C('cupboard')], ['clock', {}], ['plant', {}]], rng), m0, m1);
      if (rng() < 0.5) scatter(bed(), m0, m1, { solidH: 30 });
      storage(m0, m1, ri(1, 2), ['pot', 'crate']);
    } else if (theme === 'library') {
      backWall(shuffle([['bookshelf', C('bookshelf')], ['bookshelf', C('bookshelf')], ['bookshelf', C('bookshelf')], ['bookshelf', C('bookshelf')], ['clock', {}], ['plant', {}]], rng), m0, m1);
      tableSet(m0, m1);
      for (let i = ri(0, 2); i > 0; i--) scatter('plant', m0, m1);
      if (rng() < 0.5) scatter('bookshelf', m0, m1, C('bookshelf'));
    } else if (theme === 'kitchen') {
      backWall(shuffle([['stove', {}], ['cupboard', C('cupboard')], ['cupboard', C('cupboard')], [heat === 'stove' ? 'fireplace' : 'stove', {}], ['wine_rack', {}], ['plant', {}]], rng), m0, m1);
      tableSet(m0, m1);
      storage(m0, m1, ri(2, 4), ['barrel', 'pot', 'pot', 'crate']);
      storage(m0, m1, ri(1, 3), ['barrel', 'crate']);
    } else {
      // storeroom: mostly things to search
      backWall(shuffle([['cupboard', C('cupboard')], ['bookshelf', C('bookshelf')], ['cupboard', C('cupboard')], ['wine_rack', {}]], rng), m0, m1);
      if (rng() < 0.5) scatter('barrel_side', m0, m1, { solidH: 10 });
      for (let i = 0; i < 3; i++) storage(m0, m1, ri(2, 4));
      for (let i = ri(1, 3); i > 0; i--) { const k = ['barrel', 'crate'][ri(0, 1)]; scatter(k, m0, m1, C(k)); }
    }
    // clutter: more to search along a side wall, and a pot plant or two
    if (rng() < 0.75) sideWall(m0, m1, theme === 'library' ? ['pot', 'crate'] : ['barrel', 'crate', 'pot', 'barrel'], ri(2, 3));
    storage(m0, m1, ri(1, 2));
    if (rng() < 0.5) scatter('plant', m0, m1);
    chest(m0, m1, tier());
    if (theme === 'storeroom' && rng() < 0.5) chest(m0, m1, 'wood');
    if (side) {
      // the side room: a little bedroom or a store
      const [s0, s1] = side;
      if (rng() < 0.5) {
        place(bed(), s0 + ri(2, 8), WALL_H - 6, { solidH: 30 });
        scatter('cupboard', s0, s1, C('cupboard'), 10, WALL_H - 14, WALL_H + 20);
        if (rng() < 0.5) scatter('plant', s0, s1);
      } else {
        storage(s0, s1, ri(2, 4));
        storage(s0, s1, ri(1, 3));
      }
      if (rng() < 0.5) chest(s0, s1, tier());
    }
    // rugs and the wall decoration
    const rugs = ['rug_r', 'rug_b', 'rug_g'];
    for (let i = ri(1, 2); i > 0; i--) room.rugs.push({ name: rugs[ri(0, 2)], x: ri(m0 + 30, m1 - 30), y: ri(WALL_H + 24, ph - 34) });
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
    place('altar', ax, WALL_H - 6, { solidH: 14, ...C('altar', { tier: 'gold' }) });
    if (theme === 'crypt') {
      for (const x of [ri(20, 40), pw - ri(36, 56)]) for (const y of [WALL_H + 26, ph - 46]) if (rng() < 0.7) place('pillar', x, y, { solidH: 12 });
      room.webs.push(0, 1);
    }
    for (let i = ri(2, 4); i > 0; i--) scatter('pot', 8, pw - 8, C('pot'));
    for (let i = ri(1, 3); i > 0; i--) scatter(rng() < 0.5 ? 'candles' : 'plant', 8, pw - 8, { solidH: 6 });
    chest(8, pw - 8, rng() < 0.2 ? 'gold' : 'silver');
    if (theme === 'altar') room.rugs.push({ name: 'rug_b', x: Math.floor(pw / 2), y: Math.floor(ph / 2) + 6 });
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
  const { room, place, scatter, clear, ri } = R;
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
  for (let i = ri(1, 2); i > 0; i--) scatter('barrel_side', 8, pw - 8, { solidH: 10 });
  if (rng() < 0.6) scatter('wine_rack', 8, pw - 8, { wall: true }, 12, WALL_H + 8 - (SPR.wine_rack?.h || 26), WALL_H + 8);
  for (let i = ri(2, 3); i > 0; i--) scatter('candles', 8, pw - 8, { solidH: 6 });
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
