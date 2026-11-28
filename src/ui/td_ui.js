// Tower Defense screens (td/td.js runs the board): a thin strip on top (lives, berries, wave, pause),
// the bar of your 5 basic mons along the bottom (drag one onto the board to summon it; it lights up
// when you have the berries, grey when not), Go and 2x beside it, the Watchtower page (pick a map and
// 5 basic mons) and the end screen. Rewards are paid here (tdRewards).
import { SPECIES, TYPES, STONE_OF, BASE_IDS } from '../content/species.js';
import { artURL } from '../gfx/art.js';
import { iconURL } from '../gfx/assets.js';
import { Audio } from '../core/audio.js';
import { TILE } from '../world/world.js';
import { Box, rollSkills, FOUND_HATCH } from '../systems/collection.js';
import { Meta } from '../systems/meta.js';
import { Shrine } from '../systems/shrine.js';
import { STONES } from '../content/species.js';
import { TD_MAPS, TD_WAVES, NEED_BASICS, TD_REWARD } from '../td/td_data.js';
import { TD_TEXT } from '../td/td_text.js';
import { tdLevel, tdBasics, tdOpen, mergeResult } from '../td/td.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const icon = (id, s = 2) => iconURL('icon', id, s);
const HIT = { shooter: 'Medium', zapper: 'Medium', slam: 'Short, all around', aura: 'Short, all around', lobber: 'Long, onto the road', roller: 'Rolls down the road', support: 'The towers next to it' };
const LEVEL_NAME = ['Basic mon', 'Level 1 breed', 'Level 2 breed', 'Level 3 breed'];
// A tower's skill line: its own, or its level 1 breed's (a level 2 or 3 breed: the same, stronger)
export function tdSkillLine(id) {
  if (TD_TEXT[id]) return TD_TEXT[id];
  for (const s of Object.values(SPECIES)) if (s.stage === 2 && (s.evo === id || SPECIES[s.evo]?.evo === id)) return `${TD_TEXT[s.id] || ''} Stronger.`;
  return '';
}

