// House interiors: a single room with furniture and searchable containers.
import { mulberry32, shuffle } from '../core/util.js';
import { SPR, PC } from '../gfx/assets.js';
import { ROOM_ART, WS } from '../gfx/art.js';

const SIZES = { cottage: [13, 10], barn: [18, 11], shrine: [11, 9] };
export const WALL_H = 40;

function rectsOverlap(a, b, m = 3) {
  return a.x < b.x + b.w + m && a.x + a.w + m > b.x && a.y < b.y + b.h + m && a.y + a.h + m > b.y;
}

export function buildInterior(house, seed) {
  const rng = mulberry32(seed);
  const ri = (a, b) => Math.floor(a + rng() * (b - a + 1));
  const [tw, th] = SIZES[house.kind];
  const pw = tw * 16, ph = th * 16;
  const doorX = Math.floor(pw / 2);
  const room = {
    kind: house.kind, pw, ph, doorX,
    walls: [
      { x: 0, y: 0, w: pw, h: WALL_H + 4 },
      { x: 0, y: 0, w: 8, h: ph }, { x: pw - 8, y: 0, w: 8, h: ph },
      { x: 0, y: ph - 10, w: doorX - 14, h: 10 }, { x: doorX + 14, y: ph - 10, w: pw - doorX - 14, h: 10 },
    ],
    furniture: [],   // { spr, x, y(top), w, h, solid:{x,y,w,h} }
    containers: [],  // furniture with loot
    spawn: { x: doorX, y: ph - 20 },
    canvas: null,
  };
  const solids = [];
  const corridor = { x: doorX - 20, y: ph - 48, w: 40, h: 48 };
  const place = (spr, x, y, opts = {}) => {
    const s = SPR[spr];
    const item = { spr, x: Math.round(x), y: Math.round(y), w: s.w, h: s.h, ...opts };
    const base = opts.solidH ?? Math.min(s.h, 14);
    item.solid = { x: item.x + 1, y: item.y + s.h - base, w: s.w - 2, h: base };
    if (opts.wall) item.solid = { x: item.x, y: WALL_H, w: s.w, h: item.y + s.h - WALL_H };
    if (item.x < 8 || item.x + s.w > pw - 8 || item.y + s.h > ph - 10) return null;
    if (rectsOverlap(item.solid, corridor, 0)) return null;
    if (solids.some((r) => rectsOverlap(r, item.solid))) return null;
    solids.push(item.solid);
    room.furniture.push(item);
    if (opts.container) room.containers.push(item);
    return item;
  };
  const container = (type, tier = 'wood') => ({ container: true, type, tier, opened: false });

  if (house.kind === 'cottage') {
    // along the back wall
    const bed = ['bed_r', 'bed_b', 'bed_g'][ri(0, 2)];
    const back = shuffle([
      ['bookshelf', { wall: true, ...container('bookshelf') }],
      [rng() < 0.5 ? 'fireplace' : 'stove', { wall: true }],
      ['cupboard', { wall: true, ...container('cupboard') }],
      ['clock', { wall: true }],
      ['plant', { wall: true }],
    ], rng);
    let cx = 12;
    place(bed, cx, 34, { solidH: 30 }); cx += 26;
    for (const [spr, opts] of back) {
      const s = SPR[spr];
      if (cx + s.w > pw - 12) break;
      place(spr, cx, WALL_H + 6 - s.h, opts);
      cx += s.w + ri(2, 8);
    }
    // table & chairs in the middle
    const tx = doorX - 16 + ri(-20, 20), ty = Math.floor(ph / 2) - 10;
    if (place('table', tx, ty, { solidH: 12 })) {
      place('chair', tx - 12, ty + 4, { solidH: 6 });
      place('chair', tx + 32, ty + 4, { solidH: 6 });
    }
    // storage corners
    const corner = (x0, dir) => {
      const n = ri(1, 3);
      for (let i = 0; i < n; i++) {
        const kind = ['barrel', 'crate', 'pot'][ri(0, 2)];
        place(kind, x0 + dir * i * 15, ph - 12 - SPR[kind].h, container(kind));
      }
    };
    corner(10, 1); corner(pw - 26, -1);
    // the chest
    const tier = rng() < 0.08 ? 'gold' : rng() < 0.3 ? 'silver' : 'wood';
    const spots = shuffle([[12, 74], [pw - 30, 74], [pw - 30, 54], [44, 60]], rng);
    for (const [x, y] of spots) if (place(`chest_${tier}`, x, y, container('chest', tier))) break;
  } else if (house.kind === 'barn') {
    let cx = 12;
    while (cx < pw - 30) {
      const r = rng();
      const spr = r < 0.45 ? 'hay' : r < 0.7 ? 'crate' : 'barrel';
      const s = SPR[spr];
      place(spr, cx, WALL_H + 8 - s.h + ri(0, 4), spr === 'hay' ? {} : container(spr));
      cx += s.w + ri(1, 6);
    }
    for (let i = 0; i < 4; i++) {
      const spr = ['hay', 'crate', 'barrel', 'hay'][i];
      const x = i < 2 ? 12 + i * 22 : pw - 34 - (i - 2) * 22;
      place(spr, x, ph - 14 - SPR[spr].h, spr === 'hay' ? {} : container(spr));
    }
    place('chest_silver', 30, Math.floor(ph / 2) - 6, container('chest', 'silver'));
    const t2 = rng() < 0.25 ? 'gold' : 'wood';
    place(`chest_${t2}`, pw - 48, Math.floor(ph / 2) - 6, container('chest', t2));
  } else {
    place('altar', doorX - 14, WALL_H - 6, { solidH: 14, ...container('altar', 'gold') });
    place('pot', 14, WALL_H + 8, container('pot'));
    place('pot', pw - 26, WALL_H + 8, container('pot'));
    place('plant', 14, ph - 32, {});
    place('plant', pw - 28, ph - 32, {});
    place('chest_silver', pw - 34, Math.floor(ph / 2) - 4, container('chest', 'silver'));
  }

  room.solids = [...room.walls, ...solids];
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
  const floorArt = ROOM_ART[kind === 'barn' ? 'floor_barn' : kind === 'shrine' ? 'floor_stone' : 'floor_wood'];
  const wallArt = ROOM_ART[kind === 'barn' ? 'wall_barn' : kind === 'shrine' ? 'wall_stone' : 'wall_wood'];

  // floor
  if (floorArt) tile(floorArt, 0, WALL_H, pw, ph);
  else if (kind === 'shrine') {
    R(0, 0, pw, ph, '#a8a4b4');
    for (let y = WALL_H; y < ph; y += 16) for (let x = 0; x < pw; x += 16) {
      R(x, y, 16, 16, (x + y) % 32 ? '#a8a4b4' : '#b4b0c0');
      R(x, y, 16, 1, '#8a8698'); R(x, y, 1, 16, '#8a8698');
    }
  } else {
    const base = kind === 'barn' ? ['#b8905a', '#b08854'] : ['#c8935a', '#bf8a52'];
    for (let y = WALL_H; y < ph; y += 8) {
      const row = (y - WALL_H) / 8;
      R(0, y, pw, 8, base[row % 2]);
      R(0, y, pw, 1, '#a87a48');
      let x = Math.floor(rng() * 30);
      while (x < pw) { R(x, y, 1, 8, '#9a6a3a'); x += 26 + Math.floor(rng() * 20); }
    }
    if (kind === 'barn') for (let i = 0; i < 160; i++) R(Math.floor(rng() * pw), WALL_H + Math.floor(rng() * (ph - WALL_H)), 2, 1, rng() < 0.5 ? '#e8c35a' : '#d4ac48');
  }
  if (kind === 'shrine' && ROOM_ART.rug_b) {
    const art = ROOM_ART.rug_b;
    g.drawImage(art.img, Math.round(doorX - art.w / 2), Math.round(ph / 2 - art.h / 2 + 6), art.w, art.h);
  }
  // rug
  if (kind === 'cottage') {
    const pick = Math.floor(rng() * 3);
    const art = ROOM_ART[['rug_r', 'rug_b', 'rug_g'][pick]];
    if (art) g.drawImage(art.img, Math.round(doorX - art.w / 2), Math.round(ph / 2 - art.h / 2 + 8), art.w, art.h);
    else { const rug = [PC.rug_r, PC.rug_b, PC.rug_g][pick]; g.drawImage(rug.toCanvas(), doorX - rug.w / 2, Math.floor(ph / 2) - rug.h / 2 + 8); }
  }
  // back wall
  if (wallArt) {
    tile(wallArt, 0, 0, pw, WALL_H);
    if (kind === 'cottage') {
      // timber frame and a wood-panelled lower wall over the plaster
      for (let x = 20; x < pw; x += 44) { R(x, 0, 4, WALL_H, '#6e4426'); R(x, 0, 1, WALL_H, '#8a5a32'); }
      R(0, WALL_H - 12, pw, 12, '#9a6438'); R(0, WALL_H - 12, pw, 1, '#c08a50');
      for (let x = 0; x < pw; x += 10) R(x, WALL_H - 11, 1, 10, '#7a4a2a');
    }
    R(0, 0, pw, 5, '#3a2418');
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, WALL_H - 10, pw, 10);
    R(0, WALL_H - 2, pw, 2, '#4a2a1a');
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, WALL_H, pw, 4);
  } else if (kind === 'shrine') {
    R(0, 0, pw, WALL_H, '#7a768a');
    for (let y = 4; y < WALL_H; y += 8) for (let x = (y / 8) % 2 ? 0 : 8; x < pw; x += 16) { R(x, y, 16, 1, '#5e5a70'); R(x, y, 1, 8, '#5e5a70'); }
    R(0, 0, pw, 4, '#3a364a');
  } else if (kind === 'barn') {
    for (let x = 0; x < pw; x += 6) R(x, 0, 6, WALL_H, x % 12 ? '#a8443a' : '#9a3a32');
    R(0, 0, pw, 4, '#4a2a1a'); R(0, WALL_H - 6, pw, 6, '#7a2a24');
  } else {
    R(0, 0, pw, WALL_H, '#e8d4a8');
    for (let x = 0; x < pw; x += 8) R(x, 5, 2, WALL_H - 13, '#dcc496');
    R(0, 0, pw, 5, '#4a2a1a');
    R(0, WALL_H - 9, pw, 9, '#9a6438'); R(0, WALL_H - 9, pw, 1, '#b07a48'); R(0, WALL_H - 1, pw, 1, '#6e4426');
  }
  // wall details: windows, torches, a painting
  const win = ROOM_ART.window;
  if (kind === 'shrine') {
    const torch = ROOM_ART.torch, glass = ROOM_ART.window_stained;
    for (const x of [24, pw - 30]) {
      if (torch) g.drawImage(torch.img, Math.round(x + 3 - torch.w / 2), 8, torch.w, torch.h);
      else { R(x, 12, 6, 14, '#5e5a70'); R(x + 2, 8, 2, 4, '#ffe07a'); R(x + 2, 6, 2, 2, '#fff6c8'); }
    }
    if (glass) for (const x of [Math.floor(pw * 0.3), Math.floor(pw * 0.7)]) g.drawImage(glass.img, Math.round(x - glass.w / 2), 6, glass.w, glass.h);
  } else {
    const wins = kind === 'barn' ? [50, pw - 50] : [Math.floor(pw * 0.3), Math.floor(pw * 0.7)];
    for (const x of wins) {
      if (win) g.drawImage(win.img, Math.round(x - win.w / 2), 8, win.w, win.h);
      else {
        R(x - 9, 8, 18, 16, '#6e4426'); R(x - 7, 10, 14, 12, '#8fd3ff'); R(x - 7, 10, 14, 5, '#a8e0ff');
        R(x, 10, 1, 12, '#6e4426'); R(x - 7, 15, 14, 1, '#6e4426'); R(x - 6, 11, 2, 1, '#ffffff');
      }
    }
    if (kind === 'cottage') {
      const pnt = SPR[`painting_${Math.floor(rng() * 2)}`];
      g.drawImage(pnt.frames[0], Math.round(pw / 2 - pnt.w / 2), 8, pnt.w, pnt.h);
    }
  }
  // side and front walls
  R(0, 0, 6, ph, '#4a2a1a'); R(6, WALL_H, 2, ph - WALL_H, '#6e4426');
  R(pw - 6, 0, 6, ph, '#4a2a1a'); R(pw - 8, WALL_H, 2, ph - WALL_H, '#3a2014');
  R(0, ph - 10, pw, 10, '#4a2a1a'); R(0, ph - 10, pw, 2, '#6e4426');
  // doorway with daylight
  R(doorX - 14, ph - 10, 28, 10, '#ffe8a8'); R(doorX - 14, ph - 10, 28, 3, '#fff6d0');
  R(doorX - 12, ph - 18, 24, 8, '#c8453a'); R(doorX - 10, ph - 16, 20, 4, '#e0583e');
  return cv;
}
