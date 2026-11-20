// The ranking: every player's best results, kept in a small online table (Supabase) that all players
// read. Each save sends one row, its own: its game name, furthest gate, best run, Survidex count, Night
// Lord wins and its strongest survivalmon. A random id and secret per save (never the play-stats id)
// make sure only that save can change or remove its row: the table takes writes only through two
// database functions that check the secret (submit_rank, leave_rank; see README).
//
// Off unless the page settings hold the table's address and public key (window.SURVIVALMON_RANK in
// index.html), the game runs on the live site, and the player hasn't hidden themselves (settings.rank).
import { Profiles } from './profiles.js';
import { Meta } from './meta.js';
import { Box, monStats, monPower } from './collection.js';
import { DEX_IDS, SPECIES } from '../content/species.js';
import { PASSIVES } from '../content/skills.js';

const CFG = globalThis.SURVIVALMON_RANK || {};
const KEY = Profiles.key('rank'); // this save's { id, secret, sent, leaving }
// only the real game sends scores (a test copy on a computer or the Claude link never does)
const LIVE = /\.github\.io$/i.test(location.hostname);

const hex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');
const int = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
function loadMe() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } }

// A row from the table, checked: other players' rows are never trusted as they come
function clean(r) {
  if (!r || typeof r.id !== 'string') return null;
  let mon = r.strongest;
  if (!mon || typeof mon !== 'object' || !SPECIES[mon.sp]) mon = null;
  if (mon) {
    const st = mon.stats || {};
    mon = {
      sp: mon.sp, nick: String(mon.nick || '').slice(0, 14), level: int(mon.lv, 999), stars: int(mon.stars, 5),
      skills: (Array.isArray(mon.skills) ? mon.skills : []).slice(0, 4)
        .filter((k) => k && (k.k === 'u' ? SPECIES[k.sp]?.unique : k.k === 'p' && PASSIVES[k.id]))
        .map((k) => (k.k === 'u' ? { k: 'u', sp: k.sp, t: int(k.t, 4) } : { k: 'p', id: k.id, t: int(k.t, 4) })),
      stats: { hp: int(st.hp, 1e7), atk: int(st.atk, 1e7), spd: int(st.spd, 1e4), def: int(st.def, 99), crit: int(st.crit, 100) },
    };
  }
  return {
    id: r.id, name: String(r.name || 'Ranger').slice(0, 14), gate: int(r.top_gate, 1e4), level: int(r.best_level, 1e4),
    kills: int(r.best_kills, 1e8), dex: int(r.dex, 1e4), wins: int(r.lord_wins, 1e6), mon, power: mon ? int(r.power, 1e8) : 0,
    at: Date.parse(r.updated_at) || 0,
  };
}

export const Ranking = {
  url: String(CFG.url || '').replace(/\/+$/, ''),
  key: String(CFG.key || ''),
  forceLive: false, // tests on a computer
  settings: null,
  cache: null, cacheAt: 0,

  init(settings) { this.settings = settings; },
  // the table is there to read (the Ranking button shows)
  get ready() { return !!(this.url && this.key && (LIVE || this.forceLive)); },
  // this player is in it
  get on() { return this.ready && this.settings?.rank !== false; },
  get myId() { return loadMe()?.id || ''; },

  me() {
    let m = loadMe();
    if (!m?.id || !m?.secret) { m = { id: hex(12), secret: hex(24), sent: '' }; this.saveMe(m); }
    return m;
  },
  saveMe(m) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* no storage */ } },
  headers() {
    const h = { apikey: this.key, 'Content-Type': 'application/json' };
    if (!this.key.startsWith('sb_')) h.Authorization = `Bearer ${this.key}`; // an older-style key is a token too
    return h;
  },
  call(fn, body) { return fetch(`${this.url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: this.headers(), body: JSON.stringify(body) }); },

  // This save's row. best: the run records (Game.best: kills, level, wins)
  row(best = {}) {
    let top = null, power = 0;
    for (const m of Box.data.mons) { const p = monPower(m); if (p > power) { power = p; top = m; } }
    let strongest = null;
    if (top) {
      const s = monStats(top);
      strongest = {
        sp: top.species, nick: top.nick || '', lv: top.level, stars: top.stars || 0,
        skills: top.skills.map((k) => (k.k === 'u' ? { k: 'u', sp: k.sp, t: k.t } : { k: 'p', id: k.id, t: k.t })),
        stats: { hp: s.hp, atk: s.atk, spd: s.spd, def: s.def, crit: s.crit },
      };
    }
    return {
      p_name: Meta.playerName, p_hero: Meta.hero, p_top_gate: Meta.gates || 0, p_best_level: best.level || 0,
      p_best_kills: best.kills || 0, p_dex: DEX_IDS.filter((id) => Box.known(id)).length, p_lord_wins: best.wins || 0,
      p_strongest: strongest, p_power: power, p_version: globalThis.SURVIVALMON_VERSION || '',
    };
  },
  // Send this save's row when it has changed since the last send: after each run, when the game opens
  // and when the Ranking page opens. A save that hasn't finished a run yet isn't listed.
  async submit(best) {
    if (!this.on || !(Meta.data.runs > 0)) return false;
    const me = this.me(), row = this.row(best), sig = JSON.stringify(row);
    if (sig === me.sent && !me.leaving) return true;
    try {
      const r = await this.call('submit_rank', { p_id: me.id, p_secret: me.secret, ...row });
      if (!r.ok) return false;
      me.sent = sig; me.leaving = false; this.saveMe(me); this.cacheAt = 0;
      return true;
    } catch { return false; } // offline: it goes next time
  },
  // Hidden: this save's row is deleted (asked again next time if the phone was offline)
  async leave() {
    const me = loadMe();
    if (!this.ready || !me?.id) return;
    me.sent = ''; me.leaving = true; this.saveMe(me); this.cacheAt = 0;
    try { const r = await this.call('leave_rank', { p_id: me.id, p_secret: me.secret }); if (r.ok) { me.leaving = false; this.saveMe(me); } } catch { /* offline */ }
  },
  // A save is being erased or deleted: its row leaves the ranking too. The page may reload straight
  // after, so the request is sent to finish on its own.
  forget(profileId) {
    let rec = null;
    try { rec = JSON.parse(localStorage.getItem(Profiles.key('rank', profileId))); } catch { /* none */ }
    if (!this.ready || !rec?.id || !rec?.secret) return;
    try {
      fetch(`${this.url}/rest/v1/rpc/leave_rank`, { method: 'POST', headers: this.headers(), keepalive: true,
        body: JSON.stringify({ p_id: rec.id, p_secret: rec.secret }) }).catch(() => {});
    } catch { /* offline: the row stays */ }
  },
  // When the game opens: bring the row up to date, or finish leaving
  sync(best) {
    if (!this.ready) return;
    if (this.on) this.submit(best);
    else if (loadMe()?.leaving) this.leave();
  },
  // Every player's row (kept for 30 seconds, so flipping tabs doesn't ask again)
  async list(force = false) {
    if (!this.ready) throw new Error('off');
    if (!force && this.cache && Date.now() - this.cacheAt < 30000) return this.cache;
    const cols = 'id,name,top_gate,best_level,best_kills,dex,lord_wins,strongest,power,updated_at';
    const r = await fetch(`${this.url}/rest/v1/ranking?select=${cols}&limit=1000`, { headers: this.headers() });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    this.cache = (Array.isArray(data) ? data : []).map(clean).filter(Boolean);
    this.cacheAt = Date.now();
    return this.cache;
  },
};
