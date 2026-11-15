// Loot tables, level-up card rolls and item descriptions.
import { WEAPONS, WEAPON_IDS } from '../content/weapons.js';
import { SPELLS, SPELL_IDS } from '../content/spells.js';
import { ARTIFACTS, ARTIFACT_IDS, COMBOS } from '../content/artifacts.js';
import { SPECIES, STONES, STONE_OF } from '../content/species.js';
import { UPGRADES, RARITIES } from '../content/heroes.js';
import { weightedChoice, randInt, chance, shuffle } from '../core/util.js';
import { SLOTS } from '../entities/player.js';

export const CAT_DEFS = { weapon: WEAPONS, spell: SPELLS, artifact: ARTIFACTS };
const CAT_IDS = { weapon: WEAPON_IDS, spell: SPELL_IDS, artifact: ARTIFACT_IDS };
export const CAT_LABEL = { weapon: 'Weapon', spell: 'Spell', artifact: 'Artifact', egg: 'Egg', pet: 'Pet' };

export function itemDef(cat, id) { return CAT_DEFS[cat]?.[id]; }

// Roll one item the player could use. exclude: Set of "cat:id" already offered.
export function rollItem(P, { cat, levels = 1, exclude = new Set(), allowEgg = true } = {}) {
  const cats = cat ? [cat] : ['weapon', 'spell', 'artifact', 'egg'];
  const cw = { weapon: 32, spell: 24, artifact: 36, egg: allowEgg ? 3 : 0 };
  for (let tries = 0; tries < 12; tries++) {
    const c = cats.length === 1 ? cats[0] : weightedChoice(cats.map((k) => ({ k, weight: cw[k] }))).k;
    if (c === 'egg') return { cat: 'egg', id: 'egg', levels: 1 };
    const pool = CAT_IDS[c].filter((id) => {
      if (exclude.has(`${c}:${id}`)) return false;
      const owned = P.find(c, id);
      return !owned || owned.level < CAT_DEFS[c][id].max;
    }).map((id) => {
      const owned = P.find(c, id);
      // favour upgrades of owned items a little, and new items when slots are open
      const full = P.list(c).length >= SLOTS[c];
      return { id, weight: owned ? 1.4 : full ? 0.5 : 1 };
    });
    if (pool.length) return { cat: c, id: weightedChoice(pool).id, levels };
  }
  return null;
}

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
  const mats = (n, kinds = ['wood', 'stone', 'clay']) => {
    const m = {};
    for (let i = 0; i < n; i++) { const k = kinds[(Math.random() * kinds.length) | 0]; m[k] = (m[k] || 0) + 1; }
    out.drops.push({ kind: 'mats', value: m });
  };
  switch (c.type) {
    case 'chest':
      if (c.tier === 'gold') {
        coins(15, 30); berries(2, 3); mats(6, ['wood', 'stone', 'clay', 'iron']);
        if (chance(0.35 * luck)) gear();
        if (chance(0.25 * luck)) stone();
        if (chance(0.1 * luck)) egg();
      } else if (c.tier === 'silver') {
        coins(8, 16); berries(1, 2);
        if (chance(0.5)) mats(4, ['wood', 'stone', 'clay', 'iron']);
        if (chance(0.12 * luck)) gear();
        if (chance(0.08 * luck)) stone();
        if (chance(0.05 * luck)) egg();
      } else {
        coins(4, 10);
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
    case 'pot':
      if (chance(0.6)) coins(1, 6);
      else if (chance(0.4)) heart();
      else out.text = 'Just dust...';
      if (chance(0.15)) berries(1, 1);
      break;
  }
  return out;
}

// Pick an evolution stone, leaning toward ones the team's mixed breeds can use.
export function rollStone(P) {
  const wanted = (P?.pets || []).filter((p) => p.sp.kind === 'mixed').flatMap((p) => p.sp.types.map((t) => STONE_OF[t]));
  if (wanted.length && chance(0.6)) return wanted[(Math.random() * wanted.length) | 0];
  const all = [...new Set(Object.values(STONE_OF))];
  return all[(Math.random() * all.length) | 0];
}

// Hero cards: plain stat boosts for this run (pet power, luck and the old spell stats are gone)
const HERO_CARDS = UPGRADES.filter((u) => !['luck', 'velocity', 'endurance', 'bond'].includes(u.id));
const pct = (v) => `${Math.round(v * 100)}%`;
// Survivalmon cards: boosts for the whole team for this run
export const TEAM_CARDS = [
  { id: 't_power', name: 'Team Power', icon: 'fang', base: 0.12, key: 'dmg', w: 10, fmt: (v) => `Your survivalmons deal +${pct(v)} damage` },
  { id: 't_haste', name: 'Team Haste', icon: 'hourglass', base: 0.08, key: 'haste', w: 8, cap: 0.5, fmt: (v) => `Your survivalmons attack ${pct(v)} faster` },
  { id: 't_guard', name: 'Team Guard', icon: 'shell', base: 0.08, key: 'def', w: 7, cap: 0.6, fmt: (v) => `Your survivalmons take ${pct(v)} less damage` },
  { id: 't_vigor', name: 'Team Vigor', icon: 'heart', base: 0.15, key: 'hp', w: 7, fmt: (v) => `Your survivalmons get +${pct(v)} max HP` },
  { id: 't_focus', name: 'Team Focus', icon: 'clover', base: 0.05, key: 'crit', w: 5, cap: 0.5, fmt: (v) => `Your survivalmons get +${pct(v)} crit chance` },
  { id: 't_heal', name: 'Second Breath', icon: 'heart', w: 6, noRarity: true, fmt: () => 'Heal your survivalmons fully. Fainted ones get back up.' },
];
const hurtTeam = (P) => P.pets.some((p) => p.fainted || p.hp < p.maxHp * 0.6);

