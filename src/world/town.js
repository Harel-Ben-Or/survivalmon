// The town hub: the Village Square map (no combat), its collision and doors, plus the Game
// methods for walking it. Buildings that aren't built yet show "opens later".
import { Input } from '../core/input.js';
import { Audio } from '../core/audio.js';
import { SPR, PC } from '../gfx/assets.js';
import { CREATURE, ICON_ART, creatureMotion, drawCreature, snap } from '../gfx/art.js';
import { UNLOCK_TEXT } from '../content/buildings.js';
import { Shrine } from '../systems/shrine.js';
import { TileGround } from './tileground.js';
import { T, TILE } from './world.js';
import { mulberry32, rand, dist2, TAU } from '../core/util.js';
import { Player } from '../entities/player.js';
import { Pet } from '../entities/pet.js';
import { Box } from '../systems/collection.js';
import { Meta } from '../systems/meta.js';

// door = the tile the building's door opens onto; always = open from the start, others unlock
const BUILDINGS = [
  { id: 'gate', name: 'Enter the Wild', spr: 'town_gate', door: [23, 7], always: true },
  { id: 'training', name: 'Training Hall', spr: 'town_training', door: [12, 9], always: true },
  { id: 'workshop', name: 'Workshop', spr: 'town_workshop', door: [34, 9] },
  { id: 'clinic', name: 'Clinic', spr: 'town_clinic', door: [8, 18] },
  { id: 'survidex', name: 'Survidex', spr: 'town_library', door: [38, 18] },
  { id: 'hatchery', name: 'Hatchery', spr: 'town_hatchery', door: [13, 27], always: true },
  { id: 'shrine', name: 'Spirit Shrine', spr: 'shrine', door: [5, 9] },
  { id: 'merchant', name: 'Merchant', spr: 'town_merchant', door: [32, 15] },
];
const RANCH_MAX = 16; // survivalmons shown roaming the pasture

