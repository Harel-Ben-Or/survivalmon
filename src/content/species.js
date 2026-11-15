// Survivalmons: the 6 species, their same-species breeds (Voltowl + Voltowl = Tempestowl), the 15
// mixed breeds and the mixed breeds' evolutions. Monsters live in creatures.js and are never caught.
// stage 1 = species (wild, starter eggs) · 2 = breeds · 3 = evolved mixed breeds.

export const TYPES = {
  fire: { name: 'Fire', color: '#f08a3c' },
  water: { name: 'Water', color: '#4aa3df' },
  grass: { name: 'Grass', color: '#6cc24e' },
  storm: { name: 'Storm', color: '#e8c030' },
  rock: { name: 'Rock', color: '#a89a88' },
  fairy: { name: 'Fairy', color: '#f5a0d8' },
  shadow: { name: 'Shadow', color: '#8a6ad0' },
};

// Evolution stones: a mixed breed evolves with a stone of either parent's type. Rare boss and wild drops.
export const STONES = {
  ember_stone: { name: 'Ember Stone', type: 'fire', icon: 'stone_fire' },
  tide_stone: { name: 'Tide Stone', type: 'water', icon: 'stone_water' },
  leaf_stone: { name: 'Leaf Stone', type: 'grass', icon: 'stone_grass' },
  thunder_stone: { name: 'Thunder Stone', type: 'storm', icon: 'stone_storm' },
  earth_stone: { name: 'Earth Stone', type: 'rock', icon: 'stone_rock' },
  moon_stone: { name: 'Moon Stone', type: 'fairy', icon: 'stone_fairy' },
  dusk_stone: { name: 'Dusk Stone', type: 'shadow', icon: 'stone_shadow' },
};
export const STONE_OF = { fire: 'ember_stone', water: 'tide_stone', grass: 'leaf_stone', storm: 'thunder_stone', rock: 'earth_stone', fairy: 'moon_stone' };

export const EVO_LEVEL = 10;      // mixed breeds evolve from this level (plus a matching stone)
export const BREED_LEVEL = 3;     // both parents need this level to breed
export const MAX_PET_LEVEL = 30;
export const petXpFor = (L) => Math.floor(14 + L * 8 + L * L);
export const BERRY_XP = 6;

// ---------------------------------------------------------------- the 6 species
// hp = base max HP; q = the unique skill's numbers; arch = how that skill attacks (see pet.js)
const BASE = {
  emberpup: {
    name: 'Emberpup', type: 'fire', arch: 'shooter', hp: 60, desc: 'Spits homing embers that burn.',
    unique: { name: 'Ember Spit', desc: 'Homing embers that burn.' },
    q: { dmg: 9, cd: 1.3, range: 150, proj: 'p_ember', speed: 150, homing: 6, burn: 3, count: 1, element: 'fire', glow: '#f6a03a' },
  },
  leafkit: {
    name: 'Leafkit', type: 'grass', arch: 'shooter', hp: 70, desc: 'Throws razor leaves and heals the team now and then.',
    unique: { name: 'Razor Leaf', desc: 'A leaf that slices through foes; heals you and the team every 9 s.' },
    q: { dmg: 10, cd: 1.4, range: 160, proj: 'p_leaf', speed: 200, pierce: 2, knock: 40, life: 1.1, count: 1, heal: 3, healCd: 9 },
  },
  voltowl: {
    name: 'Voltowl', type: 'storm', arch: 'zapper', hp: 55, desc: 'Zaps groups of foes with chain lightning.',
    unique: { name: 'Chain Zap', desc: 'Lightning that jumps between 3 foes.' },
    q: { dmg: 12, cd: 2.2, range: 150, chains: 3 },
  },
  puddlit: {
    name: 'Puddlit', type: 'water', arch: 'shooter', hp: 75, desc: 'Blows bubbles that slow foes.',
    unique: { name: 'Bubble', desc: 'Bubbles that slow foes.' },
    q: { dmg: 7, cd: 1.2, range: 150, proj: 'p_bubble', speed: 120, chill: 2.5, r: 5, count: 1 },
  },
  pebblet: {
    name: 'Pebblet', type: 'rock', arch: 'roller', hp: 95, desc: 'Curls up and rolls through foes.',
    unique: { name: 'Rollout', desc: 'Rolls through a line of foes.' },
    q: { dmg: 20, cd: 3.5, range: 140, speed: 220, time: 0.7, knock: 200, spin: true },
  },
  glimmoth: {
    name: 'Glimmoth', type: 'fairy', arch: 'aura', hp: 50, desc: 'Sheds sparkling dust that hurts foes and pulls in EXP.',
    unique: { name: 'Glitter Dust', desc: 'Dust that hurts nearby foes and widens your pickup range.' },
    q: { dmg: 5, tick: 0.5, radius: 30, magnet: 0.3, color: '#f5b8e8', fly: true },
  },
};

