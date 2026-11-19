// Loot tables, level-up card rolls and item descriptions.
import { WEAPONS } from '../content/weapons.js';
import { SPECIES, STONES, STONE_OF, ATK_TYPES, ATK_TYPE_IDS } from '../content/species.js';
import { UPGRADES, RARITIES } from '../content/heroes.js';
import { weightedChoice, randInt, chance, shuffle } from '../core/util.js';
import { nextCard, evolveChoices, MAX_WLV } from '../content/evolve.js';

export const CAT_DEFS = { weapon: WEAPONS };
export const CAT_LABEL = { weapon: 'Weapon', egg: 'Egg', pet: 'Pet' };
export function itemDef(cat, id) { return CAT_DEFS[cat]?.[id]; }

// What a container gives: coins, EXP, hearts, berries (survivalmon EXP), materials, eggs,
// evolution stones and gear. Returns { items: [], drops: [{ kind, value }], text }.
// (Weapons, spells and artifacts no longer come from containers: runs are about your survivalmons.)
export function rollContainer(P, c) {
  const luck = P.stats.luck;
  const out = { items: [], drops: [], text: '' };
  const coins = (a, b) => out.drops.push({ kind: 'coin', value: randInt(a, b) });
  const xp = (a, b) => out.drops.push({ kind: 'xp', value: randInt(a, b) });
  const heart = () => out.drops.push({ kind: 'heart', value: 1 });
  const berries = (a, b) => out.drops.push({ kind: 'berry', value: randInt(a, b) });
  const stone = () => out.drops.push({ kind: 'stone', value: rollStone(P) });
  const egg = () => out.drops.push({ kind: 'egg', value: 1 });
  const gear = () => out.drops.push({ kind: 'gear', value: 1 });
  const card = () => out.drops.push({ kind: 'card', value: 1 }); // a bonus level-up pick
  const mats = (n, kinds = ['wood', 'stone', 'clay']) => {
    const m = {};
    for (let i = 0; i < n; i++) { const k = kinds[(Math.random() * kinds.length) | 0]; m[k] = (m[k] || 0) + 1; }
    out.drops.push({ kind: 'mats', value: m });
  };
  switch (c.type) {
    case 'chest':
      if (c.tier === 'gold') {
        coins(15, 30); berries(2, 3); mats(6, ['wood', 'stone', 'clay', 'iron']); card();
        if (chance(0.35 * luck)) gear();
        if (chance(0.25 * luck)) stone();
        if (chance(0.1 * luck)) egg();
      } else if (c.tier === 'silver') {
        coins(8, 16); berries(1, 2);
        if (chance(0.5)) card();
        if (chance(0.5)) mats(4, ['wood', 'stone', 'clay', 'iron']);
        if (chance(0.12 * luck)) gear();
        if (chance(0.08 * luck)) stone();
        if (chance(0.05 * luck)) egg();
      } else {
        coins(4, 10);
        if (chance(0.25)) card();
        if (chance(0.4)) berries(1, 2);
        if (chance(0.25)) mats(2);
        if (chance(0.05 * luck)) gear();
      }
      break;
    case 'altar':
      if (chance(0.3 * luck)) gear();
      if (chance(0.35 * luck)) stone();
      if (chance(0.15 * luck)) egg();
      if (!out.drops.length) { berries(3, 4); xp(20, 40); out.text = 'The altar hums. Your survivalmons feel stronger.'; }
      if (chance(0.5)) card();
      break;
    case 'bookshelf':
      xp(10, 25);
      if (chance(0.25)) { berries(1, 2); out.text = 'You read a field guide to survivalmons. (+EXP)'; } else out.text = 'You skim an old tome. (+EXP)';
      break;
    case 'cupboard':
      if (chance(0.4)) { heart(); coins(3, 8); } else coins(5, 14);
      if (chance(0.25)) berries(1, 2);
      if (chance(0.15)) mats(2, ['clay']);
      break;
    case 'crate': case 'barrel':
      if (chance(0.45)) coins(3, 10);
      else if (chance(0.4)) heart();
      else xp(5, 15);
      if (chance(0.25)) berries(1, 2);
      if (chance(0.2)) mats(2, ['wood']);
      break;
    case 'gold': {
      // a basement's treasure: a big heap pays the most
      const [lo, hi] = { big: [45, 70], mid: [30, 45], small: [18, 28] }[c.size] || [25, 40];
      coins(lo, hi);
      if (c.size === 'big' && chance(0.3)) coins(10, 20);
      break;
    }
    case 'pot':
      if (chance(0.6)) coins(1, 6);
      else if (chance(0.4)) heart();
      else out.text = 'Just dust...';
      if (chance(0.15)) berries(1, 1);
      break;
  }
  return out;
}

