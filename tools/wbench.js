// Weapon balance bench: for every path of a weapon's tree, at levels 4, 8 and 12, measures damage
// per second in two fixed scenes, with no survivalmons and the hero standing still:
//   crowd: 18 mixed monsters around the hero, topped up every 3 s
//   boss:  one huge foe that never dies, 44 px away and alone; only damage to it counts
// Use it in the dev page console ON A THROWAWAY PROFILE:
//   const { wbench } = await import('/tools/wbench.js'); const r = await wbench('bow', { seconds: 8 })
// cfg.levels: only these levels (4, 8, 12); cfg.els: only these elements at level 12
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function wbench(id = 'bow', cfg = {}) {
  const g = window.game;
  const { Meta } = await import('/src/systems/meta.js');
  const { Box } = await import('/src/systems/collection.js');
  const { TREES, ELEMENT_IDS, wName } = await import('/src/content/evolve.js');
  if (Meta.data.guide) Meta.data.guide.on = false;
  const T = TREES[id], secs = cfg.seconds || 8, out = [];
  const paths = [];
  for (const r1 of Object.keys(T.r1)) {
    if (cfg.levels?.includes(4) ?? true) paths.push([4, [r1]]);
    for (const r2 of Object.keys(T.r1[r1].r2)) {
      if (cfg.levels?.includes(8) ?? true) paths.push([8, [r1, r2]]);
      if (cfg.levels?.includes(12) ?? true) for (const el of cfg.els || ELEMENT_IDS) paths.push([12, [r1, r2, el]]);
    }
  }
  const team = Box.data.team; Box.data.team = []; // no survivalmons
  const scene = async (level, path, kind) => {
    g.startRun('rowan');
    const P = g.player;
    P.bonus = {}; P.recompute(); // plain hero stats
    P.main = { id, level, path: [...path], cd: 0.2 };
    P.weapons = [];
    P.hurt = () => false;
    g.director.update = () => {};
    let dmg = 0, boss = null;
    const types = ['blob', 'slime', 'beetle', 'wolf', 'shroom_blue', 'golem'];
    const spawn = (n, R0 = 60, R1 = 180) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, d = R0 + Math.random() * (R1 - R0);
        g.spawnEnemy(types[(Math.random() * types.length) | 0], P.x + Math.cos(a) * d, P.y + Math.sin(a) * d);
      }
    };
    if (kind === 'boss') {
      boss = g.spawnEnemy('golem', P.x + 44, P.y);
      boss.boss = true; boss.maxHp = boss.hp = 1e9; boss.knockRes = 1; // held in place every frame below, alone
    } else spawn(18);
    const own = Object.prototype.hasOwnProperty.call(g, 'damageEnemy'), base = g.damageEnemy; // hooked on the game itself
    g.damageEnemy = function (e, b, o = {}) {
      const before = Math.max(0, e.hp);
      const r = base.call(this, e, b, o);
      if (!o.pet && (kind === 'crowd' || e === boss)) dmg += kind === 'boss' ? r.dmg : Math.min(r.dmg, before);
      return r;
    };
    try {
      for (let f = 0; f < secs * 30 && g.mode === 'world'; f++) {
        if (g.modal) { g.ui.closeModal(); g.modal = null; }
        if (kind === 'crowd' && f % 90 === 0) { const alive = g.enemies.filter((e) => !e.dead).length; if (alive < 18) spawn(18 - alive); }
        if (boss) { boss.x = P.x + 44; boss.y = P.y; boss.hp = 1e9; }
        g.update(1 / 30);
        if (f % 300 === 0) await sleep(0);
      }
    } finally { if (own) g.damageEnemy = base; else delete g.damageEnemy; }
    g.endRun('quit'); g.ui.closeModal();
    return dmg / secs;
  };
  for (const [level, path] of paths) {
    const w = { id, level, path };
    const crowd = await scene(level, path, 'crowd');
    const boss = await scene(level, path, 'boss');
    out.push({ lv: level, path: path.join('>'), name: wName(w), crowd: Math.round(crowd), boss: Math.round(boss) });
    await sleep(0);
  }
  Box.data.team = team;
  return out;
}
