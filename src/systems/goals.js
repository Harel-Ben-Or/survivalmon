// The goal tracker: one long track of goals, from your first minutes in Hearthvale to the last gate,
// three at a time. When one is done you're told at once (in a run, in the feed), and you claim its
// reward on the Goals page in town: coins, Spirit, materials, and now and then something rarer (an
// evolution stone, an egg, a Merchant item). The next goal on the track then takes its place.
// Separate from the Survidex achievements, which pay Skyfall Shards.
// Saved in Meta.data.goals: { claimed: [ids], told: [ids] }.
import { Box, rollSkills, FOUND_HATCH, STAR_MAX } from './collection.js';
import { Meta } from './meta.js';
import { Shrine } from './shrine.js';
import { SPECIES, STONES, BASE_IDS, DEX_IDS, FINAL_IDS, MIXED_IDS } from '../content/species.js';
import { ITEMS } from '../content/shop.js';
import { runLengthAt, TRAINING } from './meta.js';
import { BUILDINGS } from '../content/buildings.js';
import { FOE_IDS } from '../content/bestiary.js';
import { TIERS } from '../content/skills.js';
import { Profiles } from './profiles.js';
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const how = (k) => Object.values(Box.data.dex || {}).reduce((s, r) => s + (r.how?.[k] || 0), 0);
const known = (ids) => ids.filter((id) => Box.known(id)).length;
const most = (f) => Box.mons.reduce((m, x) => Math.max(m, f(x)), 0);
const count = (f) => Box.mons.filter(f).length;
const topBuilding = () => Math.max(1, ...Object.values(Meta.data.buildings || {}));
const shrineLevels = () => Object.values(Shrine.data?.nodes || {}).reduce((s, l) => s + l, 0);
const stars = (m) => m.stars || 0;
// Run time reaches this many seconds at Training Hall level L (meta.js runLengthAt)
const runtimeFor = (sec) => { let L = 0; while (20 + 10 * L + L * L < sec) L++; return L; };
// monsters defeated in all (the Survidex's Monsters tab keeps every kill), and kinds met
const kills = () => Object.values(Box.data.foes || {}).reduce((s, r) => s + (r.kills || 0), 0);
const foesMet = () => FOE_IDS.filter((id) => (Box.data.foes?.[id]?.seen || 0) + (Box.data.foes?.[id]?.kills || 0) > 0).length;
const trainLv = (id) => () => Meta.level(id);
const trainSum = () => TRAINING.reduce((s, t) => s + Meta.level(t.id), 0);
const TRAIN_MAX = TRAINING.reduce((s, t) => s + t.max, 0);
const bLv = (id) => () => Meta.buildingLevel(id);
const allBuildings = () => Math.min(...Object.keys(BUILDINGS).map((id) => Meta.buildingLevel(id)));
const grade = (m) => Math.max(0, ...m.skills.map((k) => k.t || 0)); // 0 D ... 4 S
const types = () => new Set(Box.mons.flatMap((m) => SPECIES[m.species]?.types || [])).size;
const medals = () => Object.values(Box.data.dex || {}).reduce((s, r) => s + Object.keys(r.medals || {}).length, 0);
const achvTiers = () => Object.values(Box.data.achv || {}).reduce((s, n) => s + (n || 0), 0);
const gearPieces = () => Object.values(Meta.data.gear || {}).reduce((s, slots) => s + Object.values(slots || {}).reduce((a, sl) => a + Object.keys(sl?.own || {}).length, 0), 0);
const toolSum = () => Object.values(Meta.data.tools || {}).reduce((s, n) => s + (n || 0), 0);
const heroes = () => Object.values(Meta.data.heroes || {}).filter(Boolean).length;
const upTop = () => Math.max(0, ...Object.values(Box.data.upgrades || {}));
const totalStars = () => Box.mons.reduce((s, m) => s + stars(m), 0);
const played = () => Math.floor(Meta.data.played || 0);
const best = () => { try { return JSON.parse(localStorage.getItem(Profiles.key('best'))) || {}; } catch { return {}; } };