// Pick an evolution stone, leaning toward ones the team's survivalmons that can still evolve will need.
export function rollStone(P) {
  const wanted = (P?.pets || []).filter((p) => p.sp.evo).flatMap((p) => p.sp.types.map((t) => STONE_OF[t]));
  if (wanted.length && chance(0.6)) return wanted[(Math.random() * wanted.length) | 0];
  const all = [...new Set(Object.values(STONE_OF))];
  return all[(Math.random() * all.length) | 0];
}

// Hero cards on a level-up: seven plain stats. Move speed, pickup range and EXP gain only come from
// chests inside buildings (CHEST_CARDS); multishot and area are gone (the weapon evolves add those).
const HERO_IDS = ['vitality', 'regen', 'power', 'armor', 'haste', 'precision', 'ferocity'];
const HERO_CARDS = UPGRADES.filter((u) => HERO_IDS.includes(u.id));
export const CHEST_CARDS = UPGRADES.filter((u) => ['swift', 'magnet', 'wisdom'].includes(u.id));
// the weapon card: 40% of hero level-ups show one (never more than one), until the weapon is maxed
export const WEAPON_CARD_CHANCE = 0.4;
const pct = (v) => `${Math.round(v * 100)}%`;
// Survivalmon cards: boosts for the whole team for this run
export const TEAM_CARDS = [
  { id: 't_power', name: 'Team Power', icon: 'team_power', base: 0.10, key: 'dmg', w: 10, atk: 'all', fmt: (v) => `Your survivalmons deal +${pct(v)} damage` },
  { id: 't_haste', name: 'Team Haste', icon: 'team_haste', base: 0.07, key: 'haste', w: 8, cap: 0.4, atk: 'all', fmt: (v) => `Your survivalmons attack ${pct(v)} faster` },
  { id: 't_guard', name: 'Team Guard', icon: 'team_guard', base: 0.06, key: 'def', w: 7, cap: 0.5, fmt: (v) => `Your survivalmons take ${pct(v)} less damage` },
  { id: 't_vigor', name: 'Team Vigor', icon: 'team_vigor', base: 0.12, key: 'hp', w: 7, fmt: (v) => `Your survivalmons get +${pct(v)} max HP` },
  { id: 't_focus', name: 'Team Focus', icon: 'team_focus', base: 0.04, key: 'crit', w: 5, cap: 0.4, atk: 'all', fmt: (v) => `Your survivalmons get +${pct(v)} crit chance` },
  { id: 't_heal', name: 'Second Breath', icon: 'team_heal', w: 6, noRarity: true, fmt: () => 'Heal your survivalmons fully. Fainted ones get back up.' },
];
// Attack type cards: more damage for one attack type, plus that type's perk (see ATK_TYPES and
// typedUp in pet.js). Only offered for types someone on the team has; up to 4 of each per run.
const TYPE_NAMES = { shot: 'Sharp Shots', chain: 'Chain Surge', area: 'Wide Blast', charge: 'Stampede', support: 'Kind Hearts' };
export const TYPE_CARDS = ATK_TYPE_IDS.map((t) => ({
  id: `t_${t}`, name: TYPE_NAMES[t], icon: ATK_TYPES[t].icon, base: 0.15, atk: t, w: 7,
  fmt: (v) => `${ATK_TYPES[t].name} attacks: +${pct(v)} damage, ${ATK_TYPES[t].perk}`,
}));
const TYPE_MAX = 4;
const teamTypes = (P) => new Set(P.pets.filter((p) => !p.fainted).flatMap((p) => p.attacks.map((a) => a.type)));