export class Town {
  constructor() {
    this.w = 46; this.h = 33;
    this.pw = this.w * TILE; this.ph = this.h * TILE;
    this.tiles = new Uint8Array(this.w * this.h);
    this.baked = []; this.bakedTall = []; this.shadows = [];
    this.objects = []; this.solids = []; this.doors = []; this.ranch = [];
    this.rng = mulberry32(11);
    this.build();
  }
  r() { return this.rng(); }
  tileAt(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.tiles[y * this.w + x] : T.DARK; }
  set(x, y, t) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.tiles[y * this.w + x] = t; }
  rect(t, x0, y0, x1, y1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, t); }
  disc(t, cx, cy, r) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if (Math.hypot(x - cx, y - cy) <= r) this.set(x, y, t);
  }
  solid(x, y, w, h) { this.solids.push({ x, y, w, h }); }
  // A prop standing on (x, y) with a small footprint at its base
  prop(spr, x, y, fw = 10, fh = 5, fade = false) {
    if (!SPR[spr]) return;
    this.objects.push({ spr, x, y, sortY: y, fade });
    if (fw) this.solid(x - fw / 2, y - fh, fw, fh);
  }
  tree(spr, x, y) { this.prop(spr, x, y, 10, 5, true); this.shadows.push({ x, y: y - 1, rx: 11, ry: 4 }); }

  building(b) {
    const s = SPR[b.spr], x = b.door[0] * TILE + 8, y = b.door[1] * TILE + 4;
    this.objects.push({ spr: b.spr, x, y, sortY: y, fade: true });
    this.shadows.push({ x, y: y - 2, rx: s.w * 0.42, ry: 5 });
    if (b.id === 'gate') {
      // only the two posts block; past the arch the road runs into the forest
      this.solid(x - s.w / 2 + 2, y - 12, 18, 10);
      this.solid(x + s.w / 2 - 20, y - 12, 18, 10);
      this.solid(x - s.w / 2, 0, s.w, y - 30);
      this.doors.push({ ...b, x, y: y - 16, py: y - s.h + 6 });
      return;
    }
    // walls: the lower half of the sprite; the roof above it can hide the hero walking behind
    this.solid(x - s.w * 0.42, y - s.h * 0.5, s.w * 0.84, s.h * 0.5 - 5);
    this.doors.push({ ...b, x, y: y + 4, py: y - 30 });
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
  // Thick forest on every edge; the gap at the gate is left open.
  forest() {
    const kinds = ['tree_dark_0', 'tree_dark_1', 'tree_green_0', 'tree_green_1', 'pine_0', 'pine_1', 'tree_dark_2'];
    const gateGap = (side, t) => side === 'n' && t >= 20 && t <= 25;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const e = Math.min(x, y, this.w - 1 - x, this.h - 1 - y);
      const side = y <= 1 ? 'n' : y >= this.h - 2 ? 's' : x <= 1 ? 'w' : 'e';
      if (e <= 1 && !gateGap(side, side === 'n' || side === 's' ? x : y)) this.set(x, y, T.DARK);
    }
    for (let y = -1; y <= this.h + 1; y += 1.15) for (let x = -1; x <= this.w + 1; x += 1.4) {
      const e = Math.min(x, y, this.w - 1 - x, this.h - 1 - y);
      if (e > 1.2) continue;
      const side = y <= 1.2 ? 'n' : y >= this.h - 2.2 ? 's' : x <= 1.2 ? 'w' : 'e';
      const t = Math.round(side === 'n' || side === 's' ? x : y);
      if (gateGap(side, t) || gateGap(side, t - 1) || gateGap(side, t + 1)) continue;
      const jx = (x + (this.r() - 0.5) * 0.6) * TILE + 8, jy = (y + (this.r() - 0.5) * 0.4) * TILE + 14;
      this.objects.push({ spr: kinds[Math.floor(this.r() * kinds.length)], x: jx, y: jy, sortY: jy });
    }
    const band = 2 * TILE + 6;
    this.solid(0, 0, 20 * TILE, band); this.solid(26 * TILE, 0, this.pw - 26 * TILE, band);
    this.solid(0, 0, band, this.ph); this.solid(this.pw - band, 0, band, this.ph);
    this.solid(0, this.ph - band - 4, this.pw, band + 4);
  }
  flowers(n, x0, y0, x1, y1) {
    const names = ['flower_r', 'flower_w', 'flower_y', 'flower_p', 'flower_b', 'tuft', 'tuft', 'tuft_d'];
    for (let i = 0; i < n; i++) {
      const tx = x0 + Math.floor(this.r() * (x1 - x0 + 1)), ty = y0 + Math.floor(this.r() * (y1 - y0 + 1));
      if (this.tileAt(tx, ty) !== T.GRASS) continue;
      const name = names[Math.floor(this.r() * names.length)];
      this.baked.push({ name, pc: PC[name], x: tx * TILE + Math.floor(this.r() * 10), y: ty * TILE + Math.floor(this.r() * 10) });
    }
  }

  build() {
    const at = (tx, ty, dy = 14) => [tx * TILE + 8, ty * TILE + dy];
    this.disc(T.STONE, 23, 16, 4.7);
    this.rect(T.DIRT, 22, 0, 23, 12);                                     // north road through the gate
    this.rect(T.DIRT, 11, 9, 12, 11); this.rect(T.DIRT, 11, 10, 20, 11);  // training hall
    this.rect(T.DIRT, 4, 9, 5, 11); this.rect(T.DIRT, 4, 10, 11, 11);    // spirit shrine
    this.rect(T.DIRT, 33, 9, 34, 11); this.rect(T.DIRT, 26, 10, 34, 11);  // workshop
    this.rect(T.DIRT, 7, 18, 19, 19);                                     // clinic
    this.rect(T.DIRT, 27, 18, 38, 19);                                    // survidex
    this.rect(T.DIRT, 27, 15, 32, 16);                                    // merchant
    this.rect(T.DIRT, 22, 20, 23, 29); this.rect(T.DIRT, 12, 28, 23, 29); this.rect(T.DIRT, 12, 27, 13, 28); // hatchery
    this.rect(T.DIRT, 24, 24, 28, 25);                                    // ranch gate
    this.forest();
    this.flowers(170, 2, 2, 43, 30);
    const [wx, wy] = at(23, 16); this.prop('well', wx, wy, 26, 9);
    for (const [x, y] of [[19, 12], [28, 12], [18, 20], [29, 20]]) { const [px, py] = at(x, y); this.prop('lamp', px, py, 6, 4); }
    for (const b of BUILDINGS) if (SPR[b.spr]) this.building(b);
    this.prop('town_dummy', 17 * TILE, 8 * TILE + 12, 10, 5);
    this.prop('town_dummy', 18 * TILE + 8, 9 * TILE + 6, 10, 5);
    for (const [s, x, y] of [['crate', 38, 9], ['barrel', 39, 10], ['crate', 39, 8]]) { const [px, py] = at(x, y); this.prop(s, px, py, 12, 6); }
    // Ranch: the pasture where every survivalmon you own roams
    this.fenceRect(28, 21, 42, 28, [[28, 24], [28, 25]]);
    this.pasture = { x0: 29 * TILE + 4, y0: 22 * TILE + 8, x1: 42 * TILE - 4, y1: 28 * TILE + 2 };
    this.prop('sign', 27 * TILE + 4, 23 * TILE + 14, 8, 4);
    this.doors.push({ id: 'ranch', name: 'Ranch', always: true, x: 28 * TILE, y: 25 * TILE, py: 23 * TILE });
    this.nests = [[16, 27.6], [17.2, 28], [18.4, 27.6]].map(([x, y]) => ({ x: x * TILE, y: y * TILE }));
    this.prop('hay', 40 * TILE + 8, 22 * TILE + 14, 16, 6); this.prop('hay', 41 * TILE, 26 * TILE + 14, 16, 6);
    for (const [s, x, y] of [['tree_autumn_0', 41, 5], ['tree_pink_1', 4, 26], ['tree_green_1', 20, 30.4]]) { const [px, py] = at(x, y); this.tree(s, px, py); }
    this.spawn = { x: 23 * TILE + 8, y: 21 * TILE };
    this.gateSpawn = { x: 23 * TILE + 8, y: 9 * TILE + 4 };
  }

  // Survivalmons that aren't in the team wander the pasture.
  fillRanch(mons) {
    const R = this.pasture;
    this.ranch = mons.slice(0, RANCH_MAX).map((m) => ({
      species: m.species, x: rand(R.x0, R.x1), y: rand(R.y0, R.y1), tx: rand(R.x0, R.x1), ty: rand(R.y0, R.y1),
      wait: rand(0, 3), left: Math.random() < 0.5, seed: rand(0, 10), moving: false,
    }));
  }
  updateRanch(dt) {
    const R = this.pasture;
    for (const m of this.ranch) {
      if (m.wait > 0) { m.wait -= dt; m.moving = false; continue; }
      const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy);
      if (d < 2) { m.wait = rand(1.5, 5); m.tx = rand(R.x0, R.x1); m.ty = rand(R.y0, R.y1); m.moving = false; continue; }
      m.x += (dx / d) * 18 * dt; m.y += (dy / d) * 18 * dt;
      m.moving = true;
      if (Math.abs(dx) > 1) m.left = dx < 0;
    }
  }
}

