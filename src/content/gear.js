// Heroes' boosts for survivalmons, how each hero unlocks, and hero gear: 6 slots per hero, each
// piece fitting only its hero. Gear has no tiers; slots level up at the Workshop.

export const SLOTS = ['helmet', 'armor', 'gloves', 'boots', 'main', 'off'];
export const SLOT_NAME = { helmet: 'Helmet', armor: 'Body armor', gloves: 'Gloves', boots: 'Boots', main: 'Main hand', off: 'Off hand' };
export const SLOT_ICON = { helmet: 'gear_helmet', armor: 'gear_armor', gloves: 'gear_gloves', boots: 'gear_boots' };

// Each hero's set. main/off name the weapon held in that hand.
export const SETS = {
  rowan: { name: 'Ranger set', hue: 0, helmet: 'Ranger Cap', armor: 'Ranger Vest', gloves: 'Archer Gloves', boots: 'Swift Boots', main: 'Hunter Bow', off: 'Ranger Boomerang', mainW: 'bow', offW: 'boomerang' },
  bram: { name: 'Farmhand set', hue: 190, helmet: 'Straw Hat', armor: 'Patched Overalls', gloves: 'Work Gloves', boots: 'Muddy Boots', main: 'Pitchfork', off: 'Harvest Scythe', mainW: 'pitchfork', offW: 'scythe' },
  lyra: { name: 'Apprentice set', hue: 250, helmet: 'Pointed Hat', armor: 'Star Robe', gloves: 'Silk Gloves', boots: 'Velvet Slippers', main: 'Ember Wand', off: 'Storm Rod', mainW: 'emberwand', offW: 'lightrod' },
  pip: { name: 'Tamer set', hue: 120, helmet: 'Feather Cap', armor: 'Tamer Vest', gloves: 'Tamer Gloves', boots: 'Trail Boots', main: 'Pebble Sling', off: 'Leaf Charm', mainW: 'sling', offW: 'leaves' },
};

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
  bram: { text: 'Survivalmons get 20% more HP and take 10% less damage', team: { hp: 0.2, def: 0.1 } },
  lyra: { text: 'Survivalmon skills hit 15% harder', team: { dmg: 0.15 } },
  pip: { text: 'Survivalmons gain 25% more EXP; wild survivalmons appear 20% more often', team: {}, petXp: 0.25, wild: 0.2 },
};
export const HERO_UNLOCK = {
  rowan: { text: 'Your first hero' },
  bram: { text: 'Survive 2:00 in a run' },
  lyra: { text: 'Own survivalmons of 3 species' },
  pip: { text: 'Hatch your first breed' },
};

// Wearing 4 / all 6 pieces of a hero's own set
export const SET_BONUS = [
  { pieces: 4, text: "The hero's survivalmon boost is 50% stronger" },
  { pieces: 6, text: '+10% damage and HP for every survivalmon' },
];
// Every slot of a hero at least this level
export const MILESTONES = [
  { level: 5, text: '+5% damage for every survivalmon', team: { dmg: 0.05 } },
  { level: 10, text: '+5% HP for every survivalmon', team: { hp: 0.05 } },
  { level: 15, text: '+10% coins from every run', coins: 0.1 },
  { level: 20, text: 'Survivalmons attack 10% faster', team: { haste: 0.1 } },
  { level: 30, text: '+10% damage and HP for every survivalmon', team: { dmg: 0.1, hp: 0.1 } },
];

// Cost to raise a slot from level L
export function slotCost(L) {
  return { coins: Math.round(30 * Math.pow(1.25, L)), wood: L < 10 ? 2 + L : 0, stone: L >= 5 ? Math.floor(L / 2) : 0, iron: L >= 10 ? Math.floor((L - 5) / 3) : 0 };
}