// Rare and epic cards come more often with luck, and much more often in a chest's bonus pick.
const rollRarity = (used) => weightedChoice(RARITIES, (r) => r.w * (r.id === 'common' ? (used.lucky ? 0.3 : 1) : used.P.stats.luck));
const hurtTeam = (P) => P.pets.some((p) => p.fainted || p.hp < p.maxHp * 0.6);

function heroCard(used, list = HERO_CARDS) {
  const pool = list.filter((u) => !used.has(u.id) && !(u.cap !== undefined && (used.P.bonus[u.key] || 0) >= u.cap));
  const u = weightedChoice(pool, (x) => x.w);
  if (!u) return null;
  used.add(u.id);
  const rar = u.noRarity ? RARITIES[0] : rollRarity(used);
  const v = u.round ? Math.max(1, Math.round(u.base * rar.mult)) : +(u.base * rar.mult).toFixed(3);
  return { kind: 'stat', up: u, rarity: rar, value: v };
}
function monCard(used) {
  const P = used.P, g = P.g;
  const types = teamTypes(P);
  const pool = TEAM_CARDS.filter((u) => !used.has(u.id) && (u.id !== 't_heal' || hurtTeam(P)) && !(u.cap !== undefined && (g.team?.[u.key] || 0) >= u.cap))
    .concat(TYPE_CARDS.filter((u) => !used.has(u.id) && types.has(u.atk) && (g.typeUp?.[u.atk]?.n || 0) < TYPE_MAX));
  const u = weightedChoice(pool, (x) => x.w);
  if (!u) return null;
  used.add(u.id);
  const rar = u.noRarity ? RARITIES[0] : rollRarity(used);
  return { kind: 'team', up: u, rarity: rar, value: u.base ? +(u.base * rar.mult).toFixed(3) : 0 };
}

// Skill-up cards: a survivalmon's skill goes up one grade (D, C, B, A, S) for this run. They only
// come when you beat a boss, and each skill can go up just once per run.
export function skillCards(P, n = 3) {
  const boostable = P.pets.filter((p) => !p.fainted).flatMap((p) => p.mon.skills
    .filter((s) => p.tierOf(s) < 4 && !p.boost.get(s)).map((s) => ({ pet: p, skill: s })));
  // spread the choice over different survivalmons first
  const picks = [], byPet = new Map();
  for (const b of shuffle(boostable)) { if (!byPet.has(b.pet)) byPet.set(b.pet, []); byPet.get(b.pet).push(b); }
  while (picks.length < n && byPet.size) {
    for (const [pet, list] of byPet) {
      if (picks.length >= n) break;
      picks.push(list.shift());
      if (!list.length) byPet.delete(pet);
    }
  }
  return picks.map(({ pet, skill }) => ({ kind: 'skill', pet, skill, from: pet.tierOf(skill) }));
}


