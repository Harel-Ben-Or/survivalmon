// Progress that lasts between runs: banked coins and Spirit, Training Hall levels, the chosen hero,
// which buildings are open and their levels. Coins are the hero's money; Spirit (earned by what your
// survivalmons do) pays for the Spirit Shrine. Skyfall Shards are the rare currency (content/shop.js).
import { RUN_LENGTH } from './director.js';
import { BUILDINGS, buildingCost, buildMins } from '../content/buildings.js';
import { SLOTS, SLOT_STAT, SETS, HERO_BOOST, MILESTONES, slotCost, GEAR_SETS, HERO_SETS, SET_PIECES, TOOLS, toolCost } from '../content/gear.js';
import { itemKey, parseKey, STACK_MAX, rushCost } from '../content/shop.js';
import { Profiles } from './profiles.js';
import { armorPct } from './armor.js';
import { HEROES } from '../content/heroes.js';

const KEY = Profiles.key('meta'); // this player's save
export const SPIRIT_START = 100;
export const MAT_KEYS = ['wood', 'stone', 'clay', 'iron'];
// gates: the newest gate opened (0 = only the North Gate, see content/gates.js); gateTier: the one
// picked for the next run; gateNew: a gate just earned, not yet told in town
// gear[hero][slot] = { own: { set: true }, on: set } (the pieces found for that slot, and the one worn)
// items: the bag, { "id:grade": count }; builds: upgrades being built, { building: { to, done } }
// tools: Workshop tool levels; shards: Skyfall Shards; bought: Skyfall counter buys, { day, n: { offer: count } }
// guide: the beginner's guide (content/guide.js), { on, seen: { tip: true } }
const empty = () => ({ v: 1, coins: 0, spirit: SPIRIT_START, shards: 0, gates: 0, gateTier: 0, gateNew: 0, training: {}, hero: 'rowan', runs: 0, unlocked: {}, buildings: {}, bestTime: 0,
  mats: { wood: 0, stone: 0, clay: 0, iron: 0 }, gear: {}, slots: {}, heroes: { rowan: true }, items: {}, builds: {}, tools: {}, bought: { day: '', n: {} }, guide: { on: true, seen: {} } });
// The old Merchant's "next run" goods become bag items (grade I); the Time Candle is refunded
const OLD_BUFFS = { snack: 'power', tonic: 'iron', horn: 'horn', pick: 'pick', feather: 'feather', warmer: 'warm' };

// Training Hall upgrades. `mods` turns a level into hero stat mods (same keys as Player.recompute).
export const TRAINING = [
  { id: 'runtime', name: 'Run time', icon: 'up_runtime', max: 18, base: 5, desc: (L) => `${fmtTime(runLengthAt(L))} per run` },
  { id: 'maxHp', name: 'Max HP', icon: 'up_hp', max: 30, base: 6, desc: (L) => `+${L * 10} max HP`, mods: (L) => ({ maxHp: L * 10 }) },
  { id: 'might', name: 'Damage', icon: 'up_damage', max: 30, base: 8, desc: (L) => `+${L * 5}% damage for your hero, +${L * 3}% for your survivalmons`, mods: (L) => ({ might: L * 0.05, petPower: L * 0.03 }) },
  { id: 'speed', name: 'Move speed', icon: 'up_speed', max: 15, base: 8, desc: (L) => `+${L * 3}% move speed`, mods: (L) => ({ speed: L * 0.03 }) },
  { id: 'haste', name: 'Attack speed', icon: 'up_haste', max: 15, base: 10, desc: (L) => `-${L * 3}% weapon cooldowns`, mods: (L) => ({ haste: L * 0.03 }) },
  { id: 'magnet', name: 'Pickup range', icon: 'up_magnet', max: 15, base: 6, desc: (L) => `+${L * 10}% pickup range`, mods: (L) => ({ magnet: L * 0.1 }) },
  { id: 'armor', name: 'Armor', icon: 'up_armor', max: 10, base: 12, desc: (L) => `+${L * 2} armor: ${armorPct(L * 2)}% less damage (half that for survivalmons)`, mods: (L) => ({ armor: L * 2 }) },
  { id: 'coins', name: 'Coin gain', icon: 'up_coins', max: 20, base: 10, desc: (L) => `+${L * 10}% coins per kill` },
  { id: 'wild', name: 'Wild survivalmons', icon: 'up_wild', max: 10, base: 15, desc: (L) => `Wild survivalmons appear ${L * 10}% more often` },
];

