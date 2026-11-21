// Heroes' boosts for survivalmons, how each hero unlocks, and hero gear: 6 slots per hero, each
// piece fitting only its hero. Every hero has 6 sets: 3 Regular, 2 Epic and 1 Legendary. Each piece is
// one set's helmet, armor and so on, with its own name and picture, and a slot wears one piece at a
// time. Wearing 2, 4 or 6 pieces of a set gives its bonuses. A piece is leveled up at the Workshop, and
// the level belongs to the piece itself (not to the slot).

export const SLOTS = ['helmet', 'armor', 'gloves', 'boots', 'main', 'off'];
export const SLOT_NAME = { helmet: 'Helmet', armor: 'Body armor', gloves: 'Gloves', boots: 'Boots', main: 'Weapon', off: 'Off hand' };

// Tiers: stat = how much stronger a piece's own stat is. Epic drops past the South Gate, Legendary only
// from Night Lords from the East Gate on (see epicChance / legendChance). The Skyfall counter sells all three.
export const TIERS = {
  r: { name: 'Regular', color: '#cfe6ff', stat: 1 },
  e: { name: 'Epic', color: '#b46cff', stat: 1.25 },
  l: { name: 'Legendary', color: '#ffc83c', stat: 1.5 },
};
// How often a gear drop is Epic, by gate (tier 0 = North Gate Lv 1 ... 15 = West Gate Lv 4): nothing at
// the first gate, 8% at the South Gate, rising evenly to 45% at the last gate (the player's numbers: a
// run has several gear drops, so it stays under half).
export const epicChance = (tier) => (tier < 1 ? 0 : Math.min(0.45, 0.08 + (0.37 * (tier - 1)) / 14));
// How often a Night Lord leaves a Legendary piece: nothing before the East Gate, 10% there, rising
// evenly to 70% at the last gate.
export const legendChance = (tier) => (tier < 2 ? 0 : Math.min(0.7, 0.1 + (0.6 * (tier - 2)) / 13));

// The hero's weapon (mainW: its icon and tree). Every set's main-hand piece is a variation of it.
export const SETS = {
  rowan: { mainW: 'bow' }, rowanf: { mainW: 'boomerang' }, bram: { mainW: 'pitchfork' }, lyra: { mainW: 'emberwand' }, pip: { mainW: 'sling' },
};

// A set's bonuses at 2, 4 and 6 pieces (they add up: 6 pieces give all three). Every set has its own
// effects, built around its hero's weapon: what they do in a run is in systems/setfx.js (by the set's
// id and by how many of its bonuses are on), so a text here and its effect there must say the same.
// A bonus can also hold plain stats, which Meta.heroTeamBonus adds up:
//   team {dmg, hp, haste, def, crit}: for every survivalmon
//   hero {might, speed, armor, maxHp, haste, crit, regen, luck}: the hero's own stats (Player mods)
//   types {shot, chain, area, charge, support}: extra damage for survivalmons of that attack type
//   petXp, wild, coins, mats, shards: run bonuses (shards: how much more often Skyfall Shards drop)
//   power: the Legendary set's charged attack (see POWER)
const B = (text, mods = {}) => ({ text, ...mods });
// The Legendary power: with all 6 pieces on, every Nth attack of the hero's weapon is charged: mult
// times the damage and a bigger shot. It runs through the weapon's own attack, so it keeps every evolve
// (a Volley fires 3 charged arrows, the element still applies). Each Legendary set adds its own twist
// to the charged attack (setfx.js).
export const POWER = { every: 5, mult: 3 };
const power = (name, what, twist) => B(`+15% damage and HP for every survivalmon. ${name}: every 5th ${what} is charged, with 3 times the damage, and ${twist}. It keeps everything your weapon evolved into`, { team: { dmg: 0.15, hp: 0.15 }, power: name });

