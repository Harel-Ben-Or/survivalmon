// The story's scenes on the map (played with Game.playScene, see world/scene.js): who walks where and
// says what. The words are in story_lines.js.
import { GATE_LINES, FRIEND_REUNION, FRIEND_TOWN, ENDING_TALK } from './story_lines.js';
import { NPCS, NPC_IDS } from './npcs.js';
import { HEROES } from './heroes.js';

// Positions around you at a gate: `fwd` px into town, `side` px to the side
function gateFrame(g, side) {
  const P = g.player, d = g.town?.doors?.find((x) => x.gate === side);
  let [ix, iy] = d?.toTown || [0, 1];
  const n = Math.hypot(ix, iy) || 1; ix /= n; iy /= n;
  const sx = -iy, sy = ix;
  return (fwd, s) => [Math.round(P.x + ix * fwd + sx * s), Math.round(P.y + iy * fwd + sy * s)];
}
const heroName = (id) => HEROES.find((h) => h.id === id)?.name || id;
const guardOf = (side) => NPC_IDS.find((i) => NPCS[i].gate === side);

// Your first time at Hearthvale: you come through the North Gate with your new survivalmon. The guard
// stops you, the townsfolk gather round, frightened; you say Hollis's name; Granny Wren comes through
// the crowd and vouches for you; then Moss runs up to meet your survivalmon.
export function gateArrivalScene(g) {
  const at = gateFrame(g, 'north'), L = GATE_LINES, pet = g.player.pets[0];
  const near = pet ? [Math.round(pet.x), Math.round(pet.y)] : at(16, 18);
  return [
    { wait: 0.7 },
    { emote: 'ollie', icon: '!' },
    { walk: 'ollie', to: at(8, 26), wait: false },
    { walk: 'juniper', from: at(175, -60), to: at(36, -32), run: true, wait: false },
    { walk: 'barrow', from: at(185, 34), to: at(40, 12), run: true, wait: false },
    { walk: 'tib', from: at(165, 80), to: at(30, 36), run: true, wait: false },
    { walk: 'fen', from: at(200, -12), to: at(52, -10), wait: false },
    { wait: 0.5 },
    { say: 'ollie', text: L.ollie },
    { together: true },
    { emote: 'juniper', icon: '!' },
    { say: 'juniper', text: L.juniper },
    { say: 'barrow', text: L.barrow },
    { say: 'tib', text: L.tib },
    { say: 'you', text: L.you },
    { emote: 'fen', icon: '?' },
    { say: 'fen', text: L.fen },
    // Granny Wren comes through the crowd; it parts for her
    { spawn: 'wren', at: at(185, 0) },
    { walk: 'wren', to: at(60, 0), wait: false },
    { wait: 1.2 },
    { say: 'wren', text: L.wren1 },
    { walk: 'juniper', to: at(40, -46), wait: false },
    { walk: 'fen', to: at(56, -34), wait: false },
    { walk: 'wren', to: at(24, 0) },
    { say: 'wren', text: L.wren2 },
    { say: 'ollie', text: L.ollie2 },
    { say: 'wren', text: L.wren3 },
    // she goes back into town, and the crowd lets you be
    { walk: 'wren', to: at(190, 10), wait: false },
    { walk: 'barrow', to: at(160, 70), wait: false },
    { walk: 'fen', to: at(170, -80), wait: false },
    { walk: 'juniper', to: at(150, -120), wait: false },
    { wait: 1.0 },
    // and Moss can't wait any longer
    { walk: 'moss', from: at(60, -190), to: [near[0] - 16, near[1] + 2], run: true },
    { face: 'moss', to: near },
    { emote: 'moss', icon: '♥' },
    { say: 'moss', text: L.moss },
    { remove: 'wren' },
  ];
}

// A friend found out in the wild, right after the Night Lord of that gate's Lv 1 falls: they come
// running from the edge of the screen. id: rowanf, bram, lyra or pip.
export function reunionScene(g, id) {
  const P = g.player, s = Math.random() < 0.5 ? -1 : 1, far = Math.round(g.view.w / 2 + 30);
  const lines = FRIEND_REUNION[id] || [];
  return [
    { wait: 0.8 },
    { spawn: id, at: [P.x + s * far, P.y + 6], art: 'hero' },
    { walk: id, to: [P.x + s * 26, P.y + 4], run: true },
    { emote: id, icon: '!' },
    { wait: 0.4 },
    ...lines.map(([who, text]) => ({ say: who === 'friend' ? id : who, text })),
    { banner: `${heroName(id)} joins you!`, color: '#ffd84a', sub: `${heroName(id)} can now be picked at any gate` },
    { wait: 1.0 },
  ];
}

// Back in town with a friend you found: they walk in with you, the gate's guard and Tib come up
export function friendTownScene(g, id, side) {
  const at = gateFrame(g, side), guard = guardOf(side), T = FRIEND_TOWN;
  return [
    { spawn: id, at: at(4, -22), art: 'hero' },
    { wait: 0.6 },
    guard && { walk: guard, to: at(16, 26) },
    guard && { say: guard, text: T.guard },
    { walk: 'tib', from: at(170, 40), to: at(34, 10), run: true },
    { emote: 'tib', icon: '!' },
    { say: 'tib', text: T.tib },
    { say: id, text: T[id] },
    { walk: 'tib', to: at(150, 80), wait: false },
    { wait: 0.6 },
  ];
}

// After the ending pictures (the Scar): Granny Wren comes to meet you at the gate
export function endingScene(g, side) {
  const at = gateFrame(g, side);
  return [
    { spawn: 'wren', at: at(180, 0) },
    { walk: 'wren', to: at(24, 0) },
    ...ENDING_TALK.map((l) => ({ say: l.who, text: l.text })),
    { walk: 'wren', to: at(180, 0), wait: false },
    { wait: 1.2 },
  ];
}

// Which friend a win at this gate tier finds (the first win at North, South, East, West Lv 1)
export const FRIEND_AT_TIER = ['rowanf', 'bram', 'lyra', 'pip'];
