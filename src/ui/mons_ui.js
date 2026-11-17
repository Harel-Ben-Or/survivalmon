// Survivalmon screens, mixed into UI: starter eggs, hatching, the Ranch, the Hatchery (eggs and
// breeding), the Clinic, the Survidex and the Spirit Shrine.
import { iconURL } from '../gfx/assets.js';
import { artURL } from '../gfx/art.js';
import { SPECIES, TYPES, STONES, STONE_OF, STARTERS, DEX_IDS, BASE_IDS, PURE_IDS, MIXED_IDS, EVOLVED_IDS, FINAL_IDS, evoLevel, BREED_LEVEL, MAX_PET_LEVEL, petXpFor, breedResult, ATK_TYPES, atkType,
  SIZE, sizeLabel, weightLabel, weightOf, monSize, fmtH, fmtW, H5, H95, W5, W95 } from '../content/species.js';
import { MEDALS, MEDAL_IDS, ACHIEVEMENTS, tierName, tiersReached } from '../systems/achievements.js';
import { ZONES } from '../world/world.js';
import { TIERS, PASSIVES, TIER_POWER } from '../content/skills.js';
import { Box, STARTER_HATCH, EGG_SLOTS, monName, monStats } from '../systems/collection.js';
import { Meta } from '../systems/meta.js';
import { Shrine, SHRINE_NODES, RESEARCH_ODDS } from '../systems/shrine.js';
import { Audio } from '../core/audio.js';
import { playHatch } from './cutscene.js';
import { eggURL } from '../gfx/eggs.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const icon = (id, s = 3) => iconURL('icon', id, s);
const pic = (species) => artURL('creature', species) || icon('egg', 3);
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const types = (sp) => sp.types.map((t) => `<span class="rar type-pill" style="background:${TYPES[t].color}">${TYPES[t].name}</span>`).join(' ');
export const skillName = (k) => (k.k === 'u' ? SPECIES[k.sp].unique.name : PASSIVES[k.id].name);
const skillDesc = (k) => (k.k === 'u' ? SPECIES[k.sp].unique.desc : PASSIVES[k.id].desc(PASSIVES[k.id].vals[k.t]));
// An attack type tag: its icon and name ('all' for upgrades that work on every type)
export const atkTag = (t, short = false) => {
  if (t === 'all') return '<span class="atk-tag all">All attacks</span>';
  const T = ATK_TYPES[t];
  if (!T) return '';
  return `<span class="atk-tag" style="--c:${T.color}" title="${esc(`${T.name}: ${T.desc}`)}"><img class="px" src="${icon(T.icon, 1)}" alt="">${short ? '' : esc(T.name)}</span>`;
};
// Skill chips: grade, name and, for attack skills, the attack type
export const skillChips = (mon) => mon.skills.map((k) => `<span class="sk" title="${esc(skillDesc(k))}"><b class="tier t${k.t}">${TIERS[k.t]}</b>${esc(skillName(k))}${k.k === 'u' ? atkTag(atkType(k.sp)) : ''}</span>`).join('');
// A small tile for picking survivalmons: the picture with its level and attack type, the name, and
// every skill as a grade badge and its name. The i button opens its sheet (stats and skills).
export const pickTile = (m, cls = '', attrs = '') => `<div class="pick-tile ${cls} ${m.hp <= 0 ? 'fainted' : ''}" ${attrs} title="${esc(monName(m))}">
    <span class="pt-pic"><img class="px" src="${pic(m.species)}" alt="" draggable="false"><b class="mt-lv">${m.level}</b>${atkTag(atkType(m.species), true)}</span>
    <span class="pt-name">${esc(monName(m))}</span>
    <span class="pt-skills">${m.skills.map((k) => `<span><b class="tier t${k.t} ${k.k === 'u' ? 'u' : ''}">${TIERS[k.t]}</b>${esc(skillName(k))}</span>`).join('')}</span>
    ${m.hp < 1 ? `<span class="mt-hp ${m.hp <= 0 ? 'out' : m.hp < 0.3 ? 'low' : ''}"><i style="width:${Math.round(m.hp * 100)}%"></i></span>` : ''}
    <button class="pt-info" data-mact="mon-open" data-id="${m.id}" aria-label="Stats and skills">i</button>
  </div>`;
