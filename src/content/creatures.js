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

  // ---- the Blight: living ink that has crept over the land. It turns up everywhere.
  blob: { name: 'Ink Blob', hp: 10, speed: 30, dmg: 6, xp: 1, r: 6, anim: 6, splits: 'droplet', splitChance: 0.5 },
  droplet: { name: 'Ink Drop', hp: 3, speed: 40, dmg: 3, xp: 0.4, r: 4, anim: 8, look: 'blob', scale: 0.5 },
  inkwing: { name: 'Inkwing', hp: 7, speed: 54, dmg: 5, xp: 1, r: 5, anim: 10, behavior: 'flyer' },
  hound: { name: 'Shade Hound', hp: 32, speed: 46, dmg: 10, xp: 3, r: 7, anim: 10, behavior: 'charger' },
  spitter: { name: 'Ink Spitter', hp: 22, speed: 24, dmg: 6, xp: 3, r: 6, anim: 4, behavior: 'ranged', proj: 'p_dark_orb', range: 110, fireCd: 2.8, projDmg: 7 },
  shardooze: { name: 'Shard Ooze', hp: 90, speed: 22, dmg: 13, xp: 6, r: 8, anim: 4, behavior: 'tank', knockRes: 0.75 },
  bloater: { name: 'Bloater', hp: 18, speed: 36, dmg: 6, xp: 3, r: 6, anim: 6, behavior: 'bloater', boomR: 30, boomDmg: 16 },
  // ---- zone monsters: what the Blight made of each zone's locals (ZONES[zone].native)
  thornling: { name: 'Thornling', hp: 20, speed: 28, dmg: 8, xp: 2, r: 7, anim: 5 },
  bogcrab: { name: 'Bog Crab', hp: 24, speed: 30, dmg: 8, xp: 3, r: 7, anim: 7, behavior: 'charger' },
  sawbeetle: { name: 'Saw Beetle', hp: 26, speed: 30, dmg: 9, xp: 3, r: 7, anim: 7, behavior: 'charger' },
  cinderimp: { name: 'Cinder Imp', hp: 18, speed: 38, dmg: 7, xp: 3, r: 6, anim: 5, behavior: 'ranged', proj: 'p_imp_fire', range: 125, fireCd: 2.9, projDmg: 7, flying: true },
  snowgolem: { name: 'Snow Golem', hp: 44, speed: 20, dmg: 10, xp: 5, r: 9, anim: 3, behavior: 'tank', knockRes: 0.8 },
  wiltsprite: { name: 'Wilted Sprite', hp: 14, speed: 40, dmg: 5, xp: 2, r: 5, anim: 8, behavior: 'ranged', proj: 'p_spore', range: 110, fireCd: 3.0, projDmg: 5, flying: true },
  // ---- night creatures: Blight that hides from the sun. They only come out after dark (Director:
  // Moonfang packs from dusk, Nightshade Witches once it's properly dark), and light hurts them
  // (Combat.lightHurt): whatever daylight is left, the hero's lantern, lightning and Fairy attacks.
  moonfang: { name: 'Moonfang', hp: 46, speed: 60, dmg: 12, xp: 5, r: 7, anim: 10, behavior: 'charger', night: true },
  witch: { name: 'Nightshade Witch', hp: 200, speed: 30, dmg: 14, xp: 16, r: 8, anim: 5, behavior: 'witch', night: true, flying: true,
    range: 125, fireCd: 3.0, projDmg: 13, knockRes: 0.6 },
  // ---- the Snare: a poacher gang that catches survivalmons and uses the Blight to control them
  poacher: { name: 'Snare Netter', hp: 40, speed: 36, dmg: 9, xp: 5, r: 7, anim: 6, behavior: 'netter', range: 95, fireCd: 3.2, projDmg: 5 },
  slinger: { name: 'Snare Slinger', hp: 28, speed: 38, dmg: 7, xp: 4, r: 6, anim: 6, behavior: 'ranged', proj: 'p_pebble', range: 140, fireCd: 2.0, projDmg: 8 },
  drone: { name: 'Cage Drone', hp: 30, speed: 52, dmg: 5, xp: 5, r: 6, anim: 8, behavior: 'drone', flying: true },

  king_slime: { name: 'King Slime', hp: 1100, speed: 30, dmg: 20, xp: 120, r: 20, anim: 4, boss: true, behavior: 'kingslime', knockRes: 1 },
  treant: { name: 'Elder Treant', hp: 2600, speed: 22, dmg: 24, xp: 220, r: 18, anim: 3, boss: true, behavior: 'treant', knockRes: 1 },
  colossus: { name: 'The Star Colossus', hp: 4800, speed: 21, dmg: 28, xp: 350, r: 20, anim: 2, boss: true, behavior: 'colossus', knockRes: 1 },
  alpha_wolf: { name: 'Alpha Wolf', hp: 7000, speed: 50, dmg: 30, xp: 500, r: 16, anim: 10, boss: true, behavior: 'alpha', knockRes: 1, minion: 'hound' },
  night_lord: { name: 'The Night Lord', hp: 13000, speed: 34, dmg: 34, xp: 1000, r: 14, anim: 3, boss: true, behavior: 'nightlord', knockRes: 1, flying: true, minion: 'inkwing' },
  inkking: { name: 'The Ink King', hp: 1100, speed: 30, dmg: 20, xp: 120, r: 20, anim: 4, boss: true, behavior: 'kingslime', knockRes: 1, minion: 'blob' },
  elder: { name: 'The Blighted Elder', hp: 2600, speed: 22, dmg: 24, xp: 220, r: 18, anim: 3, boss: true, behavior: 'treant', knockRes: 1, minion: 'thornling' },
  snareboss: { name: 'Snare Boss Grimjaw', hp: 4800, speed: 24, dmg: 28, xp: 350, r: 18, anim: 3, boss: true, behavior: 'snareboss', knockRes: 1 },
};