// Three cards of one kind:
//   hero:   hero stat cards, and 40% of the time one weapon card (a step, or "Evolve the weapon")
//   team:   survivalmon cards (from the berry bar: team boosts, attack types, a heal when someone's hurt)
//   bonus:  (chests from elites and bosses) one hero card, one team card, one of either, at better rarity
//   house:  (chests inside buildings) one of the chest-only cards (move speed, pickup range, EXP gain),
//           a hero card and a team card (or another hero card), at better rarity
//   skill:  (from bosses) up to three of your survivalmons' skills, one grade up each
//   evolve: the evolve choices once you took an "Evolve the weapon" card (2 of 3, or 3 of 5 elements)
export function levelUpOptions(P, kind = 'hero') {
  if (kind === 'skill') { const s = skillCards(P); if (s.length) return s; kind = 'bonus'; }
  if (kind === 'evolve') {
    const w = P.main, tier = P.g.evolveTier || 1;
    return evolveChoices(w, tier).map((o) => ({ kind: 'wpath', w, tier, ...o }));
  }
  const picks = [];
  const used = new Set();
  used.P = P;
  used.lucky = kind === 'bonus' || kind === 'house';
  const add = (c) => { if (c) picks.push(c); };
  if (kind === 'team' && P.pets.length) {
    for (let i = 0; i < 6 && picks.length < 3; i++) add(monCard(used));
  } else if (kind === 'bonus') {
    add(heroCard(used));
    if (P.pets.length) add(monCard(used));
    add(P.pets.length && chance(0.5) ? monCard(used) : heroCard(used));
  } else if (kind === 'house') {
    add(heroCard(used, CHEST_CARDS));
    add(heroCard(used));
    add(P.pets.length ? monCard(used) : heroCard(used));
  } else if (P.main && P.main.level < MAX_WLV && chance(WEAPON_CARD_CHANCE)) {
    add({ kind: 'wcard', w: P.main, next: nextCard(P.main) });
  }
  while (picks.length < 3) { const c = heroCard(used); if (!c) break; picks.push(c); }
  return shuffle(picks);
}

export function applyLevelCard(P, card) {
  const g = P.g;
  if (card.kind === 'wcard') {
    // "Evolve the weapon" opens the evolve choice next (Game.openLevelUp('evolve')); a step just levels it
    if (card.next.evolve) { g.evolveTier = card.next.evolve; P.evolvePicks = (P.evolvePicks || 0) + 1; }
    else card.w.level = card.next.to;
    return;
  }
  if (card.kind === 'wpath') {
    const w = card.w;
    w.path[card.tier - 1] = card.key;
    w.level = [4, 8, 12][card.tier - 1];
    g.feed(`${card.name}!`, '#ffd84a');
    return;
  }
  if (card.kind === 'skill') {
    card.pet.boost.set(card.skill, (card.pet.boost.get(card.skill) || 0) + 1);
    card.pet.refresh();
    P.recompute(); g.applyTeamPassives?.();
    return;
  }
  if (card.kind === 'team') {
    if (card.up.atk && card.up.atk !== 'all') {
      const u = g.typeUp[card.up.atk];
      u.dmg += card.value; u.n++;
      for (const p of P.pets) p.refresh();
      return;
    }
    if (card.up.id === 't_heal') {
      for (const p of P.pets) { p.fainted = false; p.hp = p.maxHp; }
      P.recompute(); g.applyTeamPassives?.();
      return;
    }
    g.team[card.up.key] = (g.team[card.up.key] || 0) + card.value;
    if (card.up.key === 'hp') for (const p of P.pets) p.refresh();
    return;
  }
  const k = card.up.key;
  P.bonus[k] = (P.bonus[k] || 0) + card.value;
  if (k === 'maxHp') P.hp += card.value;
  P.recompute();
}

// The old plain weapons (the off-hand weapon from gear): stat rows between two levels
export function levelRows(cat, id, from, to) {
  const def = CAT_DEFS[cat][id];
  const a = from ? def.stats(from) : null, b = def.stats(to);
  const rows = [];
  for (const [k, label] of Object.entries(def.labels)) {
    if (!a) rows.push([label, '', fmt(k, b[k])]);
    else if (a[k] !== b[k]) rows.push([label, fmt(k, a[k]), fmt(k, b[k])]);
  }
  return rows;
}
function fmt(k, v) {
  if (k === 'cd' || k === 'tick') return `${v}s`;
  if (k === 'heal') return `${Math.round(v * 100)}%`;
  return `${v}`;
}
export function nameOf(id) {
  return WEAPONS[id]?.name || SPECIES[id]?.name || id;
}
export function iconOf(cat, id) {
  if (cat === 'egg') return 'egg';
  return CAT_DEFS[cat]?.[id]?.icon || id;
}
