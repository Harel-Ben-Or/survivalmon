// Shop-like screens, mixed into UI: the Workshop (hero gear sets, slot levels and gathering tools),
// the Merchant (goods for your bag, and the Skyfall counter for Skyfall Shards) and the "upgrade this
// building" panel shown in every building (upgrades take time; shards finish them at once).
import { iconURL } from '../gfx/assets.js';
import { artURL } from '../gfx/art.js';
import { eggURL } from '../gfx/eggs.js';
import { HEROES } from '../content/heroes.js';
import { WEAPONS } from '../content/weapons.js';
import { SPECIES, BASE_IDS } from '../content/species.js';
import { BUILDINGS, buildingCost, buildMins, fmtMins, MATERIALS } from '../content/buildings.js';
import { SLOTS, SLOT_NAME, SLOT_ICON, SLOT_STAT, SETS, MILESTONES, HERO_BOOST, HERO_SETS, GEAR_SETS, SET_PIECES, pieceName, TOOLS } from '../content/gear.js';
import { ITEMS, GRADES, itemPrice, itemName, itemText, itemKey, EXCHANGE, EGG_OFFERS, eggOfferSpecies, dayKey, STACK_MAX } from '../content/shop.js';
import { Meta, MAT_KEYS } from '../systems/meta.js';
import { Box, rollSkills, FOUND_HATCH, EGG_SLOTS } from '../systems/collection.js';
import { Shrine } from '../systems/shrine.js';
import { Audio } from '../core/audio.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const icon = (id, s = 2) => iconURL('icon', id, s);
const shardIc = (s = 2) => `<img class="px inline-ic" src="${icon('shard', s)}" alt="Skyfall Shards">`;
// "1:05:12" / "4:30" (the page's ticker keeps counting it down: see UI.tick)
const left = (ms) => { const sec = Math.max(0, ms / 1000), h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), x = Math.floor(sec % 60); return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };
// "120 coins, 4 wood…" as small icon chips; red where you're short
export const costChips = (c) => {
  if (!c) return '';
  const have = { coins: Meta.coins, shards: Meta.shards, ...Meta.data.mats };
  return ['coins', 'shards', ...MAT_KEYS].filter((k) => c[k]).map((k) =>
    `<span class="cost ${have[k] < c[k] ? 'short' : ''}"><img class="px" src="${icon(k === 'coins' ? 'coin' : k === 'shards' ? 'shard' : MATERIALS[k].icon)}" alt="">${c[k].toLocaleString()}</span>`).join('');
};
const wallet = () => `<span class="pg-chip"><img class="px inline-ic" src="${icon('coin')}" alt="Coins"> ${Meta.coins.toLocaleString()}</span><span class="pg-chip">${shardIc()} ${Meta.shards}</span>${Object.entries(MATERIALS).map(([k, m]) => `<span class="pg-chip mat-chip"><img class="px inline-ic" src="${icon(m.icon)}" alt="${m.name}"> ${Meta.data.mats[k]}</span>`).join('')}`;
const gearIcon = (hero, slot) => SLOT_ICON[slot] || WEAPONS[slot === 'main' ? SETS[hero].mainW : SETS[hero].offW].icon;
// screen -> the building it belongs to, and how to redraw it
const PAGE_BUILDING = { ranch: 'ranch', hatchery: 'hatchery', clinic: 'clinic', shrine: 'shrine', workshop: 'workshop', merchant: 'merchant', team: 'gate' };
const REDRAW = { ranch: 'showRanch', hatchery: 'showHatchery', clinic: 'showClinic', shrine: 'showShrine', survidex: 'showSurvidex', workshop: 'showWorkshop', merchant: 'showMerchant', team: 'renderTeam' };
const tabBtn = (act, cur, t, label) => `<button class="pg-tool ${cur === t ? 'on' : ''}" data-mact="${act}" data-t="${t}">${label}</button>`;

