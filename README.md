# Survivalmon

A cozy pixel-art survival roguelite with a creature-collector twist. Runs start just **20 seconds**
long: every monster you defeat pays coins, and when the timer runs out you're back in **town**.
Spend the coins in the **Training Hall** (run time, HP, damage, speed…) and head out again for a
longer, stronger run, up to the full **8 minutes**: the Ink King around 2:00, the Blighted Elder around
4:00, Snare Boss Grimjaw around 6:00, and the Night Lord at 7:30. A full run is won only by defeating the
Night Lord: if it's still standing at 8:00, the night goes on until it falls (or you do).

**The enemies.** The Blight, living black ink, has crept over the land: Ink Blobs (they split), Inkwings,
Shade Hounds, Ink Spitters, Shard Oozes and Bloaters (they burst). Each zone also has its own monster the
Blight made of the locals: Thornlings in Leafy Meadow, Bog Crabs in the Lakelands, Saw Beetles in the Stony
Quarry, Cinder Imps in the Ember Fields, Snow Golems in the Windy Highlands and Wilted Sprites in the Blossom
Glades. And the **Snare gang** raids now and then: netters whose nets slow you, slingers, Cage Drones that
carry off fainted survivalmons (defeat the drone and your mon gets back up), and a survivalmon they control
with the Blight: defeat it to free it, and it joins you.

**Day and night.** Every run starts in the morning, and the Blight is weak in daylight: monsters hit 20%
softer and appear with 15% less health. At sunset (about 3:30) they start to grow; at nightfall (about 6:35,
"Night has fallen!") they hit 40% harder, appear with 30% more health and move 12% faster. Bosses feel half
of it; wild survivalmons none. The HUD shows the time of day and the Blight's strength.

**Night creatures** only come out after dark: **Moonfang** packs (fast ink wolves that charge) from dusk, and
the **Nightshade Witch** from about 6:00, who floats at a distance and lobs venom where you stand (a red ring
shows where it lands; it leaves a poison pool for 4 seconds). Light hurts them: they take up to double damage
while some daylight is left, +30% and move slower inside your lantern light (close to the hero), and +50% from
lightning and Fairy-type attacks.

**Gates.** Four gates stand in town from the start, each with its guard: Ollie at the North Gate, Tove at the
South Gate, Kestrel at the East Gate and Rook at the West Gate. Each gate has levels 1 to 4, opened in this
order: North Lv 1, South Lv 1, East Lv 1, West Lv 1, then North Lv 2 ... up to the West Gate Lv 4, the last
(16 in all). A guard won't let you through until you've defeated the Night Lord past the gate before it.
Past each gate the Blight is thicker: monsters have (1 + t/2)^3 times the health and (1 + 0.6t)^1.2 times the
damage, where t counts the gates before it (West Lv 1: x16 health, x3.4 damage; West Lv 4: x614, x16), under
a purple haze. Rewards grow gently: coins x(1 + t/2), Spirit x(1 + 0.35t), EXP, stones and materials
x(1 + t/4), wild survivalmons 4 levels higher per gate. Tuned with simulated runs: a ~10-hour team handles
the Lv 1 gates and struggles from East Lv 2; a near-maxed team gets through West Lv 3 only with good dodging,
and West Lv 4 needs more than that (gear and Shrine upgrades). See content/gates.js.

Runs are **mons-first**: your hero fights with their two weapons (main hand and off hand from their
gear), and your **survivalmons** do the rest with their own skills. Level-ups take turns: even
levels (2, 4, 6…) upgrade your **team** (team damage, attack speed, defense, max HP or a full heal) and
odd levels upgrade your **hero** (HP, damage, speed, armor…, or a weapon). Every card shows the stat
now and after you pick it ("Crit chance 9% → 13%", or "Hit 21 → 25" for a skill). The EXP bar's colour
and label show which comes next. Beating a **boss** gives a **skill pick**: one of your survivalmons'
skills goes up a grade (D, C, B, A, S) for the rest of the run, and each skill can go up only once per
run. Houses (the clock stops inside!) and chests give coins, berries, materials, eggs, evolution
stones, gear and **bonus picks** (an extra upgrade for either side; always in gold chests). Every house
is made fresh when you first walk in: its size, where the door is, the floor and walls, sometimes a side
room behind an inner wall, and a theme that decides what's inside (a home, bedroom, library, kitchen or
storeroom; a hayloft, stable or storehouse in barns; an altar hall or crypt in shrines). Rarely (about
1 house in 14) there's a **trapdoor**: it leads down to a dark basement with heaps of gold, about 200–300
coins in all, and a gold chest.

