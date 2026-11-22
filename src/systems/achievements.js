// Achievements and medals: reasons to catch, breed and raise as many survivalmons as you can.
// - Medals belong to a species (in its Survidex record, Box.data.dex[id].medals): won the first time
//   you have one that is among the tallest/shortest/heaviest/lightest 5%, has an S-grade attack, or
//   reaches Lv 70. Box.noteSize hands them out.
// - Achievements are goals across your whole collection, each in tiers. Reaching a tier pays
//   Skyfall Shards at once (Box.data.achv[id] = tiers reached). Before shards they paid coins: a save
//   from then gets the shards for the tiers it already had, once (Box.data.achvShards).
import { Box } from './collection.js';
import { Meta } from './meta.js';
import { BASE_IDS, PURE_IDS, MIXED_IDS, EVOLVED_IDS, FINAL_IDS, DEX_IDS } from '../content/species.js';

export const MEDALS = {
  giant: { name: 'Giant', desc: 'had one among the tallest 5%', color: '#8fd0ff' },
  mini: { name: 'Mini', desc: 'had one among the shortest 5%', color: '#d8b8ff' },
  heavy: { name: 'Heavyweight', desc: 'had one among the heaviest 5%', color: '#f0b070' },
  feather: { name: 'Featherweight', desc: 'had one among the lightest 5%', color: '#bff0c8' },
  star: { name: 'Star', desc: 'had one with an S-grade attack', color: '#ffd84a' },
  master: { name: 'Master', desc: 'raised one to Lv 70', color: '#ff9a8a' },
};
export const MEDAL_IDS = Object.keys(MEDALS);

const medals = (k) => Object.values(Box.data.dex).filter((r) => r.medals?.[k]).length;
const had = (ids) => ids.filter((id) => Box.known(id)).length;
const how = (k) => Object.values(Box.data.dex).reduce((s, r) => s + (r.how?.[k] || 0), 0);
const medalGoal = (id, name, what) => ({ id, name, desc: (n) => (n === 1 ? `Win your first ${what} medal` : `Win the ${what} medal on ${n} different survivalmons`),
  tiers: [1, 5, 15, 40], pay: [10, 20, 50, 120], have: () => medals(id) });

