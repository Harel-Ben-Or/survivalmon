// The gates out of town. Each gate you open leads to a wilder land: the Blight is thicker there
// (monsters have more health and hit harder) and it pays far more. Win a full run (beat the Night
// Lord) through the newest gate and the ground shakes: the next gate opens. North, south, east,
// west, then north again (North Gate II), south again (South Gate II) and on, for ever.
// A gate's tier is how many gates came before it: North Gate 0, South Gate 1, ... North Gate II 4.
export const GATE_SIDES = ['north', 'south', 'east', 'west'];
const SIDE_NAME = { north: 'North', south: 'South', east: 'East', west: 'West' };
export const GATE_COLOR = { north: '#7fd07a', south: '#ff7a5a', east: '#6ab0ff', west: '#c08aff' };
const roman = (n) => {
  let s = '';
  for (const [v, r] of [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]) while (n >= v) { s += r; n -= v; }
  return s;
};
export const gateSide = (tier) => GATE_SIDES[tier % 4];
export const gateRank = (tier) => Math.floor(tier / 4) + 1;
export const gateName = (tier) => `${SIDE_NAME[gateSide(tier)]} Gate${gateRank(tier) > 1 ? ` ${roman(gateRank(tier))}` : ''}`;
export const gateColor = (tier) => GATE_COLOR[gateSide(tier)];

// What a tier does to a run. Monsters: hp and dmg. Rewards: coins, EXP (the hero's gems and the
// survivalmons' EXP per kill), Spirit, the chance of evolution stones, materials, and how grown the
// wild survivalmons are. haze: how thick the Blight's purple haze hangs over the land.
export function tierMult(tier) {
  return {
    hp: Math.pow(2.2, tier), dmg: Math.pow(1.6, tier),
    coins: Math.pow(4, tier), xp: 1 + 0.5 * tier, petXp: 1 + 0.5 * tier, spirit: Math.pow(2, tier),
    stone: 1 + 0.5 * tier, mats: 1 + 0.5 * tier, wildLv: 12 * tier,
    haze: tier ? Math.min(0.6, 0.3 + 0.08 * (tier - 1)) : 0,
  };
}
// One line for the gate picker
export function gateBlurb(tier) {
  if (!tier) return 'Where the Blight first fell. Monsters and rewards as you know them.';
  const m = tierMult(tier), x = (v) => `×${v >= 10 ? Math.round(v).toLocaleString() : +v.toFixed(1)}`;
  return `The Blight is thicker: monsters have ${x(m.hp)} health and hit ${x(m.dmg)} harder. Rewards: ${x(m.coins)} coins, ${x(m.spirit)} Spirit, ${x(m.xp)} EXP, wild survivalmons ${m.wildLv} levels higher.`;
}
