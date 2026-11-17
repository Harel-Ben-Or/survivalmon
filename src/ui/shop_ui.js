// Shop-like screens, mixed into UI: the Workshop (hero gear and slot levels), the Merchant (items
// for the next run) and the "upgrade this building" panel shown in every building.
import { iconURL } from '../gfx/assets.js';
import { artURL } from '../gfx/art.js';
import { HEROES } from '../content/heroes.js';
import { WEAPONS } from '../content/weapons.js';
import { BUILDINGS, buildingCost, MERCHANT_ITEMS, MATERIALS } from '../content/buildings.js';
import { SLOTS, SLOT_NAME, SLOT_ICON, SLOT_STAT, SETS, SET_BONUS, MILESTONES, HERO_BOOST } from '../content/gear.js';
import { Meta } from '../systems/meta.js';
import { Audio } from '../core/audio.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const icon = (id, s = 2) => iconURL('icon', id, s);
// "120 coins, 4 wood…" as small icon chips; red where you're short
export const costChips = (c) => {
  if (!c) return '';
  const have = { coins: Meta.coins, ...Meta.data.mats };
  return ['coins', 'wood', 'stone', 'clay', 'iron'].filter((k) => c[k]).map((k) =>
    `<span class="cost ${have[k] < c[k] ? 'short' : ''}"><img class="px" src="${icon(k === 'coins' ? 'coin' : MATERIALS[k].icon)}" alt="">${c[k]}</span>`).join('');
};
const wallet = () => `<span><img class="px inline-ic" src="${icon('coin')}" alt=""> ${Meta.coins}</span>${Object.entries(MATERIALS).map(([k, m]) => `<span><img class="px inline-ic" src="${icon(m.icon)}" alt=""> ${Meta.data.mats[k]}</span>`).join('')}`;
const gearIcon = (hero, slot) => SLOT_ICON[slot] || WEAPONS[slot === 'main' ? SETS[hero].mainW : SETS[hero].offW].icon;
// screen -> the building it belongs to, and how to redraw it
const PAGE_BUILDING = { ranch: 'ranch', hatchery: 'hatchery', clinic: 'clinic', shrine: 'shrine', workshop: 'workshop', merchant: 'merchant', team: 'gate' };
const REDRAW = { ranch: 'showRanch', hatchery: 'showHatchery', clinic: 'showClinic', shrine: 'showShrine', survidex: 'showSurvidex', workshop: 'showWorkshop', merchant: 'showMerchant', team: 'renderTeam' };

