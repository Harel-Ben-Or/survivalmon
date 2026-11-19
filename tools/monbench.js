// Survivalmon species bench: for each species, a team of 3 of it at the same level, with the same
// skill grade (B) and a passive that does nothing in a fight, against a crowd that is topped up, with
// the hero immortal, standing still and unarmed. Reports the team's damage per second (no overkill),
// how much of the time its members spent fainted, and its kills.
// Use it in the dev page console ON A THROWAWAY PROFILE (it adds survivalmons and removes them again):
//   const { monbench } = await import('/tools/monbench.js'); const r = await monbench({ level: 30, gate: 1 })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function monbench(cfg = {}) {
  const g = window.game;
  const { Meta } = await import('/src/systems/meta.js');
  const { Box } = await import('/src/systems/collection.js');
  const { BASE_IDS, SPECIES } = await import('/src/content/species.js');
  if (Meta.data.guide) Meta.data.guide.on = false;
  const ids = cfg.ids || BASE_IDS, level = cfg.level || 30, secs = cfg.seconds || 20, crowd = cfg.crowd || 24;
  const team0 = [...Box.data.team], tier0 = Meta.data.gateTier, out = [];
  const types = ['blob', 'slime', 'beetle', 'wolf', 'shroom_blue', 'golem', 'hound', 'spitter'];
  for (const sp of ids) {
    for (let rep = 0; rep < (cfg.reps || 2); rep++) {
      const mons = [0, 1, 2].map(() => Box.add(sp, { skills: [{ k: 'u', sp, t: 2 }, { k: 'p', id: 'nose', t: 2 }], joinTeam: false, origin: 'egg', level, sz: 1, wz: 1 }));
      Box.data.team = mons.map((m) => m.id);
      Meta.data.gateTier = cfg.gate || 0;
      g.startRun('rowan');
      const P = g.player;
      P.main = null; P.weapons = [];
      P.hurt = () => false;
      g.director.update = () => {};
      const spawn = (n) => { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, d = 70 + Math.random() * 120; g.spawnEnemy(types[(Math.random() * types.length) | 0], P.x + Math.cos(a) * d, P.y + Math.sin(a) * d); } };
      spawn(crowd);
      let dmg = 0, faintT = 0, kills0 = P.kills;
      const proto = Object.getPrototypeOf(g), base = proto.damageEnemy;
      proto.damageEnemy = function (e, b, o = {}) { const before = Math.max(0, e.hp); const r = base.call(this, e, b, o); if (o.pet) dmg += Math.min(r.dmg, before); return r; };
      try {
        for (let f = 0; f < secs * 30 && g.mode === 'world'; f++) {
          if (g.modal) { g.ui.closeModal(); g.modal = null; }
          if (f % 60 === 0) { const alive = g.enemies.filter((e) => !e.dead).length; if (alive < crowd) spawn(crowd - alive); }
          g.update(1 / 30);
          faintT += P.pets.filter((p) => p.fainted).length / 30;
          if (f % 300 === 0) await sleep(0);
        }
      } finally { proto.damageEnemy = base; }
      const kills = P.kills - kills0;
      g.endRun('quit'); g.ui.closeModal(); g.modal = null;
      for (const m of mons) Box.remove(m.id);
      out.push({ sp, name: SPECIES[sp].name, arch: SPECIES[sp].arch, type: SPECIES[sp].type, dps: Math.round(dmg / secs), down: +(faintT / (3 * secs)).toFixed(2), kills });
      await sleep(0);
    }
  }
  Box.data.team = team0; Meta.data.gateTier = tier0; Box.save(); Meta.save();
  // average the repeats
  const by = {};
  for (const r of out) { const o = (by[r.sp] ||= { ...r, dps: 0, down: 0, kills: 0, n: 0 }); o.dps += r.dps; o.down += r.down; o.kills += r.kills; o.n++; }
  return Object.values(by).map((o) => ({ sp: o.sp, name: o.name, arch: o.arch, type: o.type, dps: Math.round(o.dps / o.n), down: +(o.down / o.n).toFixed(2), kills: Math.round(o.kills / o.n) })).sort((a, b) => b.dps - a.dps);
}
