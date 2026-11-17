// Progress that lasts between runs: banked coins and Spirit, Training Hall levels, the chosen hero,
// which buildings are open and their levels. Coins are the hero's money; Spirit (earned by what your
// survivalmons do) pays for the Spirit Shrine.
import { RUN_LENGTH } from './director.js';
import { BUILDINGS, buildingCost } from '../content/buildings.js';
import { SLOTS, SLOT_STAT, SETS, HERO_BOOST, SET_BONUS, MILESTONES, slotCost } from '../content/gear.js';
import { Profiles } from './profiles.js';
import { armorPct } from './armor.js';
import { HEROES } from '../content/heroes.js';

const KEY = Profiles.key('meta'); // this player's save
export const SPIRIT_START = 100;
// gates: the newest gate opened (0 = only the North Gate, see content/gates.js); gateTier: the one
// picked for the next run; gateNew: a gate just earned, not yet told in town
const empty = () => ({ v: 1, coins: 0, spirit: SPIRIT_START, gates: 0, gateTier: 0, gateNew: 0, training: {}, hero: 'rowan', runs: 0, unlocked: {}, buildings: {}, bestTime: 0,
  mats: { wood: 0, stone: 0, clay: 0, iron: 0 }, gear: {}, slots: {}, heroes: { rowan: true }, buffs: [] });

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
        this.data = { ...e, ...d, spirit: d.spirit ?? SPIRIT_START, training: { ...d.training }, unlocked: { ...d.unlocked }, buildings: { ...d.buildings }, mats: { ...e.mats, ...d.mats }, heroes: { ...e.heroes, ...d.heroes } };
      }
    } catch { /* storage unavailable: start fresh */ }
    return this;
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage unavailable */ } },

  // The main character's name: Rowan until the player gives their own (asked at the gate)
  get playerName() { return this.data.name || 'Rowan'; },
  get named() { return !!this.data.named; },
  setName(n) {
    this.data.name = cleanName(n) || 'Rowan';
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
  get hero() { return this.data.hero; },
  setHero(id) { this.data.hero = id; this.save(); },
  bank(n) { this.data.coins += Math.max(0, Math.floor(n)); this.data.runs++; this.save(); },

  level(id) { return this.data.training[id] || 0; },
  // Training Hall upgrades stop at the hall's level cap (run time has its own fixed top).
  maxLevel(u) { return u.id === 'runtime' ? u.max : Math.min(u.max, this.buildingBonus('training', 'cap')); },
  cost(id) {
    const u = TRAINING.find((x) => x.id === id), L = this.level(id);
    return L >= this.maxLevel(u) ? null : Math.round(u.base * Math.pow(1.35, L));
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
  // Returns true the first time a building opens.
  unlock(id) {
    if (this.data.unlocked[id]) return false;
    this.data.unlocked[id] = true;
    this.save();
    return true;
  },
  buildingLevel(id) { return this.data.buildings[id] || 1; },
  buildingBonus(id, key) { return BUILDINGS[id].bonus[key][this.buildingLevel(id) - 1]; },

  // Pays a cost { coins, wood, stone, clay, iron } if there's enough of everything.
  canAfford(c) { return !!c && this.data.coins >= (c.coins || 0) && ['wood', 'stone', 'clay', 'iron'].every((k) => this.data.mats[k] >= (c[k] || 0)); },
  pay(c) {
    if (!this.canAfford(c)) return false;
    this.data.coins -= c.coins || 0;
    for (const k of ['wood', 'stone', 'clay', 'iron']) this.data.mats[k] -= c[k] || 0;
    this.save();
    return true;
  },
  upgradeBuilding(id) {
    const c = buildingCost(id, this.buildingLevel(id));
    if (!this.pay(c)) return false;
    this.data.buildings[id] = this.buildingLevel(id) + 1;
    this.save();
    return true;
  },
  bankMats(m) { for (const k of Object.keys(m)) this.data.mats[k] = (this.data.mats[k] || 0) + Math.floor(m[k]); this.save(); },

  // ---------------------------------------------------------- heroes and gear
  isHeroUnlocked(id) { return !!this.data.heroes[id]; },
  unlockHero(id) { if (this.data.heroes[id]) return false; this.data.heroes[id] = true; this.save(); return true; },
  hasGear(hero, slot) { return !!this.data.gear[hero]?.[slot]; },
  // Returns true for a new piece, false for a duplicate (salvaged by the caller).
  addGear(hero, slot) {
    const g = this.data.gear[hero] || (this.data.gear[hero] = {});
    if (g[slot]) return false;
    g[slot] = true;
    this.save();
    return true;
  },
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
  offWeapon(hero) { return this.hasGear(hero, 'off') ? SETS[hero].offW : null; },
  // Everything the hero does for the survivalmon team: their boost (stronger with 4 set pieces),
  // the 6-piece bonus and the slot-level milestones. Returns { team, petXp, wild, coins }.
  heroTeamBonus(hero) {
    const out = { team: { dmg: 0, hp: 0, haste: 0, def: 0, crit: 0 }, petXp: 0, wild: 0, coins: 0 };
    const add = (t, k = 1) => { for (const [key, v] of Object.entries(t || {})) out.team[key] += v * k; };
    const n = this.gearCount(hero), b = HERO_BOOST[hero], boost = n >= SET_BONUS[0].pieces ? 1.5 : 1;
    add(b.team, boost);
    out.petXp += (b.petXp || 0) * boost; out.wild += (b.wild || 0) * boost;
    if (n >= SET_BONUS[1].pieces) add({ dmg: 0.1, hp: 0.1 });
    const minL = n === SLOTS.length ? this.minSlotLevel(hero) : 0;
    for (const ms of MILESTONES) if (minL >= ms.level) { add(ms.team); out.coins += ms.coins || 0; }
    return out;
  },

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
