// Sound, all through WebAudio: effects and music made with PixelLab (assets/audio).
// Effects: assets/audio/sfx/<name>.wav (mono 32 kHz, trimmed and levelled to the same loudness; VOL sets
// each one's volume, VARY a small random pitch so frequent ones don't sound mechanical, MAX how many of
// one can ring at once). They load in the background at start; until one has (or if it fails), the old
// synthesized beep plays instead (SYNTH).
// Music: assets/audio/music/<track>.mp3, one track per place or moment (Game.updateMusic picks it):
// town, day, night, boss and final (the Night Lord). Each file is an intro that plays once and a part
// that repeats seamlessly between loopStart and loopEnd (PixelLab's make_music_loop; the file is cut
// just after loopEnd). Tracks cross-fade; one you come back to carries on where it was (bosses start
// over). A decoded track is big (~30 MB at 32 kHz), so only the playing one and the last are kept.
let ctx = null, master = null, sfxGain = null, musicGain = null;
let muted = false;
const lastPlayed = new Map();
const BASE = 'assets/audio/';

const SFX_NAMES = ['shoot', 'swing', 'hit', 'kill', 'hurt', 'gem', 'coin', 'heal', 'levelup', 'chest', 'open', 'door', 'dash',
  'explode', 'zap', 'freeze', 'fire', 'boss', 'combo', 'hatch', 'click', 'starfall', 'impact', 'gameover', 'victory'];
const VOL = {
  shoot: 0.26, hit: 0.3, kill: 0.36, gem: 0.28, swing: 0.3, click: 0.42, coin: 0.38, zap: 0.32, fire: 0.32,
  heal: 0.45, hurt: 0.6, dash: 0.4, open: 0.5, door: 0.5, freeze: 0.42, combo: 0.5,
  chest: 0.6, levelup: 0.6, hatch: 0.65, explode: 0.55, boss: 0.8, starfall: 0.75, impact: 0.85, gameover: 0.7, victory: 0.7,
};
const VARY = { shoot: 0.06, hit: 0.08, kill: 0.07, gem: 0.05, swing: 0.06, zap: 0.06, fire: 0.05, coin: 0.03, click: 0.03, hurt: 0.04, open: 0.05, dash: 0.05 };
const MAX = { shoot: 4, hit: 4, kill: 4, gem: 3, swing: 3, zap: 3, fire: 3, coin: 3 };
const TRACKS = {
  town: { loopStart: 42.794, loopEnd: 124.4333, vol: 0.8 },
  day: { loopStart: 44.931, loopEnd: 124.7939, vol: 0.85 },
  night: { loopStart: 48.112, loopEnd: 120.0938, vol: 0.9 },
  boss: { loopStart: 39.288, loopEnd: 103.8861, vol: 1, fresh: true },
  final: { loopStart: 43.746, loopEnd: 115.7716, vol: 1, fresh: true },
};
const MUSIC_VOL = 0.32;

// Decoding needs no unlocked context: an offline one turns files into buffers any context can play.
let decoder = null;
function decode(ab) {
  try {
    decoder ||= new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, 1, 32000);
    return decoder.decodeAudioData(ab);
  } catch {
    return ensure() ? ctx.decodeAudioData(ab) : Promise.reject(new Error('no audio'));
  }
}

function ensure() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
    // many effects at once (a big fight) are squeezed a little instead of clipping
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
    comp.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(comp);
    musicGain = ctx.createGain(); musicGain.gain.value = MUSIC_VOL; musicGain.connect(master);
  } catch { ctx = null; }
  return ctx;
}
// Browsers allow sound only after a tap or key: the first one anywhere unlocks it (a touch on the stick too)
for (const ev of ['pointerdown', 'pointerup', 'touchend', 'keydown']) window.addEventListener(ev, () => Audio.unlock(), { capture: true, passive: true });
// the app in the background: everything stops; back in front, it carries on
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend?.();
  else if (Audio.unlocked) ctx.resume?.();
});

// ---------------------------------------------------------------- effects
const buffers = {};
for (const name of SFX_NAMES) {
  fetch(`${BASE}sfx/${name}.wav`).then((r) => (r.ok ? r.arrayBuffer() : null)).then((ab) => ab && decode(ab))
    .then((b) => { if (b) buffers[name] = b; }).catch(() => {});
}
const voices = {};
function playBuffer(name, buf) {
  const live = (voices[name] ||= []);
  if (live.length >= (MAX[name] || 2)) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  if (VARY[name]) src.playbackRate.value = 1 + (Math.random() * 2 - 1) * VARY[name];
  const g = ctx.createGain();
  g.gain.value = VOL[name] ?? 0.5;
  src.connect(g); g.connect(sfxGain);
  live.push(src);
  src.onended = () => { const i = live.indexOf(src); if (i >= 0) live.splice(i, 1); g.disconnect(); };
  src.start();
}

