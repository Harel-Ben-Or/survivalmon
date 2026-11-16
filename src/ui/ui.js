// DOM overlay: title, hero select, HUD, prompts, banners and all modal screens.
import { iconURL, HERO } from '../gfx/assets.js';
import { HEROES } from '../content/heroes.js';
import { WEAPONS } from '../content/weapons.js';
import { SPELLS } from '../content/spells.js';
import { ARTIFACTS, COMBOS } from '../content/artifacts.js';
import { SPECIES, STONES, TYPES, petXpFor, ATK_TYPES, atkType } from '../content/species.js';
import { MonsUI, atkTag } from './mons_ui.js';
import { ShopUI } from './shop_ui.js';
import { MATERIALS } from '../content/buildings.js';
import { Box } from '../systems/collection.js';
import { HERO_ART, artURL } from '../gfx/art.js';
import { playEvolve as playEvolveScene } from './cutscene.js';
import { CAT_LABEL, itemDef, levelDiff, combosForItem, nameOf, iconOf } from '../systems/loot.js';
import { SLOTS } from '../entities/player.js';
import { formatTime } from '../core/util.js';
import { Audio } from '../core/audio.js';
import { Input } from '../core/input.js';
import { TouchControls } from './touch.js';
import { TownUI } from './town_ui.js';
import { ProfilesUI } from './profiles_ui.js';
import { Profiles } from '../systems/profiles.js';
import { T, ZONES } from '../world/world.js';
import { Meta } from '../systems/meta.js';
import { TIERS, TIER_COLOR, PASSIVES } from '../content/skills.js';
import { armorPct } from '../systems/armor.js';
import { cardRowsHTML } from './card_preview.js';

const $ = (sel, root = document) => root.querySelector(sel);
const CONTROL_NAMES = { auto: 'Auto', touch: 'Touch', keys: 'Keyboard' };
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const icon = (id, s = 3) => iconURL('icon', id, s);
const typePill = (t) => `<span class="rar type-pill" style="background:${TYPES[t].color}">${TYPES[t].name}</span>`;

export class UI {
  constructor(g) { this.g = g; this.root = document.getElementById('ui'); this.frame = 0; }

