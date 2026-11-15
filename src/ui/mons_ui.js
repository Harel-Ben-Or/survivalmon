// Survivalmon screens, mixed into UI: starter eggs, hatching, the Ranch, the Hatchery (eggs and
// breeding), the Clinic, the Survidex and the Spirit Shrine.
import { iconURL } from '../gfx/assets.js';
import { artURL } from '../gfx/art.js';
import { SPECIES, TYPES, STONES, STARTERS, DEX_IDS, BASE_IDS, PURE_IDS, MIXED_IDS, EVOLVED_IDS, BREED_LEVEL, petXpFor, breedResult } from '../content/species.js';
import { TIERS, PASSIVES } from '../content/skills.js';
import { Box, STARTER_HATCH, EGG_SLOTS } from '../systems/collection.js';
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
export const skillChips = (mon) => mon.skills.map((k) => `<span class="sk" title="${esc(skillDesc(k))}"><b class="tier t${k.t}">${TIERS[k.t]}</b>${esc(skillName(k))}</span>`).join('');
const hpBar = (mon) => `<div class="hp-bar ${mon.hp <= 0 ? 'out' : mon.hp < 0.3 ? 'low' : ''}"><div style="width:${Math.round(mon.hp * 100)}%"></div></div>`;
const healCost = (mon) => Math.ceil((1 - mon.hp) * (6 + mon.level * 2) * (1 - Meta.buildingBonus('clinic', 'discount')));