// shot: how the set's weapon looks in a run (worn in the main hand): tint = the colour its shots take,
// lum = lighter (> 0) or darker (< 0), trail / glow = colours, icon = the weapon's own picture flies
// (boomerangs) or thrusts (spears), slash = the colour of a spear's swing.
export const GEAR_SETS = {
  // ---- You (the bow): marks, far shots and the dash
  ranger: { hero: 'rowan', name: 'Ranger set', tier: 'r', color: '#7fd07a', bonus: [
    B('Arrows fly 25% faster and farther'),
    B("Hunter's Mark: a foe your arrow hits is marked for 4 s. Survivalmons deal 20% more damage to marked foes"),
    B('Pack Hunt: when a marked foe falls, survivalmons attack 20% faster for 4 s')],
    pieces: { helmet: 'Ranger Cap', armor: 'Ranger Vest', gloves: 'Archer Gloves', boots: 'Swift Boots', main: 'Hunter Bow', off: 'Hunter Quiver' } },
  gale: { hero: 'rowan', name: 'Gale set', tier: 'r', color: '#8fe0ff', shot: { tint: '#bfe8ff', lum: 0.35, trail: '#d8f2ff' }, bonus: [
    B('Tailwind: your bow shoots 15% faster while you are moving'),
    B("Gust: your dash blows foes away and hits them with your bow's damage. The dash recharges 25% faster"),
    B('Slipstream: for 2 s after a dash, your arrows fly through every foe in their way')],
    pieces: { helmet: 'Gale Cap', armor: 'Gale Tunic', gloves: 'Gale Bracers', boots: 'Gale Boots', main: 'Gale Recurve', off: 'Gale Quiver' } },
  prospector: { hero: 'rowan', name: 'Prospector set', tier: 'r', color: '#d8a868', shot: { tint: '#9aa4b0', lum: -0.1 }, bonus: [
    B('Pay Dirt: foes your bow defeats sometimes drop wood, stone or clay'),
    B('Blasting Bolt: every 6th shot explodes where it lands, for 120% damage to everything close by'),
    B('Motherlode: blasts are 50% bigger, and foes they defeat drop materials 4 times as often')],
    pieces: { helmet: 'Lantern Helmet', armor: 'Prospector Apron', gloves: 'Digger Gloves', boots: 'Miner Boots', main: 'Prospector Crossbow', off: 'Bolt Case' } },
  hawkeye: { hero: 'rowan', name: 'Hawkeye set', tier: 'e', color: '#ffd84a', shot: { tint: '#ffcf4a', lum: 0.15, trail: '#ffe07a' }, bonus: [
    B('+8% crit chance for your bow', { hero: { crit: 0.08 } }),
    B('Far Sight: arrows hit harder the farther away the foe is, up to 40% more'),
    B('Weak Spot: a critical hit from your bow exposes the foe for 4 s. Survivalmons get +40% crit chance against it')],
    pieces: { helmet: 'Hawkeye Hood', armor: 'Hawkeye Vest', gloves: 'Talon Gauntlets', boots: 'Talon Boots', main: 'Hawkeye Longbow', off: 'Hawkeye Quiver' } },
  nightstalker: { hero: 'rowan', name: 'Nightstalker set', tier: 'e', color: '#b070ff', shot: { tint: '#7a48c8', lum: -0.35, trail: '#b070ff' }, bonus: [
    B('Ambush: your arrows deal 40% more damage to foes at full health'),
    B('Night Hunter: after sunset you deal 25% more damage and move 10% faster'),
    B('Shadow Step: after a dash, your next shot is a sure critical hit with 50% more damage')],
    pieces: { helmet: 'Nightstalker Hood', armor: 'Nightstalker Armor', gloves: 'Shadow Claws', boots: 'Shadow Boots', main: 'Nightstalker Bow', off: 'Shadow Quiver' } },
  skyfall: { hero: 'rowan', name: 'Skyfall set', tier: 'l', color: '#ffc83c', shot: { tint: '#a8c8ff', lum: 0.3, trail: '#ffe07a', glow: '#ffe9a0' }, bonus: [
    B("Wishing Star: every 10 s a star falls on the strongest foe near you, for 3 times your bow's damage"),
    B('Stars fall every 6 s. Skyfall Shards drop 50% more often', { shards: 0.5 }),
    power('Star Arrow', 'shot', 'a star falls where it first hits')],
    pieces: { helmet: 'Skyfall Crown', armor: 'Skyfall Plate', gloves: 'Skyfall Gauntlets', boots: 'Skyfall Greaves', main: 'Skyfall Greatbow', off: 'Skyfall Quiver' } },
  // ---- Rowan (the boomerang): the catch, the spin and what it brings back
  scout: { hero: 'rowanf', name: 'Scout set', tier: 'r', color: '#e0705a', shot: { icon: true }, bonus: [
    B('Your boomerang flies 20% faster'),
    B('Clean Catch: each boomerang you catch makes your next throw come 10% sooner'),
    B('Signal: each catch also makes survivalmons attack 15% faster for 3 s')],
    pieces: { helmet: 'Scout Headband', armor: 'Scout Vest', gloves: 'Scout Gloves', boots: 'Scout Boots', main: 'Scout Boomerang', off: 'Catcher Bracer' } },
  whirlwind: { hero: 'rowanf', name: 'Whirlwind set', tier: 'r', color: '#6fd8d0', shot: { icon: true, trail: '#c8f4f0' }, bonus: [
    B('Your boomerang is 25% bigger'),
    B('Spin Up: every foe a throw hits makes that throw hit 5% harder, up to 50% more'),
    B('Eye of the Storm: while a boomerang is in the air, you take 20% less damage and move 10% faster')],
    pieces: { helmet: 'Whirlwind Bandana', armor: 'Whirlwind Tunic', gloves: 'Whirlwind Wraps', boots: 'Whirlwind Boots', main: 'Whirlwind Tri-rang', off: 'Wind Bracer' } },
  treasure: { hero: 'rowanf', name: 'Treasure Hunter set', tier: 'r', color: '#d8a868', shot: { icon: true }, bonus: [
    B('Fetch: your boomerang picks up everything it flies over and brings it to you'),
    B('Chests hold 50% more coins. Monsters pay 15% more coins', { coins: 0.15 }),
    B('Treasure Fever: every chest you open gives you and your survivalmons 5% more damage until the run ends (up to 40%)')],
    pieces: { helmet: 'Explorer Hat', armor: 'Explorer Jacket', gloves: 'Explorer Gloves', boots: 'Explorer Boots', main: 'Compass Boomerang', off: 'Brass Compass' } },
  falcon: { hero: 'rowanf', name: 'Falcon set', tier: 'e', color: '#8fb0e0', shot: { icon: true, trail: '#c8dcff' }, bonus: [
    B('Talon Strike: the first foe each throw hits takes a sure critical hit'),
    B("Keen Wings: your boomerang's critical hits deal 40% more damage"),
    B("Falcon Dive: every 8 s a falcon dives at the strongest foe near you, for 4 times your boomerang's damage, and stuns it for 1 s")],
    pieces: { helmet: 'Falcon Helm', armor: 'Falcon Mantle', gloves: 'Falcon Bracers', boots: 'Falcon Boots', main: 'Falcon Wing', off: 'Falcon Feather' } },
  sabertooth: { hero: 'rowanf', name: 'Sabertooth set', tier: 'e', color: '#ffa850', shot: { icon: true, trail: '#ffd8a0' }, bonus: [
    B('Fangs: your boomerang makes foes bleed for 3 s, for 15% of the hit each second'),
    B('Blood Scent: survivalmons deal 25% more damage to bleeding foes'),
    B('Frenzy: every bleeding foe that falls makes you throw 5% faster for 5 s (up to 40%)')],
    pieces: { helmet: 'Sabertooth Hood', armor: 'Sabertooth Pelt', gloves: 'Fang Bracers', boots: 'Fur Boots', main: 'Fang Boomerang', off: 'Fang Necklace' } },
  sunwheel: { hero: 'rowanf', name: 'Sunwheel set', tier: 'l', color: '#ffc83c', shot: { icon: true, trail: '#ffd24a', glow: '#ffe07a' }, bonus: [
    B("Sun's Warmth: each boomerang you catch heals you 1 HP and your survivalmons 1% of their HP"),
    B('Solar Flare: every 8th foe your boomerang hits is struck by a flare, for 150% damage to everything around it'),
    power('Sun Throw', 'throw', 'it scorches the ground it flies over')],
    pieces: { helmet: 'Sunwheel Crown', armor: 'Sunwheel Plate', gloves: 'Sunwheel Gauntlets', boots: 'Sunwheel Greaves', main: 'Sunwheel Chakram', off: 'Sun Medallion' } },
  // ---- Bram (the spear): standing firm, the shield and the charge
  farmhand: { hero: 'bram', name: 'Farmhand set', tier: 'r', color: '#c8a46a', shot: { icon: true }, bonus: [
    B('Your spear reaches 15% farther'),
    B('Shepherd: survivalmons close to you take 20% less damage'),
    B('Haymaker: every 4th attack hits 50% harder and stuns foes for 0.8 s')],
    pieces: { helmet: 'Straw Hat', armor: 'Patched Overalls', gloves: 'Work Gloves', boots: 'Muddy Boots', main: 'Pitchfork', off: 'Oak Buckler' } },
  stampede: { hero: 'bram', name: 'Stampede set', tier: 'r', color: '#ff7a5a', shot: { icon: true, slash: '#ff9a7a' }, bonus: [
    B("Horn Rush: your dash rams foes for 150% of your spear's damage and knocks them aside"),
    B('Charge survivalmons deal 25% more damage. Your dash recharges 25% faster', { types: { charge: 0.25 } }),
    B('Stampede: ramming 3 or more foes in one dash makes your whole team attack 25% faster for 4 s')],
    pieces: { helmet: 'Horned Helmet', armor: 'Stampede Vest', gloves: 'Hide Gauntlets', boots: 'Hide Boots', main: 'Stampede Lance', off: 'Horn Buckler' } },
  harvest: { hero: 'bram', name: 'Harvest set', tier: 'r', color: '#ffe07a', shot: { icon: true, slash: '#ffe07a' }, bonus: [
    B('Monsters drop berries 40% more often'),
    B("Reaping Sweep: every 3rd attack also sweeps all around you, for 60% of your spear's damage"),
    B('Bounty: foes the sweep defeats drop 3 times the coins. +30% materials', { mats: 0.3 })],
    pieces: { helmet: 'Harvest Hat', armor: 'Harvest Tunic', gloves: 'Harvest Gloves', boots: 'Harvest Boots', main: 'Harvest Glaive', off: 'Wheat Shield' } },
  bulwark: { hero: 'bram', name: 'Bulwark set', tier: 'e', color: '#9ab8d8', shot: { icon: true, slash: '#b8d0f0' }, bonus: [
    B('Block: every 10 s your shield blocks one hit completely'),
    B("Shield Bash: a blocked hit bashes back. Foes around you take 250% of your spear's damage and are stunned for 1 s"),
    B('Fortress: the block is ready again after 6 s. While it is ready, survivalmons take 20% less damage')],
    pieces: { helmet: 'Bulwark Helm', armor: 'Bulwark Plate', gloves: 'Bulwark Gauntlets', boots: 'Bulwark Greaves', main: 'Bulwark Halberd', off: 'Tower Shield' } },
  warlord: { hero: 'bram', name: 'Warlord set', tier: 'e', color: '#e04848', shot: { icon: true, slash: '#ff6a5a' }, bonus: [
    B('Bloodlust: every foe your spear defeats gives you 3% more damage for 6 s (up to 30%)'),
    B('War Cry: every 20 s you roar, and survivalmons deal 25% more damage for 6 s'),
    B('Execute: your spear deals double damage to foes below 30% health')],
    pieces: { helmet: 'Warlord Helm', armor: 'Warlord Armor', gloves: 'Warlord Gauntlets', boots: 'Warlord Boots', main: 'Warlord Pike', off: 'Spiked Shield' } },
  titan: { hero: 'bram', name: 'Titan set', tier: 'l', color: '#ffc83c', shot: { icon: true, slash: '#ffb040', glow: '#ffc060' }, bonus: [
    B('Colossus: your spear hits 1% harder for every 10 max HP you have above 100 (up to 40%)'),
    B("Titan's Blood: you heal 1 HP every second. Survivalmons take 10% less damage", { hero: { regen: 1 }, team: { def: 0.1 } }),
    power('Titan Strike', 'attack', 'the ground shakes: foes around you are stunned for 1 s')],
    pieces: { helmet: 'Titan Helm', armor: 'Titan Plate', gloves: 'Titan Gauntlets', boots: 'Titan Greaves', main: 'Titan Trident', off: 'Titan Rune Shield' } },
  // ---- Lyra (the wand): spells on top of her sparks
  apprentice: { hero: 'lyra', name: 'Apprentice set', tier: 'r', color: '#b89aff', bonus: [
    B('Your sparks fly 25% faster, and their blast is 15% bigger'),
    B('Spell Tome: every 10th hit of your wand casts a spell on that foe: fire, frost or lightning'),
    B('Quick Study: the tome casts on every 6th hit, and its spells are twice as strong')],
    pieces: { helmet: 'Pointed Hat', armor: 'Star Robe', gloves: 'Silk Gloves', boots: 'Velvet Slippers', main: 'Magic Wand', off: 'Spell Tome' } },
  moon: { hero: 'lyra', name: 'Moonweave set', tier: 'r', color: '#c8d8ff', shot: { tint: '#b8ccff', lum: 0.25, glow: '#c8d8ff' }, bonus: [
    B('Moonlight: after sunset, survivalmons take 15% less damage'),
    B('Moon Sparks: every hit of your wand heals your most hurt survivalmon for 1% of its HP'),
    B('Full Moon: after sunset, your wand hits 25% harder and Moon Sparks heal twice as much')],
    pieces: { helmet: 'Moon Circlet', armor: 'Moonweave Robe', gloves: 'Moonweave Gloves', boots: 'Moon Slippers', main: 'Moon Rod', off: 'Moon Tome' } },
  starlit: { hero: 'lyra', name: 'Starlit set', tier: 'r', color: '#ffb8e0', shot: { tint: '#ff8fc8', lum: 0.15, glow: '#ffc8e8' }, bonus: [
    B('Star Diary: survivalmons gain 20% more EXP', { petXp: 0.2 }),
    B('Wish: every time you level up, 8 sparks fly out at the foes around you'),
    B('Stardust: foes your wand defeats drop 25% more EXP. Skyfall Shards drop 50% more often', { shards: 0.5 })],
    pieces: { helmet: 'Starlit Hat', armor: 'Starlit Dress', gloves: 'Starlit Gloves', boots: 'Starlit Shoes', main: 'Star Wand', off: 'Star Diary' } },
  storm: { hero: 'lyra', name: 'Stormcaller set', tier: 'e', color: '#8fb0ff', shot: { tint: '#5a80e0', lum: -0.05, glow: '#a8c8ff', trail: '#dfe8ff' }, bonus: [
    B('Static: every 8th hit of your wand calls a lightning strike on that foe, for 120% damage'),
    B('Chain survivalmons deal 30% more damage. Your strikes jump on to 2 more foes', { types: { chain: 0.3 } }),
    B('Thunderstorm: every 20 s a storm rages around you for 5 s, striking a foe twice a second')],
    pieces: { helmet: 'Stormcaller Hood', armor: 'Stormcaller Robe', gloves: 'Storm Gloves', boots: 'Storm Boots', main: 'Stormcaller Staff', off: 'Storm Orb' } },
  prism: { hero: 'lyra', name: 'Prism set', tier: 'e', color: '#ff9af0', shot: { rainbow: true, lum: 0.2, glow: '#ffffff' }, bonus: [
    B('Refraction: a hit of your wand has a 20% chance to split off 2 small sparks that seek other foes'),
    B('Area survivalmons deal 30% more damage. Foes hit by a split spark take 15% more damage from everything for 3 s', { types: { area: 0.3 } }),
    B("Rainbow Burst: a foe your wand defeats bursts into light, for 40% of your wand's damage to the foes around it")],
    pieces: { helmet: 'Prism Tiara', armor: 'Prism Robe', gloves: 'Prism Gloves', boots: 'Prism Boots', main: 'Prism Scepter', off: 'Prism Crystal' } },
  aurora: { hero: 'lyra', name: 'Aurora set', tier: 'l', color: '#ffc83c', shot: { tint: '#5af0c0', lum: 0.2, glow: '#8affd8', trail: '#ff9ae0' }, bonus: [
    B("Aurora Veil: every 8 s a curtain of light sweeps out from you. Foes it touches take your wand's damage and are slowed for 2 s"),
    B('The curtain comes every 6 s. Survivalmons it touches heal 6% of their HP and attack 20% faster for 4 s'),
    power('Great Spark', 'spark', 'it bursts into 6 small sparks')],
    pieces: { helmet: 'Aurora Crown', armor: 'Aurora Robe', gloves: 'Aurora Gloves', boots: 'Aurora Slippers', main: 'Aurora Staff', off: 'Aurora Orb' } },
  // ---- Pip (the sling): the team, the wild and a little luck
  tamer: { hero: 'pip', name: 'Tamer set', tier: 'r', color: '#7fd07a', bonus: [
    B('Praise: when your sling defeats a foe, your nearest survivalmon attacks again at once'),
    B('Whistle: every 12 s you whistle, and all your survivalmons attack at once'),
    B('Best Friends: survivalmons deal 6% more damage for each one fighting beside you')],
    pieces: { helmet: 'Feather Cap', armor: 'Tamer Vest', gloves: 'Tamer Gloves', boots: 'Trail Boots', main: 'Pebble Sling', off: 'Pebble Pouch' } },
  nurture: { hero: 'pip', name: 'Nurturer set', tier: 'r', color: '#ffb8d8', shot: { tint: '#ff5a8a', lum: 0.05 }, bonus: [
    B('Every berry you pick up also heals your survivalmons for 2% of their HP'),
    B('Berry Shot: every 6th shot is a berry. When it hits, your most hurt survivalmon heals 8% of its HP'),
    B('Tender Care: a survivalmon that faints gets back up after 10 s with 40% of its HP (once each in a run)')],
    pieces: { helmet: 'Nurturer Cap', armor: 'Nurturer Apron', gloves: 'Nurturer Mittens', boots: 'Nurturer Boots', main: 'Berry Sling', off: 'Berry Basket' } },
  lucky: { hero: 'pip', name: 'Lucky set', tier: 'r', color: '#8fe07a', shot: { tint: '#ffd040', lum: 0.2 }, bonus: [
    B('Lucky Pebble: 1 in 20 hits of your sling knocks 2 coins out of the foe'),
    B('Four-Leaf Clover: hearts, magnets, bombs, evolution stones and chest finds come 50% more often', { hero: { luck: 0.5 } }),
    B('Jackpot: 1 in 30 foes your sling defeats bursts into 10 coins. Skyfall Shards drop 50% more often', { shards: 0.5 })],
    pieces: { helmet: 'Clover Cap', armor: 'Lucky Vest', gloves: 'Lucky Gloves', boots: 'Lucky Boots', main: 'Clover Sling', off: 'Coin Pouch' } },
  wildheart: { hero: 'pip', name: 'Wildheart set', tier: 'e', color: '#a8e070', shot: { tint: '#8a6a3a', lum: -0.05, trail: '#a8e070' }, bonus: [
    B('Wild survivalmons appear 30% more often', { wild: 0.3 }),
    B('Call of the Wild: every wild survivalmon you catch gives your team 8% more damage until the run ends (up to 40%)'),
    B("Brambles: every 6th hit of your sling grows a thorn patch for 4 s. Foes in it are slowed and take 40% of your sling's damage twice a second")],
    pieces: { helmet: 'Antler Hood', armor: 'Wildheart Tunic', gloves: 'Leaf Bracers', boots: 'Bark Boots', main: 'Antler Sling', off: 'Acorn Pouch' } },
  tinkerer: { hero: 'pip', name: 'Tinkerer set', tier: 'e', color: '#e0b060', shot: { tint: '#8aa0c0', lum: 0.2, trail: '#e0e8f0' }, bonus: [
    B('Rapid Loader: every 4th shot fires twice'),
    B("Turret: every 18 s you set down a turret that shoots pebbles for 8 s, with 60% of your sling's damage"),
    B('Overclock: the turret shoots twice as fast, and your sling shoots 20% faster while it stands')],
    pieces: { helmet: 'Tinkerer Goggles', armor: 'Tinkerer Coat', gloves: 'Tinkerer Gloves', boots: 'Tinkerer Boots', main: 'Gear Sling', off: 'Gadget Pouch' } },
  wildking: { hero: 'pip', name: 'Wildking set', tier: 'l', color: '#ffc83c', shot: { tint: '#ffcf40', lum: 0.25, trail: '#8affa0', glow: '#ffe07a' }, bonus: [
    B('Pride: your sling hits 8% harder for each survivalmon fighting beside you'),
    B("King's Call: wild survivalmons appear 25% more often. When an elite or a boss falls, every survivalmon heals 20% of its HP", { wild: 0.25 }),
    power("King's Stone", 'shot', 'when it hits, your survivalmons roar and attack 20% faster for 4 s')],
    pieces: { helmet: 'Wildking Mane', armor: 'Wildking Mantle', gloves: 'Wildking Bracers', boots: 'Wildking Boots', main: 'Wildking Sling', off: "King's Stones" } },
};
// Every set in the order of the icon sheet (assets/sprites/icons/gear.png: a row per set, a column per slot)
export const GEAR_ORDER = Object.keys(GEAR_SETS);
// The 6 sets of each hero: the first is the hero's own set, then by tier.
export const HERO_SETS = {};
for (const [id, S] of Object.entries(GEAR_SETS)) (HERO_SETS[S.hero] ||= []).push(id);
// Older saves: Rowan shared your sets; their pieces became the matching Rowan sets (same bonuses).
export const ROWAN_SETS = { ranger: 'scout', gale: 'whirlwind', prospector: 'treasure', hawkeye: 'falcon' };
export const SET_PIECES = [2, 4, 6]; // pieces worn for a set's bonuses (they add up: 6 pieces give all three)
export const pieceName = (hero, set, slot) => GEAR_SETS[set]?.pieces[slot] || '?';
export const setTier = (set) => TIERS[GEAR_SETS[set]?.tier || 'r'];
// A piece's picture (an icon id: see loadGearIcons in gfx/art.js)
export const gearIcon = (set, slot) => `gear_${set}_${slot}`;

