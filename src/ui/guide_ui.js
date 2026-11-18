// The beginner's guide box (mixed into UI): Moss's face, a line, and Next / Skip / Turn off tips.
// tip(id) shows a tip from content/guide.js the first time a new player meets something; tips that
// come while one is open wait their turn. The game waits while the box is open (Game.update), and
// keys go to the box first (UI.onKey).
import { GUIDE, TIPS, PAGE_TIPS, guideText } from '../content/guide.js';
import { npcFaceURL } from '../gfx/art.js';
import { Meta } from '../systems/meta.js';
import { Audio } from '../core/audio.js';
import { Input } from '../core/input.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };

export const GuideUI = {
  // Shows tip `id` if the guide is on and the tip hasn't shown before. `done` runs when the tip is closed,
  // or right away if it doesn't show. Returns true while the tip is showing or waiting its turn.
  tip(id, done) {
    if (!TIPS[id] || !Meta.guideOn || Meta.tipSeen(id)) { done?.(); return false; }
    this.guideQ ||= [];
    const has = this.guide?.id === id ? this.guide : this.guideQ.find((q) => q.id === id);
    if (has) { if (done) has.dones.push(done); return true; }
    const entry = { id, page: 0, dones: done ? [done] : [] };
    if (this.guide) { this.guideQ.push(entry); return true; }
    this.guide = entry;
    this.prompt(null);
    Audio.play('click');
    this.renderGuide();
    return true;
  },
  // A town page's own tip the first time it opens, then the one about building levels
  pageTip(screen) {
    if (this.g.mode !== 'town' || !Meta.guideOn) return;
    const id = PAGE_TIPS[screen];
    if (id) this.tip(id);
    if (this.el.select.querySelector('.panel.bld')) this.tip('upgrade');
  },
  renderGuide() {
    const G = this.guide;
    if (!G) return;
    const pages = TIPS[G.id], raw = pages[G.page], page = typeof raw === 'string' ? { t: raw } : raw, last = G.page >= pages.length - 1;
    let el = this.el.guide;
    if (!el) { el = this.el.guide = document.createElement('div'); el.id = 'guide'; this.root.appendChild(el); }
    // light up what the page talks about; the box goes to the top when that's low on the screen
    this.clearGuideFocus();
    const focus = page.focus ? [...document.querySelectorAll(page.focus)].filter(shown) : [];
    focus[0]?.scrollIntoView?.({ block: 'nearest' });
    for (const f of focus) f.classList.add('guide-focus');
    this.guideFocus = focus;
    const r = focus[0]?.getBoundingClientRect();
    el.className = `guide-layer${r && r.top + r.height / 2 > window.innerHeight * 0.55 ? ' at-top' : ''}`;
    el.innerHTML = `
      <div class="guide-box panel" role="dialog" aria-label="A tip from ${GUIDE.name}">
        <img class="px guide-face" src="${npcFaceURL(GUIDE.npc)}" alt="">
        <div class="guide-main">
          <div class="guide-name"><b>${GUIDE.name}</b><span>${GUIDE.role}</span>${pages.length > 1 ? `<i>${G.page + 1}/${pages.length}</i>` : ''}</div>
          <p class="guide-text">${esc(guideText(page.t, this.g.touchMode, Meta.playerName))}</p>
          <div class="guide-actions">
            <button class="guide-off" data-guide="off">Turn off tips</button>
            ${last ? '' : '<button class="btn small secondary" data-guide="skip">Skip <span class="key">Esc</span></button>'}
            <button class="btn small" data-guide="next">${last ? 'Got it' : 'Next ›'} <span class="key">E</span></button>
          </div>
        </div>
      </div>`;
  },
  clearGuideFocus() {
    for (const f of this.guideFocus || []) f.classList.remove('guide-focus');
    this.guideFocus = [];
  },
  // next: the next page (or close on the last); skip: close this tip; off: turn the guide off
  guideAct(what) {
    const G = this.guide;
    if (!G) return;
    if (what === 'next' && G.page < TIPS[G.id].length - 1) { G.page++; this.renderGuide(); return; }
    if (what === 'off') {
      Meta.setGuide(false);
      this.toast(`Tips are off. Turn them back on in the menu (${this.g.touchMode ? 'II' : 'Esc'}).`);
    }
    this.closeGuide(what === 'off');
  },
  closeGuide(all = false) {
    const G = this.guide;
    if (!G) return;
    Meta.markTip(G.id);
    this.clearGuideFocus();
    const dones = [...G.dones];
    this.guide = null;
    if (all) { for (const q of this.guideQ || []) dones.push(...q.dones); this.guideQ = []; }
    while (!this.guide && this.guideQ?.length) {
      const next = this.guideQ.shift();
      if (Meta.guideOn && !Meta.tipSeen(next.id)) this.guide = next; else dones.push(...next.dones);
    }
    if (this.guide) this.renderGuide();
    else { this.el.guide?.remove(); this.el.guide = null; }
    Input.endFrame(); // the key or tap that closed it doesn't also act in the game
    for (const f of dones) f();
  },
  // The town menu and the pause screen switch the guide on and off
  toggleGuide(btn) {
    const on = !Meta.guideOn;
    Meta.setGuide(on);
    this.toast(on ? 'Tips are on: Moss explains things the first time you see them.' : 'Tips are off.');
    if (btn) btn.textContent = this.guideLabel();
  },
  guideLabel() { return `💬 Tips: ${Meta.guideOn ? 'On' : 'Off'}`; },
};