// Spawn timeline (in the 25-minute content clock; Game.stage = run time x PACE). rate = spawns per
// second. Pools are weights; 'native' means the monster of the zone you're standing in.
export const WAVES = [
  { t: 0, rate: 1.0, pool: { blob: 10, inkwing: 2 } },
  { t: 45, rate: 1.5, pool: { blob: 8, inkwing: 4 } },
  { t: 90, rate: 2.0, pool: { blob: 7, inkwing: 4, native: 1 } },
  { t: 150, rate: 2.5, pool: { blob: 6, inkwing: 4, native: 3, spitter: 1 } },
  { t: 210, rate: 3.0, pool: { blob: 5, inkwing: 4, native: 4, spitter: 2 } },
  { t: 300, rate: 3.2, pool: { blob: 4, native: 5, spitter: 3, hound: 3, bloater: 1 } },
  { t: 390, rate: 3.8, pool: { inkwing: 4, native: 5, hound: 4, spitter: 3, bloater: 2 } },
  { t: 480, rate: 4.4, pool: { hound: 5, spitter: 3, shardooze: 2, native: 5, bloater: 2 } },
  { t: 600, rate: 5.0, pool: { hound: 4, shardooze: 3, native: 6, spitter: 3, bloater: 2 } },
  { t: 720, rate: 5.6, pool: { native: 6, shardooze: 3, inkwing: 5, hound: 4, bloater: 3 } },
  { t: 840, rate: 6.4, pool: { native: 6, hound: 4, shardooze: 3, spitter: 4, bloater: 3 } },
  { t: 960, rate: 7.2, pool: { native: 7, shardooze: 4, hound: 5, inkwing: 4, bloater: 3 } },
  { t: 1080, rate: 8.2, pool: { native: 7, shardooze: 4, hound: 6, spitter: 4, bloater: 4 } },
  { t: 1200, rate: 9.2, pool: { native: 7, shardooze: 5, hound: 6, inkwing: 5, bloater: 4 } },
  { t: 1320, rate: 10.5, pool: { native: 8, shardooze: 5, hound: 6, spitter: 5, bloater: 5 } },
  { t: 1440, rate: 12, pool: { native: 8, shardooze: 6, hound: 7, inkwing: 6, bloater: 5 } },
];

// type 'turned' = a survivalmon the star turned strange comes for you (beat it to free it)
export const EVENTS = [
  { t: 170, type: 'ring', enemy: 'blob', count: 16, msg: 'The Blight closes in!' },
  { t: 210, type: 'swarm', enemy: 'hound', count: 12, msg: 'A pack of shade hounds!' },
  { t: 240, type: 'swarm', enemy: 'inkwing', count: 22, msg: 'A swarm of Inkwings!' },
  { t: 300, type: 'boss', enemy: 'inkking' },
  { t: 420, type: 'swarm', enemy: 'hound', count: 14, msg: 'Shade hounds on the hunt!' },
  { t: 480, type: 'turned' },
  { t: 540, type: 'ring', enemy: 'native', count: 26, msg: 'The monsters of this land surround you!' },
  { t: 600, type: 'boss', enemy: 'elder' },
  { t: 690, type: 'swarm', enemy: 'spitter', count: 14, msg: 'Spitters crawl out of the dark!' },
  { t: 780, type: 'swarm', enemy: 'inkwing', count: 36, msg: 'Inkwings pour out of the dark...' },
  { t: 900, type: 'boss', enemy: 'colossus' },
  { t: 1020, type: 'ring', enemy: 'shardooze', count: 22, msg: 'Shard Oozes surround you!' },
  { t: 1080, type: 'turned' },
  { t: 1140, type: 'swarm', enemy: 'bloater', count: 18, msg: 'Bloaters! Keep your distance!' },
  { t: 1200, type: 'boss', enemy: 'alpha_wolf' },
  { t: 1320, type: 'ring', enemy: 'blob', count: 40, msg: 'The ground boils with ink!' },
  { t: 1440, type: 'boss', enemy: 'night_lord' },
];

// Enemy HP multiplier by run time (seconds)
export function hpScale(t) {
  const m = t / 60;
  return 1 + 0.09 * m + 0.011 * m * m;
}
