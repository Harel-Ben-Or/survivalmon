// Playable heroes and level-up stat cards.
export const HEROES = [
  {
    id: 'rowan', name: 'Rowan', title: 'Ranger', weapon: 'bow', color: '#d8473b',
    desc: 'A quick-footed scout who never misses a shot.',
    perks: ['+10% move speed', '+4% crit chance'],
    mods: { speed: 0.10, crit: 0.04 },
  },
  {
    id: 'bram', name: 'Bram', title: 'Farmhand', weapon: 'pitchfork', color: '#4c7fbf',
    desc: 'Sturdy as an oak. Hits like a hay cart.',
    perks: ['+40 max HP', '+2 armor', '-5% move speed'],
    mods: { maxHp: 40, armor: 2, speed: -0.05 },
  },
  {
    id: 'lyra', name: 'Lyra', title: 'Apprentice', weapon: 'emberwand', color: '#6c4bc4',
    desc: 'Studied three spells. Mastered one. Burns the rest.',
    perks: ['-10% cooldowns', '+10% area', '-15 max HP'],
    mods: { haste: 0.10, area: 0.10, maxHp: -15 },
  },
  {
    id: 'pip', name: 'Pip', title: 'Critter Tamer', weapon: 'sling', color: '#2fa39a',
    desc: 'Born to befriend critters. Never short of Bond Orbs.',
    perks: ['+50% pet power', '+50% pet EXP', '+2 Bond Orbs each run'],
    mods: { petPower: 0.5, petXp: 0.5, luck: 0.1 }, orbs: 2,
  },
];

// Level-up cards. `v` is the rolled value (scaled by rarity).
export const UPGRADES = [
  { id: 'vitality', name: 'Vitality', icon: 'up_hp', base: 16, fmt: (v) => `+${v} Max HP`, key: 'maxHp', round: true, w: 10 },
  { id: 'power', name: 'Power', icon: 'up_damage', base: 0.08, fmt: (v) => `+${pct(v)} damage`, key: 'might', w: 12 },
  { id: 'swift', name: 'Swiftness', icon: 'up_speed', base: 0.06, fmt: (v) => `+${pct(v)} move speed`, key: 'speed', w: 8, cap: 0.7 },
  { id: 'haste', name: 'Haste', icon: 'up_haste', base: 0.05, fmt: (v) => `-${pct(v)} cooldowns`, key: 'haste', w: 9, cap: 0.45 },
  { id: 'reach', name: 'Reach', icon: 'up_area', base: 0.08, fmt: (v) => `+${pct(v)} area`, key: 'area', w: 8 },
  { id: 'multi', name: 'Multishot', icon: 'up_multi', base: 1, fmt: (v) => `+${v} projectile`, key: 'amount', round: true, w: 2, cap: 2, noRarity: true },
  { id: 'precision', name: 'Precision', icon: 'up_crit', base: 0.04, fmt: (v) => `+${pct(v)} crit chance`, key: 'crit', w: 7, cap: 0.4 },
  { id: 'ferocity', name: 'Ferocity', icon: 'up_critdmg', base: 0.15, fmt: (v) => `+${pct(v)} crit damage`, key: 'critMult', w: 6 },
  { id: 'regen', name: 'Regrowth', icon: 'up_regen', base: 0.25, fmt: (v) => `+${+v.toFixed(2)} HP/sec`, key: 'regen', w: 7 },
  { id: 'armor', name: 'Toughness', icon: 'up_armor', base: 2, fmt: (v) => `+${v} armor`, key: 'armor', round: true, w: 7, cap: 16 },
  { id: 'magnet', name: 'Magnetism', icon: 'up_magnet', base: 0.25, fmt: (v) => `+${pct(v)} pickup range`, key: 'magnet', w: 6 },
  { id: 'luck', name: 'Fortune', icon: 'up_luck', base: 0.10, fmt: (v) => `+${pct(v)} luck`, key: 'luck', w: 5 },
  { id: 'wisdom', name: 'Wisdom', icon: 'up_exp', base: 0.08, fmt: (v) => `+${pct(v)} EXP gain`, key: 'growth', w: 6 },
  { id: 'velocity', name: 'Velocity', icon: 'bow', base: 0.15, fmt: (v) => `+${pct(v)} projectile speed`, key: 'projSpeed', w: 4 },
  { id: 'endurance', name: 'Endurance', icon: 'hourglass', base: 0.12, fmt: (v) => `+${pct(v)} effect duration`, key: 'duration', w: 4 },
  { id: 'bond', name: 'Bond', icon: 'collar', base: 0.15, fmt: (v) => `+${pct(v)} pet power`, key: 'petPower', w: 6, needsPet: true },
];

export const RARITIES = [
  { id: 'common', name: 'Common', mult: 1, color: '#e8e8e8', w: 70 },
  { id: 'rare', name: 'Rare', mult: 1.4, color: '#5ab0f0', w: 23 },
  { id: 'epic', name: 'Epic', mult: 1.8, color: '#c88aff', w: 7 },
];

function pct(v) { return `${Math.round(v * 100)}%`; }