// What a gear piece adds at its level L (0 = just owning it), before its tier's bonus
const pct = (v) => +(v * 100).toFixed(1);
export const SLOT_STAT = {
  helmet: { key: 'maxHp', val: (L) => 15 + 5 * L, fmt: (v) => `+${Math.round(v)} max HP`, round: true },
  armor: { key: 'armor', val: (L) => 1 + 0.25 * L, fmt: (v) => `+${+v.toFixed(2)} armor` },
  gloves: { key: 'haste', val: (L) => 0.06 + 0.01 * L, fmt: (v) => `${pct(v)}% faster weapon` },
  boots: { key: 'speed', val: (L) => 0.05 + 0.005 * L, fmt: (v) => `+${pct(v)}% move speed` },
  main: { key: 'might', val: (L) => 0.1 + 0.02 * L, fmt: (v) => `+${pct(v)}% damage` },
  off: { key: 'crit', val: (L) => 0.03 + 0.005 * L, fmt: (v) => `+${pct(v)}% crit chance` },
};
// Stars, a piece's second way to grow (beside its level): a drop of a piece you already have is a
// blueprint of that very piece. Enough blueprints add a star: need[stars] of them (5 for the first, one
// more for each star after it), up to max stars. Every star makes the piece's own stat `stat` stronger.
export const STARS = { max: 5, need: [5, 6, 7, 8, 9], stat: 0.1 };
export const starNeed = (stars) => (stars < STARS.max ? STARS.need[stars] : null); // blueprints for the next star
// A piece that already has all its stars still drops like any other (drops are fully random): it turns
// into materials then, more of them the higher its tier.
export const SALVAGE = { r: { wood: 3, iron: 2 }, e: { wood: 6, stone: 4, iron: 4 }, l: { wood: 12, stone: 8, iron: 8 } };
// A piece's own stat at level L with its stars: { text, mods }. Epic and Legendary pieces are stronger (TIERS.stat).
export function pieceStat(set, slot, L, stars = 0) {
  const S = SLOT_STAT[slot];
  let v = S.val(L) * setTier(set).stat * (1 + STARS.stat * stars);
  if (S.round) v = Math.round(v);
  return { text: S.fmt(v), mods: { [S.key]: v } };
}

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

// Every piece the hero wears (all 6 slots filled) at least this level
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

// Cost to raise a piece from level L
export function slotCost(L) {
  return { coins: Math.round(30 * Math.pow(1.25, L)), wood: L < 10 ? 2 + L : 0, stone: L >= 5 ? Math.floor(L / 2) : 0, iron: L >= 10 ? Math.floor((L - 5) / 3) : 0 };
}
