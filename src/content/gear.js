// Heroes' boosts for survivalmons, how each hero unlocks, and hero gear: 6 slots per hero, each
// piece fitting only its hero. Every hero has 4 sets (their own set and 3 more): each piece is one
// set's helmet, armor and so on, and a slot wears one piece at a time. Wearing 2, 4 or 6 pieces of a
// set gives its bonuses. Gear has no tiers; slots level up at the Workshop (the level stays with the
// slot, so swapping pieces keeps it).

export const SLOTS = ['helmet', 'armor', 'gloves', 'boots', 'main', 'off'];
export const SLOT_NAME = { helmet: 'Helmet', armor: 'Body armor', gloves: 'Gloves', boots: 'Boots', main: 'Main hand', off: 'Off hand' };
export const SLOT_ICON = { helmet: 'gear_helmet', armor: 'gear_armor', gloves: 'gear_gloves', boots: 'gear_boots' };

// Each hero's set. main/off name the weapon held in that hand.
export const SETS = {
  rowan: { name: 'Ranger set', hue: 0, helmet: 'Ranger Cap', armor: 'Ranger Vest', gloves: 'Archer Gloves', boots: 'Swift Boots', main: 'Hunter Bow', off: 'Ranger Boomerang', mainW: 'bow', offW: 'boomerang' },
  rowanf: { name: 'Ranger set', hue: 0, helmet: 'Ranger Cap', armor: 'Ranger Vest', gloves: 'Archer Gloves', boots: 'Swift Boots', main: 'Ranger Boomerang', off: 'Hunter Bow', mainW: 'boomerang', offW: 'bow' },
  bram: { name: 'Farmhand set', hue: 190, helmet: 'Straw Hat', armor: 'Patched Overalls', gloves: 'Work Gloves', boots: 'Muddy Boots', main: 'Pitchfork', off: 'Harvest Scythe', mainW: 'pitchfork', offW: 'scythe' },
  lyra: { name: 'Apprentice set', hue: 250, helmet: 'Pointed Hat', armor: 'Star Robe', gloves: 'Silk Gloves', boots: 'Velvet Slippers', main: 'Magic Wand', off: 'Storm Rod', mainW: 'emberwand', offW: 'lightrod' },
  pip: { name: 'Tamer set', hue: 120, helmet: 'Feather Cap', armor: 'Tamer Vest', gloves: 'Tamer Gloves', boots: 'Trail Boots', main: 'Pebble Sling', off: 'Leaf Charm', mainW: 'sling', offW: 'leaves' },
};