// ---------------------------------------------------------------- Game methods for town mode
export const TownMode = {
  toTown(fromRun = false) {
    if (!this.town) {
      this.town = new Town();
      const tg = this.tileGround;
      this.townGround = tg ? new TileGround(tg.cfg, tg.sheets, tg.grass) : null;
      this.townGround?.attach(this.town);
    }
    Audio.stopMusic();
    this.resetRunState();
    this.mode = 'town'; this.modal = null; this.boss = null;
    const P = this.player = new Player(this, Meta.hero);
    const at = fromRun ? this.town.gateSpawn : this.town.spawn;
    P.x = at.x; P.y = at.y; P.dir = 'down'; P.faceAngle = Math.PI / 2;
    for (const mon of Box.team()) P.pets.push(new Pet(this, mon));
    P.pets.forEach((pet, i) => { pet.x = P.x + (i % 2 ? -1 : 1) * 18 * (1 + (i >> 1)); pet.y = P.y + 6; });
    this.town.fillRanch(Box.mons.filter((m) => !Box.inTeam(m.id)));
    this.snapCamera();
    this.ui.showTown();
    this.townArrival();
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
    const heroUnlocks = { bram: Meta.data.bestTime >= 120, lyra: Box.linesCaught() >= 3, pip: Object.keys(Box.data.discovered).length > 0 };
    for (const [h, ok] of Object.entries(heroUnlocks)) if (ok && Meta.unlockHero(h)) notes.push(`New hero: ${h[0].toUpperCase() + h.slice(1)}! Pick them at Enter the Wild.`);
    const show = () => { for (const n of notes) this.toast(n); this.ui.showTown(); };
    if (hatched.length) {
      this.town.fillRanch(Box.mons.filter((m) => !Box.inTeam(m.id)));
      const P = this.player;
      for (const mon of hatched) if (Box.inTeam(mon.id) && !P.pets.some((p) => p.mon === mon)) { const pet = new Pet(this, mon); pet.x = P.x; pet.y = P.y + 8; P.pets.push(pet); }
      this.ui.showHatched(hatched, show);
    } else show();
  },

  updateTown(dt) {
    const P = this.player, town = this.town;
    P.update(dt, town.solids);
    P.pets.forEach((p, i) => p.update(dt, i, true));
    town.updateRanch(dt);
    this.particles.update(dt);
    this.followCamera(dt);
    let near = null, bd = 22 * 22;
    for (const d of town.doors) {
      const dd = dist2(P.x, P.y, d.x, d.y);
      if (dd < bd) { bd = dd; near = d; }
    }
    if (near) {
      near.open = near.always || Meta.isUnlocked(near.id);
      this.ui.prompt(near.open ? near.name : `${near.name} · closed`, near.x, near.py);
      if (Input.wasPressed('KeyE') || Input.wasPressed('Enter')) this.enterBuilding(near);
    } else this.ui.prompt(null);
  },

  enterBuilding(d) {
    if (!d.open) { this.toast(`${d.name}: ${UNLOCK_TEXT[d.id] || 'opens later'}.`); return; }
    this.ui.prompt(null);
    Audio.play('door');
    const screens = { gate: 'showTeam', training: 'showTraining', ranch: 'showRanch', hatchery: 'showHatchery', clinic: 'showClinic', survidex: 'showSurvidex', shrine: 'showShrine', workshop: 'showWorkshop', merchant: 'showMerchant' };
    this.ui[screens[d.id]]?.();
  },

  renderTown() {
    const ctx = this.ctx, V = this.view, town = this.town, P = this.player;
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
    Box.eggs.forEach((e, i) => { const n = town.nests[i]; if (n) list.push({ y: n.y, egg: e, n }); });
    for (const p of P.pets) list.push({ y: p.y, pet: p });
    list.push({ y: P.y, hero: P });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.o) {
        // see the hero through a roof or tree he walks behind
        const behind = it.o.fade && P.y < it.o.sortY - 1 && P.y > it.top + 6 && P.x > it.left + 3 && P.x < it.left + it.s.w - 3;
        ctx.globalAlpha = behind ? 0.55 : 1;
        ctx.drawImage(it.s.frames[0], snap(it.left - cam.x), snap(it.top - cam.y), it.s.w, it.s.h);
        ctx.globalAlpha = 1;
      } else if (it.m) {
        const m = it.m, a = CREATURE[m.species];
        if (!a) continue;
        const x = snap(m.x) - cam.x, y = snap(m.y) - cam.y;
        ctx.globalAlpha = 0.28; ctx.fillStyle = '#1a2a10';
        ctx.beginPath(); ctx.ellipse(x, y, Math.max(5, a.cw * 0.34), Math.max(2, a.cw * 0.12), 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
        drawCreature(ctx, a, x, y, { left: m.left, ...creatureMotion(a.motion, this.realTime, m.moving, m.seed, !!a.anim), anim: a.motion === 'fly' || m.moving ? 'move' : 'idle', at: this.realTime + m.seed });
      } else if (it.egg) {
        const art = ICON_ART.egg, x = snap(it.n.x - cam.x), y = snap(it.n.y - cam.y);
        const wob = it.egg.progress >= it.egg.need ? Math.sin(this.realTime * 12) * 0.6 : 0;
        if (art) ctx.drawImage(art.img, x - art.w / 2 + wob, y - art.h, art.w, art.h);
        ctx.fillStyle = '#2b1d24'; ctx.fillRect(x - 6, y + 1, 12, 3);
        ctx.fillStyle = '#ffd84a'; ctx.fillRect(x - 5, y + 2, Math.round(10 * it.egg.progress / it.egg.need), 1);
      } else if (it.pet) it.pet.draw(ctx, cam);
      else it.hero.draw(ctx, cam);
    }
    this.particles.draw(ctx, cam);
  },
};
