// Survivalmons: the 10 species, their same-species breeds (Voltowl + Voltowl = Tempestowl), the 45
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
  ice: { name: 'Ice', color: '#8fe0f0' },
  toxic: { name: 'Toxic', color: '#a6c83a' },
  metal: { name: 'Metal', color: '#9aa8bc' },
};

// Attack types: how a survivalmon's attack skill hits. Skills, survivalmons and upgrade cards say
// which type they are or work on. `perk` is what a type card adds besides damage.
export const ATK_TYPES = {
  shot: { name: 'Projectile', icon: 'atk_shot', color: '#ffb46a', desc: 'Shots that fly at foes', perk: 'attacks 8% faster' },
  chain: { name: 'Chain', icon: 'atk_chain', color: '#ffe36a', desc: 'Lightning that jumps from foe to foe', perk: '+1 jump' },
  area: { name: 'Area', icon: 'atk_area', color: '#8fe08a', desc: 'Hits every foe in a circle: slams, auras and pools', perk: '12% bigger' },
  charge: { name: 'Charge', icon: 'atk_charge', color: '#ff8a7a', desc: 'Rushes through foes', perk: 'charges 10% more often' },
};
export const ATK_TYPE_IDS = Object.keys(ATK_TYPES);
const ARCH_TYPE = { shooter: 'shot', zapper: 'chain', slam: 'area', aura: 'area', lobber: 'area', roller: 'charge' };
export const archType = (arch) => ARCH_TYPE[arch];
export const atkType = (speciesId) => ARCH_TYPE[SPECIES[speciesId]?.arch];