export const TDUI = {
  // ------------------------------------------------------------ the Watchtower page
  showWatchtower() {
    const own = tdBasics();
    if (own.length < NEED_BASICS) {
      this.page('watchtower', `<p class="pg-note">The Watchtower opens once you have ${NEED_BASICS} different basic mons. You have ${own.length} of ${NEED_BASICS}.</p>`, { title: 'Watchtower' });
      return;
    }
    const sel = (this.tdSel ||= new Set((Meta.data.tdPicks || []).filter((id) => own.includes(id))));
    const cards = own.map((id) => {
      const sp = SPECIES[id], on = sel.has(id);
      return `<div class="td-pick panel clickable ${on ? 'on' : ''}" data-mact="td-pick" data-id="${id}">
        <img class="px" src="${artURL('creature', id)}" alt="">
        <div class="td-pick-name">${esc(sp.name)} <span class="rar type-pill" style="background:${TYPES[sp.type].color}">${TYPES[sp.type].name}</span></div>
        <div class="td-pick-skill"><b>${esc(sp.unique?.name || '')}:</b> ${esc(TD_TEXT[id] || '')}</div>
        <div class="td-pick-area">Hit area: ${HIT[sp.arch]}</div>
        ${on ? '<i class="td-check">✓</i>' : ''}
      </div>`;
    }).join('');
    const best = Meta.data.tdBest?.meadow || 0, sv = Meta.data.tdSave;
    const cont = sv ? `<div class="td-map panel td-continue"><b>A run in progress</b><span>wave ${sv.wave} cleared · ${sv.lives} lives · ${sv.towers.length} towers</span><button class="btn small" data-mact="td-continue">Continue</button></div>` : '';
    const map = `<div class="td-map panel"><b>${TD_MAPS.meadow.name}</b><span>30 waves · 20 lives${best ? ` · best: wave ${best}` : ''}</span></div>`;
    this.page('watchtower', `${cont}${map}<p class="pg-note">Pick 5 basic mons to bring. On the road, drag one onto the board to summon it, and drop one tower on another to merge them into a breed you have unlocked.</p><div class="td-picks">${cards}</div>`, {
      title: 'Watchtower', chips: `<span class="pg-chip">${sel.size} / 5 picked</span>`,
      foot: `<button class="btn go-btn" data-mact="td-start" ${sel.size === 5 ? '' : 'disabled'}>Defend the road</button>`,
    });
  },
  tdAct(act, t) {
    if (act === 'td-pick') {
      const id = t.dataset.id, sel = this.tdSel;
      if (sel.has(id)) sel.delete(id); else if (sel.size < 5) sel.add(id);
      this.showWatchtower();
      return true;
    }
    if (act === 'td-start') {
      if (this.tdSel?.size !== 5) return true;
      Meta.data.tdPicks = [...this.tdSel]; delete Meta.data.tdSave; Meta.save();
      if (this.g.touchMode) this.enterFullscreen();
      this.g.startTD([...this.tdSel], 'meadow');
      return true;
    }
    if (act === 'td-continue') {
      const sv = Meta.data.tdSave;
      if (!sv) return true;
      if (this.g.touchMode) this.enterFullscreen();
      this.g.startTD(sv.picks, sv.map, sv);
      return true;
    }
    if (act === 'td-again') { const S = this.g.td; this.closeModal(); this.g.modal = null; this.g.startTD(S.picks, S.map); return true; }
    if (act === 'td-town') {
      const g = this.g;
      this.closeModal(); g.modal = null; g.td = null; g.toTown();
      // back out of the Watchtower's door
      const d = g.town?.doors.find((x) => x.id === 'watchtower'), P = g.player;
      if (d && P) { P.x = d.x; P.y = d.y + 14; P.pets.forEach((p, i) => { p.x = P.x + (i % 2 ? -1 : 1) * 16; p.y = P.y + 6; }); g.snapCamera?.(); }
      return true;
    }
    if (act === 'td-resume') { this.closeTDPause(); return true; }
    if (act === 'td-leave') { this.closeTDPause(); this.g.tdLeave(); return true; }
    return false;
  },

  // ------------------------------------------------------------ the run's screen
  showTD() {
    this.hideScreens();
    this.screen = 'td';
    const S = this.g.td;
    this.el.hud.innerHTML = `
      <div class="td-strip">
        <span class="td-lives"><b>♥</b> <span class="v">20</span></span>
        <span class="td-berries"><img class="px" src="${icon('berry')}" alt="Berries"> <span class="v">0</span></span>
        <span class="td-wave">Wave <span class="v">0</span> / ${TD_WAVES}</span>
        <button class="td-pause" aria-label="Pause">❚❚</button>
      </div>
      <div class="feed td-feed"></div>
      <div class="td-bar">
        <div class="td-price"><img class="px" src="${icon('berry')}" alt=""> <span class="v">20</span></div>
        <div class="td-slots">${S.picks.map((id) => `<div class="td-slot" data-id="${id}"><img class="px" src="${artURL('creature', id)}" alt="${esc(SPECIES[id].name)}" draggable="false"></div>`).join('')}</div>
        <div class="td-btns"><button class="td-speed">1x</button><button class="td-go btn">Go</button></div>
      </div>
      <div class="td-info hidden"></div>`;
    this.el.hud.classList.remove('hidden');
    const q = (s) => this.el.hud.querySelector(s);
    this.tdH = {
      lives: q('.td-lives .v'), berries: q('.td-berries .v'), wave: q('.td-wave .v'), price: q('.td-price .v'),
      slots: [...this.el.hud.querySelectorAll('.td-slot')], go: q('.td-go'), speed: q('.td-speed'), info: q('.td-info'),
    };
    this.h = { feed: q('.td-feed'), paused: { classList: { add() {}, remove() {} } } };
    q('.td-pause').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.openTDPause(); });
    this.tdH.go.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Audio.unlock(); this.g.tdGo(); });
    this.tdH.speed.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); const T = this.g.td; T.speed = T.speed === 1 ? 2 : 1; this.tdRefresh(); });
    for (const el of this.tdH.slots) el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Audio.unlock(); this.tdDragStart({ species: el.dataset.id }, e); });
    this.tdBindBoard();
    this.tdRefresh();
  },
  tdRefresh() {
    const S = this.g.td, H = this.tdH;
    if (!S || !H || this.screen !== 'td') return;
    const price = this.g.tdPrice(), can = S.berries >= price;
    H.lives.textContent = S.lives; H.berries.textContent = Math.floor(S.berries); H.wave.textContent = S.wave; H.price.textContent = price;
    for (const el of H.slots) el.classList.toggle('off', !can);
    H.speed.textContent = `${S.speed}x`; H.speed.classList.toggle('on', S.speed > 1);
    const go = S.state === 'ready' || S.state === 'break';
    H.go.disabled = !go;
    H.go.textContent = S.state === 'ready' ? 'Go' : S.state === 'break' ? `Go +${10}` : `Wave ${S.wave}`;
  },
  tdFlashBerries() { const el = this.tdH?.berries?.parentElement; if (!el) return; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); },

  // ------------------------------------------------------------ dragging
  // pointer → board tile; a tower on the board can be picked up, a quick tap shows its skill
  tdBindBoard() {
    if (this.tdBound) return;
    this.tdBound = true;
    const cv = this.g.canvas;
    cv.addEventListener('pointerdown', (e) => {
      const g = this.g, S = g.td;
      if (g.mode !== 'td' || !S || S.state === 'over' || g.modal || this.guide) return;
      const p = g.tdFromScreen(e.clientX, e.clientY), tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
      const t = g.tdTowerAt(tx, ty) || g.tdTowerAt(tx, Math.floor((p.y + 6) / TILE));
      this.tdInfo(null);
      if (t) this.tdDragStart({ tower: t, tap: true, sx: e.clientX, sy: e.clientY }, e);
    });
    window.addEventListener('pointermove', (e) => {
      const D = this.g.td?.drag;
      if (!D) return;
      if (D.tap && Math.hypot(e.clientX - D.sx, e.clientY - D.sy) > 8) D.tap = false;
      const p = this.g.tdFromScreen(e.clientX, e.clientY);
      D.x = p.x; D.y = p.y;
    });
    const end = (e) => {
      const g = this.g, S = g.td, D = S?.drag;
      if (!D) return;
      S.drag = null;
      if (D.tap) { this.tdInfo(D.tower); return; }
      const p = g.tdFromScreen(e.clientX, e.clientY), tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
      const on = g.tdTowerAt(tx, ty);
      if (on && on !== D.tower) { if (!g.tdMerge(D, on)) this.tdNoMerge(D, on); }
      else if (!on && g.tdFree(tx, ty)) { if (D.tower) g.tdMove(D.tower, tx, ty); else if (!g.tdSummon(D.species, tx, ty)) this.feed('Not enough berries', '#ff9ac0'); }
      this.tdRefresh();
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', () => { if (this.g.td) this.g.td.drag = null; });
  },
  tdDragStart(item, e) {
    const g = this.g, S = g.td;
    if (!S || S.state === 'over' || g.modal || this.guide) return;
    if (!item.tower && S.berries < g.tdPrice()) { this.feed('Not enough berries', '#ff9ac0'); return; }
    const p = g.tdFromScreen(e.clientX, e.clientY);
    S.drag = { ...item, x: item.tap ? null : p.x, y: item.tap ? null : p.y };
    if (item.tap) { S.drag.x = p.x; S.drag.y = p.y; }
  },
  tdNoMerge(D, on) {
    const id = D.tower ? D.tower.species : D.species, r = mergeResult(id, on.species);
    if (r && !r.ok) this.feed(`Breed ${SPECIES[r.id].name} in the main game to use it here`, '#c8c8c8');
    else if (!r) this.feed("Those two can't merge", '#c8c8c8');
    else this.feed('Not enough berries', '#ff9ac0');
  },
  // a small card beside a tower you tap: what it is and its skill
  tdInfo(t) {
    const el = this.tdH?.info;
    if (!el) return;
    if (!t) { el.classList.add('hidden'); return; }
    const sp = SPECIES[t.species], g = this.g, L = g.tdLayout(), V = g.view;
    el.innerHTML = `<b>${esc(sp.name)}</b> <small>${LEVEL_NAME[tdLevel(t.species)]}</small><div><b>${esc(sp.unique?.name || '')}:</b> ${esc(tdSkillLine(t.species))}</div>`;
    const x = (L.ox + t.hx * L.s) * V.scale, y = (L.oy + (t.hy - 22) * L.s) * V.scale;
    el.style.left = `${Math.max(8, Math.min(window.innerWidth - 248, x - 120))}px`;
    el.style.top = `${Math.max(30, y - 70)}px`;
    el.classList.remove('hidden');
    clearTimeout(this.tdInfoT);
    this.tdInfoT = setTimeout(() => el.classList.add('hidden'), 4000);
  },

  // ------------------------------------------------------------ pause
  openTDPause() {
    const g = this.g;
    if (g.modal) return;
    g.modal = 'pause';
    this.openModal(`<div class="modal-box panel td-pause-box">
      <h2>Paused</h2>
      <p>Wave ${g.td.wave} of ${TD_WAVES} · ${g.td.lives} lives left</p>
      <p class="small">Leaving ends the run. You keep the rewards for the waves you cleared.</p>
      <div class="loot-actions"><button class="btn" data-mact="td-resume">Resume</button><button class="btn secondary" data-mact="td-leave">Leave the run</button></div>
    </div>`);
    this.modalKind = 'tdpause';
  },
  closeTDPause() { this.closeModal(); this.g.modal = null; },

  // ------------------------------------------------------------ the end
  // Pays the run's rewards and says what they were
  tdRewards(S) {
    const n = S.cleared, R = TD_REWARD, got = [];
    const coins = R.coinsPerWave * n, spirit = R.spiritPerWave * n;
    Meta.data.coins += coins; Meta.data.spirit = (Meta.data.spirit || 0) + spirit;
    got.push({ icon: icon('coin'), text: `${coins} coins` }, { icon: icon('spirit'), text: `${spirit} Spirit` });
    const mats = {};
    for (const at of [10, 20, 30]) if (n >= at) for (const k of ['wood', 'stone', 'clay']) mats[k] = (mats[k] || 0) + R.chestMats;
    if (Object.keys(mats).length) { for (const [k, v] of Object.entries(mats)) Meta.data.mats[k] = (Meta.data.mats[k] || 0) + v; got.push({ icon: icon('chest'), text: `${Object.values(mats).reduce((a, b) => a + b, 0)} materials` }); }
    if (S.won) {
      const types = S.picks.map((id) => SPECIES[id].type), stone = STONE_OF[types[Math.floor(Math.random() * types.length)]];
      if (stone) { Box.addItem(stone); got.push({ icon: icon(STONES[stone].icon), text: STONES[stone].name }); }
      const key = `${S.map}`, wins = (Meta.data.tdWins ||= {});
      if (!wins[key]) {
        wins[key] = 1;
        const l1 = S.merged.filter((id) => tdLevel(id) === 1);
        const pool = l1.length ? l1 : Object.values(SPECIES).filter((s) => s.stage === 2 && s.pair?.every((p) => S.picks.includes(p))).map((s) => s.id);
        const sp = pool[Math.floor(Math.random() * pool.length)];
        if (sp) { Box.addEgg({ species: sp, skills: rollSkills(sp, { odds: Shrine.odds() }), need: FOUND_HATCH, kind: 'found' }); got.push({ img: artURL('creature', sp), text: `A ${SPECIES[sp].name} egg` }); }
        Meta.data.shards = (Meta.data.shards || 0) + R.firstWinShards; got.push({ icon: icon('shard'), text: `${R.firstWinShards} Skyfall Shards` });
      } else wins[key]++;
    }
    const best = (Meta.data.tdBest ||= {});
    best[S.map] = Math.max(best[S.map] || 0, n);
    Meta.data.tdRuns = (Meta.data.tdRuns || 0) + 1;
    Meta.save(); Box.save();
    return got;
  },
  showTDEnd(S, got) {
    const g = this.g;
    g.modal = 'tdend';
    const merged = [...new Set(S.merged)].slice(0, 10).map((id) => `<img class="px" title="${esc(SPECIES[id].name)}" src="${artURL('creature', id)}" alt="">`).join('');
    this.openModal(`<div class="modal-box panel td-end-box">
      <h2 style="color:${S.won ? '#9af08a' : '#ff8a7a'}">${S.won ? 'You held the road!' : S.left ? 'You left the road' : 'The creatures got through...'}</h2>
      <div class="td-end-tiles"><div class="end-tile"><span>Waves</span><b>${S.cleared} / ${TD_WAVES}</b></div><div class="end-tile"><span>Defeated</span><b>${S.kills}</b></div><div class="end-tile"><span>Summons</span><b>${S.summons}</b></div><div class="end-tile"><span>Lives left</span><b>${S.lives}</b></div></div>
      ${merged ? `<div class="td-end-merged"><span>Merged</span>${merged}</div>` : ''}
      <div class="td-end-got">${(got || []).map((r) => `<span>${r.img ? `<img class="px" src="${r.img}" alt="">` : `<img class="px" src="${r.icon}" alt="">`}${esc(r.text)}</span>`).join('')}</div>
      <div class="loot-actions"><button class="btn" data-mact="td-again">Play again</button><button class="btn secondary" data-mact="td-town">Back to town</button></div>
    </div>`);
    this.modalKind = 'tdend';
  },
};
