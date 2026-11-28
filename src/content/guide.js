// The beginner's guide: Moss (the village's creature fan) explains each thing the first time a new
// player meets it, in a small talk box (systems: Meta.data.guide, ui: guide_ui.js). Every tip shows
// once; the box has Skip and "Turn off tips", and the town menu / pause screen turn the guide back on.
// Saves from before the guide (anyone who has finished a run) start with it off.
//
// A tip is a list of pages; a page is a line, or { t, focus } where focus is a CSS selector to light up
// while that page shows (the box moves to the top when the thing is low on the screen).
// Words in braces change with the controls: {Move}/{move}, {Act}/{act}, {Dash}/{dash}, {bag}; {name}
// is the player's name.

export const GUIDE = { npc: 'moss', name: 'Moss', role: 'Your guide' };

const WORDS = {
  touch: { move: 'drag on the left side of the screen', act: 'tap !', dash: 'tap DASH', bag: 'the bag button under the map' },
  keys: { move: 'use WASD or the arrow keys', act: 'press E', dash: 'press Space', bag: 'B or the bag button under the map' },
};
const cap = (s) => s[0].toUpperCase() + s.slice(1);
export function guideText(s, touch, name) {
  const w = WORDS[touch ? 'touch' : 'keys'];
  return s.replace(/\{(\w+)\}/g, (m, k) => {
    if (k === 'name') return name;
    const v = w[k.toLowerCase()];
    return v ? (k[0] === k[0].toUpperCase() ? cap(v) : v) : m;
  });
}