// The 4 sets of each hero: the first is the hero's own set (its pieces are named in SETS above).
export const HERO_SETS = {
  rowan: ['ranger', 'hawkeye', 'gale', 'prospector'],
  rowanf: ['ranger', 'hawkeye', 'gale', 'prospector'],
  bram: ['farmhand', 'bulwark', 'stampede', 'harvest'],
  lyra: ['apprentice', 'storm', 'moon', 'starlit'],
  pip: ['tamer', 'wildheart', 'nurture', 'lucky'],
};
// A set's bonuses at 2, 4 and 6 pieces (so 4 + 2 or 2 + 2 + 2 of different sets work too). A bonus can hold:
//   team {dmg, hp, haste, def, crit}: for every survivalmon
//   hero {might, speed, armor, maxHp, haste}: the hero's own stats (Player mods)
//   types {shot, chain, area, charge, support}: extra damage for survivalmons of that attack type
//   petXp, wild, coins, mats, shards: run bonuses (shards: how much more often Skyfall Shards drop)
//   boost: makes the hero's survivalmon boost stronger
const OWN_SET = [{ text: '+5% HP for every survivalmon', team: { hp: 0.05 } }, { text: "The hero's survivalmon boost is 50% stronger", boost: 0.5 }, { text: '+10% damage and HP for every survivalmon', team: { dmg: 0.1, hp: 0.1 } }];
export const GEAR_SETS = {
  // Rowan: quick shots and a sharp eye
  ranger: { hero: 'rowan', name: 'Ranger set', hue: 0, color: '#7fd07a', bonus: OWN_SET },
  hawkeye: { hero: 'rowan', name: 'Hawkeye set', word: 'Hawkeye', hue: 40, color: '#ffd84a', bonus: [
    { text: '+3% crit chance for every survivalmon', team: { crit: 0.03 } },
    { text: '+6% crit chance for every survivalmon', team: { crit: 0.06 } },
    { text: 'Projectile survivalmons deal 20% more damage; your hero 15% more', types: { shot: 0.2 }, hero: { might: 0.15 } }] },
  gale: { hero: 'rowan', name: 'Gale set', word: 'Gale', hue: 160, color: '#8fe0ff', bonus: [
    { text: 'Your hero moves 5% faster', hero: { speed: 0.05 } },
    { text: 'Your hero moves 10% faster', hero: { speed: 0.1 } },
    { text: 'Survivalmons attack 12% faster; your weapons 10% faster', team: { haste: 0.12 }, hero: { haste: 0.1 } }] },
  prospector: { hero: 'rowan', name: 'Prospector set', word: 'Prospector', hue: 300, color: '#d8b8ff', bonus: [
    { text: '+15% materials', mats: 0.15 },
    { text: '+30% materials', mats: 0.3 },
    { text: 'Skyfall Shards drop 50% more often; +15% coins', shards: 0.5, coins: 0.15 }] },
  // Bram: big, tough and steady
  farmhand: { hero: 'bram', name: 'Farmhand set', hue: 0, color: '#c8a46a', bonus: OWN_SET },
  bulwark: { hero: 'bram', name: 'Bulwark set', word: 'Bulwark', hue: 200, color: '#9ab8d8', bonus: [
    { text: 'Your hero +2 armor', hero: { armor: 2 } },
    { text: 'Survivalmons take 10% less damage', team: { def: 0.1 } },
    { text: '+25% HP for every survivalmon; your hero +3 armor', team: { hp: 0.25 }, hero: { armor: 3 } }] },
  stampede: { hero: 'bram', name: 'Stampede set', word: 'Stampede', hue: 330, color: '#ff9a6a', bonus: [
    { text: 'Charge and Area survivalmons deal 8% more damage', types: { charge: 0.08, area: 0.08 } },
    { text: 'Charge and Area survivalmons deal 15% more damage', types: { charge: 0.15, area: 0.15 } },
    { text: 'Another 15% for Charge and Area survivalmons; your hero +40 max HP', types: { charge: 0.15, area: 0.15 }, hero: { maxHp: 40 } }] },
  harvest: { hero: 'bram', name: 'Harvest set', word: 'Harvest', hue: 60, color: '#ffe07a', bonus: [
    { text: '+10% coins', coins: 0.1 },
    { text: '+20% coins', coins: 0.2 },
    { text: '+40% materials; survivalmons gain 20% more EXP', mats: 0.4, petXp: 0.2 }] },
  // Lyra: skills that hit hard
  apprentice: { hero: 'lyra', name: 'Apprentice set', hue: 0, color: '#b89aff', bonus: OWN_SET },
  storm: { hero: 'lyra', name: 'Stormcaller set', word: 'Stormcaller', hue: 90, color: '#8fd0ff', bonus: [
    { text: 'Chain survivalmons deal 10% more damage', types: { chain: 0.1 } },
    { text: 'Chain survivalmons deal 20% more damage', types: { chain: 0.2 } },
    { text: '+10% damage and +5% crit chance for every survivalmon', team: { dmg: 0.1, crit: 0.05 } }] },
  moon: { hero: 'lyra', name: 'Moonweave set', word: 'Moonweave', hue: 200, color: '#c8d8ff', bonus: [
    { text: '+8% HP for every survivalmon', team: { hp: 0.08 } },
    { text: '+15% HP for every survivalmon', team: { hp: 0.15 } },
    { text: 'Survivalmons attack 10% faster and take 8% less damage', team: { haste: 0.1, def: 0.08 } }] },
  starlit: { hero: 'lyra', name: 'Starlit set', word: 'Starlit', hue: 320, color: '#ffd8f0', bonus: [
    { text: 'Survivalmons gain 10% more EXP', petXp: 0.1 },
    { text: 'Survivalmons gain 25% more EXP', petXp: 0.25 },
    { text: 'Skyfall Shards drop 75% more often', shards: 0.75 }] },
  // Pip: friends of the wild
  tamer: { hero: 'pip', name: 'Tamer set', hue: 0, color: '#7fd07a', bonus: OWN_SET },
  wildheart: { hero: 'pip', name: 'Wildheart set', word: 'Wildheart', hue: 100, color: '#a8e070', bonus: [
    { text: 'Wild survivalmons appear 10% more often', wild: 0.1 },
    { text: 'Wild survivalmons appear 25% more often', wild: 0.25 },
    { text: 'Another 25% more wild survivalmons; +10% damage for every survivalmon', wild: 0.25, team: { dmg: 0.1 } }] },
  nurture: { hero: 'pip', name: 'Nurturer set', word: 'Nurturer', hue: 300, color: '#ffb8d8', bonus: [
    { text: 'Survivalmons take 5% less damage', team: { def: 0.05 } },
    { text: '+20% HP for every survivalmon', team: { hp: 0.2 } },
    { text: 'Survivalmons take 10% less damage and gain 20% more EXP', team: { def: 0.1 }, petXp: 0.2 }] },
  lucky: { hero: 'pip', name: 'Lucky set', word: 'Lucky', hue: 50, color: '#ffe07a', bonus: [
    { text: '+10% coins', coins: 0.1 },
    { text: '+25% coins', coins: 0.25 },
    { text: 'Skyfall Shards drop 50% more often; +25% materials', shards: 0.5, mats: 0.25 }] },
};
export const SET_PIECES = [2, 4, 6]; // pieces worn for a set's bonuses (they add up: 6 pieces give all three)
// A piece's name: the hero's own set uses the names in SETS; the others are "<set word> <item>"
// (Hawkeye Cap, Gale Boots...), the item being the last word of the own set's piece.
export function pieceName(hero, set, slot) {
  const own = SETS[hero][slot], def = GEAR_SETS[set];
  return def?.word ? `${def.word} ${own.split(' ').pop()}` : own;
}

