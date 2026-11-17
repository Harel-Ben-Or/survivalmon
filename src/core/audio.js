// Synthesized sound effects + a tiny looping chiptune, all via WebAudio.
let ctx = null, master = null, sfxGain = null, musicGain = null;
let muted = false;
const lastPlayed = new Map();

function ensure() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.55; sfxGain.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.18; musicGain.connect(master);
  } catch { ctx = null; }
  return ctx;
}

let noiseBuf = null;
function noise() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; return src;
}

function tone({ type = 'square', f0 = 440, f1 = f0, dur = 0.1, vol = 0.3, delay = 0, noiseMix = false, dest }) {
  const t = ctx.currentTime + delay;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  g.connect(dest || sfxGain);
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

const SFX = {
  shoot: () => tone({ type: 'square', f0: 880, f1: 440, dur: 0.06, vol: 0.06 }),
  swing: () => tone({ noiseMix: true, f0: 3000, f1: 600, dur: 0.1, vol: 0.12 }),
  hit: () => tone({ type: 'square', f0: 220, f1: 110, dur: 0.05, vol: 0.07 }),
  kill: () => { tone({ type: 'square', f0: 520, f1: 260, dur: 0.07, vol: 0.06 }); },
  hurt: () => { tone({ type: 'sawtooth', f0: 300, f1: 80, dur: 0.2, vol: 0.2 }); },
  gem: () => tone({ type: 'sine', f0: 1200 + Math.random() * 300, f1: 1800, dur: 0.06, vol: 0.08 }),
  coin: () => { tone({ type: 'square', f0: 990, dur: 0.05, vol: 0.07 }); tone({ type: 'square', f0: 1320, dur: 0.1, vol: 0.07, delay: 0.05 }); },
  heal: () => { tone({ type: 'sine', f0: 523, f1: 784, dur: 0.25, vol: 0.15 }); },
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
  // the opening: a star's long falling whoosh, and the boom when it lands
  starfall: () => { tone({ noiseMix: true, f0: 5000, f1: 300, dur: 2.0, vol: 0.12 }); tone({ type: 'sine', f0: 900, f1: 120, dur: 2.0, vol: 0.06 }); },
  impact: () => { tone({ noiseMix: true, f0: 900, f1: 40, dur: 1.2, vol: 0.4 }); tone({ type: 'sine', f0: 90, f1: 30, dur: 1.4, vol: 0.35 }); tone({ type: 'triangle', f0: 60, f1: 25, dur: 1.0, vol: 0.25, delay: 0.1 }); },
  gameover: () => [392, 330, 262, 196].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.4, vol: 0.2, delay: i * 0.25 })),
  victory: () => [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.18, vol: 0.12, delay: i * 0.12 })),
};

export const Audio = {
  unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
  play(name) {
    if (muted || !ensure() || ctx.state !== 'running') return;
    const now = performance.now();
    if (now - (lastPlayed.get(name) || 0) < 45) return;
    lastPlayed.set(name, now);
    SFX[name]?.();
  },
  toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  },
  get muted() { return muted; },
  startMusic() { Music.start(); },
  stopMusic() { Music.stop(); },
  setNight(n) { Music.night = n; },
};

// ---------------------------------------------------------------- music
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const Music = {
  timer: null, step: 0, next: 0, night: false,
  // C major pentatonic, cheerful village loop (16 steps per bar, 4 bars)
  bass: [48, 48, 55, 55, 45, 45, 52, 52, 41, 41, 48, 48, 43, 43, 50, 50],
  lead: [72, 0, 76, 79, 0, 76, 74, 0, 72, 0, 69, 72, 0, 74, 76, 0,
    74, 0, 72, 69, 0, 67, 69, 0, 72, 0, 74, 76, 79, 0, 76, 0,
    81, 0, 79, 76, 0, 74, 76, 0, 72, 0, 74, 72, 69, 0, 67, 0,
    69, 0, 72, 74, 0, 76, 74, 0, 72, 0, 0, 0, 67, 0, 72, 0],
  start() {
    if (!ensure() || this.timer) return;
    this.step = 0; this.next = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 50);
  },
  stop() { clearInterval(this.timer); this.timer = null; },
  schedule() {
    if (muted || ctx.state !== 'running') { this.next = ctx.currentTime + 0.1; return; }
    const spb = this.night ? 0.16 : 0.14;
    while (this.next < ctx.currentTime + 0.2) {
      const s = this.step % 64;
      const shift = this.night ? -3 : 0;
      if (s % 4 === 0) {
        const b = this.bass[Math.floor(s / 4) % 16];
        tone({ type: 'triangle', f0: NOTE(b + shift), dur: spb * 3.5, vol: 0.5, delay: this.next - ctx.currentTime, dest: musicGain });
      }
      const n = this.lead[s];
      if (n) tone({ type: this.night ? 'triangle' : 'square', f0: NOTE(n + shift), dur: spb * 1.6, vol: 0.18, delay: this.next - ctx.currentTime, dest: musicGain });
      if (s % 8 === 4) tone({ noiseMix: true, f0: 8000, f1: 3000, dur: 0.04, vol: 0.12, delay: this.next - ctx.currentTime, dest: musicGain });
      this.next += spb; this.step++;
    }
  },
};
