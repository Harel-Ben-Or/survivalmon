// Tower Defense mode (mode 'td'): a fixed board with a road, waves of the star's creatures walking it,
// and your survivalmons as towers beside it. The towers fight with their own attacks from runs (pet.js
// ARCH, with the same shots, bolts, pools and big moves), plus each basic mon's TD effect (td_data.js).
// Game methods, mixed into Game like TownMode. The HTML parts (top strip, the bar of 5, the end
// screen) are in ui/td_ui.js.
import { Audio } from '../core/audio.js';
import { rand, TAU, dist2 } from '../core/util.js';
import { Enemy } from '../entities/enemy.js';
import { Pet, ARCH } from '../entities/pet.js';
import { CREATURE, drawCreature, snap } from '../gfx/art.js';
import { SPR } from '../gfx/assets.js';
import { TileGround } from '../world/tileground.js';
import { T, TILE } from '../world/world.js';
import { SPECIES, BASE_IDS, breedResult, TYPES } from '../content/species.js';
import { tryFreeze } from '../content/wcore.js';
import { Box } from '../systems/collection.js';
import { Meta } from '../systems/meta.js';
import { Analytics } from '../systems/analytics.js';
import {
  TD_COLS, TD_ROWS, TD_LIVES, TD_WAVES, START_BERRIES, summonPrice, BREAK_TIME, EARLY_BONUS, TD_POWER, TD_STEP,
  TD_MAPS, BASIC_TD, mixTD, tdWave, waveHp, BOSS_HP, waveGap, berriesFor, livesFor, BIG_FOES, NEED_BASICS,
} from './td_data.js';

const BW = TD_COLS * TILE, BH = TD_ROWS * TILE; // the board in logical px

// What a survivalmon is in TD: 0 a basic mon, 1 a level 1 breed, 2 its level 2, 3 its level 3
export const tdLevel = (id) => Math.max(0, (SPECIES[id]?.stage || 1) - 1);
// The two basic mons a breed (or its evolution) comes from
const parentsOf = (id) => SPECIES[id]?.pair || SPECIES[SPECIES[id]?.line]?.pair || [SPECIES[id]?.line || id, SPECIES[id]?.line || id];
// A level 1 breed's id for one of its evolutions
function rootBreed(id) {
  for (const s of Object.values(SPECIES)) if (s.stage === 2 && (s.evo === id || SPECIES[s.evo]?.evo === id)) return s.id;
  return id;
}
// Have you owned it in the main game (it's in your Survidex)?
export const tdUnlocked = (id) => (Box.data.caught?.[id] || 0) > 0;
// The basic mons you can bring (ever owned), and whether the Watchtower is open
export const tdBasics = () => BASE_IDS.filter((id) => tdUnlocked(id));
export const tdOpen = () => tdBasics().length >= NEED_BASICS;

// The TD effect of any survivalmon: a basic mon's own, a breed's from its two parents
export function tdFx(id) {
  const lv = tdLevel(id);
  if (lv === 0) return { ...(BASIC_TD[id] || {}) };
  const [a, b] = parentsOf(rootBreed(id));
  return mixTD(a, b);
}

// What dropping `item` onto tower `on` makes: a breed id (and whether you've unlocked it), or null
export function mergeResult(itemId, onId) {
  const li = tdLevel(itemId), lo = tdLevel(onId);
  if (li === 0 && lo === 0) {
    const r = breedResult(itemId, onId);
    return r ? { id: r, ok: tdUnlocked(r) } : null;
  }
  if (li === lo && itemId === onId && li < 3) {
    const r = SPECIES[onId].evo;
    return r && SPECIES[r] ? { id: r, ok: tdUnlocked(r) } : null;
  }
  return null;
}

// Ranges on the board are much shorter than in the open world
const TD_RANGE = { shooter: 54, zapper: 54, lobber: 70, roller: 64, slam: 40, aura: 40, support: 40 };