// rew: coins, spirit, mats { wood, stone, clay, iron }, evo (evolution stones, random kinds),
//      egg (eggs for the Hatchery), item [id, grade] (a Merchant item for the bag)
// unit (how progress reads): 's' run time m:ss, 'rt' Run time levels as m:ss, 'lv' levels, '★' stars,
//      'gate' gates, 'grade' skill grade letters, 'play' hours and minutes; none: plain numbers
// The order is the track: goals come up three at a time, roughly in the order a player gets to them.
export const GOALS = [
  // ---------------------------------------------------------------- your first hour
  { id: 'rt1', text: 'Buy Run time at the Training Hall', need: 1, have: () => Meta.level('runtime'), rew: { coins: 40, spirit: 5 } },
  { id: 'runs3', text: 'Go out on 3 runs', need: 3, have: () => Meta.data.runs || 0, rew: { coins: 50, mats: { wood: 5 } } },
  { id: 'kills50', text: 'Defeat 50 monsters', need: 50, have: kills, rew: { coins: 40, spirit: 5 } },
  { id: 'catch1', text: 'Catch a wild survivalmon', need: 1, have: () => how('wild'), rew: { coins: 60, item: ['heal', 1] } },
  { id: 'surv60', text: 'Last a whole minute in a run', need: 60, have: () => Math.floor(Meta.data.bestTime || 0), unit: 's', rew: { coins: 60, spirit: 5 } },
  { id: 'hp1', text: 'Buy Max HP at the Training Hall', need: 1, have: trainLv('maxHp'), rew: { coins: 40, mats: { stone: 5 } } },
  { id: 'mons3', text: 'Have 3 survivalmons', need: 3, have: () => Box.mons.length, rew: { coins: 80, mats: { stone: 5 } } },
  { id: 'dmg1', text: 'Buy Damage at the Training Hall', need: 1, have: trainLv('might'), rew: { coins: 50, spirit: 5 } },
  { id: 'hatch1', text: 'Hatch an egg in the Hatchery', need: 1, have: () => Math.max(0, how('egg') - 1), rew: { coins: 80, mats: { clay: 5 } } },
  { id: 'free1', text: 'Free a survivalmon (it pays coins of its kind)', need: 1, have: () => Box.data.freed || 0, rew: { coins: 50, spirit: 5 } },
  { id: 'surv90', text: 'Last 1:30 in a run', need: 90, have: () => Math.floor(Meta.data.bestTime || 0), unit: 's', rew: { coins: 70, mats: { wood: 5 } } },
  { id: 'kills200', text: 'Defeat 200 monsters', need: 200, have: kills, rew: { coins: 80, mats: { wood: 5, stone: 5 } } },
  { id: 'star1', text: 'Give a survivalmon its first star', need: 1, have: () => most(stars), rew: { coins: 100, spirit: 10 } },
  { id: 'catch5', text: 'Catch 5 wild survivalmons', need: 5, have: () => how('wild'), rew: { coins: 100, item: ['horn', 1] } },
  { id: 'rt2', text: 'Train Run time up to 2:00', need: runtimeFor(120), have: () => Meta.level('runtime'), unit: 'rt', rew: { coins: 150, mats: { wood: 10, stone: 10 } } },
  { id: 'lv10', text: 'Raise a survivalmon to Lv 10', need: 10, have: () => most((m) => m.level), unit: 'lv', rew: { coins: 120, item: ['swift', 1] } },
  { id: 'boss1', text: 'Defeat a boss in a run', need: 1, have: () => Meta.data.bossKills || 0, rew: { coins: 150, spirit: 10 } },
  { id: 'train10', text: 'Buy 10 Training Hall levels in all', need: 10, have: trainSum, rew: { coins: 120, spirit: 10 } },
  { id: 'bred1', text: 'Breed two survivalmons at the Hatchery', need: 1, have: () => how('bred'), rew: { coins: 150, spirit: 15, mats: { clay: 10 } } },
  { id: 'eggs3', text: 'Have an egg in all 3 nests at once', need: 3, have: () => Box.eggs.length, rew: { coins: 120, item: ['warm', 1] } },
  { id: 'surv120', text: 'Last 2 minutes in a run', need: 120, have: () => Math.floor(Meta.data.bestTime || 0), unit: 's', rew: { coins: 150, spirit: 10 } },
  { id: 'types3', text: 'Have survivalmons of 3 different types', need: 3, have: types, rew: { coins: 150, spirit: 10 } },
  { id: 'runs10', text: 'Go out on 10 runs', need: 10, have: () => Meta.data.runs || 0, rew: { coins: 150, mats: { wood: 10, clay: 10 } } },
  { id: 'gradeB', text: 'Have a survivalmon with a B-grade skill', need: 2, have: () => most(grade), unit: 'grade', rew: { coins: 150, spirit: 10 } },
  { id: 'surv180', text: 'Last 3 minutes in a run', need: 180, have: () => Math.floor(Meta.data.bestTime || 0), unit: 's', rew: { coins: 200, spirit: 10 } },
  { id: 'mons8', text: 'Have 8 survivalmons', need: 8, have: () => Box.mons.length, rew: { coins: 200, mats: { iron: 5 } } },
  { id: 'build2', text: 'Build up any building to Lv 2', need: 2, have: topBuilding, unit: 'lv', rew: { coins: 200, mats: { wood: 10, stone: 10 } } },
  { id: 'kills500', text: 'Defeat 500 monsters', need: 500, have: kills, rew: { coins: 200, mats: { stone: 10 } } },
  { id: 'lv20', text: 'Raise a survivalmon to Lv 20', need: 20, have: () => most((m) => m.level), unit: 'lv', rew: { coins: 200, item: ['power', 1] } },
  { id: 'speed3', text: 'Train Move speed to level 3', need: 3, have: trainLv('speed'), unit: 'lv', rew: { coins: 150, spirit: 10 } },
  { id: 'magnet3', text: 'Train Pickup range to level 3', need: 3, have: trainLv('magnet'), unit: 'lv', rew: { coins: 150, mats: { clay: 10 } } },
  { id: 'hatchery2', text: 'Build the Hatchery up to Lv 2', need: 2, have: bLv('hatchery'), unit: 'lv', rew: { coins: 250, mats: { clay: 15 } } },
  { id: 'ranch2', text: 'Build the Ranch up to Lv 2', need: 2, have: bLv('ranch'), unit: 'lv', rew: { coins: 250, mats: { wood: 15 } } },
  { id: 'foes10', text: 'Meet 10 kinds of monsters', need: 10, have: foesMet, rew: { coins: 200, spirit: 10 } },
  // ---------------------------------------------------------------- the first gate
  { id: 'gateN', text: "Defeat the North Gate's Night Lord", need: 1, have: () => Meta.gates, rew: { coins: 400, spirit: 25, evo: 1 } },
  { id: 'star3', text: 'Give a survivalmon 3 stars', need: 3, have: () => most(stars), unit: '★', rew: { coins: 300, spirit: 20 } },
  { id: 'dex10', text: 'Find 10 different survivalmons', need: 10, have: () => known(DEX_IDS), rew: { coins: 300, evo: 1 } },
  { id: 'shrine1', text: 'Learn something at the Spirit Shrine', need: 1, have: shrineLevels, rew: { coins: 300, spirit: 10 } },
  { id: 'catch10', text: 'Catch 10 wild survivalmons', need: 10, have: () => how('wild'), rew: { coins: 300, spirit: 15 } },
  { id: 'boss5', text: 'Defeat 5 bosses', need: 5, have: () => Meta.data.bossKills || 0, rew: { coins: 300, spirit: 15 } },
  { id: 'rt3', text: 'Train Run time up to 3:00', need: runtimeFor(180), have: () => Meta.level('runtime'), unit: 'rt', rew: { coins: 300, mats: { wood: 15, stone: 15 } } },
  { id: 'coins1k', text: 'Have 1,000 coins in the bank at once', need: 1000, have: () => Math.floor(Meta.data.coins || 0), rew: { coins: 200, spirit: 20 } },
  { id: 'hatch5', text: 'Hatch 5 eggs', need: 5, have: () => Math.max(0, how('egg') - 1), rew: { coins: 300, mats: { clay: 15 } } },
  { id: 'bred3', text: 'Breed 3 times', need: 3, have: () => how('bred'), rew: { coins: 300, spirit: 20 } },
  { id: 'armor3', text: 'Train Armor to level 3', need: 3, have: trainLv('armor'), unit: 'lv', rew: { coins: 300, mats: { iron: 5 } } },
  { id: 'gear3', text: 'Find 3 pieces of gear', need: 3, have: gearPieces, rew: { coins: 300, mats: { iron: 5 } } },
  { id: 'dex25', text: 'Find 25 different survivalmons', need: 25, have: () => known(DEX_IDS), rew: { coins: 400, evo: 1 } },
  { id: 'play1h', text: 'Play for an hour in all', need: 3600, have: played, unit: 'play', rew: { coins: 300, spirit: 20 } },
  { id: 'surv240', text: 'Last 4 minutes in a run', need: 240, have: () => Math.floor(Meta.data.bestTime || 0), unit: 's', rew: { coins: 400, spirit: 20 } },
  { id: 'mons15', text: 'Have 15 survivalmons', need: 15, have: () => Box.mons.length, rew: { coins: 400, mats: { iron: 10 } } },
  { id: 'hp10', text: 'Train Max HP to level 10', need: 10, have: trainLv('maxHp'), unit: 'lv', rew: { coins: 400, spirit: 20 } },
  { id: 'dmg10', text: 'Train Damage to level 10', need: 10, have: trainLv('might'), unit: 'lv', rew: { coins: 500, spirit: 20 } },
  { id: 'kills1k', text: 'Defeat 1,000 monsters', need: 1000, have: kills, rew: { coins: 500, item: ['blast', 1] } },
  { id: 'types5', text: 'Have survivalmons of 5 different types', need: 5, have: types, rew: { coins: 400, spirit: 25 } },
  { id: 'stars10', text: 'Earn 10 stars across your survivalmons', need: 10, have: totalStars, rew: { coins: 500, spirit: 25 } },
  { id: 'best10', text: 'Reach hero Lv 10 in a run', need: 10, have: () => best().level || 0, unit: 'lv', rew: { coins: 300, spirit: 15 } },
  // ---------------------------------------------------------------- the middle of the game
  { id: 'lv30', text: 'Raise a survivalmon to Lv 30', need: 30, have: () => most((m) => m.level), unit: 'lv', rew: { coins: 400, evo: 1 } },
  { id: 'evo1', text: 'Evolve a survivalmon', need: 1, have: () => how('evolved'), rew: { coins: 500, spirit: 30 } },
  { id: 'gateS', text: "Defeat the South Gate's Night Lord", need: 2, have: () => Meta.gates, unit: 'gate', rew: { coins: 800, spirit: 40, egg: 1 } },
  { id: 'training2', text: 'Build the Training Hall up to Lv 2', need: 2, have: bLv('training'), unit: 'lv', rew: { coins: 500, mats: { wood: 20, stone: 20 } } },
  { id: 'workshop2', text: 'Build the Workshop up to Lv 2', need: 2, have: bLv('workshop'), unit: 'lv', rew: { coins: 500, mats: { iron: 10 } } },
  { id: 'runs25', text: 'Go out on 25 runs', need: 25, have: () => Meta.data.runs || 0, rew: { coins: 500, spirit: 25 } },
  { id: 'rt5', text: 'Train Run time up to 5:00', need: runtimeFor(300), have: () => Meta.level('runtime'), unit: 'rt', rew: { coins: 800, mats: { iron: 15 } } },
  { id: 'catch25', text: 'Catch 25 wild survivalmons', need: 25, have: () => how('wild'), rew: { coins: 600, item: ['power', 2] } },
  { id: 'gradeA', text: 'Have a survivalmon with an A-grade skill', need: 3, have: () => most(grade), unit: 'grade', rew: { coins: 600, spirit: 30 } },
  { id: 'haste5', text: 'Train Attack speed to level 5', need: 5, have: trainLv('haste'), unit: 'lv', rew: { coins: 600, spirit: 20 } },
  { id: 'coins5', text: 'Train Coin gain to level 5', need: 5, have: trainLv('coins'), unit: 'lv', rew: { coins: 500, spirit: 20 } },
  { id: 'wild3', text: 'Train Wild survivalmons to level 3', need: 3, have: trainLv('wild'), unit: 'lv', rew: { coins: 500, item: ['horn', 2] } },
  { id: 'boss10', text: 'Defeat 10 bosses', need: 10, have: () => Meta.data.bossKills || 0, rew: { coins: 700, spirit: 30 } },
  { id: 'star5', text: 'Give a survivalmon all five stars', need: STAR_MAX, have: () => most(stars), unit: '★', rew: { coins: 1000, spirit: 50, evo: 1 } },
  { id: 'tools5', text: 'Upgrade your tools 5 times in all', need: 5, have: toolSum, rew: { coins: 600, mats: { wood: 20, stone: 20, clay: 20 } } },
  { id: 'shrine10', text: 'Learn 10 levels at the Spirit Shrine', need: 10, have: shrineLevels, rew: { coins: 700, spirit: 30 } },
  { id: 'surv300', text: 'Last 5 minutes in a run', need: 300, have: () => Math.floor(Meta.data.bestTime || 0), unit: 's', rew: { coins: 800, spirit: 30 } },
  { id: 'hatch10', text: 'Hatch 10 eggs', need: 10, have: () => Math.max(0, how('egg') - 1), rew: { coins: 700, egg: 1 } },
  { id: 'evo3', text: 'Evolve 3 survivalmons', need: 3, have: () => how('evolved'), rew: { coins: 800, spirit: 40 } },
  { id: 'gateE', text: "Defeat the East Gate's Night Lord", need: 3, have: () => Meta.gates, unit: 'gate', rew: { coins: 1500, spirit: 60, egg: 1, evo: 1 } },
  { id: 'team4', text: 'Take 4 survivalmons on a run (build up the gate)', need: 4, have: () => Box.teamSize(), rew: { coins: 800, spirit: 30 } },
  { id: 'lv40', text: 'Raise a survivalmon to Lv 40', need: 40, have: () => most((m) => m.level), unit: 'lv', rew: { coins: 1000, evo: 1 } },
  { id: 'medal1', text: 'Win a medal (see the Survidex)', need: 1, have: medals, rew: { coins: 800, spirit: 30 } },
  { id: 'heroes2', text: 'Find a friend to fight beside you', need: 2, have: heroes, rew: { coins: 1000, spirit: 40 } },
  { id: 'build4', text: 'Build up any building to Lv 4', need: 4, have: topBuilding, unit: 'lv', rew: { coins: 1200, mats: { wood: 25, stone: 25, iron: 10 } } },
  { id: 'kills2500', text: 'Defeat 2,500 monsters', need: 2500, have: kills, rew: { coins: 1000, spirit: 40 } },
  { id: 'mons25', text: 'Have 25 survivalmons', need: 25, have: () => Box.mons.length, rew: { coins: 1000, mats: { iron: 15 } } },
  { id: 'bred10', text: 'Breed 10 times', need: 10, have: () => how('bred'), rew: { coins: 1000, egg: 1 } },
  { id: 'mixes10', text: 'Find 10 mixed breeds', need: 10, have: () => known(MIXED_IDS), rew: { coins: 1000, spirit: 40 } },
  { id: 'best20', text: 'Reach hero Lv 20 in a run', need: 20, have: () => best().level || 0, unit: 'lv', rew: { coins: 1000, spirit: 40 } },
  { id: 'lv55', text: 'Raise a survivalmon to Lv 55', need: 55, have: () => most((m) => m.level), unit: 'lv', rew: { coins: 1500, evo: 2 } },
  { id: 'final1', text: 'Find a final evolution', need: 1, have: () => known(FINAL_IDS), rew: { coins: 1500, spirit: 60 } },
  { id: 'surv360', text: 'Last 6 minutes in a run', need: 360, have: () => Math.floor(Meta.data.bestTime || 0), unit: 's', rew: { coins: 1200, spirit: 50 } },
  { id: 'allB2', text: 'Build every building up to Lv 2', need: 2, have: allBuildings, unit: 'lv', rew: { coins: 1500, mats: { wood: 30, stone: 30, clay: 30, iron: 15 } } },
  { id: 'gear10', text: 'Find 10 pieces of gear', need: 10, have: gearPieces, rew: { coins: 1200, mats: { iron: 20 } } },
  { id: 'types8', text: 'Have survivalmons of 8 different types', need: 8, have: types, rew: { coins: 1200, spirit: 50 } },
  { id: 'stars25', text: 'Earn 25 stars across your survivalmons', need: 25, have: totalStars, rew: { coins: 1500, spirit: 60 } },
  { id: 'gateW', text: "Defeat the West Gate's Night Lord", need: 4, have: () => Meta.gates, unit: 'gate', rew: { coins: 2500, spirit: 80, egg: 1, evo: 1 } },
  { id: 'rt8', text: 'Train Run time all the way up to 8:00', need: runtimeFor(480), have: () => Meta.level('runtime'), unit: 'rt', rew: { coins: 2000, mats: { iron: 30 } } },
  { id: 'free50', text: 'Free 50 survivalmons', need: 50, have: () => Box.data.freed || 0, rew: { coins: 1500, spirit: 40 } },
  { id: 'star3x5', text: 'Have 5 survivalmons with 3 stars or more', need: 5, have: () => count((m) => stars(m) >= 3), rew: { coins: 2000, spirit: 80 } },
  { id: 'play5h', text: 'Play for 5 hours in all', need: 5 * 3600, have: played, unit: 'play', rew: { coins: 1500, spirit: 60 } },
  { id: 'coins10k', text: 'Have 10,000 coins in the bank at once', need: 10000, have: () => Math.floor(Meta.data.coins || 0), rew: { coins: 1000, spirit: 60 } },
  { id: 'runs50', text: 'Go out on 50 runs', need: 50, have: () => Meta.data.runs || 0, rew: { coins: 1500, spirit: 60 } },
  { id: 'evo10', text: 'Evolve 10 survivalmons', need: 10, have: () => how('evolved'), rew: { coins: 2000, evo: 2 } },
  { id: 'hp20', text: 'Train Max HP to level 20', need: 20, have: trainLv('maxHp'), unit: 'lv', rew: { coins: 2000, spirit: 60 } },
  { id: 'dmg20', text: 'Train Damage to level 20', need: 20, have: trainLv('might'), unit: 'lv', rew: { coins: 2500, spirit: 60 } },
  { id: 'armor10', text: 'Train Armor all the way (level 10)', need: 10, have: trainLv('armor'), unit: 'lv', rew: { coins: 2000, mats: { iron: 25 } } },
  { id: 'shrine25', text: 'Learn 25 levels at the Spirit Shrine', need: 25, have: shrineLevels, rew: { coins: 2000, spirit: 80 } },
  { id: 'kills5k', text: 'Defeat 5,000 monsters', need: 5000, have: kills, rew: { coins: 2000, item: ['feather', 2] } },
  { id: 'boss25', text: 'Defeat 25 bosses', need: 25, have: () => Meta.data.bossKills || 0, rew: { coins: 2500, spirit: 80 } },
  { id: 'catch50', text: 'Catch 50 wild survivalmons', need: 50, have: () => how('wild'), rew: { coins: 2000, egg: 1 } },
  { id: 'gradeS', text: 'Have a survivalmon with an S-grade skill', need: 4, have: () => most(grade), unit: 'grade', rew: { coins: 3000, spirit: 100 } },
  { id: 'lv60', text: 'Raise a survivalmon to Lv 60', need: 60, have: () => most((m) => m.level), unit: 'lv', rew: { coins: 2500, evo: 1 } },
  { id: 'heroes3', text: 'Have 3 heroes to choose from', need: 3, have: heroes, rew: { coins: 2500, spirit: 80 } },
  { id: 'medals10', text: 'Win 10 medals', need: 10, have: medals, rew: { coins: 2500, spirit: 80 } },
  // ---------------------------------------------------------------- the later gates
  { id: 'gate2', text: 'Win through a Lv 2 gate', need: 5, have: () => Meta.gates, unit: 'gate', rew: { coins: 3000, spirit: 100, evo: 2 } },
  { id: 'dex50', text: 'Find 50 different survivalmons', need: 50, have: () => known(DEX_IDS), rew: { coins: 3000, egg: 1, evo: 1 } },
  { id: 'types10', text: 'Have a survivalmon of every type', need: 10, have: types, rew: { coins: 3000, spirit: 100, egg: 1 } },
  { id: 'finals5', text: 'Find 5 final evolutions', need: 5, have: () => known(FINAL_IDS), rew: { coins: 3000, evo: 2 } },
  { id: 'best30', text: 'Reach hero Lv 30 in a run', need: 30, have: () => best().level || 0, unit: 'lv', rew: { coins: 3000, spirit: 100 } },
  { id: 'lv70', text: 'Raise a survivalmon to Lv 70', need: 70, have: () => most((m) => m.level), unit: 'lv', rew: { coins: 4000, evo: 3 } },
  { id: 'allB3', text: 'Build every building up to Lv 3', need: 3, have: allBuildings, unit: 'lv', rew: { coins: 4000, mats: { wood: 50, stone: 50, clay: 50, iron: 30 } } },
  { id: 'up20', text: 'Upgrade one species line to Lv 20', need: 20, have: upTop, unit: 'lv', rew: { coins: 3000, spirit: 100 } },
  { id: 'train100', text: 'Buy 100 Training Hall levels in all', need: 100, have: trainSum, rew: { coins: 4000, spirit: 100 } },
  { id: 'kills10k', text: 'Defeat 10,000 monsters', need: 10000, have: kills, rew: { coins: 4000, spirit: 120 } },
  { id: 'gate3', text: 'Win through a Lv 3 gate', need: 9, have: () => Meta.gates, unit: 'gate', rew: { coins: 5000, spirit: 150, item: ['feather', 3] } },
  { id: 'star5x3', text: 'Have 3 survivalmons with all five stars', need: 3, have: () => count((m) => stars(m) >= STAR_MAX), rew: { coins: 5000, spirit: 150, egg: 1 } },
  { id: 'lv70x3', text: 'Have 3 survivalmons at Lv 70', need: 3, have: () => count((m) => m.level >= 70), rew: { coins: 5000, evo: 2 } },
  { id: 'dex75', text: 'Find 75 different survivalmons', need: 75, have: () => known(DEX_IDS), rew: { coins: 5000, egg: 1, evo: 1 } },
  { id: 'bred25', text: 'Breed 25 times', need: 25, have: () => how('bred'), rew: { coins: 4000, egg: 1 } },
  { id: 'hatch25', text: 'Hatch 25 eggs', need: 25, have: () => Math.max(0, how('egg') - 1), rew: { coins: 4000, egg: 1 } },
  { id: 'evo20', text: 'Evolve 20 survivalmons', need: 20, have: () => how('evolved'), rew: { coins: 5000, evo: 3 } },
  { id: 'play10h', text: 'Play for 10 hours in all', need: 10 * 3600, have: played, unit: 'play', rew: { coins: 4000, spirit: 120 } },
  { id: 'runs100', text: 'Go out on 100 runs', need: 100, have: () => Meta.data.runs || 0, rew: { coins: 5000, spirit: 150 } },
  { id: 'gear25', text: 'Find 25 pieces of gear', need: 25, have: gearPieces, rew: { coins: 5000, mats: { iron: 40 } } },
  { id: 'heroes5', text: 'Find all your friends (every hero)', need: 5, have: heroes, rew: { coins: 6000, spirit: 150 } },
  { id: 'medals25', text: 'Win 25 medals', need: 25, have: medals, rew: { coins: 5000, spirit: 150 } },
  { id: 'achv15', text: 'Reach 15 achievement tiers', need: 15, have: achvTiers, rew: { coins: 5000, spirit: 150 } },
  { id: 'gate4', text: 'Win through a Lv 4 gate', need: 13, have: () => Meta.gates, unit: 'gate', rew: { coins: 8000, spirit: 200, evo: 3 } },
  // ---------------------------------------------------------------- the end of the road
  { id: 'star5x6', text: 'Have 6 survivalmons with all five stars', need: 6, have: () => count((m) => stars(m) >= STAR_MAX), rew: { coins: 8000, spirit: 200 } },
  { id: 'finals15', text: 'Find 15 final evolutions', need: 15, have: () => known(FINAL_IDS), rew: { coins: 8000, evo: 3 } },
  { id: 'dex100', text: 'Find 100 different survivalmons', need: 100, have: () => known(DEX_IDS), rew: { coins: 8000, egg: 2 } },
  { id: 'allB5', text: 'Build every building up to Lv 5', need: 5, have: allBuildings, unit: 'lv', rew: { coins: 10000, spirit: 200 } },
  { id: 'kills25k', text: 'Defeat 25,000 monsters', need: 25000, have: kills, rew: { coins: 8000, spirit: 200 } },
  { id: 'boss50', text: 'Defeat 50 bosses', need: 50, have: () => Meta.data.bossKills || 0, rew: { coins: 8000, spirit: 200 } },
  { id: 'lv70x6', text: 'Have 6 survivalmons at Lv 70', need: 6, have: () => count((m) => m.level >= 70), rew: { coins: 10000, evo: 3 } },
  { id: 'trainMax', text: 'Max out every Training Hall upgrade', need: TRAIN_MAX, have: trainSum, rew: { coins: 12000, spirit: 250 } },
  { id: 'shrine50', text: 'Learn 50 levels at the Spirit Shrine', need: 50, have: shrineLevels, rew: { coins: 8000, spirit: 250 } },
  { id: 'dex150', text: 'Find 150 different survivalmons', need: 150, have: () => known(DEX_IDS), rew: { coins: 12000, egg: 2, evo: 2 } },
  { id: 'gateAll', text: 'Win through every gate, up to the West Gate Lv 4', need: 1, have: () => (Meta.data.allGates ? 1 : 0), rew: { coins: 15000, spirit: 400, egg: 2, evo: 3 } },
  { id: 'play24h', text: 'Play for 24 hours in all', need: 24 * 3600, have: played, unit: 'play', rew: { coins: 10000, spirit: 300 } },
  { id: 'kills50k', text: 'Defeat 50,000 monsters', need: 50000, have: kills, rew: { coins: 12000, spirit: 300 } },
  { id: 'allS', text: 'Have a survivalmon with every skill at S', need: 1, have: () => count((m) => m.skills.length > 0 && m.skills.every((k) => (k.t || 0) >= 4)), rew: { coins: 15000, spirit: 400 } },
  { id: 'dexAll', text: 'Find every survivalmon there is', need: DEX_IDS.length, have: () => known(DEX_IDS), rew: { coins: 25000, spirit: 500, egg: 3, evo: 3 } },
];

