// What changed in each version, newest first, for the What's new page (town_ui: openNews).
// The game went to 1.0 on 20 Nov 2026 and the list started over then. Every push to GitHub Pages
// raises window.SURVIVALMON_VERSION in index.html one step (1.0, 1.01, 1.02, ... 1.09, 1.10, 1.11) and adds
// an entry here, written for players. A note is either a short line (a small fix or tweak: "Fixed a bug
// when Voltowl attacked") or { h: heading, t: a short paragraph } for a bigger change. A bigger change
// can show art above its text: img (a picture file, assets/news/...) and/or icons (a row of the game's
// own icons, by id).
export const CHANGELOG = [
  // newest first, e.g. { v: '1.02', date: '...', notes: ['Fixed a bug when Voltowl attacked', { h: 'A new thing', t: 'A short paragraph.' }] },
  {
    v: '1.13', date: '24 Nov 2026',
    notes: [
      { h: 'A better start', t: "New players now go out for their first hunt right after meeting Granny Wren. The first run lasts 30 seconds, and a wild survivalmon shows up after just 10 seconds, so everyone frees their first one early. Back home, Moss gives you a starter bundle: 500 coins and an egg. The rest of Hearthvale is shown over your next few runs." },
      { h: 'Your first survivalmon is a celebration', t: "When you free your very first wild survivalmon, it flashes, turns back to its own colours, hops with a heart and runs to your side." },
      'Run time now starts at 30 seconds, and its first levels are a little longer.',
    ],
  },
  {
    v: '1.12', date: '23 Nov 2026',
    notes: [
      { h: 'Survivalmons level up faster', t: "Every berry now also gives EXP to each survivalmon on your team, on top of filling the berry bar. And the harder gates pay much more survivalmon EXP: 1.4 times more for each gate, up to 7 times at the far gates. A new level 1 survivalmon now reaches about level 17 in a full run at the East Gate, where it used to reach level 13." },
      'The gate picker now shows how much survivalmon EXP each gate gives.',
    ],
  },
  {
    v: '1.11', date: '22 Nov 2026',
    notes: [
      { h: 'Attacks of their own', img: 'assets/news/new_attacks.png', t: "The four new families no longer borrow the older survivalmons' attacks. They have 102 new effects: every breed has its own shot, spark, pool or ground ring, and every evolution has its own big move." },
      { h: 'An egg for every new breed', icons: ['egg_light', 'egg_dragon', 'egg_mind', 'egg_cosmic', 'egg_raingleam', 'egg_frostwhelp', 'egg_riddlekit', 'egg_rockit'], t: "Each of the 50 new breeds now hatches from its own egg, and the Light, Dragon, Mind and Cosmic eggs were redrawn." },
      { h: 'Redrawn survivalmons', t: "Darkmatter, Xenowyrm and Cosmodragon were redrawn as proper final forms. Cinderdrake, Blazewyrm, Emberlord and Sproutdrake grew horns, Starbud has a tail that matches its coat, and Planetoid has its two moons." },
      "Clearer attack animations for Starpaw, Sagedrake, Singulynx, Zodiarch, Faedragon and Twilynx. Glorihorn keeps its halo, and Lumolith's beams stay on while it walks.",
    ],
  },
  {
    v: '1.10', date: '22 Nov 2026',
    notes: [
      { h: 'Four new survivalmons, four new types', img: 'assets/news/new_four.png', t: "Meet Lumilamb (Light), Drakling (Dragon), Psylotl (Mind) and Cometail (Cosmic). They live in the wild and hatch from eggs like the other species: Lumilamb in the Leafy Meadow, Drakling in the Ember Fields, Psylotl in the Blossom Glades and Cometail in the Windy Highlands." },
      { h: '154 new survivalmons to find', t: "Each of the four breeds with every other species, and every new breed evolves twice. That is 50 new breeds and 100 new evolutions. The Survidex now holds 329 survivalmons." },
      { h: 'New ways to fight', t: "Lumilamb is the first Support species: every few seconds it heals you and the team, and everyone hits a little harder for a while. Drakling's roar hurts every foe around it and throws them back. Psylotl's thought jumps between foes and dazes them. Cometail drops a star that leaves stardust on the ground, and foes in it are hurt and slowed." },
      { h: 'Four new evolution stones', icons: ['stone_light', 'stone_dragon', 'stone_mind', 'stone_cosmic'], t: "The Sun Stone, Dragon Stone, Dream Stone and Comet Stone evolve the new breeds. They drop the same way as the other stones." },
      'More to earn: the Collector, Every species, Breeder, Evolver and Final forms achievements each have one more tier for the bigger Survidex.',
      { h: 'Animation fixes', t: "Scaldfrog, Zapgill, Lotusage and Blossomwisp no longer walk backwards. 13 survivalmons whose attack or faint was cut off at the edges were redrawn, and Eclipsar's sun ring no longer flickers." },
    ],
  },
  {
    v: '1.09', date: '21 Nov 2026',
    notes: [
      { h: 'Join the Survivalmon community', t: "The game now has a Discord server for updates, your ideas and bug reports. Tap Community on the title screen or in the town menu to join." },
      "Found a bug? The town menu has a Copy bug info button. It copies the game's version and your device, ready to paste into your report. It holds nothing about who you are.",
    ],
  },
  {
    v: '1.08', date: '21 Nov 2026',
    gift: { until: '2026-12-05', coins: 2000, shards: 100, gear: 'e' }, // (the player's choice, Nov 21)
    notes: [
      { h: 'The big gear update', img: 'assets/news/gear_heroes.png', t: "Gear has been rebuilt from the ground up. Every hero now has 6 sets: 3 Regular, 2 Epic and 1 Legendary. That is 30 sets and 180 pieces, and every piece has its own name and its own picture. Every piece you already found is still yours." },
      { h: 'Epic and Legendary gear', icons: ['gear_ranger_main', 'gear_gale_main', 'gear_prospector_main', 'gear_hawkeye_main', 'gear_nightstalker_main', 'gear_skyfall_main'], t: "Epic pieces are stronger than Regular ones. They start dropping past the South Gate, a little more often with every gate. Legendary pieces are the strongest. In runs only a Night Lord leaves one, from the East Gate on, and more often at harder gates. A full Legendary set also charges every 5th attack with 3 times the damage, each in its own way: a falling star, scorched ground, a quake, a burst of sparks or a roar." },
      { h: 'Every set plays its own way', t: "Wear 2, 4 or 6 pieces of a set to turn on its effects, and no two sets do the same thing. A few of them: the Gale set's dash blows foes away, the Sabertooth boomerang makes foes bleed, the Bulwark shield blocks a hit every 10 seconds, the Stormcaller wand calls lightning, and the Tinkerer sets down a turret that shoots for you." },
      { h: 'Set weapons and outfits', t: "Every set has its own weapon. Your six sets hold six kinds of bow, and each one shoots its own kind of arrow. Wear all 6 pieces of one set and your hero changes into that set's outfit, in town and in runs." },
      { h: 'A new Workshop', img: 'assets/news/workshop.jpg', t: "Your hero stands in the middle with the six gear slots around them. Tap a slot to see every piece that exists for it, and tap a piece to wear it or level it up. Under your hero, Active bonuses adds up everything you are wearing, whatever mix of sets it is. A level now belongs to the piece itself: every piece you had keeps the level its slot was at." },
      { h: 'Blueprints and stars', t: "A gear piece you already have can drop again, and it comes as a blueprint of that piece. 5 blueprints give the piece its first star, and each star after that takes one more: 6, 7, 8, then 9. Every star makes the piece's own stat 10% stronger, up to 5 stars. A piece that already has 5 stars turns into materials when it drops again: the higher its tier, the more." },
      { h: 'The Skyfall counter: lower prices, breed eggs and gear', t: "Eggs cost far fewer Skyfall Shards now: a Mystery Egg is 20, an egg of the day's species 40, a Bright Egg 60 and a Star Egg 120. Three breed eggs are new: a random breed for 500, a random breed with a skill of A or better for 800, and the day's breed with every skill at least A for 1,000. The counter also sells gear for the hero you play: a random Regular piece for 40, Epic for 100, Legendary for 400, and the day's Legendary piece for 800." },
      { h: 'Gear drops you can spot', img: 'assets/news/drops.png', t: "Gear on the ground shines with a beam of light: pale blue for Regular, purple for Epic, gold for Legendary." },
      'Rewards grow with every gate: each gate pays 1.6 times the coins, 1.5 times the Spirit and 1.3 times the materials of the gate before it. The flat coin boost from 1.07 is gone, so the North Gate pays what it did before.',
    ],
  },
  {
    v: '1.07', date: '21 Nov 2026',
    notes: [
      { h: 'More gold', t: 'Defeated monsters pay 75% more coins, and Coin gain in the Training Hall now goes up to level 30 (as far as your Training Hall allows).' },
      'Your survivalmons hit 4% harder.',
      'The Hatchery now says what every skill does: on each parent, and in the Combine preview. The i on a parent opens its full page.',
      'Fixed level-up cards covering the scene where you find a friend after beating a Night Lord, which could lock the screen.',
      'Fixed the DASH button in town showing a leftover cooldown from your last run.',
    ],
  },
  {
    v: '1.06', date: '20 Nov 2026',
    notes: [
      { h: 'Hall of Fame', t: "A trophy castle has risen past the Workshop! Inside, among golden statues, Champion Brann ranks everyone who plays: the furthest gate, the best run, the biggest Survidex, Night Lord wins and the strongest survivalmon (tap one to see its stats). The board shows your game name and best results; you can hide yourself there." },
    ],
  },
  {
    v: '1.05', date: '20 Nov 2026',
    notes: [
      'Fixed a bug that could erase your progress if you switched away from the game while it was still loading. Sorry to anyone who lost their save!',
    ],
  },
  {
    v: '1.04', date: '20 Nov 2026',
    notes: [
      'Fixed the screen zooming in on iPhone when you double-tap, pinch or open a dropdown, and getting stuck that way.',
    ],
  },
  {
    v: '1.03', date: '20 Nov 2026',
    notes: [
      "On iPhone, a Full screen button (title screen and town menu) shows how to add the game to your Home Screen, where it plays without Safari's bars.",
    ],
  },
  {
    v: '1.02', date: '20 Nov 2026',
    notes: [
      'Fixed the game getting stuck while loading on iPhones.',
      'The game uses much less memory while it loads.',
    ],
  },
  {
    v: '1.01', date: '20 Nov 2026',
    notes: [
      { h: 'Play stats', t: 'The game now shares anonymous play stats: how far players get and how runs go, with no names and nothing from your saves. They help make Survivalmon better. You can turn them off any time in the town menu (📊 Share play stats).' },
    ],
  },
];

