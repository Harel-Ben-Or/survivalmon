// Passive artifacts (max level 3) and item combos.
export const ARTIFACTS = {
  clover: { name: 'Lucky Clover', icon: 'clover', max: 3, desc: (L) => `+${8 * L}% crit chance, +${10 * L}% luck`, mods: (L) => ({ crit: 0.08 * L, luck: 0.1 * L }) },
  feather: { name: 'Swift Feather', icon: 'feather', max: 3, desc: (L) => `+${10 * L}% move speed`, mods: (L) => ({ speed: 0.1 * L }) },
  fang: { name: 'Vampire Fang', icon: 'fang', max: 3, desc: (L) => `${15 + 10 * (L - 1)}% chance to heal 2 HP per kill`, mods: (L) => ({ healOnKill: 0.15 + 0.1 * (L - 1) }) },
  shell: { name: 'Iron Shell', icon: 'shell', max: 3, desc: (L) => `+${L} armor, +${10 * L} max HP`, mods: (L) => ({ armor: L, maxHp: 10 * L }) },
  magnet: { name: 'Magnet Stone', icon: 'magnet', max: 3, desc: (L) => `+${50 * L}% pickup range`, mods: (L) => ({ magnet: 0.5 * L }) },
  hourglass: { name: 'Hourglass', icon: 'hourglass', max: 3, desc: (L) => `-${8 * L}% cooldowns`, mods: (L) => ({ haste: 0.08 * L }) },
  ring: { name: "Giant's Ring", icon: 'ring', max: 3, desc: (L) => `+${15 * L}% area`, mods: (L) => ({ area: 0.15 * L }) },
  mirror: { name: 'Twin Mirror', icon: 'mirror', max: 3, desc: (L) => `+${L >= 3 ? 2 : 1} projectile${L >= 3 ? 's' : ''}${L === 2 ? ', +10% damage' : ''}`, mods: (L) => ({ amount: L >= 3 ? 2 : 1, might: L === 2 ? 0.1 : 0 }) },
  oilflask: { name: 'Oil Flask', icon: 'oilflask', max: 3, desc: (L) => `+${40 * L}% fire & burn damage`, mods: (L) => ({ burn: 0.4 * L }) },
  frostcrystal: { name: 'Frost Crystal', icon: 'frostcrystal', max: 3, desc: (L) => `${8 * L}% chance on hit to chill foes`, mods: (L) => ({ chill: 0.08 * L }) },
  stormcharm: { name: 'Storm Charm', icon: 'stormcharm', max: 3, desc: (L) => `+${25 * L}% lightning damage, +${L} chain`, mods: (L) => ({ lightning: 0.25 * L, chain: L }) },
  collar: { name: 'Golden Collar', icon: 'collar', max: 3, desc: (L) => `+${30 * L}% pet power`, mods: (L) => ({ petPower: 0.3 * L }) },
  phoenix: { name: 'Phoenix Feather', icon: 'phoenix', max: 3, desc: (L) => `Revive once at ${25 + 25 * L}% HP`, mods: (L) => ({ reviveHp: 0.25 + 0.25 * L }) },
  thornmail: { name: 'Thorn Mail', icon: 'thornmail', max: 3, desc: (L) => `Foes that touch you take ${8 * L} damage, +${L} armor`, mods: (L) => ({ thorns: 8 * L, armor: L }) },
  monocle: { name: "Scholar's Monocle", icon: 'monocle', max: 3, desc: (L) => `+${15 * L}% EXP gain`, mods: (L) => ({ growth: 0.15 * L }) },
  berrypouch: { name: 'Berry Pouch', icon: 'berrypouch', max: 3, desc: (L) => `+${(0.3 * L).toFixed(1)} HP/sec, hearts heal +${50 * L}%`, mods: (L) => ({ regen: 0.3 * L, heart: 0.5 * L }) },
};
export const ARTIFACT_IDS = Object.keys(ARTIFACTS);

// A combo is active when the player owns every piece. 'pet:any' means any pet.
export const COMBOS = [
  { id: 'inferno', name: 'Inferno', pieces: ['emberwand', 'oilflask'], desc: 'Ember bolts leave burning ground.' },
  { id: 'shatter', name: 'Shatter', pieces: ['frostnova', 'chainlight'], desc: 'Lightning deals x3 damage to frozen foes, +3 chains.' },
  { id: 'windarcher', name: 'Wind Archer', pieces: ['bow', 'feather'], desc: 'Arrows pierce 2 more foes and fly 50% faster.' },
  { id: 'twinfang', name: 'Twin Fang', pieces: ['boomerang', 'mirror'], desc: '+1 boomerang thrown in a wide spread, +30% damage.' },
  { id: 'bramble', name: 'Bramble Guard', pieces: ['leaves', 'thornmail'], desc: '+2 orbiting leaves, leaves deal double damage.' },
  { id: 'thundergod', name: 'Thunder God', pieces: ['lightrod', 'stormcharm'], desc: 'Each strike forks into 2 nearby foes.' },
  { id: 'overgrowth', name: 'Overgrowth', pieces: ['heal', 'berrypouch'], desc: 'Healing Bloom heals 50% more and blasts foes away.' },
  { id: 'bulwark', name: 'Bulwark', pieces: ['pitchfork', 'shell'], desc: 'Pitchfork thrusts stun and knock foes far back.' },
  { id: 'napalm', name: 'Napalm', pieces: ['bombs', 'oilflask'], desc: 'Bombs leave pools of fire.' },
  { id: 'steamburst', name: 'Steam Burst', pieces: ['fireball', 'frostnova'], desc: 'Fireball blast is 50% bigger, x2 damage to chilled/frozen foes.' },
  { id: 'cataclysm', name: 'Cataclysm', pieces: ['meteor', 'ring'], desc: '+4 meteors with 60% bigger blasts.' },
  { id: 'ricochet', name: 'Ricochet', pieces: ['sling', 'clover'], desc: 'Pebbles bounce 2 more times, crits always bounce.' },
  { id: 'frostbite', name: 'Frostbite', pieces: ['thornaura', 'frostcrystal'], desc: 'Bramble Aura chills foes and deals +50% to chilled.' },
  { id: 'bestfriends', name: 'Best Friends', pieces: ['collar', 'pet:any'], desc: 'Pets attack 50% faster.' },
  { id: 'kindred', name: 'Kindred Flame', pieces: ['emberpup', 'emberwand'], desc: 'Emberpup spits 3 embers at once.' },
  { id: 'stormwings', name: 'Storm Wings', pieces: ['voltowl', 'stormcharm'], desc: "Voltowl's zap chains to 4 more foes." },
  { id: 'tidepool', name: 'Tide Pool', pieces: ['puddlit', 'frostcrystal'], desc: "Puddlit's bubbles freeze foes solid." },
  { id: 'rockslide', name: 'Rockslide', pieces: ['pebblet', 'shell'], desc: 'Pebblet rolls twice as often and stuns.' },
];

export function combosFor(id) {
  return COMBOS.filter((c) => c.pieces.includes(id) || (c.pieces.includes('pet:any') && id.startsWith('pet:')));
}