export const ShopUI = {
  // ------------------------------------------------------------ building levels
  // The building's level and what it does; then the next level (what it adds, its cost and how long it
  // takes to build), or the build going on (time left, and "Finish now" for Skyfall Shards).
  buildingPanel(id) {
    const b = BUILDINGS[id], L = Meta.buildingLevel(id), c = buildingCost(id, L), job = Meta.building(id);
    let next = '<span class="lvl">Max level</span>';
    if (job) {
      const rush = Meta.rushCost(id);
      next = `<div class="bld-next building"><span class="small"><img class="px inline-ic" src="${icon('hammer')}" alt=""> Building Lv ${job.to}: ${esc(b.levelText(job.to))} · <b data-until="${job.done}">${left(job.done - Date.now())}</b> left</span>
        <button class="btn small rush-btn" data-mact="bld-rush" data-b="${id}" ${Meta.shards >= rush ? '' : 'disabled'}>Finish now ${shardIc()}${rush}</button></div>`;
    } else if (c) {
      next = `<div class="bld-next"><span class="small">Lv ${L + 1}: ${esc(b.levelText(L + 1))} · builds in ${fmtMins(buildMins(L))}</span><span class="costs">${costChips(c)}</span>
        <button class="btn small" data-mact="bld-up" data-b="${id}" ${Meta.canAfford(c) ? '' : 'disabled'}>Upgrade</button></div>`;
    }
    return `<div class="panel bld"><div><b>${b.name} · Lv ${L}</b> <span class="small">${esc(b.levelText(L))}</span></div>${next}</div>`;
  },
  pageBuilding(screen) { const id = PAGE_BUILDING[screen]; return id ? this.buildingPanel(id) : ''; },
  rerender() {
    if (this.screen === 'training') { this.renderTraining(); return; }
    const f = REDRAW[this.screen];
    if (f) this[f]();
  },

  // ------------------------------------------------------------ Workshop
  // Gear: the hero's 4 sets (pieces worn and their bonuses), then a row per slot with its level and the
  // pieces found for it (tap one to wear it). Tools: upgrades for gathering in runs.
  showWorkshop(hero = this.wsHero || Meta.hero) {
    this.wsHero = hero;
    const tab = this.wsTab || 'gear';
    const tabs = tabBtn('ws-tab', tab, 'gear', 'Gear') + tabBtn('ws-tab', tab, 'tools', 'Tools');
    const body = tab === 'tools' ? this.toolsHTML() : this.gearHTML(hero);
    this.page('workshop', body, { title: 'Workshop', tools: tabs, chips: wallet() });
  },
  gearHTML(hero) {
    const n = Meta.gearCount(hero), minL = n === SLOTS.length ? Meta.minSlotLevel(hero) : 0, sets = HERO_SETS[hero];
    const heroTabs = HEROES.map((h) => `<button class="hero-chip ${h.id === hero ? 'sel' : ''} ${Meta.isHeroUnlocked(h.id) ? '' : 'locked'}" data-mact="ws-hero" data-h="${h.id}">
      <img class="px" src="${artURL('hero', h.id) || iconURL('hero', h.id, 2)}" alt=""><span>${esc(Meta.heroName(h.id))} ${Meta.piecesOwned(h.id)}/${SLOTS.length * HERO_SETS[h.id].length}</span></button>`).join('');
    const setCards = sets.map((id) => {
      const S = GEAR_SETS[id], worn = Meta.setWorn(hero, id), found = SLOTS.filter((s) => Meta.ownsPiece(hero, s, id)).length;
      return `<div class="ws-setcard ${worn >= SET_PIECES[0] ? 'on' : ''}" style="--sc:${S.color}"><div class="wsc-head"><b>${esc(S.name)}</b><span class="small">worn ${worn}/6 · found ${found}/6</span></div>
        ${S.bonus.map((b, i) => `<div class="wsc-b ${worn >= SET_PIECES[i] ? 'on' : 'off'}">${worn >= SET_PIECES[i] ? '★' : '☆'} ${SET_PIECES[i]}: ${esc(b.text)}</div>`).join('')}</div>`;
    }).join('');
    const rows = SLOTS.map((s) => {
      const own = Meta.hasGear(hero, s), on = Meta.worn(hero, s), L = Meta.slotLevel(hero, s), c = Meta.slotUpCost(hero, s);
      const hue = on ? GEAR_SETS[on].hue : 0;
      const pieces = sets.filter((id) => Meta.ownsPiece(hero, s, id)).map((id) => `<button class="piece ${id === on ? 'on' : ''}" style="--sc:${GEAR_SETS[id].color}" data-mact="wear" data-s="${s}" data-set="${id}" title="${esc(GEAR_SETS[id].name)}">${id === on ? '✓ ' : ''}${esc(pieceName(hero, id, s))}</button>`).join('');
      return `<div class="train-row ws-row ${own ? '' : 'missing'}"><img class="px" src="${icon(gearIcon(hero, s), 3)}" style="filter:hue-rotate(${hue}deg)${own ? '' : ' grayscale(1) opacity(.4)'}" alt="">
        <div class="train-info"><b>${own ? esc(pieceName(hero, on, s)) : 'Not found yet'}</b> <span class="lvl">${SLOT_NAME[s]} · Lv ${L}</span>
          <div class="now">${own ? esc(SLOT_STAT[s].text(L)) : 'Drops from bosses, elites, chests and wild survivalmons'}</div>${own && c ? `<div class="next">Next: ${esc(SLOT_STAT[s].text(L + 1))}</div>` : ''}
          ${pieces ? `<div class="pieces">${pieces}</div>` : ''}</div>
        ${own && c ? `<div class="slot-buy"><span class="costs">${costChips(c)}</span><button class="btn small" data-mact="slot-up" data-s="${s}" ${Meta.canAfford(c) ? '' : 'disabled'}>Level up</button></div>` : own ? '<span class="lvl">MAX</span>' : ''}</div>`;
    }).join('');
    const miles = MILESTONES.map((m) => `<div class="${minL >= m.level ? 'on' : 'off'}">${minL >= m.level ? '★' : '☆'} All 6 slots at Lv ${m.level}: ${esc(m.text)}</div>`).join('');
    return `<div class="hero-pick ws-tabs">${heroTabs}</div>
      <p class="pg-note">${esc(Meta.heroName(hero))}: ${esc(HERO_BOOST[hero].text)}${Meta.isHeroUnlocked(hero) ? '' : ' · <i>hero not unlocked yet</i>'}. A slot's level stays when you swap pieces.</p>
      <div class="ws-sets">${setCards}</div>
      <div class="panel ws-slots">${rows}</div>
      <div class="panel ws-set"><div class="combo-list">${miles}</div></div>`;
  },
  toolsHTML() {
    const rows = TOOLS.map((t) => {
      const L = Meta.toolLevel(t.id), cap = Meta.toolCap(t), c = Meta.toolUpCost(t.id);
      return `<div class="train-row"><img class="px" src="${icon(t.icon, 3)}" alt="">
        <div class="train-info"><b>${esc(t.name)}</b> <span class="lvl">Lv ${L}/${t.max}</span><div class="now">${esc(t.text(L))}</div>${c ? `<div class="next">Next: ${esc(t.text(L + 1))}</div>` : L < t.max ? `<div class="next">Upgrade the Workshop to go past Lv ${cap}</div>` : ''}</div>
        ${c ? `<div class="slot-buy"><span class="costs">${costChips(c)}</span><button class="btn small" data-mact="tool-up" data-t="${t.id}" ${Meta.canAfford(c) ? '' : 'disabled'}>Upgrade</button></div>` : `<span class="lvl">${L >= t.max ? 'MAX' : `Lv ${cap} cap`}</span>`}</div>`;
    }).join('');
    return `<p class="pg-note">Better tools bring home more from the gathering spots in your runs (trees, rocks, clay and ore).</p><div class="panel ws-slots tools-list">${rows}</div>`;
  },

  // ------------------------------------------------------------ Merchant
  // Goods (for coins, some also materials) go into your bag for runs; the Skyfall counter sells eggs
  // and materials for Skyfall Shards.
  showMerchant() {
    const tab = this.shopTab || 'goods';
    const tabs = tabBtn('shop-tab', tab, 'goods', 'Goods') + tabBtn('shop-tab', tab, 'skyfall', `${shardIc()} Skyfall`);
    this.page('merchant', tab === 'skyfall' ? this.skyfallHTML() : this.goodsHTML(), { title: 'Merchant', tools: tabs, chips: wallet() });
  },
  goodsHTML() {
    const g = Meta.buildingLevel('merchant'), stock = ITEMS.slice(0, Meta.buildingBonus('merchant', 'stock'));
    const inBag = (id) => Meta.bagList().filter((x) => x.id === id).reduce((s, x) => s + x.n, 0);
    const rows = stock.map((it) => {
      const c = itemPrice(it.id, g), full = Meta.itemCount(itemKey(it.id, g)) >= STACK_MAX, n = inBag(it.id);
      return `<div class="train-row"><img class="px" src="${icon(it.icon, 3)}" alt="">
        <div class="train-info"><b>${esc(itemName(it.id, g))}</b>${n ? ` <span class="lvl">${n} in bag</span>` : ''}<div class="now">${esc(itemText(it.id, g))}</div></div>
        <div class="slot-buy"><span class="costs">${costChips(c)}</span><button class="btn small buy-btn" data-mact="buy-item" data-item="${it.id}" ${!full && Meta.canAfford(c) ? '' : 'disabled'}>${full ? 'Bag full' : 'Buy'}</button></div></div>`;
    }).join('');
    const bag = Meta.bagList();
    return `<p class="pg-note">Grade ${GRADES[g - 1]} goods: a higher Merchant level sells stronger ones (for much more). They wait in your bag: open it in a run with B or the bag button under the map.</p>
      <div class="panel ws-slots">${rows}</div>
      ${bag.length ? `<div class="panel bag-panel"><span class="team-label"><img class="px inline-ic" src="${icon('bag')}" alt=""> Your bag</span><div class="bag-chips">${bag.map((x) => `<span class="pg-chip" title="${esc(itemText(x.id, x.g))}"><img class="px inline-ic" src="${icon(x.item.icon)}" alt="">${esc(itemName(x.id, x.g))} ×${x.n}</span>`).join('')}</div></div>` : ''}`;
  },
  skyfallHTML() {
    const today = eggOfferSpecies(), full = Box.eggs.length >= EGG_SLOTS, bought = this.boughtToday();
    const eggs = EGG_OFFERS.map((o) => {
      const sp = today[o.id], soldOut = o.daily && (bought[o.id] || 0) >= o.daily;
      const name = sp ? `${o.name === 'Egg' ? `${SPECIES[sp].name} Egg` : `${o.name}: ${SPECIES[sp].name}`}` : o.name;
      const pic = o.icon && !sp ? icon(o.icon, 3) : sp ? eggURL(sp, 3) : icon('egg', 3);
      return `<div class="sky-egg ${o.star ? 'star' : ''}"><div class="sky-pic"><img class="px" src="${pic}" alt="">${o.star ? `<img class="px sky-star" src="${icon('egg_star', 2)}" alt="">` : ''}</div>
        <b>${esc(name)}</b><span class="small">${esc(o.text)}</span>
        <button class="btn small" data-mact="buy-egg" data-o="${o.id}" ${!full && !soldOut && Meta.shards >= o.shards ? '' : 'disabled'}>${soldOut ? 'Sold out today' : full ? 'Nests full' : `${shardIc()}${o.shards.toLocaleString()}`}</button></div>`;
    }).join('');
    const swaps = EXCHANGE.map((x) => `<button class="btn small secondary sky-swap" data-mact="swap" data-m="${x.mat}" ${Meta.shards >= x.shards ? '' : 'disabled'}>${shardIc()}${x.shards} → <img class="px inline-ic" src="${icon(MATERIALS[x.mat].icon)}" alt="">${x.n} ${MATERIALS[x.mat].name}</button>`).join('');
    return `<p class="pg-note">Skyfall Shards come from achievements and, from the Lv 2 gates on, very rarely from the wild (bosses always drop some). They also finish building upgrades and Shrine research at once.</p>
      <div class="team-label">Eggs today <span class="small">(new offers at midnight · nests ${Box.eggs.length}/${EGG_SLOTS})</span></div>
      <div class="sky-eggs">${eggs}</div>
      <div class="team-label">Swap for materials</div>
      <div class="sky-swaps">${swaps}</div>`;
  },
  boughtToday() {
    const b = Meta.data.bought || (Meta.data.bought = { day: '', n: {} });
    if (b.day !== dayKey()) { b.day = dayKey(); b.n = {}; }
    return b.n;
  },
  // Buys a Skyfall egg: it goes to a free nest and hatches like an egg found in the wild
  buyEgg(id) {
    const o = EGG_OFFERS.find((x) => x.id === id), bought = this.boughtToday();
    if (!o || Box.eggs.length >= EGG_SLOTS || (o.daily && (bought[id] || 0) >= o.daily) || Meta.shards < o.shards) return false;
    const sp = eggOfferSpecies()[id] || BASE_IDS[Math.floor(Math.random() * BASE_IDS.length)];
    const skills = rollSkills(sp, { odds: Shrine.odds(), minTier: o.minTier || 0 });
    if (o.star) skills[Math.floor(Math.random() * skills.length)].t = 4;
    Meta.spendShards(o.shards);
    Box.addEgg({ species: sp, skills, need: FOUND_HATCH, kind: 'shop' });
    bought[id] = (bought[id] || 0) + 1;
    Meta.save();
    this.toast(o.id === 'mystery' ? 'A Mystery Egg is warming in your Hatchery!' : `${o.name === 'Egg' ? `A ${SPECIES[sp].name} egg` : `A ${o.name} (${SPECIES[sp].name})`} is warming in your Hatchery!`);
    return true;
  },

  shopAct(act, el) {
    switch (act) {
      case 'bld-up': {
        const id = el.dataset.b;
        if (Meta.upgradeBuilding(id)) { Audio.play('levelup'); this.toast(`${BUILDINGS[id].name}: building Lv ${Meta.building(id).to}. Ready in ${fmtMins(buildMins(Meta.buildingLevel(id)))}.`); }
        this.rerender(); return true;
      }
      case 'bld-rush': {
        const id = el.dataset.b;
        if (Meta.rushBuilding(id)) { Audio.play('levelup'); this.toast(`${BUILDINGS[id].name} is now Lv ${Meta.buildingLevel(id)}!`); }
        this.rerender(); return true;
      }
      case 'ws-hero': this.showWorkshop(el.dataset.h); return true;
      case 'ws-tab': this.wsTab = el.dataset.t; Audio.play('click'); this.showWorkshop(); return true;
      case 'slot-up': if (Meta.slotUp(this.wsHero, el.dataset.s)) Audio.play('levelup'); this.showWorkshop(); return true;
      case 'wear': if (Meta.wear(this.wsHero, el.dataset.s, el.dataset.set)) Audio.play('click'); this.showWorkshop(); return true;
      case 'tool-up': if (Meta.toolUp(el.dataset.t)) Audio.play('levelup'); this.showWorkshop(); return true;
      case 'shop-tab': this.shopTab = el.dataset.t; Audio.play('click'); this.showMerchant(); return true;
      case 'buy-item': {
        const id = el.dataset.item, g = Meta.buildingLevel('merchant');
        if (Meta.itemCount(itemKey(id, g)) < STACK_MAX && Meta.pay(itemPrice(id, g))) { Meta.addItem(id, g); Audio.play('coin'); }
        this.showMerchant(); return true;
      }
      case 'buy-egg': if (this.buyEgg(el.dataset.o)) Audio.play('chest'); this.showMerchant(); return true;
      case 'swap': {
        const x = EXCHANGE.find((e) => e.mat === el.dataset.m);
        if (x && Meta.spendShards(x.shards)) { Meta.bankMats({ [x.mat]: x.n }); Audio.play('coin'); }
        this.showMerchant(); return true;
      }
      case 'research-rush': {
        const L = Shrine.rush();
        if (L) { Audio.play('levelup'); this.toast(`Research done: tier odds improved (level ${L})!`); }
        this.showShrine(); return true;
      }
    }
    return false;
  },
};