// Training Hall prices: each level costs more than the one before, 1.4x for the first three levels,
// and the rate climbs 0.005 every 3 levels after that (1.405x, 1.41x, ...; never past 1.5x). So
// Damage Lv 10 costs 171 coins, Lv 20 about 5,700 and Lv 30 about 216,000. `every` is how many levels
// share a rate (2 would make it climb a little faster).
export const TRAIN_RATE = { start: 1.4, step: 0.005, every: 3, max: 1.5 };
export function trainCost(base, L) {
  const R = TRAIN_RATE;
  let c = base;
  for (let i = 1; i <= L; i++) c *= Math.min(R.max, R.start + R.step * Math.floor((i - 1) / R.every));
  return Math.round(c);
}

// 20 s at first, growing a little faster each level, up to the longest run (8 minutes at level 18).
export function runLengthAt(L) { return Math.min(RUN_LENGTH, 20 + 10 * L + L * L); }
// A name typed by the player: trimmed, single spaces, at most 14 characters
export const cleanName = (n) => String(n || '').replace(/[<>"&]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14);
function fmtTime(s) { return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; }

export const Meta = {
  data: empty(),

  load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && d.v === 1) {
        const e = empty();
        this.data = { ...e, ...d, spirit: d.spirit ?? SPIRIT_START, training: { ...d.training }, unlocked: { ...d.unlocked }, buildings: { ...d.buildings }, mats: { ...e.mats, ...d.mats }, heroes: { ...e.heroes, ...d.heroes },
          items: { ...d.items }, builds: { ...d.builds }, tools: { ...d.tools }, bought: d.bought || e.bought, guide: d.guide || e.guide };
        this.migrate(!d.guide);
        // the last version whose changes this player has read (What's new). A save from before the
        // page gets the updates since numbered versions began (0.72)
        if (!this.data.seenVersion) this.data.seenVersion = '0.71';
      }
    } catch { /* storage unavailable: start fresh */ }
    if (!this.data.seenVersion) this.data.seenVersion = globalThis.SURVIVALMON_VERSION || '0.71'; // a new player: nothing is "new" to them yet
    return this;
  },
  // Older saves: a gear slot was just `true` (the hero's own set's piece); Merchant buffs were for the next run
  // A save from before the beginner's guide keeps playing without it (unless it never finished a run)
  migrate(noGuide = false) {
    const D = this.data;
    if (noGuide) D.guide = { on: !(D.runs > 0 || D.named), seen: {} };
    for (const [hero, slots] of Object.entries(D.gear || {})) {
      for (const s of SLOTS) if (slots[s] === true) slots[s] = { own: { [HERO_SETS[hero][0]]: true }, on: HERO_SETS[hero][0] };
    }
    if (D.buffs) {
      for (const b of D.buffs) { if (OLD_BUFFS[b]) this.addItem(OLD_BUFFS[b], 1, 1, false); else if (b === 'candle') D.coins += 30; }
      delete D.buffs;
    }
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage unavailable */ } },

  // ---------------------------------------------------------- the beginner's guide
  get guideOn() { return !!this.data.guide?.on; },
  tipSeen(id) { return !!this.data.guide?.seen?.[id]; },
  markTip(id) { const G = (this.data.guide ||= { on: true, seen: {} }); (G.seen ||= {})[id] = true; this.save(); },
  setGuide(on) { (this.data.guide ||= { seen: {} }).on = !!on; this.save(); },

  // The main character: a name and a look (boy or girl), asked when a new game starts
  get playerName() { return this.data.name || 'Ranger'; },
  get gender() { return this.data.gender || null; },
  setGender(gd) { this.data.gender = gd === 'girl' ? 'girl' : 'boy'; this.save(); },
  get named() { return !!this.data.named; },
  setName(n) {
    this.data.name = cleanName(n) || 'Ranger';
    this.data.named = true;
    this.save();
    return this.data.name;
  },
  // A hero's name as shown everywhere: the main character (Rowan's place) goes by the player's name
  heroName(id) { return id === 'rowan' ? this.playerName : HEROES.find((h) => h.id === id)?.name || id; },
  get coins() { return this.data.coins; },
  get gates() { return this.data.gates || 0; },
  get spirit() { return Math.floor(this.data.spirit || 0); },
  addSpirit(n) { this.data.spirit = (this.data.spirit || 0) + n; this.save(); },
  get shards() { return Math.floor(this.data.shards || 0); },
  addShards(n) { this.data.shards = (this.data.shards || 0) + Math.max(0, Math.floor(n)); this.save(); },
  spendShards(n) { if (n > this.shards) return false; this.data.shards -= n; this.save(); return true; },
  get hero() { return this.data.hero; },
  setHero(id) { this.data.hero = id; this.save(); },
  bank(n) { this.data.coins += Math.max(0, Math.floor(n)); this.data.runs++; this.save(); },

  level(id) { return this.data.training[id] || 0; },
  // Training Hall upgrades stop at the hall's level cap (run time has its own fixed top).
  maxLevel(u) { return u.id === 'runtime' ? u.max : Math.min(u.max, this.buildingBonus('training', 'cap')); },
  cost(id) {
    const u = TRAINING.find((x) => x.id === id), L = this.level(id);
    return L >= this.maxLevel(u) ? null : trainCost(u.base, L);
  },
  buy(id) {
    const c = this.cost(id);
    if (c === null || c > this.data.coins) return false;
    this.data.coins -= c;
    this.data.training[id] = this.level(id) + 1;
    this.save();
    return true;
  },

  // ---------------------------------------------------------- buildings
  isUnlocked(id) { return !!this.data.unlocked[id]; },
  // The arrow in town: the next stop of a new player's tour (tour: building ids, 'gate' = Ollie at the
  // North Gate), else a building that just opened. visitPlace ticks one off.
  nextPlace() { return this.data.tour?.[0] || this.data.newPlaces?.[0] || null; },
  visitPlace(id) {
    let changed = false;
    for (const k of ['tour', 'newPlaces']) if (this.data[k]?.includes(id)) { this.data[k] = this.data[k].filter((x) => x !== id); changed = true; }
    if (changed) this.save();
  },
  // Returns true the first time a building opens.
  unlock(id) {
    if (this.data.unlocked[id]) return false;
    this.data.unlocked[id] = true;
    (this.data.newPlaces ||= []).push(id); // the arrow in town points at it until you go in
    this.save();
    return true;
  },
  buildingLevel(id) { return this.data.buildings[id] || 1; },
  buildingBonus(id, key) { return BUILDINGS[id].bonus[key][this.buildingLevel(id) - 1]; },

  // Pays a cost { coins, wood, stone, clay, iron, shards } if there's enough of everything.
  canAfford(c) { return !!c && this.data.coins >= (c.coins || 0) && this.shards >= (c.shards || 0) && MAT_KEYS.every((k) => this.data.mats[k] >= (c[k] || 0)); },
  pay(c) {
    if (!this.canAfford(c)) return false;
    this.data.coins -= c.coins || 0;
    this.data.shards -= c.shards || 0;
    for (const k of MAT_KEYS) this.data.mats[k] -= c[k] || 0;
    this.save();
    return true;
  },
  // An upgrade is paid when it starts and takes buildMins to build; the building works at its old
  // level meanwhile. building(id) = { to, done } while it's being built, else null.
  building(id) { return this.data.builds[id] || null; },
  upgradeBuilding(id, now = Date.now()) {
    const L = this.buildingLevel(id), c = buildingCost(id, L);
    if (this.building(id) || !this.pay(c)) return false;
    this.data.builds[id] = { to: L + 1, done: now + buildMins(L) * 60000 };
    this.save();
    return true;
  },
  // Finishes upgrades whose time is up. Returns the ids finished.
  settleBuildings(now = Date.now()) {
    const out = [];
    for (const [id, b] of Object.entries(this.data.builds)) {
      if (now < b.done) continue;
      this.data.buildings[id] = Math.max(this.buildingLevel(id), b.to);
      delete this.data.builds[id];
      out.push(id);
    }
    if (out.length) this.save();
    return out;
  },
  // Skyfall Shards to finish a build now (null if nothing's being built)
  rushCost(id, now = Date.now()) { const b = this.building(id); return b ? rushCost(b.done - now) : null; },
  rushBuilding(id, now = Date.now()) {
    const c = this.rushCost(id, now);
    if (c === null || !this.spendShards(c)) return false;
    this.data.builds[id].done = now;
    this.settleBuildings(now);
    return true;
  },
  bankMats(m) { for (const k of Object.keys(m)) this.data.mats[k] = (this.data.mats[k] || 0) + Math.floor(m[k]); this.save(); },

  // ---------------------------------------------------------- heroes and gear
  isHeroUnlocked(id) { return !!this.data.heroes[id]; },
  unlockHero(id) { if (this.data.heroes[id]) return false; this.data.heroes[id] = true; this.save(); return true; },
  // A slot has gear once any piece for it was found; it wears one piece (one set's) at a time.
  hasGear(hero, slot) { return !!this.worn(hero, slot); },
  ownsPiece(hero, slot, set) { return !!this.data.gear[hero]?.[slot]?.own?.[set]; },
  worn(hero, slot) { return this.data.gear[hero]?.[slot]?.on || null; },
  // Returns true for a new piece, false for a duplicate (salvaged by the caller). A slot with nothing
  // worn puts the new piece on.
  addGear(hero, slot, set = HERO_SETS[hero][0]) {
    const g = this.data.gear[hero] || (this.data.gear[hero] = {});
    const s = g[slot] || (g[slot] = { own: {}, on: null });
    if (s.own[set]) return false;
    s.own[set] = true;
    if (!s.on) s.on = set;
    this.save();
    return true;
  },
  wear(hero, slot, set) {
    if (!this.ownsPiece(hero, slot, set)) return false;
    this.data.gear[hero][slot].on = set;
    this.save();
    return true;
  },
  piecesOwned(hero) { return SLOTS.reduce((n, s) => n + Object.keys(this.data.gear[hero]?.[s]?.own || {}).length, 0); },
  setWorn(hero, set) { return SLOTS.filter((s) => this.worn(hero, s) === set).length; },
  gearCount(hero) { return SLOTS.filter((s) => this.hasGear(hero, s)).length; },
  slotLevel(hero, slot) { return this.data.slots[hero]?.[slot] || 0; },
  slotCap() { return this.buildingBonus('workshop', 'cap'); },
  slotUpCost(hero, slot) { const L = this.slotLevel(hero, slot); return L >= this.slotCap() ? null : slotCost(L); },
  slotUp(hero, slot) {
    if (!this.hasGear(hero, slot) || !this.pay(this.slotUpCost(hero, slot))) return false;
    const s = this.data.slots[hero] || (this.data.slots[hero] = {});
    s[slot] = (s[slot] || 0) + 1;
    this.save();
    return true;
  },
  minSlotLevel(hero) { return Math.min(...SLOTS.map((s) => (this.hasGear(hero, s) ? this.slotLevel(hero, s) : 0))); },
  // Hero stat mods from the gear the hero owns
  gearMods(hero) {
    const m = {};
    for (const s of SLOTS) {
      if (!this.hasGear(hero, s)) continue;
      for (const [k, v] of Object.entries(SLOT_STAT[s].mods(this.slotLevel(hero, s)))) m[k] = (m[k] || 0) + v;
    }
    return m;
  },
  // Everything the hero brings to a run besides the slots' own stats: their survivalmon boost, the
  // bonuses of the sets worn (4 and 6 pieces) and the slot-level milestones.
  // Returns { team, hero, types, petXp, wild, coins, mats, shards }.
  heroTeamBonus(hero) {
    const out = { team: { dmg: 0, hp: 0, haste: 0, def: 0, crit: 0 }, hero: {}, types: {}, petXp: 0, wild: 0, coins: 0, mats: 0, shards: 0 };
    const add = (t, k = 1) => { for (const [key, v] of Object.entries(t || {})) out.team[key] += v * k; };
    const bonuses = [];
    for (const set of HERO_SETS[hero]) {
      const n = this.setWorn(hero, set);
      GEAR_SETS[set].bonus.forEach((b, i) => { if (n >= SET_PIECES[i]) bonuses.push(b); });
    }
    const b = HERO_BOOST[hero], boost = 1 + bonuses.reduce((s, x) => s + (x.boost || 0), 0);
    add(b.team, boost);
    out.petXp += (b.petXp || 0) * boost; out.wild += (b.wild || 0) * boost;
    for (const x of bonuses) {
      add(x.team);
      for (const [k, v] of Object.entries(x.hero || {})) out.hero[k] = (out.hero[k] || 0) + v;
      for (const [k, v] of Object.entries(x.types || {})) out.types[k] = (out.types[k] || 0) + v;
      for (const k of ['petXp', 'wild', 'coins', 'mats', 'shards']) out[k] += x[k] || 0;
    }
    const minL = this.gearCount(hero) === SLOTS.length ? this.minSlotLevel(hero) : 0;
    for (const ms of MILESTONES) if (minL >= ms.level) { add(ms.team); out.coins += ms.coins || 0; }
    return out;
  },

  // ---------------------------------------------------------- Workshop tools (better gathering)
  toolLevel(id) { return this.data.tools[id] || 0; },
  toolCap(t) { return Math.min(t.max, this.buildingBonus('workshop', 'tools')); },
  toolUpCost(id) { const t = TOOLS.find((x) => x.id === id), L = this.toolLevel(id); return L >= this.toolCap(t) ? null : toolCost(id, L); },
  toolUp(id) {
    if (!this.pay(this.toolUpCost(id))) return false;
    this.data.tools[id] = this.toolLevel(id) + 1;
    this.save();
    return true;
  },
  // How much more of a material gathering spots give, and how much faster gathering is
  gatherMult(mat) { return 1 + TOOLS.reduce((s, t) => s + (t.mats.includes(mat) ? t.per * this.toolLevel(t.id) : 0), 0); },
  gatherSpeed() { const t = TOOLS.find((x) => x.id === 'hands'); return 1 - t.per * this.toolLevel('hands'); },

  // ---------------------------------------------------------- the bag (Merchant goods, used in runs)
  itemCount(key) { return this.data.items[key] || 0; },
  addItem(id, g = 1, n = 1, save = true) {
    const k = itemKey(id, g), have = this.itemCount(k);
    if (have + n > STACK_MAX) return false;
    this.data.items[k] = have + n;
    if (save) this.save();
    return true;
  },
  takeItem(key) {
    if (!this.itemCount(key)) return false;
    if (--this.data.items[key] <= 0) delete this.data.items[key];
    this.save();
    return true;
  },
  // The bag's contents as [{ key, id, g, item, n }], in the Merchant's order, best grade first
  bagList() {
    return Object.entries(this.data.items).filter(([, n]) => n > 0).map(([key, n]) => ({ key, n, ...parseKey(key) }))
      .filter((x) => x.item).sort((a, b) => a.item.order - b.item.order || b.g - a.g);
  },
  bagSize() { return Object.values(this.data.items).reduce((s, n) => s + n, 0); },

  runLength() { return runLengthAt(this.level('runtime')); },
  coinMult() { return 1 + 0.1 * this.level('coins'); },
  wildMult() { return 1 + 0.1 * this.level('wild'); },
  // Stat mods for the hero at the start of a run
  heroMods() {
    const m = {};
    for (const u of TRAINING) {
      if (!u.mods) continue;
      for (const [k, v] of Object.entries(u.mods(this.level(u.id)))) m[k] = (m[k] || 0) + v;
    }
    return m;
  },
};
