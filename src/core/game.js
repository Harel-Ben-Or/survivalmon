// Game: owns state, the main loop, town/world/house modes and rendering.
import { Input } from './input.js';
import { Audio } from './audio.js';
import { SpatialHash } from './spatial.js';
import { rand, TAU, clamp, dist2, choice, formatTime } from './util.js';
import { buildAssets, SPR, ICON } from '../gfx/assets.js';
import { loadArt, loadWorldArt, loadProjArt, loadIconArt, loadVfxArt, WS, snap, ICON_ART } from '../gfx/art.js';
import { EGG_ICONS } from '../gfx/eggs.js';
import { TileGround } from '../world/tileground.js';
import { World, TILE, ZONES } from '../world/world.js';
import { buildInterior } from '../world/interior.js';
import { Player } from '../entities/player.js';
import { Enemy } from '../entities/enemy.js';
import { Pet } from '../entities/pet.js';
import { Particles } from '../systems/particles.js';
import { Combat } from '../systems/combat.js';
import { Pickups } from '../systems/pickups.js';
import { Director, RUN_LENGTH, PACE } from '../systems/director.js';
import { rollContainer, levelUpOptions, levelKind, applyLevelCard, rollStone } from '../systems/loot.js';
import { Box } from '../systems/collection.js';
import { Meta } from '../systems/meta.js';
import { TownMode } from '../world/town.js';
import { HEROES } from '../content/heroes.js';
import { WEAPONS } from '../content/weapons.js';
import { COMBOS } from '../content/artifacts.js';
import { SPECIES, BASE_IDS, STONES, BERRY_XP } from '../content/species.js';
import { BASE_ODDS } from '../content/skills.js';
import { rollSkills, FOUND_HATCH } from '../systems/collection.js';
import { Shrine } from '../systems/shrine.js';
import { SETS, SLOTS, SLOT_NAME, offWeaponLevel } from '../content/gear.js';
import { MATERIALS } from '../content/buildings.js';
import { UI } from '../ui/ui.js';
import { Profiles } from '../systems/profiles.js';

const MAX_STEP = 1 / 60;
// Icons that only exist as PixelLab art (no code-drawn version)
// the upgrade icons (Training Hall, level-up cards, Spirit Shrine)
const UP_ICONS = ['hp', 'damage', 'speed', 'haste', 'magnet', 'armor', 'crit', 'critdmg', 'regen', 'area', 'multi', 'luck', 'exp', 'runtime', 'coins', 'wild'].map((k) => `up_${k}`)
  .concat(['power', 'haste', 'guard', 'vigor', 'focus', 'heal'].map((k) => `team_${k}`));
const EXTRA_ICONS = [...UP_ICONS, 'mat_wood', 'mat_stone', 'mat_clay', 'mat_iron', 'gear_helmet', 'gear_armor', 'gear_gloves', 'gear_boots', ...EGG_ICONS];
const GATHER_TIME = 1.6;  // seconds standing at a gathering spot
const GATHER = { wood: 3, stone: 3, clay: 2, iron: 1 };
const SETTINGS_KEY = 'survivelmon.settings';
const BEST_KEY = Profiles.key('best');
const PENDING_KEY = Profiles.key('pending'); // a run in progress when the app was closed

function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ? { ...fallback, ...v } : fallback; } catch { return fallback; }
}
function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable */ } }

