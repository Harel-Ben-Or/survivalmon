// The Ranch: every survivalmon you own (copies too), the team, Hatchery eggs, species coins and
// upgrades, Ranch training spots and the Survidex. Saved in this browser.
import { SPECIES, STONES, STONE_OF, BASE_IDS, petXpFor, MAX_PET_LEVEL, EVO_LEVEL, breedResult } from '../content/species.js';
import { BASE_ODDS, rollTier, rollPassive, sameSkill } from '../content/skills.js';
import { Meta } from './meta.js';
import { Profiles } from './profiles.js';

const KEY = Profiles.key('box'); // this player's save
export const EGG_SLOTS = 3;
export const STARTER_HATCH = 60;     // seconds in the wild before the starter egg hatches
export const FOUND_HATCH = 120;      // eggs found in runs
export const BRED_HATCH = 180;       // eggs from the Hatchery
export const TRAIN_XP_PER_MIN = 6;   // Ranch training, offline
const empty = () => ({
  v: 2, nextId: 1, mons: [], team: [], eggs: [], bag: {}, coins: {}, upgrades: {}, training: [],
  seen: {}, caught: {}, discovered: {}, firstHatch: false, rewards: {},
});

// Skills a newly caught or hatched survivalmon of this species rolls.
export function rollSkills(species, { minTier = 0, maxTier = 4, odds = BASE_ODDS } = {}) {
  const t = () => Math.max(minTier, Math.min(maxTier, rollTier(odds)));
  return [{ k: 'u', sp: species, t: t() }, { k: 'p', id: rollPassive(), t: t() }];
}