// The first 175 survivalmons' tiers stay as they were (10 species, 55 breeds, 55 first and 55 final evolutions).
// When new families are live, each of these gets one more tier for the new total (more(list, old) -> [total],
// more(list, old, pay) -> [pay]); nothing a player already earned moves.
const more = (list, old, pay) => (list.length > old ? [pay ?? list.length] : []);
const BREEDS = [...PURE_IDS, ...MIXED_IDS];
export const ACHIEVEMENTS = [
  { id: 'collector', name: 'Collector', desc: (n) => (n === DEX_IDS.length ? `Find all ${n} survivalmons` : `Find ${n} different survivalmons`),
    tiers: [5, 15, 35, 70, 120, 175, ...more(DEX_IDS, 175)], pay: [5, 10, 20, 40, 80, 150, ...more(DEX_IDS, 175, 300)], have: () => had(DEX_IDS) },
  { id: 'species', name: 'Every species', desc: (n) => (n === BASE_IDS.length ? `Have all ${n} species` : `Have ${n} different species`),
    tiers: [3, 6, 10, ...more(BASE_IDS, 10)], pay: [10, 20, 40, ...more(BASE_IDS, 10, 60)], have: () => had(BASE_IDS) },
  { id: 'wild', name: 'Wild catcher', desc: (n) => `Catch ${n} wild survivalmons`, tiers: [5, 25, 100, 300], pay: [5, 15, 40, 100], have: () => how('wild') },
  { id: 'breeder', name: 'Breeder', desc: (n) => `Find ${n} different breeds`, tiers: [3, 10, 25, 55, ...more(BREEDS, 55)], pay: [10, 25, 60, 150, ...more(BREEDS, 55, 300)], have: () => had(BREEDS) },
  { id: 'evolver', name: 'Evolver', desc: (n) => (n === 1 ? 'Evolve a survivalmon for the first time' : `Find ${n} different first evolutions`), tiers: [1, 10, 30, 55, ...more(EVOLVED_IDS, 55)], pay: [15, 30, 80, 180, ...more(EVOLVED_IDS, 55, 350)], have: () => had(EVOLVED_IDS) },
  { id: 'finalist', name: 'Final forms', desc: (n) => (n === 1 ? 'Find your first final evolution' : `Find ${n} different final evolutions`), tiers: [1, 10, 30, 55, ...more(FINAL_IDS, 55)], pay: [25, 50, 120, 300, ...more(FINAL_IDS, 55, 500)], have: () => had(FINAL_IDS) },
  medalGoal('giant', 'Giant hunter', 'Giant'),
  medalGoal('mini', 'Tiny finder', 'Mini'),
  medalGoal('heavy', 'Heavy lifter', 'Heavyweight'),
  medalGoal('feather', 'Light as a feather', 'Featherweight'),
  { id: 'star', name: 'Star grades', desc: (n) => (n === 1 ? 'Win your first Star medal' : `Win the Star medal on ${n} different survivalmons`), tiers: [1, 10, 30], pay: [15, 40, 120], have: () => medals('star') },
  { id: 'starborn', name: 'Five stars', desc: (n) => (n === 1 ? 'Raise a survivalmon to all five stars' : `Have ${n} survivalmons with all five stars`), tiers: [1, 5, 15, 40], pay: [25, 60, 150, 350], have: () => Box.mons.filter((m) => (m.stars || 0) >= 5).length },
  { id: 'master', name: 'Master trainer', desc: (n) => (n === 1 ? 'Raise a survivalmon to Lv 70' : `Raise ${n} different survivalmons to Lv 70`), tiers: [1, 5, 20], pay: [30, 100, 300], have: () => medals('master') },
  { id: 'gates', name: 'Gate opener', desc: (n) => (n === 1 ? 'Open the South Gate Lv 1' : n === 15 ? 'Open every gate, up to the West Gate Lv 4' : `Open ${n} gates past the North Gate Lv 1`),
    tiers: [1, 4, 8, 12, 15], pay: [20, 60, 120, 200, 400], have: () => Meta.gates },
  { id: 'perfect', name: 'Perfect', desc: () => 'Have a survivalmon with every skill at S', tiers: [1], pay: [150],
    have: () => (Box.mons.some((m) => m.skills.length > 1 && m.skills.every((k) => k.t === 4)) ? 1 : 0) },
];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
export const tierName = (a, t) => (a.tiers.length > 1 ? `${a.name} ${ROMAN[t]}` : a.name);
export const tiersReached = (a) => Box.data.achv?.[a.id] || 0;

// Pays for every tier reached since last time and returns them ({ name, desc, pay }) to announce
export function checkAchievements() {
  const got = (Box.data.achv ||= {});
  const news = [];
  if (!Box.data.achvShards) {
    // tiers won back when achievements paid coins: their shards, once
    Box.data.achvShards = true;
    const back = ACHIEVEMENTS.reduce((s, a) => s + a.pay.slice(0, got[a.id] || 0).reduce((x, y) => x + y, 0), 0);
    if (back) { Meta.addShards(back); news.push({ name: 'Skyfall Shards', desc: 'Achievements pay Skyfall Shards now. These are for the ones you already won', pay: back }); }
    Box.save();
  }
  for (const a of ACHIEVEMENTS) {
    const have = a.have(), t0 = got[a.id] || 0;
    let t = t0;
    while (t < a.tiers.length && have >= a.tiers[t]) {
      Meta.data.shards = (Meta.data.shards || 0) + a.pay[t];
      news.push({ name: tierName(a, t), desc: a.desc(a.tiers[t]), pay: a.pay[t] });
      t++;
    }
    if (t !== t0) got[a.id] = t;
  }
  if (news.length) { Box.save(); Meta.save(); }
  return news;
}
