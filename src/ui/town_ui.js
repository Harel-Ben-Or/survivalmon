// Town screens, mixed into UI: the town HUD, "Choose your team" at Enter the Wild (drag or tap
// survivalmons into the slots), the Training Hall and the town menu.
import { iconURL } from '../gfx/assets.js';
import { artURL, npcFaceURL } from '../gfx/art.js';
import { NPCS, npcLines, npcStage } from '../content/npcs.js';
import { playOpening } from './story.js';
import { HEROES } from '../content/heroes.js';
import { SPECIES } from '../content/species.js';
import { Box, monName } from '../systems/collection.js';
import { pickTile, skillName, viewMons, listBar, gridTile, listTools, lvDrawer } from './mons_ui.js';
import { TIERS } from '../content/skills.js';
import { HERO_BOOST, HERO_UNLOCK } from '../content/gear.js';
import { MERCHANT_ITEMS } from '../content/buildings.js';
import { Meta, TRAINING } from '../systems/meta.js';
import { GATE_SIDES, gateName, gateColor, gateBlurb } from '../content/gates.js';
import { Audio } from '../core/audio.js';
import { Input } from '../core/input.js';
import { Update } from '../core/update.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const icon = (id, s = 3) => iconURL('icon', id, s);
const runTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

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
        <div class="town-chip panel"><img class="px" src="${icon('coin', 2)}" alt=""><b class="t-coins">${Meta.coins}</b><img class="px" src="${icon('spirit', 2)}" alt="Spirit"><b class="t-spirit">${Meta.spirit}</b></div>
        <div class="town-chip panel t-team">${team || '<em>No team yet</em>'}</div>
      </div>
      <div class="town-chip panel t-run">Next run <b class="t-runlen">${runTime(Meta.runLength())}</b></div>`;
    this.el.hud.classList.remove('hidden');
    this.th = { coins: this.el.hud.querySelector('.t-coins'), spirit: this.el.hud.querySelector('.t-spirit'), run: this.el.hud.querySelector('.t-runlen') };
    this.last = {};
    this.touch.setVisible(this.g.touchMode);
    Input.endFrame();
  },
  updateTownHUD() {
    this.set('tcoins', this.th.coins, 'text', String(Meta.coins));
    if (this.th.spirit) this.set('tspirit', this.th.spirit, 'text', String(Meta.spirit));
    this.set('trun', this.th.run, 'text', runTime(Meta.runLength()));
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
        <div class="t2-main"><b>${esc(monName(m))}</b><span class="small">${m.hp <= 0 ? 'Fainted' : `Lv ${m.level}`}</span>
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
        ${Meta.data.buffs.length ? `<div class="small buffs">Ready: ${Meta.data.buffs.map((b) => esc(MERCHANT_ITEMS.find((x) => x.id === b)?.name || b)).join(', ')}</div>` : ''}
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
    if (!Meta.isHeroUnlocked(id)) { this.toast(`${id[0].toUpperCase() + id.slice(1)}: ${HERO_UNLOCK[id].text} to unlock.`); return; }
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
          <p class="talk-text">${fromMenu ? 'A new name? Go on, tell me.' : (Meta.data.runs || 0) <= 1 ? 'Halt! You came up the crater road? Then you have seen it: the wild is not safe any more. What do they call you, traveller? Rowan, is it?' : 'Halt! A new face. What do they call you, traveller? Rowan, is it?'}</p>
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
  },

  // ------------------------------------------------------------ the opening story
  // A new game: the opening plays, the egg is picked inside it, and its escape is the first run
  // (which ends at the village gate, where Ollie asks your name).
  async startOpening() {
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
        </div>
        <div class="loot-actions">
          <button class="btn" data-act="leave">Back to town <span class="key">Esc</span></button>
          <button class="btn secondary" data-act="help">How to play</button>
          <button class="btn secondary" data-act="opening">▶ Watch the opening</button>
          <button class="btn secondary" data-act="rename-player">✎ Your name: ${esc(Meta.playerName)}</button>
          <button class="btn secondary" data-act="profiles">👤 Players</button>
          <button class="btn secondary" data-act="title">Title screen</button>
        </div>
        ${Update.label() ? `<div class="app-version">Version: ${Update.label()}</div>` : ''}
      </div>`);
    this.modalKind = 'townmenu';
  },
};
