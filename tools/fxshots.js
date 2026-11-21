// Pictures of the gear-set effects in a run: for each shot below, wears the set's 6 pieces on a throwaway
// profile, plays until the effect goes off, and draws that moment into one sheet (saved by the dev
// server to mockups/snapshots/<name>.png).
// Use it in the dev page console ON A THROWAWAY PROFILE:
//   const { fxshots } = await import('/tools/fxshots.js'); await fxshots()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const count = (F, k) => F.n[k] || 0;
// what a falling star or falcon is centred on: half way between it and the spot it will land on
const falling = (g) => { const p = g.projectiles.find((q) => q.noHit && q.draw && q.z > 0); return p && { x: p.x + p.z * 0.17, y: p.y - 8 - p.z / 2 }; };
// [set, label, when(g, F) -> true at the moment to draw, frames to wait after it, focus(g) -> what to centre on (default: the hero)]
export const SHOTS = [
  ['skyfall', 'Skyfall: a Wishing Star falls', (g) => g.projectiles.some((p) => p.noHit && p.draw && p.z > 25 && p.z < 55), 0, falling],
  ['falcon', 'Falcon: the falcon dives', (g) => g.projectiles.some((p) => p.noHit && p.draw && p.z > 25 && p.z < 55), 0, falling],
  ['ranger', "Ranger: Hunter's Marks (green)", (g) => g.enemies.filter((e) => !e.dead && e.fxPipT > g.time).length >= 5, 0],
  ['sabertooth', 'Sabertooth: bleeding foes (red)', (g) => g.enemies.filter((e) => !e.dead && e.fxPipT > g.time).length >= 5, 0],
  ['gale', 'Gale: Gust on a dash', (g, F) => count(F, 'gust') >= 2, 2],
  ['prospector', 'Prospector: Blasting Bolt', (g, F) => count(F, 'bolt') >= 2, 2],
  ['stampede', 'Stampede: Horn Rush', (g, F) => count(F, 'ram') >= 1, 1],
  ['harvest', 'Harvest: Reaping Sweep', (g, F) => count(F, 'reap') >= 3, 2],
  ['bulwark', 'Bulwark: Block and Shield Bash', (g, F) => count(F, 'block') >= 1, 3],
  ['titan', 'Titan: Titan Strike shakes the ground', (g, F) => count(F, 'quake') >= 2, 5],
  ['storm', 'Stormcaller: Thunderstorm', (g, F) => count(F, 'storm') >= 4, 1],
  ['prism', 'Prism: split sparks and Rainbow Burst', (g, F) => count(F, 'rainbow') >= 6 && count(F, 'split') >= 4, 1],
  ['aurora', 'Aurora: the Aurora Veil', (g, F) => count(F, 'veil') >= 1, 9],
  ['wildheart', 'Wildheart: Brambles', (g) => g.zones.filter((z) => z.kind === 'thorns' && z.age > 0.4).length >= 2, 0, (g) => g.zones.find((z) => z.kind === 'thorns')],
  ['tinkerer', 'Tinkerer: the Turret', (g, F) => count(F, 'turretShot') >= 2, 2, (g, F) => F.s.turret],
  ['wildking', "Wildking: King's Stone roar", (g, F) => count(F, 'roar') >= 1, 3],
];

