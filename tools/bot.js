// Run in the dev page console: localStorage cleared first for a fresh save, then
//   window.__bot = { runs: 20 }; import('/tools/bot.js')   and read window.__bot.log when __bot.done.
// Full-game bot: fresh save -> starter egg -> N runs, spending in town between runs.
window.__bot = { runs: window.__bot?.runs, log: [], errors: [], done: false, run: 0 };
window.addEventListener('error', (e) => __bot.errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => __bot.errors.push('rej ' + String(e.reason?.message || e.reason)));
(async () => {
  const bot = window.__bot, g = window.game, ui = g.ui;
  const { Meta, TRAINING } = await import('/src/systems/meta.js');
  const { Box } = await import('/src/systems/collection.js');
  const { Shrine, SHRINE_NODES } = await import('/src/systems/shrine.js');
  const { Input } = await import('/src/core/input.js');
  const { BUILDINGS } = await import('/src/content/buildings.js');
  const { breedResult, BREED_LEVEL, SPECIES } = await import('/src/content/species.js');
  const { SLOTS } = await import('/src/content/gear.js');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => { const el = document.querySelector(sel); if (el) el.click(); return !!el; };
  const RUNS = bot.runs || 20;
  // starter
  ui.showStarter(); ui.chooseStarter('voltowl');
  await sleep(200);
  const steer = () => {
    const P = g.player; let fx = 0, fy = 0, close = 1e9;
    for (const e of g.enemies) {
      if (e.dead) continue;
      const dx = P.x - e.x, dy = P.y - e.y, d2 = dx * dx + dy * dy;
      close = Math.min(close, d2);
      if (d2 < 160 * 160) { const w = (e.boss ? 4 : 1) / Math.max(64, d2); fx += dx * w; fy += dy * w; }
    }
    // gather or collect when it is calm
    if (close > 80 * 80) {
      let best = null, bd = 220 * 220;
      for (const o of g.world.nodes) { const d = (o.x - P.x) ** 2 + (o.y - 2 - P.y) ** 2; if (d < bd) { bd = d; best = o; } }
      if (best) {
        const dx = best.x - P.x, dy = best.y - 2 - P.y, d = Math.hypot(dx, dy);
        if (d < 10) { Input.setStick(0, 0); return; }
        fx += dx / d * 0.02; fy += dy / d * 0.02;
      }
    }
    // stay off the map edges
    const c = g.world.center; const cx = c.tx * 16 - P.x, cy = c.ty * 16 - P.y, cd = Math.hypot(cx, cy) || 1;
    fx += cx / cd * 0.003; fy += cy / cd * 0.003;
    const m = Math.hypot(fx, fy);
    if (m < 1e-5) Input.setStick(0, 0); else Input.setStick(fx / m, fy / m);
  };
  const handleModal = () => {
    const k = g.modal;
    if (k === 'levelup') { const cards = document.querySelectorAll('[data-pick]'); if (cards.length) cards[(Math.random() * cards.length) | 0].click(); }
    else if (k === 'loot') ui.nextLoot();
    else if (k === 'evolve') { click('[data-act="evolve-go"]') || click('[data-act="evolve-close"]') || click('[data-act="evolve-later"]'); }
    else if (k === 'pause') ui.closePause();
    else if (k === 'hatched') click('[data-mact="hatch-next"]');
    else if (k === 'talkseq') click('[data-talk="seq-next"]');
    else if (k === 'creator') click('[data-talk="creator-ok"]');
    else if (k === 'story') document.querySelector('.story')?.click();
    else if (k) bot.stuck = (bot.stuck || 0) + 1;
  };
  const town = async () => {
    // story scenes (the gate, friends found, the ending) are clicked through; anything else is closed
    for (let i = 0; i < 80 && (g.modal || ui.guide); i++) {
      if (ui.guide) { ui.closeGuide(); continue; }
      if (g.modal === 'talkseq') { click('[data-talk="seq-next"]'); bot.scenes = (bot.scenes || 0) + 1; }
      else if (g.modal === 'story') document.querySelector('.story')?.click();
      else if (!click('[data-mact="hatch-next"]')) { ui.closeModal(); g.modal = null; }
      await sleep(30);
    }
    // heal
    const hurt = Box.hurtMons();
    for (const m of hurt) { const c = Math.ceil((1 - m.hp) * (6 + m.level * 2)); if (Meta.data.coins >= c && Meta.isUnlocked('clinic')) { Meta.data.coins -= c; Box.heal(m); } }
    // ~20 min between runs of Ranch training for spares (6 EXP a minute)
    for (const m of Box.mons.filter((m) => !Box.inTeam(m.id)).slice(0, Box.trainSpots())) Box.addXp(m, 120);
    // evolve with stones in the bag
    for (const m of [...Box.mons]) if (Box.canEvolve(m)) { Box.evolve(m); bot.evolved = (bot.evolved || 0) + 1; }
    // breed two spares (not in team) when a nest is free
    const spares = Box.mons.filter((m) => !Box.inTeam(m.id) && m.level >= BREED_LEVEL);
    if (Box.eggs.length < 3 && spares.length >= 2) {
      outer: for (const a of spares) for (const b of spares) if (a !== b && breedResult(a.species, b.species)) { if (Box.breed(a.id, b.id, Shrine.odds())) { bot.bred = (bot.bred || 0) + 1; } break outer; }
    }
    // free extra copies beyond 2 per species (not in team) for species coins
    const counts = {};
    for (const m of [...Box.mons]) { counts[m.species] = (counts[m.species] || 0) + 1; if (counts[m.species] > 2 && !Box.inTeam(m.id) && Box.mons.length > 6) Box.free(m.id); }
    // spend: runtime first, then the cheapest thing on offer
    for (let guard = 0; guard < 60; guard++) {
      const offers = [];
      for (const u of TRAINING) if (Meta.level(u.id) < Meta.maxLevel(u)) offers.push({ c: Meta.cost(u.id) * (u.id === 'runtime' ? 0.4 : 1), buy: () => Meta.buy(u.id), what: 'train ' + u.id });
      if (Meta.isUnlocked('shrine')) for (const n of SHRINE_NODES) if (Shrine.level(n.id) < Shrine.maxLevel(n)) offers.push({ c: Shrine.cost(n.id) * 1.2, buy: () => Shrine.buy(n.id), what: 'shrine ' + n.id });
      for (const id of Object.keys(BUILDINGS)) if (Meta.isUnlocked(id) || ['gate', 'training', 'hatchery', 'ranch'].includes(id)) offers.push({ c: 1e9, buy: () => Meta.upgradeBuilding(id), what: 'bld ' + id, bld: true });
      if (Meta.isUnlocked('workshop')) for (const s of SLOTS) if (Meta.hasGear(Meta.hero, s)) { const c = Meta.slotUpCost(Meta.hero, s); if (c) offers.push({ c: (typeof c === 'number' ? c : c.coins || 0) * 1.5, buy: () => Meta.slotUp(Meta.hero, s), what: 'slot ' + s }); }
      // buildings whenever affordable
      let bought = false;
      for (const o of offers.filter((o) => o.bld)) if (o.buy()) { bot.bld = (bot.bld || []).concat(o.what); bought = true; }
      const cheap = offers.filter((o) => !o.bld).sort((a, b) => a.c - b.c)[0];
      if (cheap && cheap.buy()) bought = true;
      if (!bought) break;
    }
    if (Meta.isUnlocked('shrine')) Shrine.startResearch?.();
    // team: healthiest, highest level
    const best = Box.mons.filter((m) => m.hp > 0.3).sort((a, b) => b.level - a.level).slice(0, Box.teamSize());
    Box.data.team = best.map((m) => m.id); Box.save();
  };
  for (let r = 0; r < RUNS; r++) {
    bot.run = r + 1;
    await town();
    const heroes = ['rowan', 'rowanf', 'bram', 'lyra', 'pip'].filter((h) => Meta.isHeroUnlocked(h));
    Meta.data.gateTier = Meta.gates; // always the newest gate, like a player pushing on
    g.startRun(heroes[r % heroes.length]);
    const t0 = performance.now(), coins0 = Meta.data.coins;
    let steps = 0;
    while (g.mode === 'world' || g.mode === 'house') {
      for (let i = 0; i < 120 && (g.mode === 'world' || g.mode === 'house'); i++) {
        if (ui.guide) ui.closeGuide();
        if (g.modal) handleModal(); else steer();
        if (g.mode === 'house' && !g.modal) g.exitHouse?.();
        g.update(1 / 60); steps++;
      }
      await sleep(0);
      if (steps > 60 * 700) { bot.errors.push('run too long'); break; }
    }
    Input.setStick(0, 0);
    const P = g.player;
    bot.log.push({ run: r + 1, hero: P.hero?.id, tier: g.tier, won: g.endWon, weapon: P.main ? `${P.main.level}:${P.main.path.join('>')}` : '', heroDmg: Math.round(g.runStats.heroDmg || 0), monDmg: Math.round(g.runStats.monDmg || 0), len: g.runLength, t: Math.round(g.time), dead: P.hp <= 0, lv: P.level, kills: P.kills, coins: Meta.data.coins - coins0, mats: { ...P.mats }, caught: P.caught?.length || 0, pets: P.pets.map((p) => `${p.mon.species}${p.fainted ? '✝' : ''}`).join(','), mons: Box.mons.length, eggs: Box.eggs.length, ms: Math.round(performance.now() - t0) });
    await sleep(1100);
    g.toTown(true);
    await sleep(100);
  }
  await town();
  bot.final = { coins: Meta.data.coins, mats: Meta.data.mats, runs: Meta.data.runs, best: Meta.data.bestTime, heroes: Meta.data.heroes, unlocked: Meta.data.unlocked, buildings: Meta.data.buildings, training: Meta.data.training, mons: Box.mons.map((m) => `${m.species}:${m.level}`), dex: Object.keys(Box.data.caught || {}).length, shrine: Shrine.data, gear: Meta.data.gear };
  bot.done = true;
})().catch((e) => { window.__bot.errors.push('BOT ' + e.message + ' ' + e.stack?.split('\n')[1]); window.__bot.done = true; });