// What each attack type's stats look like, in a few words
const STAT_BLURB = { shot: 'hit hard but are a little fragile', chain: 'attack fast but have the least HP', charge: 'are tough and hit steadily', area: 'have the most HP and good defense', support: 'hit softly and keep everyone going' };
// Stat bars. The bars are scaled to a strong Lv 70 final evolution, so they fill up as it grows.
const STAT_TOP = { hp: 2300, atk: 750, spd: 160, def: 50, crit: 25 };
export const statBlock = (m) => {
  const s = monStats(m);
  const row = (k, label, v, txt) => `<div class="st-row st-${k}"><span>${label}</span><div class="st-bar"><i style="width:${Math.max(3, Math.min(100, (v / STAT_TOP[k]) * 100)).toFixed(0)}%"></i></div><b>${txt}</b></div>`;
  return `<div class="stats">${row('hp', 'HP', s.hp, s.hp)}${row('atk', 'Attack', s.atk, s.atk)}${row('spd', 'Speed', s.spd, s.spd)}${row('def', 'Defense', s.def, `${s.def}%`)}${s.crit ? row('crit', 'Crit', s.crit, `${s.crit}%`) : ''}
    <div class="st-note">Each level: +${s.next.hp} HP, +${s.next.atk} Attack</div></div>`;
};
// ---------------------------------------------------------------- sorting and filtering
// Every list of survivalmons (Ranch, team picker, Hatchery, Clinic) has the same bar: how to sort it,
// and filters by type, group and attack type. Each list remembers its own choice on this device.
const SORTS = { name: 'Name A to Z', grade: 'Best skills first', level: 'Highest level first', new: 'Newest first', old: 'Oldest first', stage: 'Most evolved first' };
const GROUPS = { all: 'All groups', species: 'Species', breed: 'Breeds', evo1: 'First evolutions', evo2: 'Final evolutions' };
const LIST_SORT = { ranch: 'level', team: 'name', hatchery: 'name', clinic: 'level' };
const groupOf = (m) => ['', 'species', 'breed', 'evo1', 'evo2'][SPECIES[m.species].stage];
const bestTier = (m) => Math.max(...m.skills.map((k) => k.t));
const tierSum = (m) => m.skills.reduce((s, k) => s + k.t, 0);
const BY = {
  name: (a, b) => monName(a).localeCompare(monName(b)) || bestTier(b) - bestTier(a) || b.level - a.level,
  grade: (a, b) => bestTier(b) - bestTier(a) || tierSum(b) - tierSum(a) || b.level - a.level,
  level: (a, b) => b.level - a.level || bestTier(b) - bestTier(a) || a.id - b.id,
  new: (a, b) => (b.caughtAt || 0) - (a.caughtAt || 0) || b.id - a.id,
  old: (a, b) => (a.caughtAt || 0) - (b.caughtAt || 0) || a.id - b.id,
  stage: (a, b) => SPECIES[b.species].stage - SPECIES[a.species].stage || b.level - a.level || a.id - b.id,
};
const VIEWS_KEY = 'survivelmon.listViews';
let views = null;
const allViews = () => { if (!views) { try { views = JSON.parse(localStorage.getItem(VIEWS_KEY)) || {}; } catch { views = {}; } } return views; };
export const listView = (key) => ({ sort: LIST_SORT[key] || 'level', type: '', group: 'all', atk: '', ...allViews()[key] });
export function setListView(key, field, value) {
  allViews()[key] = { ...listView(key), [field]: value };
  try { localStorage.setItem(VIEWS_KEY, JSON.stringify(views)); } catch { /* storage unavailable */ }
}
// A list, filtered and sorted as its bar says
export function viewMons(key, mons) {
  const v = listView(key);
  return mons.filter((m) => (!v.type || SPECIES[m.species].types.includes(v.type)) && (v.group === 'all' || groupOf(m) === v.group) && (!v.atk || atkType(m.species) === v.atk))
    .sort(BY[v.sort] || BY.level);
}
// The bar: sort, type, group (left out where only species show) and attack type, and how many are shown
export function listBar(key, shown, all, { groups = true } = {}) {
  const v = listView(key);
  const sel = (field, label, options, val) => `<select data-lv="${field}" aria-label="${label}">${Object.entries(options).map(([k, t]) => `<option value="${k}" ${k === val ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  const types = { '': 'All types', ...Object.fromEntries(Object.entries(TYPES).map(([k, t]) => [k, t.name])) };
  const atks = { '': 'All attacks', ...Object.fromEntries(Object.entries(ATK_TYPES).map(([k, t]) => [k, t.name])) };
  return `<div class="list-bar" data-list="${key}">${sel('sort', 'Sort', SORTS, v.sort)}${sel('type', 'Type', types, v.type)}${groups ? sel('group', 'Group', GROUPS, v.group) : ''}${sel('atk', 'Attack type', atks, v.atk)}<span class="lb-count">${shown === all ? `${all} shown` : `${shown} of ${all}`}</span></div>`;
}
const hpBar = (mon) => `<div class="hp-bar ${mon.hp <= 0 ? 'out' : mon.hp < 0.3 ? 'low' : ''}"><div style="width:${Math.round(mon.hp * 100)}%"></div></div>`;
const healCost = (mon) => Math.ceil((1 - mon.hp) * (6 + mon.level * 2) * (1 - Meta.buildingBonus('clinic', 'discount')));

export const MonsUI = {
  // A full-screen page over the town (the town stops while it's open).
  page(screen, html) {
    this.bindListBars();
    if (screen !== 'ranch') this.freeSel = null; // leaving the Ranch ends Free several
    const same = this.screen === screen, top = this.el.select.scrollTop;
    this.hideScreens();
    if (this.g.mode === 'town') this.g.modal = 'screen';
    this.screen = screen;
    this.el.select.innerHTML = `<div class="mons-page">${html}${this.g.mode === 'town' ? this.pageBuilding(screen) : ''}<button class="btn secondary" data-act="back">${this.g.mode === 'town' ? 'Back to town' : 'Back'}</button></div>`;
    this.el.select.classList.remove('hidden');
    // a fresh page starts at the top; redrawing the same page (after a tap) keeps your place
    this.el.select.scrollTop = same ? top : 0;
  },

  // ------------------------------------------------------------ starter eggs
  showStarter() {
    this.hideScreens();
    this.screen = 'starter';
    this.el.select.innerHTML = `
      <h2>Choose your first egg</h2>
      <p class="sub-note">It hatches after a minute in the wild. Until then you run alone, and only after it hatches can you meet wild survivalmons.</p>
      <div class="starter-grid">
        ${STARTERS.map((id) => {
          const sp = SPECIES[id];
          return `<div class="starter-card panel clickable" data-starter="${id}">
            <img class="px egg-pick" src="${eggURL(sp.id, 3)}" alt="">
            <div class="name">${sp.name} egg</div>${types(sp)}
            <div class="desc">${esc(sp.desc)}</div>
          </div>`;
        }).join('')}
      </div>
      <button class="btn secondary" data-act="back">Back</button>`;
    this.el.select.classList.remove('hidden');
  },
  chooseStarter(id, story = false) {
    Box.addEgg({ species: id, skills: [{ k: 'u', sp: id, t: 0 }, { k: 'p', id: Object.keys(PASSIVES)[Math.floor(Math.random() * 9)], t: 0 }], need: STARTER_HATCH, kind: 'starter' });
    if (story) return; // picked inside the opening: its run comes next
    Audio.play('hatch');
    this.g.toTown();
    this.g.banner(`Your ${SPECIES[id].name} egg is in the Hatchery`, '#ffe07a', false, 'Run in the wild to warm it: it hatches after 1:00 in the wild');
  },

  // ------------------------------------------------------------ hatching
  // Shows each newly hatched survivalmon in turn, then calls done.
  showHatched(mons, done) {
    if (!mons.length) { done?.(); return; }
    const mon = mons[0], sp = SPECIES[mon.species];
    this.g.modal = 'hatched';
    this.modalKind = 'hatching';
    this.hatchQueue = mons.slice(1); this.hatchDone = done;
    const isNew = Box.hatchedNew?.has(mon.id);
    this.openModal(`
      <div class="modal-box panel cut-box">
        <h2>Oh? Your egg is moving!</h2>
        <canvas class="cut" aria-label="Your egg hatching"></canvas>
        <div class="cut-skip">Tap to skip</div>
      </div>`);
    const box = this.el.modal.querySelector('.modal-box');
    playHatch(box.querySelector('canvas'), mon.species).then(() => {
      if (this.modalKind !== 'hatching') return;
      this.modalKind = 'hatched-mon';
      box.classList.remove('cut-box');
      box.innerHTML = `
        <h2>Your egg hatched!</h2>
        <div class="card loot-card pet-reveal">
          ${isNew ? '<span class="new-badge">New!</span>' : ''}
          ${types(sp)}
          <img class="px creature-big" src="${pic(mon.species)}" alt="">
          <div class="title">${esc(sp.name)}</div>
          <div class="small">${esc(sp.desc)}</div>
          <div class="sk-row">${skillChips(mon)}</div>
          <div class="small">${isNew ? 'A new survivalmon for your Journal! ' : ''}${Box.inTeam(mon.id) ? 'It joined your team.' : 'It waits at your Ranch.'}</div>
        </div>
        <div class="loot-actions"><button class="btn" data-mact="hatch-next">Welcome, ${esc(sp.name)}! <span class="key">E</span></button></div>`;
    });
  },
  hatchNext() {
    this.closeModal();
    this.g.modal = null;
    this.showHatched(this.hatchQueue || [], this.hatchDone);
  },

  // ------------------------------------------------------------ Ranch
  // Every survivalmon as a small tile (picture, name, level and a tier badge per skill); tap one
  // for its sheet: a big picture, its skills in depth and what to do with it.
  showRanch() {
    const trained = Box.settleTraining();
    for (const t of trained) if (t.levels.length) this.toast(`${monName(t.mon)} trained up to Lv ${t.mon.level}!`);
    const list = viewMons('ranch', Box.mons);
    // Free several: tap survivalmons to choose them (not the team's), then free them all at once
    const freeing = !!this.freeSel, sel = this.freeSel || new Set();
    const tile = (m) => {
      const inTeam = Box.inTeam(m.id), act = !freeing ? 'mon-open' : inTeam ? 'free-locked' : 'free-pick';
      return `<div class="mon-tile ${inTeam ? 'in-team' : ''} ${m.hp <= 0 ? 'out' : ''} ${freeing && inTeam ? 'locked' : ''} ${sel.has(m.id) ? 'picked' : ''}" data-mact="${act}" data-id="${m.id}" title="${esc(monName(m))}">
        ${freeing && !inTeam ? `<i class="mt-check">${sel.has(m.id) ? '✓' : ''}</i>` : ''}
        <span class="mt-pic"><img class="px" src="${pic(m.species)}" alt="">${Box.isTraining(m.id) ? '<i class="mt-flag train" title="Training">T</i>' : ''}${Box.canEvolve(m) ? '<i class="mt-flag evo" title="Ready to evolve">!</i>' : ''}<b class="mt-lv">${m.level}</b></span>
        <span class="mt-name">${esc(monName(m))}</span>
        <span class="mt-tiers">${m.skills.map((k) => `<b class="tier t${k.t} ${k.k === 'u' ? 'u' : ''}" title="${esc(skillName(k))}">${TIERS[k.t]}</b>`).join('')}</span>
        ${m.hp < 1 ? `<span class="mt-hp ${m.hp <= 0 ? 'out' : m.hp < 0.3 ? 'low' : ''}"><i style="width:${Math.round(m.hp * 100)}%"></i></span>` : ''}
      </div>`;
    };
    // what freeing the chosen ones pays, in species coins
    const pay = {};
    for (const id of sel) { const m = Box.get(id); if (m) for (const [l, n] of Object.entries(Box.freeValue(m))) pay[l] = (pay[l] || 0) + n; }
    const payTxt = Object.entries(pay).map(([l, n]) => `${n} ${SPECIES[l].name}`).join(', ');
    const freeBar = !freeing ? '' : `<div class="free-bar panel">
        <span><b>${sel.size} chosen</b> <span class="small">${sel.size ? `· you get ${esc(payTxt)} coins` : '· tap survivalmons to free them (not your team)'}</span></span>
        <span class="fb-btns"><button class="btn small secondary" data-mact="free-all">Choose all shown</button><button class="btn small secondary" data-mact="free-none">Clear</button><button class="btn small secondary" data-mact="free-cancel">Cancel</button><button class="btn small danger" data-mact="free-go" ${sel.size ? '' : 'disabled'}>${this.freeSure ? `Tap again to free ${sel.size}` : `Free ${sel.size}`}</button></span>
      </div>`;
    const ups = BASE_IDS.map((l) => {
      const c = Box.upCost(l), have = Box.speciesCoins(l);
      return `<div class="sp-up"><img class="px" src="${pic(l)}" alt=""><div><b>${SPECIES[l].name}</b> <span class="lvl">Lv ${Box.upLevel(l)}</span><div class="small">${have} coins · +${Math.round(Box.upBonus(l) * 100)}% damage and HP</div></div>
        ${c === null ? '<span class="lvl">MAX</span>' : `<button class="btn small" data-mact="sp-up" data-line="${l}" ${have >= c ? '' : 'disabled'}>${c}</button>`}</div>`;
    }).join('');
    this.page('ranch', `
      <h2>Ranch</h2>
      <div class="box-meta panel">
        <span>${Box.mons.length} survivalmons</span>
        <span>Training ${Box.data.training.length}/${Box.trainSpots()} spots</span>
        <span class="tier-key">${TIERS.map((T, i) => `<b class="tier t${i}">${T}</b>`).join('')} skill tiers</span>
        ${Box.isEmpty || freeing ? '' : '<button class="btn small secondary" data-mact="free-mode">Free several…</button>'}
      </div>
      ${Box.isEmpty ? '<p class="sub-note">No survivalmons yet. Your first egg is warming in the Hatchery.</p>' : `${listBar('ranch', list.length, Box.mons.length)}
      ${list.length ? `<div class="mon-tiles">${list.map(tile).join('')}</div>` : '<p class="sub-note">None match these filters.</p>'}
      ${freeBar || '<p class="sub-note tap-note">Tap a survivalmon to see it up close.</p>'}`}
      <details class="panel sp-ups" ${this.upsOpen ? 'open' : ''}><summary class="team-label">Species upgrades · free a survivalmon for its species coins, then make every one of that species (and its breeds) stronger</summary><div class="sp-grid">${ups}</div></details>`);
    this.el.select.querySelector('details.sp-ups')?.addEventListener('toggle', (e) => { this.upsOpen = e.target.open; });
    if (this.sheetId != null && !freeing) { if (Box.get(this.sheetId)) this.showMonSheet(this.sheetId); else this.closeMonSheet(); }
  },
  // A change in any list's sort or filter bar redraws that list
  bindListBars() {
    if (this.listBarsBound) return;
    this.listBarsBound = true;
    this.el.select.addEventListener('change', (e) => {
      const s = e.target.closest('select[data-lv]');
      if (!s) return;
      const key = s.closest('.list-bar').dataset.list;
      setListView(key, s.dataset.lv, s.value);
      Audio.play('click');
      ({ ranch: () => this.showRanch(), team: () => this.renderTeam(), hatchery: () => this.showHatchery(), clinic: () => this.showClinic() })[key]?.();
    });
  },
  // One survivalmon up close
  showMonSheet(id, renaming = false) {
    const m = Box.get(id);
    if (!m) return;
    this.sheetId = id;
    const sp = SPECIES[m.species], need = petXpFor(m.level), evo = Box.evoInfo(m);
    const maxHp = monStats(m).hp;
    const value = Object.entries(Box.freeValue(m)).map(([l, n]) => `${n} ${SPECIES[l].name}`).join(' + ');
    const evoLine = !evo ? '' : Box.canEvolve(m) ? `<button class="btn small" data-evolve="${m.id}">Evolve into ${esc(SPECIES[evo.into].name)}</button>`
      : `<div class="evo-need">Evolves at Lv ${evo.level} with ${evo.items.map((st) => STONES[st].name).join(' or ')}</div>`;
    // what each tier gives: the attack's power, or the passive's value
    const ladder = (k) => TIERS.map((T, i) => `<span class="tl ${i === k.t ? 'on' : ''}"><b class="tier t${i}">${T}</b>${k.k === 'u' ? Math.round(TIER_POWER[i] * 100) : Math.round(PASSIVES[k.id].vals[i] * 100)}%</span>`).join('');
    const skills = m.skills.map((k) => `<div class="ms-skill">
        <b class="tier big t${k.t}">${TIERS[k.t]}</b>
        <div><div class="ms-sk-name"><b>${esc(skillName(k))}</b> ${k.k === 'u' ? `${atkTag(atkType(k.sp))} <span class="small">attack</span>` : '<span class="small">passive</span>'}</div>
          <div class="small">${esc(skillDesc(k))}</div>
          <div class="tier-ladder">${k.k === 'u' ? 'Power' : 'Value'} by tier: ${ladder(k)}</div></div>
      </div>`).join('');
    const nameRow = renaming
      ? `<div class="ms-name name-row"><input class="name-input mon-name-input" maxlength="14" value="${esc(monName(m))}" aria-label="Name" autocomplete="off" spellcheck="false" enterkeyhint="done"><button class="btn small" data-mact="mon-rename-save" data-id="${m.id}">Save</button></div>`
      : `<div class="ms-name"><b>${esc(monName(m))}</b><button class="btn small secondary" data-mact="mon-rename" data-id="${m.id}">✎ Rename</button></div>`;
    this.openModal(`
      <div class="modal-box panel mon-sheet">
        <div class="ms-top">
          <div class="ms-pic ${m.hp <= 0 ? 'out' : ''}"><img class="px" src="${pic(m.species)}" alt=""></div>
          <div class="ms-info">
            ${nameRow}
            <div class="ms-sub">${m.nick ? `${esc(sp.name)} · ` : ''}<b class="lv">Lv ${m.level}</b> ${types(sp)} ${atkTag(atkType(m.species))}${Box.inTeam(m.id) ? ' <span class="badge">Team</span>' : ''}${Box.isTraining(m.id) ? ' <span class="badge">Training</span>' : ''}</div>
            <div class="bar-row"><span>HP</span>${hpBar(m)}<span class="num">${Math.round(m.hp * maxHp)}/${maxHp}</span></div>
            <div class="bar-row"><span>EXP</span><div class="xp"><div style="width:${Math.min(100, (m.xp / need) * 100).toFixed(0)}%"></div></div><span class="num">${Math.floor(m.xp)}/${need}</span></div>
            <div class="small ms-size">${(() => { const z = monSize(m.species, m.sz || 1, m.wz || 1); return `<b>${sizeLabel(m.sz || 1)}</b> ${fmtH(z.h)} · <b>${weightLabel(weightOf(m))}</b> ${fmtW(z.w)}`; })()}</div>
            <div class="small">${esc(sp.desc)}</div>
          </div>
        </div>
        <div class="team-label">Stats · ${esc(ATK_TYPES[atkType(m.species)]?.name || '')} survivalmons ${STAT_BLURB[atkType(m.species)] || ''}</div>
        ${statBlock(m)}
        <div class="ms-skills">${skills}</div>
        ${evoLine}
        ${(() => {
          const have = Box.feedCoinsHave(m), kinds = [...new Set(sp.lines)].map((l) => `${Box.speciesCoins(l)} ${SPECIES[l].name}`).join(' + ');
          if (m.level >= MAX_PET_LEVEL) return '';
          const btn = (n, label) => `<button class="btn small secondary" data-mact="feed" data-id="${m.id}" data-n="${n}" ${have >= n ? '' : 'disabled'}>${label}</button>`;
          return `<div class="feed-row"><span class="small">Feed species coins: each gives 1% of a level (you have ${kinds})</span>${btn(10, '+10% · 10')}${btn(100, '+1 level · 100')}${btn(Math.min(have, 100 * (MAX_PET_LEVEL - m.level)), `All · ${Math.min(have, 100 * (MAX_PET_LEVEL - m.level))}`)}</div>`;
        })()}
        <div class="loot-actions ms-actions">
          <button class="btn small" data-mact="mon-team" data-id="${m.id}" ${m.hp <= 0 && !Box.inTeam(m.id) ? 'disabled' : ''}>${Box.inTeam(m.id) ? 'Leave the team' : 'Join the team'}</button>
          <button class="btn small secondary" data-mact="train" data-id="${m.id}">${Box.isTraining(m.id) ? 'Stop training' : 'Train'}</button>
          <button class="btn small secondary free-btn" data-mact="free" data-id="${m.id}" title="Free it for ${esc(value)} coins">Free</button>
          <button class="btn small secondary" data-mact="mon-close">Close <span class="key">Esc</span></button>
        </div>
      </div>`);
    this.modalKind = 'monsheet';
    this.el.modal.classList.add('sheet-modal');
    if (renaming) { const inp = this.el.modal.querySelector('.mon-name-input'); setTimeout(() => { inp?.focus(); inp?.select(); }, 60); }
  },
  closeMonSheet() {
    this.sheetId = null;
    if (this.modalKind === 'monsheet') { this.closeModal(); this.modalKind = null; }
    this.el.modal.classList.remove('sheet-modal');
  },

  // ------------------------------------------------------------ Hatchery
  showHatchery() {
    // two parent slots, A and B; only the 10 species breed (a breed never does)
    const ok = (id) => { const m = Box.get(id); return m && m.level >= BREED_LEVEL && SPECIES[m.species].stage === 1; };
    const pick = this.breedPick = [0, 1].map((i) => (ok((this.breedPick || [])[i]) ? this.breedPick[i] : null));
    const nests = Array.from({ length: EGG_SLOTS }, (_, i) => {
      const e = Box.eggs[i];
      if (!e) return '<div class="nest panel"><img class="px" src="' + eggURL(null, 2) + '" style="opacity:.25" alt=""><span>Empty nest</span></div>';
      const known = Box.known(e.species) || e.kind !== 'bred';
      const close = e.progress >= e.need * 0.75; // wobbles when it is nearly ready to hatch
      return `<div class="nest panel"><img class="px ${close ? 'egg-ready' : ''}" src="${eggURL(e.species, 2)}" alt=""><b>${known ? `${SPECIES[e.species].name} egg` : 'Mystery egg'}</b>
        <div class="hp-bar warm"><div style="width:${Math.round((e.progress / e.need) * 100)}%"></div></div><span>${mmss(e.progress)} / ${mmss(e.need / 1)} in the wild</span></div>`;
    }).join('');
    const basics = Box.mons.filter((m) => SPECIES[m.species].stage === 1);
    const ready = basics.filter((m) => m.level >= BREED_LEVEL), young = basics.length - ready.length;
    const [A, B] = pick.map((id) => id && Box.get(id));
    const result = A && B ? breedResult(A.species, B.species) : null;
    const full = Box.eggs.length >= EGG_SLOTS;
    // a parent window: the chosen survivalmon's picture, level, types, attack and skills
    const win = (m, i) => {
      const label = i ? 'Parent B' : 'Parent A';
      if (!m) return `<div class="parent-win empty"><span class="pw-label">${label}</span><img class="px" src="${eggURL(null, 2)}" alt=""><span class="small">${i && !A ? 'Pick parent A first' : 'Tap a survivalmon below'}</span></div>`;
      const sp = SPECIES[m.species], st = monStats(m);
      return `<div class="parent-win">
        <span class="pw-label">${label}</span>
        <button class="pw-x" data-mact="parent-clear" data-slot="${i}" aria-label="Take ${esc(monName(m))} out">✕</button>
        <div class="pw-head"><img class="px" src="${pic(m.species)}" alt=""><div><b>${esc(monName(m))}</b><div class="small">Lv ${m.level}${m.nick ? ` · ${esc(sp.name)}` : ''}</div><div>${types(sp)} ${atkTag(atkType(m.species), true)}</div></div></div>
        <div class="pw-stats"><span>HP <b>${st.hp}</b></span><span>Attack <b>${st.atk}</b></span><span>Speed <b>${st.spd}</b></span></div>
        <div class="pw-skills">${m.skills.map((k) => `<div><b class="tier t${k.t} ${k.k === 'u' ? 'u' : ''}">${TIERS[k.t]}</b><span><b>${esc(skillName(k))}</b> <span class="small">${esc(skillDesc(k))}</span></span></div>`).join('')}</div>
        <button class="pt-info" data-mact="mon-open" data-id="${m.id}" aria-label="Stats and skills">i</button>
      </div>`;
    };
    const known = result && Box.known(result);
    const mid = `<div class="breed-mid">
        <span class="bm-plus">+</span>
        ${result ? `<img class="px bm-egg" src="${eggURL(known ? result : null, 3)}" alt=""><b>${known ? esc(SPECIES[result].name) : 'Mystery breed'}</b>${known ? atkTag(atkType(result)) : '<span class="small">not found yet</span>'}
          <button class="btn" data-mact="breed-preview" ${full ? 'disabled' : ''}>Combine</button>${full ? '<span class="small">All nests are full</span>' : ''}`
        : `<span class="small">${A ? 'Now pick parent B' : 'Pick two parents'}</span>`}
      </div>`;
    const shown = viewMons('hatchery', ready);
    const choose = shown.map((m) => pickTile(m, pick.includes(m.id) ? 'sel' : '', `data-mact="pick-parent" data-id="${m.id}"`)).join('');
    this.page('hatchery', `
      <h2>Hatchery</h2>
      <div class="nests">${nests}</div>
      <div class="panel breed-box">
        <div class="team-label">Breed two species (Lv ${BREED_LEVEL}+), or two of the same one. Both parents are used up; the egg gets one skill from each and a new attack of its own.</div>
        <div class="breed-stage">${win(A, 0)}${mid}${win(B, 1)}</div>
        ${ready.length ? `${listBar('hatchery', shown.length, ready.length, { groups: false })}${shown.length ? `<div class="pick-tiles breed-pool">${choose}</div>` : '<p class="sub-note">None match these filters.</p>'}` : `<p class="sub-note">You need species at Lv ${BREED_LEVEL} or higher. Catch them in the wild.</p>`}
        ${young ? `<p class="sub-note">${young} more ${young === 1 ? 'species is' : 'species are'} below Lv ${BREED_LEVEL}. Breeds and evolutions can't breed.</p>` : '<p class="sub-note">Only species breed; breeds and evolutions never do.</p>'}
      </div>`);
  },

  // Before breeding: both parents, what they make, its own attack's tier odds and every skill pair
  // it can inherit, with the chances. Breeding only happens from here.
  showBreedPreview() {
    const [a, b] = (this.breedPick || []).map((id) => id && Box.get(id));
    const pv = a && b && Box.breedPreview(a.id, b.id, Shrine.odds());
    if (!pv) return;
    const known = Box.known(pv.species), sp = SPECIES[pv.species];
    const chip = (k) => `<span class="sk"><b class="tier t${k.t} ${k.k === 'u' ? 'u' : ''}">${TIERS[k.t]}</b>${esc(skillName(k))}</span>`;
    const pctTxt = (v) => (v >= 1 || v === 0 ? `${Math.round(v)}%` : '<1%');
    const own = pv.own.map((v, i) => (v > 0.05 ? `<span><b class="tier t${i} u">${TIERS[i]}</b>${pctTxt(v)}</span>` : '')).join('');
    const combos = pv.combos.map((c) => `<div class="bp-combo"><span class="sk-row">${c.skills.length ? c.skills.map(chip).join('') : '<span class="small">nothing extra</span>'}</span><b>${pctTxt(c.p)}</b></div>`).join('');
    this.openModal(`
      <div class="modal-box panel breed-preview">
        <h2>Breed these two?</h2>
        <div class="bp-parents">${pickTile(a, 'bp')}<span class="bp-op">+</span>${pickTile(b, 'bp')}<span class="bp-op">→</span>
          <div class="bp-egg"><img class="px" src="${eggURL(known ? pv.species : null, 3)}" alt=""><b>${known ? esc(sp.name) : 'Mystery breed'}</b>${known ? atkTag(atkType(pv.species)) : '<span class="small">a breed you have not found yet</span>'}</div></div>
        <div class="team-label">Its own attack${known ? ` (${esc(sp.unique.name)})` : ''}: tier odds</div>
        <div class="odds">${own}</div>
        <div class="team-label">Plus one skill from each parent, picked at random${pv.combos.length > 1 ? ': every way it can go' : ''}</div>
        <div class="bp-combos">${combos}</div>
        <p class="sub-note">${esc(monName(a))} and ${esc(monName(b))} are used up. The egg hatches after 3:00 in the wild.</p>
        <div class="loot-actions">
          <button class="btn" data-mact="breed">Breed</button>
          <button class="btn secondary" data-mact="breed-cancel">Cancel <span class="key">Esc</span></button>
        </div>
      </div>`);
    this.modalKind = 'breedpreview';
    this.el.modal.classList.add('sheet-modal');
  },
  // Redraw whichever page a survivalmon sheet was opened from, and the sheet on top of it
  monsRefresh() {
    if (this.screen === 'team') this.renderTeam();
    else if (this.screen === 'hatchery') this.showHatchery();
    else { this.showRanch(); return; } // the Ranch reopens the sheet itself
    if (this.sheetId != null) { if (Box.get(this.sheetId)) this.showMonSheet(this.sheetId); else this.closeMonSheet(); }
  },

  // ------------------------------------------------------------ Clinic
  showClinic() {
    const hurt = Box.hurtMons();
    const total = hurt.reduce((s, m) => s + healCost(m), 0);
    const shown = viewMons('clinic', hurt);
    const rows = shown.map((m) => `<div class="clinic-row panel"><img class="px" src="${pic(m.species)}" alt=""><div><b>${esc(monName(m))}</b> Lv ${m.level}${m.hp <= 0 ? ' · <span class="out-txt">Fainted</span>' : ''}${hpBar(m)}</div>
      <button class="btn small" data-mact="heal" data-id="${m.id}" ${Meta.coins >= healCost(m) ? '' : 'disabled'}><img class="px" src="${icon('coin', 2)}" alt="">${healCost(m)}</button></div>`).join('');
    this.page('clinic', `
      <h2>Clinic</h2>
      <div class="box-meta panel"><span><img class="px inline-ic" src="${icon('coin', 2)}" alt=""> ${Meta.coins}</span><span>Survivalmons that stay home heal ${Math.round((0.5 + Meta.buildingBonus('clinic', 'rest') + Shrine.bonus('rest')) * 100)}% each run for free</span></div>
      ${hurt.length ? `${listBar('clinic', shown.length, hurt.length)}<div class="clinic-list">${rows || '<p class="sub-note">None match these filters.</p>'}</div><button class="btn" data-mact="heal-all" ${Meta.coins >= total ? '' : 'disabled'}>Heal everyone (${total} coins)</button>` : '<p class="sub-note">Everyone is healthy.</p>'}`);
  },

  // ------------------------------------------------------------ Survidex
  // Every survivalmon as a cell (had one: in colour; seen in the wild: a shadow; never met: faint).
  // Tapping one opens its page, which tells only what you've found out yourself.
  showSurvidex(sel) {
    const cell = (id) => {
      const known = Box.known(id), seen = Box.data.seen[id];
      const md = Object.keys(Box.data.dex[id]?.medals || {}).length;
      return `<span class="j-cell ${known ? 'caught' : seen ? 'seen' : ''} ${id === sel ? 'pick' : ''}" data-mact="dex" data-sp="${id}" title="${known || seen ? esc(SPECIES[id].name) : '???'}"><img class="px" src="${pic(id)}" alt="">${md ? `<b class="j-medals" title="${md} medal${md === 1 ? '' : 's'}">${md}</b>` : ''}</span>`;
    };
    const group = (title, ids) => `<div class="j-title">${title} <span class="j-n">${ids.filter((id) => Box.known(id)).length}/${ids.length}</span></div><div class="j-row">${ids.map(cell).join('')}</div>`;
    const found = DEX_IDS.filter((id) => Box.known(id)).length;
    const medalsWon = Object.values(Box.data.dex).reduce((n, r) => n + Object.keys(r.medals || {}).length, 0);
    const tiersAll = ACHIEVEMENTS.reduce((n, a) => n + a.tiers.length, 0), tiersGot = ACHIEVEMENTS.reduce((n, a) => n + tiersReached(a), 0);
    const tab = this.dexTab || 'mons';
    // achievements: each goal with its tiers (reached ones lit), progress to the next and its reward
    const achv = ACHIEVEMENTS.map((a) => {
      const t = tiersReached(a), have = a.have(), done = t >= a.tiers.length, goal = a.tiers[Math.min(t, a.tiers.length - 1)];
      return `<div class="achv ${done ? 'done' : ''}"><div class="achv-top"><b>${esc(done ? tierName(a, t - 1) : tierName(a, t))}</b><span class="achv-pips">${a.tiers.map((_, i) => `<i class="${i < t ? 'on' : ''}"></i>`).join('')}</span></div>
        <div class="small">${esc(a.desc(goal))}</div>
        ${done ? '<div class="small achv-done">Done!</div>' : `<div class="achv-bar"><i style="width:${Math.min(100, (have / goal) * 100).toFixed(0)}%"></i></div><div class="small achv-prog"><span>${Math.min(have, goal)} / ${goal}</span><span>Reward: ${a.pay[t]} <img class="px inline-ic" src="${icon('coin', 2)}" alt="coins"></span></div>`}</div>`;
    }).join('');
    const medalKey = MEDAL_IDS.map((k) => `<span class="medal on" style="--c:${MEDALS[k].color}" title="${esc(MEDALS[k].desc)}">${esc(MEDALS[k].name)}</span>`).join('');
    this.page('survidex', `
      <h2>Survidex</h2>
      <div class="box-meta panel"><span>${found} / ${DEX_IDS.length} found</span><span>${medalsWon} medals</span><span>${tiersGot} / ${tiersAll} achievements</span></div>
      <div class="dex-tabs"><button class="btn small ${tab === 'mons' ? '' : 'secondary'}" data-mact="dex-tab" data-t="mons">Survivalmons</button><button class="btn small ${tab === 'achv' ? '' : 'secondary'}" data-mact="dex-tab" data-t="achv">Achievements</button></div>
      ${tab === 'mons' ? `<div class="journal panel"><div class="small">Tap one for everything you know about it. The number on an entry is its medals.</div>${group('Species', BASE_IDS)}${group('Same-species breeds', PURE_IDS)}${group('Mixed breeds', MIXED_IDS)}${group('First evolutions · Lv 30', EVOLVED_IDS)}${group('Final evolutions · Lv 55', FINAL_IDS)}</div>`
        : `<div class="journal panel"><div class="small">Each tier you reach pays gold coins. Medals are won per survivalmon: ${medalKey}</div><div class="achv-grid">${achv}</div></div>`}`);
    if (sel) this.showDexSheet(sel);
  },
  // One survivalmon's Survidex page
  showDexSheet(id) {
    const sp = SPECIES[id];
    if (!sp) return;
    this.dexSel = id;
    const known = Box.known(id), seen = Box.data.seen[id], r = Box.data.dex[id] || { n: 0, how: {}, where: {}, seenIn: {} };
    const num = `#${String(DEX_IDS.indexOf(id) + 1).padStart(3, '0')}`;
    const group = sp.stage === 1 ? 'Species' : sp.stage === 2 ? (sp.kind === 'pure' ? 'Same-species breed' : 'Mixed breed') : sp.stage === 3 ? 'First evolution' : 'Final evolution';
    const zoneList = (o, counts) => Object.entries(o).map(([z, n]) => `${esc(ZONES[z]?.name || z)}${counts && n > 1 ? ` ×${n}` : ''}`).join(', ');
    const head = (show) => `<div class="dex-head">
        <div class="ms-pic ${show ? '' : 'unknown'}"><img class="px" src="${pic(id)}" alt=""></div>
        <div class="ms-info"><span class="dex-num">${num} · ${group}</span>
          <div class="ms-name"><b>${show ? esc(sp.name) : '???'}</b></div>
          ${show ? `<div class="ms-sub">${types(sp)} ${atkTag(atkType(id))}</div>` : ''}
          ${known ? `<div class="small dex-desc">${esc(sp.desc)}</div>` : ''}</div></div>`;
    const nav = `<div class="loot-actions ms-actions">
        <button class="btn small secondary" data-mact="dex-step" data-d="-1" aria-label="Previous">‹</button>
        <button class="btn small secondary" data-mact="dex-close">Close <span class="key">Esc</span></button>
        <button class="btn small secondary" data-mact="dex-step" data-d="1" aria-label="Next">›</button></div>`;
    let body;
    if (!known && !seen) {
      const hint = sp.stage === 1 ? 'You have not met it yet. Species live in the wild: explore every zone.'
        : sp.stage === 2 ? 'Not found yet. Breed two species in the Hatchery to find it.'
        : `Not found yet. Evolve a survivalmon at Lv ${sp.stage === 3 ? 30 : 55} to find it.`;
      body = `${head(false)}<p class="sub-note">${hint}</p>`;
    } else if (!known) {
      body = `${head(true)}
        ${Object.keys(r.seenIn).length ? `<div class="dex-sec"><b>Seen in</b> ${zoneList(r.seenIn)}</div>` : ''}
        <p class="sub-note">You have seen it but never had one. Catch one to learn more.</p>`;
    } else {
      // size: what most of them measure (9 in 10), then the extremes you've had
      const S = SIZE[id], hTxt = (sz) => `${fmtH(S.h * sz)} <span class="small">(${sizeLabel(sz)})</span>`, wTxt = (wf) => `${fmtW(S.w * wf)} <span class="small">(${weightLabel(wf)})</span>`;
      const size = `<div class="dex-sec"><b>Size</b><div>Most are ${fmtH(S.h * H5)} to ${fmtH(S.h * H95)} tall and weigh ${fmtW(S.w * W5)} to ${fmtW(S.w * W95)}</div>
          ${r.min != null ? `<div class="dex-rows"><span>Tallest you've had</span><span>${hTxt(r.max)}</span><span>Shortest</span><span>${hTxt(r.min)}</span>
            ${r.maxW != null ? `<span>Heaviest</span><span>${wTxt(r.maxW)}</span><span>Lightest</span><span>${wTxt(r.minW)}</span>` : ''}</div>` : ''}</div>`;
      const won = r.medals || {};
      const medals = `<div class="dex-sec"><b>Medals</b> <span class="small">${Object.keys(won).length} of ${MEDAL_IDS.length}</span><div class="medals">${MEDAL_IDS.map((k) => `<span class="medal ${won[k] ? 'on' : ''}" style="--c:${MEDALS[k].color}" title="${esc(won[k] ? `Won on ${new Date(won[k]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : `To win: ${MEDALS[k].desc}`)}">${esc(MEDALS[k].name)}</span>`).join('')}</div>
          <div class="small">Win one when you have one that is among the tallest, shortest, heaviest or lightest 5% of its kind, has an S-grade attack, or reaches Lv 70.</div></div>`;
      const total = r.n || Box.data.caught[id] || 0, parts = [['wild', 'caught'], ['egg', 'hatched'], ['bred', 'bred'], ['evolved', 'evolved']].filter(([k]) => r.how[k]);
      const rest = total - parts.reduce((t, [k]) => t + r.how[k], 0); // ones from before the Survidex kept records
      const how = [...parts.map(([k, w]) => `${r.how[k]} ${w}`), ...(rest > 0 ? [`${rest} more`] : [])].join(', ');
      const when = r.first ? new Date(r.first).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      const records = `<div class="dex-sec"><b>Your records</b><div class="dex-rows">
          <span>You have now</span><span>${Box.ownedCount(id)}</span>
          <span>Had in all</span><span>${total}${how ? ` <span class="small">(${how})</span>` : ''}</span>
          ${when ? `<span>First one</span><span>${when}</span>` : ''}
          ${r.maxLv ? `<span>Highest level</span><span>Lv ${r.maxLv}</span>` : ''}</div></div>`;
      const stones = (o) => [...new Set(o.types.map((t) => STONES[STONE_OF[t]].name))].map((n) => `${/^[AEIOU]/.test(n) ? 'an' : 'a'} ${n}`).join(' or ');
      let origin = '';
      if (sp.stage === 1) {
        const home = Object.entries(ZONES).filter(([, z]) => z.mons.includes(id)).map(([, z]) => esc(z.name)).join(' and ');
        origin = `<div class="dex-sec"><b>Where</b><div>Lives mostly in ${home || 'every zone'}, and now and then turns up anywhere.</div>
          ${Object.keys(r.where).length ? `<div class="small">You caught them in: ${zoneList(r.where, true)}</div>` : ''}
          ${Object.keys(r.seenIn).length ? `<div class="small">You've seen them in: ${zoneList(r.seenIn)}</div>` : ''}</div>`;
      } else if (sp.stage === 2) {
        origin = `<div class="dex-sec"><b>Bred from</b><div>${sp.pair.map((b) => esc(SPECIES[b].name)).join(' + ')}</div></div>`;
      } else {
        origin = `<div class="dex-sec"><b>Evolves from</b><div>${esc(SPECIES[sp.from].name)} at Lv ${evoLevel(SPECIES[sp.from])}, with ${stones(SPECIES[sp.from])}</div></div>`;
      }
      // the evolution line: a breed, its first and its final evolution (only the ones you've had are named)
      const node = (nid, label) => {
        const k = Box.known(nid);
        return `<div class="dex-node ${k ? '' : 'unknown'} ${nid === id ? 'here' : ''}" ${k ? `data-mact="dex-open" data-sp="${nid}"` : ''}><img class="px" src="${pic(nid)}" alt=""><b>${k ? esc(SPECIES[nid].name) : '???'}</b><span class="small">${label}</span></div>`;
      };
      let line;
      if (sp.stage === 1) {
        const breeds = [...PURE_IDS, ...MIXED_IDS].filter((b) => SPECIES[b].pair.includes(id));
        const got = breeds.filter((b) => Box.known(b));
        line = `<div class="dex-sec"><b>Breeds into</b><div class="small">Species never evolve. ${got.length} of its ${breeds.length} breeds found.</div>
          <div class="dex-line wrap">${breeds.map((b) => node(b, Box.known(b) ? `with ${esc(SPECIES[SPECIES[b].pair.find((x) => x !== id) || id].name)}` : '')).join('')}</div></div>`;
      } else {
        let root = sp; while (root.from) root = SPECIES[root.from];
        const e1 = root.evo, e2 = SPECIES[e1].evo;
        line = `<div class="dex-sec"><b>Evolution line</b><div class="dex-line">${node(root.id, 'breed')}<span class="dex-arrow">→<small>Lv 30</small></span>${node(e1, 'first evolution')}<span class="dex-arrow">→<small>Lv 55</small></span>${node(e2, 'final evolution')}</div>
          ${sp.evo ? `<div class="small">${Box.known(sp.evo) ? `Evolves into ${esc(SPECIES[sp.evo].name)}` : 'Its next form is still a mystery'} at Lv ${evoLevel(sp)}, with ${stones(sp)}.</div>` : '<div class="small">Its final form.</div>'}</div>`;
      }
      const atk = `<div class="dex-sec"><b>Attack</b><div><b>${esc(sp.unique.name)}</b> ${atkTag(atkType(id))}</div><div class="small">${esc(sp.unique.desc)}</div>
          <div class="small">${esc(ATK_TYPES[atkType(id)]?.name || '')} survivalmons ${STAT_BLURB[atkType(id)] || ''}.</div></div>`;
      body = `${head(true)}${atk}${size}${medals}${records}${origin}${line}`;
    }
    this.openModal(`<div class="modal-box panel mon-sheet dex-sheet">${body}${nav}</div>`);
    this.modalKind = 'dexsheet';
    this.el.modal.classList.add('sheet-modal');
    this.el.select.querySelectorAll('.j-cell.pick').forEach((c) => c.classList.remove('pick'));
    this.el.select.querySelector(`.j-cell[data-sp="${id}"]`)?.classList.add('pick');
  },
  closeDexSheet() {
    if (this.modalKind === 'dexsheet') { this.closeModal(); this.modalKind = null; }
    this.el.modal.classList.remove('sheet-modal');
  },
  stepDex(d) { const i = DEX_IDS.indexOf(this.dexSel); this.showDexSheet(DEX_IDS[(i + d + DEX_IDS.length) % DEX_IDS.length]); },

  // ------------------------------------------------------------ Spirit Shrine
  showShrine() {
    const done = Shrine.settle();
    if (done) this.toast(`Research done: tier odds improved (level ${done})!`);
    const branches = ['Power', 'Guard', 'Wild'].map((b) => `<div class="panel shrine-branch"><div class="team-label">${b}</div>${SHRINE_NODES.filter((n) => n.branch === b).map((n) => {
      const L = Shrine.level(n.id), c = Shrine.cost(n.id);
      return `<div class="train-row"><img class="px" src="${icon(n.icon, 3)}" alt=""><div class="train-info"><b>${n.name}</b> <span class="lvl">Lv ${L}</span>${n.branch === 'Power' ? ` ${atkTag('all')}` : ''}<div class="now">${L ? esc(n.desc(Shrine.value(n.id))) : 'Not started'}</div><div class="next">Next: ${esc(n.desc(Shrine.value(n.id, L + 1)))}</div></div>
        ${c === null ? '<span class="lvl">MAX</span>' : `<button class="btn small buy-btn" data-mact="shrine-buy" data-node="${n.id}" ${c <= Meta.coins ? '' : 'disabled'}><img class="px" src="${icon('coin', 2)}" alt="">${c}</button>`}</div>`;
    }).join('')}</div>`).join('');
    const odds = (o) => o.map((v, i) => `<span><b class="tier t${i}">${TIERS[i]}</b>${v}%</span>`).join('');
    const r = Shrine.data.researching, next = Shrine.nextResearch();
    const research = r ? `<div>Researching level ${r.level}… ready in ${mmss(Math.max(0, (r.done - Date.now()) / 1000))}</div>`
      : next ? `<button class="btn small" data-mact="research" ${Meta.coins >= next.coins ? '' : 'disabled'}>Research level ${next.level}: ${next.coins} coins, ${next.mins} min</button>`
      : '<div class="small">Upgrade the Shrine to research further.</div>';
    this.page('shrine', `
      <h2>Spirit Shrine</h2>
      <div class="box-meta panel"><span><img class="px inline-ic" src="${icon('coin', 2)}" alt=""> ${Meta.coins}</span><span>Upgrades here work for every survivalmon</span></div>
      <div class="shrine-grid">${branches}</div>
      <div class="panel shrine-research"><div class="team-label">Skill tier odds for new catches and eggs</div><div class="odds">${odds(Shrine.odds())}</div>
        ${next || r ? `<div class="odds next">Next: ${odds(RESEARCH_ODDS[(r ? r.level : next.level)])}</div>` : ''}${research}</div>`);
  },

  // ------------------------------------------------------------ buttons
  monsAct(act, el) {
    if (this.shopAct(act, el)) return;
    const id = +el.dataset.id;
    switch (act) {
      case 'hatch-next': this.hatchNext(); break;
      case 'train':
        if (!Box.toggleTraining(id)) this.toast(`All ${Box.trainSpots()} training spots are taken.`);
        this.monsRefresh(); break;
      case 'free': {
        if (el.dataset.sure !== '1') { el.dataset.sure = '1'; el.textContent = 'Tap again to free'; el.classList.add('danger'); break; }
        const got = Box.free(id);
        if (got) this.toast(`Freed! +${Object.entries(got).map(([l, n]) => `${n} ${SPECIES[l].name} coins`).join(', ')}`);
        this.closeMonSheet();
        this.showRanch(); break;
      }
      // Free several
      case 'free-mode': this.freeSel = new Set(); this.freeSure = false; this.closeMonSheet(); this.showRanch(); break;
      case 'free-pick': if (this.freeSel.has(id)) this.freeSel.delete(id); else this.freeSel.add(id); this.freeSure = false; this.showRanch(); break;
      case 'free-locked': this.toast('That one is in your team. Take it out of the team to free it.'); break;
      case 'free-all': for (const m of viewMons('ranch', Box.mons)) if (!Box.inTeam(m.id)) this.freeSel.add(m.id); this.freeSure = false; this.showRanch(); break;
      case 'free-none': this.freeSel.clear(); this.freeSure = false; this.showRanch(); break;
      case 'free-cancel': this.freeSel = null; this.freeSure = false; this.showRanch(); break;
      case 'free-go': {
        if (!this.freeSel?.size) break;
        if (!this.freeSure) { this.freeSure = true; this.showRanch(); break; } // the second tap frees them
        const got = {};
        let n = 0;
        for (const fid of this.freeSel) { const g = Box.free(fid); if (g) { n++; for (const [l, c] of Object.entries(g)) got[l] = (got[l] || 0) + c; } }
        this.freeSel = null; this.freeSure = false;
        Audio.play('coin');
        this.toast(`Freed ${n} survivalmon${n === 1 ? '' : 's'}! +${Object.entries(got).map(([l, c]) => `${c} ${SPECIES[l].name}`).join(', ')} coins`);
        this.showRanch(); break;
      }
      case 'feed': {
        const m = Box.get(id), n = +el.dataset.n;
        if (!m || !n) break;
        const lv = Box.feedCoins(m, n);
        Audio.play(lv.length ? 'levelup' : 'coin');
        if (lv.length) this.toast(`${monName(m)} grew to Lv ${m.level}!`);
        this.monsRefresh(); break;
      }
      case 'mon-open': this.showMonSheet(id); break;
      case 'mon-close': this.closeMonSheet(); break;
      case 'mon-team': {
        const m = Box.get(id);
        if (m && !Box.inTeam(id) && m.hp <= 0) { this.toast('Fainted: heal it at the Clinic first.'); break; }
        if (!Box.toggleTeam(id)) this.toast(`Your team is full (${Box.teamSize()}). Take one out first.`);
        this.monsRefresh(); break;
      }
      case 'mon-rename': this.showMonSheet(id, true); break;
      case 'mon-rename-save': {
        Box.rename(id, this.el.modal.querySelector('.mon-name-input')?.value);
        Audio.play('click');
        this.monsRefresh(); break;
      }
      case 'sp-up': if (Box.buyUpgrade(el.dataset.line)) Audio.play('levelup'); this.showRanch(); break;
      case 'pick-parent': {
        // fills parent A, then B; tapping a chosen one takes it out; with both full it replaces B
        const p = this.breedPick || [null, null];
        const i = p.indexOf(id);
        if (i >= 0) p[i] = null; else p[p[0] == null ? 0 : 1] = id;
        this.breedPick = p;
        Audio.play('click');
        this.showHatchery(); break;
      }
      case 'parent-clear': this.breedPick[+el.dataset.slot] = null; this.showHatchery(); break;
      case 'breed-preview': this.showBreedPreview(); break;
      case 'breed-cancel': this.closeModal(); break;
      case 'breed': {
        if (this.modalKind === 'breedpreview') this.closeModal();
        const [a, b] = this.breedPick;
        const species = Box.breed(a, b, Shrine.odds());
        if (species) { this.breedPick = [null, null]; Audio.play('chest'); this.toast('An egg! It hatches after 3:00 in the wild.'); }
        this.showHatchery(); break;
      }
      case 'heal': { const m = Box.get(id); if (m && Meta.coins >= healCost(m)) { Meta.data.coins -= healCost(m); Meta.save(); Box.heal(m); Audio.play('heal'); } this.showClinic(); break; }
      case 'heal-all': {
        const total = Box.hurtMons().reduce((s, m) => s + healCost(m), 0);
        if (Meta.coins >= total) { Meta.data.coins -= total; Meta.save(); for (const m of Box.hurtMons()) Box.heal(m); Audio.play('heal'); }
        this.showClinic(); break;
      }
      case 'dex': this.showDexSheet(el.dataset.sp); break;
      case 'dex-open': this.showDexSheet(el.dataset.sp); break;
      case 'dex-step': this.stepDex(+el.dataset.d); break;
      case 'dex-close': this.closeDexSheet(); break;
      case 'dex-tab': this.dexTab = el.dataset.t; this.showSurvidex(); break;
      case 'shrine-buy': if (Shrine.buy(el.dataset.node)) Audio.play('levelup'); this.showShrine(); break;
      case 'research': if (Shrine.startResearch()) this.toast('Research started. It keeps going while the game is closed.'); this.showShrine(); break;
    }
  },
};
