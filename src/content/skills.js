// Survivalmon skills. Every survivalmon has its species' unique skill (an attack) and, when caught,
// one random passive skill. Each skill has a tier: D is weakest, S strongest and adds a small twist.
// A skill in a save is { k: 'u', sp: <species id>, t } (that species' attack) or { k: 'p', id, t } (a passive).

export const TIERS = ['D', 'C', 'B', 'A', 'S'];
export const TIER_COLOR = ['#b8b0a8', '#7ad27a', '#6aaaf0', '#c58af0', '#ffd84a'];
export const TIER_POWER = [0.7, 0.85, 1, 1.2, 1.5];
export const BASE_ODDS = [65, 20, 10, 4, 1]; // % for D, C, B, A, S

const pct = (v) => `${Math.round(v * 100)}%`;
export const PASSIVES = {
  swift: { name: 'Swift Strike', vals: [0.08, 0.12, 0.16, 0.2, 0.28], desc: (v) => `Attacks ${pct(v)} faster` },
  hide: { name: 'Thick Hide', vals: [0.1, 0.15, 0.2, 0.25, 0.35], desc: (v) => `Takes ${pct(v)} less damage` },
  vamp: { name: 'Vampire Bite', vals: [0.03, 0.045, 0.06, 0.08, 0.11], desc: (v) => `Heals ${pct(v)} of the damage it deals` },
  cry: { name: 'Battle Cry', vals: [0.04, 0.06, 0.08, 0.1, 0.14], desc: (v) => `The whole team deals ${pct(v)} more damage` },
  wind: { name: 'Second Wind', vals: [0.2, 0.3, 0.4, 0.5, 0.7], desc: (v) => `Gets back up once per run with ${pct(v)} HP` },
  heart: { name: 'Big Heart', vals: [0.1, 0.15, 0.2, 0.25, 0.35], desc: (v) => `${pct(v)} more max HP` },
  claw: { name: 'Sharp Claws', vals: [0.06, 0.09, 0.12, 0.15, 0.22], desc: (v) => `${pct(v)} chance to hit for double damage` },
  nose: { name: 'Gem Nose', vals: [0.05, 0.08, 0.1, 0.13, 0.18], desc: (v) => `${pct(v)} more coins and materials` },
  star: { name: 'Lucky Star', vals: [0.06, 0.09, 0.12, 0.15, 0.22], desc: (v) => `Wild survivalmons appear ${pct(v)} more often` },
};
export const PASSIVE_IDS = Object.keys(PASSIVES);

// Roll a tier from odds (an array of 5 weights). bonus moves that many points from D up to B, A and S.
export function rollTier(odds = BASE_ODDS, bonus = 0) {
  const w = [...odds];
  if (bonus > 0) { const m = Math.min(bonus, w[0]); w[0] -= m; w[2] += m * 0.5; w[3] += m * 0.35; w[4] += m * 0.15; }
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return i; }
  return 0;
}
export const rollPassive = () => PASSIVE_IDS[Math.floor(Math.random() * PASSIVE_IDS.length)];

export const passiveValue = (s) => PASSIVES[s.id].vals[s.t];
export const sameSkill = (a, b) => a.k === b.k && (a.k === 'u' ? a.sp === b.sp : a.id === b.id);