export const Box = {
  data: empty(),
  dirty: false,

  load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && d.v === 2) this.data = { ...empty(), ...d };
      else if (d && d.v === 1) this.migrate(d);
    } catch { /* storage unavailable: start empty */ }
    return this;
  },
  // Saves from before the town: survivalmons keep their level and get skills; monsters you'd
  // caught (slimes, bats…) are no longer survivalmons, so they're traded for coins.
  migrate(old) {
    const d = empty();
    let coins = 0;
    for (const m of old.mons || []) {
      if (!SPECIES[m.species]) { coins += 10 + 5 * (m.level || 1); continue; }
      d.mons.push({ id: m.id, species: m.species, level: m.level || 1, xp: m.xp || 0, hp: 1, skills: rollSkills(m.species), caughtAt: m.caughtAt || Date.now(), origin: 'old' });
    }
    d.nextId = (old.nextId || d.mons.length + 1);
    d.team = (old.team || []).filter((id) => d.mons.some((m) => m.id === id));
    d.bag = { ...(old.bag || {}) };
    for (const m of d.mons) { d.seen[m.species] = true; d.caught[m.species] = (d.caught[m.species] || 0) + 1; }
    d.firstHatch = d.mons.length > 0;
    this.data = d;
    if (coins) { Meta.data.coins += coins; Meta.save(); this.migratedCoins = coins; }
    this.save();
  },
  save() {
    this.dirty = false;
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage unavailable */ }
  },
  saveIfDirty() { if (this.dirty) this.save(); },

  // ---------------------------------------------------------- survivalmons and the team
  get mons() { return this.data.mons; },
  get isEmpty() { return this.data.mons.length === 0; },
  get(id) { return this.data.mons.find((m) => m.id === id); },
  teamSize() { return 3 + Meta.buildingBonus('gate', 'team'); },
  team() { return this.data.team.map((id) => this.get(id)).filter(Boolean); },
  inTeam(id) { return this.data.team.includes(id); },
  toggleTeam(id) {
    const t = this.data.team;
    const i = t.indexOf(id);
    if (i >= 0) t.splice(i, 1);
    else if (t.length < this.teamSize()) t.push(id);
    else return false;
    this.save();
    return true;
  },
  // Put a survivalmon into team slot i (moving it if it's already in another slot).
  setTeamSlot(i, id) {
    const t = this.data.team.filter((x) => x !== id);
    if (i >= t.length) t.push(id); else t[i] = id;
    this.data.team = t.slice(0, this.teamSize());
    this.save();
  },

  add(species, { skills = rollSkills(species), joinTeam = true, origin = 'wild', level = 1 } = {}) {
    const mon = { id: this.data.nextId++, species, level, xp: 0, hp: 1, skills, caughtAt: Date.now(), origin };
    this.data.mons.push(mon);
    this.data.caught[species] = (this.data.caught[species] || 0) + 1;
    this.data.seen[species] = true;
    if (SPECIES[species].stage > 1) this.data.discovered[species] = true;
    if (joinTeam && this.data.team.length < this.teamSize()) this.data.team.push(mon.id);
    this.save();
    return mon;
  },
  remove(id) {
    this.data.mons = this.data.mons.filter((m) => m.id !== id);
    this.data.team = this.data.team.filter((x) => x !== id);
    this.data.training = this.data.training.filter((t) => t.id !== id);
  },
  markSeen(species) {
    if (SPECIES[species] && !this.data.seen[species]) { this.data.seen[species] = true; this.dirty = true; }
  },
  maxHpOf(mon) { return SPECIES[mon.species].hp; },

  // Returns the new levels reached
  addXp(mon, n) {
    const levels = [];
    if (mon.level >= MAX_PET_LEVEL) return levels;
    mon.xp += n;
    while (mon.level < MAX_PET_LEVEL && mon.xp >= petXpFor(mon.level)) {
      mon.xp -= petXpFor(mon.level);
      mon.level++;
      levels.push(mon.level);
    }
    if (levels.length) this.save(); else this.dirty = true;
    return levels;
  },

  // ---------------------------------------------------------- after a run
  // Team members bring their HP home; everyone who stayed behind rests and heals.
  afterRun(pets, restHeal) {
    const went = new Set();
    for (const p of pets) { p.mon.hp = Math.max(0, Math.min(1, p.hp / p.maxHp)); went.add(p.mon.id); }
    for (const m of this.data.mons) if (!went.has(m.id)) m.hp = Math.min(1, m.hp + restHeal);
    this.save();
    return pets.some((p) => p.mon.hp < 1);
  },
  hurtMons() { return this.data.mons.filter((m) => m.hp < 1); },
  heal(mon, frac = 1) { mon.hp = Math.min(1, mon.hp + frac); this.save(); },

  // ---------------------------------------------------------- Hatchery eggs
  // egg: { species, skills, need (s in the wild), progress, kind: 'starter' | 'found' | 'bred' }
  get eggs() { return this.data.eggs; },
  addEgg(egg) {
    if (this.data.eggs.length >= EGG_SLOTS) return false;
    this.data.eggs.push({ progress: 0, ...egg });
    this.save();
    return true;
  },
  warmEggs(seconds) {
    for (const e of this.data.eggs) e.progress = Math.min(e.need, e.progress + seconds);
    this.save();
  },
  // Hatches every egg that's ready. Returns the new survivalmons.
  hatchReady() {
    const out = [];
    this.data.eggs = this.data.eggs.filter((e) => {
      if (e.progress < e.need) return true;
      const mon = this.add(e.species, { skills: e.skills, origin: e.kind === 'bred' ? 'bred' : 'egg' });
      if (e.kind === 'bred') this.data.discovered[e.species] = true;
      out.push(mon);
      return false;
    });
    if (out.length) { this.data.firstHatch = true; this.save(); }
    return out;
  },

  // ---------------------------------------------------------- breeding
  // Both parents are used up. Each passes one of its skills at random (keeping its tier); the
  // breed's own skill rolls a fresh tier, helped by its parents' own skill tiers.
  breed(aId, bId, odds = BASE_ODDS) {
    const a = this.get(aId), b = this.get(bId);
    const species = a && b && aId !== bId ? breedResult(a.species, b.species) : null;
    if (!species || this.data.eggs.length >= EGG_SLOTS) return null;
    const pick = (m) => ({ ...m.skills[Math.floor(Math.random() * m.skills.length)] });
    const ia = pick(a), ib = pick(b);
    const parentTier = (a.skills[0].t + b.skills[0].t) / 2;
    const own = { k: 'u', sp: species, t: rollTier(odds, parentTier * 12) };
    let skills = [own, ia, ib];
    if (sameSkill(ia, ib)) skills = [own, { ...ia, t: Math.min(4, Math.max(ia.t, ib.t) + 1) }];
    // a parent passing the breed's own species attack just strengthens it
    skills = skills.filter((s, i) => i === 0 || !(s.k === 'u' && s.sp === species));
    this.remove(aId); this.remove(bId);
    this.data.eggs.push({ species, skills, need: BRED_HATCH, progress: 0, kind: 'bred' });
    this.save();
    return species;
  },

  // ---------------------------------------------------------- evolving mixed breeds
  evoInfo(mon) {
    const sp = SPECIES[mon.species];
    if (sp.kind !== 'mixed') return null;
    const items = sp.types.map((t) => STONE_OF[t]);
    const have = items.find((s) => this.itemCount(s) > 0);
    return { into: sp.evo, items, item: have || items[0], level: EVO_LEVEL, hasItem: !!have, levelOk: mon.level >= EVO_LEVEL };
  },
  canEvolve(mon) { const e = this.evoInfo(mon); return !!e && e.hasItem && e.levelOk; },
  evolve(mon) {
    const e = this.evoInfo(mon);
    if (!e || !e.hasItem || !e.levelOk) return false;
    this.data.bag[e.item]--;
    mon.species = e.into;
    mon.skills[0] = { k: 'u', sp: e.into, t: Math.min(4, mon.skills[0].t + 1) };
    this.data.discovered[e.into] = true;
    this.data.seen[e.into] = true;
    this.save();
    return true;
  },
  addItem(id, n = 1) { if (!STONES[id]) return; this.data.bag[id] = (this.data.bag[id] || 0) + n; this.save(); },
  itemCount(id) { return this.data.bag[id] || 0; },

  // ---------------------------------------------------------- species coins and upgrades
  // Freeing a survivalmon pays coins of the species it's made of (more for grown-up forms and levels).
  freeValue(mon) {
    const sp = SPECIES[mon.species], each = (sp.stage === 1 ? 2 : sp.stage === 2 ? 3 : 5) + Math.floor(mon.level / 3);
    const out = {};
    for (const l of sp.lines) out[l] = (out[l] || 0) + each;
    return out;
  },
  free(id) {
    const mon = this.get(id);
    if (!mon) return null;
    const got = this.freeValue(mon);
    for (const [l, n] of Object.entries(got)) this.data.coins[l] = (this.data.coins[l] || 0) + n;
    this.remove(id);
    this.save();
    return got;
  },
  speciesCoins(line) { return this.data.coins[line] || 0; },
  upLevel(line) { return this.data.upgrades[line] || 0; },
  upCost(line) { const L = this.upLevel(line); return L >= 20 ? null : 4 + L * 3; },
  buyUpgrade(line) {
    const c = this.upCost(line);
    if (c === null || this.speciesCoins(line) < c) return false;
    this.data.coins[line] -= c;
    this.data.upgrades[line] = this.upLevel(line) + 1;
    this.save();
    return true;
  },
  // +8% damage and HP per upgrade level of the species a survivalmon is made of (averaged for mixes)
  speciesMul(species) {
    const ls = SPECIES[species].lines;
    return 1 + 0.08 * (ls.reduce((s, l) => s + this.upLevel(l), 0) / ls.length);
  },

  // ---------------------------------------------------------- Ranch training (offline)
  trainSpots() { return 2 + Meta.buildingBonus('ranch', 'spots'); },
  isTraining(id) { return this.data.training.some((t) => t.id === id); },
  toggleTraining(id) {
    const i = this.data.training.findIndex((t) => t.id === id);
    if (i >= 0) { this.settleTraining(); this.data.training.splice(i, 1); }
    else if (this.data.training.length < this.trainSpots()) this.data.training.push({ id, since: Date.now() });
    else return false;
    this.save();
    return true;
  },
  // Pays out the EXP trained since last time. Returns [{ mon, xp, levels }].
  settleTraining(now = Date.now()) {
    const rate = TRAIN_XP_PER_MIN * (1 + Meta.buildingBonus('ranch', 'rate'));
    const out = [];
    for (const t of this.data.training) {
      const mon = this.get(t.id);
      const mins = Math.max(0, (now - t.since) / 60000);
      const xp = Math.floor(mins * rate);
      if (!mon || xp < 1) continue;
      t.since += (xp / rate) * 60000;
      out.push({ mon, xp, levels: this.addXp(mon, xp) });
    }
    if (out.length) this.save();
    return out;
  },

  // ---------------------------------------------------------- Survidex
  linesCaught() { return BASE_IDS.filter((id) => this.data.caught[id]).length; },
  ownedCount(species) { return this.data.mons.filter((m) => m.species === species).length; },
  known(species) { return !!(this.data.caught[species] || this.data.discovered[species]); },
};
