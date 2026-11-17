// The gates out of town: North, South, East and West, each at levels 1 to 4. Win a full run (defeat the
// Night Lord) through the newest gate and the next one opens: North Lv 1, South Lv 1, East Lv 1, West Lv 1,
// then North Lv 2 ... up to the West Gate Lv 4, the last. Past each one the Blight is thicker (monsters
// have more health and hit harder) and it pays a little more.
// A gate's tier is how many gates came before it: North Lv 1 is 0, South Lv 1 is 1, ... West Lv 4 is 15.
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

// What a tier does to a run. Monsters: hp and dmg. Rewards grow gently (coins, EXP for the hero's gems
// and the survivalmons' kills, Spirit, evolution stones, materials) and wild survivalmons are more grown.
// haze: how thick the Blight's purple haze hangs over the land.
export function tierMult(tier) {
  return {
    hp: GATE_HP(tier), dmg: GATE_DMG(tier),
    coins: 1 + 0.5 * tier, xp: 1 + 0.25 * tier, petXp: 1 + 0.25 * tier, spirit: 1 + 0.35 * tier,
    stone: 1 + 0.25 * tier, mats: 1 + 0.25 * tier, wildLv: 4 * tier,
    haze: tier ? Math.min(0.6, 0.3 + 0.03 * (tier - 1)) : 0,
  };
}
// One line for the gate picker
export function gateBlurb(tier) {
  if (!tier) return 'Where the Blight first fell. Monsters and rewards as you know them.';
  const m = tierMult(tier), x = (v) => `×${v >= 10 ? Math.round(v).toLocaleString() : +v.toFixed(1)}`;
  return `The Blight is thicker: monsters have ${x(m.hp)} health and hit ${x(m.dmg)} harder. Rewards: ${x(m.coins)} coins, ${x(m.spirit)} Spirit, ${x(m.xp)} EXP, wild survivalmons ${m.wildLv} levels higher.`;
}