// A tower: a survivalmon standing on one spot. It uses the Pet's attacks and drawing.
class Tower extends Pet {
  constructor(g, species, tx, ty) {
    const mon = { id: `td${(g.td.nextId = (g.td.nextId || 0) + 1)}`, species, level: 1, hp: 1, stars: 0, skills: [{ k: 'u', sp: species, t: 1 }] };
    super(g, mon);
    this.tx = tx; this.ty = ty;
    this.hx = tx * TILE + 8; this.hy = ty * TILE + 13;
    this.x = this.hx; this.y = this.hy;
    this.lvl = tdLevel(species);
    this.td = tdFx(species);
    const step = TD_STEP[this.lvl];
    for (const a of this.attacks) {
      const q = a.q;
      q.range = TD_RANGE[a.arch] + step * 6;
      delete q.heal; delete q.bless; delete q.magnet; delete q.armor;
      if (q.chains) q.chains += step;
      if (q.radius) q.radius *= Math.pow(1.25, step) * (a.arch === 'lobber' ? 0.8 : 0.85);
      if (q.pierce !== undefined || this.td.pierce) q.pierce = (q.pierce || 0) + (this.td.pierce || 0) + step;
      if (q.life) q.life = Math.min(q.life, 1.2);
      if (this.td.burn && !q.burn) q.burn = this.td.burn;
      if (this.td.chill && !q.chill) q.chill = 1.5 * this.td.chill;
      if (this.td.freezeChance) q.freezeChance = Math.max(q.freezeChance || 0, this.td.freezeChance);
      if (q.burn) q.burn *= 1 + 0.3 * step;
      if (q.chill) q.chill *= 1 + 0.3 * step;
    }
    this.face = 1;
  }
  get power() { return TD_POWER[this.lvl]; }
  get growth() { return TD_POWER[this.lvl]; }
  update(dt) {
    const g = this.g;
    this.flash = Math.max(0, this.flash - dt);
    this.popT = Math.max(0, (this.popT || 0) - dt);
    if (this.atkT >= 0) { this.atkT += dt; if (this.atkT * 12 >= 6) this.atkT = -1; }
    this.hopT = Math.max(0, this.hopT - dt);
    if (this.state === 'roll') { this.updateRoll(dt); return; }
    // back to its spot after a roll or a leap
    const dx = this.hx - this.x, dy = this.hy - this.y, d = Math.hypot(dx, dy);
    this.moving = d > 1.5;
    if (d > 0.5) { const sp = Math.min(d * 8, 160) * dt; this.x += (dx / d) * Math.min(d, sp); this.y += (dy / d) * Math.min(d, sp); if (Math.abs(dx) > 1) this.face = dx > 0 ? 1 : -1; }
    this.anim += dt * (this.moving ? 8 : 2);
    if (this.moving) return;
    const rate = 1 + Math.min(1, g.td.hasteAt(this));
    for (const a of this.attacks) {
      a.cd -= dt * rate;
      if (a.cd > 0) continue;
      const arch = a.arch === 'support' ? 'aura' : a.arch;
      // face the foe it attacks
      const t = g.tdTarget(this.x, this.y, a.q.range || 50);
      if (t && Math.abs(t.x - this.x) > 2) this.face = t.x > this.x ? 1 : -1;
      a.cd = ARCH[arch](this, g, a.q, a.fx || {}) ?? 0.4;
    }
  }
}