// The old synthesized effects, used until a file has loaded
let noiseBuf = null;
function noise() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; return src;
}
function tone({ type = 'square', f0 = 440, f1 = f0, dur = 0.1, vol = 0.3, delay = 0, noiseMix = false }) {
  const t = ctx.currentTime + delay;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol * 0.6, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  g.connect(sfxGain);
  let src;
  if (noiseMix) {
    src = noise();
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass';
    filt.frequency.setValueAtTime(f0, t); filt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    src.connect(filt); filt.connect(g);
  } else {
    src = ctx.createOscillator(); src.type = type;
    src.frequency.setValueAtTime(f0, t);
    src.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    src.connect(g);
  }
  src.start(t); src.stop(t + dur + 0.02);
}
const SYNTH = {
  shoot: () => tone({ type: 'square', f0: 880, f1: 440, dur: 0.06, vol: 0.06 }),
  swing: () => tone({ noiseMix: true, f0: 3000, f1: 600, dur: 0.1, vol: 0.12 }),
  hit: () => tone({ type: 'square', f0: 220, f1: 110, dur: 0.05, vol: 0.07 }),
  kill: () => tone({ type: 'square', f0: 520, f1: 260, dur: 0.07, vol: 0.06 }),
  hurt: () => tone({ type: 'sawtooth', f0: 300, f1: 80, dur: 0.2, vol: 0.2 }),
  gem: () => tone({ type: 'sine', f0: 1200 + Math.random() * 300, f1: 1800, dur: 0.06, vol: 0.08 }),
  coin: () => { tone({ type: 'square', f0: 990, dur: 0.05, vol: 0.07 }); tone({ type: 'square', f0: 1320, dur: 0.1, vol: 0.07, delay: 0.05 }); },
  heal: () => tone({ type: 'sine', f0: 523, f1: 784, dur: 0.25, vol: 0.15 }),
  levelup: () => [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.12, vol: 0.12, delay: i * 0.08 })),
  chest: () => [392, 523, 659, 784, 1046].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.18, vol: 0.18, delay: i * 0.07 })),
  open: () => tone({ noiseMix: true, f0: 1200, f1: 300, dur: 0.15, vol: 0.15 }),
  door: () => { tone({ type: 'triangle', f0: 200, f1: 150, dur: 0.12, vol: 0.2 }); tone({ type: 'triangle', f0: 300, f1: 200, dur: 0.12, vol: 0.15, delay: 0.1 }); },
  dash: () => tone({ noiseMix: true, f0: 4000, f1: 800, dur: 0.15, vol: 0.12 }),
  explode: () => tone({ noiseMix: true, f0: 1500, f1: 60, dur: 0.4, vol: 0.3 }),
  zap: () => tone({ type: 'sawtooth', f0: 1800, f1: 200, dur: 0.12, vol: 0.08 }),
  freeze: () => { tone({ type: 'sine', f0: 2000, f1: 900, dur: 0.3, vol: 0.12 }); tone({ noiseMix: true, f0: 6000, f1: 2000, dur: 0.3, vol: 0.1 }); },
  fire: () => tone({ noiseMix: true, f0: 800, f1: 200, dur: 0.3, vol: 0.18 }),
  boss: () => [110, 104, 98, 92].forEach((f, i) => tone({ type: 'sawtooth', f0: f, dur: 0.35, vol: 0.2, delay: i * 0.3 })),
  combo: () => [659, 784, 988, 1318, 1568].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.1, vol: 0.12, delay: i * 0.06 })),
  hatch: () => [784, 988, 1175, 1568].forEach((f, i) => tone({ type: 'sine', f0: f, dur: 0.18, vol: 0.18, delay: i * 0.1 })),
  click: () => tone({ type: 'square', f0: 660, dur: 0.04, vol: 0.08 }),
  starfall: () => { tone({ noiseMix: true, f0: 5000, f1: 300, dur: 2.0, vol: 0.12 }); tone({ type: 'sine', f0: 900, f1: 120, dur: 2.0, vol: 0.06 }); },
  impact: () => { tone({ noiseMix: true, f0: 900, f1: 40, dur: 1.2, vol: 0.4 }); tone({ type: 'sine', f0: 90, f1: 30, dur: 1.4, vol: 0.35 }); },
  gameover: () => [392, 330, 262, 196].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.4, vol: 0.2, delay: i * 0.25 })),
  victory: () => [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.18, vol: 0.12, delay: i * 0.12 })),
};

