// The story's first run (mixed into Game): out of the ruins of Brightnest and down the road to
// Hearthvale, with no clock. Things happen as you pass places on the road (world.story, STORY_ROAD in
// world.js): ink blobs crawl out of the crater, your egg hatches, more of them block the road, a
// signpost, a last big one in the way, and the town's gate. Reaching the gate ends the run and you walk
// into town. Ink blobs are slower than you, so they come at you from ahead and from the road's edges
// (the ones you leave far behind give up), so you see what you hit and walk through the EXP.
import { TILE } from './world.js';
import { storyArt } from '../ui/story.js';
import { rand, TAU, dist2 } from '../core/util.js';
import { snap } from '../gfx/art.js';
import { Audio } from '../core/audio.js';
import { Analytics } from '../systems/analytics.js';

export const StoryRoad = {
  startStoryRoad() {
    this.road = { done: new Set(), spawnT: 3 };
    storyArt().then((A) => { this.roadArt = A; }); // Hollis, lying where you left him
  },
  // where things are, in pixels
  roadSpots() {
    const R = this.world.story, cx = R.x * TILE + 8;
    return { R, cx, crater: { x: cx + 66, y: R.spawnY * TILE - 30 }, hollis: { x: cx + 18, y: R.spawnY * TILE - 4 }, gateY: R.gateY * TILE };
  },
  // How far it still is (for the HUD), in metres of a sort: one tile, one metre
  roadLeft() {
    const { gateY } = this.roadSpots();
    return Math.max(0, Math.ceil((gateY - this.player.y) / TILE));
  },
  roadBlob(x, y, opts) { return this.world.walkable(x, y) ? this.spawnEnemy('blob', x, y, opts) : null; },

  updateStoryRoad(dt) {
    const S = this.road, P = this.player, { R, cx, crater, gateY } = this.roadSpots();
    const ty = P.y / TILE, V = this.view;
    const once = (id, when, fn) => { if (when && !S.done.has(id)) { S.done.add(id); fn(); } };
    if (S.done.has('arrive')) return;
    // they crawl out of the crater behind you
    once('crater', this.time > 1.5, () => {
      for (let i = 0; i < 3; i++) this.roadBlob(crater.x + rand(-14, 14), crater.y + rand(-4, 8));
      this.feed('Ink blobs are crawling out of the crater!', '#c49aff');
    });
    once('hatch', ty >= R.hatchY, () => this.hatchOnTheRoad());
    // a band of them across the road ahead
    once('ambush', ty >= R.ambushY, () => {
      const y = P.y + V.h / 2 + 56; // just past the bottom of the screen (the camera looks ahead)
      for (let i = 0; i < 7; i++) this.roadBlob(cx + (i - 3) * 22 + rand(-5, 5), y + rand(-10, 10));
      this.feed('More of them, blocking the road! Fight your way through', '#c49aff');
      Audio.play('boss');
    });
    once('sign', ty >= R.signY - 3, () => this.feed('The signpost says: Hearthvale, straight on', '#ffe9a0'));
    // a last rush: a big one blocks the road with a crowd, and a few close in from behind
    once('chase', ty >= R.chaseY, () => {
      const ahead = P.y + V.h / 2 + 40, behind = P.y - V.h / 2 + 18;
      this.roadBlob(cx, ahead + 10, { elite: true });
      for (let i = 0; i < 6; i++) this.roadBlob(cx + rand(-70, 70), ahead + rand(-14, 20));
      for (let i = 0; i < 3; i++) this.roadBlob(cx + rand(-50, 50), behind + rand(0, 12));
      this.feed('A big one blocks the road! Hearthvale is close!', '#ff8a7a');
      Audio.play('boss');
    });
    once('walls', ty >= R.gateY - 8, () => this.banner('Hearthvale!', '#ffd84a', true, 'The town gate is just ahead'));
    once('arrive', P.y >= gateY + 4, () => this.arriveHearthvale());
    // A steady trickle, never too many at once (fewer before your egg hatches): most come up the road
    // from ahead, some from the road's edges beside you, now and then one close behind (on screen)
    S.spawnT -= dt;
    if (S.spawnT <= 0) {
      const hatched = this.storyHatched;
      S.spawnT = (hatched ? 1.4 : 2.4) * rand(0.8, 1.2);
      let near = 0;
      for (const e of this.enemies) if (!e.dead && Math.abs(e.y - P.y) < V.h) near++;
      if (near < (hatched ? 10 : 5) && ty < R.gateY - 8) {
        const r = Math.random(), edge = (R.hw - 1) * TILE;
        if (r < 0.65) this.roadBlob(cx + rand(-edge, edge), P.y + V.h / 2 + rand(30, 60));
        else if (r < 0.9) this.roadBlob(cx + (Math.random() < 0.5 ? -edge : edge), P.y + rand(0, V.h / 3));
        else this.roadBlob(cx + rand(-40, 40), P.y - V.h / 2 + 14);
      }
    }
    // the ones left far behind (off screen) give up, so your shots don't fly back at them
    for (const e of this.enemies) if (!e.dead && !e.elite && !e.boss && e.y < P.y - V.h * 0.7) e.dead = true;
    // smoke still rising from the crater
    if (Math.abs(P.y - crater.y) < V.h && Math.random() < dt * 5) {
      this.particles.add({ x: crater.x + rand(-14, 14), y: crater.y - 2, vx: rand(-3, 3), vy: rand(-14, -8), life: rand(1.6, 2.6), color: Math.random() < 0.6 ? '#6a5a78' : '#9a6ab8', size: 2 });
    }
  },
  // The gate: the monsters fall back from the town's walls and you walk in
  arriveHearthvale() {
    const run = this.runId;
    Analytics.track('reached_town', { seconds: Math.round(this.time), kills: this.player.kills, level: this.player.level });
    this.clearEnemies();
    this.banner('You made it to Hearthvale!', '#9af08a', true);
    Audio.play('victory');
    setTimeout(() => { if (this.mode === 'world' && this.runId === run) this.endRun('arrived'); }, 1300);
  },
  // the crater (on the ground) and Hollis (y-sorted with the rest)
  drawStoryRoad(ctx, cam, list) {
    const { crater, hollis } = this.roadSpots(), t = this.time;
    const x = snap(crater.x - cam.x), y = snap(crater.y - cam.y);
    if (x > -60 && x < this.view.w + 60 && y > -40 && y < this.view.h + 40) {
      ctx.fillStyle = 'rgba(30,18,40,.85)'; ctx.beginPath(); ctx.ellipse(x, y, 28, 12, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(60,30,80,.9)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 20, 8, 0, 0, TAU); ctx.fill();
      const glow = 0.45 + 0.25 * Math.sin(t * 3);
      const grd = ctx.createRadialGradient(x, y + 1, 0, x, y + 1, 16);
      grd.addColorStop(0, `rgba(240,120,255,${glow})`); grd.addColorStop(1, 'rgba(140,40,200,0)');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.ellipse(x, y + 1, 16, 7, 0, 0, TAU); ctx.fill();
    }
    const img = this.roadArt?.hollis;
    if (img) {
      list.push({ y: hollis.y, draw: () => {
        const k = 0.42, hx = snap(hollis.x - cam.x), hy = snap(hollis.y - cam.y);
        ctx.fillStyle = 'rgba(20,30,10,.3)'; ctx.beginPath(); ctx.ellipse(hx, hy, 14, 3, 0, 0, TAU); ctx.fill();
        ctx.save(); ctx.translate(hx, hy - 2); ctx.rotate(-Math.PI / 2);
        ctx.drawImage(img, -img.width * k / 2, -img.height * k, img.width * k, img.height * k);
        ctx.restore();
      } });
    }
  },
};