// ---------------------------------------------------------------- same-species breeds
// Two of the same species hatch its grown-up form (the art the game already had).
const PURE = {
  cinderhound: { from: 'emberpup', name: 'Cinderhound', desc: 'Its blue flames never go out.', mod: { count: 1, explode: 1 }, unique: { name: 'Blue Blaze', desc: 'Twin embers that explode on hit.' } },
  thornhare: { from: 'leafkit', name: 'Thornhare', desc: 'A rose-eared guardian of the meadow.', mod: { heal: 5, count: 1 }, unique: { name: 'Petal Dance', desc: 'Two leaves at once and bigger team heals.' } },
  tempestowl: { from: 'voltowl', name: 'Tempestowl', desc: 'It wears the thunderstorm like a cloak.', mod: { chains: 5, cd: -0.3 }, unique: { name: 'Thunderclap', desc: 'Lightning that jumps between 8 foes.' } },
  tidetoad: { from: 'puddlit', name: 'Tidetoad', desc: 'Its croak calls the tide.', mod: { count: 1, freeze: 0.8 }, unique: { name: 'Riptide', desc: 'Twin bubbles that can freeze foes.' } },
  boulderon: { from: 'pebblet', name: 'Boulderon', desc: 'A rolling mountain with a magma heart.', mod: { burn: 6, cd: -0.5 }, unique: { name: 'Magma Roll', desc: 'Rolls that leave foes burning.' } },
  lunamoth: { from: 'glimmoth', name: 'Lunamoth', desc: 'Its wings glow like the full moon.', mod: { radius: 10, magnet: 0.2, freezeChance: 0.1 }, unique: { name: 'Moonbeam', desc: 'A wider cloud that sometimes freezes foes.' } },
};

