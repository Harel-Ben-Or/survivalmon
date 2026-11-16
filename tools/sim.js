// Balance simulator: plays one run with a chosen loadout and reports what happened.
// Use it in the dev page console ON A THROWAWAY PROFILE (it overwrites that save):
//   const { sim } = await import('/tools/sim.js');
//   await sim({ training: { armor: 10 }, team: [['voltowl', 6], ['emberpup', 6]], seconds: 300 })
// cfg: training (Training Hall levels), team ([species, level] pairs), hero, seconds (run length),
//      pick ('random' | 'hero' | 'mons': which level-up card the bot takes), seed (repeat runs).
// The bot dodges like tools/bot.js: away from nearby monsters, harder from bosses.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function sim(cfg = {}) {
  const g = window.game;
  const { Meta } = await import('/src/systems/meta.js');
  const { Box } = await import('/src/systems/collection.js');
  const { Shrine } = await import('/src/systems/shrine.js');
  const { Input } = await import('/src/core/input.js');
  // a clean save with just this loadout
  Meta.data.training = { runtime: 18, ...(cfg.training || {}) };
  Meta.data.gear = cfg.gear || {}; Meta.data.slots = cfg.slots || {}; Meta.data.buffs = [];
  Meta.data.unlocked.clinic = true;
  if (Shrine.data) Shrine.data.nodes = {};
  Box.data.mons = []; Box.data.team = []; Box.data.upgrades = {}; Box.data.firstHatch = false;
  for (const [sp, lv] of cfg.team || []) Box.add(sp, { level: lv, skills: [{ k: 'u', sp, t: cfg.tier ?? 1 }] });
  g.startRun(cfg.hero || 'rowan');
  if (cfg.seconds) g.runLength = cfg.seconds;
  g.director.catchT = 1e9; // no wild survivalmons: they'd change the numbers
  const P = g.player;
  const out = { hero: P.hero.id, heroDmg: 0, monDmg: 0, rawIn: 0, taken: 0, hits: 0, faints: [], minHp: 1, cards: {}, by: {} };
  // count damage by who dealt it, and damage taken before and after armor
  const dmgFn = g.damageEnemy;
  g.damageEnemy = function (e, base, o = {}) { const hp0 = Math.max(0, e.hp); const r = dmgFn.call(this, e, base, o); out[o.pet ? 'monDmg' : 'heroDmg'] += Math.min(r.dmg, hp0); return r; };
  const hurtFn = P.hurt.bind(P);
  P.hurt = (dmg, src) => { const before = P.hp; const hit = hurtFn(dmg, src); if (hit) { out.rawIn += dmg; out.taken += before - Math.max(0, P.hp); out.hits++; const k = src?.type || '?'; out.by[k] = (out.by[k] || 0) + Math.round(before - Math.max(0, P.hp)); } return hit; };
  const fainted = new Set();
  // Dodge nearby monsters (bosses most), and like a player, grab EXP, coins, chests and (when hurt)
  // hearts nearby, more boldly when nothing is close.
  const steer = () => {
    let fx = 0, fy = 0, close = 1e9;
    for (const e of g.enemies) {
      if (e.dead) continue;
      const dx = P.x - e.x, dy = P.y - e.y, d2 = dx * dx + dy * dy;
      close = Math.min(close, d2);
      if (d2 < 160 * 160) { const w = (e.boss ? 4 : 1) / Math.max(64, d2); fx += dx * w; fy += dy * w; }
    }
    // step out of telegraphed attacks (target circles, hazard zones) the way a player would
    for (const fx2 of g.effects) {
      if (fx2.type !== 'target') continue;
      const dx = P.x - fx2.x, dy = P.y - fx2.y, d = Math.hypot(dx, dy) || 1;
      if (d < fx2.R + 14) { fx += (dx / d) * 0.2; fy += (dy / d) * 0.2; }
    }
    for (const z of g.zones) {
      if (z.kind !== 'hazard') continue;
      const dx = P.x - z.x, dy = P.y - z.y, d = Math.hypot(dx, dy) || 1;
      if (d < z.r + 10) { fx += (dx / d) * 0.2; fy += (dy / d) * 0.2; }
    }
    if (cfg.collect !== false) {
      const hurt = P.hp < P.stats.maxHp * 0.6;
      let best = null, bd = 150 * 150;
      for (const k of g.pickups) {
        if (k.magnet || !(k.kind === 'xp' || k.kind === 'coin' || k.kind === 'chest' || (hurt && k.kind === 'heart'))) continue;
        const d2 = (k.x - P.x) ** 2 + (k.y - P.y) ** 2;
        if (d2 < bd) { bd = d2; best = k; }
      }
      if (best) {
        const d = Math.sqrt(bd) || 1, pull = close > 50 * 50 ? 0.03 : 0.008;
        fx += ((best.x - P.x) / d) * pull; fy += ((best.y - P.y) / d) * pull;
      }
    }
    const m = Math.hypot(fx, fy);
    if (m < 1e-5) Input.setStick(0, 0); else Input.setStick(fx / m, fy / m);
  };
  const pickCard = () => {
    const cards = [...document.querySelectorAll('[data-pick]')];
    if (!cards.length) return;
    const opts = g.ui.levelCards || [];
    let i = (Math.random() * cards.length) | 0;
    if (cfg.pick && opts.length === cards.length) {
      const want = cfg.pick === 'mons' ? ['team', 'skill'] : ['stat', 'train'];
      const j = opts.findIndex((c) => want.includes(c.kind));
      if (j >= 0) i = j;
    }
    const c = opts[i];
    if (c) { const k = c.up?.id || c.kind; out.cards[k] = (out.cards[k] || 0) + 1; }
    cards[i].click();
  };
  let steps = 0;
  while (g.mode === 'world' || g.mode === 'house') {
    for (let i = 0; i < 240 && (g.mode === 'world' || g.mode === 'house'); i++) {
      if (g.modal === 'levelup') pickCard();
      else if (g.modal === 'loot') g.ui.nextLoot();
      else if (g.modal === 'evolve') document.querySelector('[data-act="evolve-later"],[data-act="evolve-close"]')?.click();
      else if (g.modal) { g.ui.closeModal(); g.modal = null; }
      else steer();
      if (g.mode === 'house' && !g.modal) g.exitHouse?.();
      g.update(1 / 30); steps++;
      out.minHp = Math.min(out.minHp, P.hp / P.stats.maxHp);
      for (const p of P.pets) if (p.fainted && !fainted.has(p)) { fainted.add(p); out.faints.push(`${p.species}@${Math.round(g.time)}s`); }
    }
    await sleep(0);
    if (steps > 30 * 900) break;
  }
  Input.setStick(0, 0);
  g.damageEnemy = dmgFn;
  Object.assign(out, {
    t: Math.round(g.time), dead: P.hp <= 0, lv: P.level, kills: P.kills,
    heroDmg: Math.round(out.heroDmg), monDmg: Math.round(out.monDmg), rawIn: Math.round(out.rawIn), taken: Math.round(out.taken),
    armor: P.stats.armor, maxHp: P.stats.maxHp, might: +P.stats.might.toFixed(2),
    petHp: P.pets.map((p) => `${p.species}:${Math.round(p.maxHp)}`).join(' '),
  });
  return out;
}

// Several runs in a row; results land in window.__sim (poll __sim.done).
export function simBatch(list) {
  window.__sim = { done: false, results: [], errors: [] };
  (async () => {
    for (const cfg of list) {
      try { const r = await sim(cfg); window.__sim.results.push({ name: cfg.name, ...r }); } catch (e) { window.__sim.errors.push(`${cfg.name}: ${e.message} ${e.stack?.split('\n')[1]}`); }
      await sleep(50);
    }
    window.__sim.done = true;
  })();
  return window.__sim;
}
