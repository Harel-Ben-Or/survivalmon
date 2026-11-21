// The gates out of town: North, South, East and West, each at levels 1 to 4. Win a full run (defeat the
// Night Lord) through the newest gate and the next one opens: North Lv 1, South Lv 1, East Lv 1, West Lv 1,
// then North Lv 2 ... up to the West Gate Lv 4, the last. Past each one the Blight is thicker (monsters
// have more health and hit harder) and it pays a little more.
// A gate's tier is how many gates came before it: North Lv 1 is 0, South Lv 1 is 1, ... West Lv 4 is 15.
import { epicChance, legendChance } from './gear.js';

export const GATE_SIDES = ['north', 'south', 'east', 'west'];
export const GATE_MAX = 15;
const SIDE_NAME = { north: 'North', south: 'South', east: 'East', west: 'West' };
export const GATE_COLOR = { north: '#7fd07a', south: '#ff7a5a', east: '#6ab0ff', west: '#c08aff' };
export const gateSide = (tier) => GATE_SIDES[tier % 4];
export const gateLevel = (tier) => Math.floor(tier / 4) + 1;
export const gateName = (tier) => `${SIDE_NAME[gateSide(tier)]} Gate Lv ${gateLevel(tier)}`;
export const gateColor = (tier) => GATE_COLOR[gateSide(tier)];

// How much tougher the Blight is past a gate: health and damage grow fast over the first gates and
// more slowly later on (players' power grows that way too). Tuned with simulated runs (see README).
// West Lv 1 (tier 3): about 16x health and 3.4x damage; West Lv 4 (tier 15): about 614x and 16x.
export const GATE_HP = (t) => Math.pow(1 + 0.5 * t, 3);
export const GATE_DMG = (t) => Math.pow(1 + 0.6 * t, 1.2);

// Coins and materials grow with every gate (the player's call, 1.08): each gate pays GATE_COINS times the
// coins of the gate before it (monsters, chests and anything else found) and GATE_MATS times the materials
// (gathering spots, chests, bosses). So the North Gate pays what it always did (about 8,000 to 10,000 a
// full run), the South Gate 1.6x, the East Gate 2.56x, the West Gate 4.1x, and on.
// Spirit (what your survivalmons' kills and your catches earn) grows GATE_SPIRIT times a gate: Shrine
// upgrades cost 1.35x a level, so 1.5 keeps Spirit in step with them the way coins are with the Training Hall.
// An evolution stone is always a single stone, at any gate: only the chance of one grows.
export const GATE_COINS = 1.6, GATE_MATS = 1.3, GATE_SPIRIT = 1.5;

// What a tier does to a run. Monsters: hp and dmg. Coins, materials and Spirit: see above. The other rewards
// grow gently (EXP for the hero's gems and the survivalmons' kills, the chance of an evolution stone)
// and wild survivalmons are more grown. haze: how thick the Blight's purple haze hangs over the land.
export function tierMult(tier) {
  return {
    hp: GATE_HP(tier), dmg: GATE_DMG(tier),
    coins: Math.pow(GATE_COINS, tier), xp: 1 + 0.25 * tier, petXp: 1 + 0.25 * tier, spirit: Math.pow(GATE_SPIRIT, tier),
    stone: 1 + 0.25 * tier, mats: Math.pow(GATE_MATS, tier), wildLv: 4 * tier,
    haze: tier ? Math.min(0.6, 0.3 + 0.03 * (tier - 1)) : 0,
  };
}
// One line for the gate picker
export function gateBlurb(tier) {
  if (!tier) return 'Where the Blight first fell. Monsters and rewards as you know them.';
  const m = tierMult(tier), x = (v) => `×${v >= 10 ? Math.round(v).toLocaleString() : +v.toFixed(1)}`;
  const ep = Math.round(epicChance(tier) * 100), lg = Math.round(legendChance(tier) * 100);
  const gear = ` Gear: ${ep}% of drops are Epic${lg ? `, and the Night Lord leaves a Legendary piece ${lg}% of the time` : ''}.`;
  return `The Blight is thicker: monsters have ${x(m.hp)} health and hit ${x(m.dmg)} harder. Rewards: ${x(m.coins)} coins, ${x(m.mats)} materials, ${x(m.spirit)} Spirit, ${x(m.xp)} EXP, wild survivalmons ${m.wildLv} levels higher.${gear}`;
}