// ---------------------------------------------------------------- mixed breeds and their evolutions
// pair = the two parent species; the breed's own skill fuses both parents' styles.
const MIXED = {
  ashbloom: { pair: ['emberpup', 'leafkit'], name: 'Ashbloom', desc: 'A fox-bunny whose petals smoulder.', arch: 'shooter', hp: 1.6,
    unique: { name: 'Wildfire Petals', desc: 'Burning petals that pierce foes and heal the team.' },
    q: { dmg: 14, cd: 1.3, range: 160, proj: 'p_leaf', speed: 190, pierce: 2, burn: 4, count: 2, heal: 3, healCd: 8, element: 'fire', glow: '#f6a03a' },
    evo: { id: 'infernobloom', name: 'Infernobloom', desc: 'A blazing garden on four paws.' } },
  scaldfrog: { pair: ['emberpup', 'puddlit'], name: 'Scaldfrog', desc: 'Steam hisses from the vents on its back.', arch: 'lobber', hp: 1.7,
    unique: { name: 'Steam Burst', desc: 'Scalding clouds that burn and slow foes.' },
    q: { dmg: 8, cd: 2.4, range: 150, radius: 26, dur: 3, tick: 0.5, burn: 2, chill: 1.2, count: 1 },
    evo: { id: 'geyserking', name: 'Geyserking', desc: 'Its croak erupts like a hot spring.' } },
  blazewing: { pair: ['emberpup', 'voltowl'], name: 'Blazewing', desc: 'Its feathers crackle with fire and sparks.', arch: 'zapper', hp: 1.5,
    unique: { name: 'Thunder Ember', desc: 'Burning lightning that jumps between 4 foes.' },
    q: { dmg: 16, cd: 2, range: 160, chains: 4, burn: 3 },
    evo: { id: 'phoenowl', name: 'Phoenowl', desc: 'Reborn in a storm of fire.' } },
  magmaul: { pair: ['emberpup', 'pebblet'], name: 'Magmaul', desc: 'A stocky pup of rock with lava in its cracks.', arch: 'roller', hp: 1.8,
    unique: { name: 'Lava Charge', desc: 'Rolls through foes and sets them burning.' },
    q: { dmg: 28, cd: 3, range: 150, speed: 230, time: 0.7, knock: 220, burn: 5, spin: true },
    evo: { id: 'volcanox', name: 'Volcanox', desc: 'A walking volcano, warm to its friends.' } },
  pyrefly: { pair: ['emberpup', 'glimmoth'], name: 'Pyrefly', desc: 'A fluffy moth-fox with ember wings.', arch: 'aura', hp: 1.5,
    unique: { name: 'Ember Dust', desc: 'Burning dust around it that pulls in EXP.' },
    q: { dmg: 7, tick: 0.5, radius: 32, burn: 2, magnet: 0.3, color: '#f6a03a', fly: true },
    evo: { id: 'solarfly', name: 'Solarfly', desc: 'It glows like a tiny sun.' } },
  lilypaw: { pair: ['leafkit', 'puddlit'], name: 'Lilypaw', desc: 'A bunny-frog that naps on lily pads.', arch: 'shooter', hp: 1.7,
    unique: { name: 'Rain Bloom', desc: 'Slowing bubbles; heals the team often.' },
    q: { dmg: 10, cd: 1.2, range: 150, proj: 'p_bubble', speed: 130, chill: 2.5, r: 5, count: 2, heal: 4, healCd: 7 },
    evo: { id: 'lotusage', name: 'Lotusage', desc: 'A wise old guardian of the pond.' } },
  gustleaf: { pair: ['leafkit', 'voltowl'], name: 'Gustleaf', desc: 'An owl with leaf wings and sparks between them.', arch: 'shooter', hp: 1.5,
    unique: { name: 'Leaf Storm', desc: 'Piercing leaves that zap the foes they hit.' },
    q: { dmg: 12, cd: 1.3, range: 170, proj: 'p_leaf', speed: 220, pierce: 3, count: 2, zapOnHit: 2 },
    evo: { id: 'stormleaf', name: 'Stormleaf', desc: 'It rides the wind of every thunderstorm.' } },
  mossmound: { pair: ['leafkit', 'pebblet'], name: 'Mossmound', desc: 'A mossy boulder-bunny with ferns on its back.', arch: 'slam', hp: 2,
    unique: { name: 'Root Slam', desc: 'Slams the ground and roots foes in place.' },
    q: { dmg: 22, cd: 2.8, radius: 38, knock: 160, root: 1.5 },
    evo: { id: 'mossgiant', name: 'Mossgiant', desc: 'Forests grow on its shoulders.' } },
  petalwisp: { pair: ['leafkit', 'glimmoth'], name: 'Petalwisp', desc: 'A flower fairy with petal wings.', arch: 'aura', hp: 1.5,
    unique: { name: 'Blossom Ring', desc: 'Petal dust that hurts foes and heals the team.' },
    q: { dmg: 6, tick: 0.5, radius: 32, heal: 3, healCd: 6, color: '#ffb8d8', fly: true },
    evo: { id: 'blossomwisp', name: 'Blossomwisp', desc: 'Spring follows wherever it flies.' } },
  zapgill: { pair: ['puddlit', 'voltowl'], name: 'Zapgill', desc: 'A frog with fins that crackle.', arch: 'zapper', hp: 1.6,
    unique: { name: 'Storm Surge', desc: 'Lightning that slows every foe it jumps to.' },
    q: { dmg: 14, cd: 2, range: 150, chains: 4, chill: 1.5 },
    evo: { id: 'stormgill', name: 'Stormgill', desc: 'It swims through thunderclouds.' } },
  coralump: { pair: ['puddlit', 'pebblet'], name: 'Coralump', desc: 'A stone turtle-frog covered in coral.', arch: 'slam', hp: 2.1,
    unique: { name: 'Tidal Slam', desc: 'A splashing slam that knocks foes back and slows them.' },
    q: { dmg: 20, cd: 2.6, radius: 40, knock: 280, chill: 2 },
    evo: { id: 'reefguard', name: 'Reefguard', desc: 'A living reef that guards its friends.' } },
  mistmoth: { pair: ['puddlit', 'glimmoth'], name: 'Mistmoth', desc: 'A moth with misty, dewdrop wings.', arch: 'aura', hp: 1.6,
    unique: { name: 'Dream Mist', desc: 'A wide mist that slows foes and pulls in EXP.' },
    q: { dmg: 5, tick: 0.5, radius: 42, chill: 1.5, magnet: 0.4, color: '#bfeaff', fly: true },
    evo: { id: 'dreammoth', name: 'Dreammoth', desc: 'Foes forget why they came.' } },
  cragowl: { pair: ['voltowl', 'pebblet'], name: 'Cragowl', desc: 'A stone-feathered owl with glowing eyes.', arch: 'slam', hp: 1.9,
    unique: { name: 'Thunder Quake', desc: 'A crashing slam that stuns foes.' },
    q: { dmg: 24, cd: 2.8, radius: 36, knock: 200, stun: 0.6 },
    evo: { id: 'titanowl', name: 'Titanowl', desc: 'Mountains tremble when it lands.' } },
  aurowl: { pair: ['voltowl', 'glimmoth'], name: 'Aurowl', desc: 'An owl with shimmering aurora wings.', arch: 'zapper', hp: 1.5,
    unique: { name: 'Aurora Arc', desc: 'Lightning that jumps between 6 foes; widens your pickup range.' },
    q: { dmg: 13, cd: 2, range: 170, chains: 6, magnet: 0.3 },
    evo: { id: 'celestowl', name: 'Celestowl', desc: 'It carries the night sky on its wings.' } },
  gemmoth: { pair: ['pebblet', 'glimmoth'], name: 'Gemmoth', desc: 'A moth with crystal wings.', arch: 'lobber', hp: 1.8,
    unique: { name: 'Prism Shards', desc: 'Crystal clouds that daze the foes inside.' },
    q: { dmg: 10, cd: 2.2, range: 150, radius: 24, dur: 2.5, tick: 0.5, stun: 0.3, count: 2 },
    evo: { id: 'prismoth', name: 'Prismoth', desc: 'Light bends around its wings.' } },
};

