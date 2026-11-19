// In-world story scenes (mixed into Game): villagers and friends walk up to you on the real map, in
// town or out in a run, and talk in speech bubbles over their heads. The game waits while one plays
// (only the town's other villagers keep wandering, and your survivalmons follow you).
//
// game.playScene(steps) runs the steps one after another and returns a promise:
//   { walk: who, to: [x, y], from, speed, run, wait: false }  walk (or run) there, from `from` if given;
//                                                        waits until there unless wait: false
//   { say: who, text }                                   a speech bubble; a tap (or E / Enter / Space) moves on
//   { wait: s }                                          a pause
//   { face: who, to: who2 | [x, y] }
//   { spawn: id, at: [x, y], dir, art: 'npc' | 'hero' }  someone who isn't on the map yet
//   { remove: who }                                      they fade out
//   { emote: who, icon: '!' }                            a mark over their head for a moment
//   { banner: text, color }
//   { run: (game) => {} }                                anything else
//   { together: true }                                   waits for every walk still going
// who: 'you', a villager's id (a town NPC, borrowed for the scene) or a spawned actor's id.
// Skip ends the scene at once: everyone spawned leaves, borrowed villagers go back to wandering.
import { NPC_ART, HERO_ART, drawNpcArt, drawHero, dir8, snap, WS } from '../gfx/art.js';
import { NPCS } from '../content/npcs.js';
import { HEROES } from '../content/heroes.js';
import { Meta } from '../systems/meta.js';
import { Audio } from '../core/audio.js';
import { TAU } from '../core/util.js';

const TYPE_SPEED = 42; // letters a second
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dir4 = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : dy > 0 ? 'south' : 'north');
const HERO_IDS = new Set(HEROES.map((h) => h.id));

