// Shop-like screens, mixed into UI: the Workshop (hero gear sets, slot levels and gathering tools),
// the Merchant (goods for your bag, and the Skyfall counter for Skyfall Shards) and the "upgrade this
// building" panel shown in every building (upgrades take time; shards finish them at once).
import { iconURL } from '../gfx/assets.js';
import { artURL } from '../gfx/art.js';
import { eggURL } from '../gfx/eggs.js';
import { HEROES } from '../content/heroes.js';
import { SPECIES, BASE_IDS, ATK_TYPES } from '../content/species.js';
import { BUILDINGS, buildingCost, buildMins, fmtMins, MATERIALS } from '../content/buildings.js';
import { SLOTS, SLOT_NAME, SLOT_STAT, MILESTONES, HERO_BOOST, HERO_SETS, GEAR_SETS, SET_PIECES, STARS, pieceName, pieceStat, setTier, gearIcon, TOOLS } from '../content/gear.js';
import { ITEMS, GRADES, itemPrice, itemName, itemText, itemKey, EXCHANGE, EGG_OFFERS, eggOfferSpecies, dayKey, STACK_MAX, BREED_IDS, GEAR_OFFERS, gearOfferSlot } from '../content/shop.js';
import { Meta, MAT_KEYS } from '../systems/meta.js';
import { Box, rollSkills, FOUND_HATCH, BRED_HATCH, EGG_SLOTS } from '../systems/collection.js';
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
// screen -> the building it belongs to, and how to redraw it
const PAGE_BUILDING = { ranch: 'ranch', hatchery: 'hatchery', clinic: 'clinic', shrine: 'shrine', workshop: 'workshop', merchant: 'merchant', team: 'gate' };
// A piece's stars as a small badge on its picture (nothing at 0 stars)
const starTag = (n) => (n ? `<em class="pstar">${n}★</em>` : '');
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
  // Gear: your hero in the middle with the six slots around them (their look changes with a full set).
  // Tap a slot to see the pieces found for it; tap a piece to look at it, wear it or level it up: a
  // level belongs to the piece itself. Tools: upgrades for gathering in runs.
  showWorkshop(hero = this.wsHero || Meta.hero) {
    this.wsHero = hero;
    const tab = this.wsTab || 'gear';
    const tabs = tabBtn('ws-tab', tab, 'gear', 'Gear') + tabBtn('ws-tab', tab, 'tools', 'Tools');
    const body = tab === 'tools' ? this.toolsHTML() : this.gearHTML(hero);
    this.page('workshop', body, { title: 'Workshop', tools: tabs, chips: wallet() });
  },
  gearHTML(hero) {
    const sets = HERO_SETS[hero], name = esc(Meta.heroName(hero));
    const slot = SLOTS.includes(this.wsSlot) ? this.wsSlot : (this.wsSlot = 'main');
    const worn = Meta.worn(hero, slot), found = sets.filter((id) => Meta.ownsPiece(hero, slot, id));
    // the piece looked at: the one tapped, else the one worn, else the first found for this slot
    const sel = found.includes(this.wsPiece) ? this.wsPiece : (this.wsPiece = worn || found[0] || null);
    const full = Meta.fullSet(hero);
    const gi = (set, s) => icon(gearIcon(set, s), 3);
    const heroTabs = HEROES.map((h) => `<button class="hero-chip ${h.id === hero ? 'sel' : ''} ${Meta.isHeroUnlocked(h.id) ? '' : 'locked'}" data-mact="ws-hero" data-h="${h.id}">
      <img class="px" src="${artURL('hero', h.id) || iconURL('hero', h.id, 2)}" alt=""><span>${esc(Meta.heroName(h.id))} ${Meta.piecesOwned(h.id)}/${SLOTS.length * HERO_SETS[h.id].length}</span></button>`).join('');
    const slotBtn = (s) => {
      const on = Meta.worn(hero, s);
      return `<button class="dslot ${s === slot ? 'sel' : ''} ${on ? '' : 'empty'}" data-mact="ws-slot" data-s="${s}" ${on ? `style="--tc:${setTier(on).color}"` : ''} aria-label="${SLOT_NAME[s]}">
        ${on ? `<img class="px" src="${gi(on, s)}" alt="">${starTag(Meta.pieceStars(hero, s, on))}<i>Lv ${Meta.pieceLevel(hero, s, on)}</i>` : `<span>${SLOT_NAME[s]}</span>`}</button>`;
    };
    const doll = `<div class="doll">
      <div class="doll-col">${['helmet', 'armor', 'gloves'].map(slotBtn).join('')}</div>
      <div class="doll-mid"><img class="px doll-hero" src="${artURL('hero', hero) || iconURL('hero', hero, 4)}" alt=""><b>${name}</b>
        <span class="small" ${full ? `style="color:${setTier(full).color}"` : ''}>${full ? esc(GEAR_SETS[full].name) : `${Meta.gearCount(hero)}/6 worn`}</span></div>
      <div class="doll-col">${['main', 'off', 'boots'].map(slotBtn).join('')}</div></div>`;
    // every piece that exists for this slot: found ones can be tapped, the rest show as shadows
    const pieceRow = `<div class="wd-pieces">${sets.map((id) => {
      const T = setTier(id);
      return Meta.ownsPiece(hero, slot, id)
        ? `<button class="wpiece ${id === sel ? 'sel' : ''} ${id === worn ? 'on' : ''}" style="--tc:${T.color}" data-mact="ws-piece" data-set="${id}" aria-label="${esc(pieceName(hero, id, slot))}"><img class="px" src="${gi(id, slot)}" alt="">${starTag(Meta.pieceStars(hero, slot, id))}<i>Lv ${Meta.pieceLevel(hero, slot, id)}</i></button>`
        : `<span class="wpiece none" style="--tc:${T.color}" title="${T.name}: not found yet"><img class="px" src="${gi(id, slot)}" alt=""><i>?</i></span>`;
    }).join('')}</div>`;
    let detail;
    if (!sel) {
      detail = `<div class="ws-detail"><div class="wd-head"><div class="wd-name"><b>${SLOT_NAME[slot]}</b><div class="small">Nothing found for this slot yet. Gear drops from bosses, elites, chests and wild survivalmons.</div></div></div>${pieceRow}</div>`;
    } else {
      const S = GEAR_SETS[sel], T = setTier(sel), L = Meta.pieceLevel(hero, slot, sel), c = Meta.pieceUpCost(hero, slot, sel), n = Meta.setWorn(hero, sel);
      // its stars: one for every few blueprints (a blueprint is this same piece found again)
      const st = Meta.pieceStars(hero, slot, sel), bp = Meta.pieceBlueprints(hero, slot, sel), need = STARS.need[st];
      const stars = `<div class="wd-stars"><span class="stars">${'★'.repeat(st)}<s>${'★'.repeat(STARS.max - st)}</s></span>
        ${st < STARS.max ? `<span class="bp"><u style="width:${Math.round((100 * bp) / need)}%"></u><b>Blueprints ${bp}/${need}</b></span>` : '<span class="bp full"><b>All 5 stars</b></span>'}
        <span class="small">${st ? `+${st * Math.round(STARS.stat * 100)}% to this piece` : 'Find this piece again for a blueprint'}</span></div>`;
      detail = `<div class="ws-detail" style="--tc:${T.color}">
        <div class="wd-head"><img class="px" src="${gi(sel, slot)}" alt="">
          <div class="wd-name"><b>${esc(pieceName(hero, sel, slot))}</b> <span class="wd-tier">${T.name}</span>
            <div class="small">${SLOT_NAME[slot]} · Lv ${L} · ${esc(pieceStat(sel, slot, L, st).text)}</div></div>
          ${sel === worn ? '<span class="wd-on">Worn</span>' : `<button class="btn small" data-mact="wear" data-s="${slot}" data-set="${sel}">Wear</button>`}</div>
        <div class="wd-up">${c ? `<span class="next">Lv ${L + 1}: ${esc(pieceStat(sel, slot, L + 1, st).text)}</span><span class="costs">${costChips(c)}</span><button class="btn small" data-mact="piece-up" data-s="${slot}" data-set="${sel}" ${Meta.canAfford(c) ? '' : 'disabled'}>Level up</button>`
          : '<span class="next">Top level for now: upgrade the Workshop to go higher</span>'}</div>
        ${stars}
        ${pieceRow}
        <div class="wd-set"><div class="wsc-head"><b>${esc(S.name)}</b><span class="small">worn ${n}/6</span></div>
          ${S.bonus.map((x, i) => `<div class="wsc-b ${n >= SET_PIECES[i] ? 'on' : 'off'}">${n >= SET_PIECES[i] ? '★' : '☆'} ${SET_PIECES[i]}: ${esc(x.text)}</div>`).join('')}
          ${sel === sets[0] ? '' : `<div class="wsc-b ${full === sel ? 'on' : 'off'}">${full === sel ? '★' : '☆'} 6: ${name} wears the set's look</div>`}</div></div>`;
    }
    return `<div class="hero-pick ws-tabs">${heroTabs}</div>
      <div class="wsx"><div class="ws-left">${doll}${this.activeHTML(hero)}</div>${detail}</div>`;
  },
  // Active bonuses: everything that is on right now, from all six slots together (whatever mix of sets
  // is worn). First the totals: what the worn pieces and the sets' plain stat bonuses add up to for the
  // hero, for the survivalmons (the hero's own boost and the milestones included) and for runs. Then
  // each set with a piece on and its effects that are on, the hero's boost, and the level milestones.
  activeHTML(hero) {
    const name = esc(Meta.heroName(hero)), HB = Meta.heroTeamBonus(hero), pc = (v) => +(v * 100).toFixed(1);
    const mods = { ...Meta.gearMods(hero) };
    for (const [k, v] of Object.entries(HB.hero)) mods[k] = (mods[k] || 0) + v;
    const FMT = { ...Object.fromEntries(Object.values(SLOT_STAT).map((s) => [s.key, s.fmt])), regen: (v) => `+${+v.toFixed(2)} HP a second`, luck: (v) => `+${pc(v)}% luck` };
    const mine = ['might', 'crit', 'haste', 'maxHp', 'armor', 'speed', 'regen', 'luck'].filter((k) => mods[k]).map((k) => FMT[k](mods[k]));
    const T = HB.team;
    const team = [T.dmg && `+${pc(T.dmg)}% damage`, T.hp && `+${pc(T.hp)}% HP`, T.haste && `attack ${pc(T.haste)}% faster`, T.def && `take ${pc(T.def)}% less damage`, T.crit && `+${pc(T.crit)}% crit chance`,
      ...Object.entries(HB.types).filter(([, v]) => v).map(([k, v]) => `${ATK_TYPES[k].name} ones +${pc(v)}% damage`)].filter(Boolean);
    const runs = [HB.petXp && `+${pc(HB.petXp)}% survivalmon EXP`, HB.wild && `+${pc(HB.wild)}% wild survivalmons`, HB.coins && `+${pc(HB.coins)}% coins`, HB.mats && `+${pc(HB.mats)}% materials`, HB.shards && `+${pc(HB.shards)}% Skyfall Shards`].filter(Boolean);
    const tot = (label, list) => (list.length ? `<div class="wa-tot"><b>${label}</b>${list.map(esc).join(' · ')}</div>` : '');
    // the sets worn, the one with the most pieces first; a set with a single piece on says what one more would turn on
    const full = Meta.fullSet(hero);
    const sets = HERO_SETS[hero].map((id) => [id, Meta.setWorn(hero, id)]).filter(([, n]) => n).sort((a, b) => b[1] - a[1]).map(([id, n]) => {
      const S = GEAR_SETS[id], on = S.bonus.filter((x, i) => n >= SET_PIECES[i]);
      return `<div class="wa-set" style="--tc:${setTier(id).color}"><b>${esc(S.name)}</b> ${n}/6</div>`
        + (on.length ? on.map((x) => `<div class="wsc-b on">★ ${esc(x.text)}</div>`).join('') : `<div class="wsc-b off">☆ 1 more piece turns on: ${esc(S.bonus[0].text)}</div>`)
        + (full === id && id !== HERO_SETS[hero][0] ? `<div class="wsc-b on">★ ${name} wears the set's look</div>` : '');
    }).join('');
    const minL = Meta.gearCount(hero) === SLOTS.length ? Meta.minSlotLevel(hero) : 0, next = MILESTONES.find((m) => minL < m.level);
    const miles = MILESTONES.filter((m) => minL >= m.level).map((m) => `<div class="wsc-b on">★ All 6 worn pieces at Lv ${m.level}: ${esc(m.text)}</div>`).join('')
      + (next ? `<div class="wsc-b off">☆ All 6 worn pieces at Lv ${next.level}: ${esc(next.text)}</div>` : '');
    return `<div class="ws-active"><div class="wa-head">Active bonuses${Meta.isHeroUnlocked(hero) ? '' : ' <i>(hero not unlocked yet)</i>'}</div>
      ${tot('Your hero', mine) || '<div class="wa-tot off">No gear worn yet</div>'}${tot('Survivalmons', team)}${tot('Runs', runs)}
      ${sets}
      <div class="wa-set"><b>${name}</b> hero boost</div><div class="wsc-b on">★ ${esc(HERO_BOOST[hero].text)}</div>
      <div class="wa-set"><b>Gear levels</b></div>${miles}</div>`;
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
    // gear for the hero the player plays: a random piece of each tier, and the day's Legendary piece
    const hero = Meta.hero;
    const gears = GEAR_OFFERS.map((o) => {
      const set = HERO_SETS[hero].find((id) => GEAR_SETS[id].tier === o.tier), T = setTier(set), slot = o.pick ? SLOTS[gearOfferSlot()] : 'main';
      const has = o.pick && Meta.ownsPiece(hero, slot, set), st = has ? Meta.pieceStars(hero, slot, set) : 0, maxed = st >= STARS.max;
      const text = !o.pick ? `A random ${T.name} piece` : maxed ? 'You have it with all 5 stars' : has ? `You have it: this one is a blueprint (${Meta.pieceBlueprints(hero, slot, set)}/${STARS.need[st]})` : 'This Legendary piece. Another one tomorrow';
      return `<div class="sky-egg sky-gear" style="--tc:${T.color}"><div class="sky-pic"><img class="px ${o.pick ? '' : 'shade'}" src="${icon(gearIcon(set, slot), 3)}" alt="">${o.pick ? '' : '<i>?</i>'}</div>
        <b>${o.pick ? esc(pieceName(hero, set, slot)) : `${T.name} gear`}</b><span class="small">${text}</span>
        <button class="btn small" data-mact="buy-gear" data-o="${o.id}" ${!maxed && Meta.shards >= o.shards ? '' : 'disabled'}>${maxed ? '5 stars' : `${shardIc()}${o.shards.toLocaleString()}`}</button></div>`;
    }).join('');
    const swaps = EXCHANGE.map((x) => `<button class="btn small secondary sky-swap" data-mact="swap" data-m="${x.mat}" ${Meta.shards >= x.shards ? '' : 'disabled'}>${shardIc()}${x.shards} → <img class="px inline-ic" src="${icon(MATERIALS[x.mat].icon)}" alt="">${x.n} ${MATERIALS[x.mat].name}</button>`).join('');
    return `<p class="pg-note">Skyfall Shards come from achievements and, from the Lv 2 gates on, very rarely from the wild (bosses always drop some). They also finish building upgrades and Shrine research at once.</p>
      <div class="team-label">Eggs today <span class="small">(new offers at midnight · nests ${Box.eggs.length}/${EGG_SLOTS})</span></div>
      <div class="sky-eggs">${eggs}</div>
      <div class="team-label">Gear for ${esc(Meta.heroName(hero))} <span class="small">(the hero you play · a piece you have comes as a blueprint)</span></div>
      <div class="sky-eggs">${gears}</div>
      <div class="team-label">Swap for materials</div>
      <div class="sky-swaps">${swaps}</div>`;
  },
  boughtToday() {
    const b = Meta.data.bought || (Meta.data.bought = { day: '', n: {} });
    if (b.day !== dayKey()) { b.day = dayKey(); b.n = {}; }
    return b.n;
  },
  // Buys gear at the Skyfall counter for the hero you play: a random piece of the offer's tier, or the
  // day's Legendary piece. It lands like a drop (a new piece, a blueprint of one you have, or materials).
  buyGear(id) {
    const o = GEAR_OFFERS.find((x) => x.id === id), hero = Meta.hero;
    if (!o || Meta.shards < o.shards) return false;
    const set = HERO_SETS[hero].find((s) => GEAR_SETS[s].tier === o.tier), slot = o.pick ? SLOTS[gearOfferSlot()] : undefined;
    if (o.pick && Meta.pieceStars(hero, slot, set) >= STARS.max) return false;
    Meta.spendShards(o.shards);
    const line = o.pick ? Meta.grantGear(hero, o.tier, slot, set) : Meta.grantGear(hero, o.tier);
    this.toast(`${Meta.heroName(hero)}: ${line}`);
    this.g.dressHeroes?.();
    return true;
  },
  // Buys a Skyfall egg: it goes to a free nest and hatches like an egg found in the wild
  buyEgg(id) {
    const o = EGG_OFFERS.find((x) => x.id === id), bought = this.boughtToday();
    if (!o || Box.eggs.length >= EGG_SLOTS || (o.daily && (bought[id] || 0) >= o.daily) || Meta.shards < o.shards) return false;
    const any = (list) => list[Math.floor(Math.random() * list.length)], odds = Shrine.odds();
    const sp = eggOfferSpecies()[id] || any(o.breed ? BREED_IDS : BASE_IDS);
    let skills;
    if (o.breed) {
      // a breed hatches with its own skill and one from each of its two parents, like one bred at the
      // Hatchery (the parents here are fresh ones of the two species it comes from)
      const [ia, ib] = SPECIES[sp].pair.map((ps) => ({ ...any(rollSkills(ps, { odds })) }));
      const same = ia.k === ib.k && (ia.k === 'u' ? ia.sp === ib.sp : ia.id === ib.id);
      skills = [{ k: 'u', sp, t: rollSkills(sp, { odds })[0].t }, ...(same ? [{ ...ia, t: Math.min(4, Math.max(ia.t, ib.t) + 1) }] : [ia, ib])];
    } else skills = rollSkills(sp, { odds });
    if (o.minTier) for (const k of skills) k.t = Math.max(k.t, o.minTier);
    if (o.oneTier && !skills.some((k) => k.t >= o.oneTier)) any(skills).t = o.oneTier;
    if (o.star) any(skills).t = 4;
    Meta.spendShards(o.shards);
    Box.addEgg({ species: sp, skills, need: o.breed ? BRED_HATCH : FOUND_HATCH, kind: 'shop' });
    bought[id] = (bought[id] || 0) + 1;
    Meta.save();
    this.toast(o.id === 'mystery' ? 'A Mystery Egg is warming in your Hatchery!' : o.breed && o.icon ? `A ${o.name} is warming in your Hatchery!` : `${o.name === 'Egg' ? `A ${SPECIES[sp].name} egg` : `A ${o.name} (${SPECIES[sp].name})`} is warming in your Hatchery!`);
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
      case 'ws-hero': this.wsPiece = null; this.showWorkshop(el.dataset.h); return true;
      case 'ws-slot': this.wsSlot = el.dataset.s; this.wsPiece = null; Audio.play('click'); this.showWorkshop(); return true;
      case 'ws-piece': this.wsPiece = el.dataset.set; Audio.play('click'); this.showWorkshop(); return true;
      case 'piece-up': if (Meta.pieceUp(this.wsHero, el.dataset.s, el.dataset.set)) Audio.play('levelup'); this.showWorkshop(); return true;
      case 'ws-tab': this.wsTab = el.dataset.t; Audio.play('click'); this.showWorkshop(); return true;
      case 'slot-up': if (Meta.slotUp(this.wsHero, el.dataset.s)) Audio.play('levelup'); this.showWorkshop(); return true;
      case 'wear':
        if (Meta.wear(this.wsHero, el.dataset.s, el.dataset.set)) Audio.play('click');
        this.showWorkshop();
        // a full set changes the hero's look: show it once its picture is in
        this.g.dressHeroes().then(() => { if (this.screen === 'workshop') this.showWorkshop(); });
        return true;
      case 'tool-up': if (Meta.toolUp(el.dataset.t)) Audio.play('levelup'); this.showWorkshop(); return true;
      case 'shop-tab': this.shopTab = el.dataset.t; Audio.play('click'); this.showMerchant(); return true;
      case 'buy-item': {
        const id = el.dataset.item, g = Meta.buildingLevel('merchant');
        if (Meta.itemCount(itemKey(id, g)) < STACK_MAX && Meta.pay(itemPrice(id, g))) { Meta.addItem(id, g); Audio.play('coin'); }
        this.showMerchant(); return true;
      }
      case 'buy-egg': if (this.buyEgg(el.dataset.o)) Audio.play('chest'); this.showMerchant(); return true;
      case 'buy-gear': if (this.buyGear(el.dataset.o)) Audio.play('chest'); this.showMerchant(); return true;
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