  init() {
    this.root.innerHTML = `
      <div id="title" class="screen hidden"></div>
      <div id="select" class="screen hidden"></div>
      <div id="hud" class="hidden"></div>
      <div id="prompt" class="bubble hidden"><span class="bang">!</span><span class="txt"></span></div>
      <div id="banners"></div>
      <div id="toasts"></div>
      <div id="modal" class="modal hidden"></div>
      <div id="rotate" class="screen hidden">
        <div class="phone-icon"><div></div></div>
        <div class="rotate-title">Turn your phone sideways</div>
        <div class="rotate-sub">Left thumb moves · right thumb dashes and opens doors</div>
        <button class="btn small secondary" data-act="portrait">Play in portrait anyway</button>
      </div>`;
    this.el = {
      title: $('#title'), select: $('#select'), hud: $('#hud'), prompt: $('#prompt'),
      banners: $('#banners'), toasts: $('#toasts'), modal: $('#modal'),
    };
    this.touch = new TouchControls(this.g, this.root);
    this.el.prompt.addEventListener('pointerdown', (e) => { e.preventDefault(); Input.press('KeyE'); });
    this.root.addEventListener('click', (e) => this.onClick(e));
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  hideScreens() {
    for (const k of ['title', 'select', 'hud']) this.el[k].classList.add('hidden');
    document.body.classList.remove('in-town');
    this.touch?.setVisible(false);
    this.closeModal();
    this.prompt(null);
  }

  // screens where you walk around with the stick
  walking() { return this.screen === 'hud' || this.screen === 'town'; }
  // Back out of a screen: to town when you came from there, else to the title
  back() {
    if (this.g.mode === 'town') this.showTown();
    else { this.selIdx = 0; this.showTitle(); }
  }

  controlsLabel() {
    const s = this.g.settings.controls;
    return s === 'auto' ? `Controls: Auto (${this.g.touchMode ? 'touch' : 'keyboard'})` : `Controls: ${CONTROL_NAMES[s]}`;
  }
  cycleControls() {
    const order = ['auto', 'touch', 'keys'];
    const s = this.g.settings;
    s.controls = order[(order.indexOf(s.controls) + 1) % order.length];
    this.g.saveSettings();
    this.g.applyControls();
    this.toast(this.controlsLabel());
  }
  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else this.enterFullscreen(true);
  }
  // Fullscreen + landscape lock (works on Android; iPhone shows the rotate screen instead)
  enterFullscreen(loud = false) {
    const el = document.documentElement;
    if (!document.fullscreenEnabled || document.fullscreenElement || !el.requestFullscreen) return;
    el.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation?.lock?.('landscape').catch(() => {}))
      .catch(() => { if (loud) this.toast('Fullscreen is not available here'); });
  }
  showRotate(on) { $('#rotate').classList.toggle('hidden', !on); }

  // ------------------------------------------------------------ title & select
  showTitle() {
    this.hideScreens();
    const b = this.g.best;
    this.el.title.innerHTML = `
      <div class="logo">SURVIVALMON</div>
      <div class="tagline panel">Short runs · Big upgrades · Catch survivalmons</div>
      <div class="title-buttons">
        <button class="btn" data-act="play">Play</button>
        <button class="btn secondary" data-act="box">Ranch${Box.isEmpty ? '' : ` (${Box.mons.length})`}</button>
        <button class="btn secondary" data-act="help">How to play</button>
      </div>
      <div class="title-buttons">
        <button class="btn small secondary" data-act="controls">📱 ${this.controlsLabel()}</button>
        ${document.fullscreenEnabled && !standalone() ? '<button class="btn small secondary" data-act="fullscreen">⛶ Fullscreen</button>' : ''}
      </div>
      <div class="title-buttons">
        <button class="btn small secondary" data-act="profiles">👤 ${esc(Profiles.active.name)} · Change player</button>
        ${window.__install && !standalone() ? '<button class="btn small go-btn" data-act="install">📲 Install app</button>' : ''}
      </div>
      ${isIOS() && !standalone() ? '<div class="best panel">Tip: tap Share → <b>Add to Home Screen</b> to play fullscreen</div>' : ''}
      ${b.time > 0 ? `<div class="best panel">Best: ${formatTime(b.time)} survived · ${b.kills} kills · Lv ${b.level}${b.wins ? ` · ${b.wins} win${b.wins > 1 ? 's' : ''}` : ''}</div>` : ''}
      <div class="best hint-keys">Press <span class="key">Enter</span> to start</div>`;
    this.el.title.classList.remove('hidden');
    this.screen = 'title';
  }

  showSelect() {
    this.hideScreens();
    this.screen = 'select';
    this.selIdx = this.selIdx ?? 0;
    this.el.select.innerHTML = `
      <h2>Choose your hero</h2>
      <div class="hero-grid">
        ${HEROES.map((h, i) => `
          <div class="hero-card panel clickable" data-hero="${h.id}" data-idx="${i}">
            <canvas class="px" width="64" height="64"></canvas>
            <div class="name">${h.name}</div><div class="role">${h.title}</div>
            <div class="desc">${esc(h.desc)}</div>
            <div class="weapon"><img class="px" width="24" height="24" src="${icon(WEAPONS[h.weapon].icon, 2)}">${WEAPONS[h.weapon].name}</div>
            <ul>${h.perks.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
            <span class="key">${i + 1}</span>
          </div>`).join('')}
      </div>
      <div class="team-strip panel">
        <span>Your team</span>
        ${Box.team().map((m) => `<img class="px" title="${esc(SPECIES[m.species].name)} Lv ${m.level}" src="${artURL('creature', m.species)}"><b>Lv ${m.level}</b>`).join('') || '<em>No critters yet</em>'}
        <button class="btn small secondary" data-act="box">Edit team</button>
        <button class="btn small secondary" data-act="back">Back</button>
      </div>`;
    this.el.select.classList.remove('hidden');
    this.heroCanvases = [...this.el.select.querySelectorAll('canvas')];
  }

  drawSelect() {
    const t = this.g.realTime;
    const dirs = ['south', 'east', 'north', 'west'];
    this.heroCanvases.forEach((cv, i) => {
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#6dbd48'; ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#5fae3e'; for (let k = 0; k < 14; k++) ctx.fillRect((k * 23 + i * 7) % 62, (k * 13 + 5) % 62, 2, 2);
      ctx.fillStyle = 'rgba(26,42,16,.3)'; ctx.beginPath(); ctx.ellipse(32, 56, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
      const art = HERO_ART[HEROES[i].id];
      if (art) {
        const img = art.dirs[dirs[Math.floor(t / 1.6) % 4]] || art.dirs.south;
        const bob = Math.abs(Math.sin(t * 6)) * 2;
        ctx.drawImage(img, Math.round(32 - art.ax), Math.round(57 - art.ay - bob));
      } else {
        const spr = HERO[HEROES[i].id];
        ctx.drawImage(spr.dirs.down[Math.floor(t * 8) % 4], 23, 32, 18, 24);
      }
    });
    this.el.select.querySelectorAll('.hero-card').forEach((c, i) => c.classList.toggle('sel', i === this.selIdx));
  }

  showHelp() {
    const controls = this.g.touchMode
      ? `<b>Left thumb</b> — drag anywhere on the left side to move<br>
          <b>!</b> button — enter houses, search chests, crates, shelves (or tap the speech bubble) &nbsp;·&nbsp; walk out the door to leave<br>
          <b>DASH</b> — quick dodge &nbsp;·&nbsp; <b>II</b> — pause, team & stats<br><br>`
      : `<span class="key">W</span><span class="key">A</span><span class="key">S</span><span class="key">D</span> / arrows — move &nbsp;·&nbsp; <span class="key">Space</span> — dash<br>
          <span class="key">E</span> — enter houses, search chests, crates, shelves &nbsp;·&nbsp; walk out the door to leave<br>
          <span class="key">Esc</span> — pause, team & stats &nbsp;·&nbsp; <span class="key">M</span> — mute<br><br>`;
    this.openModal(`
      <div class="modal-box panel">
        <h2>How to play</h2>
        <div class="help">
          ${controls}
          • Your hero's weapons fire on their own, and your <b>survivalmons</b> fight beside you with their own skills.<br>
          • Kill monsters, grab the blue gems and level up: pick a boost for your hero or for your survivalmons.<br>
          • <b>Inside a house the clock stops</b>: search it for coins, berries, materials, eggs, evolution stones and gear.<br>
          • Stand at a tree, rock or clay spot to gather materials for upgrading buildings.<br>
          • A rare <b>wild survivalmon</b> may appear: defeat it within 25 seconds to catch it.<br>
          • Runs start short. When the timer runs out you're back in town to upgrade, heal, breed and get ready.<br>
          • Bosses arrive around 2:00, 4:00 and 6:00. Last the full <b>8:00</b>, through the Night Lord's final 30 seconds, to win!
        </div>
        <button class="btn" data-act="close">Got it</button>
      </div>`);
    this.modalKind = 'help';
  }

  // ------------------------------------------------------------ HUD
  showHUD() {
    this.hideScreens();
    this.screen = 'hud';
    const P = this.g.player;
    this.el.hud.innerHTML = `
      <div class="xpbar"><div class="fill"></div><div class="lv">Lv 1</div></div>
      <div class="hud-left">
        <div class="status panel">
          <img class="portrait px" src="${artURL('hero', P.hero.id) || iconURL('hero', P.hero.id, 2)}">
          <div class="bars">
            <div class="hpbar"><div class="fill"></div><span></span></div>
            <div class="counters"><span><img class="px" src="${icon('coin', 2)}"><b class="coins">0</b></span><span>KO <b class="kills">0</b></span><span class="mats"></span></div>
            <div class="pets-row"></div>
          </div>
        </div>
        <div class="slot-col weapons"></div>
      </div>
      <div class="hud-top">
        <div class="timer"><span class="t">00:00</span><small>left</small></div>
        <div class="phase">Morning</div>
        <div class="paused-chip hidden">⏸ Time paused</div>
        <div class="bossbar hidden"><div class="name"></div><div class="bar"><div></div></div></div>
      </div>
      <div class="minimap panel"><canvas class="px" width="112" height="112"></canvas></div>
      <div class="hud-bottom">
        <div class="dash"><div class="pip"><div></div></div><span>SPACE</span></div>
      </div>
      <div class="hud-arts"></div>
      <div class="combos-chip"></div>`;
    this.el.hud.classList.remove('hidden');
    const q = (s) => this.el.hud.querySelector(s);
    this.h = {
      xp: q('.xpbar .fill'), lv: q('.xpbar .lv'), xpbar: q('.xpbar'), hpbar: q('.hpbar'), hp: q('.hpbar .fill'), hpText: q('.hpbar span'),
      coins: q('.coins'), kills: q('.kills'), mats: q('.mats'), pets: q('.pets-row'), weapons: q('.weapons'),
      time: q('.timer .t'), phase: q('.phase'), paused: q('.paused-chip'), boss: q('.bossbar'), bossName: q('.bossbar .name'), bossFill: q('.bossbar .bar div'),
      mini: q('.minimap canvas'), spells: [...this.el.hud.querySelectorAll('.spell')], dash: q('.dash .pip div'),
      arts: q('.hud-arts'), combos: q('.combos-chip'),
    };
    this.invSig = '';
    this.last = {};
    this.h.spells.forEach((el, i) => el.addEventListener('pointerdown', (e) => { e.preventDefault(); Input.press(`Digit${i + 1}`); }));
    this.touch.setVisible(this.g.touchMode);
  }

  set(key, el, prop, val) {
    if (this.last[key] === val) return;
    this.last[key] = val;
    if (prop === 'text') el.textContent = val; else if (prop === 'class') el.className = val; else el.style[prop] = val;
  }

  updateHUD() {
    const g = this.g, P = g.player, S = P.stats, H = this.h;
    if (!H) return;
    this.set('xp', H.xp, 'width', `${Math.min(100, (P.xp / P.xpNext) * 100).toFixed(1)}%`);
    // the bar's colour and label say what the next level-up upgrades
    const next = g.nextLevelKind?.() || 'hero';
    this.set('lv', H.lv, 'text', P.pets.length ? `Lv ${P.level} · next: ${next === 'team' ? 'team' : 'hero'}` : `Lv ${P.level}`);
    this.set('xpk', H.xpbar, 'class', `xpbar next-${next}`);
    this.set('hp', H.hp, 'width', `${Math.max(0, (P.hp / S.maxHp) * 100).toFixed(1)}%`);
    this.set('hpt', H.hpText, 'text', `${Math.ceil(P.hp)} / ${S.maxHp}`);
    H.hpbar.classList.toggle('low', P.hp / S.maxHp < 0.3);
    this.set('coins', H.coins, 'text', String(Math.floor(P.coins)));
    this.set('kills', H.kills, 'text', String(P.kills));
    const mats = Object.entries(P.mats || {}).filter(([, n]) => n > 0).map(([k, n]) => `<img class="px" src="${icon(MATERIALS[k].icon, 2)}" alt="">${n}`).join(' ');
    if (this.last.mats !== mats) { this.last.mats = mats; H.mats.innerHTML = mats; }
    const left = Math.max(0, g.runLength - g.time);
    this.set('time', H.time, 'text', formatTime(Math.ceil(left)));
    H.time.parentElement.classList.toggle('ending', left < 5.5);
    const m = g.dayMinute;
    this.set('phase', H.phase, 'text', m < 6 ? '☀ Morning' : m < 11 ? '☀ Afternoon' : m < 16 ? '🌅 Sunset' : m < 21 ? '☾ Dusk' : '☾ Night');

    const sig = [P.weapons, P.spells, P.artifacts].map((l) => l.map((i) => `${i.id}${i.level}`).join(',')).join('|') + '|' + P.pets.map((p) => p.species + p.mon.level).join(',') + '|' + [...g.activeCombos].join(',');
    if (sig !== this.invSig) { this.invSig = sig; this.rebuildInventory(); }

    P.spells.forEach((s, i) => {
      const el = H.spells[i];
      if (!el) return;
      const max = SPELLS[s.id].stats(s.level).cd * S.cooldown;
      const frac = s.cd > 0 ? s.cd / max : 0;
      this.set(`sp${i}`, el.querySelector('.cd'), 'height', `${(frac * 100).toFixed(0)}%`);
      this.set(`spt${i}`, el.querySelector('.cdt'), 'text', s.cd > 0 ? String(Math.ceil(s.cd)) : '');
      el.classList.toggle('ready', s.cd <= 0);
    });
    this.set('dash', H.dash, 'width', `${(100 * (1 - P.dashCd / (2 * S.cooldown))).toFixed(0)}%`);

    if (g.boss && !g.boss.dead) {
      H.boss.classList.remove('hidden');
      this.set('bossn', H.bossName, 'text', g.boss.def.name);
      this.set('bossf', H.bossFill, 'width', `${Math.max(0, (g.boss.hp / g.boss.maxHp) * 100).toFixed(1)}%`);
    } else H.boss.classList.add('hidden');

    if (this.frame % 6 === 0) this.drawMinimap();
  }

  rebuildInventory() {
    const g = this.g, P = g.player, H = this.h;
    const pip = (id, lvl, max, title) => `<div class="inv-icon" title="${esc(title)}"><img class="px" src="${icon(id, 2)}"><span class="lvl">${lvl >= max ? 'MAX' : lvl}</span></div>`;
    H.weapons.innerHTML = P.weapons.map((w) => pip(WEAPONS[w.id].icon, w.level, WEAPONS[w.id].max, WEAPONS[w.id].name)).join('');
    H.arts.innerHTML = P.artifacts.map((a) => pip(ARTIFACTS[a.id].icon, a.level, ARTIFACTS[a.id].max, ARTIFACTS[a.id].name)).join('');
    H.pets.innerHTML = P.pets.map((p) => `<span class="pet-chip" title="${esc(p.name)}"><img class="px" src="${artURL('creature', p.species)}"><b>${p.mon.level}</b></span>`).join('');
    H.spells.forEach((el, i) => {
      const s = P.spells[i];
      const img = el.querySelector('img');
      el.classList.toggle('empty', !s);
      if (s) { img.src = icon(SPELLS[s.id].icon, 3); img.classList.remove('hidden'); el.title = `${SPELLS[s.id].name} Lv ${s.level}`; }
      else { img.classList.add('hidden'); el.title = 'Empty spell slot — find spells in houses'; }
    });
    H.combos.innerHTML = [...g.activeCombos].map((id) => `<div>★ ${COMBOS.find((c) => c.id === id).name}</div>`).join('');
  }

  // Radar of the land around you (one pixel per tile): zones, water, houses, gathering spots,
  // chests, bosses and wild survivalmons. The ground is repainted every few tiles you move.
  drawMinimap() {
    const g = this.g, W = g.world, ctx = this.h.mini.getContext('2d');
    const P = g.mode === 'house' ? { x: g.house.doorX, y: g.house.doorY } : g.player;
    const R = 56, ptx = Math.floor(P.x / 16), pty = Math.floor(P.y / 16);
    if (!this.radar || this.radarWorld !== W || Math.abs(ptx - this.radarX) >= 3 || Math.abs(pty - this.radarY) >= 3) {
      const cv = this.radar || (this.radar = Object.assign(document.createElement('canvas'), { width: R * 2, height: R * 2 }));
      const rc = cv.getContext('2d'), img = rc.createImageData(R * 2, R * 2), d = img.data;
      const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
      const zc = {}; for (const [k, z] of Object.entries(ZONES)) zc[k] = hex(z.color);
      const fixed = { [T.DIRT]: hex('#e3c48c'), [T.FARM]: hex('#8a5a36'), [T.WATER]: hex('#3d8fd0'), [T.STONE]: hex('#cfc8b8'),
        [T.SAND]: hex('#f0dca0'), [T.ASH]: hex('#4a4446'), [T.GRAVEL]: hex('#9c988e'), [T.FROST]: hex('#e2f0f8'), [T.BLOSSOM]: hex('#f4b4d4') };
      for (let y = 0; y < R * 2; y++) for (let x = 0; x < R * 2; x++) {
        const tx = ptx - R + x, ty = pty - R + y, t = W.tileAt(tx, ty);
        let c = fixed[t];
        if (!c) { const z = zc[W.zoneAt(tx, ty)]; c = t === T.DARK ? [z[0] * 0.62, z[1] * 0.62, z[2] * 0.62] : z; }
        const i = (y * R * 2 + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      }
      rc.putImageData(img, 0, 0);
      this.radarX = ptx; this.radarY = pty; this.radarWorld = W;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#245f2b'; ctx.fillRect(0, 0, R * 2, R * 2);
    ctx.drawImage(this.radar, this.radarX - ptx, this.radarY - pty);
    const at = (px, py) => [Math.floor(px / 16) - ptx + R, Math.floor(py / 16) - pty + R];
    for (const o of W.nodes) { const [x, y] = at(o.x, o.y); ctx.fillStyle = '#2b1d24'; ctx.fillRect(x - 1, y - 1, 3, 3); ctx.fillStyle = '#c8a46a'; ctx.fillRect(x, y, 1, 1); }
    for (const hs of W.houses) {
      const [x, y] = at(hs.px + hs.B.tw * 8, hs.py + 32);
      ctx.fillStyle = '#2b1d24'; ctx.fillRect(x - 2, y - 2, 5, 5);
      ctx.fillStyle = hs.looted ? '#8a8a8a' : hs.visited ? '#f4f1e4' : '#ffd84a';
      ctx.fillRect(x - 1, y - 1, 3, 3);
    }
    for (const k of g.pickups) if (k.kind === 'chest' || k.kind === 'egg') { const [x, y] = at(k.x, k.y); ctx.fillStyle = '#ffb030'; ctx.fillRect(x, y, 2, 2); }
    for (const e of g.enemies) {
      if (!(e.boss || e.elite || e.wild) || e.dead) continue;
      const [x, y] = at(e.x, e.y), s = e.boss ? 4 : 3;
      ctx.fillStyle = e.wild ? '#5ae8ff' : e.boss ? '#ff3a3a' : '#ff9a3a';
      ctx.fillRect(x - 1, y - 1, s, s);
    }
    ctx.fillStyle = '#2b1d24'; ctx.fillRect(R - 2, R - 2, 5, 5);
    ctx.fillStyle = Math.floor(g.realTime * 4) % 2 ? '#ffffff' : '#5ae8ff';
    ctx.fillRect(R - 1, R - 1, 3, 3);
  }

  setPaused(on) { this.h?.paused.classList.toggle('hidden', !on); }
  bossBar(e) { if (!e && this.h) this.h.boss.classList.add('hidden'); }

  // ------------------------------------------------------------ prompt, banners, toasts
  prompt(label, wx, wy) {
    const el = this.el.prompt;
    if (!label || this.g.modal) {
      if (this.promptLabel !== null) this.touch?.setAction(null);
      el.classList.add('hidden'); this.promptLabel = null; return;
    }
    if (this.promptLabel !== label) {
      el.querySelector('.txt').innerHTML = this.g.touchMode ? esc(label) : `<span class="key">E</span> ${esc(label)}`;
      this.promptLabel = label;
      this.touch?.setAction(label === 'Leave' ? null : label);
    }
    if (label === 'Leave') el.querySelector('.txt').textContent = '↓ Leave';
    const p = this.g.worldToScreen(wx, wy);
    el.style.left = `${p.x}px`; el.style.top = `${p.y}px`;
    el.classList.remove('hidden');
  }
  banner(text, color = '#ffffff', big = false, sub = '') {
    const b = document.createElement('div');
    b.className = `banner${big ? ' big' : ''}`;
    b.style.color = color;
    b.innerHTML = `${esc(text)}${sub ? `<span class="sub">${esc(sub)}</span>` : ''}`;
    this.el.banners.appendChild(b);
    while (this.el.banners.children.length > 3) this.el.banners.firstChild.remove();
    setTimeout(() => b.remove(), 3300);
  }
  toast(text) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = text;
    this.el.toasts.appendChild(t);
    while (this.el.toasts.children.length > 3) this.el.toasts.firstChild.remove();
    setTimeout(() => t.remove(), 2700);
  }

  // ------------------------------------------------------------ modals
  openModal(html) {
    this.el.modal.innerHTML = html;
    this.el.modal.classList.remove('hidden');
  }
  closeModal() {
    this.el.modal.classList.add('hidden');
    this.el.modal.innerHTML = '';
    this.modalKind = null;
    Input.endFrame();
  }

  showLevelUp(cards, onPick, kind = 'hero', level = 0) {
    this.modalKind = 'levelup';
    this.levelCards = cards; this.onPick = onPick;
    this.levelKind = kind; this.levelNum = level;
    this.renderLevelUp();
  }
  renderLevelUp() {
    const g = this.g, P = g.player;
    const cost = 10 + 5 * (g.rerolls || 0);
    const cards = this.levelCards.map((c, i) => {
      if (c.kind === 'train') {
        const def = itemDef(c.cat, c.id), cur = P.find(c.cat, c.id);
        return `<div class="card clickable" data-pick="${i}">
          <span class="rar" style="background:#ffd84a">Training</span>
          <img class="px" src="${icon(def.icon, 4)}">
          <div class="title">${def.name}</div><div class="cat">${CAT_LABEL[c.cat]} · Lv ${cur.level} → ${cur.level + 1}</div>
          ${cardRowsHTML(g, c)}
          <span class="key kb">${i + 1}</span></div>`;
      }
      if (c.kind === 'skill') {
        const s = c.skill, name = s.k === 'u' ? SPECIES[s.sp].unique.name : PASSIVES[s.id].name;
        return `<div class="card mon-card clickable" data-pick="${i}">
          <span class="rar" style="background:${TIER_COLOR[c.from + 1]}">Skill up</span>
          <img class="px" src="${artURL('creature', c.pet.species)}">
          <div class="title">${esc(c.pet.name)}</div><div class="cat">${esc(name)}</div>
          ${s.k === 'u' ? `<div class="tags">${atkTag(atkType(s.sp))}</div>` : ''}
          <div class="val"><b class="tier t${c.from}">${TIERS[c.from]}</b> → <b class="tier t${c.from + 1}">${TIERS[c.from + 1]}</b> for this run</div>
          ${cardRowsHTML(g, c)}
          <span class="key kb">${i + 1}</span></div>`;
      }
      const team = c.kind === 'team';
      return `<div class="card ${c.rarity.id} ${team ? 'mon-card' : ''} clickable" data-pick="${i}">
        <span class="rar" style="background:${c.rarity.color}">${team ? (c.up.noRarity ? 'Survivalmons' : `${c.rarity.name} · Team`) : c.rarity.name}</span>
        <img class="px" src="${icon(c.up.icon, 4)}">
        <div class="title">${c.up.name}</div>
        ${c.up.atk ? `<div class="tags">${atkTag(c.up.atk)}</div>` : ''}
        <div class="val">${esc(c.up.fmt(c.value))}</div>
        ${cardRowsHTML(g, c)}
        <span class="key kb">${i + 1}</span></div>`;
    }).join('');
    const kind = this.levelKind || 'hero';
    const head = kind === 'team' ? `Survivalmons level up! <small>Lv ${this.levelNum}</small>`
      : kind === 'bonus' ? 'Treasure! <small>Bonus pick</small>'
      : kind === 'skill' ? 'Boss defeated! <small>Skill up</small>'
      : `${esc(P.hero.name)} levels up! <small>Lv ${this.levelNum}</small>`;
    const sub = kind === 'team' ? 'Pick an upgrade for your team. Next level: your hero.'
      : kind === 'bonus' ? 'From the chest: pick one, for your hero or your team.'
      : kind === 'skill' ? 'Pick one skill to go up a grade for the rest of this run. Each skill can go up once per run.'
      : P.pets.length ? 'Pick an upgrade for your hero. Next level: your survivalmons.' : 'Pick an upgrade for your hero.';
    this.openModal(`
      <div class="modal-box panel lvl-${kind}">
        <h2 class="lvl-head">${head}</h2>
        <div class="lvl-sub">${sub}</div>
        <div class="cards">${cards}</div>
        <div class="reroll"><button class="btn small secondary" data-act="reroll" ${P.coins < cost ? 'disabled' : ''}>Reroll — ${cost} coins</button>
        <span style="font-size:14px;color:var(--muted)">You have ${Math.floor(P.coins)} coins<span class="hint-keys"> · press <span class="key">1</span><span class="key">2</span><span class="key">3</span></span></span></div>
      </div>`);
    this.modalKind = 'levelup';
  }
  pickLevel(i) {
    const c = this.levelCards?.[i];
    if (!c) return;
    Audio.play('click');
    this.closeModal();
    this.onPick(c);
  }
  reroll() {
    const g = this.g, P = g.player;
    const cost = 10 + 5 * (g.rerolls || 0);
    if (P.coins < cost) return;
    P.coins -= cost; g.rerolls = (g.rerolls || 0) + 1;
    this.levelCards = g.rerollLevelUp();
    Audio.play('coin');
    this.renderLevelUp();
  }

  showLoot(items, title, onDone) {
    this.lootQueue = [...items];
    this.lootTitle = title;
    this.lootDone = onDone;
    this.nextLoot();
  }
  nextLoot() {
    if (!this.lootQueue.length) { this.closeModal(); this.lootDone?.(); return; }
    this.lootItem = this.lootQueue.shift();
    this.renderLoot();
  }
  renderLoot() {
    const g = this.g, P = g.player, it = this.lootItem;
    this.modalKind = 'loot';
    if (it.cat === 'egg') {
      this.openModal(`
        <div class="modal-box panel">
          <h2>${esc(this.lootTitle)}</h2>
          <div class="card loot-card">
            <span class="rar" style="background:#9af08a">Egg</span>
            <img class="px" src="${icon('egg', 4)}" style="width:64px;height:64px">
            <div class="title">Survivalmon Egg</div>
            <div class="small">It's wiggling! It will hatch in your Hatchery after some time in the wild.</div>
          </div>
          <div class="loot-actions"><button class="btn" data-act="hatch">Send it to the Hatchery <span class="key">E</span></button></div>
        </div>`);
      return;
    }
    const def = itemDef(it.cat, it.id);
    const owned = P.find(it.cat, it.id);
    const from = owned ? owned.level : 0;
    const to = Math.min(def.max, from + it.levels);
    const desc = it.cat === 'artifact' ? def.desc(to) : def.desc;
    const stats = it.cat === 'artifact' ? '' : levelDiff(it.cat, it.id, from, to);
    const combos = combosForItem(P, it.id).map((c) => `<div class="combo-hint ${c.done ? 'done' : ''}">${c.done ? '★' : '☆'} Combo with ${esc(c.names.join(' + '))} → <b>${esc(c.combo.name)}</b></div>`).join('');
    const full = !owned && P.list(it.cat).length >= SLOTS[it.cat];
    const xpGain = 20 + 15 * it.levels;
    let actions;
    if (owned) actions = `<button class="btn" data-act="take">Upgrade to Lv ${to} <span class="key">E</span></button>`;
    else if (!full) actions = `<button class="btn" data-act="take">Take it <span class="key">E</span></button>`;
    else actions = `<div style="font-size:15px">Your ${CAT_LABEL[it.cat].toLowerCase()} slots are full (${SLOTS[it.cat]}). Swap with:</div>
      <div class="swap-list">${P.list(it.cat).map((o) => { const d = itemDef(it.cat, o.id); return `<button data-swap="${o.id}"><img class="px" src="${icon(d.icon, 3)}">${esc(d.name)}<span>Lv ${o.level}</span></button>`; }).join('')}</div>`;
    this.openModal(`
      <div class="modal-box panel">
        <h2>${esc(this.lootTitle)}</h2>
        <div class="card loot-card">
          <span class="rar" style="background:${it.cat === 'weapon' ? '#ffb07a' : it.cat === 'spell' ? '#c8a8ff' : '#7ad8ff'}">${CAT_LABEL[it.cat]}</span>
          <img class="px" src="${icon(def.icon, 5)}" style="width:80px;height:80px">
          <div class="title">${esc(def.name)}</div>
          <div class="cat">${owned ? `Lv ${from} → ${to}` : `Lv ${to}`}${it.cat === 'spell' ? ' · cast with 1/2/3' : it.cat === 'weapon' ? ' · fires automatically' : ' · passive'}</div>
          <div class="small">${esc(desc)}</div>
          ${stats ? `<div class="stats">${esc(stats)}</div>` : ''}
          ${combos}
        </div>
        <div class="loot-actions">${actions}<button class="btn secondary" data-act="salvage">Leave it (+${xpGain} EXP)</button></div>
      </div>`);
  }
  lootTake() {
    const it = this.lootItem, P = this.g.player;
    if (it.cat === 'egg') return this.hatch();
    const owned = P.find(it.cat, it.id);
    if (!owned && P.list(it.cat).length >= SLOTS[it.cat]) return;
    P.addItem(it.cat, it.id, it.levels);
    Audio.play('levelup');
    this.nextLoot();
  }
  lootSwap(oldId) {
    const it = this.lootItem, P = this.g.player;
    P.removeItem(it.cat, oldId);
    P.addItem(it.cat, it.id, it.levels);
    Audio.play('levelup');
    this.nextLoot();
  }
  lootSalvage() {
    const it = this.lootItem;
    this.g.player.addXp(20 + 15 * (it.levels || 1));
    Audio.play('gem');
    this.nextLoot();
  }
  // An egg found in a house goes to the Hatchery.
  hatch() {
    this.g.findEgg(this.g.player.x, this.g.player.y);
    this.nextLoot();
  }

  // ------------------------------------------------------------ evolution
  showEvolve(mon, onDone) {
    this.evoMon = mon; this.evoDone = onDone;
    const sp = SPECIES[mon.species], evo = Box.evoInfo(mon), into = SPECIES[evo.into];
    this.modalKind = 'evolve';
    this.openModal(`
      <div class="modal-box panel evo-box">
        <h2>${esc(sp.name)} is ready to evolve!</h2>
        <div class="evo-stage">
          <img class="px creature-big" src="${artURL('creature', mon.species)}">
          <span class="evo-arrow">→</span>
          <img class="px creature-big mystery" src="${artURL('creature', into.id)}">
        </div>
        <div class="small" style="text-align:center">Lv ${mon.level} · uses 1 <b>${STONES[evo.item].name}</b> <img class="px inline-ic" src="${icon(STONES[evo.item].icon, 2)}"> (you have ${Box.itemCount(evo.item)})</div>
        <div class="loot-actions">
          <button class="btn" data-act="evolve-go">Evolve! <span class="key">E</span></button>
          <button class="btn secondary" data-act="evolve-later">Not now</button>
        </div>
      </div>`);
  }
  playEvolve() {
    const g = this.g, mon = this.evoMon;
    const from = SPECIES[mon.species], into = SPECIES[from.evo];
    const isNew = !Box.known(into.id);
    this.modalKind = 'evolving';
    const box = this.el.modal.querySelector('.modal-box');
    box.classList.add('cut-box');
    box.innerHTML = `
      <h2>What? ${esc(from.name)} is evolving!</h2>
      <canvas class="cut" aria-label="${esc(from.name)} evolving"></canvas>
      <div class="cut-skip">Tap to skip</div>`;
    playEvolveScene(box.querySelector('canvas'), from.id, into.id).then(() => {
      if (this.modalKind !== 'evolving') return;
      g.doEvolve(mon);
      this.modalKind = 'evolved';
      box.classList.remove('cut-box');
      const sig = into.unique;
      box.innerHTML = `
        <h2>${esc(from.name)} evolved into ${esc(into.name)}!</h2>
        <div class="card loot-card pet-reveal">
          ${isNew ? '<span class="new-badge">New!</span>' : ''}
          ${typePill(into.type)}
          <img class="px creature-big" src="${artURL('creature', into.id)}">
          <div class="title">${esc(into.name)}</div>
          <div class="small">${esc(into.desc)}</div>
          <div class="small"><b>Its skill grows: ${esc(sig.name)}</b> · ${esc(sig.desc)}</div>
        </div>
        <div class="loot-actions"><button class="btn" data-act="evolve-close">Amazing! <span class="key">E</span></button></div>`;
      g.particles.burst(g.player?.x ?? 0, g.player?.y ?? 0, { n: 30, colors: ['#ffe07a', '#ffffff', '#c88aff'], speed: 120, life: 0.7 });
    });
  }
  closeEvolve() {
    this.closeModal();
    this.evoDone?.();
    if (this.screen === 'ranch') this.showRanch();
  }

  openPause() {
    const g = this.g, P = g.player, S = P.stats, T = g.team || { dmg: 0, haste: 0, def: 0, hp: 0 };
    g.modal = 'pause';
    this.prompt(null);
    const row = (cat, list) => list.length ? list.map((i) => {
      const d = itemDef(cat, i.id);
      return `<div class="inv-item"><img class="px" src="${icon(d.icon, 2)}">${esc(d.name)} <b>Lv ${i.level}</b></div>`;
    }).join('') : '<span style="color:var(--muted);font-size:14px">— empty —</span>';
    const pets = P.pets.length ? P.pets.map((p) => {
      const need = petXpFor(p.mon.level);
      const ready = Box.canEvolve(p.mon);
      const skills = p.mon.skills.map((k) => { const t = p.tierOf(k); return `${esc(k.k === 'u' ? SPECIES[k.sp].unique.name : PASSIVES[k.id].name)} <b style="color:${TIER_COLOR[t]}">${TIERS[t]}</b>${k.k === 'u' ? ` <small style="color:${ATK_TYPES[atkType(k.sp)].color}">${ATK_TYPES[atkType(k.sp)].name}</small>` : ''}`; }).join(' · ');
      return `<div class="inv-item pet-item ${p.fainted ? 'fainted' : ''}"><img class="px" src="${artURL('creature', p.species)}"><div><b>${esc(p.name)}</b> Lv ${p.mon.level}${p.fainted ? ' · fainted' : ''}<div class="pet-skills">${skills}</div><div class="xp"><div style="width:${Math.min(100, (p.mon.xp / need) * 100).toFixed(0)}%"></div></div></div>${ready ? `<button class="btn small" data-evolve="${p.mon.id}">Evolve</button>` : ''}</div>`;
    }).join('') : '<span style="color:var(--muted);font-size:14px">— hatch your egg or catch wild survivalmons —</span>';
    const pct = (v) => `${Math.round(v * 100)}%`;
    const stats = [
      ['Max HP', S.maxHp], ['Regen', `${S.regen.toFixed(1)}/s`], ['Armor', `${Math.round(S.armor)} (-${armorPct(S.armor)}% damage)`], ['Move speed', pct(S.speed / 64)],
      ['Damage', pct(S.might)], ['Cooldowns', pct(S.cooldown)], ['Area', pct(S.area)], ['Projectiles', `+${S.amount}`],
      ['Crit chance', pct(S.crit)], ['Crit damage', pct(S.critMult)], ['Pickup range', pct(S.magnet / 30)],
      ['EXP gain', pct(S.growth)], ['Team damage', `+${pct(T.dmg + S.petPower - 1)}`], ['Team attack speed', `+${pct(T.haste)}`],
      ['Team defense', `+${pct(T.def)}`], ['Team max HP', `+${pct(T.hp)}`],
    ].map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join('');
    const st = g.settings;
    this.openModal(`
      <div class="modal-box panel pause-box">
        <h2>Paused</h2>
        <div class="pause-body">
        <div class="pause-grid">
          <div class="pause-sec">
            <h3>Weapons</h3><div class="inv-row">${row('weapon', P.weapons)}</div>
            <h3 style="margin-top:10px">Team ${P.pets.length}/${Box.teamSize()}</h3><div class="inv-row">${pets}</div>
          </div>
          <div class="pause-sec"><h3>Stats</h3><div class="stat-list">${stats}</div>
            <div class="toggles" style="margin-top:12px"><h3>Options</h3>
              <label><input type="checkbox" data-set="shake" ${st.shake ? 'checked' : ''}> Screen shake</label>
              <label><input type="checkbox" data-set="music" ${st.music ? 'checked' : ''}> Music</label>
              <div class="loot-actions" style="justify-content:flex-start;margin-top:6px">
                <button class="btn small secondary" data-act="controls">📱 ${this.controlsLabel()}</button>
                ${document.fullscreenEnabled ? '<button class="btn small secondary" data-act="fullscreen">⛶ Fullscreen</button>' : ''}
              </div>
            </div>
          </div>
        </div>
        </div>
        <div class="loot-actions pause-actions"><button class="btn" data-act="resume">Resume <span class="key">Esc</span></button><button class="btn secondary" data-act="quit">End run</button></div>
      </div>`);
    this.modalKind = 'pause';
    this.el.modal.querySelectorAll('[data-set]').forEach((cb) => cb.addEventListener('change', () => {
      st[cb.dataset.set] = cb.checked;
      g.saveSettings();
      if (cb.dataset.set === 'music') { if (cb.checked) Audio.startMusic(); else Audio.stopMusic(); }
    }));
  }
  closePause() {
    this.closeModal();
    this.g.modal = null;
  }

  // Run summary: stats, how the team grew, what was caught, and where to go next.
  // Sized to fit a landscape phone without scrolling; the menu row always stays on screen.
  // kind: 'timeup' | 'won' | 'died' | 'quit'; earned = coins banked from this run
  showEnd(kind, rec, newBest, earned) {
    const g = this.g, P = g.player, R = g.runStats;
    this.prompt(null);
    this.touch.setVisible(false);
    this.h?.paused.classList.add('hidden');
    const won = kind === 'won', quit = kind === 'quit';
    const title = { won: 'You survived the night!', timeup: 'Time\'s up!', quit: 'Run ended', died: 'You were overwhelmed...' }[kind];
    const color = won || kind === 'timeup' ? '#9af08a' : quit ? 'var(--gold)' : '#ff8a7a';
    const tiles = [
      ['Survived', formatTime(rec.time)], ['Level', rec.level], ['Defeated', rec.kills.toLocaleString()],
      ['Damage', Math.round(R.damage).toLocaleString()], ['Coins', earned.toLocaleString()], ['Houses', R.houses],
      ['Caught', P.caught.length], ['Team', P.pets.length],
    ].map(([k, v]) => `<div class="end-tile"><span>${k}</span><b>${esc(v)}</b></div>`).join('');
    const startLv = g.runStart?.petLv || new Map();
    const team = P.pets.map((p) => {
      const was = startLv.get(p.mon.id), now = p.mon.level;
      const grew = !was ? `Joined · Lv ${now}` : was < now ? `Lv ${was} → ${now}` : `Lv ${now}`;
      return `<div class="end-mon"><img class="px" src="${artURL('creature', p.species)}"><div><b>${esc(p.name)}</b><span>${grew}</span></div></div>`;
    }).join('') || '<em>No critters came along</em>';
    const caught = P.caught.map((id) => `<img class="px" title="${esc(SPECIES[id].name)}" src="${artURL('creature', id)}">`).join('');
    setTimeout(() => {
      if (g.mode !== 'end') return;
      this.openModal(`
        <div class="modal-box panel end-box">
          <div class="end-head">
            <img class="px end-hero" src="${artURL('hero', P.hero.id) || iconURL('hero', P.hero.id, 5)}">
            <div class="end-title">
              <h2 style="color:${color}">${title}</h2>
              <div class="end-sub">${esc(P.hero.name)} · ${formatTime(rec.time)} survived${newBest ? ' <span class="end-best">New best!</span>' : ''}</div>
              <div class="end-coins"><img class="px" src="${icon('coin', 2)}" alt="">+${earned.toLocaleString()} coins · ${Meta.coins.toLocaleString()} in the bank${Object.entries(P.mats || {}).filter(([, n]) => n > 0).map(([k, n]) => ` · <img class="px" src="${icon(MATERIALS[k].icon, 2)}" alt="">+${n}`).join('')}</div>
            </div>
          </div>
          <div class="end-body">
            <div class="end-tiles">${tiles}</div>
            <div class="end-side">
              <div class="end-label">Your team</div>
              <div class="end-team">${team}</div>
              ${caught ? `<div class="end-label">Caught this run · now at your Ranch</div><div class="end-caught">${caught}</div>` : ''}
            </div>
          </div>
          <div class="end-actions">
            <button class="btn" data-act="town">Back to town <span class="key">Enter</span></button>
            <button class="btn secondary" data-act="again">Run again</button>
            <button class="btn secondary" data-act="title">Title</button>
          </div>
        </div>`);
      this.modalKind = 'end';
    }, won || kind === 'timeup' ? 600 : quit ? 150 : 900);
  }

  // ------------------------------------------------------------ input
  onClick(e) {
    const t = e.target.closest('[data-act],[data-hero],[data-pick],[data-swap],[data-starter],[data-evolve],[data-buy],[data-pickhero],[data-mact],[data-pact]');
    if (!t) return;
    Audio.unlock();
    const g = this.g;
    if (t.dataset.hero) {
      Audio.play('click');
      if (g.touchMode) this.enterFullscreen();
      g.startRun(t.dataset.hero);
      return;
    }
    if (t.dataset.pick !== undefined) { this.pickLevel(+t.dataset.pick); return; }
    if (t.dataset.buy) { this.buyTraining(t.dataset.buy); return; }
    if (t.dataset.pickhero) { this.pickHero(t.dataset.pickhero); return; }
    if (t.dataset.swap) { this.lootSwap(t.dataset.swap); return; }
    if (t.dataset.starter) { this.chooseStarter(t.dataset.starter); return; }
    if (t.dataset.mact) { Audio.play('click'); this.monsAct(t.dataset.mact, t); return; }
    if (t.dataset.pact) { Audio.play('click'); this.profAct(t.dataset.pact, t); return; }
    if (t.dataset.evolve) {
      const mon = Box.get(+t.dataset.evolve);
      if (!mon) return;
      if (g.modal === 'pause') { this.closePause(); g.openEvolve(mon); }
      else this.showEvolve(mon, null);
      return;
    }
    Audio.play('click');
    switch (t.dataset.act) {
      case 'profiles': this.closeModal(); this.showProfiles(); break;
      case 'install': {
        const p = window.__install;
        if (p) { p.prompt(); p.userChoice.finally(() => { window.__install = null; if (this.screen === 'title') this.showTitle(); }); }
        break;
      }
      case 'play':
        if (g.touchMode) this.enterFullscreen();
        if (Box.isEmpty && !Box.eggs.length) this.showStarter(); else g.toTown();
        break;
      case 'box': this.showRanch(); break;
      case 'town': g.toTown(true); break;
      case 'go': Box.save(); g.startRun(Meta.hero); break;
      case 'leave': this.closeModal(); g.modal = null; break;
      case 'evolve-go': this.playEvolve(); break;
      case 'evolve-later': case 'evolve-close': this.closeEvolve(); break;
      case 'help': this.showHelp(); break;
      case 'close': this.closeModal(); if (g.mode === 'town') g.modal = null; break;
      case 'back': this.back(); break;
      case 'reroll': this.reroll(); break;
      case 'take': this.lootTake(); break;
      case 'salvage': this.lootSalvage(); break;
      case 'hatch': this.hatch(); break;
      case 'next': this.nextLoot(); break;
      case 'resume': this.closePause(); break;
      case 'quit': // ask once more so a stray tap can't throw a run away
        t.dataset.act = 'quit-yes'; t.textContent = 'Tap again to end the run'; t.classList.add('danger');
        break;
      case 'quit-yes': this.closePause(); g.endRun('quit'); break;
      case 'again': g.runAgain(); break;
      case 'choose': g.toTitle(); this.showSelect(); break;
      case 'title': g.toTitle(); break;
      case 'controls':
        this.cycleControls();
        t.textContent = `📱 ${this.controlsLabel()}`;
        break;
      case 'fullscreen': this.toggleFullscreen(); break;
      case 'portrait': g.allowPortrait = true; g.checkOrientation(); break;
    }
  }
  onKey(e) {
    const k = e.code;
    if (e.repeat && this.modalKind) return;
    if (this.screen === 'profiles' && !this.modalKind) {
      if (e.target.classList?.contains('prof-input')) { if (k === 'Enter' || k === 'NumpadEnter') this.profAct('save-name', e.target); else if (k === 'Escape') this.showProfiles(); return; }
      if (k === 'Escape') this.back();
      return;
    }
    if (this.modalKind === 'help') { if (k === 'Escape' || k === 'Enter') { this.closeModal(); if (this.g.mode === 'town') this.g.modal = null; } return; }
    if (this.modalKind === 'levelup') {
      const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(k);
      if (i >= 0) this.pickLevel(i);
      else if (k === 'KeyR') this.reroll();
      return;
    }
    if (this.modalKind === 'loot' && (k === 'KeyE' || k === 'Enter' || k === 'Space')) {
      e.preventDefault();
      const it = this.lootItem;
      if (it.cat === 'egg') this.hatch();
      else if ($('[data-act="take"]', this.el.modal)) this.lootTake();
      Input.endFrame();
      return;
    }
    const ok = k === 'KeyE' || k === 'Enter' || k === 'Space';
    if (this.modalKind === 'hatched' && ok) { e.preventDefault(); this.nextLoot(); Input.endFrame(); return; }
    if (this.modalKind === 'hatched-mon' && ok) { e.preventDefault(); this.hatchNext(); Input.endFrame(); return; }
    if (this.modalKind === 'evolving' || this.modalKind === 'hatching') { e.preventDefault(); Input.endFrame(); return; }
    if (this.modalKind === 'evolve' && ok) { e.preventDefault(); this.playEvolve(); Input.endFrame(); return; }
    if (this.modalKind === 'evolved' && ok) { e.preventDefault(); this.closeEvolve(); Input.endFrame(); return; }
    if (this.modalKind === 'end' && k === 'Enter') { this.g.toTown(true); return; }
    if ((this.modalKind === 'training' || this.modalKind === 'townmenu') && k === 'Escape') { this.closeModal(); this.g.modal = null; return; }
    if (this.screen === 'team' && !this.modalKind && k === 'Escape') { this.showTown(); return; }
    if (this.screen === 'team' && !this.modalKind && k === 'Enter') { Box.save(); this.g.startRun(Meta.hero); return; }
    if (this.screen === 'title' && !this.modalKind && k === 'Enter' && this.g.mode === 'title') { Audio.unlock(); if (Box.isEmpty && !Box.eggs.length) this.showStarter(); else this.g.toTown(); return; }
    if (['ranch', 'starter', 'hatchery', 'clinic', 'survidex', 'shrine', 'workshop', 'merchant'].includes(this.screen) && k === 'Escape' && !this.modalKind) { this.back(); return; }
    if (this.screen === 'select' && this.g.mode !== 'world') {
      const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(k);
      if (i >= 0) { Audio.unlock(); this.g.startRun(HEROES[i].id); return; }
      if (k === 'ArrowRight' || k === 'KeyD') this.selIdx = (this.selIdx + 1) % HEROES.length;
      if (k === 'ArrowLeft' || k === 'KeyA') this.selIdx = (this.selIdx + HEROES.length - 1) % HEROES.length;
      if (k === 'Enter' || k === 'Space') { Audio.unlock(); this.g.startRun(HEROES[this.selIdx].id); }
      if (k === 'Escape') this.showTitle();
    }
  }

  tick(dt) {
    this.frame++;
    if (this.screen === 'select' && this.heroCanvases) this.drawSelect();
    if (this.g.mode === 'town' && this.screen === 'town') this.updateTownHUD();
    if ((this.g.mode === 'world' || this.g.mode === 'house') && this.screen === 'hud') {
      this.updateHUD();
      if (this.g.touchMode) this.touch.update();
    }
    void dt;
  }
}

Object.assign(UI.prototype, TownUI, MonsUI, ShopUI, ProfilesUI);

export { iconOf };
