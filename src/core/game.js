// Game: owns state, the main loop, town/world/house modes and rendering.
import { Input } from './input.js';
import { Audio } from './audio.js';
import { SpatialHash } from './spatial.js';
import { rand, TAU, clamp, dist2, choice, formatTime } from './util.js';
import { buildAssets, SPR, ICON } from '../gfx/assets.js';
import { loadArt, loadWorldArt, loadProjArt, loadIconArt, loadVfxArt, loadNpcArt, NPC_ART, drawNpcArt, WS, snap, ICON_ART, setHeroLook } from '../gfx/art.js';
import { NPC_IDS } from '../content/npcs.js';
import { EGG_ICONS } from '../gfx/eggs.js';
import { TileGround } from '../world/tileground.js';
import { World, TILE, ZONES } from '../world/world.js';
import { buildInterior, buildBasement } from '../world/interior.js';
import { Player } from '../entities/player.js';
import { Enemy } from '../entities/enemy.js';
import { Pet } from '../entities/pet.js';
import { Particles } from '../systems/particles.js';
import { Combat } from '../systems/combat.js';
import { Pickups } from '../systems/pickups.js';
import { Director, RUN_LENGTH, PACE } from '../systems/director.js';
import { rollContainer, levelUpOptions, applyLevelCard, rollStone } from '../systems/loot.js';
import { Box } from '../systems/collection.js';
import { Meta } from '../systems/meta.js';
import { TownMode } from '../world/town.js';
import { SceneMode } from '../world/scene.js';
import { reunionScene, FRIEND_AT_TIER } from '../content/story_scenes.js';
import { HEROES } from '../content/heroes.js';
import { checkAchievements, MEDALS } from '../systems/achievements.js';
import { WEAPONS } from '../content/weapons.js';
import { SPECIES, BASE_IDS, STONES, BERRY_XP, ATK_TYPES, ATK_TYPE_IDS, TYPES } from '../content/species.js';
import { BASE_ODDS, TIERS, PASSIVES } from '../content/skills.js';
import { rollSkills, FOUND_HATCH } from '../systems/collection.js';
import { Shrine } from '../systems/shrine.js';
import { tierMult, gateName, gateColor, gateSide, gateBlurb, GATE_MAX } from '../content/gates.js';
import { SETS, SLOTS, SLOT_NAME, HERO_SETS, GEAR_SETS, pieceName } from '../content/gear.js';
import { MATERIALS, BUILDINGS } from '../content/buildings.js';
import { ITEM, BOOST_TIME, itemName, parseKey } from '../content/shop.js';
import { UI } from '../ui/ui.js';
const NO_BLESS = Object.freeze({ dmg: 0, haste: 0, def: 0, end: 0 });
import { Profiles } from '../systems/profiles.js';

const MAX_STEP = 1 / 60;
// Icons that only exist as PixelLab art (no code-drawn version)
// the upgrade icons (Training Hall, level-up cards, Spirit Shrine)
const UP_ICONS = ['hp', 'damage', 'speed', 'haste', 'magnet', 'armor', 'crit', 'critdmg', 'regen', 'area', 'multi', 'luck', 'exp', 'runtime', 'coins', 'wild'].map((k) => `up_${k}`)
  .concat(['power', 'haste', 'guard', 'vigor', 'focus', 'heal'].map((k) => `team_${k}`));
