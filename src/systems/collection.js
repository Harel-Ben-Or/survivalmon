// The Ranch: every survivalmon you own (copies too), the team, Hatchery eggs, species coins and
// upgrades, Ranch training spots and the Survidex. Saved in this browser.
import { SPECIES, STONES, STONE_OF, BASE_IDS, petXpFor, MAX_PET_LEVEL, evoLevel, breedResult, rollSize, rollBuild, weightOf, H5, H95, W5, W95, STAT_SHAPE, LEVEL_HP, LEVEL_ATK, atkType } from '../content/species.js';
import { BASE_ODDS, rollTier, tierOdds, rollPassive, sameSkill, PASSIVES } from '../content/skills.js';
import { Meta, cleanName } from './meta.js';
import { Profiles } from './profiles.js';

const KEY = Profiles.key('box'); // this player's save
export const EGG_SLOTS = 3;
// What a survivalmon is called: the name you gave it, or its species
export const monName = (m) => (m && (m.nick || SPECIES[m.species]?.name)) || '';
// A survivalmon's stats out of town (no run cards): HP, Attack (100 = an average Lv 1), Speed (100 =
// normal attack rate), Defense (% less damage taken) and Crit (% double hits). `tiers` can override
// skill tiers (a run's boosts). The Pet uses the same shape and growth.
export function statShape(m) { return STAT_SHAPE[atkType(m.species)] || STAT_SHAPE.shot; }
export function monPassives(m, tierOf = (s) => s.t) {
  const pass = {};
  for (const s of m.skills) if (s.k === 'p' && PASSIVES[s.id]) pass[s.id] = Math.max(pass[s.id] || 0, PASSIVES[s.id].vals[tierOf(s)]);
  return pass;
}
export function monStats(m) {
  const sp = SPECIES[m.species], sh = statShape(m), pass = monPassives(m), mul = Box.speciesMul(sp.id), L = m.level - 1;
  return {
    hp: Math.round(sp.hp * sh.hp * (1 + LEVEL_HP * L) * (1 + (pass.heart || 0)) * mul),
    atk: Math.round(100 * sh.atk * (1 + LEVEL_ATK * L) * mul),
    spd: Math.round((100 * sh.spd) / (1 - (pass.swift || 0))),
    def: Math.round(100 * (1 - (1 - sh.def) * (1 - (pass.hide || 0)))),
    crit: Math.round(100 * (pass.claw || 0)),
    next: { hp: Math.round(sp.hp * sh.hp * LEVEL_HP * (1 + (pass.heart || 0)) * mul), atk: Math.round(100 * sh.atk * LEVEL_ATK * mul) },
  };
}
export const STARTER_HATCH = 60;     // seconds in the wild before the starter egg hatches
export const FOUND_HATCH = 120;      // eggs found in runs
export const BRED_HATCH = 180;       // eggs from the Hatchery
export const TRAIN_XP_PER_MIN = 6;   // Ranch training, offline
export const SPECIES_UP_MAX = 100;   // species upgrade levels
const empty = () => ({
  v: 2, nextId: 1, mons: [], team: [], eggs: [], bag: {}, coins: {}, upgrades: {}, training: [],
  seen: {}, caught: {}, discovered: {}, firstHatch: false, rewards: {},
  dex: {}, // what you've done with each species, for the Survidex (see Box.note)
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
    this.fillDex();
    return this;
  },
  // Saves from before sizes and the Survidex records: every survivalmon gets its size, and each
  // species' record starts from the ones you have (and how many you'd found).
  fillDex() {
    const d = this.data;
    if (d.dexFilled && (d.dexV || 0) >= 2) return;
    if (d.dexFilled) { // version 2 adds builds (weight), weight records and medals
      for (const m of d.mons) { if (!m.sz) m.sz = rollSize(); if (!m.wz) m.wz = rollBuild(); this.noteSize(this.dexRec(m.species), m); }
      d.dexV = 2;
      this.save();
      return;
    }
    for (const m of d.mons) {
      if (!m.sz) m.sz = rollSize();
      if (!m.wz) m.wz = rollBuild();
      const r = this.dexRec(m.species);
      r.n = Math.max(r.n, d.caught[m.species] || 0);
      r.how[m.origin === 'bred' ? 'bred' : m.origin === 'wild' ? 'wild' : 'egg'] = (r.how[m.origin === 'bred' ? 'bred' : m.origin === 'wild' ? 'wild' : 'egg'] || 0) + 1;
      this.noteSize(r, m);
      if (m.caughtAt && (!r.first || m.caughtAt < r.first)) r.first = m.caughtAt;
    }
    for (const [sp, n] of Object.entries(d.caught)) if (SPECIES[sp]) { const r = this.dexRec(sp); r.n = Math.max(r.n, n); }
    d.dexFilled = true;
    d.dexV = 2;
    this.save();
  },
  // ---------------------------------------------------------- Survidex records
  // For each species, only what you've done: how many you've had (and how: caught, hatched, bred,
  // evolved), the smallest and biggest, the highest level, when you first had one, where you caught
  // them and where you've seen them.
  // min/max: shortest and tallest (height factor sz); minW/maxW: lightest and heaviest (weight factor);
  // medals: see systems/achievements.js
  dexRec(sp) { return (this.data.dex[sp] ||= { n: 0, how: {}, first: 0, min: null, max: null, minW: null, maxW: null, maxLv: 0, where: {}, seenIn: {}, medals: {} }); },
  news: [], // medals just won, for the game to announce
  noteSize(r, m) {
    const wf = weightOf(m);
    if (r.min == null || m.sz < r.min) r.min = m.sz;
    if (r.max == null || m.sz > r.max) r.max = m.sz;
    if (r.minW == null || wf < r.minW) r.minW = wf;
    if (r.maxW == null || wf > r.maxW) r.maxW = wf;
    r.maxLv = Math.max(r.maxLv, m.level);
    const med = (r.medals ||= {});
    const win = (k) => { if (!med[k]) { med[k] = Date.now(); this.news.push({ medal: k, species: m.species }); } };
    if (m.sz >= H95) win('giant');
    if (m.sz <= H5) win('mini');
    if (wf >= W95) win('heavy');
    if (wf <= W5) win('feather');
    if (m.skills.some((k) => k.k === 'u' && k.t === 4)) win('star');
    if (m.level >= MAX_PET_LEVEL) win('master');
  },
  note(m, how, where) {
    const r = this.dexRec(m.species);
    r.n++;
    r.how[how] = (r.how[how] || 0) + 1;
    if (!r.first) r.first = Date.now();
    if (where) r.where[where] = (r.where[where] || 0) + 1;
    this.noteSize(r, m);
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

  // where: the zone a wild one was caught in; sz: its size (rolled if not given)
  add(species, { skills = rollSkills(species), joinTeam = true, origin = 'wild', level = 1, where = null, sz = rollSize(), wz = rollBuild() } = {}) {
    const mon = { id: this.data.nextId++, species, level, xp: 0, hp: 1, skills, caughtAt: Date.now(), origin, sz, wz };
    this.note(mon, origin === 'bred' ? 'bred' : origin === 'wild' ? 'wild' : 'egg', where);
    this.data.mons.push(mon);
    this.data.caught[species] = (this.data.caught[species] || 0) + 1;
    this.data.seen[species] = true;
    if (SPECIES[species].stage > 1) this.data.discovered[species] = true;
    if (joinTeam && this.data.team.length < this.teamSize()) this.data.team.push(mon.id);
    this.save();
    return mon;
  },
  // Give a survivalmon its own name (an empty name, or its species' name, takes it away again)
  rename(id, name) {
    const m = this.get(id);
    if (!m) return;
    const n = cleanName(name);
    if (n && n !== SPECIES[m.species].name) m.nick = n; else delete m.nick;
    this.save();
  },
  remove(id) {
    this.data.mons = this.data.mons.filter((m) => m.id !== id);
    this.data.team = this.data.team.filter((x) => x !== id);
    this.data.training = this.data.training.filter((t) => t.id !== id);
  },
  // A wild survivalmon turned up (zone: where)
  markSeen(species, zone) {
    if (!SPECIES[species]) return;
    if (!this.data.seen[species]) { this.data.seen[species] = true; this.dirty = true; }
    if (zone) { const r = this.dexRec(species); if (!r.seenIn[zone]) { r.seenIn[zone] = true; this.dirty = true; } }
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
    if (levels.length) this.noteSize(this.dexRec(mon.species), mon); // its highest level, and maybe the Master medal
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
  // hatchedNew: ids of the hatched ones that are a species you never had before (for a "New!" badge)
  hatchReady() {
    const out = [];
    this.hatchedNew = new Set();
    this.data.eggs = this.data.eggs.filter((e) => {
      if (e.progress < e.need) return true;
      const fresh = !this.known(e.species);
      const mon = this.add(e.species, { skills: e.skills, origin: e.kind === 'bred' ? 'bred' : 'egg', ...(e.sz ? { sz: e.sz } : {}) });
      if (e.kind === 'bred') this.data.discovered[e.species] = true;
      if (fresh) this.hatchedNew.add(mon.id);
      out.push(mon);
      return false;
    });
    if (out.length) { this.data.firstHatch = true; this.save(); }
    return out;
  },

  // ---------------------------------------------------------- breeding
  // Both parents are used up. Each passes one of its skills at random (keeping its tier); the
  // breed's own skill rolls a fresh tier, helped by its parents' own skill tiers.
  // What two parents could give, for the preview before breeding (same rules as breed below): the
  // species, its own attack's tier odds (%), and every skill pair it can inherit with its chance (%).
  breedPreview(aId, bId, odds = BASE_ODDS) {
    const a = this.get(aId), b = this.get(bId);
    const species = a && b && aId !== bId ? breedResult(a.species, b.species) : null;
    if (!species) return null;
    const own = tierOdds(odds, ((a.skills[0].t + b.skills[0].t) / 2) * 12);
    const combos = new Map(), p = 100 / (a.skills.length * b.skills.length);
    for (const ia of a.skills) for (const ib of b.skills) {
      let skills = sameSkill(ia, ib) ? [{ ...ia, t: Math.min(4, Math.max(ia.t, ib.t) + 1) }] : [ia, ib];
      skills = skills.filter((s) => !(s.k === 'u' && s.sp === species));
      const key = skills.map((s) => `${s.k}:${s.sp || s.id}:${s.t}`).sort().join('|');
      const c = combos.get(key);
      if (c) c.p += p; else combos.set(key, { skills, p });
    }
    return { species, own, combos: [...combos.values()].sort((x, y) => y.p - x.p) };
  },
  breed(aId, bId, odds = BASE_ODDS) {
    const a = this.get(aId), b = this.get(bId);
    // only the 10 species breed (two different survivalmons, either of the same species or of two)
    const species = a && b && aId !== bId && SPECIES[a.species].stage === 1 && SPECIES[b.species].stage === 1 ? breedResult(a.species, b.species) : null;
    const sz = rollSize(((a?.sz || 1) + (b?.sz || 1)) / 2); // big parents, bigger babies
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
    this.data.eggs.push({ species, skills, need: BRED_HATCH, progress: 0, kind: 'bred', sz });
    this.save();
    return species;
  },

  // ---------------------------------------------------------- evolving
  // Every breed evolves at Lv 30 and again at Lv 55, each time with a stone of its type (a mixed breed and
  // its evolutions: a stone of either parent's type). The 10 species never evolve.
  evoInfo(mon) {
    const sp = SPECIES[mon.species];
    if (!sp?.evo) return null;
    const items = [...new Set(sp.types.map((t) => STONE_OF[t]))];
    const have = items.find((s) => this.itemCount(s) > 0), level = evoLevel(sp);
    return { into: sp.evo, items, item: have || items[0], level, hasItem: !!have, levelOk: mon.level >= level };
  },
  canEvolve(mon) { const e = this.evoInfo(mon); return !!e && e.hasItem && e.levelOk; },
  evolve(mon) {
    const e = this.evoInfo(mon);
    if (!e || !e.hasItem || !e.levelOk) return false;
    this.data.bag[e.item]--;
    mon.species = e.into;
    mon.skills[0] = { k: 'u', sp: e.into, t: Math.min(4, mon.skills[0].t + 1) };
    this.note(mon, 'evolved'); // it keeps its size: a big one grows into a big evolution
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
    const sp = SPECIES[mon.species], each = [0, 2, 3, 5, 7][sp.stage] + Math.floor(mon.level / 3);
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
  upCost(line) { const L = this.upLevel(line); return L >= SPECIES_UP_MAX ? null : 4 + L * 3; },
  // +8% damage and HP a level up to Lv 20, then +3% a level up to Lv 100
  upBonus(line) { const L = this.upLevel(line); return 0.08 * Math.min(L, 20) + 0.03 * Math.max(0, L - 20); },
  buyUpgrade(line) {
    const c = this.upCost(line);
    if (c === null || this.speciesCoins(line) < c) return false;
    this.data.coins[line] -= c;
    this.data.upgrades[line] = this.upLevel(line) + 1;
    this.save();
    return true;
  },
  // The species upgrades of what a survivalmon is made of, as damage and HP (averaged for mixes)
  speciesMul(species) {
    const ls = SPECIES[species].lines;
    return 1 + ls.reduce((s, l) => s + this.upBonus(l), 0) / ls.length;
  },
  // Feeding species coins: each coin of its own kind (a mix: either parent's) gives 1% of the EXP its
  // current level needs, so 100 coins are a level at any level. Takes from the kind you have most of.
  // Returns the levels gained.
  feedCoins(mon, coins) {
    const ls = [...new Set(SPECIES[mon.species].lines)];
    let left = coins, levels = [];
    while (left > 0 && mon.level < MAX_PET_LEVEL) {
      const line = ls.reduce((a, b) => (this.speciesCoins(b) > this.speciesCoins(a) ? b : a));
      if (this.speciesCoins(line) <= 0) break;
      this.data.coins[line]--; left--;
      levels = levels.concat(this.addXp(mon, petXpFor(mon.level) / 100));
    }
    this.save();
    return levels;
  },
  feedCoinsHave(mon) { return [...new Set(SPECIES[mon.species].lines)].reduce((s, l) => s + this.speciesCoins(l), 0); },

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
