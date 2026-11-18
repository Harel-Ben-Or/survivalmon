// Main weapons: 12 levels with three evolves (see the "Survivalmon Weapons and Levels" doc).
// Levels 2-3 are small steps; a weapon card at level 3 says "Evolve the weapon" and opens a choice
// of 2 of 3 first evolves (level 4); levels 5-7 are that evolve's steps; level 8 is a second evolve
// (2 of the 3 that follow the first); levels 9-11 are its steps; level 12 is an element (3 of 5),
// which works on every hit and turns the second evolve into a final form.
//
// A tree: { name, icon, base: stats, steps: {2, 3}, r1: { key: Evolve } }
//   Evolve: { name, desc, apply(s), steps: { L: { text, apply(s) } }, r2 | finals }
// The element is the third path entry; finals[el] names the final form.
import { ELEMENTS, ELEMENT_IDS, pick } from './wcore.js';
import { BOW } from './trees/bow.js';
import { BOOMERANG } from './trees/boomerang.js';
import { SPEAR } from './trees/spear.js';
import { WAND } from './trees/wand.js';
import { SLING } from './trees/sling.js';

export { ELEMENTS, ELEMENT_IDS };
export const MAX_WLV = 12;
export const EVOLVE_LV = [4, 8, 12];

export const TREES = { bow: BOW, boomerang: BOOMERANG, pitchfork: SPEAR, emberwand: WAND, sling: SLING };

// ------------------------------------------------------------ the engine
// The step (or evolve) that level L gives this weapon, along its path
function stepAt(T, w, L) {
  if (L < 4) return T.steps[L];
  const R1 = T.r1[w.path[0]];
  if (!R1) return null;
  if (L === 4) return R1;
  if (L < 8) return R1.steps[L];
  const R2 = R1.r2?.[w.path[1]];
  if (!R2) return null;
  if (L === 8) return R2;
  if (L < 12) return R2.steps[L];
  return null;
}
export function hasTree(id) { return !!TREES[id]; }
// The weapon's stats at its level and path (cached on the weapon until it changes)
export function wStats(w) {
  if (w.st && w.stKey === `${w.level}|${w.path.join(',')}`) return w.st;
  const T = TREES[w.id];
  const s = { critAdd: 0, critMultAdd: 0, ...T.base };
  for (let L = 2; L <= w.level; L++) stepAt(T, w, L)?.apply?.(s);
  s.r1 = w.path[0]; s.r2 = w.path[1]; s.el = w.level >= 12 ? w.path[2] : null;
  w.st = s; w.stKey = `${w.level}|${w.path.join(',')}`;
  return s;
}
// What the next weapon card says: { evolve: tier } or { text }
export function nextCard(w) {
  const L = w.level + 1;
  if (L > MAX_WLV) return null;
  const tier = EVOLVE_LV.indexOf(L);
  if (tier >= 0) return { evolve: tier + 1, to: L };
  return { text: stepAt(TREES[w.id], w, L)?.text || 'Stronger', to: L };
}
// The evolve choices for a tier: 2 of 3 (tiers 1, 2) or 3 of 5 elements (tier 3)
export function evolveChoices(w, tier) {
  const T = TREES[w.id];
  if (tier === 1) return pick(Object.keys(T.r1), 2).map((k) => ({ key: k, name: T.r1[k].name, desc: T.r1[k].desc }));
  const R1 = T.r1[w.path[0]];
  if (tier === 2) return pick(Object.keys(R1.r2), 2).map((k) => ({ key: k, name: R1.r2[k].name, desc: R1.r2[k].desc }));
  const R2 = R1.r2[w.path[1]];
  return pick(ELEMENT_IDS, 3).map((k) => ({ key: k, el: k, name: R2.finals[k].name, desc: `${ELEMENTS[k].name}: ${R2.finals[k].desc}` }));
}
// The weapon's name now: its last evolve (or final form), else the weapon's own name
export function wName(w) {
  const T = TREES[w.id];
  if (!T) return null;
  const R1 = T.r1[w.path[0]], R2 = R1?.r2?.[w.path[1]];
  if (w.level >= 12 && R2?.finals?.[w.path[2]]) return R2.finals[w.path[2]].name;
  return R2?.name || R1?.name || T.name;
}
export function wIcon(w) { return TREES[w.id]?.icon || w.id; }
// Fires/ticks a main weapon (called from Player.update)
export function updateMain(g, w, dt) {
  const T = TREES[w.id], st = wStats(w), S = g.player.stats;
  T.tick?.(g, w, st, dt);
  w.cd -= dt;
  if (w.cd <= 0) {
    const r = T.fire(g, w, st);
    w.cd = r === false ? 0.15 : st.cd * S.cooldown;
  }
}
