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
  const own = sp.kind === 'pure' ? sp.line : sp.kind === 'evolved' ? sp.from : spId; // basic look comes from here
  const fx = {};
  if (sp.arch === 'shooter') {
    const id = `pr_${own}`;
    if (hasVfx(id)) { fx.proj = id; fx.spin = SPIN.has(own); }
    if (sp.kind === 'pure') fx.scale = 1.35;
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
  if (sp.kind === 'evolved' && hasVfx(`evo_${spId}`)) {
    fx.sig = `evo_${spId}`;
    if (hasVfx(`evm_${spId}`)) fx.missile = `evm_${spId}`;
  }
  fx.color = TYPES[sp.types[1] || sp.types[0]]?.color;
  return (cache[spId] = fx);
}
const SPIN = new Set(['vinegear', 'shurikat']);