// Evolution stones: a mixed breed evolves with a stone of either parent's type. Rare boss and wild drops.
export const STONES = {
  ember_stone: { name: 'Ember Stone', type: 'fire', icon: 'stone_fire' },
  tide_stone: { name: 'Tide Stone', type: 'water', icon: 'stone_water' },
  leaf_stone: { name: 'Leaf Stone', type: 'grass', icon: 'stone_grass' },
  thunder_stone: { name: 'Thunder Stone', type: 'storm', icon: 'stone_storm' },
  earth_stone: { name: 'Earth Stone', type: 'rock', icon: 'stone_rock' },
  moon_stone: { name: 'Moon Stone', type: 'fairy', icon: 'stone_fairy' },
  dusk_stone: { name: 'Dusk Stone', type: 'shadow', icon: 'stone_shadow' },
  frost_stone: { name: 'Frost Stone', type: 'ice', icon: 'stone_ice' },
  venom_stone: { name: 'Venom Stone', type: 'toxic', icon: 'stone_toxic' },
  steel_stone: { name: 'Steel Stone', type: 'metal', icon: 'stone_metal' },
};
export const STONE_OF = { fire: 'ember_stone', water: 'tide_stone', grass: 'leaf_stone', storm: 'thunder_stone', rock: 'earth_stone', fairy: 'moon_stone',
  shadow: 'dusk_stone', ice: 'frost_stone', toxic: 'venom_stone', metal: 'steel_stone' };

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
  duskit: {
    name: 'Duskit', type: 'shadow', arch: 'shooter', hp: 60, desc: 'A shadow kitten that flings homing dark orbs.',
    unique: { name: 'Shade Orb', desc: 'Homing dark orbs that pass through a foe.' },
    q: { dmg: 10, cd: 1.4, range: 160, proj: 'p_dark_orb', speed: 140, homing: 5, pierce: 1, count: 1, glow: '#a070ff' },
  },
  snowpip: {
    name: 'Snowpip', type: 'ice', arch: 'shooter', hp: 70, desc: 'A penguin chick that throws ice shards.',
    unique: { name: 'Ice Shard', desc: 'Shards that slow foes and sometimes freeze them.' },
    q: { dmg: 8, cd: 1.3, range: 150, proj: 'p_ice', speed: 180, chill: 2, freezeChance: 0.15, count: 1, glow: '#bff4ff' },
  },
  venewt: {
    name: 'Venewt', type: 'toxic', arch: 'lobber', hp: 65, desc: 'A newt that spits poison goo into puddles.',
    unique: { name: 'Toxic Puddle', desc: 'Lobs goo that leaves a poison puddle.' },
    q: { dmg: 6, cd: 2.2, range: 150, radius: 24, dur: 3, tick: 0.5, burn: 3, count: 1 },
  },
  ferrit: {
    name: 'Ferrit', type: 'metal', arch: 'shooter', hp: 80, desc: 'A steel ferret that throws spinning blades.',
    unique: { name: 'Blade Spin', desc: 'Spinning blades that cut through a line of foes.' },
    q: { dmg: 11, cd: 1.6, range: 150, proj: 'p_boomerang', speed: 190, pierce: 3, knock: 50, life: 1.0, count: 1 },
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
  nightprowl: { from: 'duskit', name: 'Nightprowl', desc: 'A panther of living shadow.', mod: { count: 1, homing: 3 }, unique: { name: 'Twin Shades', desc: 'Two homing dark orbs at once.' } },
  emperice: { from: 'snowpip', name: 'Emperice', desc: 'An emperor penguin crowned with ice.', mod: { count: 1, freezeChance: 0.15 }, unique: { name: 'Blizzard Shards', desc: 'Twin shards that freeze foes more often.' } },
  venomander: { from: 'venewt', name: 'Venomander', desc: 'A salamander dragon with dripping spikes.', mod: { radius: 8, burn: 3 }, unique: { name: 'Acid Bog', desc: 'Wider puddles of stronger poison.' } },
  steelfang: { from: 'ferrit', name: 'Steelfang', desc: 'A steel wolverine with a twin-blade tail.', mod: { count: 1, pierce: 2 }, unique: { name: 'Twin Blades', desc: 'Two spinning blades that cut deeper.' } },
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

  // --- Duskit (shadow) with the first six
  cindercat: { pair: ['emberpup', 'duskit'], name: 'Cindercat', desc: 'A smoky cat whose violet flames flicker in the dark.', arch: 'shooter', hp: 1.6,
    unique: { name: 'Hellfire Orb', desc: 'Homing dark fireballs that burn.' },
    q: { dmg: 13, cd: 1.4, range: 160, proj: 'p_dark_orb', speed: 150, homing: 6, burn: 4, count: 2, element: 'fire', glow: '#c070ff' },
    evo: { id: 'infernyx', name: 'Infernyx', desc: 'A panther wreathed in violet fire.' } },
  thornshade: { pair: ['leafkit', 'duskit'], name: 'Thornshade', desc: 'A bunny-cat that hides in thorny shadows.', arch: 'slam', hp: 1.8,
    unique: { name: 'Night Thorns', desc: 'Thorns burst from the shadows and root foes.' },
    q: { dmg: 20, cd: 2.6, radius: 38, knock: 140, root: 1.6 },
    evo: { id: 'nightbramble', name: 'Nightbramble', desc: 'Its thorns bloom only at midnight.' } },
  gloomowl: { pair: ['voltowl', 'duskit'], name: 'Gloomowl', desc: 'An owl that flies silent on dark lightning.', arch: 'zapper', hp: 1.5,
    unique: { name: 'Dark Volt', desc: 'Lightning that jumps between 4 foes and dazes them.' },
    q: { dmg: 14, cd: 2, range: 160, chains: 4, stun: 0.3 },
    evo: { id: 'eclipsowl', name: 'Eclipsowl', desc: 'It blots out the moon when it spreads its wings.' } },
  murkfin: { pair: ['puddlit', 'duskit'], name: 'Murkfin', desc: 'A frog-cat that lurks in black water.', arch: 'shooter', hp: 1.7,
    unique: { name: 'Murk Bubble', desc: 'Homing bubbles that slow foes.' },
    q: { dmg: 10, cd: 1.2, range: 160, proj: 'p_bubble', speed: 130, homing: 5, chill: 2.5, r: 5, count: 2 },
    evo: { id: 'abyssfin', name: 'Abyssfin', desc: 'It rises from the deepest, darkest lake.' } },
  shadestone: { pair: ['pebblet', 'duskit'], name: 'Shadestone', desc: 'A stone kitten with a crack of shadow.', arch: 'roller', hp: 1.9,
    unique: { name: 'Shadow Roll', desc: 'Rolls through foes and leaves them dazed.' },
    q: { dmg: 24, cd: 3, range: 150, speed: 230, time: 0.7, knock: 200, stun: 0.5, spin: true },
    evo: { id: 'obsidclaw', name: 'Obsidclaw', desc: 'Its obsidian hide drinks the light.' } },
  duskmoth: { pair: ['glimmoth', 'duskit'], name: 'Duskmoth', desc: 'A moth with wings like the night sky.', arch: 'aura', hp: 1.5,
    unique: { name: 'Night Dust', desc: 'Dust that hurts foes, sometimes freezes them, and pulls in EXP.' },
    q: { dmg: 6, tick: 0.5, radius: 32, magnet: 0.3, freezeChance: 0.08, color: '#9a7ae0', fly: true },
    evo: { id: 'nocturna', name: 'Nocturna', desc: 'Its wings hold a thousand sleeping stars.' } },

  // --- Snowpip (ice) with the first six
  frostflare: { pair: ['emberpup', 'snowpip'], name: 'Frostflare', desc: 'A fox whose tail burns with cold blue fire.', arch: 'shooter', hp: 1.6,
    unique: { name: 'Frostfire', desc: 'Homing embers that burn and slow.' },
    q: { dmg: 12, cd: 1.3, range: 160, proj: 'p_ember', speed: 160, homing: 6, burn: 3, chill: 1.5, count: 2, element: 'fire', glow: '#8fe0ff' },
    evo: { id: 'auroravix', name: 'Auroravix', desc: 'Its fur shimmers between flame and frost.' } },
  frostbloom: { pair: ['leafkit', 'snowpip'], name: 'Frostbloom', desc: 'A bunny wrapped in frosted leaves.', arch: 'shooter', hp: 1.7,
    unique: { name: 'Frost Leaf', desc: 'Piercing icy leaves that slow foes and heal the team.' },
    q: { dmg: 11, cd: 1.3, range: 160, proj: 'p_leaf', speed: 200, pierce: 2, chill: 2, count: 2, heal: 3, healCd: 8 },
    evo: { id: 'wintergrove', name: 'Wintergrove', desc: 'A pine forest in winter, on four paws.' } },
  blizzowl: { pair: ['voltowl', 'snowpip'], name: 'Blizzowl', desc: 'An owl that brings sleet and lightning.', arch: 'zapper', hp: 1.5,
    unique: { name: 'Sleet Bolt', desc: 'Lightning that jumps between 4 foes and slows them.' },
    q: { dmg: 14, cd: 2, range: 160, chains: 4, chill: 2 },
    evo: { id: 'hailstrix', name: 'Hailstrix', desc: 'Hail falls wherever it hunts.' } },
  floepip: { pair: ['puddlit', 'snowpip'], name: 'Floepip', desc: 'A penguin-frog that slides on ice floes.', arch: 'shooter', hp: 1.8,
    unique: { name: 'Freeze Bubble', desc: 'Bubbles that slow foes and often freeze them.' },
    q: { dmg: 9, cd: 1.2, range: 150, proj: 'p_bubble', speed: 130, chill: 2.5, freeze: 0.8, r: 5, count: 2 },
    evo: { id: 'glacierback', name: 'Glacierback', desc: 'An iceberg rides on its shell.' } },
  avalump: { pair: ['pebblet', 'snowpip'], name: 'Avalump', desc: 'A snowy boulder that starts avalanches.', arch: 'roller', hp: 2,
    unique: { name: 'Avalanche', desc: 'Rolls through foes and leaves them slowed.' },
    q: { dmg: 26, cd: 3, range: 150, speed: 230, time: 0.7, knock: 220, chill: 2.5, spin: true },
    evo: { id: 'glacitan', name: 'Glacitan', desc: 'As big and cold as a glacier.' } },
  frostfae: { pair: ['glimmoth', 'snowpip'], name: 'Frostfae', desc: 'A snowflake fairy that sparkles in the cold.', arch: 'aura', hp: 1.5,
    unique: { name: 'Diamond Dust', desc: 'Icy dust that slows foes and sometimes freezes them.' },
    q: { dmg: 5, tick: 0.5, radius: 34, chill: 1.5, freezeChance: 0.1, magnet: 0.2, color: '#d8f6ff', fly: true },
    evo: { id: 'aurorafae', name: 'Aurorafae', desc: 'Northern lights trail behind it.' } },

  // --- Venewt (toxic) with the first six
  smogpup: { pair: ['emberpup', 'venewt'], name: 'Smogpup', desc: 'A pup that breathes choking smoke.', arch: 'lobber', hp: 1.6,
    unique: { name: 'Smog Cloud', desc: 'Lobs burning clouds of smog.' },
    q: { dmg: 8, cd: 2.2, range: 150, radius: 26, dur: 3, tick: 0.5, burn: 5, count: 1 },
    evo: { id: 'fumeroar', name: 'Fumeroar', desc: 'Its roar is a cloud of burning smog.' } },
  sporebun: { pair: ['leafkit', 'venewt'], name: 'Sporebun', desc: 'A bunny with poison mushrooms on its back.', arch: 'lobber', hp: 1.7,
    unique: { name: 'Spore Puff', desc: 'Poison spore clouds; heals the team now and then.' },
    q: { dmg: 7, cd: 2.2, range: 150, radius: 26, dur: 3, tick: 0.5, burn: 3, count: 2, heal: 3, healCd: 9 },
    evo: { id: 'mycelord', name: 'Mycelord', desc: 'A walking forest of toadstools.' } },
  toxivolt: { pair: ['voltowl', 'venewt'], name: 'Toxivolt', desc: 'A newt whose slime sparks with electricity.', arch: 'zapper', hp: 1.6,
    unique: { name: 'Venom Volt', desc: 'Lightning that jumps between 4 foes and poisons them.' },
    q: { dmg: 13, cd: 2, range: 150, chains: 4, burn: 4 },
    evo: { id: 'voltoxin', name: 'Voltoxin', desc: 'Its venom glows like lightning.' } },
  sludgill: { pair: ['puddlit', 'venewt'], name: 'Sludgill', desc: 'A slimy fish-newt from murky bogs.', arch: 'shooter', hp: 1.7,
    unique: { name: 'Sludge Shot', desc: 'Globs that poison and slow foes.' },
    q: { dmg: 9, cd: 1.3, range: 150, proj: 'p_spore', speed: 140, burn: 3, chill: 2, r: 5, count: 2 },
    evo: { id: 'swamplord', name: 'Swamplord', desc: 'The whole swamp obeys its croak.' } },
  corrodon: { pair: ['pebblet', 'venewt'], name: 'Corrodon', desc: 'A rock lizard dripping with acid.', arch: 'slam', hp: 1.9,
    unique: { name: 'Acid Quake', desc: 'A slam that splashes acid on foes.' },
    q: { dmg: 22, cd: 2.8, radius: 38, knock: 180, burn: 4 },
    evo: { id: 'corrosaur', name: 'Corrosaur', desc: 'Its acid melts mountains.' } },
  fogwing: { pair: ['glimmoth', 'venewt'], name: 'Fogwing', desc: 'A lovely moth with poisonous scales.', arch: 'aura', hp: 1.5,
    unique: { name: 'Poison Haze', desc: 'A haze that poisons foes and pulls in EXP.' },
    q: { dmg: 5, tick: 0.5, radius: 34, burn: 2, magnet: 0.3, color: '#c0e070', fly: true },
    evo: { id: 'hazewing', name: 'Hazewing', desc: 'Its haze lulls foes into a deep sleep.' } },

  // --- Ferrit (metal) with the first six
  forgepup: { pair: ['emberpup', 'ferrit'], name: 'Forgepup', desc: 'A pup with a glowing forge in its chest.', arch: 'shooter', hp: 1.7,
    unique: { name: 'Molten Rivet', desc: 'Red-hot rivets that pierce and burn.' },
    q: { dmg: 13, cd: 1.4, range: 160, proj: 'p_ember', speed: 200, pierce: 2, burn: 4, count: 2, element: 'fire', glow: '#ffb040' },
    evo: { id: 'forgehound', name: 'Forgehound', desc: 'It hammers out its own armor.' } },
  vinegear: { pair: ['leafkit', 'ferrit'], name: 'Vinegear', desc: 'A brass clockwork bunny wrapped in vines.', arch: 'shooter', hp: 1.8,
    unique: { name: 'Gear Leaf', desc: 'Spinning gear-blades that cut through foes; heals the team.' },
    q: { dmg: 12, cd: 1.5, range: 150, proj: 'p_boomerang', speed: 190, pierce: 3, count: 1, life: 1.0, heal: 3, healCd: 8 },
    evo: { id: 'gearwood', name: 'Gearwood', desc: 'An ancient clockwork tree.' } },
  magnowl: { pair: ['voltowl', 'ferrit'], name: 'Magnowl', desc: 'A magnetic owl with copper feathers.', arch: 'zapper', hp: 1.6,
    unique: { name: 'Magnet Arc', desc: 'Lightning that jumps between 5 foes; widens your pickup range.' },
    q: { dmg: 13, cd: 2, range: 160, chains: 5, magnet: 0.4 },
    evo: { id: 'teslowl', name: 'Teslowl', desc: 'It hums with a million volts.' } },
  anchorfin: { pair: ['puddlit', 'ferrit'], name: 'Anchorfin', desc: 'A steel-finned frog as heavy as an anchor.', arch: 'slam', hp: 2.1,
    unique: { name: 'Anchor Drop', desc: 'A heavy slam that knocks foes back and slows them.' },
    q: { dmg: 22, cd: 2.7, radius: 40, knock: 300, chill: 2 },
    evo: { id: 'dreadnaut', name: 'Dreadnaut', desc: 'An armored warship of a frog.' } },
  ironclod: { pair: ['pebblet', 'ferrit'], name: 'Ironclod', desc: 'A boulder bound in iron bands.', arch: 'roller', hp: 2.2,
    unique: { name: 'Iron Roll', desc: 'A heavy roll that sends foes flying.' },
    q: { dmg: 30, cd: 3.2, range: 150, speed: 220, time: 0.75, knock: 320, spin: true, armor: 2 },
    evo: { id: 'titanclad', name: 'Titanclad', desc: 'Nothing can dent its iron shell.' } },
  chromoth: { pair: ['glimmoth', 'ferrit'], name: 'Chromoth', desc: 'A moth with mirror-chrome wings.', arch: 'aura', hp: 1.6,
    unique: { name: 'Mirror Dust', desc: 'Shiny dust that hurts foes and guards you.' },
    q: { dmg: 6, tick: 0.5, radius: 32, magnet: 0.2, armor: 2, color: '#e0e8f0', fly: true },
    evo: { id: 'mirrorwing', name: 'Mirrorwing', desc: 'Foes are dazzled by their own reflection.' } },

  // --- the four new species with each other
  frostshade: { pair: ['duskit', 'snowpip'], name: 'Frostshade', desc: 'A cat of black ice with frosty eyes.', arch: 'shooter', hp: 1.6,
    unique: { name: 'Black Ice', desc: 'Homing dark shards that slow and sometimes freeze foes.' },
    q: { dmg: 12, cd: 1.4, range: 160, proj: 'p_ice', speed: 160, homing: 5, chill: 2, freezeChance: 0.15, count: 2, glow: '#a090ff' },
    evo: { id: 'rimeshade', name: 'Rimeshade', desc: 'Its shadow freezes whatever it touches.' } },
  gloomnewt: { pair: ['duskit', 'venewt'], name: 'Gloomnewt', desc: 'A newt that hides in poisonous shadows.', arch: 'lobber', hp: 1.6,
    unique: { name: 'Shadow Bog', desc: 'Dark poison pools that daze the foes inside.' },
    q: { dmg: 8, cd: 2.2, range: 150, radius: 26, dur: 3, tick: 0.5, burn: 3, stun: 0.2, count: 2 },
    evo: { id: 'gloomdrake', name: 'Gloomdrake', desc: 'A shadow dragon dripping with venom.' } },
  shurikat: { pair: ['duskit', 'ferrit'], name: 'Shurikat', desc: 'A steel cat that throws shadow stars.', arch: 'shooter', hp: 1.7,
    unique: { name: 'Shadow Star', desc: 'Homing blades that cut through foes.' },
    q: { dmg: 13, cd: 1.5, range: 160, proj: 'p_boomerang', speed: 200, homing: 4, pierce: 2, count: 2, life: 1.0 },
    evo: { id: 'phantomblade', name: 'Phantomblade', desc: 'It strikes from the shadows, silent as steel.' } },
  slushling: { pair: ['snowpip', 'venewt'], name: 'Slushling', desc: 'A newt of poisonous slush.', arch: 'lobber', hp: 1.7,
    unique: { name: 'Toxic Slush', desc: 'Freezing poison puddles that slow foes.' },
    q: { dmg: 7, cd: 2.2, range: 150, radius: 26, dur: 3, tick: 0.5, burn: 3, chill: 2, count: 2 },
    evo: { id: 'frostbite', name: 'Frostbite', desc: 'Its bite is cold and venomous.' } },
  steelpeng: { pair: ['snowpip', 'ferrit'], name: 'Steelpeng', desc: 'A penguin in polished steel armor.', arch: 'roller', hp: 2,
    unique: { name: 'Steel Slide', desc: 'Belly-slides through foes, slowing them.' },
    q: { dmg: 26, cd: 2.8, range: 150, speed: 260, time: 0.6, knock: 240, chill: 2, armor: 1 },
    evo: { id: 'ironberg', name: 'Ironberg', desc: 'An iceberg wearing a steel helmet.' } },
  rustail: { pair: ['venewt', 'ferrit'], name: 'Rustail', desc: 'A newt whose acid rusts iron.', arch: 'lobber', hp: 1.8,
    unique: { name: 'Rust Rain', desc: 'Acid clouds that poison foes; guards you a little.' },
    q: { dmg: 8, cd: 2.2, range: 150, radius: 24, dur: 3, tick: 0.5, burn: 4, count: 2, armor: 1 },
    evo: { id: 'scrapdrake', name: 'Scrapdrake', desc: 'It eats rust and breathes acid.' } },
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
  const q = { ...m.q, dmg: Math.round(m.q.dmg * 1.2) };
  if (q.count) q.count += 1; else if (q.chains) q.chains += 1; else if (q.radius) q.radius += 8;
  SPECIES[m.evo.id] = { id: m.evo.id, stage: 3, kind: 'evolved', name: m.evo.name, desc: m.evo.desc, arch: m.arch, q, hp: Math.round(hp * 1.4),
    unique: { name: `Great ${m.unique.name}`, desc: `${m.unique.desc} Stronger and wider.` }, types, type: types[0], lines: [a, b], line: a, pair: [a, b], from: id };
}

// Close-range attacks (slams, auras, charges) only hit what comes near, so they hit harder to keep up
// with shots and lightning (measured with tools/sim.js: they dealt a quarter to a half as much).
const ARCH_BOOST = { slam: { dmg: 1.8, cd: 0.85 }, aura: { dmg: 2.0, radius: 1.2 }, roller: { dmg: 1.4 } };
for (const sp of Object.values(SPECIES)) {
  const k = ARCH_BOOST[sp.arch];
  if (!k) continue;
  sp.q = { ...sp.q, dmg: Math.round(sp.q.dmg * k.dmg) };
  if (k.cd && sp.q.cd) sp.q.cd = +(sp.q.cd * k.cd).toFixed(2);
  if (k.radius) sp.q.radius = Math.round((sp.q.radius || 30) * k.radius);
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
