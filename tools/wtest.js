// Weapon evolve tester: plays every path of a weapon's tree (every first evolve, second evolve and
// element) for a few seconds against a crowd, and reports damage, kills, statuses and errors.
// Use it in the dev page console ON A THROWAWAY PROFILE (it starts runs on that save):
//   const { wtest } = await import('/tools/wtest.js'); await wtest('bow', { seconds: 12 })
// Also checks every level's card text and stats (no NaN) along each path.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function wtest(id = 'bow', cfg = {}) {
  const g = window.game;
  const { Meta } = await import('/src/systems/meta.js');
  const { TREES, ELEMENT_IDS, wStats, nextCard, evolveChoices, wName } = await import('/src/content/evolve.js');
  const T = TREES[id];
  if (Meta.data.guide) Meta.data.guide.on = false;
  const errors = [];
  const onErr = (e) => errors.push(String(e.message || e.reason));
  window.addEventListener('error', onErr);
  const out = [], checks = [];
  // every level's card text and stats, along every path
  for (const r1 of Object.keys(T.r1)) for (const r2 of Object.keys(T.r1[r1].r2)) for (const el of ELEMENT_IDS) {
    for (let L = 1; L <= 12; L++) {
      const w = { id, level: L, path: [r1, r2, el] };
      const st = wStats(w);
      for (const [k, v] of Object.entries(st)) if (typeof v === 'number' && !Number.isFinite(v) && v !== Infinity) checks.push(`${r1}>${r2}>${el} L${L} ${k}=${v}`);
      const n = nextCard(w);
      if (L < 12 && !n) checks.push(`${r1}>${r2} L${L}: no next card`);
      if (n && !n.evolve && !n.text) checks.push(`${r1}>${r2} L${L}: card has no text`);
    }
    if (!T.r1[r1].r2[r2].finals?.[el]) checks.push(`${r1}>${r2}: no final for ${el}`);
  }
  if (evolveChoices({ id, level: 3, path: [] }, 1).length !== 2) checks.push('tier 1 does not offer 2');
  const combos = [];
  for (const r1 of Object.keys(T.r1)) for (const r2 of Object.keys(T.r1[r1].r2)) {
    if (cfg.mid !== false) combos.push([r1, r2, null, 9]);
    for (const el of ELEMENT_IDS) combos.push([r1, r2, el, 12]);
  }
  for (const [r1, r2, el, level] of cfg.only ? combos.filter((c) => cfg.only.includes(`${c[0]}>${c[1]}>${c[2]}`)) : combos) {
    g.startRun('rowan');
    const P = g.player;
    P.main = { id, level, path: el ? [r1, r2, el] : [r1, r2], cd: 0.2 };
    P.weapons = [];
    P.hurt = () => false; // can't be hurt: only the weapon matters here
    g.director.catchT = 1e9;
    g.director.update = () => {}; // no waves; we bring our own crowd
    const types = ['blob', 'slime', 'beetle', 'wolf', 'shroom_blue', 'golem'];
    let dmg = 0, kills0 = P.kills, statuses = new Set();
    const dmgFn = g.damageEnemy;
    g.damageEnemy = function (e, base, o = {}) { const r = dmgFn.call(this, e, base, o); if (!o.pet) dmg += r.dmg; return r; };
    const spawn = () => {
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 120;
        const e = g.spawnEnemy(types[(Math.random() * types.length) | 0], P.x + Math.cos(a) * d, P.y + Math.sin(a) * d);
        if (e && Math.random() < 0.08) { e.elite = true; e.maxHp *= 4; e.hp *= 4; }
      }
    };
    spawn();
    const frames = (cfg.seconds || 10) * 30;
    for (let f = 0; f < frames && g.mode === 'world'; f++) {
      if (g.modal) { g.ui.closeModal(); g.modal = null; }
      if (f % 90 === 0 && g.enemies.filter((e) => !e.dead).length < 30) spawn();
      // stay still in the middle (sometimes step around so moving shots get tested)
      P.x += Math.sin(f / 40) * 0.4;
      g.update(1 / 30);
      if (f % 15 === 0) for (const e of g.enemies) { if (e.burn) statuses.add('burn'); if (e.poison) statuses.add('poison'); if (e.freeze > 0) statuses.add('freeze'); if (e.chill > 0) statuses.add('chill'); if (e.glow > 0) statuses.add('glow'); if (e.stun > 0) statuses.add('stun'); }
      if (f % 300 === 0) await sleep(0);
    }
    g.damageEnemy = dmgFn;
    out.push({ path: `${r1}>${r2}>${el || '-'}`, name: wName(P.main), lv: level, dmg: Math.round(dmg), kills: P.kills - kills0, st: [...statuses].join(','), zones: g.zones.length, proj: g.projectiles.length });
    g.endRun('quit');
    if (g.ui.el?.modal) { g.ui.closeModal(); }
    await sleep(0);
  }
  window.removeEventListener('error', onErr);
  return { checks, errors: [...new Set(errors)].slice(0, 10), out };
}