**Armor** takes a share off every hit, with diminishing returns: 10 armor cuts damage by a third, 20
by half. Your armor also shields your survivalmons at half strength. The Training Hall's Damage
upgrade makes your hero hit harder (+5% a level) and your survivalmons too (+3% a level).

The wild is **endless**: it is generated around you as you walk (a new world every run, starting at
the village plaza), in big zones, one per survivalmon type: Leafy Meadow, Lakelands, Stony Quarry,
Ember Fields, Windy Highlands and Blossom Glades. Most wild survivalmons you meet belong to the zone
you're in. Difficulty still rises with time only, not with distance. The minimap is a radar of the
land around you.

**The run screen stays clear.** A thin EXP line and one strip of small text run along the top (level and
items, the clock and the Blight's strength, coins / Spirit / KO). Under it at the right: a small radar
(tap it to enlarge) with the zone you're in written under it; it glows when you cross into a new zone. HP is
under the hero and under each survivalmon. Banners are only for the big moments (a run starting, a boss
arriving or falling, nightfall, the final fight); all other news goes to a short feed at the top-left that
fades, and a repeat counts up (x2). A new catch shows a card with its level and every skill's grade. Arrows
at the screen's edge point to wild survivalmons and bosses out of view. The pause screen shows this run's
coins, Spirit, KO, materials, zone and catches.

**Town pages** share one thin header: ‹ Town at the top-left, the title and a few counts, the page's tools at
the right (Sort and Filter open one drawer of chips), and the main button at the bottom-right. Lists of
survivalmons are a grid of square tiles (picture, level, a grade letter per skill, flags for team, training,
ready to evolve, locked and hurt); tapping one opens its sheet as a side drawer (full screen on small
screens) with ‹ › to step through the list. Sizes switch by screen height (desktop, phone under 480 px,
the small viewer under 300 px).

The full design (buildings, breeding, skill tiers, gear) is in the design doc;
`PLAN.md` covers the original build.

## Play

**https://harel-ben-or.github.io/survivalmon/**

On an Android phone, open it in Chrome and choose **Install app** (or ⋮ → *Add to Home screen*).
It installs like a normal app: its own icon, full screen and landscape, and it updates itself
whenever new code is pushed here. After one full load it also starts with no connection.

Run it locally with `npm run dev` (http://localhost:5173). There's no build step.

![All 42 survivalmons](mockups/snapshots/survivalmons.png)

## The story

A new game opens with the Starfall: a young ranger carrying eggs to the village at night sees a star fall
and come down, wakes in the morning by its smoking crater, picks the one egg to carry, and runs as ink
blobs crawl out of the smoke. That escape is the first run, and it ends at the village gate, where Ollie
asks your name. Watch it again from the town menu (▶ Watch the opening). The rest of the story is
planned in the story doc (chapters at the 2:00, 4:00 and 6:00 bosses and the Night Lord).

## Sound

All music and sound effects were made with PixelLab (2026-11-18) and play through WebAudio (`src/core/audio.js`).
- **Music** (`assets/audio/music/`): five tracks that the game picks as you play (`Game.updateMusic`): **town** (the
  village and the title screen), **day** (a run), **night** (after sunset), **boss** (while a boss is alive) and
  **final** (the Night Lord). Each is an intro that plays once and a part that loops seamlessly (PixelLab's
  make_music_loop gives the loop points; the files are cut just after the loop end, at an MP3 frame, with the
  header patched so the timing stays exact, and the game blends the last 20 ms into the loop start). Tracks
  cross-fade; the day and night music carry on where they were after a boss. Music on/off: the town menu and
  the pause screen.
- **Effects** (`assets/audio/sfx/`): 25 short clips (mono 32 kHz WAV, trimmed and levelled to the same loudness);
  `VOL` in audio.js sets each one's volume, `VARY` a slight random pitch for the frequent ones, `MAX` how many can
  ring at once. Until a clip has loaded, the old synthesized beep plays instead.
- Everything pauses while the app is in the background.

## The beginner's guide

A new player meets **Moss** (the village's creature fan, who ran out to see the star fall), who explains each
thing the first time it comes up: moving and the clock on the first run, level-ups, houses, gathering, eggs,
wild survivalmons and catching, bosses and skill picks, sunset, the Snare gang, fainting, low health, gear,
stones, the bag and Skyfall Shards; in town the village and its currencies, every building's page, building
levels, the first hatch, a new gate and the first achievement. Each tip is a small talk box (one to four short
pages) with Next, Skip and **Turn off tips**; the game waits while it's open. Tips show once each. The town menu
and the pause screen switch them back on (💬 Tips). Saves from before the guide (anyone who had finished a run)
start with it off. The lines are in `src/content/guide.js`, the box in `src/ui/guide_ui.js`.

## Town

- A small village in a forest clearing: the buildings stand close round the square, each on its own
  yard (dirt, gravel or cobbles) with bushes and flowers along its base and trees in the gaps behind it.
  A pond sits in the south and the woods' shade spills into the edges of the town.
- Walk with WASD / arrows or the joystick; stand at a door and press **E** (or tap **!**).
- **People**: every building has a keeper inside its own room (Granny Wren at the Hatchery, Coach Hale,
  Tamsin the blacksmith, Keeper Sol, Doc Poppy, Quill the archivist, Dell the rancher). Walk in, talk to
  them (**E**) and pick their button (Eggs, Train, Gear, Upgrades, Heal, Survidex, Ranch) to use the building,
  or Chat for a line that changes as you get further. Mags serves at the Merchant's stall, Ollie, Tove, Kestrel and Rook
  guard the gates, and five villagers (Tib, Juniper, Old Fen, Barrow, Moss) wander the town and chat too.
- **Enter the Wild** (talk to Ollie at the North Gate): pick your hero and drag survivalmons into your team, then *Let's run to the wild!*
  Every gate's guard stands in the middle of the gate, a step toward town, and every run starts by talking to
  them (Head out). The South Gate is at the bottom of town; the East and West Gates stand side-on, right on the
  town's east and west edges. A guard turns you back until you've earned their gate; once you have, the team
  screen also picks which gate to run through.
- **Players**: several players can share the game, each with their own save; the player list shows each
  one's total time played (counted from this version on), runs, best time, survivalmons and coins.
- **Your name**: the first time you reach town, Ollie at the gate asks your name (Rowan unless you type
  another); everyone in town then calls you by it, and it replaces Rowan's name on the hero picker. Change it
  any time from the town menu.
- **Training Hall**: hero upgrades bought with banked coins, including run time (up to 8:00). Each level costs 1.35x the one before.
- **Spirit**: the Spirit Shrine's own currency, earned by what your survivalmons do: 10 per wild catch and 0.2
  per enemy they defeat (2 per elite, 20 per boss) in a run (banked with the coins), 10 per egg hatched, 25 per
  evolution and 25 per medal. Coins stay the hero's money (Training Hall, buildings, Workshop, Merchant, Clinic).
- **Skyfall Shards** (content/shop.js): the rare currency. Achievements pay them (a save from before shards got
  the shards for the tiers it already had, once), and from the Lv 2 gates on they drop in the wild: every boss
  drops 1 per gate level past 1 (the Night Lord 3), an elite 3% and any other monster 0.08% (both times the
  gate level past 1); gear sets with shard luck raise all of it. They're banked when the run ends. Shards buy
  eggs and materials at the Merchant's Skyfall counter and finish building upgrades and Shrine research at once
  (1 shard per 5 minutes left).
- **Ranch** (talk to Dell): every survivalmon as a small tile with its level and a colored tier letter per
  skill (square = its own attack, round = passives); tap one for its sheet: a big picture, HP and EXP, each
  skill explained with what it gives at every tier, and buttons to rename it, put it in the team, heal it (if
  hurt), train, lock or free it. **Select** chooses several to free or lock at once; a locked survivalmon is
  never freed or used for breeding.
  The barn has the fenced pasture right beside it, where every survivalmon you own roams
  (walk in through the barn's door). Train them (they gain EXP while you're away): each training spot
  has a dummy in the pasture, and a survivalmon in training stands by it
  and hits it with its own attack (shots, lightning, lobbed blobs, slams, auras, charges; evolutions use
  their signature move now and then). Free copies for species coins, and spend those on species upgrades
  (up to Lv 100: +8% damage and HP a level to Lv 20, +3% after) or feed them to a survivalmon of that species
  (a mix: either parent's coins): each coin is 1% of the EXP its level needs, so 100 coins are a level at any level.
  Every 2 hours in a training spot there's a small chance one of its skills that isn't S yet goes up a grade:
  1% for the 10 basic species, 1.3% for breeds and evolutions (Box.settleTrainingSkills; rolled in town, and
  for the time the game was closed).
- **Hatchery**: 3 nests. Eggs hatch after time spent in the wild. Breed two survivalmons (Lv 5+, both are
  used up) into an egg of their breed: same species gives its grown-up form, two species one of 45 mixes.
- **Clinic**: heal survivalmons hurt or fainted in a run (resting a run also heals them).
- **Survidex**: all 175 survivalmons (10 species, 55 breeds, 55 first and 55 final evolutions). Tapping one opens
  its page, which shows only what you've found out yourself: its attack and size range; how many you have and
  have had (caught, hatched, bred, evolved), the smallest and biggest, the highest level and the first date;
  for a species where it lives, where you caught and saw it and which of its breeds you've found; for a breed
  its parents; and the evolution line, with forms you haven't had yet left as ???.
  Its **Monsters** tab lists every monster (the Blight, zone monsters, the Snare gang, night creatures and
  bosses): meet one to see what it does, when and where it comes; defeat one to see its health, damage and
  speed and how to beat it. It keeps how many you've met and defeated, where, and the darkest gate.
- **Sizes**: every survivalmon has its own height and its own build (so weight varies too), rolled when it's
  caught or hatched (a bred one leans toward its parents' height); evolving keeps both. Its sheet shows them
  (Tiny, Small, Average height, Tall, Huge; Featherweight, Light, Average weight, Heavy, Heavyweight); they
  don't change play. The Survidex keeps the tallest, shortest, heaviest and lightest you've had of each.
- **Medals and achievements** (systems/achievements.js): each species has 6 medals, won the first time you have
  one among the tallest, shortest, heaviest or lightest 5% of its kind, with an S-grade attack, or at Lv 70.
  Achievements (Survidex, Achievements tab) are goals in tiers (find, catch, breed, evolve, win medals, raise to
  Lv 70, a perfect all-S survivalmon, open the gates); each tier pays Skyfall Shards (about 3,900 in all).
  Both pop up as you earn them.
- **Spirit Shrine**: upgrades for every survivalmon, and timed research that improves skill tier odds.
- **Workshop** (Tamsin): **Gear**: each hero has 4 sets (their own and 3 more, content/gear.js GEAR_SETS), each
  with a helmet, armor, gloves, boots and two weapons. A slot wears one piece at a time (tap a piece to wear it)
  and keeps its level when you swap. Wearing 2, 4 and 6 pieces of a set gives its bonuses (they add up, and
  sets mix: 4 + 2 or 2 + 2 + 2 all count): team damage, HP,
  speed, defense or crits, the hero's own stats, extra damage for one attack type, coins, materials, EXP, wild
  survivalmons or Skyfall Shard luck. Drops pick any piece you don't have yet. **Tools**: an axe (wood), a
  pickaxe (stone and iron) and a spade (clay), +15% from gathering spots a level, and Quick hands (gathering
  8% faster a level); the Workshop's level caps them (2 a level).
- **Merchant** (Mags): **Goods** for coins (some also materials) go into your **bag**. In a run, open it with B
  or the bag button under the map (the run waits) and tap one to use it: Swift Tonic, Power Brew and Iron
  Tonic (1 minute of attack speed, damage or defense for you and the team; another adds a minute), Lucky Pick
  (more from gathering for a minute), Healing Draught, Revive Feather, Frost Bell (freezes monsters on
  screen), Blast Powder (a share of every monster's health on screen), Lure Horn (calls wild survivalmons) and
  Warm Stone (warms your eggs). The Merchant's level is the grade it sells: each grade costs 2.6x more and
  works better; its running boosts show by the level on the HUD. The **Skyfall** counter sells eggs for
  shards (they change at midnight): a Mystery Egg, two species eggs, a Bright Egg (every skill B or better)
  and one Star Egg a day (one skill is S), and swaps shards for materials.
- Every building has levels (coins + wood, stone, clay and iron gathered in runs). An upgrade takes time to
  build (15 min, 45 min, 2 h, then 4 h); the building works at its old level until it's done, and it finishes
  in town (never mid-run).

## Survivalmons

- You start by choosing 1 of 5 eggs; it hatches after a minute in the wild. After that, a **wild
  survivalmon** turns up now and then: defeat it within 25 s to catch it. Monsters are never caught.
- Each one has its species' unique skill (an attack) and a random passive skill, each with a tier
  (D 65%, C 20%, B 10%, A 4%, S 1%). They fight with their own HP; fainted ones stay home until healed.
- 10 species in 10 types: Emberpup (fire), Leafkit (grass), Puddlit (water), Voltowl (storm), Pebblet (rock),
  Glimmoth (fairy), Duskit (shadow), Snowpip (ice), Venewt (toxic) and Ferrit (metal). The wild has 6 zones,
  each home to one or two of them (they turn up most there).
- Every attack skill has one of 5 **attack types**, shown as a tag with its icon wherever the skill is:
  **Projectile** (shots), **Chain** (lightning that jumps from foe to foe, a bit softer each jump), **Area**
  (slams, auras and lobbed pools that hit everything in a circle), **Charge** (rushes through foes) and
  **Support** (Petalwisp, Mistmoth, Chromoth and their evolutions: every few seconds a blessing heals the
  hero and the team and, for a few seconds, everyone hits harder, attacks faster or takes less damage).
  Upgrades say which type they work on: Team Power, Haste and Focus (and the Shrine's Power branch) work
  on all attacks; the type cards on even levels (Sharp Shots, Chain Surge, Wide Blast, Stampede) add
  damage and a perk for one type (faster shots, +1 jump, bigger areas, more charges), up to 4 each per run.
  They only show up for types your team has, so a team of one type grows stronger with them.
- **Stats**: HP, Attack, Speed and Defense (plus Crit with Sharp Claws), shown in each survivalmon's sheet.
  The attack type sets their shape: Projectile hits hardest, Chain is quick but has the least HP, Charge and
  Area are tough, Support hits softly. Every level adds HP (+12%) and Attack (+8%); passives (Big Heart,
  Swift Strike, Thick Hide) show up in the stats too.
- **Picking**: the team picker and the Hatchery use small tiles (level, attack type, every skill with its
  grade); the i button opens the full sheet.
- **Lists**: every list of survivalmons (Ranch, team picker, Hatchery, Clinic) has a bar to sort it (name A to Z,
  best skills, highest level, newest, oldest, most evolved) and filter it by type, group and attack type; each
  list remembers its choice on the device. In the Ranch, **Free several** lets you tick many (never your team's)
  and free them at once for their species coins (a second tap confirms).
- **Hatchery**: only the 10 species breed (Lv 3+). The first one you tap fills Parent A, the next Parent B;
  between them is what you'll get, with its own attack's chance of B-or-better and A-or-better, before you
  commit. Combine (bottom-right) shows the full preview: tier odds and every skill pair it can inherit. The
  **What can I make?** tab lists every breed you can make now from species you have (??? for ones not found
  yet), and Use pair fills both parents.
- **Evolving**: the 10 species never evolve. Every breed evolves twice, at **Lv 30** and **Lv 55** (the level
  cap is 70), each time with an evolution stone of its type (a mixed breed and its evolutions: either parent's
  type): Cinderhound -> Azureblaze -> Cerberix, Ashbloom -> Infernobloom -> Pyregrove. Each evolution gives 40%
  more HP, more damage, one more shot, jump or size step, a higher skill grade, and the line's big signature move.
- Every species and breed hatches from its own egg, and has walk, attack and faint animations. Rollers
  (Pebblet and its breeds and evolutions) tuck into a ball, roll at their foe turning like a real ball and
  kicking up dust, then unroll.
- Species and breeds fire basic attacks of their own (a projectile, coloured lightning, a lobbed blob that
  leaves a pool, a ground ring). An evolution's own skill is one big animated signature move: a missile that
  bursts, a strike from the sky, an eruption, a ground quake, a burst around it, or a crash after its roll.

## Run it

```bash
npm run dev
```

Then open http://localhost:5173. No install step — it's plain JavaScript with zero dependencies
(Node is only used for the tiny static server in `server.js`).

## Play on your phone

1. Start the server on your PC (`npm run dev`). It prints a line like
   `On your phone (same Wi-Fi): http://10.100.102.42:5173`.
2. Open that address in your phone's browser (phone and PC on the same Wi-Fi).
   The first time, Windows may ask whether Node.js can use the network — allow it on private networks.
3. Hold the phone sideways. Touch controls switch on automatically:
   drag on the left half to move; on the right are **DASH**, the **!** action button
   (enter houses / search); **II** pauses.
4. For a full-screen app icon: Android — the game goes fullscreen when you pick a hero;
   iPhone — Share → **Add to Home Screen**.

The **Controls** button on the title screen switches between Auto / Touch / Keyboard.

## Controls

| Key | Action |
|---|---|
| WASD / Arrows | Move |
| Space | Dash |
| E | Enter a building or house / search / take loot |
| Esc / P | Pause (in a run) or the town menu |
| M | Mute |

See [PLAN.md](PLAN.md) for the full design, content lists and roadmap.

## Where things live

- `src/content/` — all game data: heroes, weapons, survivalmons, skills, gear, buildings, monsters, waves.
  (spells.js and artifacts.js are no longer used in runs.)
  Tweak numbers here to rebalance.
- `assets/sprites/` — all PixelLab art. Replace a file with the same name to change a sprite:
  - `heroes/<id>/<direction>.png` (8 directions), `heroes/<id>/walk.png` (walk cycles, one row per direction)
    and `heroes/<id>/dash.png` (the dash: one row per direction, 8 frames in 96px cells with the 64px
    standing sprite 16px in)
  - `creatures/anim/<id>.png` — survivalmon and monster animation sheets (rows: move, idle, attack, faint;
    a roller's attack row is its curl-up, ending as the ball it rolls as). The Claude link can hold only 511
    files, so for it `tools/pack_anims.py` packs every sheet into a few lossless WebP pages plus `pack.json`
    (not committed); the game uses the pack when it finds one and the single sheets otherwise.
  - `creatures/<id>.png` — critters, monsters, evolved forms, bosses
  - `tiles/` — ground tilesets (grass, dirt, stone, farm, water, dark grass) with `tiles.json`
  - `world/` — trees, houses, barn, shrine, props; `decals/decals.png` — flowers, tufts, crops, lily pads (one sheet)
  - `story/` — the opening: `valley.png` and `crash.png` (256x144 scenes) and `props.png` (64px cells: egg cart, tipped cart, crater, star shard and props for later chapters), drawn by `src/ui/story.js`
  - `npcs.png` — the village's 14 people: 4 rows of 88px cells each (8 turns, then an idle or walk cycles), order in `src/content/npcs.js`
  - `town/` — the town buildings: gate, Training Hall, Clinic, Workshop, Hatchery, Survidex library
  - `interior/` — floors, walls, furniture, chests (`cellar.png` holds the basement props in one sheet: trapdoor,
    ladder, gold piles, candles, pillar, wine rack…; `town_props.png` the furniture of the town's rooms: forge,
    anvil, weapon rack, incubator, nests, medicine shelf, desk…); `icons/` — items, orbs, stones, pickups; `projectiles/`
  - `vfx/vfx_<n>.png` — every attack effect (made with PixelLab's effects tool), packed into atlas pages;
    `src/content/vfx_data.js` says where each frame is. `src/content/attack_fx.js` picks each skill's effects.
- `src/gfx/art.js` — loads that art, draws it at 2× resolution and animates single images in code (hop / walk / fly).
- `src/world/tileground.js` — draws the ground from the tilesets (autotiled terrain edges, cached in chunks).
- `src/gfx/` (other files) — the original code-drawn sprites, used only if a PNG is missing, plus effects.
- `src/content/species.js` — every critter: stats, skills, catch rate, evolution; `src/systems/collection.js` — the saved Ranch (all your survivalmons and the team).
- `src/world/town.js` — the town map (layout, yards, decor), its doors and collision, and the Ranch (roaming and
  training at the dummies); `src/ui/town_ui.js`, `mons_ui.js`, `shop_ui.js` — the town screens.
- `src/systems/meta.js` — coins, materials, Training Hall, building levels, heroes and gear; `src/systems/shrine.js` — the Spirit Shrine.
- `src/content/skills.js` — skill tiers and passives; `gear.js` — hero boosts, unlocks, gear sets and Workshop tools; `buildings.js` — building levels and build times; `shop.js` — Merchant goods, the Skyfall counter and shard drops.
- `src/world/` — map generation, ground painter, house interiors (`interior.js`: the random rooms, the
  basements and the hand-made rooms of the town's buildings), collision, monster pathing.
- `src/content/npcs.js` — the village's people: who keeps which building, their buttons and talk lines.
- `src/content/guide.js` — the beginner's guide: Moss's tips and when each shows; `src/ui/guide_ui.js` — its talk box.
- `src/entities/`, `src/systems/` — player, monsters, pets, combat, loot, spawning.
- `src/ui/` — HUD, menus and all modal screens (DOM overlay).
- `src/systems/loot.js` — level-up cards (which kind each level is, chest bonus picks, boss skill picks) and container loot;
  `src/ui/card_preview.js` — the "now → after" rows on each card;
  `src/systems/armor.js` — how armor cuts damage.
- `assets/sprites/icons/up_*.png`, `team_*.png` and `atk_*.png` — the upgrade icons (hero upgrades, team upgrades) and the attack type icons (Support uses team_heal.png).
- `assets/sprites/town/` — the town buildings (`ranch.png` is the Ranch barn).
- `icons/trio-*.png` — the app icon (Emberpup, Leafkit and Puddlit together; `trio-art.png` is the 128px original, the rest are sizes of it). The file names change with each new icon, so installed apps notice it.
- `index.html` — also holds the loading screen (shown until all the art has loaded; `src/gfx/art.js` counts the images).
- `tools/bot.js` plays whole careers from a fresh save; `tools/sim.js` plays one run with a chosen loadout
  (Training levels, team) and reports survival, damage by hero and by survivalmons, and faints. Use them
  in the dev page console on a throwaway player profile; usage is at the top of each file.