export const TIPS = {
  // ---------------------------------------------------------------- the wild
  run_start: [
    'Run! Those ink blobs crawled out of the star, and they are after you.',
    '{Move} to run. Your bow fires all by itself, so just keep moving. {Dash} for a quick dodge.',
    { t: 'Follow the road south to Hearthvale: the top of the screen shows how far it still is. Your egg is warm, and it will hatch on the way.', focus: '.hud-strip .timer' },
  ],
  levelup: [
    'Level up! The blue gems are EXP, and a full bar lets you pick one card. Each card shows the stat now and after.',
    'Sometimes one card trains your weapon. At weapon level 3 it says "Evolve the weapon": take it to choose how your weapon changes!',
  ],
  teambar: [
    { t: "Berries! They fill the thin teal line under your EXP bar: that is your team's berry bar.", focus: '.teambar' },
    'When it fills up, your survivalmons get an upgrade card. Every berry also gives each of them EXP. Berries drop from monsters and berry bushes.',
  ],
  evolve: [
    'Your weapon evolves! Pick one of the two. Each choice changes what the next evolve offers.',
    'At weapon level 12 you choose an element: fire, ice, poison, lightning or light. It works on every hit.',
  ],
  house_card: ['A chest in a building! Move speed, pickup range and EXP gain only come from chests like this one.'],
  house: ["A house! {Act} at the door to step inside. The clock stops in there, so take your time."],
  house_in: ['Walk up to shelves, crates and chests and {act} to search them: coins, berries, materials, eggs and more. Leave through the door.'],
  gather: ['Stand still next to trees, rocks and clay to gather wood, stone and clay. Buildings in town are upgraded with them.'],
  egg: ['An egg! It goes to the Hatchery in town. Eggs warm up while you are out in the wild, then hatch when you get home.'],
  wild: [
    'A survivalmon, turned strange by the star! Follow the arrow at the edge of the screen.',
    'Beat it and it is freed: it runs to your Ranch in town. Dark creatures never join, only survivalmons.',
  ],
  caught: [
    'You freed it! It joins your team if there is room, or waits at the Ranch.',
    'See the letters on its card? Every skill has a grade from D up to S. Better grades hit harder.',
  ],
  faint: ['Oh no, it fainted! It sits out the rest of this run. Doc Poppy at the Clinic in town can heal it.'],
  lowhp: ["You're hurt! Your health comes back slowly by itself. Red hearts and berries heal you faster. Keep moving!"],
  boss: [
    { t: 'A boss! Its health is the bar at the top. Keep moving and let your weapon and team wear it down.', focus: '.bossbar' },
    'Beat it for treasure and a skill pick.',
  ],
  skillpick: ['A skill pick! One survivalmon skill goes up a grade for the rest of this run: D, C, B, A, then S.'],
  sunset: ["The sun is setting. The Blight grows stronger in the dark, and night creatures come out. They hate light: stay close to your lantern's glow."],
  swarm: ['A swarm of dark creatures! They come in a pack from one side. Keep moving and let them bunch up.'],
  gear: ['Gear for your hero! Tamsin at the Workshop in town levels it up. Every set has its own effects: wear 2, 4 or 6 pieces of one set to turn them on. Purple light is Epic gear, gold is Legendary.'],
  blueprint: ['A blueprint! A gear piece you already have comes as a blueprint of it. 5 blueprints add a star to that piece, and each star makes it 10% stronger, up to 5 stars. After that it turns into materials. Tamsin keeps count at the Workshop.'],
  stone: ['An evolution stone! Breeds evolve at Lv 30 and Lv 55 with a stone of their type. It waits at your Ranch.'],
  bag: [{ t: 'You have items in your bag! Open it with {bag} and tap one to use it. The run waits while the bag is open.', focus: '.bag-btn' }],
  shard: ["A Skyfall Shard! They're rare. Spend them at Mags' Skyfall counter, or to finish building upgrades right away."],
  end: [
    { t: 'Made it! Everything you picked up comes home with you: coins, Spirit and the materials you gathered.', focus: '.end-coins' },
  ],
  news: [{ t: "The game was updated! Tap What's new to see what changed.", focus: '.t-news' }],
  meter: [{ t: 'Here is what everyone did this run: the damage they dealt, the damage they took and the healing they gave. The bar shows who dealt the most damage.', focus: '.end-team' }],
  monpool: [{ t: 'Every monster your survivalmons defeat earns them EXP. At the end of a run it is shared evenly by the whole team, so a helper grows too.', focus: '.end-pool' }],

  // ---------------------------------------------------------------- town
  town: [
    "Hearthvale is home now, {name}! Here you grow stronger between runs, and I know where everything is.",
    'Walk up to a door and {act} to go in. Every building has a keeper inside. Talk to them and pick their button to use it.',
    { t: 'Up here is what you brought home. Coins pay for almost everything. Spirit pays for the Spirit Shrine. Skyfall Shards are rare treasure.', focus: '.town-hud .town-chip:first-child' },
    "Granny Wren asked to see you. Follow the arrow to her Hatchery, then Ollie at the North Gate will let you out for your first hunt.",
  ],
  bundle: [
    "You made it back, {name}! Here's a starter bundle from me: 500 coins and an egg.",
    { t: 'The coins are up here. Spend them on upgrades to grow stronger.', focus: '.town-hud .town-chip:first-child' },
    "Take the egg to Granny Wren's Hatchery: follow the arrow. It warms up while you're out in the wild and hatches when you come home.",
  ],
  intro_training: ["Coins piling up? Coach Hale's Training Hall turns them into a stronger hero. Run time is the big one: longer runs bring more coins. Follow the arrow!"],
  intro_ranch: ["Every survivalmon you free waits at Dell's Ranch. Pick your team there, and train the ones you leave home. Follow the arrow!"],
  b_training: [
    "Coach Hale's upgrades make your hero stronger for good. Run time is the big one: longer runs bring more coins.",
    'Bosses come at 2:00, 4:00 and 6:00, and the Night Lord at 7:30. Beat the Night Lord to win a full run!',
  ],
  b_hatchery: [
    'Granny Wren keeps your eggs in these nests. An egg warms up while you are out in the wild and hatches when you come home.',
    'Later you can breed two survivalmons (Lv 3 or higher) into an egg of a new kind. Both parents are used up, so pick well!',
  ],
  b_ranch: [
    "Dell's Ranch keeps every survivalmon you own. Tap one to see its skills, rename it or put it in your team.",
    'Ones you leave home can train at a dummy and gain EXP while you are away. Spare copies can be freed for species coins: they buy stars for a survivalmon of that kind, or species upgrades.',
  ],
  b_clinic: ['Doc Poppy heals survivalmons that got hurt or fainted. Resting through a run heals them slowly for free; healing here is quick.'],
  b_shrine: ["Keeper Sol's Spirit Shrine spends Spirit on upgrades for every survivalmon at once. Research takes time and makes better skill grades more likely."],
  b_hall: [
    "Champion Brann's Hall of Fame ranks everyone who plays: the furthest gate, the best run, the biggest Survidex, Night Lord wins and the strongest survivalmon.",
    "Your game name shows on the board. Tap Hide me if you'd rather stay off it.",
  ],
  b_survidex: [
    "Quill's Survidex fills in as you meet survivalmons and monsters. Beat a monster to learn how to fight it.",
    'Achievements live here too, and they pay Skyfall Shards. Check in now and then!',
  ],
  b_workshop: [
    'Tamsin levels up the gear you find in runs. Tap a slot around your hero to see its pieces. Every set has its own effects: wear 2, 4 or 6 pieces of one set to turn them on, and all 6 to take the set\'s look.',
    'The Tools tab makes you gather more wood, stone, clay and iron in runs.',
  ],
  b_merchant: [
    'Mags sells goods for your bag: tonics, brews, bells and more. Use them in a run with {bag}. A bigger stall sells stronger goods.',
    'The Skyfall counter sells rare eggs for Skyfall Shards, and swaps shards for materials.',
  ],
  b_team: [{ t: 'Pick your hero, then tap survivalmons to put them in your team; tap a slot to take one out. Ready? Hit the button at the bottom right!', focus: '.go-btn' }],
  upgrade: [{ t: 'Every building has levels. Upgrades cost coins plus wood, stone, clay and iron from runs, and take a while to build. Skyfall Shards finish them at once.', focus: '.panel.bld' }],
  hatched: [
    'Your first survivalmon! It fights beside you in runs, and earns EXP for every monster it defeats.',
    'Wild survivalmons will start turning up in runs now too. Catch as many as you can!',
  ],
  gates: ['A new gate is open! Past each new gate the monsters are much tougher, but they pay more. Pick your gate on the team screen.'],
  achv: ['An achievement! They pay Skyfall Shards. See them all in the Survidex.'],
  goals: [{ t: 'A goal is done! Tap Goals up here to claim its reward. Goals pay coins, Spirit and materials, and sometimes something rare, like an evolution stone or an egg.', focus: '.t-goals' }],
  // ---------------------------------------------------------------- Tower Defense (td/td.js)
  td_start: [
    "The star's creatures walk this road toward town, {name}. Don't let 20 of them get through!",
    { t: 'Drag one of your 5 basic mons from the bar onto a green spot to summon it. Every summon costs a few more berries than the last.', focus: '.td-bar' },
    { t: 'Ready? Tap Go to send in the first wave.', focus: '.td-go' },
  ],
  td_merge: ['Drop one tower on another to merge them into their breed, if you have unlocked it in the main game. Two of the same breed merge into its next form!'],
  td_break: ["A short break before the next wave. Tap Go now for 10 bonus berries."],
  td_evolve: ['A level 2 breed! Merge two of the same level 2 breed for its level 3 form, the strongest tower there is.'],
  watchtower: ['The Watchtower is open! You have 5 basic mons now, enough to defend the road. Follow the arrow.'],
  b_watchtower: ['Pick 5 basic mons to bring. They become towers by the road, and every breed you have unlocked here in town can be made by merging them.'],
  stars: ['Stars! Each one gives that survivalmon +10% damage and HP. At 3 stars its attack goes up a grade, and at 5 it shines gold. Stars are paid with the coins of its kind, which you get by freeing survivalmons.'],
};

// town pages that have their own tip
export const PAGE_TIPS = { training: 'b_training', hatchery: 'b_hatchery', ranch: 'b_ranch', clinic: 'b_clinic', shrine: 'b_shrine', survidex: 'b_survidex', workshop: 'b_workshop', merchant: 'b_merchant', team: 'b_team', watchtower: 'b_watchtower' };