const ACTIVE = 3; // goals on the page at once

export const Goals = {
  get state() { return (Meta.data.goals ||= { claimed: [], told: [] }); },
  // the goals on the page now: the first three on the track not yet claimed
  active() { const c = new Set(this.state.claimed); return GOALS.filter((g) => !c.has(g.id)).slice(0, ACTIVE); },
  have(g) { try { return Math.max(0, g.have() || 0); } catch { return 0; } },
  done(g) { return this.have(g) >= g.need; },
  ready() { return this.active().filter((g) => this.done(g)).length; },
  number(g) { return GOALS.indexOf(g) + 1; },
  // how far along, in words: "0:45 / 1:00", "Lv 7 / 10", "★2 / 3", "1 / 2 gates", "C / A", "40 min / 1 h", "2,310 / 5,000"
  progressText(g) {
    const h = Math.min(this.have(g), g.need), n = g.need;
    const hm = (sec) => (sec >= 3600 ? `${Math.floor(sec / 3600)} h${sec % 3600 >= 60 ? ` ${Math.floor((sec % 3600) / 60)} min` : ''}` : `${Math.floor(sec / 60)} min`);
    switch (g.unit) {
      case 's': return `${mmss(h)} / ${mmss(n)}`;
      case 'rt': return `${mmss(runLengthAt(h))} / ${mmss(runLengthAt(n))}`;
      case 'lv': return `Lv ${h} / ${n}`;
      case '★': return `★${h} / ${n}`;
      case 'gate': return `${h} / ${n} gates`;
      case 'grade': return `${TIERS[h] || TIERS[0]} / ${TIERS[n]}`;
      case 'play': return `${hm(h)} / ${hm(n)}`;
      default: return `${h.toLocaleString()} / ${n.toLocaleString()}`;
    }
  },
  get total() { return GOALS.length; },
  // goals on the page that are newly done (each is told once)
  check() {
    const told = new Set(this.state.told), out = this.active().filter((g) => this.done(g) && !told.has(g.id));
    if (out.length) { this.state.told.push(...out.map((g) => g.id)); Meta.save(); }
    return out;
  },
  // The reward, as words (for the page and the toast). Evolution stones and eggs come out random.
  rewardText(r) {
    const out = [];
    if (r.coins) out.push(`${r.coins.toLocaleString()} coins`);
    if (r.spirit) out.push(`${r.spirit} Spirit`);
    for (const [k, n] of Object.entries(r.mats || {})) out.push(`${n} ${k}`);
    if (r.item) { const it = ITEMS.find((x) => x.id === r.item[0]); if (it) out.push(`${it.name}${r.item[1] > 1 ? ` (grade ${r.item[1]})` : ''}`); }
    if (r.evo) out.push(r.evo > 1 ? `${r.evo} evolution stones` : 'an evolution stone');
    if (r.egg) out.push(r.egg > 1 ? `${r.egg} eggs` : 'an egg');
    return out;
  },
  // Claim a finished goal: pays its reward. Returns the words for what you got, or null.
  claim(id) {
    const g = GOALS.find((x) => x.id === id);
    if (!g || !this.active().includes(g) || !this.done(g)) return null;
    const r = g.rew, got = [];
    let extra = 0; // a reward with no room (a full Hatchery, a full stack in the bag) turns into coins
    if (r.coins) { Meta.data.coins += r.coins; got.push(`${r.coins.toLocaleString()} coins`); }
    if (r.spirit) { Meta.addSpirit(r.spirit); got.push(`${r.spirit} Spirit`); }
    if (r.mats) { Meta.bankMats(r.mats); for (const [k, n] of Object.entries(r.mats)) got.push(`${n} ${k}`); }
    if (r.item) {
      const it = ITEMS.find((x) => x.id === r.item[0]);
      if (it && Meta.addItem(it.id, r.item[1], 1)) got.push(it.name); else extra += 150 * r.item[1];
    }
    const kinds = Object.keys(STONES);
    for (let i = 0; i < (r.evo || 0); i++) { const s = kinds[Math.floor(Math.random() * kinds.length)]; Box.addItem(s, 1); got.push(STONES[s].name); }
    for (let i = 0; i < (r.egg || 0); i++) {
      const species = BASE_IDS[Math.floor(Math.random() * BASE_IDS.length)];
      if (Box.addEgg({ species, skills: rollSkills(species), need: FOUND_HATCH, kind: 'found' })) got.push(`a ${SPECIES[species].name} egg`); else extra += 400;
    }
    if (extra) { Meta.data.coins += extra; got.push(`${extra} coins (no room for the rest)`); }
    this.state.claimed.push(g.id);
    Meta.save(); Box.save();
    return got;
  },
};