function heroCard(used) {
  const pool = HERO_CARDS.filter((u) => !used.has(u.id) && !(u.cap !== undefined && (used.P.bonus[u.key] || 0) >= u.cap));
  const u = weightedChoice(pool, (x) => x.w);
  if (!u) return null;
  used.add(u.id);
  const rar = u.noRarity ? RARITIES[0] : weightedChoice(RARITIES, (r) => r.w * (r.id === 'common' ? 1 : used.P.stats.luck));
  const v = u.round ? Math.max(1, Math.round(u.base * rar.mult)) : +(u.base * rar.mult).toFixed(3);
  return { kind: 'stat', up: u, rarity: rar, value: v };
}
function monCard(used) {
  const P = used.P, g = P.g;
  // sometimes: one of your survivalmon's skills goes up a tier for this run
  const boostable = P.pets.filter((p) => !p.fainted).flatMap((p) => p.mon.skills.filter((s) => p.tierOf(s) < 4).map((s) => ({ pet: p, skill: s })));
  if (boostable.length && !used.has('skill') && chance(0.35)) {
    used.add('skill');
    const { pet, skill } = boostable[(Math.random() * boostable.length) | 0];
    return { kind: 'skill', pet, skill, from: pet.tierOf(skill) };
  }
  const pool = TEAM_CARDS.filter((u) => !used.has(u.id) && (u.id !== 't_heal' || hurtTeam(P)) && !(u.cap !== undefined && (g.team?.[u.key] || 0) >= u.cap));
  const u = weightedChoice(pool, (x) => x.w);
  if (!u) return null;
  used.add(u.id);
  const rar = u.noRarity ? RARITIES[0] : weightedChoice(RARITIES, (r) => r.w * (r.id === 'common' ? 1 : P.stats.luck));
  return { kind: 'team', up: u, rarity: rar, value: u.base ? +(u.base * rar.mult).toFixed(3) : 0 };
}

// Three level-up cards: sometimes a training card for one of your hero's weapons, one or two cards
// for your survivalmons (when you have any), and hero stat cards for the rest.
export function levelUpOptions(P) {
  const picks = [];
  const used = new Set();
  used.P = P;
  const trainable = P.weapons.filter((w) => w.level < WEAPONS[w.id].max);
  if (trainable.length && chance(0.4)) picks.push({ kind: 'train', cat: 'weapon', id: trainable[(Math.random() * trainable.length) | 0].id });
  let mons = P.pets.length ? (chance(0.5) ? 2 : 1) : 0;
  while (mons-- > 0 && picks.length < 3) { const c = monCard(used); if (c) picks.push(c); }
  while (picks.length < 3) { const c = heroCard(used); if (!c) break; picks.push(c); }
  return shuffle(picks);
}

export function applyLevelCard(P, card) {
  const g = P.g;
  if (card.kind === 'train') { P.addItem(card.cat, card.id, 1); return; }
  if (card.kind === 'skill') {
    card.pet.boost.set(card.skill, (card.pet.boost.get(card.skill) || 0) + 1);
    card.pet.refresh();
    P.recompute(); g.applyTeamPassives?.();
    return;
  }
  if (card.kind === 'team') {
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

// Human readable stat changes between two levels of a weapon/spell
export function levelDiff(cat, id, from, to) {
  const def = CAT_DEFS[cat][id];
  if (cat === 'artifact') return def.desc(to);
  const a = from ? def.stats(from) : null, b = def.stats(to);
  const parts = [];
  for (const [k, label] of Object.entries(def.labels)) {
    if (!a) parts.push(`${label} ${fmt(k, b[k])}`);
    else if (a[k] !== b[k]) parts.push(`${label} ${fmt(k, a[k])} → ${fmt(k, b[k])}`);
  }
  return parts.join(' · ');
}
function fmt(k, v) {
  if (k === 'cd' || k === 'tick') return `${v}s`;
  if (k === 'heal') return `${Math.round(v * 100)}%`;
  return `${v}`;
}

export function combosForItem(P, id) {
  return COMBOS.filter((c) => c.pieces.includes(id)).map((c) => {
    const others = c.pieces.filter((p) => p !== id);
    const names = others.map((p) => (p === 'pet:any' ? 'any pet' : nameOf(p)));
    const done = c.pieces.every((p) => (p === 'pet:any' ? P.pets.length > 0 : p === id || P.has(p)));
    return { combo: c, names, done };
  });
}
export function nameOf(id) {
  return WEAPONS[id]?.name || SPELLS[id]?.name || ARTIFACTS[id]?.name || SPECIES[id]?.name || id;
}
export function iconOf(cat, id) {
  if (cat === 'egg') return 'egg';
  return CAT_DEFS[cat]?.[id]?.icon || id;
}