export class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.lightCv = document.createElement('canvas');
    this.lightCtx = this.lightCv.getContext('2d');
    this.view = { w: 480, h: 270, scale: 3 };
    this.cam = { x: 0, y: 0 };
    this.shakeAmt = 0; this.shakeT = 0;
    this.mode = 'boot'; this.modal = null;
    this.settings = load(SETTINGS_KEY, { autoCast: false, shake: true, music: true, controls: 'auto' });
    this.sawTouch = false;
    this.touchMode = false;
    this.best = load(BEST_KEY, { time: 0, kills: 0, level: 0, wins: 0 });
    this.time = 0; this.realTime = 0;
    this.particles = new Particles();
    this.enemyHash = new SpatialHash(32);
    this.activeCombos = new Set();
    this.resetRunState();
    this.ui = new UI(this);
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('blur', () => this.autoPause());
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.autoPause(); this.saveOnHide(); } else this.clearPending(); });
    window.addEventListener('pagehide', () => this.saveOnHide());
    window.addEventListener('touchstart', () => {
      if (this.sawTouch) return;
      this.sawTouch = true;
      if (this.settings.controls === 'auto') this.applyControls();
    }, { passive: true });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    this.applyControls();
  }

  // Decide between keyboard and on-screen touch controls.
  applyControls() {
    const s = this.settings.controls;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    this.touchMode = s === 'touch' || (s === 'auto' && (coarse || this.sawTouch));
    document.body.classList.toggle('touch', this.touchMode);
    this.resize();
    if (this.ui?.touch) this.ui.touch.setVisible(this.touchMode && this.ui.walking());
    if (this.ui?.screen === 'title' && this.mode === 'title') this.ui.showTitle();
  }

  autoPause() {
    if ((this.mode === 'world' || this.mode === 'house') && !this.modal) this.ui.openPause();
  }

  // Phones play in landscape: holding it upright mid-run pauses behind a "turn sideways" screen.
  checkOrientation() {
    const playing = this.mode === 'world' || this.mode === 'house' || this.mode === 'town';
    const portrait = window.innerHeight > window.innerWidth;
    const block = playing && this.touchMode && portrait && !this.allowPortrait;
    if (block === !!this.rotateBlocked) return;
    this.rotateBlocked = block;
    this.ui.showRotate(block);
    if (block) {
      if (!this.modal) this.modal = 'rotate';
      this.ui.prompt(null);
      this.ui.touch.setVisible(false);
    } else {
      if (this.modal === 'rotate') this.modal = null;
      this.ui.touch.setVisible(this.touchMode && this.ui.walking());
    }
  }

  resetRunState() {
    this.enemies = []; this.projectiles = []; this.zones = []; this.effects = []; this.timers = [];
    this.shakeT = 0; this.shakeAmt = 0;
    this.pickups = []; this.pickupCount = { xp: 0 };
    this.particles.clear();
    this.boss = null;
    this.runStats = { damage: 0, taken: 0, coins: 0, casts: 0, houses: 0 };
  }

  async boot() {
    buildAssets();
    await loadArt();
    await loadWorldArt(SPR);
    await Promise.all([loadProjArt(SPR), loadVfxArt(), loadIconArt([...Object.keys(ICON), ...EXTRA_ICONS])]);
    this.tileGround = await TileGround.load();
    Meta.load();
    Shrine.load();
    Box.load();
    this.bankClosedRun();
    navigator.storage?.persist?.().catch(() => {}); // ask the browser not to clear this save
    this.ui.init();
    this.newWorld();
    this.freshWorld = true;
    this.toTitle();
    this.ui.askProfileOnStart();
    window.dispatchEvent(new Event('survivalmon-ready')); // hides the loading screen
    // One update per displayed frame (split into pieces of at most 1/60 s), so motion advances
    // every frame on 60, 90 and 120 Hz screens instead of a fixed step that sometimes ran 0 or 2 times.
    let last = performance.now();
    const frame = (ts) => {
      const dt = Math.min(0.1, (ts - last) / 1000);
      last = ts;
      requestAnimationFrame(frame);
      try {
        if (dt > 0) {
          const n = Math.max(1, Math.ceil(dt / MAX_STEP - 0.25));
          for (let i = 0; i < n; i++) { this.update(dt / n); Input.endFrame(); }
        }
        this.render();
      } catch (err) {
        console.error(err);
      }
    };
    requestAnimationFrame(frame);
  }

  resize() {
    const W = window.innerWidth, H = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    // Phones get chunkier pixels so the hero and monsters stay readable on a small screen.
    const target = this.touchMode ? 205 : 280;
    // k = device pixels per canvas pixel, kept whole so pixel art stays crisp.
    // The canvas holds WS canvas pixels per logical world pixel (art is drawn at 2x).
    const k = Math.max(1, Math.round((Math.min(W, H) * dpr) / (target * WS)));
    const iw = Math.ceil((W * dpr) / k), ih = Math.ceil((H * dpr) / k);
    for (const cv of [this.canvas, this.lightCv]) { cv.width = iw; cv.height = ih; }
    this.canvas.style.width = `${(iw * k) / dpr}px`;
    this.canvas.style.height = `${(ih * k) / dpr}px`;
    this.view.w = iw / WS; this.view.h = ih / WS;
    this.view.scale = (k * WS) / dpr; // CSS px per logical px
    this.ctx.imageSmoothingEnabled = false;
  }

  // Each run gets a new endless world (generated around you as you walk).
  newWorld() {
    this.world = new World();
    this.tileGround?.attach(this.world);
    this.zoneNow = null; this.zoneT = 0;
  }

  saveSettings() { save(SETTINGS_KEY, this.settings); }

  // ------------------------------------------------------------ flow
  toTitle() {
    this.mode = 'title'; this.modal = null;
    Audio.stopMusic();
    this.ui.showTitle();
  }
  startRun(heroId = Meta.hero) {
    if (!this.freshWorld) this.newWorld();
    this.freshWorld = false;
    this.resetRunState();
    this.time = 0;
    this.runId = (this.runId || 0) + 1;
    this.activeCombos = new Set();
    // Merchant items last this one run
    this.buffs = new Set(Meta.data.buffs);
    Meta.data.buffs = []; Meta.save();
    this.heroBonus = Meta.heroTeamBonus(heroId);
    this.runLength = Meta.runLength() + (this.buffs.has('candle') ? 10 : 0);
    this.coinMult = Meta.coinMult();
    this.wildMult = Meta.wildMult();
    this.matMult = this.buffs.has('pick') ? 2 : 1;
    this.reviveFeather = this.buffs.has('feather');
    this.director = new Director(this);
    const P = this.player = new Player(this, heroId);
    P.x = this.world.spawn.x; P.y = this.world.spawn.y;
    // Training Hall upgrades
    const mods = { ...Meta.heroMods(), petXp: this.heroBonus.petXp };
    for (const [k, v] of Object.entries(Meta.gearMods(heroId))) mods[k] = (mods[k] || 0) + v;
    P.bonus = mods;
    P.mats = { wood: 0, stone: 0, clay: 0, iron: 0 };
    P.recompute();
    P.hp = P.stats.maxHp;
    P.addItem('weapon', P.hero.weapon);
    const off = Meta.offWeapon(heroId);
    if (off) P.addItem('weapon', off, offWeaponLevel(Meta.slotLevel(heroId, 'off')));
    this.team = this.teamBonus();
    this.tierOdds = Shrine.odds();
    this.canCatch = Box.data.firstHatch;
    for (const mon of Box.team()) if (mon.hp > 0) this.addPet(mon, true);
    this.applyTeamPassives();
    this.director.catchT = 75 / (this.wildMult || 1);
    this.runStart = { petLv: new Map(P.pets.map((p) => [p.mon.id, p.mon.level])) };
    this.evolveAsked = new Set();
    this.evolveQueue = [];
    this.world.flowFrom = -1;
    this.world.updateFlow(P.x, P.y);
    this.snapCamera();
    this.mode = 'world'; this.modal = null;
    this.ui.showHUD();
    this.banner(`Survive ${formatTime(this.runLength)}! Every monster you defeat pays coins.`, '#ffffff');
    if (this.settings.music) Audio.startMusic();
  }
  gameOver() {
    if (this.mode === 'end') return;
    this.endRun('died');
  }
  victory() {
    if (this.mode === 'end') return;
    this.clearEnemies();
    this.endRun('won');
  }
  // The timer ran out before the final night: back to town with everything collected.
  timeUp() {
    if (this.mode === 'end') return;
    this.clearEnemies();
    this.endRun('timeup');
  }
  clearEnemies() {
    for (const e of this.enemies) if (!e.dead) { this.particles.burst(e.x, e.y - 6, { n: 6, colors: e.colors, speed: 60 }); e.dead = true; }
    this.enemies = [];
  }
  // kind: 'timeup' | 'won' | 'died' | 'quit' (ended from the pause menu). Coins are banked either way.
  endRun(kind) {
    const P = this.player, won = kind === 'won';
    if (this.mode === 'house') { P.x = P.worldX; P.y = P.worldY; this.ui.setPaused(false); this.snapCamera(); }
    this.mode = 'end'; this.modal = null; this.endWon = won;
    this.timers = []; this.shakeT = 0; // attacks still on their way don't land (or shake) after the run
    const hurt = Box.afterRun(P.pets, 0.5 + Meta.buildingBonus('clinic', 'rest') + Shrine.bonus('rest'));
    if (hurt && Meta.unlock('clinic')) this.unlockNote = 'The Clinic is open: heal your hurt survivalmons there.';
    Box.warmEggs(this.time * this.hatchMult());
    Meta.bankMats(P.mats);
    Meta.data.bestTime = Math.max(Meta.data.bestTime || 0, this.time);
    const earned = Math.floor(P.coins);
    Meta.bank(earned);
    Audio.stopMusic();
    Audio.play(kind === 'won' || kind === 'timeup' ? 'victory' : kind === 'quit' ? 'door' : 'gameover');
    const rec = { time: this.time, kills: P.kills, level: P.level };
    const newBest = this.time > this.best.time;
    this.best = {
      time: Math.max(this.best.time, this.time), kills: Math.max(this.best.kills, P.kills),
      level: Math.max(this.best.level, P.level), wins: this.best.wins + (won ? 1 : 0),
    };
    save(BEST_KEY, this.best);
    this.clearPending();
    this.ui.showEnd(kind, rec, newBest, earned);
  }

  // ------------------------------------------------------------ closing the app
  // Whenever the app goes to the background, everything is saved. During a run, what the run has
  // earned so far is noted too: if the app is then closed for good, it's banked on the next start.
  saveOnHide() {
    if (Profiles.leaving) return; // this save was just erased (reset or deleted)
    Box.save(); Meta.save(); Shrine.save();
    if (this.mode !== 'world' && this.mode !== 'house') return;
    const P = this.player;
    save(PENDING_KEY, {
      coins: Math.floor(P.coins), mats: { ...P.mats }, time: this.time, kills: P.kills,
      pets: P.pets.map((p) => ({ id: p.mon.id, hp: p.fainted ? 0 : p.hp / p.maxHp })),
    });
  }
  clearPending() { try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ } }
  bankClosedRun() {
    const r = load(PENDING_KEY, null);
    if (!r) return;
    this.clearPending();
    for (const p of r.pets || []) { const mon = Box.get(p.id); if (mon) mon.hp = Math.max(0, Math.min(1, p.hp)); }
    Box.warmEggs(r.time || 0);
    Box.save();
    Meta.bankMats(r.mats || {});
    Meta.data.bestTime = Math.max(Meta.data.bestTime || 0, r.time || 0);
    Meta.bank(r.coins || 0);
    this.unlockNote = `Your last run was closed before it ended. You kept its ${r.coins || 0} coins and the materials you gathered.`;
  }

  // ------------------------------------------------------------ update
  update(dt) {
    this.realTime += dt;
    this.shakeT = Math.max(0, this.shakeT - dt); // in every mode, so a shake can never get stuck on
    this.checkOrientation();
    if (Input.wasPressed('KeyM')) { const m = Audio.toggleMute(); this.toast(m ? 'Sound off' : 'Sound on'); }
    if (this.mode === 'world' || this.mode === 'house') {
      if (Input.anyPressed('Escape', 'KeyP')) {
        if (this.modal === 'pause') this.ui.closePause();
        else if (!this.modal) this.ui.openPause();
      }
      if (!this.modal) {
        if (this.mode === 'world') this.updateWorld(dt);
        else this.updateHouse(dt);
      }
    } else if (this.mode === 'town') {
      if (Input.anyPressed('Escape', 'KeyP') && !this.modal) this.ui.openTownMenu();
      if (!this.modal) this.updateTown(dt);
    } else if (this.mode === 'title') {
      const c = this.world.center;
      const t = this.realTime * 0.06;
      this.cam.x = c.tx * TILE + Math.cos(t) * 260 - this.view.w / 2;
      this.cam.y = c.ty * TILE + Math.sin(t * 1.3) * 160 - this.view.h / 2;
      this.clampCamera();
    } else if (this.mode === 'end') {
      this.particles.update(dt);
      this.updateEffects(dt);
    }
    this.ui.tick(dt);
  }

  updateWorld(dt) {
    const P = this.player;
    this.time += dt;
    if (this.time >= this.runLength) { if (this.runLength >= RUN_LENGTH) this.victory(); else this.timeUp(); return; }
    this.director.update(dt);
    this.enemyHash.clear();
    for (const e of this.enemies) if (!e.dead && !e.hidden && !e.fainted) this.enemyHash.insert(e);
    P.update(dt);
    if (this.mode !== 'world') return;
    this.world.activate(P.x, P.y);
    this.updateZone(dt);
    this.world.updateFlow(P.x, P.y);
    for (const e of this.enemies) if (!e.dead) e.update(this, dt);
    this.enemies = this.enemies.filter((e) => !e.dead);
    P.pets.forEach((p, i) => p.update(dt, i, false));
    this.updateProjectiles(dt);
    this.updateZones(dt);
    this.updateEffects(dt);
    this.updatePickups(dt);
    this.particles.update(dt);
    if (this.boss && this.boss.dead) this.boss = null;
    this.followCamera(dt);
    if (this.mode !== 'world') return;

    // berry bushes drop berries the first time you brush past them
    for (const o of this.world.objects) {
      if (o.spr !== 'bush_1' || Math.abs(o.x - P.x) > 12 || Math.abs(o.y - 4 - P.y) > 10) continue;
      o.spr = 'bush_0';
      for (let i = 0; i < 2; i++) this.spawnPickup('berry', o.x + rand(-6, 6), o.y + 4);
      Audio.play('open');
    }

    const act = Input.wasPressed('KeyE') || Input.wasPressed('Enter');
    let near = null;
    for (const h of this.world.houses) {
      if (dist2(P.x, P.y, h.doorX, h.doorY) < 20 * 20) { near = h; break; }
    }
    if (near) {
      const label = near.looted ? 'Enter (searched)' : near.kind === 'shrine' ? 'Enter Shrine' : near.kind === 'barn' ? 'Enter Barn' : 'Enter House';
      this.ui.prompt(label, near.doorX, near.doorY - 30);
      if (act) this.enterHouse(near);
    } else this.ui.prompt(null);

    this.updateGathering(dt);
    Audio.setNight(this.dayMinute > 17);
    if (!this.modal && this.evolveQueue.length) this.openEvolve(this.evolveQueue.shift());
    if (P.pendingLevels > 0 && !this.modal) this.openLevelUp();
    if (P.bonusPicks > 0 && !this.modal) this.openLevelUp('bonus');
    if (P.skillPicks > 0 && !this.modal) this.openLevelUp('skill');
    Box.saveIfDirty();
  }

  updateHouse(dt) {
    const P = this.player, room = this.room;
    P.update(dt, room.solids);
    P.pets.forEach((p, i) => p.update(dt, i, true));
    this.particles.update(dt);
    this.updateEffects(dt);
    // nearest unopened container
    let near = null, bd = 24 * 24;
    for (const c of room.containers) {
      if (c.opened) continue;
      const cx = c.x + c.w / 2, cy = c.y + c.h;
      const d = dist2(P.x, P.y, cx, cy);
      if (d < bd) { bd = d; near = c; }
    }
    if (near) {
      const names = { chest: 'Open Chest', crate: 'Search Crate', barrel: 'Search Barrel', pot: 'Search Pot', bookshelf: 'Search Shelf', cupboard: 'Search Cupboard', altar: 'Pray at Altar' };
      this.ui.prompt(names[near.type] || 'Search', near.x + near.w / 2, near.y - 4);
      if (Input.wasPressed('KeyE') || Input.wasPressed('Enter')) this.openContainer(near);
    } else if (P.y > room.ph - 30 && Math.abs(P.x - room.doorX) < 16) {
      this.ui.prompt('Leave', room.doorX, room.ph + 16);
    } else this.ui.prompt(null);
    if (P.y > room.ph - 13 && Math.abs(P.x - room.doorX) < 14) this.exitHouse();
    if (!this.modal && this.evolveQueue.length) this.openEvolve(this.evolveQueue.shift());
    if (P.pendingLevels > 0 && !this.modal) this.openLevelUp();
    if (P.bonusPicks > 0 && !this.modal) this.openLevelUp('bonus');
    if (P.skillPicks > 0 && !this.modal) this.openLevelUp('skill');
  }

  // ------------------------------------------------------------ houses
  enterHouse(h) {
    const P = this.player;
    if (!h.interior) h.interior = buildInterior(h, this.world.seed + h.id * 977);
    this.room = h.interior; this.house = h;
    this.roomOff = { x: Math.floor((this.view.w - this.room.pw) / 2), y: Math.floor((this.view.h - this.room.ph) / 2) };
    if (!h.visited) { h.visited = true; this.runStats.houses++; }
    this.mode = 'house';
    P.worldX = P.x; P.worldY = P.y;
    P.x = this.room.spawn.x; P.y = this.room.spawn.y - 6; P.dir = 'up'; P.faceAngle = -Math.PI / 2; P.d8 = null;
    P.trail = []; P.dashT = 0;
    P.pets.forEach((pet, i) => { pet.x = P.x + (i % 2 ? -1 : 1) * 18 * (1 + (i >> 1)); pet.y = P.y + 4; pet.state = 'follow'; });
    this.ui.prompt(null);
    this.ui.setPaused(true);
    Audio.play('door');
    const name = h.kind === 'shrine' ? 'Old Shrine' : h.kind === 'barn' ? 'Barn' : 'Cottage';
    this.banner(`${name} — the clock is paused`, '#bfeaff');
  }
  exitHouse() {
    const P = this.player, h = this.house;
    this.mode = 'world';
    P.x = h.doorX; P.y = h.doorY + 4; P.dir = 'down'; P.faceAngle = Math.PI / 2; P.d8 = null;
    P.trail = []; P.iframes = 1.2;
    P.pets.forEach((pet, i) => { pet.x = P.x + (i % 2 ? -1 : 1) * 18 * (1 + (i >> 1)); pet.y = P.y + 2; });
    this.ui.prompt(null);
    this.ui.setPaused(false);
    // shove nearby monsters back from the door
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - P.x, e.y - P.y);
      if (d < 90 && !e.boss) { e.kbx += ((e.x - P.x) / (d || 1)) * 320; e.kby += ((e.y - P.y) / (d || 1)) * 320; }
    }
    this.addEffect({ type: 'ring', x: P.x, y: P.y, R: 80, life: 0.4, color: '#ffffff' });
    this.snapCamera();
    Audio.play('door');
  }
  openContainer(c) {
    const P = this.player;
    c.opened = true;
    const res = rollContainer(P, c);
    const cx = c.x + c.w / 2, cy = c.y + 4;
    Audio.play(c.type === 'chest' || c.type === 'altar' ? 'chest' : 'open');
    this.particles.burst(cx, cy + 6, { n: 12, colors: ['#ffe07a', '#ffffff', '#c8a46a'], speed: 50, life: 0.5, up: 20 });
    this.applyDrops(res, cx, cy);
    if (this.room.containers.every((k) => k.opened)) {
      this.house.looted = true;
      this.toast('Everything here has been searched.');
    }
  }
  // Chests dropped by elites (1) and bosses (2) open where you pick them up.
  openWorldChest(n) {
    const P = this.player;
    Audio.play('chest');
    this.applyDrops(rollContainer(P, { type: 'chest', tier: n > 1 ? 'gold' : 'wood' }), P.x, P.y - 14);
  }
  // Entering a new zone shows its name (checked twice a second).
  updateZone(dt) {
    this.zoneT -= dt;
    if (this.zoneT > 0) return;
    this.zoneT = 0.5;
    const z = this.world.zoneAtPx(this.player.x, this.player.y);
    if (z === this.zoneNow) return;
    const first = !this.zoneNow;
    this.zoneNow = z;
    if (!first) this.banner(ZONES[z].name, ZONES[z].color, false, ZONES[z].note);
  }
  applyDrops(res, cx, cy) {
    const P = this.player;
    for (const d of res.drops) {
      if (d.kind === 'coin') { P.coins += d.value; this.runStats.coins += d.value; this.particles.number(cx, cy + 18, d.value, 'crit'); Audio.play('coin'); }
      else if (d.kind === 'heart') P.heal(20 * P.stats.heartMult);
      else if (d.kind === 'xp') { P.addXp(d.value); this.particles.number(cx, cy + 18, d.value, 'xp'); }
      else if (d.kind === 'berry') this.feedTeam(d.value);
      else if (d.kind === 'stone') this.gainStone(d.value);
      else if (d.kind === 'card') { P.bonusPicks = (P.bonusPicks || 0) + d.value; this.toast('Treasure! A bonus upgrade to pick'); }
      else if (d.kind === 'mats') {
        this.addMats(d.value);
        this.toast(Object.entries(d.value).map(([k, v]) => `+${Math.max(1, Math.round(v * (this.matMult || 1)))} ${MATERIALS[k].name}`).join(' · '));
      } else if (d.kind === 'egg') this.findEgg(cx, cy);
      else if (d.kind === 'gear') {
        const gear = this.rollGear();
        if (gear) this.collectGear(gear); else this.addMats({ iron: 2, wood: 3 });
      }
    }
    if (res.text) this.toast(res.text);
  }
  openLoot(items, title) {
    this.modal = 'loot';
    this.ui.prompt(null);
    this.ui.showLoot(items, title, () => { this.modal = null; });
  }

  // ------------------------------------------------------------ gathering and gear
  updateGathering(dt) {
    const P = this.player;
    for (const o of this.world.nodes) {
      const near = dist2(P.x, P.y, o.x, o.y - 2) < 20 * 20;
      o.node.t = near ? o.node.t + dt : Math.max(0, o.node.t - dt * 2);
      if (o.node.t >= GATHER_TIME) this.gather(o);
    }
  }
  gather(o) {
    const P = this.player, k = o.node.kind;
    const n = Math.max(1, Math.round(GATHER[k] * (this.matMult || 1)));
    P.mats[k] += n;
    this.world.removeObject(o);
    this.particles.burst(o.x, o.y - 6, { n: 14, colors: ['#ffe07a', '#ffffff', '#c8a46a'], speed: 60, life: 0.5, up: 20 });
    this.toast(`+${n} ${MATERIALS[k].name}`);
    Audio.play('coin');
  }
  addMats(m) { for (const [k, v] of Object.entries(m)) this.player.mats[k] += Math.max(1, Math.round(v * (this.matMult || 1))); }
  // A gear piece for a random hero (often the one you're playing), never one you already own.
  rollGear() {
    const hero = this.player.hero.id, others = Object.keys(SETS).filter((h) => h !== hero);
    const order = Math.random() < 0.6 ? [hero, ...others.sort(() => Math.random() - 0.5)] : [...others.sort(() => Math.random() - 0.5), hero];
    for (const h of order) {
      const free = SLOTS.filter((s) => !Meta.hasGear(h, s));
      if (free.length) return { hero: h, slot: choice(free) };
    }
    return null;
  }
  dropGear(x, y) {
    const gear = this.rollGear();
    if (gear) this.spawnPickup('gear', x, y, gear);
    else this.addMats({ iron: 2, wood: 3 });
  }
  collectGear(v) {
    const set = SETS[v.hero], heroName = v.hero[0].toUpperCase() + v.hero.slice(1);
    if (!Meta.addGear(v.hero, v.slot)) { this.addMats({ iron: 2, wood: 3 }); this.toast(`You already have ${set[v.slot]}: broke it down for materials`); return; }
    const locked = !Meta.isHeroUnlocked(v.hero);
    this.banner(`Gear: ${heroName}'s ${set[v.slot]}!`, '#ffd84a', true, `${SLOT_NAME[v.slot]} · ${locked ? `it waits until you unlock ${heroName}` : 'level it up at the Workshop'}`);
    if (Meta.unlock('workshop')) this.toast('The Workshop is open in town!');
    Audio.play('chest');
  }

  // ------------------------------------------------------------ survivalmons: team, eggs, evolving
  // mon is a saved Ranch record. Returns the in-run Pet, or null if the team is full.
  addPet(mon, silent = false) {
    const P = this.player;
    if (P.pets.length >= Box.teamSize()) return null;
    const pet = new Pet(this, mon);
    P.pets.push(pet);
    P.recompute();
    if (this.mode === 'world') this.applyTeamPassives();
    if (!silent) Audio.play('hatch');
    return pet;
  }
  // Team-wide bonuses for this run: the Spirit Shrine (and later the hero's boost and gear).
  teamBonus() {
    const t = Shrine.teamBonus(), h = this.heroBonus?.team || {};
    for (const k of Object.keys(t)) t[k] += h[k] || 0;
    if (this.buffs?.has('snack')) t.dmg += 0.2;
    if (this.buffs?.has('tonic')) t.def += 0.2;
    return t;
  }
  // Passive skills that work for the whole team or the whole run.
  applyTeamPassives() {
    const P = this.player, sum = (id) => P.pets.reduce((s, p) => s + (p.fainted ? 0 : p.pass[id] || 0), 0);
    this.cry = sum('cry');
    const hb = this.heroBonus || { coins: 0, wild: 0 };
    this.coinMult = Meta.coinMult() * (1 + sum('nose') + hb.coins);
    this.wildMult = Meta.wildMult() * (1 + sum('star') + hb.wild) * (1 + Shrine.bonus('wild')) * (this.buffs?.has('horn') ? 1.5 : 1);
    this.matMult = (this.buffs?.has('pick') ? 2 : 1) * (1 + sum('nose'));
  }
  hatchMult() { return (1 + Meta.buildingBonus('hatchery', 'speed') + Shrine.bonus('hatch')) * (this.buffs?.has('warmer') ? 1.5 : 1); }
  // An egg found in a run goes to the Hatchery (or turns into coins if every nest is full).
  findEgg(x, y) {
    const species = choice([...BASE_IDS, ...BASE_IDS.slice(0, 5)]);
    if (Box.addEgg({ species, skills: rollSkills(species, { odds: this.tierOdds }), need: FOUND_HATCH, kind: 'found' })) {
      this.banner('An egg!', '#ffe07a', false, 'It waits in your Hatchery and hatches after time in the wild');
    } else {
      this.player.coins += 30;
      this.toast('Your Hatchery is full, so the egg became 30 coins.');
    }
    this.particles.burst(x, y - 6, { n: 16, colors: ['#ffe07a', '#ffffff'], speed: 60, life: 0.5, up: 20 });
    Audio.play('chest');
  }
  feedTeam(n) {
    const P = this.player;
    P.heal(2 * n);
    if (!P.pets.length) { this.toast('Berries! (+HP) Bring survivalmons to feed them too.'); return; }
    for (const pet of P.pets) {
      pet.gainXp(BERRY_XP * n);
      pet.heal(3 * n);
      this.particles.number(pet.x, pet.y - 4, BERRY_XP * n, 'heal');
    }
    Audio.play('gem');
  }
  gainStone(id) {
    Box.addItem(id);
    this.banner(`Rare find: ${STONES[id].name}!`, '#c88aff', true, 'Kept at your Ranch. Evolves a mixed breed of its type at Lv 10.');
    Audio.play('chest');
    this.checkEvolve();
  }
  rollStone() { return rollStone(this.player); }

  // Queue an evolution prompt for any party member that is ready.
  checkEvolve() {
    const P = this.player;
    if (!P || !this.evolveQueue) return;
    for (const pet of P.pets) {
      const m = pet.mon;
      if (Box.canEvolve(m) && !this.evolveAsked.has(m.id) && !this.evolveQueue.includes(m)) this.evolveQueue.push(m);
    }
  }
  openEvolve(mon) {
    this.evolveAsked.add(mon.id);
    if (!Box.canEvolve(mon)) return;
    this.modal = 'evolve';
    this.ui.prompt(null);
    this.ui.showEvolve(mon, () => { this.modal = null; });
  }
  doEvolve(mon) {
    if (!Box.evolve(mon)) return false;
    const pet = this.player?.pets.find((p) => p.mon === mon);
    if (pet) { pet.refresh(); this.player.recompute(); }
    return true;
  }
  refreshCombos() {
    const P = this.player;
    if (!P) return;
    const now = new Set();
    for (const c of COMBOS) {
      if (c.pieces.every((p) => (p === 'pet:any' ? P.pets.some((x) => !x.fainted) : P.has(p)))) now.add(c.id);
    }
    for (const id of now) {
      if (!this.activeCombos.has(id) && (this.mode === 'world' || this.mode === 'house')) {
        const c = COMBOS.find((x) => x.id === id);
        this.banner(`COMBO! ${c.name}`, '#ffd84a', true, c.desc);
        Audio.play('combo');
      }
    }
    this.activeCombos = now;
  }
  combo(id) { return this.activeCombos.has(id); }

  // Level-ups alternate between your survivalmons and your hero (see levelKind); bonus picks from
  // chests offer both; a beaten boss gives a skill pick. The level shown is the one this pick is for.
  openLevelUp(extra = null) {
    const P = this.player;
    const level = P.level - P.pendingLevels + 1;
    const cards = levelUpOptions(P, extra || levelKind(P, level));
    // a skill pick with no skill left to raise turns into a bonus pick
    const kind = this.levelKindNow = extra === 'skill' && cards[0]?.kind !== 'skill' ? 'bonus' : extra || levelKind(P, level);
    this.modal = 'levelup';
    this.ui.prompt(null);
    Audio.play('levelup');
    this.ui.showLevelUp(cards, (card) => {
      applyLevelCard(P, card);
      if (extra === 'bonus') P.bonusPicks--; else if (extra === 'skill') P.skillPicks--; else P.pendingLevels--;
      this.modal = null;
    }, kind, level);
  }
  rerollLevelUp() { return levelUpOptions(this.player, this.levelKindNow); }
  // which kind the next level-up will be (for the EXP bar)
  nextLevelKind() { return levelKind(this.player, this.player.level + 1); }

  onBossDeath(e) {
    // a skill pick for your team (not after the last boss: the run is won then)
    const skillUp = this.player.pets.length && e.type !== 'night_lord';
    this.banner(`${e.def.name} defeated!`, '#7af08a', true, skillUp ? 'Pick a survivalmon skill to power up' : '');
    if (skillUp) this.player.skillPicks++;
    this.spawnPickup('chest', e.x - 10, e.y, 2);
    if (Math.random() < 0.35) this.spawnPickup('egg', e.x + 10, e.y);
    this.dropGear(e.x - 14, e.y + 6);
    this.addMats({ wood: 4, stone: 4, clay: 2, iron: 2 });
    for (let i = 0; i < 12; i++) this.spawnPickup('coin', e.x + rand(-20, 20), e.y + rand(-14, 14), 3);
    for (let i = 0; i < 6; i++) this.spawnPickup('berry', e.x + rand(-20, 20), e.y + rand(-14, 14));
    if (Math.random() < 0.4 * this.player.stats.luck) this.spawnPickup('stone', e.x, e.y - 12, this.rollStone());
    this.shake(8, 0.5);
    if (this.boss === e) this.boss = null;
    this.ui.bossBar(null);
    const run = this.runId;
    if (e.type === 'night_lord') setTimeout(() => this.mode === 'world' && this.runId === run && this.victory(), 1500);
  }

  // ------------------------------------------------------------ helpers used by content
  spawnEnemy(type, x, y, opts) {
    const e = new Enemy(this, type, x, y, opts);
    Box.markSeen(opts?.wild || type);
    this.enemies.push(e);
    return e;
  }
  sprite(name) { return SPR[name].frames[0]; }
  shake(a, t) { if (!this.settings.shake) return; this.shakeAmt = Math.max(this.shakeT > 0 ? this.shakeAmt : 0, a); this.shakeT = Math.max(this.shakeT, t); }
  banner(text, color, big = false, sub = '') { this.ui.banner(text, color, big, sub); }
  toast(text) { this.ui.toast(text); }
  bossBar(e) { this.boss = e; this.ui.bossBar(e); }

  // ------------------------------------------------------------ camera
  snapCamera() {
    const P = this.player;
    this.cam.x = P.x - this.view.w / 2; this.cam.y = P.y - 8 - this.view.h / 2;
    this.clampCamera();
  }
  followCamera(dt) {
    const P = this.player;
    const tx = P.x - this.view.w / 2, ty = P.y - 8 - this.view.h / 2;
    const k = 1 - Math.exp(-10 * dt);
    this.cam.x += (tx - this.cam.x) * k; this.cam.y += (ty - this.cam.y) * k;
    this.clampCamera();
  }
  clampCamera() {
    const map = this.mode === 'town' ? this.town : this.world;
    if (map.infinite) return; // the wild goes on in every direction
    this.cam.x = clamp(this.cam.x, 0, Math.max(0, map.pw - this.view.w));
    this.cam.y = clamp(this.cam.y, 0, Math.max(0, map.ph - this.view.h));
  }
  renderCam() {
    // Snap the camera's offset from the hero rather than the camera itself: the hero then holds
    // still on screen while the world scrolls, instead of shivering a pixel as both round separately.
    const P = this.player, onHero = P && this.mode !== 'title';
    let x = onHero ? snap(P.x) + snap(this.cam.x - P.x) : snap(this.cam.x);
    let y = onHero ? snap(P.y) + snap(this.cam.y - P.y) : snap(this.cam.y);
    if (this.shakeT > 0 && !this.modal) { x += Math.round(rand(-this.shakeAmt, this.shakeAmt)); y += Math.round(rand(-this.shakeAmt, this.shakeAmt)); }
    return { x, y };
  }
  worldToScreen(x, y) {
    if (this.mode === 'house') return { x: (x + this.roomOff.x) * this.view.scale, y: (y + this.roomOff.y) * this.view.scale };
    return { x: (x - this.cam.x) * this.view.scale, y: (y - this.cam.y) * this.view.scale };
  }

  // ------------------------------------------------------------ render
  render() {
    const ctx = this.ctx;
    ctx.setTransform(WS, 0, 0, WS, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (this.mode === 'house') this.renderHouse();
    else if (this.mode === 'town') this.renderTown();
    else if (this.mode === 'boot') { ctx.fillStyle = '#1a1218'; ctx.fillRect(0, 0, this.view.w, this.view.h); }
    else this.renderWorld();
  }

  renderWorld() {
    const ctx = this.ctx, V = this.view;
    const cam = this.renderCam();
    const playing = this.mode === 'world' || (this.mode === 'end' && this.player);
    ctx.fillStyle = '#245f2b'; ctx.fillRect(0, 0, V.w, V.h);
    this.tileGround?.draw(ctx, cam, V);

    if (playing) {
      this.drawZones(ctx, cam);
      this.drawPickups(ctx, cam);
      for (const w of this.player.weapons) if (WEAPONS[w.id].draw && w.id === 'thornaura') WEAPONS[w.id].draw(ctx, this, w, cam);
    }
    // y-sorted scene
    const list = [];
    const P = playing ? this.player : null;
    for (const o of this.world.objects) {
      const s = SPR[o.spr];
      const left = o.topLeft ? o.x : o.x - s.ax;
      const top = o.topLeft ? o.y : o.y - s.ay;
      if (left > cam.x + V.w || left + s.w < cam.x || top > cam.y + V.h || top + s.h < cam.y) continue;
      list.push({ y: o.sortY, o, left, top, s });
    }
    if (playing) {
      for (const e of this.enemies) {
        if (e.x < cam.x - 60 || e.x > cam.x + V.w + 60 || e.y < cam.y - 40 || e.y > cam.y + V.h + 80) continue;
        list.push({ y: e.y, e });
      }
      for (const p of P.pets) list.push({ y: p.y, pet: p });
      list.push({ y: P.y, player: P });
    }
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.o) {
        let alpha = 1;
        if (P && it.o.fade && P.y < it.o.sortY - 1 && P.y > it.top + 6 && P.x > it.left + 3 && P.x < it.left + it.s.w - 3) alpha = 0.55;
        ctx.globalAlpha = alpha;
        ctx.drawImage(it.s.frames[0], snap(it.left - cam.x), snap(it.top - cam.y), it.s.w, it.s.h);
        ctx.globalAlpha = 1;
        if (it.o.house && !it.o.house.looted && playing) this.drawHouseMarker(ctx, it.o.house, cam);
        if (it.o.node && playing) this.drawNode(ctx, it.o, cam);
      } else if (it.e) it.e.draw(ctx, cam, this.time);
      else if (it.pet) it.pet.draw(ctx, cam);
      else if (it.player) it.player.draw(ctx, cam);
    }
    if (playing) {
      this.drawProjectiles(ctx, cam);
      for (const w of this.player.weapons) if (WEAPONS[w.id].draw && w.id !== 'thornaura') WEAPONS[w.id].draw(ctx, this, w, cam);
      this.drawEffects(ctx, cam);
      this.particles.draw(ctx, cam);
      P.drawHpBar(ctx, cam);
      this.renderLighting(cam);
      this.particles.drawNumbers(ctx, cam);
    }
  }

  // A gathering spot: a little bobbing icon of what it gives, and a ring that fills while you stand there.
  drawNode(ctx, o, cam) {
    const x = snap(o.x - cam.x), y = Math.round(o.y - 30 + Math.sin(this.time * 3 + o.x) * 1.5) - cam.y;
    const art = ICON_ART[MATERIALS[o.node.kind].icon];
    if (art) ctx.drawImage(art.img, x - art.w / 4, y - art.h / 2, art.w / 2, art.h / 2);
    if (o.node.t > 0) {
      ctx.strokeStyle = '#2b1d24'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y - 1, 7, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y - 1, 7, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, o.node.t / GATHER_TIME)); ctx.stroke();
    }
  }
  drawHouseMarker(ctx, h, cam) {
    const x = snap(h.doorX - cam.x), y = Math.round(h.doorY - 44 + Math.sin(this.time * 3 + h.id) * 2) - cam.y;
    if (h.visited) return;
    ctx.fillStyle = '#2b1d24'; ctx.fillRect(x - 3, y - 1, 7, 10);
    ctx.fillStyle = '#ffd84a'; ctx.fillRect(x - 2, y, 5, 5); ctx.fillRect(x - 2, y + 6, 5, 2);
    ctx.fillStyle = '#fff6c8'; ctx.fillRect(x - 1, y + 1, 2, 2);
  }

  // How far along the 25 minute timeline of waves, bosses and monster scaling this run is.
  get stage() { return this.time * PACE; }
  // Time of day, in the old 25 minute day: the longest run goes from morning to full night.
  get dayMinute() { return (this.time / RUN_LENGTH) * 25; }

  nightLevels() {
    const m = this.dayMinute;
    const ss = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    return { sunset: ss(11, 16, m), night: ss(16, 21, m) };
  }
  renderLighting(cam) {
    const { sunset, night } = this.nightLevels();
    if (sunset < 0.01) return;
    const L = this.lightCtx, V = this.view;
    const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
    let c = lerp3([255, 255, 255], [255, 190, 140], sunset);
    c = lerp3(c, [58, 66, 132], night);
    L.setTransform(WS, 0, 0, WS, 0, 0);
    L.globalCompositeOperation = 'source-over';
    L.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
    L.fillRect(0, 0, V.w, V.h);
    const k = Math.max(sunset * 0.4, night);
    const light = (x, y, r, a = 1, warm = false) => {
      const sx = x - cam.x, sy = y - cam.y;
      if (sx < -r || sy < -r || sx > V.w + r || sy > V.h + r) return;
      const g = L.createRadialGradient(sx, sy, 0, sx, sy, r);
      const col = warm ? '255,236,190' : '255,255,255';
      g.addColorStop(0, `rgba(${col},${a * k})`);
      g.addColorStop(1, `rgba(${col},0)`);
      L.fillStyle = g;
      L.fillRect(sx - r, sy - r, r * 2, r * 2);
    };
    const P = this.player;
    light(P.x, P.y - 8, 90, 0.95);
    for (const l of this.world.lights) light(l.x, l.y, l.r * 1.6, 1, true);
    for (const p of this.projectiles) if (p.glow) light(p.x, p.y - p.z, 26, 0.8, true);
    for (const z of this.zones) if (z.glow) light(z.x, z.y, z.r * 1.8, 0.7, true);
    for (const e of this.effects) if (e.type === 'explosion' || e.type === 'zap') light(e.x ?? (e.pts && e.pts[e.pts.length - 1][0]), e.y ?? (e.pts && e.pts[e.pts.length - 1][1]), 60, 1 - e.age / e.maxLife, true);
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.lightCv, 0, 0);
    ctx.restore();
  }

  renderHouse() {
    const ctx = this.ctx, V = this.view, room = this.room, P = this.player;
    ctx.fillStyle = '#140c10'; ctx.fillRect(0, 0, V.w, V.h);
    let ox = Math.floor((V.w - room.pw) / 2), oy = Math.floor((V.h - room.ph) / 2);
    if (room.pw > V.w) ox = Math.round(clamp(V.w / 2 - P.x, V.w - room.pw, 0));
    if (room.ph > V.h) oy = Math.round(clamp(V.h / 2 - P.y, V.h - room.ph, 0));
    this.roomOff = { x: ox, y: oy };
    const cam = { x: -ox, y: -oy };
    ctx.drawImage(room.canvas, ox, oy, room.pw, room.ph);
    const list = room.furniture.map((f) => ({ y: f.y + f.h, f }));
    list.push({ y: P.y, player: P });
    for (const p of P.pets) list.push({ y: p.y, pet: p });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.f) {
        const f = it.f;
        let name = f.spr;
        if (f.opened) {
          if (f.type === 'chest') name = `${f.spr}_open`;
          else if (f.type === 'crate') name = 'crate_open';
          else if (f.type === 'barrel') name = 'barrel_open';
          else if (f.type === 'pot') name = 'pot_broken';
        }
        const s = SPR[name];
        const yOff = name === 'pot_broken' ? s.h - SPR.pot.h : 0;
        if (f.opened && (f.type === 'bookshelf' || f.type === 'cupboard' || f.type === 'altar')) ctx.globalAlpha = 0.8;
        ctx.drawImage(s.frames[0], f.x + ox, f.y + oy + yOff, s.w, s.h);
        ctx.globalAlpha = 1;
        if (f.container && !f.opened && Math.floor(this.realTime * 3 + f.x) % 4 === 0) {
          ctx.fillStyle = '#fff6c8';
          const sx = f.x + ox + ((f.x * 7 + Math.floor(this.realTime * 3)) % Math.max(1, f.w)), sy = f.y + oy + 2;
          ctx.fillRect(sx, sy, 1, 1); ctx.fillRect(sx - 1, sy + 1, 3, 1); ctx.fillRect(sx, sy + 2, 1, 1);
        }
      } else if (it.player) it.player.draw(ctx, cam);
      else if (it.pet) it.pet.draw(ctx, cam);
    }
    this.drawEffects(ctx, cam);
    this.particles.draw(ctx, cam);
    this.particles.drawNumbers(ctx, cam);
  }
}

Object.assign(Game.prototype, Combat, Pickups, TownMode);
export { HEROES, TAU };