// What a gear piece adds at slot level L (0 = just owning it).
export const SLOT_STAT = {
  helmet: { text: (L) => `+${15 + 5 * L} max HP`, mods: (L) => ({ maxHp: 15 + 5 * L }) },
  armor: { text: (L) => `+${(1 + 0.25 * L).toFixed(2).replace(/\.?0+$/, '')} armor`, mods: (L) => ({ armor: 1 + 0.25 * L }) },
  gloves: { text: (L) => `${6 + L}% faster weapons`, mods: (L) => ({ haste: 0.06 + 0.01 * L }) },
  boots: { text: (L) => `+${5 + L * 0.5}% move speed`, mods: (L) => ({ speed: 0.05 + 0.005 * L }) },
  main: { text: (L) => `+${10 + 2 * L}% damage`, mods: (L) => ({ might: 0.1 + 0.02 * L }) },
  off: { text: (L) => `Starts every run with its weapon at Lv ${offWeaponLevel(L)}`, mods: () => ({}) },
};
export const offWeaponLevel = (L) => Math.min(8, 1 + Math.floor(L / 4));

// The hero's boost for the whole survivalmon team (added to the team bonus at the start of a run).
export const HERO_BOOST = {
  rowan: { text: 'Survivalmons attack 15% faster', team: { haste: 0.15 } },
  rowanf: { text: 'Survivalmons attack 15% faster', team: { haste: 0.15 } },
  bram: { text: 'Survivalmons get 20% more HP and take 10% less damage', team: { hp: 0.2, def: 0.1 } },
  lyra: { text: 'Survivalmon skills hit 15% harder', team: { dmg: 0.15 } },
  pip: { text: 'Survivalmons gain 25% more EXP; wild survivalmons appear 20% more often', team: {}, petXp: 0.25, wild: 0.2 },
};
export const HERO_UNLOCK = {
  rowan: { text: 'You' },
  rowanf: { text: 'Find Rowan past the North Gate (win at North Gate Lv 1)' },
  bram: { text: 'Find Bram past the South Gate (win at South Gate Lv 1)' },
  lyra: { text: 'Find Lyra past the East Gate (win at East Gate Lv 1)' },
  pip: { text: 'Find Pip past the West Gate (win at West Gate Lv 1)' },
};

// Every slot of a hero at least this level
export const MILESTONES = [
  { level: 5, text: '+5% damage for every survivalmon', team: { dmg: 0.05 } },
  { level: 10, text: '+5% HP for every survivalmon', team: { hp: 0.05 } },
  { level: 15, text: '+10% coins from every run', coins: 0.1 },
  { level: 20, text: 'Survivalmons attack 10% faster', team: { haste: 0.1 } },
  { level: 30, text: '+10% damage and HP for every survivalmon', team: { dmg: 0.1, hp: 0.1 } },
];

// Workshop tools: better gathering in runs. A tool's top level is set by the Workshop's level.
export const TOOLS = [
  { id: 'axe', name: 'Woodcutter axe', icon: 'tool_axe', per: 0.15, max: 10, mats: ['wood'], text: (L) => (L ? `+${L * 15}% wood from gathering spots` : 'Gathering spots give the usual wood') },
  { id: 'pick', name: 'Mining pickaxe', icon: 'tool_pick', per: 0.15, max: 10, mats: ['stone', 'iron'], text: (L) => (L ? `+${L * 15}% stone and iron from gathering spots` : 'Gathering spots give the usual stone and iron') },
  { id: 'spade', name: 'Clay spade', icon: 'tool_spade', per: 0.15, max: 10, mats: ['clay'], text: (L) => (L ? `+${L * 15}% clay from gathering spots` : 'Gathering spots give the usual clay') },
  { id: 'hands', name: 'Quick hands', icon: 'gear_gloves', per: 0.08, max: 5, mats: [], text: (L) => (L ? `Gathering takes ${L * 8}% less time` : 'Gathering takes the usual time') },
];
export function toolCost(id, L) {
  return { coins: Math.round((150 * Math.pow(1.55, L)) / 10) * 10, wood: 8 + 6 * L, stone: id === 'axe' ? 0 : 6 + 4 * L, iron: L >= 3 ? 2 * (L - 2) : 0 };
}

// Cost to raise a slot from level L
export function slotCost(L) {
  return { coins: Math.round(30 * Math.pow(1.25, L)), wood: L < 10 ? 2 + L : 0, stone: L >= 5 ? Math.floor(L / 2) : 0, iron: L >= 10 ? Math.floor((L - 5) / 3) : 0 };
}
