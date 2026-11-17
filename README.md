# Survivalmon

A cozy pixel-art survival roguelite with a creature-collector twist. Runs start just **20 seconds**
long: every monster you defeat pays coins, and when the timer runs out you're back in **town**.
Spend the coins in the **Training Hall** (run time, HP, damage, speed…) and head out again for a
longer, stronger run, up to the full **8 minutes**: the Ink King around 2:00, the Blighted Elder around
4:00, Snare Boss Grimjaw around 6:00, and the Night Lord for the last 30 seconds.

**The enemies.** The Blight, living black ink, has crept over the land: Ink Blobs (they split), Inkwings,
Shade Hounds, Ink Spitters, Shard Oozes and Bloaters (they burst). Each zone also has its own monster the
Blight made of the locals: Thornlings in Leafy Meadow, Bog Crabs in the Lakelands, Saw Beetles in the Stony
Quarry, Cinder Imps in the Ember Fields, Snow Golems in the Windy Highlands and Wilted Sprites in the Blossom
Glades. And the **Snare gang** raids now and then: netters whose nets slow you, slingers, Cage Drones that
carry off fainted survivalmons (defeat the drone and your mon gets back up), and a survivalmon they control
with the Blight: defeat it to free it, and it joins you.

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

## Town

- A small village in a forest clearing: the buildings stand close round the square, each on its own
  yard (dirt, gravel or cobbles) with bushes and flowers along its base and trees in the gaps behind it.
  A pond sits in the south and the woods' shade spills into the edges of the town.
- Walk with WASD / arrows or the joystick; stand at a door and press **E** (or tap **!**).
- **People**: every building has a keeper inside its own room (Granny Wren at the Hatchery, Coach Hale,
  Tamsin the blacksmith, Keeper Sol, Doc Poppy, Quill the archivist, Dell the rancher). Walk in, talk to
  them (**E**) and pick their button (Eggs, Train, Gear, Upgrades, Heal, Survidex, Ranch) to use the building,
  or Chat for a line that changes as you get further. Mags serves at the Merchant's stall, Ollie guards the
  gate, and five villagers (Tib, Juniper, Old Fen, Barrow, Moss) wander the town and chat too.
- **Enter the Wild** (the gate): pick your hero and drag survivalmons into your team, then *Let's run to the wild!*
- **Your name**: the first time you reach town, Ollie at the gate asks your name (Rowan unless you type
  another); everyone in town then calls you by it, and it replaces Rowan's name on the hero picker. Change it
  any time from the town menu.
- **Training Hall**: hero upgrades bought with banked coins, including run time (up to 8:00).
- **Ranch** (talk to Dell): every survivalmon as a small tile with its level and a colored tier letter per
  skill (square = its own attack, round = passives); tap one for its sheet: a big picture, HP and EXP, each
  skill explained with what it gives at every tier, and buttons to rename it, put it in the team, train or free it.
  The barn has the fenced pasture right beside it, where every survivalmon you own roams
  (walk in through the barn's door). Train them (they gain EXP while you're away): each training spot
  has a dummy in the pasture, and a survivalmon in training stands by it
  and hits it with its own attack (shots, lightning, lobbed blobs, slams, auras, charges; evolutions use
  their signature move now and then). Free copies for species coins, and spend those on species upgrades.
- **Hatchery**: 3 nests. Eggs hatch after time spent in the wild. Breed two survivalmons (Lv 5+, both are
  used up) into an egg of their breed: same species gives its grown-up form, two species one of 45 mixes.
- **Clinic**: heal survivalmons hurt or fainted in a run (resting a run also heals them).
- **Survidex**: all 175 survivalmons (10 species, 55 breeds, 55 first and 55 final evolutions), and breeding recipes you've found.
- **Spirit Shrine**: upgrades for every survivalmon, and timed research that improves skill tier odds.
- **Workshop**: each hero's 6 gear slots (gear drops in runs) and their levels; set and level bonuses.
- **Merchant**: items for your next run.
- Every building has levels (coins + wood, stone, clay and iron gathered in runs).

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
  grade); the i button opens the full sheet. Breeding first shows a preview: the breed, its own attack's
  tier odds and every skill pair it can inherit, with the chances.
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
    a roller's attack row is its curl-up, ending as the ball it rolls as)
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
- `src/content/skills.js` — skill tiers and passives; `gear.js` — hero boosts, unlocks and gear; `buildings.js` — building levels and Merchant items.
- `src/world/` — map generation, ground painter, house interiors (`interior.js`: the random rooms, the
  basements and the hand-made rooms of the town's buildings), collision, monster pathing.
- `src/content/npcs.js` — the village's people: who keeps which building, their buttons and talk lines.
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
