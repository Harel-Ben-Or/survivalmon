# Survivalmon — Game Plan (original build; the town redesign lives in the design doc)

> **Status:** M1 (first playable) is built. Since then: phone support (touch controls, landscape),
> the creature-collector layer (catching, Critter Box, berries, skills, evolution) and PixelLab art for
> everything you see: heroes (with 8-direction walk cycles), critters, monsters, bosses, ground tiles,
> trees, houses, props, house interiors, item icons, pickups and projectiles.
> The code-drawn sprites remain only as a fallback if a PNG is missing, plus particles and effects.

A cozy-looking, top-down pixel-art **survival roguelite**. Pick a hero, get dropped into a
bright farm-village world, and survive **25 minutes** of ever-growing monster waves.
Kill monsters → collect EXP → level up stats. Duck into houses (the clock **stops** inside)
to search for **weapons, spells, artifacts and pet eggs**. Some items form **combos**.
Befriended **pets follow you** in a line, creature-collector style, and fight beside you.

## Pillars
1. **Readable, bright pixel art** — 16 px tiles, chunky outlines, GBA-era palette
   (grass greens, tan dirt paths, thatched roofs, ponds), rendered at ~480×270 and upscaled.
2. **Run tension vs. safe looting** — outside is a timer + swarm; inside houses time freezes.
3. **Build-crafting** — weapons (auto), spells (manual 1/2/3), artifacts (passive), combos.
4. **Companions** — pets hatch from eggs, trail behind you and gain power as you level.

## Tech
- Plain JavaScript ES modules + Canvas 2D, no build step, zero dependencies.
- Art is PixelLab PNGs in `assets/sprites/`, drawn at 2× the logical resolution. The original
  procedural sprites (`src/gfx`) are kept under the same names as a fallback.
- DOM overlay for UI (menus, HUD, cards) in rounded, readable web fonts (Nunito for text, Fredoka for titles).
- WebAudio synthesized SFX + a tiny chiptune loop.
- Run: `npm run dev` → http://localhost:5173

## Controls
| Key | Action |
|---|---|
| WASD / Arrows | Move |
| Space | Dash (i-frames) |
| E | Enter house / search container / exit |
| 1 · 2 · 3 | Cast spell slots |
| Esc / P | Pause + inventory & combo list |
| M | Mute |

## Core loop
1. **Character select** — 4 heroes, each with a starting weapon and stat bias:
   - **Rowan** (Ranger): Hunter Bow, +move speed.
   - **Bram** (Farmhand): Pitchfork, +HP, +armor.
   - **Lyra** (Apprentice): Ember Wand, -cooldowns, +area.
   - **Pip** (Tamer): Pebble Sling + a starter pet, +pet power.
2. **Overworld** (~110×110 tiles): village plaza, farms with crops & fences, ponds,
   groves, winding dirt paths, dense forest border. 12 enterable buildings.
3. **Monsters** spawn off-screen and path around obstacles (flow field).
   Waves scale over time; **bosses** at 5, 10, 15, 20 and 24 minutes. Elites drop chests.
4. **EXP gems → level up →** pick 1 of 3 stat cards (common / rare / epic rolls),
   occasionally a weapon-training card. Reroll costs coins.
5. **Houses** — press E at the door. Interior room with furniture; chests, crates, barrels,
   pots, bookshelves to search. Loot cards let you equip / upgrade / swap / salvage.
6. **Day → sunset → night** lighting over the 25 minutes.
7. Survive to 25:00 (or beat the final boss) → victory screen with stats.

## Loot
- **Weapons (max 4, auto-fire, Lv 1–5):** Hunter Bow, Pitchfork, Ember Wand, Boomerang,
  Spirit Leaves (orbit), Bramble Aura, Storm Rod, Bomb Satchel, Crescent Blade, Pebble Sling.
- **Spells (max 3, keys 1–3, Lv 1–5):** Fireball, Frost Nova, Chain Lightning,
  Healing Bloom, Meteor Shower, Gale Burst, Thorn Field.
- **Artifacts (max 6, passive, Lv 1–3):** Lucky Clover, Swift Feather, Vampire Fang,
  Iron Shell, Magnet Stone, Hourglass, Giant's Ring, Twin Mirror, Oil Flask, Frost Crystal,
  Storm Charm, Golden Collar, Phoenix Feather, Thorn Mail, Scholar's Monocle, Berry Pouch.
- **Pet eggs** — hatch into a random companion (max 3 pets).

## Combos (own both pieces → activates, shown with a banner)
| Combo | Pieces | Effect |
|---|---|---|
| Inferno | Ember Wand + Oil Flask | Ember bolts leave burning ground |
| Shatter | Frost Nova + Chain Lightning | Lightning ×3 damage to frozen foes, +3 chains |
| Wind Archer | Hunter Bow + Swift Feather | Arrows +2 pierce, +50% speed |
| Twin Fang | Boomerang + Twin Mirror | +1 boomerang, +30% damage |
| Bramble Guard | Spirit Leaves + Thorn Mail | +2 leaves, ×2 leaf damage |
| Thunder God | Storm Rod + Storm Charm | Each strike forks to 2 more foes |
| Overgrowth | Healing Bloom + Berry Pouch | Bloom heals +50% and blasts foes |
| Bulwark | Pitchfork + Iron Shell | Thrusts stun and knock back hard |
| Napalm | Bomb Satchel + Oil Flask | Bombs leave fire pools |
| Steam Burst | Fireball + Frost Nova | Fireball ×2 vs chilled/frozen, +50% blast |
| Cataclysm | Meteor Shower + Giant's Ring | +4 meteors, +60% area |
| Ricochet | Pebble Sling + Lucky Clover | +2 bounces, crits always bounce |
| Frostbite | Bramble Aura + Frost Crystal | Aura chills, +50% damage to chilled |
| Best Friends | Golden Collar + any pet | Pets attack 50% faster |
| Kindred Flame | Emberpup + Ember Wand | Emberpup fires 3 embers |
| Storm Wings | Voltowl + Storm Charm | Voltowl zaps chain +4 |

## Pets (original critters)
Emberpup (fire pup, embers) · Leafkit (leaf bunny, heals + razor leaf) ·
Voltowl (storm owl, chain zap) · Puddlit (bubble frog, slowing bubbles) ·
Pebblet (rock buddy, rolls into foes) · Glimmoth (glow moth, damaging dust + magnet).

## Monsters
Slime, Bat, Shroomling, Wisp (flying), Beetle (armored), Dusk Wolf (charger),
Spore Puff (ranged), Imp (ranged), Pebble Golem (tank). Elite variants (gold outline).
Bosses: King Slime (leaps), Elder Treant (root spikes), Stone Colossus (boulders),
Alpha Wolf (dashes + howl), Night Lord (bullet rings + teleport, final).

## Milestones
- **M1 (this build):** everything above in a first playable version.
- **M2:** balance pass, more interiors/props, controller support, meta-progression
  (Critter Journal, unlockable heroes), settings menu.
- **M3:** ~~swap procedural sprites for PixelLab art~~ (done); music variety; more biomes.

## File map
```
index.html, styles.css, server.js
src/main.js                 boot + main loop
src/core/                   game state, input, renderer, audio, utils, spatial hash
src/gfx/                    PixelCanvas + procedural sprites (characters, monsters, world, items)
src/world/                  world generation, ground painter, collision, flow field, interiors
src/entities/               player, enemies, projectiles, pickups, pets, effects
src/content/                data: heroes, weapons, spells, artifacts, combos, pets, enemies, waves, upgrades, loot
src/ui/                     DOM HUD, menus, minimap
```
