// The goal tracker: one long track of goals, from your first minutes in Hearthvale to the last gate,
// three at a time. When one is done you're told at once (in a run, in the feed), and you claim its
// reward on the Goals page in town: coins, Spirit, materials, and now and then something rarer (an
// evolution stone, an egg, a Merchant item). The next goal on the track then takes its place.
// Separate from the Survidex achievements, which pay Skyfall Shards.
// Saved in Meta.data.goals: { claimed: [ids], told: [ids] }.
import { Box, rollSkills, FOUND_HATCH, STAR_MAX } from './collection.js';
import { Meta } from './meta.js';
import { Shrine } from './shrine.js';
import { SPECIES, STONES, BASE_IDS, DEX_IDS, FINAL_IDS } from '../content/species.js';
import { ITEMS } from '../content/shop.js';
import { runLengthAt } from './meta.js';
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

// rew: coins, spirit, mats { wood, stone, clay, iron }, evo (evolution stones, random kinds),
//      egg (eggs for the Hatchery), item [id, grade] (a Merchant item for the bag)
export const GOALS = [
  // your first hour
  { id: 'rt1', text: 'Buy Run time at the Training Hall', need: 1, have: () => Meta.level('runtime'), rew: { coins: 40, spirit: 5 } },
  { id: 'runs3', text: 'Go out on 3 runs', need: 3, have: () => Meta.data.runs || 0, rew: { coins: 50, mats: { wood: 5 } } },
  { id: 'catch1', text: 'Catch a wild survivalmon', need: 1, have: () => how('wild'), rew: { coins: 60, item: ['heal', 1] } },
  { id: 'surv60', text: 'Last a whole minute in a run', need: 60, have: () => Math.floor(Meta.data.bestTime || 0), unit: 's', rew: { coins: 60, spirit: 5 } },
  { id: 'mons3', text: 'Have 3 survivalmons', need: 3, have: () => Box.mons.length, rew: { coins: 80, mats: { stone: 5 } } },
  { id: 'hatch1', text: 'Hatch an egg in the Hatchery', need: 1, have: () => Math.max(0, how('egg') - 1), rew: { coins: 80, mats: { clay: 5 } } },
  { id: 'free1', text: 'Free a survivalmon (it pays coins of its kind)', need: 1, have: () => Box.data.freed || 0, rew: { coins: 50, spirit: 5 } },
  { id: 'star1', text: 'Give a survivalmon its first star', need: 1, have: () => most(stars), rew: { coins: 100, spirit: 10 } },
  { id: 'rt2', text: 'Train Run time up to 2:00', need: runtimeFor(120), have: () => Meta.level('runtime'), unit: 'rt', rew: { coins: 150, mats: { wood: 10, stone: 10 } } },
  { id: 'lv10', text: 'Raise a survivalmon to Lv 10', need: 10, have: () => most((m) => m.level), unit: 'lv', rew: { coins: 120, item: ['swift', 1] } },
  { id: 'boss1', text: 'Defeat a boss in a run', need: 1, have: () => Meta.data.bossKills || 0, rew: { coins: 150, spirit: 10 } },
  { id: 'bred1', text: 'Breed two survivalmons at the Hatchery', need: 1, have: () => how('bred'), rew: { coins: 150, spirit: 15, mats: { clay: 10 } } },
  { id: 'surv180', text: 'Last 3 minutes in a run', need: 180, have: () => Math.floor(Meta.data.bestTime || 0), unit: 's', rew: { coins: 200, spirit: 10 } },
  { id: 'mons8', text: 'Have 8 survivalmons', need: 8, have: () => Box.mons.length, rew: { coins: 200, mats: { iron: 5 } } },
  { id: 'build2', text: 'Build up any building to Lv 2', need: 2, have: topBuilding, unit: 'lv', rew: { coins: 200, mats: { wood: 10, stone: 10 } } },
  { id: 'gateN', text: "Defeat the North Gate's Night Lord", need: 1, have: () => Meta.gates, rew: { coins: 400, spirit: 25, evo: 1 } },
  { id: 'star3', text: 'Give a survivalmon 3 stars', need: 3, have: () => most(stars), unit: '★', rew: { coins: 300, spirit: 20 } },
  { id: 'dex10', text: 'Find 10 different survivalmons', need: 10, have: () => known(DEX_IDS), rew: { coins: 300, evo: 1 } },
  { id: 'shrine1', text: 'Learn something at the Spirit Shrine', need: 1, have: shrineLevels, rew: { coins: 300, spirit: 10 } },
  // the middle of the game
  { id: 'lv30', text: 'Raise a survivalmon to Lv 30', need: 30, have: () => most((m) => m.level), unit: 'lv', rew: { coins: 400, evo: 1 } },
  { id: 'evo1', text: 'Evolve a survivalmon', need: 1, have: () => how('evolved'), rew: { coins: 500, spirit: 30 } },
  { id: 'gateS', text: "Defeat the South Gate's Night Lord", need: 2, have: () => Meta.gates, unit: 'gate', rew: { coins: 800, spirit: 40, egg: 1 } },
  { id: 'rt5', text: 'Train Run time up to 5:00', need: runtimeFor(300), have: () => Meta.level('runtime'), unit: 'rt', rew: { coins: 800, mats: { iron: 15 } } },
  { id: 'catch25', text: 'Catch 25 wild survivalmons', need: 25, have: () => how('wild'), rew: { coins: 600, item: ['power', 2] } },
  { id: 'star5', text: 'Give a survivalmon all five stars', need: STAR_MAX, have: () => most(stars), unit: '★', rew: { coins: 1000, spirit: 50, evo: 1 } },
  { id: 'gateE', text: "Defeat the East Gate's Night Lord", need: 3, have: () => Meta.gates, unit: 'gate', rew: { coins: 1500, spirit: 60, egg: 1, evo: 1 } },
  { id: 'team4', text: 'Take 4 survivalmons on a run (build up the gate)', need: 4, have: () => Box.teamSize(), rew: { coins: 800, spirit: 30 } },
  { id: 'build4', text: 'Build up any building to Lv 4', need: 4, have: topBuilding, unit: 'lv', rew: { coins: 1200, mats: { wood: 25, stone: 25, iron: 10 } } },
  { id: 'lv55', text: 'Raise a survivalmon to Lv 55', need: 55, have: () => most((m) => m.level), unit: 'lv', rew: { coins: 1500, evo: 2 } },
  { id: 'final1', text: 'Find a final evolution', need: 1, have: () => known(FINAL_IDS), rew: { coins: 1500, spirit: 60 } },
  { id: 'gateW', text: "Defeat the West Gate's Night Lord", need: 4, have: () => Meta.gates, unit: 'gate', rew: { coins: 2500, spirit: 80, egg: 1, evo: 1 } },
  { id: 'rt8', text: 'Train Run time all the way up to 8:00', need: runtimeFor(480), have: () => Meta.level('runtime'), unit: 'rt', rew: { coins: 2000, mats: { iron: 30 } } },
  { id: 'free50', text: 'Free 50 survivalmons', need: 50, have: () => Box.data.freed || 0, rew: { coins: 1500, spirit: 40 } },
  { id: 'star3x5', text: 'Have 5 survivalmons with 3 stars or more', need: 5, have: () => count((m) => stars(m) >= 3), rew: { coins: 2000, spirit: 80 } },
  // the later gates
  { id: 'gate2', text: 'Win through a Lv 2 gate', need: 5, have: () => Meta.gates, unit: 'gate', rew: { coins: 3000, spirit: 100, evo: 2 } },
  { id: 'dex50', text: 'Find 50 different survivalmons', need: 50, have: () => known(DEX_IDS), rew: { coins: 3000, egg: 1, evo: 1 } },
  { id: 'lv70', text: 'Raise a survivalmon to Lv 70', need: 70, have: () => most((m) => m.level), unit: 'lv', rew: { coins: 4000, evo: 3 } },
  { id: 'gate3', text: 'Win through a Lv 3 gate', need: 9, have: () => Meta.gates, unit: 'gate', rew: { coins: 5000, spirit: 150, item: ['feather', 3] } },
  { id: 'star5x3', text: 'Have 3 survivalmons with all five stars', need: 3, have: () => count((m) => stars(m) >= STAR_MAX), rew: { coins: 5000, spirit: 150, egg: 1 } },
  { id: 'gate4', text: 'Win through a Lv 4 gate', need: 13, have: () => Meta.gates, unit: 'gate', rew: { coins: 8000, spirit: 200, evo: 3 } },
  { id: 'gateAll', text: 'Win through every gate, up to the West Gate Lv 4', need: 1, have: () => (Meta.data.allGates ? 1 : 0), rew: { coins: 15000, spirit: 400, egg: 2, evo: 3 } },
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
  // how far along, in words: "0:45 / 1:00", "Lv 7 / 10", "★2 / 3", "1 / 2 gates", "2 / 3"
  progressText(g) {
    const h = Math.min(this.have(g), g.need), n = g.need;
    switch (g.unit) {
      case 's': return `${mmss(h)} / ${mmss(n)}`;
      case 'rt': return `${mmss(runLengthAt(h))} / ${mmss(runLengthAt(n))}`;
      case 'lv': return `Lv ${h} / ${n}`;
      case '★': return `★${h} / ${n}`;
      case 'gate': return `${h} / ${n} gates`;
      default: return `${h} / ${n}`;
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
