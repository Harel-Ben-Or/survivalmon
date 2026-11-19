// The story's first run (mixed into Game): out of the ruins of Brightnest and down the road to
// Hearthvale, with no clock. Things happen as you pass places on the road (world.story, STORY_ROAD in
// world.js): ink blobs crawl out of the crater, your egg hatches, more of them block the road, a
// signpost, a last chase, and the town's gate. Reaching the gate ends the run and you walk into town.
import { TILE } from './world.js';
import { storyArt } from '../ui/story.js';
import { rand, TAU } from '../core/util.js';
import { snap } from '../gfx/art.js';
import { Audio } from '../core/audio.js';

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
    // a last rush from behind, with a big one
    once('chase', ty >= R.chaseY, () => {
      const y = P.y - V.h / 2 - 24;
      for (let i = 0; i < 8; i++) this.roadBlob(cx + rand(-70, 70), y - rand(0, 40));
      this.roadBlob(cx, y - 30, { elite: true });
      this.feed('They are right behind you! Hearthvale is close!', '#ff8a7a');
    });
    once('walls', ty >= R.gateY - 14, () => this.banner('Hearthvale!', '#ffd84a', true, 'The town gate is just ahead'));
    once('arrive', P.y >= gateY + 4, () => this.arriveHearthvale());
    // a few at a time keep coming down the road behind you (fewer before your egg hatches)
    S.spawnT -= dt;
    if (S.spawnT <= 0 && !S.done.has('arrive')) {
      S.spawnT = (this.storyHatched ? 1.5 : 2.6) * rand(0.7, 1.3);
      if (this.enemies.length < 30 && ty < R.gateY - 6) this.roadBlob(cx + rand(-R.hw + 1, R.hw - 1) * TILE, P.y - V.h / 2 - rand(18, 40));
    }
    // smoke still rising from the crater
    if (Math.abs(P.y - crater.y) < V.h && Math.random() < dt * 5) {
      this.particles.add({ x: crater.x + rand(-14, 14), y: crater.y - 2, vx: rand(-3, 3), vy: rand(-14, -8), life: rand(1.6, 2.6), color: Math.random() < 0.6 ? '#6a5a78' : '#9a6ab8', size: 2 });
    }
  },
  // The gate: the monsters fall back from the town's walls and you walk in
  arriveHearthvale() {
    const run = this.runId;
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