export const SPECIES = {};
for (const [id, s] of Object.entries(BASE)) {
  SPECIES[id] = { ...s, id, stage: 1, kind: 'base', types: [s.type], lines: [id], line: id };
}
for (const [id, p] of Object.entries(PURE)) {
  const b = BASE[p.from];
  const q = { ...b.q, dmg: Math.round(b.q.dmg * 1.6) };
  for (const [k, v] of Object.entries(p.mod)) q[k] = (q[k] || 0) + v;
  SPECIES[id] = { ...b, id, stage: 2, kind: 'pure', name: p.name, desc: p.desc, q, hp: Math.round(b.hp * 1.7), unique: p.unique,
    types: [b.type], type: b.type, lines: [p.from, p.from], line: p.from, pair: [p.from, p.from] };
}
for (const [id, m] of Object.entries(MIXED)) {
  const [a, b] = m.pair, hp = Math.round(((BASE[a].hp + BASE[b].hp) / 2) * m.hp);
  const types = [BASE[a].type, BASE[b].type];
  SPECIES[id] = { id, stage: 2, kind: 'mixed', name: m.name, desc: m.desc, arch: m.arch, q: m.q, hp, unique: m.unique,
    types, type: types[0], lines: [a, b], line: a, pair: [a, b], evo: m.evo.id, fly: !!m.q.fly };
  const q = { ...m.q, dmg: Math.round(m.q.dmg * 1.5) };
  if (q.count) q.count += 1; else if (q.chains) q.chains += 2; else if (q.radius) q.radius += 8;
  SPECIES[m.evo.id] = { id: m.evo.id, stage: 3, kind: 'evolved', name: m.evo.name, desc: m.evo.desc, arch: m.arch, q, hp: Math.round(hp * 1.4),
    unique: { name: `Great ${m.unique.name}`, desc: `${m.unique.desc} Stronger and wider.` }, types, type: types[0], lines: [a, b], line: a, pair: [a, b], from: id };
}

export const BASE_IDS = Object.keys(BASE);
export const PURE_IDS = Object.keys(PURE);
export const MIXED_IDS = Object.keys(MIXED);
export const EVOLVED_IDS = MIXED_IDS.map((id) => MIXED[id].evo.id);
export const DEX_IDS = [...BASE_IDS, ...PURE_IDS, ...MIXED_IDS, ...EVOLVED_IDS];
// Starter eggs: every species but Glimmoth, which only turns up in the wild.
export const STARTERS = ['emberpup', 'leafkit', 'puddlit', 'voltowl', 'pebblet'];
// Kept so older code can ask; nothing is caught with orbs any more.
export const CRITTER_IDS = BASE_IDS;

// What two parents hatch into: the same species gives its grown-up form, two species their mix.
const PAIR = {};
for (const id of MIXED_IDS) PAIR[[...MIXED[id].pair].sort().join('+')] = id;
for (const id of PURE_IDS) PAIR[`${PURE[id].from}+${PURE[id].from}`] = id;
// Parents can be breeds themselves: what counts is the species line each one mainly belongs to.
export function breedResult(a, b) {
  const la = SPECIES[a].line, lb = SPECIES[b].line;
  return PAIR[[la, lb].sort().join('+')] || null;
}

// The unique skill's numbers. Level scaling happens in the Pet (its power).
export function speciesStats(speciesId) { return { ...SPECIES[speciesId].q }; }
