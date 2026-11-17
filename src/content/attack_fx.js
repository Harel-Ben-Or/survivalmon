// Which pictures each survivalmon's attack uses. Looked up by the attack skill's species, so an
// inherited skill keeps its own look. Base forms and breeds fire basic projectiles; evolutions
// fire one big animated signature move (sig) instead (see pet.js).
import { SPECIES, TYPES } from './species.js';
import { hasVfx } from '../gfx/art.js';

// Chain-lightning colours: the bolt takes the colour of the breed's other type
const BOLT = {
  storm: ['#ffe680', '#ffffff'], fire: ['#ff8a3c', '#fff0b0'], water: ['#5ac8ff', '#e8fbff'], fairy: ['#ff9ae0', '#fff0fa'],
  shadow: ['#9a70ff', '#e8d8ff'], ice: ['#9ff0ff', '#ffffff'], toxic: ['#b8e040', '#f4ffb0'], metal: ['#a8c0e0', '#ffffff'],
  grass: ['#8ae060', '#f0ffd0'], rock: ['#d8c8a8', '#ffffff'],
};
// Lobbers: whose blob and pool a species uses (a same-species breed borrows its parent's)
const LOB_OF = { venomander: 'venewt' };

const cache = {};
export function attackFx(spId) {
  if (cache[spId]) return cache[spId];
  const sp = SPECIES[spId];
  if (!sp) return (cache[spId] = {});
  // the basic look comes from the form the line started as (a same-species breed: its species)
  let root = sp; while (root.from) root = SPECIES[root.from];
  const own = root.kind === 'pure' ? root.line : root.id;
  const fx = {};
  if (sp.arch === 'shooter') {
    const id = `pr_${own}`;
    if (hasVfx(id)) { fx.proj = id; fx.spin = SPIN.has(own); }
    fx.scale = sp.stage === 4 ? 1.5 : sp.kind === 'pure' || sp.stage === 3 ? 1.35 : 1; // grown-up forms shoot bigger
  } else if (sp.arch === 'zapper') {
    const ty = sp.types.find((t) => t !== 'storm') || 'storm';
    fx.bolt = BOLT[ty] || BOLT.storm;
    if (hasVfx(`zap_${ty}`)) fx.hit = `zap_${ty}`;
  } else if (sp.arch === 'lobber') {
    const k = LOB_OF[own] || own;
    if (hasVfx(`glob_${k}`)) fx.glob = `glob_${k}`;
    if (hasVfx(`zone_${k}`)) fx.zone = `zone_${k}`;
  } else if (sp.arch === 'slam') {
    if (hasVfx(`slam_${own}`)) fx.slam = `slam_${own}`;
  }
  // an evolution's own big signature move: its own, else the one of the form it evolved from, else one
  // borrowed from an evolved mixed breed of its line that attacks the same way
  if (sp.stage >= 3) {
    let s = sp; while (s && !hasVfx(`evo_${s.id}`)) s = SPECIES[s.from];
    const sig = s?.id || Object.values(SPECIES).find((o) => o.stage === 3 && o.arch === sp.arch && o.lines.includes(sp.line) && hasVfx(`evo_${o.id}`))?.id
      || Object.values(SPECIES).find((o) => o.stage === 3 && o.arch === sp.arch && hasVfx(`evo_${o.id}`))?.id;
    if (sig) { fx.sig = `evo_${sig}`; if (hasVfx(`evm_${sig}`)) fx.missile = `evm_${sig}`; }
  }
  fx.color = TYPES[sp.types[1] || sp.types[0]]?.color;
  return (cache[spId] = fx);
}
const SPIN = new Set(['vinegear', 'shurikat']);
