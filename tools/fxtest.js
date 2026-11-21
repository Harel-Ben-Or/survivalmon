// Gear-set effect tester: for every set (or cfg.sets), wears 2, 4 and 6 of its pieces on a throwaway
// profile, plays a fight against a crowd (moving, dashing, picking things up, taking hits) and reports
// which of the set's hooks ran, the damage done, and any errors.
// Use it in the dev page console ON A THROWAWAY PROFILE (it changes that save's gear and starts runs):
//   const { fxtest } = await import('/tools/fxtest.js'); await fxtest({ seconds: 30 })
// cfg: { sets: [ids], pieces: [2, 4, 6], seconds, level (weapon level, default 9), paths: true (a random evolve path) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fxtest(cfg = {}) {
  const g = window.game;
  const { Meta } = await import('/src/systems/meta.js');
  const { Box } = await import('/src/systems/collection.js');
  const { GEAR_SETS, SLOTS } = await import('/src/content/gear.js');
  const { TREES, ELEMENT_IDS } = await import('/src/content/evolve.js');
  const { Input } = await import('/src/core/input.js');
  if (Meta.data.guide) Meta.data.guide.on = false;
  for (let i = 0; i < 100 && (g.mode === 'boot' || !g.ui?.el?.title); i++) await sleep(200); // (the page is still loading)
  const errors = [];
  const onErr = (e) => errors.push(String(e.message || e.reason?.message || e.reason));
  window.addEventListener('error', onErr); window.addEventListener('unhandledrejection', onErr);
  const out = [];
  // cfg.base: also a run with no gear at all for each hero ("none:<hero>"), to compare against
  const sets = [...(cfg.base ? ['rowan', 'rowanf', 'bram', 'lyra', 'pip'].map((h) => `none:${h}`) : []), ...(cfg.sets || Object.keys(GEAR_SETS))];
  // "nofx:<set>": that set's pieces, but none of its effects (what the pieces alone are worth)
  for (const name of sets) for (const pieces of name.startsWith('none:') ? [0] : cfg.pieces || [6]) for (let rep = 0; rep < (cfg.reps || 1); rep++) {
    const nofx = name.startsWith('nofx:'), set = nofx ? name.slice(5) : name;
    const S = GEAR_SETS[set] || { hero: set.slice(5) }, hero = S.hero;
    for (const m of Box.team()) m.hp = 1; // (a survivalmon that fainted in the last fight is back)
    Meta.data.heroes[hero] = true;
    // wear `pieces` of this set (the rest of the slots: the hero's own set, or nothing)
    const own = Object.keys(GEAR_SETS).find((k) => GEAR_SETS[k].hero === hero);
    Meta.data.gear[hero] = {};
    SLOTS.forEach((slot, i) => {
      const on = i < pieces ? set : set === own || cfg.bare || !pieces ? null : own;
      Meta.data.gear[hero][slot] = { own: on ? { [on]: true } : {}, on, lv: on ? { [on]: 5 } : {} };
    });
    const row = { set: name, pieces, hero, hooks: {}, err: null };
    try {
      g.mode = 'title';
      g.startRun(hero);
      const P = g.player, id = P.main.id, T = TREES[id];
      if (nofx) { g.fx = null; P.main.gs = null; g.power = null; }
      if (cfg.paths !== false) {
        const pick = (keys) => keys[cfg.fixed != null ? cfg.fixed % keys.length : (Math.random() * keys.length) | 0];
        const r1 = pick(Object.keys(T.r1)), r2 = pick(Object.keys(T.r1[r1].r2));
        const L = cfg.level || 9, gs = P.main.gs;
        P.main = { id, level: L, path: L >= 12 ? [r1, r2, cfg.el || ELEMENT_IDS[(Math.random() * 5) | 0]] : L >= 8 ? [r1, r2] : L >= 4 ? [r1] : [], cd: 0.2, gs };
        row.path = P.main.path.join('>');
      }
      P.hurt0 = P.hurt;
      g.director.catchT = 1e9; g.director.update = () => {};
      // count the calls of every hook this set registered
      const F = g.fx;
      row.L = F ? JSON.stringify(F.sets) : 'no fx';
      if (F) for (const k of Object.keys(F)) if (typeof F[k] === 'function') { const fn = F[k]; F[k] = (...a) => { row.hooks[k] = (row.hooks[k] || 0) + 1; return fn(...a); }; }
      if (F?.wstat) P.main.gs = F.wstat;
      let hero0 = 0, mon0 = 0;
      const types = ['blob', 'slime', 'beetle', 'wolf', 'shroom_blue', 'golem'];
      const spawn = () => {
        for (let i = 0; i < 16; i++) {
          const a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 130;
          const e = g.spawnEnemy(types[(Math.random() * types.length) | 0], P.x + Math.cos(a) * d, P.y + Math.sin(a) * d);
          if (e && cfg.tough) { e.maxHp *= cfg.tough; e.hp *= cfg.tough; }
          if (e && Math.random() < 0.1) { e.elite = true; e.maxHp *= 4; e.hp *= 4; }
        }
      };
      spawn();
      const frames = (cfg.seconds || 30) * 30;
      for (let f = 0; f < frames && g.mode === 'world'; f++) {
        if (g.modal) { // a level-up: take the first card
          if (g.modal === 'levelup' && g.ui.onPick && g.ui.levelCards?.length) { g.ui.onPick(g.ui.levelCards[0]); g.ui.closeModal?.(); }
          else { g.ui.closeModal?.(); g.modal = null; }
        }
        // cfg.crowd: keep that many foes alive all the time, so the damage done is never held back by too few foes
        if (cfg.crowd ? f % 6 === 0 && g.enemies.filter((e) => !e.dead).length < cfg.crowd : f % 75 === 0 && g.enemies.filter((e) => !e.dead).length < 34) spawn();
        // walk in a slow circle for half the time, stand for the other half; dash every 3 s
        const walk = Math.floor(f / 150) % 2 === 0;
        Input.setStick(walk ? Math.cos(f / 50) : 0, walk ? Math.sin(f / 50) : 0);
        if (f % 90 === 45) Input.press('Space');
        if (f % 240 === 100) { P.hp = Math.max(P.hp, P.stats.maxHp * 0.6); for (const p of P.pets) if (!p.fainted) p.hp = Math.max(1, p.hp * 0.6); }
        if (f === 300) { g.openWorldChest?.(1); g.fx?.wild?.(); P.addXp(P.xpNext); }
        if (f === 420 && P.pets[0] && cfg.faint !== false) { const p = P.pets[0]; p.hp = 1; p.hurt(9999); }
        if (cfg.night) { g.dark = { ...g.dark, sunset: 1, night: 1 }; }
        g.update(1 / 30);
        Input.endFrame();
        if (f % 300 === 0) await sleep(0);
      }
      Input.setStick(0, 0);
      row.dmg = Math.round(g.runStats.heroDmg || 0); row.mon = Math.round(g.runStats.monDmg || 0);
      row.kills = P.kills; row.hp = `${Math.round(P.hp)}/${P.stats.maxHp}`; row.coins = Math.round(P.coins);
      row.mats = Object.values(P.mats).reduce((a, b) => a + b, 0);
      row.team = g.team ? `d${g.team.dmg.toFixed(2)} h${g.team.haste.toFixed(2)} f${g.team.def.toFixed(2)}` : '';
      row.n = Object.entries(F?.n || {}).map(([k, v]) => `${k}:${v}`).join(' ');
      row.s = JSON.stringify(F?.s || {}, (k, v) => (v instanceof Set ? `Set(${v.size})` : v && typeof v === 'object' && 'x' in v && 'vx' in v ? 'proj' : typeof v === 'number' ? +v.toFixed(2) : v)).slice(0, 200);
      void hero0; void mon0;
      row.mode = g.mode;
      if (g.mode === 'world' || g.mode === 'house') g.endRun('quit');
      g.ui.closeModal?.(); g.modal = null;
    } catch (e) { row.err = String(e.stack || e).slice(0, 400); try { g.endRun('quit'); } catch { /* already over */ } }
    out.push(row);
    await sleep(0);
  }
  window.removeEventListener('error', onErr); window.removeEventListener('unhandledrejection', onErr);
  void Box;
  return { errors: [...new Set(errors)].slice(0, 12), out };
}