// ---------------------------------------------------------------- music
// Blend the last 20 ms before the loop end into the 20 ms before the loop start, so the jump back is
// seamless to the sample.
function smoothLoop(buf, t) {
  const sr = buf.sampleRate, n = Math.round(0.02 * sr), e = Math.round(t.loopEnd * sr), s = Math.round(t.loopStart * sr);
  if (s < n || e > buf.length || e - n <= s) return;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) { const w = (i + 1) / n; d[e - n + i] = d[e - n + i] * (1 - w) + d[s - n + i] * w; }
  }
}
const Music = {
  want: null, cur: null, bufs: new Map(), loading: new Set(), failed: new Set(), pos: {},
  load(name) {
    if (this.loading.has(name) || this.failed.has(name)) return;
    this.loading.add(name);
    fetch(`${BASE}music/${name}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status)))).then((ab) => decode(ab))
      .then((buf) => {
        smoothLoop(buf, TRACKS[name]);
        this.bufs.set(name, buf);
        // keep only the playing track and the one wanted next
        for (const k of [...this.bufs.keys()]) if (this.bufs.size > 2 && k !== name && k !== this.cur?.name) this.bufs.delete(k);
      })
      .catch(() => this.failed.add(name))
      .finally(() => { this.loading.delete(name); this.apply(); });
  },
  // Start the wanted track (cross-fading from the last), once the sound is unlocked and it has loaded
  apply() {
    if (!ctx || ctx.state === 'closed') return;
    const name = this.want;
    if ((this.cur?.name || null) === name) return;
    if (name && !this.bufs.has(name)) { this.load(name); return; } // the last track plays on until this one is ready
    this.fade();
    if (!name) return;
    const t = TRACKS[name], buf = this.bufs.get(name);
    // re-insert so it counts as the newest
    this.bufs.delete(name); this.bufs.set(name, buf);
    const src = ctx.createBufferSource(), g = ctx.createGain(), now = ctx.currentTime;
    src.buffer = buf; src.loop = true; src.loopStart = t.loopStart; src.loopEnd = t.loopEnd;
    g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(t.vol, now + 1.2);
    src.connect(g); g.connect(musicGain);
    const offset = t.fresh ? 0 : this.pos[name] || 0;
    src.start(now, offset);
    this.cur = { name, src, g, t0: now, offset };
  },
  fade() {
    const c = this.cur;
    if (!c) return;
    this.cur = null;
    const t = TRACKS[c.name], now = ctx.currentTime;
    let p = c.offset + (now - c.t0);
    if (p > t.loopEnd) p = t.loopStart + ((p - t.loopStart) % (t.loopEnd - t.loopStart));
    this.pos[c.name] = p;
    c.g.gain.cancelScheduledValues(now);
    c.g.gain.setValueAtTime(Math.max(0.0001, c.g.gain.value), now);
    c.g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    c.src.stop(now + 1.3);
  },
};

export const Audio = {
  unlocked: false,
  // called on the first tap or key: browsers only allow sound after one
  unlock() {
    if (!ensure()) return;
    this.unlocked = true;
    if (ctx.state === 'suspended' && !document.hidden) ctx.resume();
    Music.apply();
  },
  play(name) {
    if (muted || !ensure() || ctx.state !== 'running') return;
    const now = performance.now();
    if (now - (lastPlayed.get(name) || 0) < 45) return;
    lastPlayed.set(name, now);
    if (buffers[name]) playBuffer(name, buffers[name]); else SYNTH[name]?.();
  },
  toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 1;
    return muted;
  },
  get muted() { return muted; },
  // The music for now: 'town', 'day', 'night', 'boss', 'final', or null for none (Game.updateMusic)
  music(name) {
    if (name === Music.want) return;
    Music.want = name;
    Music.apply();
  },
  get track() { return Music.cur?.name || null; },
  get loaded() { return Object.keys(buffers).length; }, // effects ready to play from their files
  // loads a track ahead of time (the next one likely needed)
  preload(name) { if (TRACKS[name] && !Music.bufs.has(name)) Music.load(name); },
};