export const ShopUI = {
  // ------------------------------------------------------------ building levels
  buildingPanel(id) {
    const b = BUILDINGS[id], L = Meta.buildingLevel(id), c = buildingCost(id, L);
    return `<div class="panel bld"><div><b>${b.name} · Lv ${L}</b> <span class="small">${esc(b.levelText(L))}</span></div>
      ${c ? `<div class="bld-next"><span class="small">Lv ${L + 1}: ${esc(b.levelText(L + 1))}</span><span class="costs">${costChips(c)}</span>
        <button class="btn small" data-mact="bld-up" data-b="${id}" ${Meta.canAfford(c) ? '' : 'disabled'}>Upgrade</button></div>` : '<span class="lvl">Max level</span>'}</div>`;
  },
  pageBuilding(screen) { const id = PAGE_BUILDING[screen]; return id ? this.buildingPanel(id) : ''; },
  rerender() {
    if (this.modalKind === 'training') { this.renderTraining(); return; }
    const f = REDRAW[this.screen];
    if (f) this[f]();
  },

  // ------------------------------------------------------------ Workshop
  showWorkshop(hero = this.wsHero || Meta.hero) {
    this.wsHero = hero;
    const set = SETS[hero], n = Meta.gearCount(hero), minL = n === SLOTS.length ? Meta.minSlotLevel(hero) : 0;
    const tabs = HEROES.map((h) => `<button class="hero-chip ${h.id === hero ? 'sel' : ''} ${Meta.isHeroUnlocked(h.id) ? '' : 'locked'}" data-mact="ws-hero" data-h="${h.id}">
      <img class="px" src="${artURL('hero', h.id) || iconURL('hero', h.id, 2)}" alt=""><span>${Meta.heroName(h.id)} ${Meta.gearCount(h.id)}/6</span></button>`).join('');
    const rows = SLOTS.map((s) => {
      const own = Meta.hasGear(hero, s), L = Meta.slotLevel(hero, s), c = Meta.slotUpCost(hero, s);
      return `<div class="train-row ${own ? '' : 'missing'}"><img class="px" src="${icon(gearIcon(hero, s), 3)}" style="filter:hue-rotate(${set.hue}deg)${own ? '' : ' grayscale(1) opacity(.4)'}" alt="">
        <div class="train-info"><b>${own ? esc(set[s]) : 'Not found yet'}</b> <span class="lvl">${SLOT_NAME[s]} · Lv ${L}</span>
          <div class="now">${own ? esc(SLOT_STAT[s].text(L)) : 'Drops from bosses, elites, chests and wild survivalmons'}</div>${own && c ? `<div class="next">Next: ${esc(SLOT_STAT[s].text(L + 1))}</div>` : ''}</div>
        ${own && c ? `<div class="slot-buy"><span class="costs">${costChips(c)}</span><button class="btn small" data-mact="slot-up" data-s="${s}" ${Meta.canAfford(c) ? '' : 'disabled'}>Level up</button></div>` : own ? '<span class="lvl">MAX</span>' : ''}</div>`;
    }).join('');
    const bonuses = [
      ...SET_BONUS.map((b) => `<div class="${n >= b.pieces ? 'on' : 'off'}">${n >= b.pieces ? '★' : '☆'} ${b.pieces} pieces: ${esc(b.text)}</div>`),
      ...MILESTONES.map((m) => `<div class="${minL >= m.level ? 'on' : 'off'}">${minL >= m.level ? '★' : '☆'} All 6 slots at Lv ${m.level}: ${esc(m.text)}</div>`),
    ].join('');
    this.page('workshop', `
      <h2>Workshop</h2>
      <div class="box-meta panel">${wallet()}</div>
      <div class="hero-pick ws-tabs">${tabs}</div>
      <div class="panel ws-set"><div><b>${esc(set.name)}</b> · ${n}/6 pieces · ${esc(HERO_BOOST[hero].text)}${Meta.isHeroUnlocked(hero) ? '' : ' · <i>hero not unlocked yet</i>'}</div><div class="combo-list">${bonuses}</div></div>
      <div class="panel ws-slots">${rows}</div>`);
  },

  // ------------------------------------------------------------ Merchant
  showMerchant() {
    const stock = MERCHANT_ITEMS.slice(0, Meta.buildingBonus('merchant', 'stock'));
    const owned = new Set(Meta.data.buffs);
    const rows = stock.map((it) => `<div class="train-row"><img class="px" src="${icon(it.icon, 3)}" alt="">
      <div class="train-info"><b>${esc(it.name)}</b><div class="now">${esc(it.text)}</div></div>
      ${owned.has(it.id) ? '<span class="lvl">Ready</span>' : `<button class="btn small buy-btn" data-mact="buy-item" data-item="${it.id}" ${Meta.coins >= it.price ? '' : 'disabled'}><img class="px" src="${icon('coin')}" alt="">${it.price}</button>`}</div>`).join('');
    this.page('merchant', `
      <h2>Merchant</h2>
      <div class="box-meta panel">${wallet()}<span>Everything here lasts for your next run</span></div>
      <div class="panel ws-slots">${rows}</div>`);
  },

  shopAct(act, el) {
    switch (act) {
      case 'bld-up': if (Meta.upgradeBuilding(el.dataset.b)) { Audio.play('levelup'); this.toast(`${BUILDINGS[el.dataset.b].name} upgraded!`); } this.rerender(); return true;
      case 'ws-hero': this.showWorkshop(el.dataset.h); return true;
      case 'slot-up': if (Meta.slotUp(this.wsHero, el.dataset.s)) Audio.play('levelup'); this.showWorkshop(); return true;
      case 'buy-item': {
        const it = MERCHANT_ITEMS.find((x) => x.id === el.dataset.item);
        if (it && Meta.coins >= it.price && !Meta.data.buffs.includes(it.id)) { Meta.data.coins -= it.price; Meta.data.buffs.push(it.id); Meta.save(); Audio.play('coin'); }
        this.showMerchant(); return true;
      }
    }
    return false;
  },
};
