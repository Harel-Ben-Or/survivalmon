// Pets, monsters and the wave timeline.
export const PETS = {
  emberpup: { name: 'Emberpup', type: 'Fire', color: '#f08a3c', desc: 'Spits homing embers that burn foes.' },
  leafkit: { name: 'Leafkit', type: 'Grass', color: '#8fd16a', desc: 'Throws piercing razor leaves and heals you now and then.' },
  voltowl: { name: 'Voltowl', type: 'Storm', color: '#3b5bd1', desc: 'Zaps groups of foes with chain lightning.' },
  puddlit: { name: 'Puddlit', type: 'Water', color: '#4fc0d8', desc: 'Blows bubbles that slow and soak foes.' },
  pebblet: { name: 'Pebblet', type: 'Rock', color: '#9a9aa6', desc: 'Curls up and rolls through foes for big damage.' },
  glimmoth: { name: 'Glimmoth', type: 'Fairy', color: '#f5b8e8', desc: 'Sheds sparkling dust that hurts foes and pulls in EXP.' },
};
export const PET_IDS = Object.keys(PETS);

// behavior: chase | flyer | charger | ranged | tank ; boss behaviours are named
export const ENEMIES = {
  slime: { name: 'Slime', hp: 10, speed: 30, dmg: 6, xp: 1, r: 6, anim: 6 },
  // A wild survivalmon (its look and name come from the species): rare, tough, caught when defeated
  wild: { name: 'Wild survivalmon', hp: 12, speed: 40, dmg: 8, xp: 3, r: 7, anim: 6 },
  bat: { name: 'Bat', hp: 7, speed: 54, dmg: 5, xp: 1, r: 5, anim: 10, behavior: 'flyer' },
  shroom: { name: 'Shroomling', hp: 22, speed: 27, dmg: 8, xp: 2, r: 6, anim: 6 },
  wisp: { name: 'Wisp', hp: 16, speed: 40, dmg: 7, xp: 2, r: 5, anim: 4, behavior: 'flyer', alpha: 0.85 },
  slime_blue: { name: 'Blue Slime', hp: 26, speed: 34, dmg: 9, xp: 2, r: 6, anim: 7 },
  wolf: { name: 'Dusk Wolf', hp: 32, speed: 46, dmg: 10, xp: 3, r: 7, anim: 10, behavior: 'charger' },
  spore: { name: 'Spore Puff', hp: 22, speed: 24, dmg: 6, xp: 3, r: 6, anim: 3, behavior: 'ranged', proj: 'p_spore', range: 110, fireCd: 2.8, projDmg: 7 },
  beetle: { name: 'Shell Beetle', hp: 60, speed: 23, dmg: 12, xp: 5, r: 7, anim: 6, behavior: 'tank', knockRes: 0.7 },
  shroom_blue: { name: 'Frost Cap', hp: 48, speed: 30, dmg: 11, xp: 4, r: 6, anim: 7 },
  imp: { name: 'Imp', hp: 30, speed: 40, dmg: 9, xp: 4, r: 6, anim: 5, behavior: 'ranged', proj: 'p_imp_fire', range: 130, fireCd: 2.4, projDmg: 10, flying: true },
  slime_red: { name: 'Magma Slime', hp: 40, speed: 37, dmg: 13, xp: 4, r: 6, anim: 8 },
  golem: { name: 'Pebble Golem', hp: 150, speed: 18, dmg: 18, xp: 12, r: 9, anim: 3, behavior: 'tank', knockRes: 0.85 },

  king_slime: { name: 'King Slime', hp: 1100, speed: 30, dmg: 20, xp: 120, r: 20, anim: 4, boss: true, behavior: 'kingslime', knockRes: 1 },
  treant: { name: 'Elder Treant', hp: 2600, speed: 22, dmg: 24, xp: 220, r: 18, anim: 3, boss: true, behavior: 'treant', knockRes: 1 },
  colossus: { name: 'Stone Colossus', hp: 4800, speed: 21, dmg: 28, xp: 350, r: 20, anim: 2, boss: true, behavior: 'colossus', knockRes: 1 },
  alpha_wolf: { name: 'Alpha Wolf', hp: 7000, speed: 50, dmg: 30, xp: 500, r: 16, anim: 10, boss: true, behavior: 'alpha', knockRes: 1 },
  night_lord: { name: 'The Night Lord', hp: 13000, speed: 34, dmg: 34, xp: 1000, r: 14, anim: 3, boss: true, behavior: 'nightlord', knockRes: 1, flying: true },
};

