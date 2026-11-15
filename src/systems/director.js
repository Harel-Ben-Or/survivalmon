// Decides what spawns, when and where over a run.
import { WAVES, EVENTS, ENEMIES } from '../content/creatures.js';
import { weightedChoice, rand, TAU, dist2 } from '../core/util.js';
import { Audio } from '../core/audio.js';
import { SPECIES } from '../content/species.js';

// The longest run. Waves, bosses and monster scaling were written for a 25 minute run; PACE
// plays them faster (Game.stage = time * PACE), so the longest run covers their first 20 minutes:
// King Slime (2:00), the Treant (4:00), the Colossus (6:00) and the Night Lord 30 s before the end.
export const RUN_LENGTH = 8 * 60;
export const PACE = 2.5;
const FINAL_BOSS_AT = RUN_LENGTH - 30;
// Glimmoth only turns up in the wild, and more rarely
const WILD_POOL = ['emberpup', 'leafkit', 'puddlit', 'voltowl', 'pebblet'].map((type) => ({ type, weight: 2 })).concat([{ type: 'glimmoth', weight: 1 }]);
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
      if (x < 90 || y < 90 || x > g.world.pw - 90 || y > g.world.ph - 90) continue;
      if (!flyer && !g.world.walkable(x, y)) continue;
      if (!flyer && g.world.flowDist[Math.floor(y / 16) * g.world.w + Math.floor(x / 16)] > 200) continue;
      return { x, y };
    }
    return null;
  }
  spawn(type, opts) {
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
    this.eliteT -= dt;
    if (this.eliteT <= 0) {
      this.eliteT = 20;
      const pool = Object.keys(w.pool);
      this.spawn(pool[(Math.random() * pool.length) | 0], { elite: true });
    }
    // Once your first egg has hatched, a wild survivalmon turns up now and then
    this.catchT -= dt;
    if (this.catchT <= 0 && g.canCatch) {
      this.catchT = rand(120, 180) / (g.wildMult || 1);
      if (!g.enemies.some((e) => e.wild && !e.dead)) {
        const sp = weightedChoice(WILD_POOL).type;
        if (this.spawn('wild', { wild: sp })) {
          g.banner(`A wild ${SPECIES[sp].name} appeared!`, '#7af0ff', false, 'Defeat it within 25 seconds to catch it');
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
        if (e.boss || e.dead || e.fainted || dist2(e.x, e.y, P.x, P.y) < far) continue;
        const p = this.spawnPos(e.flying);
        if (p) { e.x = p.x; e.y = p.y; }
      }
    }
  }
  trigger(ev) {
    const g = this.g, P = g.player;
    if (ev.type === 'boss') {
      const p = this.spawnPos(!!ENEMIES[ev.enemy].flying) || { x: P.x + 150, y: P.y };
      const boss = g.spawnEnemy(ev.enemy, p.x, p.y);
      g.bossBar(boss);
      g.banner(`${ENEMIES[ev.enemy].name} appears!`, '#ff6a5a', true);
      Audio.play('boss');
      return;
    }
    if (ev.msg) g.banner(ev.msg, '#ffd84a');
    if (ev.type === 'ring') {
      const R = 175, gap = Math.floor(rand(0, ev.count));
      for (let i = 0; i < ev.count; i++) {
        if ((i - gap + ev.count) % ev.count < Math.max(2, ev.count / 8)) continue; // leave an escape gap
        const a = (i / ev.count) * TAU;
        const x = P.x + Math.cos(a) * R, y = P.y + Math.sin(a) * R * 0.8;
        if (g.world.walkable(x, y)) g.spawnEnemy(ev.enemy, x, y);
      }
    } else if (ev.type === 'swarm') {
      const base = this.spawnPos(true);
      if (!base) return;
      for (let i = 0; i < ev.count; i++) {
        const x = base.x + rand(-40, 40), y = base.y + rand(-40, 40);
        const def = ENEMIES[ev.enemy];
        if (def.behavior === 'flyer' || def.flying || g.world.walkable(x, y)) g.spawnEnemy(ev.enemy, x, y);
      }
    }
  }
}
