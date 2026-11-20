// "Who's playing?": pick, add, rename, reset or delete player profiles. Each profile is a separate
// progress; switching or resetting reloads the game so every system starts from that save.
import { Profiles } from '../systems/profiles.js';
import { Ranking } from '../systems/ranking.js';
import { Audio } from '../core/audio.js';
// Total time played: "45 min", "3 h 12 min"
const playTime = (sec) => { const m = Math.floor((sec || 0) / 60), h = Math.floor(m / 60); return h ? `${h} h ${m % 60} min` : `${m} min`; };

const PICKED = 'survivalmon.picked'; // chosen once this session: don't ask again on reload
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export const ProfilesUI = {
  // Ask who's playing when the app starts and there is more than one profile.
  askProfileOnStart() {
    let picked = false;
    try { picked = !!sessionStorage.getItem(PICKED); } catch { /* no session storage */ }
    if (Profiles.list.length > 1 && !picked) this.showProfiles();
  },

  showProfiles(editId = null) {
    this.hideScreens();
    if (this.g.mode === 'town') this.g.modal = 'screen';
    const top = this.screen === 'profiles' ? this.el.select.scrollTop : 0;
    this.screen = 'profiles';
    this.profEdit = editId;
    const cards = Profiles.list.map((p) => {
      const s = Profiles.summary(p.id), active = p.id === Profiles.data.active;
      const line = s.fresh ? 'New game: no progress yet'
        : `Played ${playTime(s.played)} · ${s.runs} run${s.runs === 1 ? '' : 's'} · best ${mmss(s.best)} · ${s.mons} survivalmon${s.mons === 1 ? '' : 's'} · ${s.coins} coins`;
      const name = editId === p.id
        ? `<input class="prof-input" maxlength="16" value="${esc(p.name)}" data-id="${p.id}" aria-label="Player name"><button class="btn small" data-pact="save-name" data-id="${p.id}">Save</button>`
        : `<b class="prof-name">${esc(p.name)}</b>${active ? '<span class="prof-tag">Playing now</span>' : ''}`;
      return `<div class="prof-card panel ${active ? 'active' : ''}">
        <div class="prof-head">${name}</div>
        <div class="prof-line">${line}</div>
        <div class="prof-actions">
          <button class="btn small" data-pact="use" data-id="${p.id}">${active ? 'Continue' : 'Play'}</button>
          <button class="btn small secondary" data-pact="rename" data-id="${p.id}">Rename</button>
          <button class="btn small secondary" data-pact="reset" data-id="${p.id}" ${s.fresh ? 'disabled' : ''}>Reset</button>
          ${Profiles.list.length > 1 ? `<button class="btn small secondary" data-pact="delete" data-id="${p.id}">Delete</button>` : ''}
        </div>
      </div>`;
    }).join('');
    this.el.select.innerHTML = `
      <div class="mons-page prof-page">
        <h2>Who's playing?</h2>
        <p class="sub-note">Each player has their own progress. Reset a player to start over as a brand-new player.</p>
        <div class="prof-grid">${cards}</div>
        <div class="team-actions">
          <button class="btn secondary" data-pact="new">+ New player</button>
          <button class="btn secondary" data-act="back">Back</button>
        </div>
      </div>`;
    this.el.select.classList.remove('hidden');
    this.el.select.scrollTop = top;
    const input = this.el.select.querySelector('.prof-input');
    if (input) { input.focus(); input.select(); }
  },

  profAct(act, el) {
    const id = +el.dataset.id;
    switch (act) {
      case 'use':
        try { sessionStorage.setItem(PICKED, '1'); } catch { /* ignore */ }
        if (id === Profiles.data.active) { this.back(); return; }
        Profiles.use(id);
        location.reload();
        return;
      case 'new': {
        const p = Profiles.add();
        this.showProfiles(p.id);
        return;
      }
      case 'rename': this.showProfiles(id); return;
      case 'save-name': {
        const input = this.el.select.querySelector('.prof-input');
        Profiles.rename(id, input?.value);
        this.showProfiles();
        return;
      }
      case 'reset':
        // ask once more on the button itself so a stray tap can't erase anything
        el.dataset.pact = 'reset-yes'; el.textContent = 'Tap again: erase all progress'; el.classList.add('danger');
        return;
      case 'reset-yes':
        if (id === Profiles.data.active) Profiles.leaving = true;
        Ranking.forget(id); // its row leaves the ranking
        Profiles.wipe(id);
        Audio.play('door');
        if (id === Profiles.data.active) { try { sessionStorage.setItem(PICKED, '1'); } catch { /* ignore */ } location.reload(); return; }
        this.toast(`${Profiles.get(id).name} starts over as a new player.`);
        this.showProfiles();
        return;
      case 'delete':
        el.dataset.pact = 'delete-yes'; el.textContent = 'Tap again: delete player'; el.classList.add('danger');
        return;
      case 'delete-yes': {
        const wasActive = id === Profiles.data.active;
        const name = Profiles.get(id)?.name;
        if (wasActive && Profiles.list.length > 1) Profiles.leaving = true;
        if (Profiles.list.length > 1) Ranking.forget(id); // its row leaves the ranking
        if (!Profiles.remove(id)) { Profiles.leaving = false; return; }
        if (wasActive) { location.reload(); return; }
        this.toast(`${name} was deleted.`);
        this.showProfiles();
        return;
      }
    }
  },
};