// The version that's running (index.html sets it)
export const gameVersion = () => globalThis.SURVIVALMON_VERSION || CHANGELOG[0]?.v || '1.0';

// '0.9' < '0.72' < '0.100': compared number by number, not as decimals
export function verCmp(a, b) {
  const A = String(a || 0).split('.').map(Number), B = String(b || 0).split('.').map(Number);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const d = (A[i] || 0) - (B[i] || 0);
    if (d) return d;
  }
  return 0;
}

// A gift that comes with an update: an entry's `gift`, which every save can claim once on the What's
// new page (Meta.claimGift): { until: 'YYYY-MM-DD' (the last day to claim it; none: no end), coins,
// shards, spirit, mats: { wood, stone, clay, iron }, gear: 'r' | 'e' | 'l' (one random piece of that
// tier for the hero the player plays) }.
export const giftOpen = (e, now = Date.now()) => !!e?.gift && verCmp(e.v, gameVersion()) <= 0 && (!e.gift.until || now <= Date.parse(`${e.gift.until}T23:59:59`));
const TIER_NAME = { r: 'Regular', e: 'Epic', l: 'Legendary' };
export function giftText(G) {
  const mats = Object.entries(G.mats || {}).map(([k, n]) => `${n} ${k}`);
  return [G.coins && `${G.coins} coins`, G.shards && `${G.shards} Skyfall Shards`, G.spirit && `${G.spirit} Spirit`, ...mats, G.gear && `1 ${TIER_NAME[G.gear]} gear piece for your hero`].filter(Boolean).join(' · ');
}

// The updates this player hasn't read yet (newer than the last version they saw, up to the running one)
export const unseenUpdates = (seen) => (seen ? CHANGELOG.filter((e) => verCmp(e.v, seen) > 0 && verCmp(e.v, gameVersion()) <= 0) : []);