const EXTRA_ICONS = [...UP_ICONS, ...Object.values(ATK_TYPES).map((t) => t.icon), 'mat_wood', 'mat_stone', 'mat_clay', 'mat_iron', 'gear_helmet', 'gear_armor', 'gear_gloves', 'gear_boots', ...EGG_ICONS,
  'shard', 'shard_pile', 'bag', 'it_swift', 'it_power', 'it_iron', 'it_heal', 'it_horn', 'it_warm', 'it_frost', 'it_pick', 'egg_star', 'egg_mystery',
  'tool_axe', 'tool_pick', 'tool_spade', 'hammer', 'anvil', 'stopwatch'];
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
    await Promise.all([loadProjArt(SPR), loadVfxArt(), loadNpcArt(NPC_IDS), loadIconArt([...Object.keys(ICON), ...EXTRA_ICONS])]);
    this.tileGround = await TileGround.load();
    Meta.load();
    setHeroLook(Meta.gender); // your look: the boy or the girl ranger trainee
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
    this.ui.showTitle();
  }
  startRun(heroId = Meta.hero) {
    if (!this.freshWorld) this.newWorld();
    this.freshWorld = false;
    this.resetRunState();
    this.time = 0;
    // the gate this run goes through (picked at the gate): how thick the Blight is, and how it pays
    this.tier = Math.max(0, Math.min(Meta.data.gateTier || 0, Meta.gates));
    this.tierMult = tierMult(this.tier);
    this.blessing = { dmg: 0, haste: 0, def: 0, end: 0 };
    this.runId = (this.runId || 0) + 1;
    this.activeCombos = new Set();
    // the hero's sets and gear: team bonuses, hero stats, attack types, coins, materials, shard luck
    this.heroBonus = Meta.heroTeamBonus(heroId);
    this.runLength = Meta.runLength();
    this.coinMult = Meta.coinMult();
    this.wildMult = Meta.wildMult();
    this.matMult = 1;
    this.boosts = {}; // items used from the bag: { stat: { v, end } }
    this.director = new Director(this);
    const P = this.player = new Player(this, heroId);
    P.x = this.world.spawn.x; P.y = this.world.spawn.y;
    // Training Hall upgrades
    const mods = { ...Meta.heroMods(), petXp: this.heroBonus.petXp };
    for (const [k, v] of Object.entries(Meta.gearMods(heroId))) mods[k] = (mods[k] || 0) + v;
    for (const [k, v] of Object.entries(this.heroBonus.hero)) mods[k] = (mods[k] || 0) + v;
    P.bonus = mods;
    P.mats = { wood: 0, stone: 0, clay: 0, iron: 0 };
    P.shards = 0;
    P.recompute();
    P.hp = P.stats.maxHp;
    P.setMain(P.hero.weapon); // the hero's own weapon: 12 levels with three evolves
    this.team = this.teamBonus();
    // the berry bar: berries you pick up fill it; when it's full the team gets an upgrade
    P.berries = 0; P.teamNext = 5; P.teamLevel = 0; P.teamPicks = 0; P.houseBonus = 0; P.evolvePicks = 0;
    this.monPool = 0; this.poolShare = null; this.beacon = null; this.evolveTier = 0;
    // type cards picked this run (n), and their damage, which starts at what the hero's sets give
    this.typeUp = Object.fromEntries(ATK_TYPE_IDS.map((t) => [t, { dmg: this.heroBonus.types[t] || 0, n: 0 }]));
    this.tierOdds = Shrine.odds();
    this.canCatch = Box.data.firstHatch;
    // the story's first run, out of the ruins: the egg Hollis gave you hatches on the way (about 10 s in)
    this.storyRun = !Meta.data.runs && !Box.mons.length && Box.eggs.some((e) => e.kind === 'starter');
    this.storyHatched = false;
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
    this.darkStep = 0; this.dark = this.darkness(); this.finalStand = false;
    // a full run is won by defeating the Night Lord; a shorter one by lasting until its time is up
    const goal = this.runLength >= RUN_LENGTH ? 'defeat the Night Lord' : `survive ${formatTime(this.runLength)}`;
    const banner = () => {
      if (this.mode !== 'world') return;
      if (this.tier) this.banner(`${gateName(this.tier)}: ${goal}!`, gateColor(this.tier), true, gateBlurb(this.tier));
      else this.banner(`${goal[0].toUpperCase()}${goal.slice(1)}! Every monster you defeat pays coins.`, '#ffffff', false, 'The Blight is weak in daylight. It grows stronger after sunset.');
    };
    if (!Meta.data.runs) this.ui.tip('run_start', banner); else banner(); // a new player's first run: Moss first
    if (Meta.bagSize()) this.ui.tip('bag');
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
    // the mon EXP pool (what your survivalmons defeated) is split evenly between everyone on the team
    const pool = Math.round((this.monPool || 0) * P.stats.petXp);
    if (pool > 0 && P.pets.length) {
      const share = Math.max(1, Math.floor(pool / P.pets.length));
      for (const p of P.pets) Box.addXp(p.mon, share);
      this.poolShare = { pool, share };
      this.checkEvolve();
    }
    const hurt = Box.afterRun(P.pets, 0.5 + Meta.buildingBonus('clinic', 'rest') + Shrine.bonus('rest'));
    if (hurt && Meta.unlock('clinic')) this.unlockNote = 'The Clinic is open: heal your hurt survivalmons there.';
    Box.warmEggs(this.time * this.hatchMult());
    Meta.bankMats(P.mats);
    Meta.addShards(P.shards || 0);
    Meta.data.bestTime = Math.max(Meta.data.bestTime || 0, this.time);
    // won through the newest gate: the next gate's guard will let you through
    this.gateOpened = 0;
    this.allGates = false;
    if (won && this.tier >= Meta.gates && this.tier < GATE_MAX) {
      Meta.data.gates = this.tier + 1; Meta.data.gateNew = this.tier + 1;
      this.gateOpened = this.tier + 1;
    } else if (won && this.tier >= GATE_MAX && !Meta.data.allGates) { Meta.data.allGates = true; this.allGates = true; }
    const earned = Math.floor(P.coins);
    Meta.bank(earned);
    this.spiritEarned = Math.floor(P.spirit);
    Meta.addSpirit(this.spiritEarned);
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
      coins: Math.floor(P.coins), spirit: Math.floor(P.spirit), shards: P.shards || 0, mats: { ...P.mats }, time: this.time, kills: P.kills,
      pets: P.pets.map((p) => ({ id: p.mon.id, hp: p.fainted ? 0 : p.hp / p.maxHp })),
      pool: Math.round((this.monPool || 0) * P.stats.petXp), // the mon EXP pool, split as at a run's end
    });
  }
  clearPending() { try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ } }
  bankClosedRun() {
    const r = load(PENDING_KEY, null);
    if (!r) return;
    this.clearPending();
    for (const p of r.pets || []) { const mon = Box.get(p.id); if (mon) mon.hp = Math.max(0, Math.min(1, p.hp)); }
    // the team's EXP from the run is split evenly, as it would have been at the end
    const mons = (r.pets || []).map((p) => Box.get(p.id)).filter(Boolean);
    const share = r.pool > 0 && mons.length ? Math.max(1, Math.floor(r.pool / mons.length)) : 0;
    for (const mon of mons) if (share) Box.addXp(mon, share);
    Box.warmEggs(r.time || 0);
    Box.save();
    Meta.bankMats(r.mats || {});
    Meta.addShards(r.shards || 0);
    Meta.data.bestTime = Math.max(Meta.data.bestTime || 0, r.time || 0);
    Meta.bank(r.coins || 0);
    Meta.addSpirit(r.spirit || 0);
    this.unlockNote = `Your last run was closed before it ended. You kept its ${r.coins || 0} coins, ${r.spirit || 0} Spirit${share ? `, ${share} EXP for each survivalmon` : ''} and the materials you gathered.`;
  }

  // ------------------------------------------------------------ update
  update(dt) {
    this.realTime += dt;
    if (this.mode !== 'title') {
      Meta.data.played = (Meta.data.played || 0) + dt; // total time played, shown on the player list
      if ((this.playSaveT = (this.playSaveT || 0) + dt) >= 30) { this.playSaveT = 0; Meta.save(); }
    }
    this.shakeT = Math.max(0, this.shakeT - dt); // in every mode, so a shake can never get stuck on
    this.updateMusic();
    this.checkOrientation();
    // once a second: medals and achievements to announce (in a run, a house or the town)
    if (['world', 'house', 'town'].includes(this.mode) && (this.newsT = (this.newsT || 0) - dt) <= 0) { this.newsT = 1; this.checkNews(); }
    if (Input.wasPressed('KeyM')) { const m = Audio.toggleMute(); this.toast(m ? 'Sound off' : 'Sound on'); }
    if (this.scene) this.updateScene(dt); // a story scene on the map: everything else waits
    else if (this.ui.guide) { /* the guide's box is open: the run and the town wait */ }
    else if (this.mode === 'world' || this.mode === 'house') {
      if (Input.anyPressed('Escape', 'KeyP')) {
        if (this.modal === 'pause') this.ui.closePause();
        else if (this.modal === 'bag') this.ui.closeBag();
        else if (!this.modal) this.ui.openPause();
      }
      if (Input.wasPressed('KeyB')) { if (this.modal === 'bag') this.ui.closeBag(); else if (!this.modal) this.ui.openBag(); }
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

  // The music for where you are: the town (and the title), a run's day, its night after sunset, a boss
  // while one is alive, and the Night Lord's own; none on the run's end screen or in the opening story.
  updateMusic() {
    let want = null;
    if (this.mode === 'town' || this.mode === 'title') want = 'town';
    else if (this.mode === 'world' || this.mode === 'house') {
      const b = this.boss && !this.boss.dead ? this.boss : null;
      want = this.finalStand || b?.type === 'night_lord' ? 'final' : b ? 'boss' : this.dayMinute > 17 ? 'night' : 'day';
      if (this.time > 100 && !b) Audio.preload(this.dayMinute > 15 ? 'night' : 'boss'); // the next one, ready in time
    }
    if (this.ui.screen === 'story' || this.modal === 'story' || !this.settings.music) want = null;
    Audio.music(want);
  }

  updateWorld(dt) {
    const P = this.player;
    this.time += dt;
    this.dark = this.darkness();
    this.darkNews();
    // a support's blessing: sparkles on everyone while it lasts
    if (this.blessed() !== NO_BLESS && Math.random() < dt * 10) {
      const who = [P, ...P.pets.filter((p) => !p.fainted)], o = who[Math.floor(Math.random() * who.length)];
      this.particles.add({ x: o.x + rand(-6, 6), y: o.y - rand(2, 14), vx: 0, vy: -14, life: 0.6, color: Math.random() < 0.5 ? '#ffffff' : '#ffe9a0' });
    }
    // A short run ends when its time is up. A full run is only won by defeating the Night Lord: past
    // 8:00 the night goes on until it falls (a win), you fall, or you end the run.
    if (this.time >= this.runLength) {
      if (this.runLength < RUN_LENGTH) { this.timeUp(); return; }
      if (!this.finalStand) {
        this.finalStand = true;
        this.banner('The Night Lord blocks the dawn!', '#c49aff', true, 'Defeat it to win the run');
        Audio.play('boss');
      }
    }
    if (this.storyRun && !this.storyHatched && this.time >= 10) this.hatchOnTheRoad();
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
      if (!near.looted) this.ui.tip('house');
      const label = near.looted ? 'Enter (searched)' : near.kind === 'shrine' ? 'Enter Shrine' : near.kind === 'barn' ? 'Enter Barn' : 'Enter House';
      this.ui.prompt(label, near.doorX, near.doorY - 30);
      if (act) this.enterHouse(near);
    } else this.ui.prompt(null);

    this.updateGathering(dt);
    if (!this.modal && this.evolveQueue.length) this.openEvolve(this.evolveQueue.shift());
    this.openPicks();
    Box.saveIfDirty();
  }

  // Whatever is waiting to be picked, one at a time: an evolve right after its card, hero level-ups,
  // team upgrades from the berry bar, chest picks, then a boss's skill pick
  openPicks() {
    const P = this.player;
    if (this.modal) return;
    if (P.evolvePicks > 0) { if (!this.ui.tip('evolve')) this.openLevelUp('evolve'); }
    else if (P.pendingLevels > 0 && !this.ui.tip('levelup')) this.openLevelUp();
    else if (P.teamPicks > 0 && !this.modal && !this.ui.tip('teambar')) this.openLevelUp('team');
    else if (P.houseBonus > 0 && !this.ui.tip('house_card')) this.openLevelUp('house');
    else if (P.bonusPicks > 0 && !this.modal) this.openLevelUp('bonus');
    else if (P.skillPicks > 0 && !this.modal && !this.ui.tip('skillpick')) this.openLevelUp('skill');
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
    // the trapdoor down to a basement, or the basement's ladder back up
    const act = Input.wasPressed('KeyE') || Input.wasPressed('Enter');
    const hatch = room.hatch, ladder = room.ladder;
    const way = hatch && dist2(P.x, P.y, hatch.cx, hatch.cy + 4) < 18 * 18 ? 'down' : ladder && dist2(P.x, P.y, ladder.x, ladder.y) < 20 * 20 ? 'up' : null;
    const wayD = way === 'down' ? dist2(P.x, P.y, hatch.cx, hatch.cy + 4) : way ? dist2(P.x, P.y, ladder.x, ladder.y) : Infinity;
    if (way && wayD <= bd) {
      if (way === 'down') this.ui.prompt('Climb down', hatch.cx, hatch.item.y - 4);
      else this.ui.prompt('Climb up', ladder.x, ladder.y - 30);
      if (act) { if (way === 'down') this.enterBasement(); else this.leaveBasement(); }
    } else if (near) {
      const names = { chest: 'Open Chest', crate: 'Search Crate', barrel: 'Search Barrel', pot: 'Search Pot', bookshelf: 'Search Shelf', cupboard: 'Search Cupboard', altar: 'Pray at Altar', gold: 'Take the Gold' };
      this.ui.prompt(names[near.type] || 'Search', near.x + near.w / 2, near.y - 4);
      if (act) this.openContainer(near);
    } else if (room.doorX != null && P.y > room.ph - 30 && Math.abs(P.x - room.doorX) < 16) {
      this.ui.prompt('Leave', room.doorX, room.ph + 16);
    } else this.ui.prompt(null);
    if (room.doorX != null && P.y > room.ph - 13 && Math.abs(P.x - room.doorX) < 14) this.exitHouse();
    if (!this.modal && this.evolveQueue.length) this.openEvolve(this.evolveQueue.shift());
    this.openPicks();
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
    P.trail = []; P.dashT = 0; P.dashA = null; P.ghosts.length = 0;
    const pw = this.room.pw;
    P.pets.forEach((pet, i) => { pet.x = clamp(P.x + (i % 2 ? -1 : 1) * 18 * (1 + (i >> 1)), 16, pw - 16); pet.y = P.y + 4; pet.state = 'follow'; });
    this.ui.prompt(null);
    this.ui.setPaused(true);
    Audio.play('door');
    const NAMES = { home: 'Cottage', bedroom: 'Cottage', library: 'Library', kitchen: 'Kitchen', storeroom: 'Storeroom', hayloft: 'Hayloft', stable: 'Stable', storehouse: 'Storehouse', altar: 'Old Shrine', crypt: 'Crypt' };
    const name = NAMES[this.room.theme] || (h.kind === 'shrine' ? 'Old Shrine' : h.kind === 'barn' ? 'Barn' : 'Cottage');
    this.feed(`${name}: the clock is paused`, '#bfeaff');
    this.ui.tip('house_in');
  }
  // Down the trapdoor into the house's basement (made the first time), and back up the ladder
  enterBasement() {
    const P = this.player, h = this.house, up = h.interior;
    if (!up.cellar) up.cellar = buildBasement(h, this.world.seed + h.id * 977 + 1);
    this.room = up.cellar;
    this.placeInRoom(up.cellar.spawn.x, up.cellar.spawn.y, 'down');
    Audio.play('door');
    if (!up.cellar.seen) {
      up.cellar.seen = true;
      this.feed('A hidden basement! Gold glitters in the dark', '#ffd84a');
    }
  }
  leaveBasement() {
    const hatch = this.house.interior.hatch;
    this.room = this.house.interior;
    this.placeInRoom(hatch.cx, hatch.item.y + hatch.item.h + 8, 'down');
    Audio.play('door');
  }
  placeInRoom(x, y, dir) {
    const P = this.player;
    P.x = x; P.y = y; P.dir = dir; P.faceAngle = dir === 'up' ? -Math.PI / 2 : Math.PI / 2; P.d8 = null;
    P.trail = []; P.dashT = 0; P.dashA = null; P.ghosts.length = 0;
    const pw = this.room.pw;
    P.pets.forEach((pet, i) => { pet.x = clamp(P.x + (i % 2 ? -1 : 1) * 16 * (1 + (i >> 1)), 16, pw - 16); pet.y = P.y + 4; pet.state = 'follow'; });
    this.ui.prompt(null);
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
    if (c.type === 'gold') this.particles.burst(cx, cy + 8, { n: 26, colors: ['#ffe07a', '#ffd23a', '#fff6c8'], speed: 80, life: 0.7, up: 40, gravity: 120 });
    this.applyDrops(res, cx, cy);
    // searched out once everything is open, the basement too (once it has been found)
    const up = this.house.interior, all = [...up.containers, ...(up.cellar?.containers || [])];
    if (all.every((k) => k.opened) && (!up.hatch || up.cellar)) {
      this.house.looted = true;
      this.toast('Everything here has been searched.');
    }
  }
  // Chests dropped by elites (1) and bosses (2) open where you pick them up.
  openWorldChest(n) {
    const P = this.player;
    Audio.play('chest');
    this.applyDrops(rollContainer(P, { type: 'chest', tier: n > 1 ? 'gold' : 'wood', wild: true }), P.x, P.y - 14);
  }
  // The zone you're in (checked twice a second); the HUD shows it under the radar.
  updateZone(dt) {
    this.zoneT -= dt;
    if (this.zoneT > 0) return;
    this.zoneT = 0.5;
    const z = this.world.zoneAtPx(this.player.x, this.player.y);
    if (z === this.zoneNow) return;
    this.zoneNow = z;
  }
  applyDrops(res, cx, cy) {
    const P = this.player;
    for (const d of res.drops) {
      if (d.kind === 'coin') { P.coins += d.value; this.runStats.coins += d.value; this.particles.number(cx, cy + 18, d.value, 'crit'); Audio.play('coin'); }
      else if (d.kind === 'heart') P.heal(20 * P.stats.heartMult);
      else if (d.kind === 'xp') { P.addXp(d.value); this.particles.number(cx, cy + 18, d.value, 'xp'); }
      else if (d.kind === 'berry') this.feedTeam(d.value);
      else if (d.kind === 'stone') this.gainStone(d.value);
      else if (d.kind === 'card') {
        // a chest inside a building offers a chest-only card (move speed, pickup range, EXP gain)
        if (this.mode !== 'house') continue; // only a chest inside a building holds an upgrade
        P.houseBonus = (P.houseBonus || 0) + d.value;
        this.toast('Treasure! A bonus upgrade to pick');
      }
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
      if (near && o.node.t > 0.4) this.ui.tip('gather');
      if (o.node.t >= GATHER_TIME * this.gatherTime()) this.gather(o);
    }
  }
  gather(o) {
    const P = this.player, k = o.node.kind;
    const n = Math.max(1, Math.round(GATHER[k] * (this.matMult || 1) * Meta.gatherMult(k) * (1 + this.boost('mats'))));
    P.mats[k] += n;
    this.world.removeObject(o);
    this.particles.burst(o.x, o.y - 6, { n: 14, colors: ['#ffe07a', '#ffffff', '#c8a46a'], speed: 60, life: 0.5, up: 20 });
    this.particles.text(o.x, o.y - 14, `+${n} ${MATERIALS[k].name}`, '#ffe07a');
    Audio.play('coin');
  }
  addMats(m) { for (const [k, v] of Object.entries(m)) this.player.mats[k] += Math.max(1, Math.round(v * (this.matMult || 1))); }
  gatherTime() { return Meta.gatherSpeed(); }
  // A gear piece for a random hero (often the one you're playing): any of their 4 sets, never a
  // piece you already own.
  rollGear() {
    const hero = this.player.hero.id, others = Object.keys(SETS).filter((h) => h !== hero);
    const order = Math.random() < 0.6 ? [hero, ...others.sort(() => Math.random() - 0.5)] : [...others.sort(() => Math.random() - 0.5), hero];
    for (const h of order) {
      const free = [];
      for (const set of HERO_SETS[h]) for (const s of SLOTS) if (!Meta.ownsPiece(h, s, set)) free.push({ hero: h, slot: s, set });
      if (free.length) return choice(free);
    }
    return null;
  }
  dropGear(x, y) {
    const gear = this.rollGear();
    if (gear) this.spawnPickup('gear', x, y, gear);
    else this.addMats({ iron: 2, wood: 3 });
  }
  collectGear(v) {
    const set = v.set || HERO_SETS[v.hero][0], name = pieceName(v.hero, set, v.slot), heroName = Meta.heroName(v.hero);
    if (!Meta.addGear(v.hero, v.slot, set)) { this.addMats({ iron: 2, wood: 3 }); this.toast(`You already have ${name}: broke it down for materials`); return; }
    const locked = !Meta.isHeroUnlocked(v.hero);
    this.feed(`Gear: ${heroName}'s ${name}! ${GEAR_SETS[set].name}${locked ? ` (waits until you unlock ${heroName})` : ''}`, GEAR_SETS[set].color);
    if (Meta.unlock('workshop')) this.toast('The Workshop is open in town!');
    Audio.play('chest');
    this.ui.tip('gear');
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
    return t;
  }
  // Support survivalmons' blessings: a short boost for the hero and the whole team
  // ...and items from the bag (Swift Tonic, Power Brew, Iron Tonic) add theirs on top
  blessed() {
    const B = this.blessing, b = B && B.end > this.time ? B : NO_BLESS;
    const dmg = this.boost('dmg'), haste = this.boost('haste'), def = this.boost('def');
    if (!dmg && !haste && !def) return b;
    return { dmg: b.dmg + dmg, haste: 1 - (1 - b.haste) * (1 - haste), def: 1 - (1 - b.def) * (1 - def), end: Math.max(b.end, this.time + 1) };
  }
  // An item boost still running: its strength, else 0
  boost(stat) { const x = this.boosts?.[stat]; return x && x.end > this.time ? x.v : 0; }
  // Uses one item from the bag (key "id:grade"). Returns false (and keeps it) when it would do nothing.
  useItem(key) {
    const { id, g, item } = parseKey(key), P = this.player;
    if (!item || !Meta.itemCount(key) || (this.mode !== 'world' && this.mode !== 'house')) return false;
    const v = item.eff(g), onScreen = (e) => !e.dead && Math.abs(e.x - P.x) < this.view.w / 2 + 20 && Math.abs(e.y - P.y) < this.view.h / 2 + 20;
    const no = (why) => { this.ui.toast(why); return false; };
    if (item.kind === 'boost') {
      // another of the same kind adds a minute and keeps the stronger one
      const b = this.boosts[item.stat], on = b && b.end > this.time;
      this.boosts[item.stat] = { v: on ? Math.max(b.v, v) : v, end: (on ? b.end : this.time) + BOOST_TIME, icon: item.icon };
    } else if (id === 'heal') {
      P.heal(P.stats.maxHp * v);
      for (const p of P.pets) if (!p.fainted) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * v);
      this.particles.burst(P.x, P.y - 8, { n: 24, colors: ['#9af08a', '#ffffff'], speed: 70, life: 0.6, up: 20 });
    } else if (id === 'feather') {
      const down = P.pets.filter((p) => p.fainted);
      if (!down.length) return no('No survivalmon has fainted.');
      for (const p of down) {
        if (p.carriedBy) p.carriedBy.carry = null; // a Cage Drone lets go
        p.carriedBy = null; p.fainted = false; p.hp = p.maxHp * v; p.faintT = 0;
        this.particles.burst(p.x, p.y - 8, { n: 20, colors: ['#ffd84a', '#ffffff'], speed: 60, life: 0.6, up: 20 });
      }
      P.recompute(); this.applyTeamPassives();
    } else if (id === 'frost') {
      for (const e of this.enemies) if (onScreen(e)) e.freeze = Math.max(e.freeze || 0, e.boss ? v / 2 : v);
      this.addEffect({ type: 'flashring', x: P.x, y: P.y, R: 260, life: 0.5, color: '#bfeaff' });
    } else if (id === 'blast') {
      this.addEffect({ type: 'flashring', x: P.x, y: P.y, R: 260, life: 0.5, color: '#ffb070' });
      for (const e of this.enemies) if (onScreen(e)) this.damageEnemy(e, e.maxHp * v * (e.boss ? 0.1 : 1), { raw: true, silent: true });
      this.shake(5, 0.35); Audio.play('explode');
    } else if (id === 'horn') {
      if (!this.canCatch) return no('Wild survivalmons come once your first egg has hatched.');
      let n = 0;
      for (let i = 0; i < v; i++) {
        const zone = ZONES[this.world.zoneAtPx(P.x, P.y)];
        const sp = Math.random() < 0.65 ? choice(zone.mons) : choice(BASE_IDS);
        const e = this.director.spawn('wild', { wild: sp, corrupted: true });
        if (e) { n++; if (g >= 2) e.lure = g >= 4 ? 2 : 1; }
      }
      if (!n) return no('No room for a wild survivalmon here. Try again in a moment.');
      this.feed(`The horn calls ${n === 1 ? 'a survivalmon' : `${n} survivalmons`} turned by the star! Beat them to free them`, '#c8a0ff');
    } else if (id === 'warm') {
      if (!Box.eggs.length) return no('No eggs in your Hatchery to warm.');
      Box.warmEggs(v);
    }
    Meta.takeItem(key);
    this.feed(`Used ${itemName(id, g)}`, '#ffe07a');
    Audio.play(item.kind === 'boost' ? 'levelup' : 'heal');
    return true;
  }
  bless(b) {
    const B = this.blessing ||= { dmg: 0, haste: 0, def: 0, end: 0 };
    if (B.end <= this.time) B.dmg = B.haste = B.def = 0;
    B.dmg = Math.max(B.dmg, b.dmg || 0); B.haste = Math.max(B.haste, b.haste || 0); B.def = Math.max(B.def, b.def || 0);
    B.end = Math.max(B.end, this.time + b.dur);
  }
  // Passive skills that work for the whole team or the whole run.
  applyTeamPassives() {
    const P = this.player, sum = (id) => P.pets.reduce((s, p) => s + (p.fainted ? 0 : p.pass[id] || 0), 0);
    this.cry = sum('cry');
    const hb = this.heroBonus || { coins: 0, wild: 0 };
    this.coinMult = Meta.coinMult() * (1 + sum('nose') + hb.coins);
    this.wildMult = Meta.wildMult() * (1 + sum('star') + hb.wild) * (1 + Shrine.bonus('wild'));
    this.matMult = (1 + sum('nose') + (hb.mats || 0)) * (this.tierMult?.mats || 1);
  }
  // The first run: your egg hatches in your arms and your first survivalmon fights beside you
  hatchOnTheRoad() {
    this.storyHatched = true;
    const egg = Box.eggs.find((e) => e.kind === 'starter');
    if (!egg) return;
    egg.progress = egg.need;
    const P = this.player;
    for (const mon of Box.hatchReady()) {
      if (!Box.inTeam(mon.id)) Box.toggleTeam(mon.id);
      const pet = this.addPet(mon);
      if (pet) { pet.x = P.x + 10; pet.y = P.y + 6; }
      this.particles.burst(P.x + 10, P.y - 4, { n: 30, colors: ['#ffe07a', '#ffffff', '#9af08a'], speed: 80, life: 0.7, up: 30 });
      this.banner(`Your egg hatched! ${SPECIES[mon.species].name} fights at your side!`, '#ffe07a', true);
    }
    Audio.play('hatch');
  }
  hatchMult() { return 1 + Meta.buildingBonus('hatchery', 'speed') + Shrine.bonus('hatch'); }
  // An egg found in a run goes to the Hatchery (or turns into coins if every nest is full).
  findEgg(x, y) {
    const species = choice([...BASE_IDS, ...BASE_IDS.slice(0, 5)]);
    if (Box.addEgg({ species, skills: rollSkills(species, { odds: this.tierOdds }), need: FOUND_HATCH, kind: 'found' })) {
      this.feed('An egg! It waits in your Hatchery', '#ffe07a');
      this.ui.tip('egg');
    } else {
      this.player.coins += 30;
      this.toast('Your Hatchery is full, so the egg became 30 coins.');
    }
    this.particles.burst(x, y - 6, { n: 16, colors: ['#ffe07a', '#ffffff'], speed: 60, life: 0.5, up: 20 });
    Audio.play('chest');
  }
  // Berries heal a little and fill the team's berry bar; a full bar is a team upgrade (5, 7, 9... berries).
  // They drop about 4 times as often as before the berry bar, so each one heals a quarter as much.
  feedTeam(n) {
    const P = this.player;
    P.heal(0.5 * n);
    if (!P.pets.length) { this.toast('Berries! (+HP) Bring survivalmons: berries power them up.'); return; }
    for (const pet of P.pets) pet.heal(0.75 * n);
    if (P.berries == null) { P.berries = 0; P.teamNext = 5; P.teamLevel = 0; P.teamPicks = 0; }
    P.berries += n;
    while (P.berries >= P.teamNext) { P.berries -= P.teamNext; P.teamNext += 2; P.teamPicks++; }
    Audio.play('gem');
  }
  gainStone(id) {
    Box.addItem(id);
    this.feed(`Rare find: ${STONES[id].name}! Kept at your Ranch`, '#c88aff');
    Audio.play('chest');
    this.ui.tip('stone');
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
  refreshCombos() { /* combos came from artifacts and spells, which are gone */ }
  combo() { return false; }

  // Hero level-ups (gems), team upgrades (the berry bar), evolves (after an "Evolve the weapon" card),
  // chest picks and a boss's skill pick all open here. The level shown is the one this pick is for.
  openLevelUp(extra = null) {
    const P = this.player;
    const want = extra || 'hero';
    const cards = levelUpOptions(P, want);
    // a skill pick with no skill left to raise turns into a bonus pick
    const kind = this.levelKindNow = want === 'skill' && cards[0]?.kind !== 'skill' ? 'bonus' : want;
    const level = kind === 'hero' ? P.level - P.pendingLevels + 1 : kind === 'team' ? P.teamLevel + 1 : kind === 'evolve' ? this.evolveTier : 0;
    if (!cards.length) { this.donePick(want); return; }
    this.modal = 'levelup';
    this.ui.prompt(null);
    Audio.play(kind === 'evolve' ? 'combo' : 'levelup');
    this.ui.showLevelUp(cards, (card) => {
      applyLevelCard(P, card);
      this.donePick(want);
      this.modal = null;
    }, kind, level);
  }
  donePick(kind) {
    const P = this.player;
    if (kind === 'bonus') P.bonusPicks--; else if (kind === 'house') P.houseBonus--; else if (kind === 'skill') P.skillPicks--;
    else if (kind === 'team') { P.teamPicks--; P.teamLevel++; } else if (kind === 'evolve') P.evolvePicks--; else P.pendingLevels--;
  }
  rerollLevelUp() { return levelUpOptions(this.player, this.levelKindNow); }

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
    for (let i = 0; i < 10; i++) this.spawnPickup('berry', e.x + rand(-20, 20), e.y + rand(-14, 14));
    if (Math.random() < 0.4 * this.player.stats.luck * (this.tierMult?.stone || 1)) this.spawnPickup('stone', e.x, e.y - 12, this.rollStone());
    this.shake(8, 0.5);
    if (this.boss === e) this.boss = null;
    this.ui.bossBar(null);
    const run = this.runId;
    if (e.type === 'night_lord') setTimeout(() => this.mode === 'world' && this.runId === run && this.winRun(), 1500);
  }
  // The Night Lord is down. The first win at a gate's Lv 1 (North, South, East, West) finds a friend:
  // they come running up to you right here, before the end screen.
  winRun() {
    const id = FRIEND_AT_TIER[this.tier || 0];
    if (id && (this.tier || 0) === Meta.gates && !Meta.isHeroUnlocked(id)) {
      this.clearEnemies();
      this.playScene(reunionScene(this, id)).then(() => { if (this.mode === 'world') this.victory(); });
    } else this.victory();
  }

  // ------------------------------------------------------------ helpers used by content
  spawnEnemy(type, x, y, opts) {
    const e = new Enemy(this, type, x, y, opts);
    Box.markSeen(opts?.wild || type, opts?.wild && this.mode === 'world' ? this.world.zoneAtPx(x, y) : null);
    if (!opts?.wild && this.mode === 'world') Box.meetFoe(type, this.world.zoneAtPx(x, y), this.tier || 0); // for the Survidex's Monsters tab
    this.enemies.push(e);
    return e;
  }
  sprite(name) { return SPR[name].frames[0]; }
  shake(a, t) { if (!this.settings.shake) return; this.shakeAmt = Math.max(this.shakeT > 0 ? this.shakeAmt : 0, a); this.shakeT = Math.max(this.shakeT, t); }
  // Banners are for the big moments only (a run starting, a boss arriving or falling, nightfall, the
  // final fight). Everything else in a run goes to the feed: small lines at the top-left that fade.
  banner(text, color, big = false, sub = '') { this.ui.banner(text, color, big, sub); }
  feed(text, color) { this.ui.feed(text, color); }
  // Medals just won and achievement tiers just reached: a banner for the first, toasts for the rest
  // (just toasts over a town page, where banners don't show)
  checkNews() {
    if (this.mode === 'town') {
      // buildings finish in town (never mid-run), and training spots roll for skill grades
      const built = Meta.settleBuildings(), research = Shrine.settle();
      for (const id of built) Box.news.push({ kind: 'built', id });
      if (research) Box.news.push({ kind: 'research', level: research });
      Box.settleTrainingSkills();
      if ((built.length || research) && this.ui.screen !== 'town') this.ui.rerender(); // the open page shows the new level
    }
    const achv = checkAchievements();
    if (achv.some((a) => a.name !== 'Skyfall Shards')) { if (this.mode === 'town') this.ui.tip('achv'); else this.achvTip = true; } // told in town
    const out = [...Box.news.splice(0).map((n) => this.newsLine(n)).filter(Boolean),
      ...achv.map((a) => ({ title: a.name === 'Skyfall Shards' ? `+${a.pay} Skyfall Shards!` : `Achievement: ${a.name}!`, sub: `${a.desc} · +${a.pay} Skyfall Shards`, color: '#c8a8ff' }))];
    if (!out.length) return;
    const page = this.mode !== 'world' || this.modal;
    if (this.mode === 'world' || this.mode === 'house') out.forEach((n) => this.feed(n.title, n.color)); // the details wait for town
    else out.forEach((n, i) => (i === 0 && !page ? this.banner(n.title, n.color, false, n.sub) : this.toast(`${n.title} ${n.sub}`)));
    Audio.play('levelup');
  }
  // One Box.news entry as a { title, sub, color } line
  newsLine(n) {
    if (n.medal) return { title: `${MEDALS[n.medal].name} medal: ${SPECIES[n.species].name}!`, sub: `You ${MEDALS[n.medal].desc}`, color: MEDALS[n.medal].color };
    if (n.kind === 'built') return { title: `${BUILDINGS[n.id].name} is now Lv ${Meta.buildingLevel(n.id)}!`, sub: BUILDINGS[n.id].levelText(Meta.buildingLevel(n.id)), color: '#ffe07a' };
    if (n.kind === 'research') return { title: `Research done: tier odds level ${n.level}!`, sub: 'New catches and eggs roll better skills', color: '#c8a8ff' };
    if (n.kind === 'trainSkill') {
      const m = Box.get(n.monId);
      if (!m) return null;
      const k = n.skill, skill = k.k === 'u' ? SPECIES[k.sp].unique.name : PASSIVES[k.id].name;
      return { title: `Training paid off: ${m.nick || SPECIES[m.species].name}'s ${skill} is now ${TIERS[n.to]}!`, sub: 'Hard work at the Ranch raised a skill grade', color: '#ffd84a' };
    }
    return null;
  }
  toast(text) { if (this.mode === 'world' || this.mode === 'house') this.ui.feed(text); else this.ui.toast(text); }
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
    if (this.mode === 'house' || (this.mode === 'town' && this.townRoom)) return { x: (x + this.roomOff.x) * this.view.scale, y: (y + this.roomOff.y) * this.view.scale };
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
      for (const a of this.sceneActors || []) list.push({ y: a.y, actor: a });
    }
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.actor) { this.drawSceneActor(ctx, it.actor, cam, this.realTime || 0); continue; }
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
      this.drawEdgeArrows(ctx, cam);
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
      ctx.beginPath(); ctx.arc(x, y - 1, 7, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, o.node.t / (GATHER_TIME * this.gatherTime()))); ctx.stroke();
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
  // The Blight grows with the dark: weaker in daylight, as strong as it was written at sunset, much
  // stronger at night (full night from about 6:40 of the 8 minute run). hp is for monsters as they
  // appear; dmg and speed count all the time, so a monster from the afternoon hits harder once night
  // falls. Bosses feel half of it (Enemy). Wild survivalmons aren't the Blight: they stay the same.
  darkness() {
    const { sunset, night } = this.nightLevels();
    return { sunset, night, hp: 0.85 + 0.15 * sunset + 0.3 * night, dmg: 0.8 + 0.2 * sunset + 0.4 * night, speed: 1 + 0.12 * night };
  }
  // A banner when the sun starts to set and another when night is complete
  darkNews() {
    const d = this.dark;
    if (this.darkStep < 1 && d.sunset > 0.02) {
      this.darkStep = 1;
      this.feed('The sun is setting: monsters grow stronger', '#ffb070');
      this.ui.tip('sunset');
    } else if (this.darkStep < 2 && d.night > 0.98) {
      this.darkStep = 2;
      this.banner('Night has fallen!', '#c49aff', true, 'The Blight is at full strength');
      this.shake(4, 0.4);
    }
  }
  // A small arrow at the edge of the screen points to each wild survivalmon and boss out of view
  drawEdgeArrows(ctx, cam) {
    if (this.mode !== 'world') return;
    const V = this.view, top = 18, m = 10;
    for (const e of this.enemies) {
      if (e.dead || !(e.wild || e.boss)) continue;
      const sx = e.x - cam.x, sy = e.y - 10 - cam.y;
      if (sx > 0 && sx < V.w && sy > top && sy < V.h) continue;
      const cx = V.w / 2, cy = V.h / 2, dx = sx - cx, dy = sy - cy;
      const k = Math.min((V.w / 2 - m) / Math.abs(dx || 1e-6), (V.h / 2 - m - top / 2) / Math.abs(dy || 1e-6));
      const ax = cx + dx * k, ay = cy + dy * k + (dy < 0 ? top / 2 : 0), a = Math.atan2(dy, dx);
      const pulse = 1 + Math.sin(this.realTime * 6) * 0.15;
      ctx.save(); ctx.translate(Math.round(ax), Math.round(ay)); ctx.rotate(a); ctx.scale(pulse, pulse);
      ctx.fillStyle = '#0e1a1d'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = e.boss ? '#ff5a4a' : e.corrupted ? '#c8a0ff' : '#5ae8ff';
      ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-3, -4); ctx.lineTo(-3, 4); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  renderLighting(cam) {
    const { sunset, night } = this.nightLevels();
    const haze = this.tierMult?.haze || 0; // past the newer gates the Blight hangs in the air as a purple haze
    if (sunset < 0.01 && !haze) return;
    const L = this.lightCtx, V = this.view;
    const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
    let c = lerp3([255, 255, 255], [120, 80, 170], haze);
    c = lerp3(c, [255, 190, 140], sunset * (1 - haze));
    c = lerp3(c, [58, 66, 132], night);
    L.setTransform(WS, 0, 0, WS, 0, 0);
    L.globalCompositeOperation = 'source-over';
    L.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
    L.fillRect(0, 0, V.w, V.h);
    const k = Math.max(sunset * 0.4, night, haze * 1.5);
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
    const list = room.furniture.filter((f) => !(f.type === 'gold' && f.opened)).map((f) => ({ y: f.flat ? -1e4 : f.y + f.h, f }));
    list.push({ y: P.y, player: P });
    for (const p of P.pets) list.push({ y: p.y, pet: p });
    for (const n of room.npcs || []) list.push({ y: n.y, npc: n });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.npc) {
        const n = it.npc, a = NPC_ART[n.id];
        ctx.fillStyle = 'rgba(20,10,10,0.25)'; ctx.beginPath(); ctx.ellipse(n.x + ox, n.y + oy, 7, 2.5, 0, 0, TAU); ctx.fill();
        if (a) drawNpcArt(ctx, a, n.x + ox, n.y + oy, n.dir, this.realTime + (n.seed || 0), false);
      } else if (it.f) {
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
    if (room.dark) this.drawCellarDark(ctx, room, ox, oy);
    this.particles.drawNumbers(ctx, cam);
  }
  // A basement is dark: light round the hero, the torches on the wall and the candles
  drawCellarDark(ctx, room, ox, oy) {
    const V = this.view, P = this.player;
    const c = this.darkCv || (this.darkCv = document.createElement('canvas'));
    const w = Math.ceil(V.w), h = Math.ceil(V.h);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const g = c.getContext('2d');
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(8,4,14,0.78)'; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(0.55, `rgba(0,0,0,${a * 0.7})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    };
    const flick = 1 + Math.sin(this.realTime * 9) * 0.04;
    hole(P.x + ox, P.y - 8 + oy, 84, 1);
    for (const x of room.torches) hole(x + ox, 18 + oy, 58 * flick, 0.95);
    for (const f of room.furniture) if (f.spr === 'candles') hole(f.x + f.w / 2 + ox, f.y + oy, 40 * flick, 0.85);
    ctx.drawImage(c, 0, 0, w, h);
  }
}

Object.assign(Game.prototype, Combat, Pickups, TownMode, SceneMode);
export { HEROES, TAU };
