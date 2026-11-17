// What a level-up card would change, as short "now → after" rows: [label, now, after].
// Shown under each card, e.g. "Crit chance 9% → 13%" or, for a skill, "Hit 21 → 25".
import { SPECIES } from '../content/species.js';
import { TYPE_PERK } from '../entities/pet.js';
import { TIER_POWER, PASSIVES } from '../content/skills.js';
import { armorCut } from '../systems/armor.js';
import { levelRows } from '../systems/loot.js';

const pct = (v) => `${Math.round(v * 100)}%`;
const plus = (v) => `+${Math.round(v * 100)}%`;

// hero stats: how each one reads
const HERO_ROWS = {
  maxHp: ['Max HP', (s) => `${s.maxHp}`],
  might: ['Damage', (s) => pct(s.might)],
  speed: ['Move speed', (s) => pct(s.speed / 64)],
  haste: ['Attack speed', (s) => pct(1 / s.cooldown)],
  area: ['Area', (s) => pct(s.area)],
  amount: ['Projectiles', (s) => `+${s.amount}`],
  crit: ['Crit chance', (s) => pct(s.crit)],
  critMult: ['Crit damage', (s) => pct(s.critMult)],
  regen: ['Regen', (s) => `${+s.regen.toFixed(2)} HP/s`],
  armor: ['Damage taken', (s) => pct(armorCut(s.armor))],
  magnet: ['Pickup range', (s) => pct(s.magnet / 30)],
  growth: ['EXP gain', (s) => pct(s.growth)],
  luck: ['Luck', (s) => pct(s.luck)],
};
// passive skills: [label, how a value reads]
const PASSIVE_ROWS = {
  swift: ['Attack speed', plus], hide: ['Damage taken', (v) => pct(1 - v)], vamp: ['Lifesteal', pct],
  cry: ['Team damage', plus], wind: ['Gets up with', (v) => `${pct(v)} HP`], heart: ['Max HP', plus],
  claw: ['Double hits', pct], nose: ['Coins', plus], star: ['Wild survivalmons', plus],
};
// what an attack skill gains on top at S grade (see tiered() in pet.js)
const S_TWIST = { shooter: '+1 shot', lobber: '+1 shot', zapper: '+2 jumps', roller: 'charges more often', aura: 'wider aura', slam: 'wider slam', support: 'blesses more often' };

export function cardRows(g, c) {
  const P = g.player, S = P.stats;
  if (c.kind === 'train') {
    const cur = P.find(c.cat, c.id);
    return levelRows(c.cat, c.id, cur.level, cur.level + 1);
  }
  if (c.kind === 'skill') {
    const { pet, skill: s, from } = c, to = from + 1;
    if (s.k === 'p') {
      const [label, f] = PASSIVE_ROWS[s.id] || [PASSIVES[s.id].name, pct];
      return [[label, f(PASSIVES[s.id].vals[from]), f(PASSIVES[s.id].vals[to])]];
    }
    const sp = SPECIES[s.sp];
    const hit = (t) => `${Math.max(1, Math.round(sp.q.dmg * TIER_POWER[t] * pet.power * S.petPower))}`;
    const rows = [['Hit', hit(from), hit(to)]];
    const b = sp.q.bless;
    if (b) { // a support: its heal and its boost matter more than its hit
      const heal = (t) => `${Math.round(b.heal * TIER_POWER[t] * pet.growth)}`;
      const [label, key] = b.dmg ? ['Team damage', 'dmg'] : b.haste ? ['Team speed', 'haste'] : ['Team guard', 'def'];
      const boost = (t) => `+${Math.round(b[key] * TIER_POWER[t] * 100)}%`;
      rows.splice(0, 1, ['Heal', heal(from), heal(to)], [label, boost(from), boost(to)]);
    }
    if (to === 4 && S_TWIST[sp.arch]) rows.push(['At S', '', S_TWIST[sp.arch]]);
    return rows;
  }
  if (c.kind === 'team') {
    const T = g.team, v = c.value;
    if (c.up.id === 't_heal') {
      const hp = P.pets.reduce((a, p) => a + (p.fainted ? 0 : p.hp / p.maxHp), 0) / Math.max(1, P.pets.length);
      return [['Team HP', pct(hp), '100%']];
    }
    if (c.up.atk && c.up.atk !== 'all') {
      const t = c.up.atk, u = g.typeUp?.[t] || { dmg: 0, n: 0 }, n = u.n;
      const rows = [['Damage', pct(1 + u.dmg), pct(1 + u.dmg + v)]];
      if (t === 'chain') rows.push(['Jumps', `+${n}`, `+${n + 1}`]);
      else if (t === 'area') rows.push(['Size', pct(1 + TYPE_PERK.area * n), pct(1 + TYPE_PERK.area * (n + 1))]);
      else rows.push([t === 'shot' ? 'Attack speed' : 'Charges', pct(Math.pow(TYPE_PERK[t], -n)), pct(Math.pow(TYPE_PERK[t], -(n + 1)))]);
      return rows;
    }
    const base = 1 + T.dmg + (g.cry || 0);
    const rows = {
      dmg: ['Damage', pct(base * S.petPower), pct((base + v) * S.petPower)],
      haste: ['Attack speed', plus(T.haste), plus(T.haste + v)], // same terms as the card: "8% faster"
      def: ['Damage taken', pct(1 - T.def), pct(1 - T.def - v)],
      hp: ['Max HP', pct(1 + T.hp), pct(1 + T.hp + v)],
      crit: ['Crit chance', pct(S.crit + T.crit), pct(S.crit + T.crit + v)],
    };
    return rows[c.up.key] ? [rows[c.up.key]] : [];
  }
  const row = HERO_ROWS[c.up.key];
  if (!row) return [];
  const after = P.statsWith({ [c.up.key]: c.value });
  return [[row[0], row[1](S), row[1](after)]];
}

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
export function cardRowsHTML(g, c) {
  const rows = cardRows(g, c);
  if (!rows.length) return '';
  return `<div class="deltas">${rows.map(([label, a, b]) => `<div class="delta"><span>${esc(label)}</span>${a === '' ? '' : `<em>${esc(a)}</em><i>→</i>`}<b>${esc(b)}</b></div>`).join('')}</div>`;
}
