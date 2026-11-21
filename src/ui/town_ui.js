// Town screens, mixed into UI: the town HUD, "Choose your team" at Enter the Wild (drag or tap
// survivalmons into the slots), the Training Hall and the town menu.
import { iconURL } from '../gfx/assets.js';
import { artURL, npcFaceURL, setHeroLook } from '../gfx/art.js';
import { NPCS, npcLines, npcStage } from '../content/npcs.js';
import { playOpening, playEnding } from './story.js';
import { gateArrivalScene, friendTownScene, endingScene } from '../content/story_scenes.js';
import { gateSide } from '../content/gates.js';
import { HEROES } from '../content/heroes.js';
import { SPECIES, DEX_IDS } from '../content/species.js';
import { Box, monName } from '../systems/collection.js';
import { Goals } from '../systems/goals.js';
import { CHANGELOG, gameVersion, unseenUpdates, giftOpen, giftText } from '../content/changelog.js';
import { MATERIALS } from '../content/buildings.js';
import { ITEMS } from '../content/shop.js';
import { pickTile, skillName, viewMons, listBar, gridTile, listTools, lvDrawer, starBadge, stars, skillChips, statBars } from './mons_ui.js';
import { Ranking } from '../systems/ranking.js';
import { TIERS } from '../content/skills.js';
import { HERO_BOOST, HERO_UNLOCK } from '../content/gear.js';

import { Meta, TRAINING } from '../systems/meta.js';
import { GATE_SIDES, gateName, gateColor, gateBlurb } from '../content/gates.js';
import { Audio } from '../core/audio.js';
import { Input } from '../core/input.js';
import { Update, appVersion } from '../core/update.js';
import { Analytics } from '../systems/analytics.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const icon = (id, s = 3) => iconURL('icon', id, s);
const runTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// The ranking's tabs: what orders the players (bigger first; later numbers break ties), what each row
// shows, and which players are listed at all
const RANK_SHOW = 50;
const RANK_TABS = [
  { id: 'gate', name: 'Furthest gate', by: (r) => [r.gate, r.level], val: (r) => gateName(r.gate), sub: (r) => `Best level ${r.level}`, empty: 'No one is in the ranking yet.' },
  { id: 'run', name: 'Best run', by: (r) => [r.kills, r.level], val: (r) => `${r.kills.toLocaleString()} kills`, sub: (r) => `Best level ${r.level}`, empty: 'No one is in the ranking yet.' },
  { id: 'dex', name: 'Survidex', by: (r) => [r.dex], val: (r) => `${r.dex} / ${DEX_IDS.length}`, sub: () => 'survivalmons found', empty: 'No one is in the ranking yet.' },
  { id: 'lord', name: 'Night Lord', has: (r) => r.wins > 0, by: (r) => [r.wins, r.gate], val: (r) => `${r.wins} ${r.wins === 1 ? 'win' : 'wins'}`, sub: (r) => gateName(r.gate), empty: 'No one has beaten the Night Lord yet. Be the first!' },
  { id: 'mon', name: 'Strongest', has: (r) => !!r.mon, by: (r) => [r.power], title: (r) => r.mon.nick || SPECIES[r.mon.sp].name, val: (r) => `Power ${r.power.toLocaleString()}`,
    sub: (r) => `${r.name} · Lv ${r.mon.level}${r.mon.stars ? ` · ${'★'.repeat(r.mon.stars)}` : ''}`, empty: 'No survivalmons in the ranking yet.' },
];

// What the arrow says about each stop of the tour
const PLACE_WHY = { training: 'Spend coins on Run time', hatchery: 'Granny Wren is waiting', ranch: 'Where your survivalmons rest' };

