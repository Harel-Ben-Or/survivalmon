// Player profiles: each one keeps its own progress (Ranch, eggs, Training Hall, buildings, gear,
// Spirit Shrine, best run). Settings are shared. Profile 1 uses the original save keys, so a save
// from before profiles simply becomes profile 1. Switching profile reloads the page.
const INDEX = 'survivelmon.profiles';
const PARTS = ['box', 'meta', 'shrine', 'best', 'pending', 'rank'];
const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };

export const Profiles = {
  data: { v: 1, active: 1, next: 2, list: [{ id: 1, name: 'Player 1', made: Date.now() }] },
  leaving: false, // set while the active save is being erased, so closing the page doesn't write it back

  load() {
    const d = read(INDEX);
    if (d && d.v === 1 && Array.isArray(d.list) && d.list.length) this.data = d;
    if (!this.get(this.data.active)) this.data.active = this.data.list[0].id;
    return this;
  },
  save() { try { localStorage.setItem(INDEX, JSON.stringify(this.data)); } catch { /* storage unavailable */ } },

  get list() { return this.data.list; },
  get(id) { return this.data.list.find((p) => p.id === id); },
  get active() { return this.get(this.data.active); },
  // Storage key for one part of a profile's save
  key(part, id = this.data.active) { return id === 1 ? `survivelmon.${part}` : `survivelmon.p${id}.${part}`; },

  add(name) {
    const p = { id: this.data.next++, name: this.cleanName(name) || `Player ${this.data.list.length + 1}`, made: Date.now() };
    this.data.list.push(p);
    this.save();
    return p;
  },
  rename(id, name) {
    const p = this.get(id), n = this.cleanName(name);
    if (p && n) { p.name = n; this.save(); }
  },
  cleanName(name) { return String(name || '').replace(/[<>&"]/g, '').trim().slice(0, 16); },
  use(id) {
    if (!this.get(id)) return;
    this.data.active = id;
    this.get(id).last = Date.now();
    this.save();
  },
  // Erase a profile's progress; the profile itself (its name) stays
  wipe(id) { for (const part of PARTS) { try { localStorage.removeItem(this.key(part, id)); } catch { /* ignore */ } } },
  remove(id) {
    if (this.data.list.length <= 1 || !this.get(id)) return false;
    this.wipe(id);
    this.data.list = this.data.list.filter((p) => p.id !== id);
    if (this.data.active === id) this.data.active = this.data.list[0].id;
    this.save();
    return true;
  },
  // A short look at a profile's progress, read straight from storage
  summary(id) {
    const box = read(this.key('box', id)), meta = read(this.key('meta', id)), best = read(this.key('best', id));
    const mons = box?.mons?.length || 0, runs = meta?.runs || 0;
    return { fresh: !runs && !mons && !(box?.eggs?.length), runs, mons, coins: meta?.coins || 0, best: Math.max(best?.time || 0, meta?.bestTime || 0), played: meta?.played || 0 };
  },
};
Profiles.load();
