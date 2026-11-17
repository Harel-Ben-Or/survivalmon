// Decides what spawns, when and where over a run.
import { WAVES, EVENTS, ENEMIES } from '../content/creatures.js';
import { weightedChoice, rand, TAU, dist2 } from '../core/util.js';
import { Audio } from '../core/audio.js';
import { SPECIES } from '../content/species.js';
import { ZONES } from '../world/world.js';

// The longest run. Waves, bosses and monster scaling were written for a 25 minute run; PACE
// plays them faster (Game.stage = time * PACE), so the longest run covers their first 20 minutes:
// the Ink King (2:00), the Blighted Elder (4:00), Snare Boss Grimjaw (6:00) and the Night Lord 30 s before the end.
export const RUN_LENGTH = 8 * 60;
export const PACE = 2.5;
const FINAL_BOSS_AT = RUN_LENGTH - 30;
// Glimmoth only turns up in the wild, and more rarely
const WILD_POOL = ['emberpup', 'leafkit', 'puddlit', 'voltowl', 'pebblet'].map((type) => ({ type, weight: 2 }))
  .concat(['glimmoth', 'duskit', 'snowpip', 'venewt', 'ferrit'].map((type) => ({ type, weight: 1 })));
// Kills come PACE times faster than they used to, so each pays a bit more EXP to keep levelling up in a short run.
export const XP_PACE = Math.sqrt(PACE);
const MAX_ENEMIES = 320;

