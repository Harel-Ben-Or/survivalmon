// Tower Defense (TD): the maps, the waves, the prices and each basic mon's TD effect.
// Design: the "Survivalmon Tower Defense design" doc (Nov 2026). You bring 5 basic mons, summon them as
// towers beside the road for berries (one price for every summon, +5 each time, never capped), and merge
// two towers into a breed: basic + basic = level 1 breed, two of the same level 1 = its level 2 breed,
// two of the same level 2 = its level 3 breed, only for breeds you've owned in the main game. Towers
// can't be sold. 30 waves, 20 lives, nothing gives lives back.
import { T } from '../world/world.js';

export const TD_COLS = 28, TD_ROWS = 14;      // the board, in tiles (16 px)
export const TD_LIVES = 20;
export const TD_WAVES = 30;
export const START_BERRIES = 60;
export const SUMMON_BASE = 20, SUMMON_STEP = 5;
export const summonPrice = (n) => SUMMON_BASE + SUMMON_STEP * n; // n = summons made so far this run
export const BREAK_TIME = 5;  // seconds between waves
export const EARLY_BONUS = 10; // berries for starting the next wave early
export const NEED_BASICS = 5;  // different basic mons you need before the Watchtower opens

// A tower's strength by what it is: a basic mon, a level 1, 2 or 3 breed (the doc: each step about 2.5x)
export const TD_POWER = { 0: 1, 1: 2.5, 2: 6.25, 3: 15.6 };
// how much further each step reaches: one more foe, a bigger area, a longer effect
export const TD_STEP = { 0: 0, 1: 0, 2: 1, 3: 2 };

// Maps: a road of waypoints (tile coordinates; the first and last lie just off the board) and the
// land it runs through. Leafy Meadow is the beta's only map.
export const TD_MAPS = {
  meadow: {
    name: 'Leafy Meadow', ground: T.GRASS, road: T.DIRT,
    path: [[-1, 3], [6, 3], [6, 10], [13, 10], [13, 4], [20, 4], [20, 10], [28, 10]],
    props: ['bush_0', 'bush_0', 'bush_1', 'rock', 'stump'],
  },
};

// What each basic mon's tower does on top of its own attack from runs (the doc's 14 basic mon skills).
// A breed does both parents' things (its first parent's in full, its second's at half; two of the same
// basic mon: that one at 1.5x). Fields:
//   burn: damage per second for 3 s · root: chance a hit roots for 0.5 s · soak: slow 25% and +10%
//   damage taken for 2 s · finish: extra damage on foes under half health · chill: slow 30% for 1.5 s,
//   freezeChance: chance to freeze 1 s · poison: damage per second for 3 s · big: extra damage on big
//   foes · haste: towers on the 8 spots around attack faster · daze: chance to stop a foe 0.5 s ·
//   knock: pushed back along the road (px) · berry: berries a foe it hit drops when beaten · star:
//   chance a hit leaves a patch of stardust that hurts and slows · pierce / chains: extra foes
export const BASIC_TD = {
  emberpup: { burn: 4 },
  leafkit: { pierce: 2, root: 0.25 },
  voltowl: { chains: 0 },
  puddlit: { soak: 1 },
  pebblet: { knock: 14 },
  glimmoth: { berry: 1 },
  duskit: { finish: 1 },
  snowpip: { chill: 1, freezeChance: 0.1 },
  venewt: { poison: 4 },
  ferrit: { big: 0.5 },
  lumilamb: { haste: 0.2 },
  drakling: { knock: 10 },
  psylotl: { daze: 0.35 },
  cometail: { star: 0.25 },
};

// Mix two basic mons' TD effects: a's in full, b's at half (the same mon twice: 1.5x)
export function mixTD(a, b) {
  const A = BASIC_TD[a] || {}, B = BASIC_TD[b] || {};
  const k = a === b ? 1.5 : 1;
  const out = {};
  for (const [f, v] of Object.entries(A)) out[f] = v * k;
  if (a !== b) for (const [f, v] of Object.entries(B)) out[f] = (out[f] || 0) + v * 0.5;
  // chances stay chances
  for (const f of ['root', 'freezeChance', 'daze', 'star']) if (out[f]) out[f] = Math.min(0.6, out[f]);
  return out;
}

// The creatures of a wave: [type, how many] groups, walked in one after another. Big foes are the
// heavy ones Ferrit's blades hit harder.
export const BIG_FOES = new Set(['beetle', 'golem', 'shardooze']);
const W = (n) => {
  if (n === 10) return [['king_slime', 1], ['blob', 10]];
  if (n === 20) return [['treant', 1], ['hound', 10], ['blob', 8]];
  if (n === 30) return [['night_lord', 1], ['hound', 12], ['shardooze', 3]];
  const base = 7 + Math.round(n * 0.7);
  if (n <= 2) return [['blob', base]];
  if (n === 3) return [['blob', base], ['droplet', 10]];
  if (n === 4) return [['droplet', 24]];
  if (n === 5) return [['blob', base], ['hound', 4]];
  if (n === 6) return [['beetle', 4], ['blob', base]];
  if (n === 7) return [['bloater', 6], ['blob', base]];
  if (n === 8) return [['hound', 12]];
  if (n === 9) return [['blob', base], ['witch', 1], ['beetle', 3]];
  const mix = [['blob', base], ['hound', Math.round(n / 3)], ['beetle', Math.round(n / 5)]];
  if (n >= 12) mix.push(['bloater', Math.round(n / 4)]);
  if (n >= 14) mix.push(['golem', Math.round(n / 8)]);
  if (n % 4 === 1 && n > 10) mix.push(['witch', 1 + Math.floor(n / 15)]);
  if (n >= 22) mix.push(['moonfang', Math.round(n / 4)]);
  if (n >= 24) mix.push(['shardooze', Math.round(n / 8)]);
  if (n % 5 === 3) mix.push(['droplet', 20 + n]);
  return mix;
};
export function tdWave(n) { return W(n); }
// How tough a wave's creatures are: their run health times this (bosses: their own scale)
export const waveHp = (n) => 0.9 * Math.pow(1.16, n - 1);
export const BOSS_HP = { king_slime: 0.32, treant: 0.55, night_lord: 0.32 };
// seconds between creatures in a group
export const waveGap = (n) => Math.max(0.35, 0.9 - n * 0.018);
// berries a beaten creature drops
export const berriesFor = (type, boss) => (boss ? 30 : BIG_FOES.has(type) ? 6 : type === 'droplet' ? 1 : 3);
// creatures that get through cost lives: a boss 5, the rest 1
export const livesFor = (boss) => (boss ? 5 : 1);

// Rewards (a beta's first numbers): per wave cleared, and the chests at waves 10, 20 and the win
export const TD_REWARD = { coinsPerWave: 18, spiritPerWave: 2, chestMats: 6, firstWinShards: 10 };