// The board: its tiles for the ground renderer, the road and the summon spots
class Board {
  constructor(map) {
    this.map = map; this.w = TD_COLS; this.h = TD_ROWS; this.infinite = false;
    this.tiles = new Uint8Array(this.w * this.h).fill(map.ground);
    this.baked = []; this.shadows = []; this.bakedTall = [];
    this.road = new Set();
    const P = map.path;
    for (let i = 0; i < P.length - 1; i++) {
      const [x0, y0] = P[i], [x1, y1] = P[i + 1];
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let k = 0; k <= n; k++) this.road.add(`${x0 + Math.sign(x1 - x0) * k},${y0 + Math.sign(y1 - y0) * k}`);
    }
    for (const key of this.road) { const [x, y] = key.split(',').map(Number); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.tiles[y * this.w + x] = map.road; }
    // the road in px (tile middles), with the length walked to each corner
    this.pts = P.map(([x, y]) => ({ x: x * TILE + 8, y: y * TILE + 8 }));
    this.len = [0];
    for (let i = 1; i < this.pts.length; i++) this.len.push(this.len[i - 1] + Math.hypot(this.pts[i].x - this.pts[i - 1].x, this.pts[i].y - this.pts[i - 1].y));
    this.total = this.len[this.len.length - 1];
    // summon spots: grass within 2 tiles of the road, off the board's top and bottom rows
    this.spots = [];
    for (let y = 1; y < this.h - 1; y++) for (let x = 0; x < this.w; x++) {
      if (this.road.has(`${x},${y}`)) continue;
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) if (this.road.has(`${x + dx},${y + dy}`)) { near = true; break; }
      if (near) this.spots.push({ x, y });
    }
    this.spotSet = new Set(this.spots.map((s) => `${s.x},${s.y}`));
    // small bushes, rocks and stumps on grass away from the road, flowers and tufts everywhere else
    // (trees would hide the towers and the road on a board this small)
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const k = `${x},${y}`;
      if (this.road.has(k) || this.spotSet.has(k)) continue;
      if (r() < 0.16) { const spr = map.props[Math.floor(r() * map.props.length)]; if (SPR[spr]) { this.bakedTall.push({ spr, x: x * TILE + 8, y: y * TILE + 14 }); continue; } }
      if (r() < 0.3) this.baked.push({ name: ['flower_r', 'flower_w', 'flower_y', 'flower_p', 'tuft', 'tuft', 'tuft_d'][Math.floor(r() * 7)], x: x * TILE + Math.floor(r() * 10), y: y * TILE + Math.floor(r() * 10) });
    }
    for (const sp of this.spots) if (r() < 0.12) this.baked.push({ name: ['tuft', 'tuft_d', 'flower_w'][Math.floor(r() * 3)], x: sp.x * TILE + Math.floor(r() * 10), y: sp.y * TILE + Math.floor(r() * 10) });
    this.bakedTall.sort((a, b) => a.y - b.y);
  }
  tileAt(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this.road.has(`${x},${y}`) ? this.map.road : this.map.ground;
    return this.tiles[y * this.w + x];
  }
  // a point `d` px along the road
  at(d) {
    const L = this.len, P = this.pts;
    d = Math.max(0, Math.min(this.total, d));
    let i = 1;
    while (i < L.length - 1 && L[i] < d) i++;
    const k = (d - L[i - 1]) / (L[i] - L[i - 1] || 1);
    return { x: P[i - 1].x + (P[i].x - P[i - 1].x) * k, y: P[i - 1].y + (P[i].y - P[i - 1].y) * k, dx: Math.sign(P[i].x - P[i - 1].x), dy: Math.sign(P[i].y - P[i - 1].y) };
  }
}

// A stand-in hero for the combat code, which expects one (TD has none): neutral stats, far away
function tdPlayer() {
  return {
    x: -9999, y: -9999, r: 0, level: 1, kills: 0, spirit: 0, pets: [], weapons: [], trail: [], faceAngle: 0, hp: 1,
    stats: { might: 1, petPower: 1, crit: 0, critMult: 1.5, burnMult: 1, lightning: 1, duration: 1, chillChance: 0, luck: 1, maxHp: 1, speed: 60 },
    hurt() { return false; }, heal() {}, drawHpBar() {},
  };
}

