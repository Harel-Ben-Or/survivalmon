// Frame cost bench: for each level-12 path of a weapon, a big crowd (cfg.crowd monsters, topped up)
// around the hero with the current team, and measures the average and worst milliseconds of
// update + render per frame. A phone is roughly 3-4x slower than a desktop.
// Use it in the dev page console ON A THROWAWAY PROFILE:
//   const { perfbench } = await import('/tools/perfbench.js'); const r = await perfbench('bow', { seconds: 6 })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function perfbench(id = 'bow', cfg = {}) {
  const g = window.game;
  const { Meta } = await import('/src/systems/meta.js');
  const { TREES, ELEMENT_IDS, wName } = await import('/src/content/evolve.js');
  if (Meta.data.guide) Meta.data.guide.on = false;
  const T = TREES[id], secs = cfg.seconds || 6, crowd = cfg.crowd || 120, out = [];
  const paths = [];
  for (const r1 of Object.keys(T.r1)) for (const r2 of Object.keys(T.r1[r1].r2)) for (const el of cfg.els || ELEMENT_IDS) paths.push([r1, r2, el]);
  const types = ['blob', 'slime', 'beetle', 'wolf', 'shroom_blue', 'golem', 'hound', 'spitter'];
  for (const path of paths) {
    g.startRun(cfg.hero || 'rowan');
    const P = g.player;
    P.main = { id, level: 12, path: [...path], cd: 0.2 };
    P.hurt = () => false;
    g.director.update = () => {};
    const spawn = (n) => { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, d = 70 + Math.random() * 160; g.spawnEnemy(types[(Math.random() * types.length) | 0], P.x + Math.cos(a) * d, P.y + Math.sin(a) * d); } };
    spawn(crowd);
    let sum = 0, worst = 0, n = 0, maxFx = 0, maxProj = 0;
    for (let f = 0; f < secs * 60 && g.mode === 'world'; f++) {
      if (g.modal) { g.ui.closeModal(); g.modal = null; }
      if (f % 30 === 0) { const alive = g.enemies.filter((e) => !e.dead).length; if (alive < crowd) spawn(crowd - alive); }
      const t0 = performance.now();
      g.update(1 / 60);
      g.render();
      const ms = performance.now() - t0;
      if (f > 60) { sum += ms; n++; worst = Math.max(worst, ms); }
      maxFx = Math.max(maxFx, g.effects?.length || 0, (g.zones?.length || 0));
      maxProj = Math.max(maxProj, g.projectiles?.length || 0);
      if (f % 120 === 0) await sleep(0);
    }
    g.endRun('quit'); g.ui.closeModal(); g.modal = null;
    out.push({ path: path.join('>'), name: wName({ id, level: 12, path }), avg: +(sum / Math.max(1, n)).toFixed(2), worst: +worst.toFixed(1), fx: maxFx, proj: maxProj });
    await sleep(0);
  }
  return out.sort((a, b) => b.avg - a.avg);
}