export const TownUI = {
  // ------------------------------------------------------------ town HUD
  showTown() {
    this.hideScreens();
    this.screen = 'town';
    this.g.modal = null;
    this.g.syncTownPets?.();
    document.body.classList.add('in-town');
    const team = Box.team().map((m) => `<span class="t-mon ${m.hp <= 0 ? 'fainted' : ''}" title="${esc(monName(m))}"><img class="px" src="${artURL('creature', m.species) || icon('egg', 2)}" alt=""><b>${m.level}</b></span>`).join('');
    this.el.hud.innerHTML = `
      <div class="town-hud">
        <div class="town-chip panel"><img class="px" src="${icon('coin', 2)}" alt=""><b class="t-coins">${Meta.coins}</b><img class="px" src="${icon('spirit', 2)}" alt="Spirit"><b class="t-spirit">${Meta.spirit}</b><img class="px" src="${icon('shard', 2)}" alt="Skyfall Shards"><b class="t-shards">${Meta.shards}</b></div>
        <div class="town-chip panel t-team">${team || '<em>No team yet</em>'}</div>
      </div>
      <div class="town-chip panel t-run">Next run <b class="t-runlen">${runTime(Meta.runLength())}</b></div>
      <button class="town-chip panel t-goals" data-act="goals">📜 Goals <b class="t-goals-n"></b></button>
      <button class="town-chip panel t-news" data-act="news" ${unseenUpdates(Meta.data.seenVersion).length || Meta.giftWaiting() ? '' : 'hidden'}>✨ What's new</button>`;
    this.el.hud.classList.remove('hidden');
    this.th = { coins: this.el.hud.querySelector('.t-coins'), spirit: this.el.hud.querySelector('.t-spirit'), shards: this.el.hud.querySelector('.t-shards'), run: this.el.hud.querySelector('.t-runlen'), goals: this.el.hud.querySelector('.t-goals'), news: this.el.hud.querySelector('.t-news') };
    this.last = {};
    this.touch.setVisible(this.g.touchMode);
    Input.endFrame();
  },
  // The arrow to the next place to go (Meta.nextPlace): over its door, with its name, or at the edge
  // of the screen pointing the way when it's off screen. Hidden while anything else is going on.
  updatePlaceArrow() {
    const g = this.g, id = Meta.nextPlace();
    let el = this.placeArrow;
    const hide = () => { if (el) el.hidden = true; };
    if (!id || g.mode !== 'town' || this.screen !== 'town' || g.townRoom || g.scene || g.modal || this.guide || this.modalKind) return hide();
    let at = null, name = '', why = '';
    if (id === 'gate') {
      const n = g.town.npcs.find((x) => x.id === 'ollie');
      if (n) { at = [n.x, n.y - 30]; name = 'Ollie, North Gate'; why = 'Head out on a run'; }
    } else {
      const d = g.town.doors.find((x) => x.id === id);
      if (d) { at = [d.x, d.py - 4]; name = d.name; why = PLACE_WHY[id] || 'Just opened!'; }
    }
    if (!at) { Meta.visitPlace(id); return hide(); } // nowhere to point (no such door): skip it
    if (!el) {
      el = this.placeArrow = document.createElement('div');
      el.className = 'place-arrow';
      el.innerHTML = '<span class="pa-name"><b></b><small></small></span><span class="pa-tip">▼</span>';
      this.root.appendChild(el);
    }
    el.hidden = false;
    if (el.dataset.id !== id) { el.dataset.id = id; el.querySelector('b').textContent = name; el.querySelector('small').textContent = why; }
    const p = g.worldToScreen(at[0], at[1]), W = this.root.clientWidth, H = this.root.clientHeight;
    // kept clear of the HUD: the chips along the top, and taller stacks in the top corners
    const mx = 70, bottom = H - 70, safeTop = (sx) => (sx < 140 || sx > W - 140 ? 92 : 50);
    const on = p.x > 24 && p.x < W - 24 && p.y - 52 > safeTop(p.x) && p.y < H - 40;
    let x = p.x, y = p.y;
    if (!on) { x = Math.max(mx, Math.min(W - mx, x)); y = Math.max(safeTop(x) + 22, Math.min(bottom, y)); }
    el.classList.toggle('edge', !on);
    el.style.left = `${Math.round(x)}px`; el.style.top = `${Math.round(y)}px`;
    // off screen, the tip sits on the side of the label facing the place, and points at it
    if (on) { el.style.setProperty('--rot', '0deg'); el.style.setProperty('--dx', '0px'); el.style.setProperty('--dy', '0px'); }
    else {
      const a = Math.atan2(p.y - y, p.x - x), w = el.querySelector('.pa-name').offsetWidth / 2 + 10, h = 26;
      el.style.setProperty('--rot', `${Math.round(a * 180 / Math.PI - 90)}deg`);
      el.style.setProperty('--dx', `${Math.round(Math.cos(a) * w)}px`); el.style.setProperty('--dy', `${Math.round(Math.sin(a) * h)}px`);
    }
  },
  // ------------------------------------------------------------ what's new (content/changelog.js)
  // Every update's notes, newest first; the ones the player hasn't read yet are marked NEW. Opening
  // the page counts as reading them, so the button goes away until the next update.
  // Claims the gift that came with version v (once per save), then shows the page again with what it gave
  claimNewsGift(v) {
    const got = Meta.claimGift(v);
    if (!got) return;
    Analytics.track('gift_claim', { v });
    Audio.play('chest');
    this.openNews();
  },
  openNews() {
    const unseen = new Set(unseenUpdates(Meta.data.seenVersion).map((e) => e.v));
    Analytics.track('news_open', { unseen: unseen.size });
    Meta.data.seenVersion = gameVersion(); Meta.save();
    if (this.last) this.last.tnews = null;
    document.querySelectorAll('.t-news').forEach((b) => { b.hidden = true; });
    document.querySelectorAll('.news-pill').forEach((b) => b.classList.remove('glow'));
    if (this.g.mode === 'town') this.g.modal = 'news';
    this.prompt?.(null);
    const art = (n) => (n.img ? `<img class="news-img" src="${n.img}" alt="" loading="lazy">` : '')
      + (n.icons ? `<div class="news-icons">${n.icons.map((id) => `<img class="px" src="${iconURL('icon', id, 3)}" alt="">`).join('')}</div>` : '');
    const big = (n) => (typeof n === 'string' ? '' : `<div class="news-big"><h3>${esc(n.h)}</h3>${art(n)}<p>${esc(n.t)}</p></div>`);
    const small = (e) => e.notes.filter((n) => typeof n === 'string');
    // a gift that came with the update: a Claim button until this save has it (or its last day has passed)
    const gift = (e) => {
      const got = Meta.data.gifts?.[e.v];
      if (got) return `<div class="news-gift got"><b>🎁 Gift claimed</b><span>${esc(got.join(' · '))}</span></div>`;
      if (!giftOpen(e)) return '';
      return `<div class="news-gift"><b>🎁 A gift with this update</b><span>${esc(giftText(e.gift))}</span><button class="btn small" data-act="gift" data-v="${esc(e.v)}">Claim</button></div>`;
    };
    const entry = (e) => `<section class="news-v ${unseen.has(e.v) ? 'new' : ''}">
        <div class="news-head"><b>Version ${esc(e.v)}</b><span>${esc(e.date)}</span>${unseen.has(e.v) ? '<i class="news-new">NEW</i>' : ''}</div>
        ${gift(e)}
        ${e.notes.map(big).join('')}
        ${small(e).length ? `<ul class="news-small">${small(e).map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      </section>`;
    this.openModal(`
      <div class="modal-box panel news-box">
        <div class="ms-bar"><h2>What's new</h2><button class="btn small secondary ms-x" data-act="close" aria-label="Close">✕</button></div>
        ${CHANGELOG.filter((e, i) => unseen.has(e.v) || i < 8).map(entry).join('') || `<p class="news-empty">This is Survivalmon ${esc(gameVersion())}. Every update from here on will show up on this page.</p>`}
      </div>`);
    this.modalKind = 'news';
  },

  // ------------------------------------------------------------ goals (systems/goals.js)
  openGoals() {
    this.g.modal = 'goals';
    this.prompt(null);
    const act = Goals.active();
    const rew = (r) => {
      const chip = (ic, text) => `<span class="g-rew">${ic ? `<img class="px" src="${icon(ic, 2)}" alt="">` : ''}${esc(text)}</span>`;
      const out = [];
      if (r.coins) out.push(chip('coin', r.coins.toLocaleString()));
      if (r.spirit) out.push(chip('spirit', String(r.spirit)));
      for (const [k, n] of Object.entries(r.mats || {})) out.push(chip(MATERIALS[k]?.icon, `${n} ${MATERIALS[k]?.name || k}`));
      if (r.item) { const it = ITEMS.find((x) => x.id === r.item[0]); if (it) out.push(chip(it.icon, it.name)); }
      if (r.evo) out.push(chip('stone_fairy', r.evo > 1 ? `${r.evo} evolution stones` : 'Evolution stone'));
      if (r.egg) out.push(chip('egg', r.egg > 1 ? `${r.egg} eggs` : 'An egg'));
      return out.join('');
    };
    const card = (g) => {
      const done = Goals.done(g), pct = Math.min(100, Math.round((Goals.have(g) / g.need) * 100));
      return `<div class="goal ${done ? 'done' : ''}">
        <div class="goal-top"><span class="goal-n">${Goals.number(g)}</span><b>${esc(g.text)}</b><span class="goal-p">${done ? 'Done!' : Goals.progressText(g)}</span></div>
        <div class="goal-bar"><i style="width:${pct}%"></i></div>
        <div class="goal-foot"><span class="goal-rews">${rew(g.rew)}</span>${done ? `<button class="btn small" data-act="goal-claim" data-id="${g.id}">Claim</button>` : ''}</div>
      </div>`;
    };
    this.openModal(`
      <div class="modal-box panel goals-box">
        <div class="ms-bar"><h2>Goals</h2><button class="btn small secondary ms-x" data-act="close" aria-label="Close">✕</button></div>
        ${act.length ? act.map(card).join('') : '<p>Every goal is done. You are a true ranger!</p>'}
        <p class="small goals-note">Goal ${act.length ? Goals.number(act[0]) : Goals.total} of ${Goals.total}. A new one comes up each time you claim one. (Achievements in the Survidex pay Skyfall Shards.)</p>
      </div>`);
    this.modalKind = 'goals';
  },
  claimGoal(id) {
    const got = Goals.claim(id);
    if (!got) return;
    Audio.play('coin'); Audio.play('levelup');
    this.toast(`Goal claimed! ${got.join(', ')}`);
    this.last.tgoals = null;
    this.updateTownHUD?.();
    this.openGoals();
  },
  // ------------------------------------------------------------ ranking (systems/ranking.js)
  // Every player's best results, one tab per ranking. Your own row is marked, and shown again under
  // the list when you're further down. In Strongest, tapping a row opens that survivalmon's card.
  openRanking(force = false) {
    if (this.g.mode === 'town') this.g.modal = 'ranking';
    this.prompt?.(null);
    this.rankTab ||= 'gate';
    this.rankMon = null; this.rankRows = null; this.rankState = 'loading';
    this.openModal(`
      <div class="modal-box panel rank-box">
        <div class="ms-bar"><h2>🏆 Ranking</h2><button class="btn small secondary ms-x" data-act="close" aria-label="Close">✕</button></div>
        <div class="rank-tabs">${RANK_TABS.map((t) => `<button class="btn small" data-act="rank-tab" data-t="${t.id}">${t.name}</button>`).join('')}</div>
        <div class="rank-body"></div>
        <div class="rank-foot small"></div>
      </div>`);
    this.modalKind = 'ranking';
    if (!Ranking.ready) { this.rankState = 'off'; this.renderRanking(); return; }
    this.renderRanking();
    if (this.g.mode === 'town') this.tip('b_hall');
    const ask = this.rankAsk = (this.rankAsk || 0) + 1;
    const still = () => ask === this.rankAsk && this.modalKind === 'ranking';
    (async () => {
      await Ranking.submit(this.g.best); // your newest results first, so you see them in the list
      try { const rows = await Ranking.list(force); if (still()) { this.rankRows = rows; this.rankState = 'ok'; this.renderRanking(); } }
      catch { if (still()) { this.rankState = 'error'; this.renderRanking(); } }
    })();
  },
  renderRanking() {
    const box = this.el.modal.querySelector('.rank-box');
    if (!box) return;
    const tab = RANK_TABS.find((t) => t.id === this.rankTab) || RANK_TABS[0];
    box.querySelectorAll('[data-act="rank-tab"]').forEach((b) => b.classList.toggle('secondary', b.dataset.t !== tab.id));
    const body = box.querySelector('.rank-body'), me = Ranking.myId;
    const on = Ranking.on, foot = box.querySelector('.rank-foot');
    if (this.rankState === 'off') {
      foot.innerHTML = '';
      body.innerHTML = '<p class="rank-msg">The board is kept in the online game, at harel-ben-or.github.io/survivalmon. This copy of the game can\'t reach it.</p>';
      return;
    }
    foot.innerHTML = `<span>${on ? 'Everyone sees your game name and best results.' : "You're hidden: the others don't see you."}</span>
      <button class="btn small secondary" data-act="rank-toggle">${on ? 'Hide me' : 'Show me'}</button>`;
    if (this.rankState === 'loading') { body.innerHTML = '<p class="rank-msg">Loading the ranking…</p>'; return; }
    if (this.rankState === 'error') { body.innerHTML = '<p class="rank-msg">Couldn\'t reach the ranking. Check your connection, then <button class="btn small" data-act="rank-retry">Try again</button></p>'; return; }
    // a survivalmon's card (Strongest)
    const pick = this.rankMon && this.rankRows.find((r) => r.id === this.rankMon);
    if (pick?.mon) {
      const m = pick.mon, name = m.nick || SPECIES[m.sp].name;
      body.innerHTML = `<div class="rank-card">
        <button class="btn small secondary" data-act="rank-back">‹ Back</button>
        <div class="rank-card-top"><img class="px" src="${artURL('creature', m.sp) || icon('egg', 3)}" alt="">
          <div><h3>${esc(name)}</h3><div class="small">${m.nick ? `${esc(SPECIES[m.sp].name)} · ` : ''}Lv ${m.level} ${stars(m)}</div>
          <div class="small">${esc(pick.name)}${pick.id === me ? ' (you)' : ''} · Power <b>${pick.power.toLocaleString()}</b></div></div></div>
        ${statBars(m.stats)}
        <div class="rank-skills">${skillChips(m)}</div>
      </div>`;
      return;
    }
    const rows = this.rankRows.filter(tab.has || (() => true));
    rows.sort((a, b) => { const x = tab.by(a), y = tab.by(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return y[i] - x[i]; return a.name.localeCompare(b.name); });
    // equal results share a place: 1, 1, 3
    let pos = 0;
    rows.forEach((r, i) => { if (!i || String(tab.by(r)) !== String(tab.by(rows[i - 1]))) pos = i + 1; r.pos = pos; });
    const row = (r) => `<div class="rank-row ${r.id === me ? 'me' : ''} ${tab.id === 'mon' ? 'tap' : ''}" ${tab.id === 'mon' ? `data-act="rank-mon" data-id="${esc(r.id)}"` : ''}>
        <b class="rank-pos ${r.pos <= 3 ? `p${r.pos}` : ''}">${r.pos}</b>
        ${tab.id === 'mon' ? `<img class="px rank-pic" src="${artURL('creature', r.mon.sp) || icon('egg', 2)}" alt="">` : ''}
        <span class="rank-name"><b>${esc(tab.title ? tab.title(r) : r.name)}${r.id === me ? '<i class="rank-you">you</i>' : ''}</b><small>${esc(tab.sub(r))}</small></span>
        <b class="rank-val">${esc(tab.val(r))}</b>
      </div>`;
    const top = rows.slice(0, RANK_SHOW), mine = rows.find((r) => r.id === me);
    body.innerHTML = rows.length
      ? `${top.map(row).join('')}${mine && mine.pos > RANK_SHOW ? `<div class="rank-gap">⋯</div>${row(mine)}` : ''}`
      : `<p class="rank-msg">${tab.empty}</p>`;
  },
  rankAct(act, el) {
    if (act === 'rank-tab') { this.rankTab = el.dataset.t; this.rankMon = null; Audio.play('click'); this.renderRanking(); }
    else if (act === 'rank-mon') { this.rankMon = el.dataset.id; Audio.play('click'); this.renderRanking(); }
    else if (act === 'rank-back') { this.rankMon = null; this.renderRanking(); }
    else if (act === 'rank-retry') this.openRanking(true);
    else if (act === 'rank-toggle') {
      const g = this.g;
      g.settings.rank = g.settings.rank === false; g.saveSettings();
      Audio.play('click');
      (g.settings.rank ? Ranking.submit(g.best) : Ranking.leave()).finally(() => { if (this.modalKind === 'ranking') this.openRanking(true); });
    }
  },

  updateTownHUD() {
    this.set('tcoins', this.th.coins, 'text', String(Meta.coins));
    if (this.th.spirit) this.set('tspirit', this.th.spirit, 'text', String(Meta.spirit));
    if (this.th.shards) this.set('tshards', this.th.shards, 'text', String(Meta.shards));
    this.set('trun', this.th.run, 'text', runTime(Meta.runLength()));
    // the Goals button lights up with how many are ready to claim
    const ready = Goals.ready();
    // the What's new button shows while there are updates the player hasn't read, or a gift to claim
    const news = unseenUpdates(Meta.data.seenVersion).length > 0 || Meta.giftWaiting();
    if (this.th.news && this.last.tnews !== news) { this.last.tnews = news; this.th.news.hidden = !news; }
    if (news && this.screen === 'town' && !this.g.modal) this.tip('news');
    if (this.th.goals && this.last.tgoals !== ready) { this.last.tgoals = ready; this.th.goals.classList.toggle('ready', ready > 0); this.th.goals.querySelector('b').textContent = ready ? String(ready) : ''; }
  },

  // ------------------------------------------------------------ Enter the Wild: choose your team
  // side: the gate you came in by picks its newest tier (Ollie and "Run again" keep the last one)
  showTeam(side) {
    const i = GATE_SIDES.indexOf(side);
    if (i >= 0 && i <= Meta.gates) { Meta.data.gateTier = i + 4 * Math.floor((Meta.gates - i) / 4); Meta.save(); }
    this.heroOpen = false;
    this.renderTeam();
  },
  // Left: the hero (tap to change), the gate, and the team's slots as rows. Right: every survivalmon as
  // a tile (tap one to put it in the first empty slot or take it out; drag onto a slot to place it).
  // The run button sits at the bottom-right, clear of both lists.
  renderTeam() {
    const team = Box.team(), hero = Meta.hero, size = Box.teamSize();
    const row = (i) => {
      const m = team[i];
      if (!m) return `<div class="team-slot t2-slot empty" data-slot="${i}"><span>+ empty slot</span></div>`;
      return `<div class="team-slot t2-slot filled ${m.hp <= 0 ? 'fainted' : ''}" data-slot="${i}">
        <img class="px" src="${artURL('creature', m.species)}" alt="">
        <div class="t2-main"><b>${esc(monName(m))}</b><span class="small">${m.hp <= 0 ? 'Fainted' : `Lv ${m.level}`} ${starBadge(m)}</span>
          <span class="g-grades">${m.skills.map((k) => `<b class="tier t${k.t} ${k.k === 'u' ? 'u' : ''}" title="${esc(skillName(k))}">${TIERS[k.t]}</b>`).join('')}</span>
          <div class="hp-bar ${m.hp <= 0 ? 'out' : m.hp < 0.3 ? 'low' : ''}"><div style="width:${Math.round(m.hp * 100)}%"></div></div></div>
        <button class="pt-info" data-mact="mon-open" data-id="${m.id}" aria-label="Stats and skills">i</button><i class="t2-x" aria-hidden="true">✕</i></div>`;
    };
    const pool = viewMons('team', Box.mons);
    this.sheetList = pool.map((m) => m.id);
    const heroes = this.heroOpen ? `<div class="hero-pick t2-heroes">${HEROES.map((h) => `<button class="hero-chip ${h.id === hero ? 'sel' : ''} ${Meta.isHeroUnlocked(h.id) ? '' : 'locked'}" data-pickhero="${h.id}">
        <img class="px" src="${artURL('hero', h.id) || iconURL('hero', h.id, 2)}" alt=""><span>${Meta.isHeroUnlocked(h.id) ? esc(Meta.heroName(h.id)) : '🔒'}</span></button>`).join('')}</div>` : '';
    const gate = Meta.gates ? `<label class="t2-gate"><span class="small">Gate</span><select data-mact-change="gate-tier" aria-label="Gate">${Array.from({ length: Meta.gates + 1 }, (_, t) => `<option value="${t}" ${t === Math.min(Meta.data.gateTier || 0, Meta.gates) ? 'selected' : ''}>${esc(gateName(t))}</option>`).join('')}</select></label>` : '';
    const col = `<aside class="t2-col">
        <button class="t2-hero" data-mact="hero-toggle"><img class="px" src="${artURL('hero', hero) || iconURL('hero', hero, 2)}" alt=""><span><b>${esc(Meta.heroName(hero))} ›</b><span class="small">${esc(HERO_BOOST[hero].text)}</span></span></button>
        ${heroes}${gate}
        ${Meta.bagSize() ? `<div class="small buffs"><img class="px inline-ic" src="${icon('bag', 2)}" alt=""> ${Meta.bagSize()} item${Meta.bagSize() === 1 ? '' : 's'} in your bag (B in a run)</div>` : ''}
        <div class="t2-slots">${Array.from({ length: size }, (_, i) => row(i)).join('')}</div>
        ${this.buildingPanel('gate')}
      </aside>`;
    const tiles = pool.map((m) => gridTile(m, { act: 'team-tap', cls: `team-pick ${Box.inTeam(m.id) ? 'picked' : ''}`, attrs: `data-mon="${m.id}"` })).join('');
    const right = `<section class="t2-pool">${Box.mons.length ? `${tiles ? `<div class="g-grid team-pool">${tiles}</div>` : '<p class="sub-note">None match these filters.</p>'}`
      : `<p class="sub-note">${Box.eggs.length ? 'Your first egg is still warming in the Hatchery. Run alone for now!' : 'No survivalmons yet'}</p>`}</section>`;
    const tier = Math.min(Meta.data.gateTier || 0, Meta.gates);
    this.page('team', `<div class="team-screen team2">${col}${right}</div>`, {
      title: `Team ${team.length}/${size}`, noBuilding: true,
      tools: Box.mons.length ? listTools('team') : '',
      chips: Meta.gates && tier ? `<span class="pg-chip" style="color:${gateColor(tier)}">${esc(gateName(tier))}</span>` : '',
      foot: `<button class="btn go-btn" data-act="go">${Meta.gates ? `Through the ${esc(gateName(tier))}!` : "Let's run!"} <small>${runTime(Meta.runLength())}</small></button>`,
      drawer: lvDrawer('team', this.lvOpen === 'team'),
    });
    this.bindTeamDrag();
    this.el.select.querySelector('.t2-gate select')?.addEventListener('change', (e) => { Meta.data.gateTier = +e.target.value; Meta.save(); Audio.play('click'); this.renderTeam(); });
  },
  // A short drag lifts a survivalmon onto the slot under your finger; a tap adds or removes it.
  bindTeamDrag() {
    const root = this.el.select.querySelector('.team-screen');
    let drag = null;
    const slotAt = (x, y) => document.elementFromPoint(x, y)?.closest('.team-slot');
    const mark = (s) => root.querySelectorAll('.team-slot').forEach((el) => el.classList.toggle('over', el === s));
    const move = (e) => {
      if (!drag || e.pointerId !== drag.pid) return;
      if (!drag.ghost) {
        if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 8) return;
        drag.ghost = drag.el.querySelector('img').cloneNode();
        drag.ghost.className = 'px drag-ghost';
        document.body.appendChild(drag.ghost);
        drag.el.classList.add('dragging');
      }
      drag.ghost.style.left = `${e.clientX}px`; drag.ghost.style.top = `${e.clientY}px`;
      mark(slotAt(e.clientX, e.clientY));
    };
    const end = (e) => {
      if (!drag || e.pointerId !== drag.pid) return;
      const d = drag;
      drag = null;
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', end);
      document.removeEventListener('pointercancel', end);
      d.ghost?.remove();
      d.el.classList.remove('dragging');
      mark(null);
      if (e.type === 'pointercancel') return; // the list scrolled instead
      if (d.ghost) {
        const s = slotAt(e.clientX, e.clientY);
        if (!s) return;
        Box.setTeamSlot(+s.dataset.slot, d.id);
      } else if (!Box.toggleTeam(d.id)) { this.toast(`Your team is full (${Box.teamSize()}). Tap a slot to make room.`); return; }
      Audio.play('click');
      this.renderTeam();
    };
    root.querySelectorAll('.team-pick').forEach((el) => el.addEventListener('pointerdown', (e) => {
      if (drag || e.target.closest('.pt-info')) return; // the i button opens the sheet instead
      if (e.button === 2) return;
      drag = { pid: e.pointerId, id: +el.dataset.mon, el, x0: e.clientX, y0: e.clientY, ghost: null };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', end);
      document.addEventListener('pointercancel', end);
    }));
    root.querySelectorAll('.team-slot.filled').forEach((el) => el.addEventListener('click', (e) => {
      if (e.target.closest('.pt-info')) return;
      e.stopPropagation();
      const m = Box.team()[+el.dataset.slot];
      if (!m) return;
      Box.toggleTeam(m.id);
      Audio.play('click');
      this.renderTeam();
    }));
  },
  // Every gate opened so far, the one picked lit up, with what it does
  gatePicker() {
    const sel = Math.min(Meta.data.gateTier || 0, Meta.gates);
    const chips = Array.from({ length: Meta.gates + 1 }, (_, t) => `<button class="gate-chip ${t === sel ? 'sel' : ''}" data-mact="gate-tier" data-tier="${t}" style="--gc:${gateColor(t)}">${gateName(t)}${t === Meta.gates ? '<small>newest</small>' : ''}</button>`).join('');
    return `<div class="gate-pick panel"><div class="team-label">Gate</div><div class="gate-chips">${chips}</div><div class="small gate-blurb">${gateBlurb(sel)}</div></div>`;
  },
  heroToggle() { this.heroOpen = !this.heroOpen; Audio.play('click'); this.renderTeam(); },
  pickHero(id) {
    if (!Meta.isHeroUnlocked(id)) { this.toast(`${HERO_UNLOCK[id].text}.`); return; }
    Meta.setHero(id);
    Audio.play('click');
    this.heroOpen = false;
    this.renderTeam();
  },

  // ------------------------------------------------------------ Training Hall
  showTraining() {
    this.prompt(null);
    this.renderTraining();
  },
  renderTraining() {
    const sel = TRAINING.find((u) => u.id === this.trainSel) || TRAINING.find((u) => Meta.cost(u.id) !== null) || TRAINING[0];
    this.trainSel = sel.id;
    const rows = TRAINING.map((u) => {
      const L = Meta.level(u.id), cost = Meta.cost(u.id), maxed = cost === null;
      const now = L || u.id === 'runtime' ? u.desc(L) : 'Not trained yet';
      return `<div class="u-row ${maxed ? 'maxed' : ''} ${u.id === sel.id ? 'on' : ''}" data-mact="train-sel" data-u="${u.id}">
        <img class="px" src="${icon(u.icon, 3)}" alt="">
        <div class="u-info"><b>${u.name}</b> <span class="lvl">${maxed ? 'MAX' : `${L}/${Meta.maxLevel(u)}`}</span>
          <div class="small u-next">${esc(now)}${maxed ? '' : ` → ${esc(u.desc(L + 1))}`}</div></div>
        <span class="u-cost ${!maxed && cost > Meta.coins ? 'short' : ''}">${maxed ? 'MAX' : cost}</span>
        ${maxed ? '' : `<button class="btn small buy-btn u-buy" data-buy="${u.id}" ${cost <= Meta.coins ? '' : 'disabled'}>Buy · ${cost}</button>`}
      </div>`;
    }).join('');
    const L = Meta.level(sel.id), cost = Meta.cost(sel.id), maxed = cost === null;
    const detail = `<div class="u-detail panel"><div class="u-dh"><img class="px" src="${icon(sel.icon, 4)}" alt=""><div><b>${sel.name}</b><div class="small">Level ${L} of ${Meta.maxLevel(sel)}</div></div></div>
      <div class="u-now">Now: <b>${esc(L || sel.id === 'runtime' ? sel.desc(L) : 'Not trained yet')}</b></div>
      ${maxed ? '<div class="u-now">This is as far as it goes here.</div>' : `<div class="u-now">Next: <b class="u-up">${esc(sel.desc(L + 1))}</b></div>
      <button class="btn go-btn u-go" data-buy="${sel.id}" ${cost <= Meta.coins ? '' : 'disabled'}>Upgrade · ${cost}</button>`}</div>`;
    this.page('training', `<div class="u-split"><div class="u-list">${rows}${this.buildingPanel('training')}</div>${detail}</div>`, {
      title: 'Training Hall', noBuilding: true,
      chips: `<span class="pg-chip"><img class="px inline-ic" src="${icon('coin', 2)}" alt="Coins"> ${Meta.coins}</span>`,
    });
  },
  buyTraining(id) {
    Audio.play(Meta.buy(id) ? 'levelup' : 'click');
    this.trainSel = id;
    this.renderTraining();
  },

  // ------------------------------------------------------------ talking to the villagers
  // The talk box: their face, name and a line, with the building's button (keepers), Chat and Bye
  // A gate's guard turns you back until you've beaten the Night Lord past the gate before
  gateBlocked(id) { const def = NPCS[id]; return !!def.blocked && def.tier > Meta.gates; },
  talkLines(id) { return this.gateBlocked(id) ? NPCS[id].blocked : npcLines(id, this.talkStage()); },
  openTalk(n) {
    const def = NPCS[n.id], lines = this.talkLines(n.id), blocked = this.gateBlocked(n.id);
    const i = def.hello && !blocked ? -1 : blocked ? 0 : Math.floor(Math.random() * lines.length);
    this.talk = { n, i, text: this.withName(i < 0 ? def.hello : lines[i] || '...') };
    this.g.modal = 'talk';
    this.prompt(null);
    this.renderTalk();
  },
  talkStage() { return npcStage(Meta.data.bestTime || 0, Box.mons.length); },
  withName(t) { return t.replace(/\{name\}/g, Meta.heroName(Meta.hero)); },
  renderTalk() {
    const { n, text } = this.talk, def = NPCS[n.id];
    this.openModal(`
      <div class="talk-box panel">
        <img class="px talk-face" src="${npcFaceURL(n.id)}" alt="">
        <div class="talk-main">
          <div class="talk-name"><b>${esc(def.name)}</b><span>${esc(def.role)}</span></div>
          <p class="talk-text">${esc(text)}</p>
          <div class="talk-actions">
            ${def.act && !this.gateBlocked(n.id) ? `<button class="btn small" data-talk="act">${esc(def.act[0])} <span class="key">E</span></button>` : ''}
            <button class="btn small secondary" data-talk="chat">Chat${def.act && !this.gateBlocked(n.id) ? '' : ' <span class="key">E</span>'}</button>
            <button class="btn small secondary" data-talk="bye">Bye <span class="key">Esc</span></button>
          </div>
        </div>
      </div>`);
    this.modalKind = 'talk';
    this.el.modal.classList.add('talk-modal');
  },
  talkAct(what) {
    if (what.startsWith('name-')) { this.nameAct(what); return; }
    if (what.startsWith('look-') || what.startsWith('creator-')) { this.creatorAct(what); return; }
    if (what === 'seq-next') { this.seqNext?.(); return; }
    if (!this.talk) return;
    const { n } = this.talk, def = NPCS[n.id];
    if (what === 'chat') {
      const lines = this.talkLines(n.id);
      this.talk.i = (this.talk.i + 1) % lines.length;
      this.talk.text = this.withName(lines[this.talk.i] || '...');
      this.renderTalk();
      return;
    }
    this.closeModal();
    this.el.modal.classList.remove('talk-modal');
    this.modalKind = null; this.talk = null;
    n.talking = false;
    this.g.modal = null;
    Input.endFrame();
    if (what === 'act' && def.act && !this.gateBlocked(n.id)) this[def.act[1]]?.(def.gate);
  },

  // ------------------------------------------------------------ the player's name
  // Ollie at the gate asks who you are, the first time you come to town as the main character;
  // the town menu can ask again. The name is used everywhere the main character's name shows.
  openNaming(fromMenu = false) {
    this.g.modal = 'naming';
    this.prompt(null);
    this.namingFromMenu = fromMenu;
    this.openModal(`
      <div class="talk-box panel">
        <img class="px talk-face" src="${npcFaceURL('ollie')}" alt="">
        <div class="talk-main">
          <div class="talk-name"><b>Ollie</b><span>Gate guard</span></div>
          <p class="talk-text">${fromMenu ? 'A new name? Go on, tell me.' : (Meta.data.runs || 0) <= 1 ? 'Halt! You came up the crater road? Then you have seen it: the wild is not safe any more. What do they call you, traveller?' : 'Halt! A new face. What do they call you, traveller?'}</p>
          <div class="talk-actions name-row">
            <input class="name-input" maxlength="14" value="${esc(Meta.playerName)}" aria-label="Your name" autocomplete="off" spellcheck="false" enterkeyhint="done">
            <button class="btn small" data-talk="name-ok">That's me</button>
            ${fromMenu ? '<button class="btn small secondary" data-talk="name-cancel">Cancel</button>' : ''}
          </div>
        </div>
      </div>`);
    this.modalKind = 'naming';
    this.el.modal.classList.add('talk-modal');
    const inp = this.el.modal.querySelector('.name-input');
    setTimeout(() => { inp?.focus(); inp?.select(); }, 60);
  },
  nameAct(what) {
    if (what === 'name-ok') {
      const first = !this.namingFromMenu;
      const name = Meta.setName(this.el.modal.querySelector('.name-input')?.value);
      Audio.play('levelup');
      this.el.modal.querySelector('.talk-text').textContent = first
        ? `Welcome to the village, ${name}! Granny Wren keeps the eggs at the Hatchery. Off you go, and mind the Blight.`
        : `${name} it is. I will tell the others.`;
      this.el.modal.querySelector('.name-row').innerHTML = '<button class="btn small" data-talk="name-done">Bye <span class="key">E</span></button>';
      this.modalKind = 'naming-done';
      return;
    }
    // name-cancel or name-done
    this.closeModal();
    this.el.modal.classList.remove('talk-modal');
    this.modalKind = null;
    this.g.modal = null;
    Input.endFrame();
    if (what === 'name-done' && !this.namingFromMenu) this.tip('town'); // Moss shows a new player round
  },

  // ------------------------------------------------------------ who you are: a boy or a girl, and a name
  // Asked at the start of every new game (a new player), and again from the town menu. Your friends and
  // everything you've earned stay; only your look and name change.
  openCreator(fromMenu = false) {
    return new Promise((resolve) => {
      this.creatorDone = resolve;
      this.creatorFromMenu = fromMenu;
      this.creatorLook = Meta.gender || 'boy';
      this.g.modal = 'creator';
      this.prompt(null);
      this.renderCreator();
    });
  },
  renderCreator() {
    const look = (gd, label) => `<button class="creator-look ${this.creatorLook === gd ? 'sel' : ''}" data-talk="look-${gd}"><img class="px" src="${artURL('hero', gd === 'girl' ? 'you_girl' : 'you_boy')}" alt=""><span>${label}</span></button>`;
    const name = this.el.modal.querySelector('.name-input')?.value ?? (Meta.data.name || '');
    this.openModal(`
      <div class="modal-box panel creator-box">
        <h2>${this.creatorFromMenu ? 'Your character' : 'Who are you?'}</h2>
        <div class="lvl-sub">A ranger trainee from Brightnest. Are you a boy or a girl?</div>
        <div class="creator-looks">${look('boy', 'Boy')}${look('girl', 'Girl')}</div>
        <div class="name-row creator-name"><span>Your name</span><input class="name-input" maxlength="14" value="${esc(name)}" placeholder="Your name" aria-label="Your name" autocomplete="off" spellcheck="false" enterkeyhint="done"></div>
        <div class="loot-actions"><button class="btn" data-talk="creator-ok">${this.creatorFromMenu ? 'Done' : 'Begin'} <span class="key">Enter</span></button>${this.creatorFromMenu ? '<button class="btn secondary" data-talk="creator-cancel">Cancel</button>' : ''}</div>
      </div>`);
    this.modalKind = 'creator';
  },
  creatorAct(what) {
    if (what === 'look-boy' || what === 'look-girl') { this.creatorLook = what.slice(5); this.renderCreator(); return; }
    if (what === 'creator-ok') {
      const v = this.el.modal.querySelector('.name-input')?.value;
      Meta.setGender(this.creatorLook);
      Meta.setName(v || Meta.data.name || 'Ranger');
      setHeroLook(Meta.gender);
      this.g.dressHeroes();
      Audio.play('levelup');
    }
    this.closeModal();
    this.modalKind = null;
    this.g.modal = null;
    Input.endFrame();
    const done = this.creatorDone; this.creatorDone = null;
    if (this.g.mode === 'town') this.showTown();
    done?.(what === 'creator-ok');
  },

  // ------------------------------------------------------------ story scenes in the talk box
  // lines: [{ who: an NPC id, a hero id, 'you' or 'crowd', text }] shown one at a time
  talkSeq(lines, done) {
    let i = 0;
    this.g.modal = 'talkseq';
    this.prompt(null);
    const show = () => {
      const L = lines[i], who = L.who;
      const npc = NPCS[who], hero = who === 'you' ? 'rowan' : HEROES.some((h) => h.id === who) ? who : null;
      const face = npc ? npcFaceURL(who) : hero ? artURL('hero', hero) : npcFaceURL(L.face || 'tib');
      const name = who === 'you' ? Meta.playerName : npc ? npc.name : hero ? Meta.heroName(hero) : L.name || 'Townsfolk';
      const role = L.role ?? (npc ? npc.role : hero && who !== 'you' ? 'Your friend' : who === 'you' ? 'You' : 'A crowd at the gate');
      this.openModal(`
        <div class="talk-box panel">
          <img class="px talk-face" src="${face}" alt="">
          <div class="talk-main">
            <div class="talk-name"><b>${esc(name)}</b><span>${esc(role)}</span></div>
            <p class="talk-text">${esc(this.withName ? this.withName(L.text) : L.text)}</p>
            <div class="talk-actions"><button class="btn small" data-talk="seq-next">${i < lines.length - 1 ? 'Next' : 'OK'} <span class="key">E</span></button></div>
          </div>
        </div>`);
      this.el.modal.classList.add('talk-modal');
      this.modalKind = 'talkseq';
    };
    this.seqNext = () => {
      i++;
      if (i < lines.length) { show(); return; }
      this.seqNext = null;
      this.closeModal();
      this.el.modal.classList.remove('talk-modal');
      this.modalKind = null;
      this.g.modal = null;
      Input.endFrame();
      done?.();
    };
    show();
  },
  // On arriving in town: the story's next beat, if there is one. Returns true when one started.
  storyBeats(found = []) {
    const after = (fn) => () => { Meta.save(); fn(); };
    // an old save that has no look yet: ask once
    if (!Meta.gender && Meta.data.runs) { this.openCreator(false).then(() => this.storyBeats(found)); return true; }
    // the first time at Hearthvale: the townsfolk gather round you at the gate, Hollis's name, Granny Wren
    if (!Meta.data.metWren && Meta.data.sawOpening && ((Meta.data.runs || 0) <= 2 || this.g.fromRoad)) {
      this.g.fromRoad = false;
      Meta.data.metWren = true;
      Meta.data.tour = ['training', 'hatchery', 'ranch', 'gate']; // the arrow shows the way round town
      this.g.playScene(gateArrivalScene(this.g)).then(after(() => { if (!this.storyBeats(found)) this.tip('town'); }));
      return true;
    }
    // a friend found past a gate walks in with you
    if (found.length) {
      const id = found[0];
      this.g.playScene(friendTownScene(this.g, id, gateSide(this.g.tier || 0))).then(after(() => { this.storyBeats(found.slice(1)); }));
      return true;
    }
    // past the West Gate Lv 4: the Scar, then Granny Wren comes to meet you
    if (Meta.data.allGates && !Meta.data.sawEnding) {
      Meta.data.sawEnding = true;
      this.g.modal = 'story';
      playEnding({ root: this.root }).then(() => {
        this.g.modal = null; this.showTown();
        this.g.playScene(endingScene(this.g, gateSide(this.g.tier || 0))).then(after(() => {}));
      });
      return true;
    }
    return false;
  },

  // ------------------------------------------------------------ the opening story
  // A new game: the opening plays, the egg is picked inside it, and its escape is the first run
  // (which ends at the village gate, where Ollie asks your name).
  async startOpening() {
    Analytics.track('opening_start');
    if (!Meta.gender) await this.openCreator(false); // a new game: boy or girl, and your name, first
    this.hideScreens();
    this.screen = 'story';
    await playOpening({ root: this.root, onPick: (id) => this.chooseStarter(id, true) });
    if (Box.isEmpty && !Box.eggs.length) { this.showStarter(); return; } // no egg picked: the old way
    Meta.data.sawOpening = true; Meta.save();
    Box.save();
    this.g.startRun(Meta.hero);
  },
  // Watch it again from the town menu
  async replayOpening() {
    this.closeModal();
    this.g.modal = 'story';
    this.el.hud.classList.add('hidden');
    await playOpening({ root: this.root, replay: true });
    this.g.modal = null;
    this.showTown();
  },

  // ------------------------------------------------------------ town menu (pause button / Esc)
  openTownMenu() {
    this.g.modal = 'townmenu';
    this.prompt(null);
    this.openModal(`
      <div class="modal-box panel town-menu">
        <h2>Survivalmon</h2>
        <div class="loot-actions">
          <button class="btn small secondary" data-act="controls">📱 ${this.controlsLabel()}</button>
          ${document.fullscreenEnabled ? '<button class="btn small secondary" data-act="fullscreen">⛶ Fullscreen</button>' : ''}
          ${this.iosCanAdd() ? '<button class="btn small secondary" data-act="iosfs">📲 Full screen</button>' : ''}
          <button class="btn small secondary" data-act="music">${this.musicLabel()}</button>
          <button class="btn small secondary" data-act="guide">${this.guideLabel()}</button>
          <button class="btn small secondary" data-act="stats" title="Anonymous stats (no names) help make the game better">${this.statsLabel()}</button>
        </div>
        <div class="loot-actions">
          <button class="btn" data-act="leave">Back to town <span class="key">Esc</span></button>
          <button class="btn secondary" data-act="help">How to play</button>
          <button class="btn secondary" data-act="opening">▶ Watch the opening</button>
          <button class="btn secondary" data-act="news">✨ What's new</button>
          <button class="btn secondary" data-act="rename-player">✎ Your character: ${esc(Meta.playerName)}</button>
          <button class="btn secondary" data-act="profiles">👤 Players</button>
          <button class="btn secondary" data-act="title">Title screen</button>
        </div>
        ${appVersion() ? `<div class="app-version">Version ${esc(appVersion())}</div>` : ''}
      </div>`);
    this.modalKind = 'townmenu';
  },
};