export async function fxshots(cfg = {}) {
  const g = window.game;
  const { Meta } = await import('/src/systems/meta.js');
  const { Box } = await import('/src/systems/collection.js');
  const { GEAR_SETS, SLOTS } = await import('/src/content/gear.js');
  const { TREES } = await import('/src/content/evolve.js');
  const { Input } = await import('/src/core/input.js');
  if (Meta.data.guide) Meta.data.guide.on = false;
  for (let i = 0; i < 100 && (g.mode === 'boot' || !g.ui?.el?.title); i++) await sleep(200);
  const shots = cfg.only ? SHOTS.filter((s) => cfg.only.includes(s[0])) : SHOTS;
  const cols = cfg.cols || 4, CW = 480, CH = 360, rows = Math.ceil(shots.length / cols);
  const sheet = document.createElement('canvas');
  sheet.width = cols * CW; sheet.height = rows * (CH + 22);
  const sx = sheet.getContext('2d');
  sx.fillStyle = '#16232a'; sx.fillRect(0, 0, sheet.width, sheet.height);
  const report = [];
  for (let i = 0; i < shots.length; i++) {
    const [set, label, when, wait, focus] = shots[i], hero = GEAR_SETS[set].hero;
    Meta.data.heroes[hero] = true;
    for (const m of Box.team()) m.hp = 1;
    Meta.data.gear[hero] = {};
    for (const slot of SLOTS) Meta.data.gear[hero][slot] = { own: { [set]: true }, on: set, lv: { [set]: 5 } };
    g.mode = 'title';
    g.startRun(hero);
    await g.dressHeroes?.();
    const P = g.player, id = P.main.id, T = TREES[id], F = g.fx;
    const r1 = Object.keys(T.r1)[cfg.r1 || 0], r2 = Object.keys(T.r1[r1].r2)[cfg.r2 || 0];
    P.main = { id, level: 9, path: [r1, r2], cd: 0.2, gs: P.main.gs };
    g.director.catchT = 1e9; g.director.update = () => {};
    const types = ['blob', 'slime', 'beetle', 'wolf', 'shroom_blue'];
    const spawn = () => { for (let k = 0; k < 14; k++) { const a = Math.random() * Math.PI * 2, d = 45 + Math.random() * 90; g.spawnEnemy(types[(Math.random() * types.length) | 0], P.x + Math.cos(a) * d, P.y + Math.sin(a) * d); } };
    spawn();
    let hit = -1, f = 0;
    for (; f < 1800 && g.mode === 'world'; f++) {
      if (g.modal) { if (g.modal === 'levelup' && g.ui.onPick && g.ui.levelCards?.length) { g.ui.onPick(g.ui.levelCards[0]); g.ui.closeModal?.(); } else { g.ui.closeModal?.(); g.modal = null; } }
      if (f % 45 === 0 && g.enemies.filter((e) => !e.dead).length < 30) spawn();
      Input.setStick(Math.floor(f / 120) % 2 ? Math.cos(f / 40) * 0.6 : 0, Math.floor(f / 120) % 2 ? Math.sin(f / 40) * 0.6 : 0);
      if (f % 75 === 40) Input.press('Space');
      P.hp = Math.max(P.hp, P.stats.maxHp * 0.5);
      g.update(1 / 30);
      Input.endFrame();
      if (hit < 0 && F && when(g, F)) hit = f;
      if (hit >= 0 && f >= hit + wait) break;
    }
    Input.setStick(0, 0);
    g.render();
    const x = (i % cols) * CW, y = Math.floor(i / cols) * (CH + 22);
    sx.imageSmoothingEnabled = false;
    // a close-up: 160 x 120 game px around the hero (or the effect), drawn 3 times as big
    const k = g.canvas.width / g.view.w, o = (focus && F && focus(g, F)) || P, cw = 160 * k, ch = 120 * k;
    const cx = Math.max(0, Math.min(g.canvas.width - cw, (o.x - g.cam.x) * k - cw / 2)), cy = Math.max(0, Math.min(g.canvas.height - ch, (o.y - 8 - g.cam.y) * k - ch / 2));
    sx.drawImage(g.canvas, cx, cy, cw, ch, x, y + 22, CW, CH);
    sx.fillStyle = '#16232a'; sx.fillRect(x, y, CW, 22);
    sx.fillStyle = hit >= 0 ? '#ffe9a0' : '#ff7a6a'; sx.font = '14px sans-serif'; sx.fillText(`${label}${hit >= 0 ? '' : ' (did not go off)'}`, x + 6, y + 16);
    report.push({ set, hit, f, n: { ...(F?.n || {}) } });
    if (g.mode === 'world' || g.mode === 'house') g.endRun('quit');
    g.ui.closeModal?.(); g.modal = null;
    await sleep(0);
  }
  const res = await fetch('/__snapshot', { method: 'POST', body: JSON.stringify({ name: cfg.name || 'fx_sheet', data: sheet.toDataURL('image/png') }) });
  return { ok: res.ok, report };
}
