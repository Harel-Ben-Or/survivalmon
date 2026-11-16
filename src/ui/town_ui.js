// Town screens, mixed into UI: the town HUD, "Choose your team" at Enter the Wild (drag or tap
// survivalmons into the slots), the Training Hall and the town menu.
import { iconURL } from '../gfx/assets.js';
import { artURL } from '../gfx/art.js';
import { HEROES } from '../content/heroes.js';
import { SPECIES } from '../content/species.js';
import { Box } from '../systems/collection.js';
import { skillChips } from './mons_ui.js';
import { HERO_BOOST, HERO_UNLOCK } from '../content/gear.js';
import { MERCHANT_ITEMS } from '../content/buildings.js';
import { Meta, TRAINING } from '../systems/meta.js';
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
    const team = Box.team().map((m) => `<span class="t-mon ${m.hp <= 0 ? 'fainted' : ''}" title="${esc(SPECIES[m.species].name)}"><img class="px" src="${artURL('creature', m.species) || icon('egg', 2)}" alt=""><b>${m.level}</b></span>`).join('');
    this.el.hud.innerHTML = `
      <div class="town-hud">
        <div class="town-chip panel"><img class="px" src="${icon('coin', 2)}" alt=""><b class="t-coins">${Meta.coins}</b></div>
        <div class="town-chip panel t-team">${team || '<em>No team yet</em>'}</div>
      </div>
      <div class="town-chip panel t-run">Next run <b class="t-runlen">${runTime(Meta.runLength())}</b></div>`;
    this.el.hud.classList.remove('hidden');
    this.th = { coins: this.el.hud.querySelector('.t-coins'), run: this.el.hud.querySelector('.t-runlen') };
    this.last = {};
    this.touch.setVisible(this.g.touchMode);
    Input.endFrame();
  },
  updateTownHUD() {
    this.set('tcoins', this.th.coins, 'text', String(Meta.coins));
    this.set('trun', this.th.run, 'text', runTime(Meta.runLength()));
  },

  // ------------------------------------------------------------ Enter the Wild: choose your team
  showTeam() {
    this.hideScreens();
    this.g.modal = 'screen';
    this.screen = 'team';
    this.renderTeam();
    this.el.select.classList.remove('hidden');
    this.el.select.scrollTop = 0;
  },
  renderTeam() {
    const team = Box.team(), hero = Meta.hero;
    const size = Box.teamSize();
    const hp = (m) => `<div class="hp-bar ${m.hp <= 0 ? 'out' : m.hp < 0.3 ? 'low' : ''}"><div style="width:${Math.round(m.hp * 100)}%"></div></div>`;
    const slot = (i) => {
      const m = team[i];
      if (!m) return `<div class="team-slot" data-slot="${i}"><span>Drag a survivalmon here</span></div>`;
      return `<div class="team-slot filled ${m.hp <= 0 ? 'fainted' : ''}" data-slot="${i}"><img class="px" src="${artURL('creature', m.species) || iconURL('icon', 'egg', 2)}" alt="">
        <div><b>${esc(SPECIES[m.species].name)}</b><span>${m.hp <= 0 ? 'Fainted: stays home until healed' : `Lv ${m.level}`}</span>${hp(m)}</div><i>Tap to remove</i></div>`;
    };
    const card = (m) => `<div class="pool-mon ${Box.inTeam(m.id) ? 'in' : ''} ${m.hp <= 0 ? 'fainted' : ''}" data-mon="${m.id}" title="${esc(SPECIES[m.species].name)}">
      <img class="px" src="${artURL('creature', m.species) || iconURL('icon', 'egg', 2)}" alt="" draggable="false"><b>${esc(SPECIES[m.species].name)}</b><span>Lv ${m.level}</span>${hp(m)}</div>`;
    this.el.select.innerHTML = `
      <div class="team-screen">
        <h2>Choose your team</h2>
        <div class="team-body">
          <div class="team-left panel">
            <div class="team-label">Hero</div>
            <div class="hero-pick">${HEROES.map((h) => `<button class="hero-chip ${h.id === hero ? 'sel' : ''} ${Meta.isHeroUnlocked(h.id) ? '' : 'locked'}" data-pickhero="${h.id}">
              <img class="px" src="${artURL('hero', h.id) || iconURL('hero', h.id, 2)}" alt=""><span>${Meta.isHeroUnlocked(h.id) ? h.name : '🔒'}</span></button>`).join('')}</div>
            <div class="small hero-boost">${esc(HERO_BOOST[hero].text)}</div>
            ${Meta.data.buffs.length ? `<div class="small buffs">Ready for this run: ${Meta.data.buffs.map((b) => esc(MERCHANT_ITEMS.find((x) => x.id === b)?.name || b)).join(', ')}</div>` : ''}
            <div class="team-label">Team ${team.length}/${size}</div>
            <div class="team-slots">${Array.from({ length: size }, (_, i) => slot(i)).join('')}</div>
          </div>
          <div class="team-right panel">
            <div class="team-label">Your survivalmons: drag one onto a slot, or tap it</div>
            <div class="mon-pool">${Box.mons.map(card).join('') || `<em>${Box.eggs.length ? 'Your first egg is still warming in the Hatchery. Run alone for now!' : 'No survivalmons yet'}</em>`}</div>
          </div>
        </div>
        ${this.buildingPanel('gate')}
        <div class="team-actions">
          <button class="btn secondary" data-act="back">Back to town</button>
          <button class="btn go-btn" data-act="go">Let's run to the wild! <small>${runTime(Meta.runLength())}</small></button>
        </div>
      </div>`;
    this.bindTeamDrag();
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
    root.querySelectorAll('.pool-mon').forEach((el) => el.addEventListener('pointerdown', (e) => {
      if (drag) return;
      drag = { pid: e.pointerId, id: +el.dataset.mon, el, x0: e.clientX, y0: e.clientY, ghost: null };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', end);
      document.addEventListener('pointercancel', end);
    }));
    root.querySelectorAll('.team-slot.filled').forEach((el) => el.addEventListener('click', () => {
      const m = Box.team()[+el.dataset.slot];
      if (!m) return;
      Box.toggleTeam(m.id);
      Audio.play('click');
      this.renderTeam();
    }));
  },
  pickHero(id) {
    if (!Meta.isHeroUnlocked(id)) { this.toast(`${id[0].toUpperCase() + id.slice(1)}: ${HERO_UNLOCK[id].text} to unlock.`); return; }
    Meta.setHero(id);
    Audio.play('click');
    this.renderTeam();
  },

  // ------------------------------------------------------------ Training Hall
  showTraining() {
    this.g.modal = 'training';
    this.prompt(null);
    this.renderTraining();
  },
  renderTraining() {
    const keep = this.el.modal.querySelector('.train-list')?.scrollTop || 0;
    const rows = TRAINING.map((u) => {
      const L = Meta.level(u.id), cost = Meta.cost(u.id), maxed = cost === null;
      const now = L || u.id === 'runtime' ? u.desc(L) : 'Not trained yet';
      return `<div class="train-row ${maxed ? 'maxed' : ''}">
        <img class="px" src="${icon(u.icon, 3)}" alt="">
        <div class="train-info"><b>${u.name}</b> <span class="lvl">Lv ${L}${maxed ? ' · MAX' : ''}</span>
          <div class="now">${esc(now)}</div>${maxed ? '' : `<div class="next">Next: ${esc(u.desc(L + 1))}</div>`}</div>
        ${maxed ? '' : `<button class="btn small buy-btn" data-buy="${u.id}" ${cost <= Meta.coins ? '' : 'disabled'}><img class="px" src="${icon('coin', 2)}" alt="">${cost}</button>`}
      </div>`;
    }).join('');
    this.openModal(`
      <div class="modal-box panel train-box">
        <div class="train-head"><h2>Training Hall</h2><div class="town-chip"><img class="px" src="${icon('coin', 2)}" alt=""><b>${Meta.coins}</b></div></div>
        <div class="train-list">${rows}${this.buildingPanel('training')}</div>
        <div class="loot-actions"><button class="btn" data-act="leave">Leave <span class="key">Esc</span></button></div>
      </div>`);
    this.modalKind = 'training';
    this.el.modal.querySelector('.train-list').scrollTop = keep;
  },
  buyTraining(id) {
    Audio.play(Meta.buy(id) ? 'levelup' : 'click');
    this.renderTraining();
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
          <button class="btn secondary" data-act="profiles">👤 Players</button>
          <button class="btn secondary" data-act="title">Title screen</button>
        </div>
        ${Update.label() ? `<div class="app-version">Version: ${Update.label()}</div>` : ''}
      </div>`);
    this.modalKind = 'townmenu';
  },
};
