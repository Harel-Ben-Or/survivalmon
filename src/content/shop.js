// The Merchant's goods and the Skyfall counter.
// - Goods cost coins (some also materials) and go into your bag. Open the bag during a run (B, or the
//   bag button under the map) and tap one to use it. The Merchant's level sets the grade it sells:
//   each grade costs much more and works much better.
// - Skyfall Shards are the rare currency: they pay for eggs at the Skyfall counter, swap for
//   materials, and finish building upgrades and research at once. They come from achievements and,
//   from the Lv 2 gates on, very rarely from the wild.
import { BASE_IDS } from './species.js';

export const GRADES = ['I', 'II', 'III', 'IV', 'V'];
export const BOOST_TIME = 60; // seconds a boost lasts
export const STACK_MAX = 99;  // most of one item (and grade) the bag holds
const pct = (v) => `${Math.round(v * 100)}%`;
const at = (arr) => (g) => arr[g - 1];

// kind 'boost' lasts BOOST_TIME (stat: what it raises); kind 'now' works at once.
// eff(g): its strength at grade g (1..5); base: coins at grade I; mats: materials at grade I.
export const ITEMS = [
  { id: 'swift', name: 'Swift Tonic', icon: 'it_swift', kind: 'boost', stat: 'haste', base: 120, eff: at([0.15, 0.2, 0.25, 0.3, 0.4]),
    text: (v) => `You and your survivalmons attack ${pct(v)} faster for 1 minute` },
  { id: 'power', name: 'Power Brew', icon: 'it_power', kind: 'boost', stat: 'dmg', base: 150, eff: at([0.2, 0.3, 0.4, 0.5, 0.65]),
    text: (v) => `+${pct(v)} damage for you and your survivalmons for 1 minute` },
  { id: 'iron', name: 'Iron Tonic', icon: 'it_iron', kind: 'boost', stat: 'def', base: 120, mats: { iron: 2 }, eff: at([0.15, 0.2, 0.25, 0.3, 0.4]),
    text: (v) => `You and your survivalmons take ${pct(v)} less damage for 1 minute` },
  { id: 'heal', name: 'Healing Draught', icon: 'it_heal', kind: 'now', base: 100, eff: at([0.3, 0.4, 0.5, 0.65, 0.8]),
    text: (v) => `Heals ${pct(v)} of the HP of you and every survivalmon` },
  { id: 'feather', name: 'Revive Feather', icon: 'phoenix', kind: 'now', base: 180, eff: at([0.3, 0.4, 0.5, 0.65, 0.8]),
    text: (v) => `Fainted survivalmons get back up with ${pct(v)} HP` },
  { id: 'frost', name: 'Frost Bell', icon: 'it_frost', kind: 'now', base: 200, mats: { stone: 3 }, eff: at([2, 2.5, 3, 3.5, 4]),
    text: (v) => `Freezes every monster on screen for ${v} seconds (bosses half as long)` },
  { id: 'blast', name: 'Blast Powder', icon: 'bombs', kind: 'now', base: 220, mats: { clay: 3 }, eff: at([0.3, 0.4, 0.5, 0.6, 0.75]),
    text: (v) => `Blasts every monster on screen for ${pct(v)} of its health (bosses a tenth of that)` },
  { id: 'pick', name: 'Lucky Pick', icon: 'it_pick', kind: 'boost', stat: 'mats', base: 120, mats: { wood: 3 }, eff: at([1, 1.5, 2, 2.5, 3]),
    text: (v) => `Gathering spots give ${1 + v}× materials for 1 minute` },
  { id: 'horn', name: 'Lure Horn', icon: 'it_horn', kind: 'now', base: 250, eff: at([1, 1, 2, 2, 3]),
    text: (v, g) => `Calls ${v === 1 ? 'a wild survivalmon' : `${v} wild survivalmons`} to you now${g >= 2 ? ', with better skill odds' : ''}` },
  { id: 'warm', name: 'Warm Stone', icon: 'it_warm', kind: 'now', base: 90, eff: at([30, 45, 60, 90, 120]),
    text: (v) => `Your eggs get ${v} seconds of warmth at once` },
];
ITEMS.forEach((it, i) => { it.order = i; });
export const ITEM = Object.fromEntries(ITEMS.map((it) => [it.id, it]));
// The bag stores "id:grade" keys
export const itemKey = (id, g) => `${id}:${g}`;
export const parseKey = (key) => { const [id, g] = key.split(':'); return { id, g: +g || 1, item: ITEM[id] }; };
export const itemName = (id, g) => `${ITEM[id].name} ${GRADES[g - 1]}`;
export const itemText = (id, g) => ITEM[id].text(ITEM[id].eff(g), g);
// What one costs at grade g: coins grow ×2.6 a grade, materials ×grade
export function itemPrice(id, g) {
  const it = ITEM[id], c = { coins: Math.round(it.base * Math.pow(2.6, g - 1) / 10) * 10 };
  for (const [k, n] of Object.entries(it.mats || {})) c[k] = n * g;
  return c;
}
// How many kinds of goods the stall shows at each Merchant level
export const MERCHANT_STOCK = [5, 6, 8, 9, 10];

// ---------------------------------------------------------------- Skyfall Shards
// Finishing a timer at once: one shard for every 5 minutes left (at least 1)
export const rushCost = (msLeft) => Math.max(1, Math.ceil(msLeft / 300000));

// Swapping shards for materials (one tap = one bundle)
export const EXCHANGE = [
  { mat: 'wood', shards: 5, n: 40 },
  { mat: 'stone', shards: 5, n: 40 },
  { mat: 'clay', shards: 5, n: 25 },
  { mat: 'iron', shards: 5, n: 12 },
];

// Eggs at the Skyfall counter. Each day (by the date on this device) it offers a mystery egg, two
// species eggs, a Bright egg (every skill at least B) and a Star egg (one skill is S, one a day).
// odds: 'shrine' = your Shrine research odds; minTier = no skill below it; star = one skill set to S.
export const EGG_OFFERS = [
  { id: 'mystery', name: 'Mystery Egg', icon: 'egg_mystery', shards: 60, text: 'A random basic species, with your usual skill odds' },
  { id: 'kind0', name: 'Egg', shards: 120, text: 'This species, with your usual skill odds' },
  { id: 'kind1', name: 'Egg', shards: 120, text: 'This species, with your usual skill odds' },
  { id: 'bright', name: 'Bright Egg', shards: 600, minTier: 2, text: 'Every skill at least B' },
  { id: 'star', name: 'Star Egg', icon: 'egg_star', shards: 2500, star: true, daily: 1, text: 'One of its skills is S. One a day' },
];
// Today's species for each offer, picked from the date so it's the same all day and changes at midnight
export function dayKey(d = new Date()) { return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
export function eggOfferSpecies(day = dayKey()) {
  let h = 2166136261;
  for (const c of day) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const pick = () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; return BASE_IDS[h % BASE_IDS.length]; };
  const a = pick(); let b = pick(); while (b === a) b = pick();
  return { mystery: null, kind0: a, kind1: b, bright: pick(), star: pick() };
}

// Shards from the wild (gates from Lv 2 on, see Combat.killEnemy): a boss drops some for sure, the
// Night Lord more, an elite now and then, any other monster very rarely. lv = gate level - 1 (1..3).
export const SHARD_DROP = { kill: 0.0008, elite: 0.03, boss: 1, nightLord: 3 };