export class Director {
  constructor(g) {
    this.g = g;
    this.acc = 0;
    this.eventIdx = 0;
    this.eliteT = 22;
    this.catchT = 75 / (g.wildMult || 1);
    this.relocateT = 0;
    this.packT = 0; this.witchT = 0; this.nightSeen = {}; // night creatures (nightSpawns)
  }
  // Night creatures come out after dark: Moonfang packs once the sun is down, a Nightshade Witch
  // once it's properly dark (about 6:00 of the 8 minute run). Short runs end before night.
  nightSpawns(dt) {
    const g = this.g, d = g.dark;
    if (!d) return;
    const first = (id, text, sub) => {
      if (this.nightSeen[id]) return;
      this.nightSeen[id] = true;
      g.feed(`${text} ${sub}`, '#c49aff');
      Audio.play('boss');
    };
    if (d.sunset >= 0.9) {
      this.packT -= dt;
      if (this.packT <= 0) {
        this.packT = rand(18, 26) * (d.night > 0.9 ? 0.75 : 1);
        const base = this.spawnPos(false);
        if (base) {
          const n = d.night > 0.5 ? 4 : 3;
          for (let i = 0; i < n; i++) {
            const x = base.x + rand(-24, 24), y = base.y + rand(-24, 24);
            if (g.world.walkable(x, y)) g.spawnEnemy('moonfang', x, y);
          }
          first('moonfang', 'Moonfangs hunt in the dusk!', 'Night creatures: your lantern light slows and burns them');
        }
      }
    }
    if (d.night >= 0.55) {
      this.witchT -= dt;
      const witches = g.enemies.filter((e) => e.type === 'witch' && !e.dead).length;
      if (this.witchT <= 0 && witches < 3) {
        this.witchT = rand(28, 38);
        if (this.spawn('witch')) first('witch', 'A Nightshade Witch comes out!', 'She hid from the light all day. Her venom pools hurt: keep moving');
      }
    }
  }
  wave() {
    const t = this.g.stage;
    let w = WAVES[0];
    for (const x of WAVES) if (x.t <= t) w = x;
    return w;
  }
  spawnPos(flyer) {
    const g = this.g, P = g.player;
    const rad = Math.hypot(g.view.w, g.view.h) / 2 + rand(10, 40);
    for (let i = 0; i < 14; i++) {
      const a = rand(0, TAU);
      const x = P.x + Math.cos(a) * rad, y = P.y + Math.sin(a) * rad;
      if (!flyer && !g.world.walkable(x, y)) continue;
      if (!flyer && g.world.flowAt(x, y) > 200) continue;
      return { x, y };
    }
    return null;
  }
  // 'native' in a pool or event means the monster of the zone you're standing in
  native() { const g = this.g; return ZONES[g.world.zoneAtPx(g.player.x, g.player.y)]?.native || 'blob'; }
  spawn(type, opts) {
    if (type === 'native') type = this.native();
    const def = ENEMIES[type];
    const p = this.spawnPos(def.behavior === 'flyer' || def.flying);
    if (!p) return null;
    return this.g.spawnEnemy(type, p.x, p.y, opts);
  }
  update(dt) {
    const g = this.g;
    const t = g.stage;
    while (this.eventIdx < EVENTS.length && EVENTS[this.eventIdx].t <= t) this.trigger(EVENTS[this.eventIdx++]);
    if (!this.finalBoss && g.runLength >= RUN_LENGTH && g.time >= FINAL_BOSS_AT) {
      this.finalBoss = true;
      this.trigger({ type: 'boss', enemy: 'night_lord' });
    }
    const w = this.wave();
    const bossAlive = g.enemies.some((e) => e.boss && !e.dead);
    if (g.enemies.length < MAX_ENEMIES) {
      this.acc += w.rate * dt * (bossAlive ? 0.55 : 1);
      const pool = Object.entries(w.pool).map(([type, weight]) => ({ type, weight }));
      while (this.acc >= 1) {
        this.acc -= 1;
        this.spawn(weightedChoice(pool).type);
      }
    } else this.acc = 0;
    this.nightSpawns(dt);
    this.eliteT -= dt;
    if (this.eliteT <= 0) {
      this.eliteT = 20;
      const pool = Object.keys(w.pool);
      this.spawn(pool[(Math.random() * pool.length) | 0], { elite: true }); // 'native' resolves in spawn()
    }
    // Once your first egg has hatched, a wild survivalmon turns up now and then
    this.catchT -= dt;
    if (this.catchT <= 0 && g.canCatch) {
      this.catchT = rand(120, 180) / (g.wildMult || 1);
      if (!g.enemies.some((e) => e.wild && !e.dead)) {
        // most wild survivalmons belong to the zone you're in
        const zone = ZONES[g.world.zoneAtPx(g.player.x, g.player.y)];
        const sp = Math.random() < 0.65 ? zone.mons[(Math.random() * zone.mons.length) | 0] : weightedChoice(WILD_POOL).type;
        if (this.spawn('wild', { wild: sp })) {
          g.feed(`A wild ${SPECIES[sp].name} appeared! Catch it within 25 s`, '#7af0ff'); // an arrow at the screen's edge points to it
          Audio.play('combo');
        } else this.catchT = 2; // no free spot right now: try again shortly
      }
    }
    // Keep the pressure on: enemies left far behind get moved back near the player
    this.relocateT -= dt;
    if (this.relocateT <= 0) {
      this.relocateT = 0.5;
      const P = g.player, far = (Math.max(g.view.w, g.view.h) * 0.95) ** 2;
      for (const e of g.enemies) {
        if (e.boss || e.dead || e.fainted || e.carry || dist2(e.x, e.y, P.x, P.y) < far) continue;
        const p = this.spawnPos(e.flying);
        if (p) { e.x = p.x; e.y = p.y; }
      }
    }
  }
  trigger(ev) {
    const g = this.g, P = g.player;
    if (ev.type === 'boss' && this.finalBoss && ev.enemy !== 'night_lord') return; // the Night Lord is the run's last boss
    if (ev.type === 'boss' && ev.enemy === 'night_lord' && g.enemies.some((e) => e.type === 'night_lord')) return; // only one at a time
    if (ev.type === 'boss') {
      const p = this.spawnPos(!!ENEMIES[ev.enemy].flying) || { x: P.x + 150, y: P.y };
      const boss = g.spawnEnemy(ev.enemy, p.x, p.y);
      g.bossBar(boss);
      g.banner(`${ENEMIES[ev.enemy].name} appears!`, '#ff6a5a', true);
      Audio.play('boss');
      return;
    }
    if (ev.type === 'snare') { this.raid(); return; }
    if (ev.msg) g.feed(ev.msg, '#ffd84a');
    const enemy = ev.enemy === 'native' ? this.native() : ev.enemy;
    if (ev.type === 'ring') {
      const R = 175, gap = Math.floor(rand(0, ev.count));
      for (let i = 0; i < ev.count; i++) {
        if ((i - gap + ev.count) % ev.count < Math.max(2, ev.count / 8)) continue; // leave an escape gap
        const a = (i / ev.count) * TAU;
        const x = P.x + Math.cos(a) * R, y = P.y + Math.sin(a) * R * 0.8;
        if (g.world.walkable(x, y)) g.spawnEnemy(enemy, x, y);
      }
    } else if (ev.type === 'swarm') {
      const base = this.spawnPos(true);
      if (!base) return;
      for (let i = 0; i < ev.count; i++) {
        const x = base.x + rand(-40, 40), y = base.y + rand(-40, 40);
        const def = ENEMIES[enemy];
        if (def.behavior === 'flyer' || def.flying || g.world.walkable(x, y)) g.spawnEnemy(enemy, x, y);
      }
    }
  }
  // A Snare gang raid: netters, a slinger, a cage drone, and (once you can catch survivalmons)
  // one they control with the Blight. Defeating that one frees it and it joins you.
  raid() {
    const g = this.g, base = this.spawnPos(false);
    if (!base) return;
    g.feed('The Snare gang is here!', '#ff8a7a');
    Audio.play('combo');
    // the first raid is a small one; later ones bring more of the gang
    const squad = g.stage < 300 ? ['poacher', 'slinger', 'drone'] : ['poacher', 'poacher', 'slinger', 'drone'];
    if (g.stage > 600) squad.push('poacher', 'slinger');
    for (const type of squad) g.spawnEnemy(type, base.x + rand(-28, 28), base.y + rand(-18, 18));
    if (g.canCatch) {
      const zone = ZONES[g.world.zoneAtPx(g.player.x, g.player.y)];
      const sp = Math.random() < 0.6 ? zone.mons[(Math.random() * zone.mons.length) | 0] : weightedChoice(WILD_POOL).type;
      g.spawnEnemy('wild', base.x, base.y, { wild: sp, corrupted: true });
      g.toast(`They have a ${SPECIES[sp].name} under the Blight's control. Defeat it to free it!`);
    }
  }
}