export const SceneMode = {
  playScene(steps) {
    if (this.scene) this.endScene(true);
    return new Promise((resolve) => {
      this.scene = { steps: steps.filter(Boolean), i: -1, waitT: 0, block: null, resolve, borrowed: new Set(), typed: 0 };
      this.sceneActors = [];
      document.body.classList.add('in-scene');
      this.ui.prompt(null);
      this.buildSceneLayer();
      this.nextSceneStep();
    });
  },

  // ---------------------------------------------------------------- actors
  // The thing that moves for `who`: the hero, a spawned actor, or a town villager (borrowed)
  sceneActor(who) {
    if (who === 'you') return { you: true, x: this.player.x, y: this.player.y };
    let a = this.sceneActors.find((x) => x.id === who);
    if (a) return a;
    const n = this.mode === 'town' && !this.townRoom ? this.town?.npcs?.find((x) => x.id === who) : null;
    if (n) { n.scene = true; n.home0 ||= { x: n.x, y: n.y, dir: n.dir }; this.scene.borrowed.add(n); return n; }
    // not on the map: spawn them next to you
    return this.spawnSceneActor(who, [this.player.x + 40, this.player.y]);
  },
  spawnSceneActor(id, at, dir = 'south', art) {
    const hero = art ? art === 'hero' : HERO_IDS.has(id) && !NPC_ART[id];
    const a = { id, x: at[0], y: at[1], dir: hero ? dir : dir4(0, 1), hero, moving: false, seed: Math.random() * 5, alpha: 0, fadeIn: true };
    if (!hero) a.dir = ['north', 'south', 'east', 'west'].includes(dir) ? dir : 'south';
    // a villager who also wanders the town: hide that one while the scene's copy is out
    const n = this.mode === 'town' && this.town?.npcs?.find((x) => x.id === id && !x.still);
    if (n) { n.hidden = true; n.scene = true; this.scene.borrowed.add(n); }
    this.sceneActors.push(a);
    return a;
  },
  faceActor(a, tx, ty) {
    const dx = tx - a.x, dy = ty - a.y;
    if (a.you) { const P = this.player; P.faceAngle = Math.atan2(dy, dx); P.d8 = dir8(P.faceAngle); P.dir = dir4(dx, dy) === 'east' ? 'right' : dir4(dx, dy) === 'west' ? 'left' : dir4(dx, dy) === 'north' ? 'up' : 'down'; return; }
    if (a.hero) a.dir = dir8(Math.atan2(dy, dx)); else a.dir = dir4(dx, dy);
  },
  posOf(who) {
    if (Array.isArray(who)) return who;
    const a = this.sceneActor(who);
    return [a.x, a.y];
  },

  // ---------------------------------------------------------------- steps
  nextSceneStep() {
    const S = this.scene;
    if (!S) return;
    S.i++;
    S.block = null; S.waitT = 0;
    this.hideSceneBubble();
    if (S.i >= S.steps.length) { this.endScene(false); return; }
    const st = S.steps[S.i];
    if (st.spawn) {
      this.spawnSceneActor(st.spawn, st.at, st.dir, st.art);
      return this.nextSceneStep();
    }
    if (st.walk) {
      const a = this.sceneActor(st.walk);
      if (a.you) return this.nextSceneStep(); // you stay where you are; the others come to you
      if (st.from) { a.x = st.from[0]; a.y = st.from[1]; } // start somewhere else first (just off the screen)
      a.tx = st.to[0]; a.ty = st.to[1]; a.speed = st.speed || (st.run ? 78 : 42); a.walking = true;
      if (st.wait === false) return this.nextSceneStep();
      S.block = { walk: a };
      return;
    }
    if (st.together) { S.block = { all: true }; return; }
    if (st.say) {
      const a = this.sceneActor(st.say);
      // the one talking turns to you, and you turn to them
      if (!a.you) { this.faceActor(a, this.player.x, this.player.y); this.faceActor(this.sceneActor('you'), a.x, a.y); }
      S.block = { say: a, text: st.text.replaceAll('{name}', Meta.playerName), who: st.say };
      S.typed = 0;
      this.showSceneBubble(st.say, S.block.text);
      Audio.play('click');
      return;
    }
    if (st.face) {
      const a = this.sceneActor(st.face), [x, y] = this.posOf(st.to);
      this.faceActor(a, x, y);
      return this.nextSceneStep();
    }
    if (st.remove) {
      const a = this.sceneActors.find((x) => x.id === st.remove);
      if (a) a.fadeOut = true;
      return this.nextSceneStep();
    }
    if (st.emote) {
      const a = this.sceneActor(st.emote);
      a.emote = { icon: st.icon || '!', t: 1.1 };
      return this.nextSceneStep();
    }
    if (st.banner) { this.banner(st.banner, st.color || '#ffd84a', true, st.sub || ''); return this.nextSceneStep(); }
    if (st.run) { st.run(this); return this.nextSceneStep(); }
    if (st.wait != null) { S.waitT = st.wait; S.block = { wait: true }; return; }
    this.nextSceneStep();
  },
  // a tap or a key: finish the words, then move on
  sceneTap() {
    const S = this.scene;
    if (!S?.block?.say) return;
    if (S.typed < S.block.text.length) { S.typed = S.block.text.length; return; }
    this.nextSceneStep();
  },
  endScene(skipped) {
    const S = this.scene;
    if (!S) return;
    this.scene = null;
    // spawned actors leave, borrowed villagers go back to wandering
    this.sceneActors = [];
    for (const n of S.borrowed) {
      n.scene = false; n.hidden = false; n.walking = false; n.moving = false; n.emote = null; n.wait = 0.5 + Math.random() * 2;
      if (n.still && n.home0) { n.x = n.home0.x; n.y = n.home0.y; n.dir = n.face || n.home0.dir; } // a guard goes back to the post
      else { n.tx = n.x; n.ty = n.y; }
      delete n.home0;
    }
    if (skipped) for (const st of S.steps.slice(S.i + 1)) if (st.run && st.always) st.run(this);
    document.body.classList.remove('in-scene');
    this.sceneLayer?.remove(); this.sceneLayer = null;
    window.removeEventListener('keydown', this.sceneKey, true);
    S.resolve(skipped);
  },

  // ---------------------------------------------------------------- update (Game.update calls this while a scene plays)
  updateScene(dt) {
    const S = this.scene, P = this.player;
    const movers = [...this.sceneActors, ...S.borrowed];
    for (const a of movers) {
      if (a.fadeIn) { a.alpha = Math.min(1, (a.alpha || 0) + dt * 3); if (a.alpha >= 1) a.fadeIn = false; }
      if (a.fadeOut) { a.alpha = Math.max(0, (a.alpha ?? 1) - dt * 2.5); }
      if (a.emote) { a.emote.t -= dt; if (a.emote.t <= 0) a.emote = null; }
      if (!a.walking) { a.moving = false; continue; }
      const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
      if (d < 1) { a.x = a.tx; a.y = a.ty; a.walking = false; a.moving = false; this.faceActor(a, P.x, P.y); continue; }
      const step = Math.min(a.speed * dt, d);
      a.x += (dx / d) * step; a.y += (dy / d) * step; a.moving = true;
      if (a.hero) a.dir = dir8(Math.atan2(dy, dx)); else a.dir = dir4(dx, dy);
    }
    this.sceneActors = this.sceneActors.filter((a) => !(a.fadeOut && a.alpha <= 0));
    // what the step waits for
    const b = S.block;
    if (b?.walk && !b.walk.walking) this.nextSceneStep();
    else if (b?.all && !movers.some((a) => a.walking)) this.nextSceneStep();
    else if (b?.wait && (S.waitT -= dt) <= 0) this.nextSceneStep();
    else if (b?.say) {
      S.typed = Math.min(b.text.length, S.typed + dt * TYPE_SPEED);
      this.placeSceneBubble(b.say, Math.floor(S.typed));
    }
    // the rest of the world goes on quietly around you
    P.moving = false;
    P.anim = (P.anim || 0) + dt * 2;
    P.pets.forEach((p, i) => p.update(dt, i, true));
    if (this.mode === 'town' && !this.townRoom) {
      this.town.updateRanch(dt, this);
      this.town.updateVillagers(dt, { x: -1e4, y: -1e4 });
    }
    this.updateEffects(dt);
    this.particles.update(dt);
    this.followCamera(dt);
  },

  // ---------------------------------------------------------------- drawing (renderTown / renderWorld add these to their y-sorted lists)
  drawSceneActor(ctx, a, cam, now) {
    const x = snap(a.x) - cam.x, y = snap(a.y) - cam.y;
    ctx.globalAlpha = 0.28 * (a.alpha ?? 1); ctx.fillStyle = '#1a2a10';
    ctx.beginPath(); ctx.ellipse(x, y, 7, 2.5, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = a.alpha ?? 1;
    if (a.hero) {
      const art = HERO_ART[a.id];
      if (art) drawHero(ctx, art, x, y, a.dir, a.moving ? { walk: (now + a.seed) * (a.speed > 60 ? 12 : 8) } : {});
    } else {
      const art = NPC_ART[a.id];
      if (art) drawNpcArt(ctx, art, x, y, a.dir, now + a.seed, a.moving);
    }
    ctx.globalAlpha = 1;
    this.drawSceneEmote(ctx, a, cam);
  },
  drawSceneEmote(ctx, a, cam) {
    if (!a.emote) return;
    const x = snap(a.x) - cam.x, y = snap(a.y) - cam.y - 40 - Math.max(0, Math.sin((1.1 - a.emote.t) * 9)) * 3;
    ctx.fillStyle = '#2b1d24'; ctx.fillRect(x - 4, y - 9, 9, 11);
    ctx.fillStyle = '#ffd84a'; ctx.fillRect(x - 3, y - 8, 7, 9);
    ctx.fillStyle = '#2b1d24'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(a.emote.icon, x + 0.5, y - 3);
  },
  // the borrowed villagers who are hidden while their spawned copy is out
  sceneHides(n) { return !!n.hidden; },

  // ---------------------------------------------------------------- the speech bubble
  buildSceneLayer() {
    this.sceneLayer?.remove();
    const el = this.sceneLayer = document.createElement('div');
    el.className = 'scene-layer';
    el.innerHTML = `<div class="scene-say hidden"><b class="scene-who"></b><p></p><span class="scene-next">▶</span></div>
      <button class="btn small secondary scene-skip">Skip ▸▸</button>`;
    this.ui.root.appendChild(el);
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      Audio.unlock();
      if (e.target.closest('.scene-skip')) { this.endScene(true); return; }
      this.sceneTap();
    });
    this.sceneKey = (e) => {
      if (!this.scene) return;
      if (['KeyE', 'Enter', 'Space', 'NumpadEnter'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); this.sceneTap(); }
      else if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); this.endScene(true); }
    };
    window.addEventListener('keydown', this.sceneKey, true);
  },
  sceneName(who) {
    if (who === 'you') return Meta.playerName;
    if (NPCS[who]) return NPCS[who].name;
    return HEROES.find((h) => h.id === who)?.name || who;
  },
  showSceneBubble(who, text) {
    const el = this.sceneLayer?.querySelector('.scene-say');
    if (!el) return;
    el.querySelector('.scene-who').textContent = this.sceneName(who);
    el.classList.toggle('you', who === 'you');
    el.querySelector('p').textContent = '';
    el.dataset.n = '';
    el.classList.remove('hidden', 'ready');
  },
  hideSceneBubble() { this.sceneLayer?.querySelector('.scene-say')?.classList.add('hidden'); },
  placeSceneBubble(a, n) {
    const el = this.sceneLayer?.querySelector('.scene-say');
    if (!el) return;
    const b = this.scene.block;
    if (el.dataset.n !== String(n)) { el.querySelector('p').textContent = b.text.slice(0, n); el.dataset.n = String(n); }
    el.classList.toggle('ready', n >= b.text.length);
    // over the speaker's head, kept on the screen
    const x = a.you ? this.player.x : a.x, y = a.you ? this.player.y : a.y;
    const p = this.worldToScreen(x, y - 38), W = this.ui.root.clientWidth, H = this.ui.root.clientHeight;
    const w = el.offsetWidth, h = el.offsetHeight;
    let left = Math.round(p.x - w / 2), top = Math.round(p.y - h - 6);
    left = Math.max(8, Math.min(W - w - 8, left));
    if (top < 8) top = Math.round(this.worldToScreen(x, y + 8).y + 6); // no room above: under them instead
    top = Math.max(8, Math.min(H - h - 8, top));
    el.style.left = `${left}px`; el.style.top = `${top}px`;
    // the little tail points at the speaker
    el.style.setProperty('--tail', `${Math.max(14, Math.min(w - 14, p.x - left))}px`);
    el.classList.toggle('below', top > p.y);
  },
};