export const TDMode = {
  // Start a TD run on a map with 5 basic mons
  startTD(picks, mapId = 'meadow', saved = null) {
    this.resetRunState();
    this.mode = 'td'; this.modal = null; this.scene = null;
    this.player = tdPlayer();
    this.time = 0; this.dark = {}; this.tierMult = { hp: 1, dmg: 1, xp: 1, coins: 1 }; this.fx = null; this.team = null;
    this.runStats = { damage: 0, chars: {} };
    this.enemies = []; this.projectiles = []; this.zones = []; this.effects = []; this.pickups = [];
    const map = TD_MAPS[mapId];
    const board = new Board(map);
    this.td = {
      map: mapId, board, picks: picks.slice(0, 5), towers: [], berries: START_BERRIES, lives: TD_LIVES, summons: 0,
      wave: 0, state: 'ready', breakT: 0, queue: [], spawnT: 0, speed: 1, cleared: 0, merged: [], drag: null, nextId: 0, kills: 0,
      hasteAt: (t) => this.tdHaste(t),
    };
    const tg = this.tileGround;
    this.tdGround = tg ? new TileGround(tg.cfg, tg.sheets, tg.grass) : null;
    this.tdGround?.attach(board);
    this.cam.x = 0; this.cam.y = 0;
    // a run saved between waves: its towers, berries and lives, ready for the next wave
    if (saved) {
      const T = this.td;
      Object.assign(T, { wave: saved.wave, cleared: saved.wave, berries: saved.berries, lives: saved.lives, summons: saved.summons, merged: saved.merged || [], kills: saved.kills || 0 });
      for (const t of saved.towers || []) if (SPECIES[t.sp] && board.spotSet.has(`${t.tx},${t.ty}`)) T.towers.push(new Tower(this, t.sp, t.tx, t.ty));
    } else this.tdSave();
    this.cam.x = 0; this.cam.y = 0;
    this.ui.showTD();
    Analytics.track('td_start', { map: mapId, picks: this.td.picks.join(',') });
    this.ui.tip('td_start');
  },

  // ------------------------------------------------------------ the waves
  tdGo() {
    const S = this.td;
    if (!S || S.state === 'over') return;
    if (S.state === 'break') { S.berries += EARLY_BONUS; this.tdBerryPop(EARLY_BONUS); }
    else if (S.state !== 'ready') return;
    this.tdStartWave(S.wave + 1);
  },
  tdStartWave(n) {
    const S = this.td;
    S.wave = n; S.state = 'wave'; S.spawnT = 0.3;
    S.queue = [];
    for (const [type, count] of tdWave(n)) for (let i = 0; i < count; i++) S.queue.push(type);
    if (n === 10 || n === 20 || n === 30) { Audio.play('boss'); this.ui.banner(n === 30 ? 'The Night Lord!' : 'A boss is coming!', '#ffd84a', true, `Wave ${n}`); }
    this.ui.tdRefresh();
  },
  tdSpawn(type) {
    const S = this.td, B = S.board;
    const e = new Enemy(this, type, B.pts[0].x, B.pts[0].y);
    const n = S.wave;
    e.maxHp = e.hp = e.def.hp * (e.boss ? (BOSS_HP[type] || 0.4) * waveHp(n) / waveHp(10) * 3 : waveHp(n));
    e.tdPath = true; e.prog = 0; e.lane = rand(-3.5, 3.5);
    e.baseSpeed = e.def.speed * (e.boss ? 0.8 : rand(0.92, 1.08)) * 0.85;
    e.big = BIG_FOES.has(type) || e.boss;
    this.enemies.push(e);
    return e;
  },
  tdMoveEnemy(e, dt) {
    const S = this.td, B = S.board;
    const disabled = e.freeze > 0 || e.stun > 0;
    let spd = e.baseSpeed;
    if (e.chill > 0) spd *= 0.7;
    if ((e.soakT = Math.max(0, (e.soakT || 0) - dt)) > 0) spd *= 0.75;
    if (e.root > 0) spd = 0;
    if (disabled) spd = 0;
    if (e.back > 0) { const b = Math.min(e.back, dt * 120); e.prog -= b; e.back -= b; } else e.prog += spd * dt;
    e.prog = Math.max(0, e.prog);
    const p = B.at(e.prog);
    // walk a little to one side of the road's middle (its lane), across the way it's going
    e.x = p.x - p.dy * e.lane; e.y = p.y + 4 + p.dx * e.lane * 0.6;
    if (p.dx) e.face = p.dx;
    e.moving = spd > 0;
    e.anim += dt * (e.def.anim || 6) * (disabled ? 0 : e.chill > 0 ? 0.6 : 1);
    // the Nightshade Witch heals the creatures walking near her
    if (e.type === 'witch' && (e.healT = (e.healT ?? 3) - dt) <= 0) {
      e.healT = 3;
      this.enemiesInRadius(e.x, e.y, 40, (o) => { if (o !== e && !o.boss) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.15); });
      this.addEffect({ type: 'ring', x: e.x, y: e.y, R: 40, life: 0.45, color: '#c08aff' });
    }
    if (e.prog >= B.total) {
      e.dead = true;
      S.lives = Math.max(0, S.lives - livesFor(e.boss));
      Audio.play('hurt');
      this.shake(2, 0.2);
      this.ui.tdRefresh();
      if (S.lives <= 0) this.tdEnd(false);
    }
  },
  // the foe furthest along the road in reach (the one closest to getting through)
  tdTarget(x, y, maxD, filter) {
    let best = null, bp = -1;
    this.enemyHash.query(x, y, maxD, (e) => {
      if (e.dead || (filter && !filter(e)) || dist2(x, y, e.x, e.y) > maxD * maxD) return;
      if (e.prog > bp) { bp = e.prog; best = e; }
    });
    return best;
  },

  // ------------------------------------------------------------ damage and kills
  tdDamage(e, base, o = {}) {
    if (e.dead) return { crit: false, dmg: 0 };
    const tw = o.petRef || o.by || null, F = (!o.raw && tw?.td) || {};
    let dmg = base;
    if (!o.raw) {
      if (e.soakT > 0) dmg *= 1.1;
      if (F.finish && e.hp < e.maxHp / 2) dmg *= 1 + F.finish;
      if (F.big && e.big) dmg *= 1 + F.big;
      dmg *= rand(0.92, 1.08);
    }
    e.hp -= dmg; e.flash = 0.1;
    this.runStats.damage += dmg;
    if (o.burn) { e.burn = { dps: o.burn * TD_POWER[tw?.lvl || 0], t: 3 }; e.burnBy = tw; }
    if (o.chill) e.chill = Math.max(e.chill, o.chill);
    if (o.freeze && !e.boss) tryFreeze(e, o.freeze);
    if (o.stun && !e.boss) e.stun = Math.max(e.stun, Math.min(o.stun, 0.8));
    if (o.root && !e.boss) e.root = Math.max(e.root, Math.min(o.root, 1));
    if (o.knock && !e.boss) e.back = Math.max(e.back || 0, Math.min(18, o.knock * 0.06) * (1 - (e.knockRes || 0)));
    if (!o.raw && tw) {
      if (F.soak) e.soakT = 2 * Math.min(2, F.soak);
      if (F.root && !e.boss && Math.random() < F.root) e.root = Math.max(e.root, 0.5);
      if (F.daze && !e.boss && Math.random() < F.daze) e.stun = Math.max(e.stun, 0.5);
      if (F.knock && !e.boss) e.back = Math.max(e.back || 0, F.knock * (1 - (e.knockRes || 0)));
      if (F.poison) e.poison = { dps: F.poison * TD_POWER[tw.lvl] * 0.5, stacks: 1, t: 3 };
      if (F.berry) e.berryBonus = Math.max(e.berryBonus || 0, Math.round(F.berry));
      if (F.star && Math.random() < F.star) this.tdStardust(e.x, e.y, tw);
    }
    if (dmg >= 6 || !o.small) this.particles.number(e.x, e.y - e.hgt * 0.5 + 8, dmg, o.element === 'fire' ? 'burn' : 'white');
    if (tw && !o.raw) this.noteChar(tw, 'dealt', Math.min(dmg, Math.max(0, e.hp + dmg)));
    if (e.hp <= 0) this.tdKill(e, o);
    else if (!o.silent) Audio.play('hit');
    return { crit: false, dmg };
  },
  tdStardust(x, y, tw) {
    const dmg = 2 * TD_POWER[tw.lvl];
    this.spawnZone({
      kind: 'spores', x, y, r: 14, life: 2, tick: 0.5, seed: Math.random(),
      onTick: (g, z) => g.enemiesInRadius(z.x, z.y, z.r, (e) => g.damageEnemy(e, dmg, { raw: true, small: true, silent: true, chill: 0.6 })),
    });
  },
  tdKill(e, o = {}) {
    if (e.dead) return;
    e.dead = true;
    const S = this.td;
    S.kills++;
    Box.foeKilled(e.type, 0);
    this.particles.burst(e.x, e.y - 8, { n: e.boss ? 50 : 8, colors: e.colors, speed: e.boss ? 120 : 60, life: 0.45 });
    if (e.art?.anim?.faint && this.effects.length < 140) this.addEffect({ type: 'monfaint', x: e.x, y: e.y, art: e.art, left: e.face < 0, life: e.boss ? 1.4 : 0.8, death: true, scale: e.scale || 1 });
    const n = berriesFor(e.type, e.boss) + (e.berryBonus || 0);
    S.berries += n;
    this.particles.text(e.x, e.y - 14, `+${n}`, '#ff9ac0');
    // a Bloater bursts into Ink Drops where it fell
    if (e.def.splits && Math.random() < (e.def.splitChance ?? 1)) for (let i = 0; i < 2; i++) { const d = this.tdSpawn(e.def.splits); d.prog = Math.max(0, e.prog + rand(-6, 6)); d.maxHp = d.hp = d.def.hp * waveHp(S.wave) * 0.6; }
    Audio.play(e.boss ? 'explode' : 'kill');
    this.ui.tdRefresh();
  },
  tdBerryPop(n) { this.ui.tdRefresh(); this.ui.tdFlashBerries?.(n); },

  // ------------------------------------------------------------ towers
  tdTowerAt(tx, ty) { return this.td.towers.find((t) => t.tx === tx && t.ty === ty) || null; },
  tdFree(tx, ty) { return this.td.board.spotSet.has(`${tx},${ty}`) && !this.tdTowerAt(tx, ty); },
  tdHaste(t) {
    let h = 0;
    for (const o of this.td.towers) if (o !== t && o.td.haste && Math.abs(o.tx - t.tx) <= 1 && Math.abs(o.ty - t.ty) <= 1) h += o.td.haste * (1 + 0.3 * TD_STEP[o.lvl]);
    return h;
  },
  tdPrice() { return summonPrice(this.td.summons); },
  // Summon a basic mon from the bar onto a free spot
  tdSummon(species, tx, ty) {
    const S = this.td, price = this.tdPrice();
    if (S.berries < price || !this.tdFree(tx, ty)) return false;
    S.berries -= price; S.summons++;
    const t = new Tower(this, species, tx, ty);
    t.popT = 0.35;
    S.towers.push(t);
    this.particles.burst(t.x, t.y - 6, { n: 14, colors: [TYPES[SPECIES[species].type].color, '#ffffff'], speed: 50, life: 0.5 });
    Audio.play('open');
    this.ui.tdRefresh();
    this.ui.tip('td_merge');
    return true;
  },
  // Drop something onto a tower: a basic mon from the bar (a summon) or another tower from the board
  tdMerge(item, on) {
    const S = this.td;
    const itemId = item.tower ? item.tower.species : item.species;
    const res = mergeResult(itemId, on.species);
    if (!res || !res.ok) return false;
    if (!item.tower) {
      const price = this.tdPrice();
      if (S.berries < price) return false;
      S.berries -= price; S.summons++;
    } else S.towers = S.towers.filter((t) => t !== item.tower);
    const i = S.towers.indexOf(on);
    const nt = new Tower(this, res.id, on.tx, on.ty);
    nt.popT = 0.5; nt.flash = 0.3;
    S.towers[i] = nt;
    S.merged.push(res.id);
    this.addEffect({ type: 'ring', x: nt.x, y: nt.y - 6, R: 22, life: 0.5, color: '#ffe07a' });
    this.particles.burst(nt.x, nt.y - 8, { n: 26, colors: ['#ffe07a', '#ffffff', TYPES[SPECIES[res.id].type].color], speed: 80, life: 0.6 });
    Audio.play('evolve');
    this.ui.feed(`${SPECIES[res.id].name}!`, '#ffe07a');
    this.ui.tdRefresh();
    if (nt.lvl >= 2) this.ui.tip('td_evolve');
    return true;
  },
  tdMove(tower, tx, ty) {
    if (!this.tdFree(tx, ty)) return false;
    tower.tx = tx; tower.ty = ty; tower.hx = tx * TILE + 8; tower.hy = ty * TILE + 13;
    tower.x = tower.hx; tower.y = tower.hy; tower.popT = 0.25;
    return true;
  },

  // ------------------------------------------------------------ the loop
  updateTD(dt) {
    const S = this.td;
    if (!S || S.state === 'over') { this.particles.update(dt); this.updateEffects(dt); return; }
    for (let k = 0; k < S.speed; k++) this.tdStep(dt);
  },
  tdStep(dt) {
    const S = this.td;
    this.time += dt;
    if (S.state === 'wave') {
      S.spawnT -= dt;
      if (S.queue.length && S.spawnT <= 0) {
        const type = S.queue.shift();
        this.tdSpawn(type);
        S.spawnT = ENEMY_BOSSES.has(type) ? 2 : waveGap(S.wave);
      }
      if (!S.queue.length && !this.enemies.some((e) => !e.dead)) {
        S.cleared = S.wave;
        if (S.wave >= TD_WAVES) { this.tdEnd(true); return; }
        S.state = 'break'; S.breakT = BREAK_TIME;
        this.tdSave();
        if (S.wave === 1) this.ui.tip('td_break');
        this.ui.tdRefresh();
      }
    } else if (S.state === 'break') {
      S.breakT -= dt;
      if (S.breakT <= 0) this.tdStartWave(S.wave + 1);
    }
    this.enemyHash.clear();
    for (const e of this.enemies) if (!e.dead) this.enemyHash.insert(e);
    for (const e of this.enemies) if (!e.dead) e.update(this, dt);
    this.enemies = this.enemies.filter((e) => !e.dead);
    if (S.state === 'over') return;
    for (const t of S.towers) t.update(dt);
    this.updateProjectiles(dt);
    this.updateZones(dt);
    this.updateEffects(dt);
    this.particles.update(dt);
  },

  // ------------------------------------------------------------ the end
  tdEnd(won) {
    const S = this.td;
    if (S.state === 'over') return;
    S.state = 'over'; S.won = won;
    delete Meta.data.tdSave;
    for (const e of this.enemies) e.dead = true;
    this.projectiles = []; this.zones = [];
    const res = this.ui.tdRewards?.(S) || null;
    Analytics.track('td_end', { map: S.map, won, waves: S.cleared, merged: S.merged.length, summons: S.summons });
    Audio.play(won ? 'win' : 'lose');
    this.ui.showTDEnd(S, res);
  },
  // The run so far, kept between waves (a phone call or a closed app doesn't cost it)
  tdSave() {
    const S = this.td;
    if (!S || S.state === 'over') return;
    Meta.data.tdSave = { map: S.map, picks: S.picks, wave: S.cleared, berries: Math.floor(S.berries), lives: S.lives, summons: S.summons, merged: S.merged, kills: S.kills,
      towers: S.towers.map((t) => ({ sp: t.species, tx: t.tx, ty: t.ty })) };
    Meta.save();
  },
  tdLeave() {
    const S = this.td;
    if (S && S.state !== 'over') { S.left = true; this.tdEnd(false); }
  },

  // ------------------------------------------------------------ drawing
  // How the board sits on the screen: scaled to fit between the top strip and the bar of 5
  tdLayout() {
    const V = this.view, top = 26 / V.scale, bot = 70 / V.scale;
    const s = Math.min(V.w / BW, (V.h - top - bot) / BH);
    return { s, ox: (V.w - BW * s) / 2, oy: top + (V.h - top - bot - BH * s) / 2 };
  },
  // a point on the screen (CSS px) to the board (logical px)
  tdFromScreen(cx, cy) {
    const L = this.tdLayout(), V = this.view;
    return { x: (cx / V.scale - L.ox) / L.s, y: (cy / V.scale - L.oy) / L.s };
  },
  renderTD() {
    const ctx = this.ctx, V = this.view, S = this.td;
    ctx.fillStyle = '#1a2e1c'; ctx.fillRect(0, 0, V.w, V.h);
    if (!S) return;
    const L = this.tdLayout();
    ctx.save();
    ctx.translate(L.ox, L.oy); ctx.scale(L.s, L.s);
    ctx.beginPath(); ctx.rect(0, 0, BW, BH); ctx.clip();
    const cam = { x: 0, y: 0 };
    if (this.tdGround) this.tdGround.draw(ctx, cam, { w: BW, h: BH });
    else { ctx.fillStyle = '#4a8a3a'; ctx.fillRect(0, 0, BW, BH); ctx.fillStyle = '#b08850'; for (const k of S.board.road) { const [x, y] = k.split(',').map(Number); ctx.fillRect(x * TILE, y * TILE, TILE, TILE); } }
    const D = S.drag;
    // while dragging: every free spot shines green, towers it can merge with gold (a lock: not unlocked)
    if (D && !D.tap) {
      const pulse = 0.35 + 0.2 * Math.sin(this.realTime * 6);
      for (const sp of S.board.spots) {
        if (this.tdTowerAt(sp.x, sp.y)) continue;
        ctx.globalAlpha = pulse; ctx.fillStyle = '#6cff7a';
        ctx.fillRect(sp.x * TILE + 2, sp.y * TILE + 2, TILE - 4, TILE - 4);
      }
      ctx.globalAlpha = 1;
      const itemId = D.tower ? D.tower.species : D.species;
      for (const t of S.towers) {
        if (t === D.tower) continue;
        const r = mergeResult(itemId, t.species);
        if (!r) continue;
        ctx.globalAlpha = r.ok ? 0.55 + 0.25 * Math.sin(this.realTime * 8) : 0.5;
        ctx.strokeStyle = r.ok ? '#ffe07a' : '#8a8a8a'; ctx.lineWidth = 2;
        ctx.strokeRect(t.tx * TILE + 1, t.ty * TILE + 1, TILE - 2, TILE - 2);
        ctx.globalAlpha = 1;
        if (!r.ok) drawLock(ctx, t.tx * TILE + 12, t.ty * TILE + 1);
      }
    }
    this.drawZones(ctx, cam);
    // y-sorted: towers and creatures
    const list = [];
    const lifted = D && !D.tap ? D.tower : null; // a tower being carried is drawn under the finger instead
    for (const t of S.towers) if (t !== lifted) list.push({ y: t.y, t });
    for (const e of this.enemies) list.push({ y: e.y, e });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.e) { it.e.draw(ctx, cam, this.time); this.tdHpBar(ctx, it.e); continue; }
      const t = it.t;
      if (t.td.haste) { ctx.globalAlpha = 0.18; ctx.fillStyle = '#ffe9a0'; ctx.fillRect((t.tx - 1) * TILE, (t.ty - 1) * TILE, TILE * 3, TILE * 3); ctx.globalAlpha = 1; }
      // bigger forms are drawn a little smaller so they keep to their spot
      const pop = (t.popT > 0 ? 1 + Math.sin((t.popT / 0.5) * Math.PI) * 0.25 : 1) * TOWER_SCALE[t.lvl];
      if (pop !== 1) { ctx.save(); ctx.translate(t.x, t.y); ctx.scale(pop, pop); ctx.translate(-t.x, -t.y); t.draw(ctx, cam); ctx.restore(); }
      else t.draw(ctx, cam);
      drawPips(ctx, t);
    }
    this.drawProjectiles(ctx, cam);
    this.drawEffects(ctx, cam);
    this.particles.draw(ctx, cam);
    this.particles.drawNumbers(ctx, cam);
    // the thing being dragged, under the finger, with its hit area
    if (D && !D.tap && D.x != null) {
      const tx = Math.floor(D.x / TILE), ty = Math.floor(D.y / TILE);
      const id = D.tower ? D.tower.species : D.species;
      const art = CREATURE[id];
      const on = this.tdTowerAt(tx, ty), free = this.tdFree(tx, ty);
      const cx = free || on ? tx * TILE + 8 : D.x, cy = free || on ? ty * TILE + 13 : D.y + 6;
      const sp = SPECIES[id], R = (TD_RANGE[sp.arch] || 50) + TD_STEP[tdLevel(id)] * 6;
      ctx.globalAlpha = 0.16; ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(cx, cy - 4, sp.arch === 'support' ? 22 : R, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.5; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
      ctx.globalAlpha = 0.85;
      if (art) drawCreature(ctx, art, snap(cx), snap(cy), { anim: 'idle' });
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  },
  tdHpBar(ctx, e) {
    if (e.hp >= e.maxHp || e.dead) return;
    const w = e.boss ? 28 : 12, x = Math.round(e.x - w / 2), y = Math.round(e.y + 2);
    ctx.fillStyle = '#2b1d24'; ctx.fillRect(x - 1, y - 1, w + 2, 3);
    ctx.fillStyle = e.boss ? '#ff8a4a' : '#ff5a5a'; ctx.fillRect(x, y, Math.max(0, Math.round((w * e.hp) / e.maxHp)), 1);
  },
};
const TOWER_SCALE = [1, 0.95, 0.85, 0.75];
const ENEMY_BOSSES = new Set(['king_slime', 'treant', 'night_lord']);

// a tower's level as little gold pips under it (a basic mon has none)
function drawPips(ctx, t) {
  if (!t.lvl) return;
  const n = t.lvl, x0 = Math.round(t.hx - (n * 3 - 1) / 2), y = Math.round(t.hy + 2);
  for (let i = 0; i < n; i++) { ctx.fillStyle = '#2b1d24'; ctx.fillRect(x0 + i * 3 - 1, y - 1, 4, 4); ctx.fillStyle = '#ffd84a'; ctx.fillRect(x0 + i * 3, y, 2, 2); }
}
function drawLock(ctx, x, y) {
  ctx.fillStyle = '#2b1d24'; ctx.fillRect(x - 1, y + 2, 7, 6);
  ctx.fillStyle = '#c8c8c8'; ctx.fillRect(x, y + 3, 5, 4);
  ctx.fillStyle = '#2b1d24'; ctx.fillRect(x + 1, y - 1, 3, 1); ctx.fillRect(x, y, 1, 3); ctx.fillRect(x + 4, y, 1, 3);
}
export { Tower, Board, BW, BH };
