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

// What a container gives. Returns { items:[...], drops:[{kind,value}], text }
export function rollContainer(P, c) {
  const luck = P.stats.luck;
  const out = { items: [], drops: [], text: '' };
  const coins = (a, b) => out.drops.push({ kind: 'coin', value: randInt(a, b) });
  const xp = (a, b) => out.drops.push({ kind: 'xp', value: randInt(a, b) });
  const heart = () => out.drops.push({ kind: 'heart', value: 1 });
  const item = (o) => { const it = rollItem(P, { ...o, exclude: new Set(out.items.map((i) => `${i.cat}:${i.id}`)) }); if (it) out.items.push(it); };
  switch (c.type) {
    case 'chest':
      if (c.tier === 'gold') { item({ levels: 2 }); item({}); coins(15, 30); }
      else if (c.tier === 'silver') { item({ levels: chance(0.4) ? 2 : 1 }); coins(8, 16); }
      else { item({}); coins(2, 8); }
      break;
    case 'altar':
      item({ cat: chance(0.5) ? 'spell' : 'artifact', levels: 2 });
      if (chance(0.2)) out.items.push({ cat: 'egg', id: 'egg', levels: 1 });
      break;
    case 'bookshelf':
      if (chance(0.35 * luck)) item({ cat: 'spell' });
      else { xp(10, 25); out.text = 'You skim an old tome. (+EXP)'; }
      break;
    case 'cupboard':
      if (chance(0.2 * luck)) item({ cat: 'artifact' });
      else if (chance(0.4)) { heart(); coins(3, 8); }
      else coins(5, 14);
      break;
    case 'crate': case 'barrel':
      if (chance(0.1 * luck)) item({});
      else if (chance(0.45)) coins(3, 10);
      else if (chance(0.4)) heart();
      else xp(5, 15);
      break;
    case 'pot':
      if (chance(0.6)) coins(1, 6);
      else if (chance(0.4)) heart();
      else out.text = 'Just dust...';
      break;
  }
  // Berries and (rarely) evolution stones
  const berries = (a, b) => out.drops.push({ kind: 'berry', value: randInt(a, b) });
  const stoneDrop = () => out.drops.push({ kind: 'stone', value: rollStone(P) });
  switch (c.type) {
    case 'chest':
      if (c.tier === 'gold') { if (chance(0.25 * luck)) stoneDrop(); berries(2, 3); }
      else if (c.tier === 'silver') { if (chance(0.05 * luck)) stoneDrop(); if (chance(0.5)) berries(1, 2); }
      else if (chance(0.4)) berries(1, 2);
      break;
    case 'altar':
      if (chance(0.3 * luck)) stoneDrop();
      break;
    case 'crate': case 'barrel': case 'cupboard':
      if (chance(0.25)) berries(1, 2);
      break;
    case 'pot':
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

// Three level-up cards: mostly stat boosts, sometimes a weapon/spell training card.
export function levelUpOptions(P) {
  const picks = [];
  const used = new Set();
  const capped = (u) => u.cap !== undefined && (P.bonus[u.key] || 0) >= u.cap;
  const pool = UPGRADES.filter((u) => !capped(u) && (!u.needsPet || P.pets.length));
  const trainable = [...P.weapons.map((w) => ['weapon', w]), ...P.spells.map((s) => ['spell', s])]
    .filter(([cat, it]) => it.level < CAT_DEFS[cat][it.id].max);
  if (trainable.length && chance(0.45)) {
    const [cat, it] = trainable[(Math.random() * trainable.length) | 0];
    picks.push({ kind: 'train', cat, id: it.id });
  }
  while (picks.length < 3 && pool.length) {
    const u = weightedChoice(pool.filter((x) => !used.has(x.id)), (x) => x.w);
    if (!u) break;
    used.add(u.id);
    const rar = u.noRarity ? RARITIES[0] : weightedChoice(RARITIES, (r) => r.w * (r.id === 'common' ? 1 : P.stats.luck));
    let v = u.base * rar.mult;
    v = u.round ? Math.max(1, Math.round(v)) : +v.toFixed(3);
    picks.push({ kind: 'stat', up: u, rarity: rar, value: v });
    if (used.size >= pool.length) break;
  }
  return shuffle(picks);
}

export function applyLevelCard(P, card) {
  if (card.kind === 'train') { P.addItem(card.cat, card.id, 1); return; }
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