export const MonsUI = {
  // A full-screen page over the town (the town stops while it's open).
  page(screen, html) {
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
  chooseStarter(id) {
    Box.addEgg({ species: id, skills: [{ k: 'u', sp: id, t: 0 }, { k: 'p', id: Object.keys(PASSIVES)[Math.floor(Math.random() * 9)], t: 0 }], need: STARTER_HATCH, kind: 'starter' });
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
  showRanch() {
    const trained = Box.settleTraining();
    for (const t of trained) if (t.levels.length) this.toast(`${SPECIES[t.mon.species].name} trained up to Lv ${t.mon.level}!`);
    const card = (m) => {
      const sp = SPECIES[m.species], need = petXpFor(m.level), evo = Box.evoInfo(m);
      const value = Object.entries(Box.freeValue(m)).map(([l, n]) => `${n} ${SPECIES[l].name}`).join(' + ');
      const evoLine = !evo ? '' : Box.canEvolve(m) ? `<button class="btn small" data-evolve="${m.id}">Evolve</button>`
        : `<div class="evo-need">Evolves at Lv ${evo.level} with ${evo.items.map((s) => STONES[s].name).join(' or ')}</div>`;
      return `<div class="mon-card panel ${Box.inTeam(m.id) ? 'in-team' : ''}">
        <div class="mon-head"><img class="px" src="${pic(m.species)}" alt=""><div><div class="name">${esc(sp.name)} <b class="lv">Lv ${m.level}</b></div>${types(sp)}${Box.inTeam(m.id) ? ' <span class="badge">Team</span>' : ''}${Box.isTraining(m.id) ? ' <span class="badge">Training</span>' : ''}</div></div>
        <div class="bar-row"><span>HP</span>${hpBar(m)}</div>
        <div class="bar-row"><span>EXP</span><div class="xp"><div style="width:${Math.min(100, (m.xp / need) * 100).toFixed(0)}%"></div></div></div>
        <div class="sk-row">${skillChips(m)}</div>
        ${evoLine}
        <div class="mon-actions">
          <button class="btn small secondary" data-mact="train" data-id="${m.id}">${Box.isTraining(m.id) ? 'Stop training' : 'Train'}</button>
          <button class="btn small secondary free-btn" data-mact="free" data-id="${m.id}" title="Free it for ${esc(value)} coins">Free</button>
        </div>
      </div>`;
    };
    const ups = BASE_IDS.map((l) => {
      const c = Box.upCost(l), have = Box.speciesCoins(l);
      return `<div class="sp-up"><img class="px" src="${pic(l)}" alt=""><div><b>${SPECIES[l].name}</b> <span class="lvl">Lv ${Box.upLevel(l)}</span><div class="small">${have} coins · +${Box.upLevel(l) * 8}% damage and HP</div></div>
        ${c === null ? '<span class="lvl">MAX</span>' : `<button class="btn small" data-mact="sp-up" data-line="${l}" ${have >= c ? '' : 'disabled'}>${c}</button>`}</div>`;
    }).join('');
    this.page('ranch', `
      <h2>Ranch</h2>
      <div class="box-meta panel">
        <span>${Box.mons.length} survivalmons</span>
        <span>Training ${Box.data.training.length}/${Box.trainSpots()} spots · they gain EXP even while you're away</span>
      </div>
      <div class="panel sp-ups"><div class="team-label">Species upgrades · free a survivalmon for its species coins, then make every one of that species (and its breeds) stronger</div><div class="sp-grid">${ups}</div></div>
      ${Box.isEmpty ? '<p class="sub-note">No survivalmons yet. Your first egg is warming in the Hatchery.</p>' : `<div class="mon-grid">${Box.mons.map(card).join('')}</div>`}`);
  },

  // ------------------------------------------------------------ Hatchery
  showHatchery() {
    const pick = this.breedPick = (this.breedPick || []).filter((id) => Box.get(id)?.level >= BREED_LEVEL);
    const nests = Array.from({ length: EGG_SLOTS }, (_, i) => {
      const e = Box.eggs[i];
      if (!e) return '<div class="nest panel"><img class="px" src="' + eggURL(null, 2) + '" style="opacity:.25" alt=""><span>Empty nest</span></div>';
      const known = Box.known(e.species) || e.kind !== 'bred';
      const close = e.progress >= e.need * 0.75; // wobbles when it is nearly ready to hatch
      return `<div class="nest panel"><img class="px ${close ? 'egg-ready' : ''}" src="${eggURL(e.species, 2)}" alt=""><b>${known ? `${SPECIES[e.species].name} egg` : 'Mystery egg'}</b>
        <div class="hp-bar warm"><div style="width:${Math.round((e.progress / e.need) * 100)}%"></div></div><span>${mmss(e.progress)} / ${mmss(e.need / 1)} in the wild</span></div>`;
    }).join('');
    const ready = Box.mons.filter((m) => m.level >= BREED_LEVEL);
    const result = pick.length === 2 ? breedResult(Box.get(pick[0]).species, Box.get(pick[1]).species) : null;
    const choose = ready.map((m) => `<div class="pool-mon ${pick.includes(m.id) ? 'sel' : ''}" data-mact="pick-parent" data-id="${m.id}"><img class="px" src="${pic(m.species)}" alt=""><b>${esc(SPECIES[m.species].name)}</b><span>Lv ${m.level}</span></div>`).join('');
    this.page('hatchery', `
      <h2>Hatchery</h2>
      <div class="nests">${nests}</div>
      <div class="panel breed-box">
        <div class="team-label">Breed two survivalmons (Lv ${BREED_LEVEL}+). Both parents are used up; the egg gets one skill from each and a new skill of its own.</div>
        ${ready.length < 2 ? `<p class="sub-note">You need two survivalmons at Lv ${BREED_LEVEL} or higher.</p>` : `<div class="mon-pool breed-pool">${choose}</div>`}
        <div class="breed-row">
          <span>${pick.length === 2 ? `${esc(SPECIES[Box.get(pick[0]).species].name)} + ${esc(SPECIES[Box.get(pick[1]).species].name)} → <b>${result ? (Box.known(result) ? SPECIES[result].name : 'a mystery breed') : '?'}</b>` : `Pick two parents (${pick.length}/2)`}</span>
          <button class="btn" data-mact="breed" ${result && Box.eggs.length < EGG_SLOTS ? '' : 'disabled'}>Breed</button>
        </div>
        ${Box.eggs.length >= EGG_SLOTS ? '<p class="sub-note">All nests are full. Run in the wild to hatch them.</p>' : ''}
      </div>`);
  },

  // ------------------------------------------------------------ Clinic
  showClinic() {
    const hurt = Box.hurtMons();
    const total = hurt.reduce((s, m) => s + healCost(m), 0);
    const rows = hurt.map((m) => `<div class="clinic-row panel"><img class="px" src="${pic(m.species)}" alt=""><div><b>${esc(SPECIES[m.species].name)}</b> Lv ${m.level}${m.hp <= 0 ? ' · <span class="out-txt">Fainted</span>' : ''}${hpBar(m)}</div>
      <button class="btn small" data-mact="heal" data-id="${m.id}" ${Meta.coins >= healCost(m) ? '' : 'disabled'}><img class="px" src="${icon('coin', 2)}" alt="">${healCost(m)}</button></div>`).join('');
    this.page('clinic', `
      <h2>Clinic</h2>
      <div class="box-meta panel"><span><img class="px inline-ic" src="${icon('coin', 2)}" alt=""> ${Meta.coins}</span><span>Survivalmons that stay home heal ${Math.round((0.5 + Meta.buildingBonus('clinic', 'rest') + Shrine.bonus('rest')) * 100)}% each run for free</span></div>
      ${hurt.length ? `<div class="clinic-list">${rows}</div><button class="btn" data-mact="heal-all" ${Meta.coins >= total ? '' : 'disabled'}>Heal everyone (${total} coins)</button>` : '<p class="sub-note">Everyone is healthy.</p>'}`);
  },

  // ------------------------------------------------------------ Survidex
  showSurvidex(sel) {
    const cell = (id) => {
      const known = Box.known(id), seen = Box.data.seen[id];
      return `<span class="j-cell ${known ? 'caught' : seen ? 'seen' : ''} ${id === sel ? 'pick' : ''}" data-mact="dex" data-sp="${id}" title="${known || seen ? esc(SPECIES[id].name) : '???'}"><img class="px" src="${pic(id)}" alt=""></span>`;
    };
    const group = (title, ids) => `<div class="j-title">${title}</div><div class="j-row">${ids.map(cell).join('')}</div>`;
    const sp = sel && SPECIES[sel], known = sel && Box.known(sel);
    const recipe = sp && sp.pair ? `${SPECIES[sp.pair[0]].name} + ${SPECIES[sp.pair[1]].name}` : '';
    const detail = !sp ? '<p class="sub-note">Tap an entry.</p>' : !known && !Box.data.seen[sel] ? '<p class="sub-note">Not found yet.</p>' : `
      <div class="mon-head"><img class="px" src="${pic(sel)}" alt=""><div><div class="name">${esc(sp.name)}</div>${types(sp)}</div></div>
      <div class="small">${esc(sp.desc)}</div>
      <div class="small"><b>${esc(sp.unique.name)}</b> · ${esc(sp.unique.desc)}</div>
      ${sp.stage === 2 ? `<div class="small">Bred from ${known ? esc(recipe) : '???'}</div>` : ''}
      ${sp.stage === 3 ? `<div class="small">Evolves from ${esc(SPECIES[sp.from].name)}</div>` : ''}
      <div class="small">You own ${Box.ownedCount(sel)}</div>`;
    const found = DEX_IDS.filter((id) => Box.known(id)).length;
    this.page('survidex', `
      <h2>Survidex</h2>
      <div class="box-meta panel"><span>${found} / ${DEX_IDS.length} found</span></div>
      <div class="dex-body">
        <div class="journal panel">${group('Species', BASE_IDS)}${group('Same-species breeds', PURE_IDS)}${group('Mixed breeds', MIXED_IDS)}${group('Evolved breeds', EVOLVED_IDS)}</div>
        <div class="panel dex-detail">${detail}</div>
      </div>`);
  },

  // ------------------------------------------------------------ Spirit Shrine
  showShrine() {
    const done = Shrine.settle();
    if (done) this.toast(`Research done: tier odds improved (level ${done})!`);
    const branches = ['Power', 'Guard', 'Wild'].map((b) => `<div class="panel shrine-branch"><div class="team-label">${b}</div>${SHRINE_NODES.filter((n) => n.branch === b).map((n) => {
      const L = Shrine.level(n.id), c = Shrine.cost(n.id);
      return `<div class="train-row"><img class="px" src="${icon(n.icon, 3)}" alt=""><div class="train-info"><b>${n.name}</b> <span class="lvl">Lv ${L}</span><div class="now">${L ? esc(n.desc(Shrine.value(n.id))) : 'Not started'}</div><div class="next">Next: ${esc(n.desc(Shrine.value(n.id, L + 1)))}</div></div>
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
        this.showRanch(); break;
      case 'free': {
        if (el.dataset.sure !== '1') { el.dataset.sure = '1'; el.textContent = 'Tap again to free'; el.classList.add('danger'); break; }
        const got = Box.free(id);
        if (got) this.toast(`Freed! +${Object.entries(got).map(([l, n]) => `${n} ${SPECIES[l].name} coins`).join(', ')}`);
        this.showRanch(); break;
      }
      case 'sp-up': if (Box.buyUpgrade(el.dataset.line)) Audio.play('levelup'); this.showRanch(); break;
      case 'pick-parent': {
        const p = this.breedPick;
        const i = p.indexOf(id);
        if (i >= 0) p.splice(i, 1); else { if (p.length >= 2) p.shift(); p.push(id); }
        this.showHatchery(); break;
      }
      case 'breed': {
        const [a, b] = this.breedPick;
        const species = Box.breed(a, b, Shrine.odds());
        if (species) { this.breedPick = []; Audio.play('chest'); this.toast('An egg! It hatches after 3:00 in the wild.'); }
        this.showHatchery(); break;
      }
      case 'heal': { const m = Box.get(id); if (m && Meta.coins >= healCost(m)) { Meta.data.coins -= healCost(m); Meta.save(); Box.heal(m); Audio.play('heal'); } this.showClinic(); break; }
      case 'heal-all': {
        const total = Box.hurtMons().reduce((s, m) => s + healCost(m), 0);
        if (Meta.coins >= total) { Meta.data.coins -= total; Meta.save(); for (const m of Box.hurtMons()) Box.heal(m); Audio.play('heal'); }
        this.showClinic(); break;
      }
      case 'dex': this.showSurvidex(el.dataset.sp); break;
      case 'shrine-buy': if (Shrine.buy(el.dataset.node)) Audio.play('levelup'); this.showShrine(); break;
      case 'research': if (Shrine.startResearch()) this.toast('Research started. It keeps going while the game is closed.'); this.showShrine(); break;
    }
  },
};
