// Town UI click-through: opens every town page (each NPC's talk box, each building's keeper, the gate
// team pickers, the town menu, the Training Hall) and clicks every button it finds, a few levels deep,
// replaying the clicks from a fresh town each time. Reports errors (and console errors) by click path,
// and on request (cfg.layout) any page box wider or taller than the screen.
// Use it in the dev page console ON A THROWAWAY PROFILE (it buys, equips, frees and breeds for real):
//   const { uitest } = await import('/tools/uitest.js'); const r = await uitest({ depth: 3 })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function uitest(cfg = {}) {
  const g = window.game, ui = g.ui;
  const depth = cfg.depth ?? 3, max = cfg.max ?? 900;
  const { Meta } = await import('/src/systems/meta.js');
  if (Meta.data.guide) Meta.data.guide.on = false;
  let cur = [];
  const errors = [], layout = [];
  const onErr = (e) => errors.push({ path: cur.join(' > '), msg: String(e.message || e.reason?.message || e.reason) });
  const conErr = console.error;
  console.error = (...a) => { errors.push({ path: cur.join(' > '), msg: 'console: ' + a.map(String).join(' ').slice(0, 200) }); conErr(...a); };
  window.addEventListener('error', onErr); window.addEventListener('unhandledrejection', onErr);
  // never: anything that leaves or erases the save, reloads the page, or starts a run
  const SKIP = cfg.skip || /profile|player|wipe|reset|erase|delete|switch|reload|portrait|install|update|fullscreen|export|import|head out|gate-go|startrun|start run|go!|"act":"go"|new game/i;
  const SEL = 'button, [data-act], [data-mact], [data-talk], [data-tab], [data-pick], [data-sort], [data-filter], [data-id], [data-mon], [data-slot], [data-set], [data-sp], [data-hero]';
  const visible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const sig = (el) => (el.tagName + JSON.stringify({ ...el.dataset }) + '|' + (el.textContent || '').trim().slice(0, 24)).replace(/\d+/g, '#');
  const found = () => [...document.querySelectorAll('#ui ' + SEL)].filter((el) => !el.closest('#hud') && !el.closest('.hidden') && visible(el) && !el.disabled);
  const reset = async () => {
    if (g.mode === 'world' || g.mode === 'house') { g.endRun('quit'); await sleep(50); }
    if (g.mode !== 'town') { ui.closeModal(); g.modal = null; g.toTown(true); await sleep(400); }
    if (g.townRoom) g.leaveTownRoom();
    if (ui.guide) ui.closeGuide();
    ui.closeModal(); g.modal = null;
    ui.showTown();
  };
  const starts = [];
  for (const n of g.town.npcs) starts.push({ name: 'talk:' + n.id, open: () => ui.openTalk(n) });
  for (const d of g.town.doors.filter((d) => !d.gate && d.id !== 'merchant')) {
    starts.push({ name: 'room:' + d.id, open: () => { g.enterTownRoom(d); const k = g.room?.npcs?.[0]; if (k) ui.openTalk(k); } });
  }
  for (const side of ['north', 'south', 'east', 'west']) starts.push({ name: 'team:' + side, open: () => ui.showTeam(side) });
  starts.push({ name: 'menu', open: () => ui.openTownMenu() });
  starts.push({ name: 'training', open: () => ui.showTraining() });
  if (cfg.only) starts.splice(0, starts.length, ...starts.filter((s) => cfg.only.some((o) => s.name.includes(o))));

  const queue = starts.map((s) => ({ start: s, path: [] }));
  const seen = new Set();
  let clicks = 0, missing = 0;
  const misses = [];
  const checkLayout = () => {
    const W = window.innerWidth, H = window.innerHeight;
    for (const box of document.querySelectorAll('#ui .modal-box, #ui .screen:not(.hidden) .page, #ui .as-page')) {
      if (!visible(box)) continue;
      const r = box.getBoundingClientRect();
      if (r.right > W + 2 || r.left < -2 || r.bottom > H + 2 || r.top < -2) layout.push({ path: cur.join(' > '), box: box.className, rect: [r.left, r.top, r.right, r.bottom].map(Math.round), screen: [W, H] });
      // anything inside that sticks out sideways (a row too wide for the box)
      for (const el of box.querySelectorAll('*')) {
        const q = el.getBoundingClientRect();
        if (q.width && q.right > W + 2 && getComputedStyle(el).position !== 'fixed') { layout.push({ path: cur.join(' > '), wide: el.className || el.tagName, right: Math.round(q.right), screen: W }); break; }
      }
    }
  };
  while (queue.length && clicks < max) {
    const node = queue.shift();
    cur = [node.start.name, ...node.path];
    await reset();
    try { node.start.open(); } catch (e) { errors.push({ path: cur.join(' > '), msg: 'open: ' + e.message }); continue; }
    await sleep(40);
    let ok = true;
    for (const s of node.path) {
      const el = found().find((e) => sig(e) === s);
      if (!el) { ok = false; if (misses.length < 60) misses.push({ path: cur.join(' > '), at: s, have: found().map(sig).slice(0, 8) }); break; }
      try { el.click(); } catch (e) { errors.push({ path: cur.join(' > '), msg: 'click: ' + e.message }); }
      clicks++;
      await sleep(40);
    }
    if (!ok) { missing++; continue; }
    if (cfg.layout) checkLayout();
    if (node.path.length >= depth) continue;
    for (const el of found()) {
      const s = sig(el), key = node.start.name + ':' + s;
      if (seen.has(key) || SKIP.test(s)) continue;
      seen.add(key);
      queue.push({ start: node.start, path: [...node.path, s] });
    }
    if (clicks % 50 < 4) await sleep(0);
  }
  await reset();
  window.removeEventListener('error', onErr); window.removeEventListener('unhandledrejection', onErr);
  console.error = conErr;
  const dedupe = (list, key) => { const m = new Map(); for (const x of list) if (!m.has(key(x))) m.set(key(x), x); return [...m.values()]; };
  return { clicks, pages: seen.size, missing, misses: cfg.debug ? misses : undefined, left: queue.length, errors: dedupe(errors, (e) => e.msg).slice(0, 40), layout: dedupe(layout, (l) => (l.box || l.wide) + l.path.split(' > ')[0]).slice(0, 40) };
}