// Spawn timeline. rate = spawns per second. Pools are weights.
export const WAVES = [
  { t: 0, rate: 1.0, pool: { slime: 10, bat: 2 } },
  { t: 45, rate: 1.5, pool: { slime: 8, bat: 5 } },
  { t: 90, rate: 2.0, pool: { slime: 6, bat: 5, shroom: 4 } },
  { t: 150, rate: 2.5, pool: { slime: 5, bat: 4, shroom: 5, wisp: 3 } },
  { t: 210, rate: 3.0, pool: { bat: 4, shroom: 5, wisp: 4, slime_blue: 4 } },
  { t: 300, rate: 3.2, pool: { shroom: 4, wisp: 4, slime_blue: 5, wolf: 3 } },
  { t: 390, rate: 3.8, pool: { slime_blue: 5, wolf: 4, spore: 3, bat: 4 } },
  { t: 480, rate: 4.4, pool: { wolf: 5, spore: 3, beetle: 2, wisp: 4 } },
  { t: 600, rate: 5.0, pool: { wolf: 4, beetle: 3, shroom_blue: 5, spore: 3 } },
  { t: 720, rate: 5.6, pool: { shroom_blue: 5, imp: 3, beetle: 3, bat: 5 } },
  { t: 840, rate: 6.4, pool: { imp: 4, slime_red: 5, wolf: 4, beetle: 3 } },
  { t: 960, rate: 7.2, pool: { slime_red: 5, golem: 1, imp: 4, shroom_blue: 4 } },
  { t: 1080, rate: 8.2, pool: { slime_red: 4, golem: 2, wolf: 5, wisp: 5 } },
  { t: 1200, rate: 9.2, pool: { golem: 2, imp: 5, beetle: 4, slime_red: 5 } },
  { t: 1320, rate: 10.5, pool: { golem: 3, wolf: 6, imp: 5, shroom_blue: 4 } },
  { t: 1440, rate: 12, pool: { golem: 3, slime_red: 6, imp: 6, wisp: 6, beetle: 4 } },
];

export const EVENTS = [
  { t: 170, type: 'ring', enemy: 'slime', count: 16, msg: 'Slimes are closing in!' },
  { t: 240, type: 'swarm', enemy: 'bat', count: 22, msg: 'A bat swarm!' },
  { t: 300, type: 'boss', enemy: 'king_slime' },
  { t: 420, type: 'swarm', enemy: 'wolf', count: 14, msg: 'The wolf pack hunts!' },
  { t: 540, type: 'ring', enemy: 'shroom', count: 30, msg: 'Mushrooms everywhere!' },
  { t: 600, type: 'boss', enemy: 'treant' },
  { t: 780, type: 'swarm', enemy: 'wisp', count: 36, msg: 'Wisps drift in from the dark...' },
  { t: 900, type: 'boss', enemy: 'colossus' },
  { t: 1020, type: 'ring', enemy: 'beetle', count: 24, msg: 'Shell beetles surround you!' },
  { t: 1140, type: 'swarm', enemy: 'imp', count: 26, msg: 'Imps descend!' },
  { t: 1200, type: 'boss', enemy: 'alpha_wolf' },
  { t: 1320, type: 'ring', enemy: 'slime_red', count: 40, msg: 'The ground boils with magma slimes!' },
  { t: 1440, type: 'boss', enemy: 'night_lord' },
];

// Enemy HP multiplier by run time (seconds)
export function hpScale(t) {
  const m = t / 60;
  return 1 + 0.09 * m + 0.011 * m * m;
}
