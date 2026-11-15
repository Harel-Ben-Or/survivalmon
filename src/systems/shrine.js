// The Spirit Shrine: small upgrades that work for every survivalmon at once, and research that
// improves the odds of good skill tiers. Research runs on a real-time timer, even with the game closed.
import { Meta } from './meta.js';
import { BASE_ODDS } from '../content/skills.js';
import { Profiles } from './profiles.js';

const KEY = Profiles.key('shrine'); // this player's save
const pct = (v) => `${Math.round(v * 100)}%`;
export const SHRINE_NODES = [
  { id: 'dmg', branch: 'Power', name: 'Team damage', icon: 'fang', per: 0.03, max: 25, base: 20, desc: (v) => `+${pct(v)} damage for every survivalmon` },
  { id: 'haste', branch: 'Power', name: 'Team attack speed', icon: 'stormcharm', per: 0.02, max: 25, base: 25, desc: (v) => `Every survivalmon attacks ${pct(v)} faster` },
  { id: 'crit', branch: 'Power', name: 'Team crits', icon: 'clover', per: 0.01, max: 20, base: 30, desc: (v) => `+${pct(v)} crit chance for every survivalmon` },
  { id: 'hp', branch: 'Guard', name: 'Team HP', icon: 'heart', per: 0.05, max: 25, base: 20, desc: (v) => `+${pct(v)} max HP for every survivalmon` },
  { id: 'def', branch: 'Guard', name: 'Team defense', icon: 'shell', per: 0.02, max: 20, base: 25, desc: (v) => `Survivalmons take ${pct(v)} less damage` },
  { id: 'rest', branch: 'Guard', name: 'Restful Ranch', icon: 'berry', per: 0.05, max: 10, base: 30, desc: (v) => `Resting survivalmons heal ${pct(v)} more per run` },
  { id: 'wild', branch: 'Wild', name: 'Call of the wild', icon: 'orb_star', per: 0.05, max: 20, base: 30, desc: (v) => `Wild survivalmons appear ${pct(v)} more often` },
  { id: 'hatch', branch: 'Wild', name: 'Warm nests', icon: 'egg', per: 0.05, max: 20, base: 25, desc: (v) => `Eggs hatch ${pct(v)} faster` },
];
// Skill tier odds (% for D, C, B, A, S) at each research level
export const RESEARCH_ODDS = [BASE_ODDS, [60, 22, 11, 5, 2], [55, 23, 13, 6, 3], [50, 24, 15, 7, 4], [45, 25, 17, 8, 5], [40, 25, 19, 10, 6]];
export const RESEARCH = [null, { coins: 100, mins: 10 }, { coins: 300, mins: 30 }, { coins: 800, mins: 60 }, { coins: 2000, mins: 120 }, { coins: 5000, mins: 240 }];
const empty = () => ({ v: 1, nodes: {}, research: 0, researching: null });

export const Shrine = {
  data: empty(),
  load() {
    try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.v === 1) this.data = { ...empty(), ...d, nodes: { ...d.nodes } }; } catch { /* fresh */ }
    return this;
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage unavailable */ } },

  level(id) { return this.data.nodes[id] || 0; },
  node(id) { return SHRINE_NODES.find((n) => n.id === id); },
  value(id, L = this.level(id)) { return this.node(id).per * L; },
  maxLevel(n) { return Math.min(n.max, Meta.buildingBonus('shrine', 'cap')); },
  cost(id) {
    const n = this.node(id), L = this.level(id);
    return L >= this.maxLevel(n) ? null : Math.round(n.base * Math.pow(1.35, L));
  },
  buy(id) {
    const c = this.cost(id);
    if (c === null || c > Meta.coins) return false;
    Meta.data.coins -= c; Meta.save();
    this.data.nodes[id] = this.level(id) + 1;
    this.save();
    return true;
  },
  teamBonus() { return { dmg: this.value('dmg'), hp: this.value('hp'), haste: this.value('haste'), def: this.value('def'), crit: this.value('crit') }; },
  bonus(id) { return this.value(id); },

  // ---------------------------------------------------------- tier research
  odds() { return RESEARCH_ODDS[this.data.research]; },
  researchCap() { return Meta.buildingBonus('shrine', 'research'); },
  nextResearch() { const L = this.data.research + 1; return L > 5 || L > this.researchCap() ? null : { level: L, ...RESEARCH[L] }; },
  startResearch() {
    const r = this.nextResearch();
    if (!r || this.data.researching || Meta.coins < r.coins) return false;
    Meta.data.coins -= r.coins; Meta.save();
    this.data.researching = { level: r.level, done: Date.now() + r.mins * 60000 };
    this.save();
    return true;
  },
  // Finishes research whose time is up. Returns the level reached, or 0.
  settle(now = Date.now()) {
    const r = this.data.researching;
    if (!r || now < r.done) return 0;
    this.data.research = r.level;
    this.data.researching = null;
    this.save();
    return r.level;
  },
};
