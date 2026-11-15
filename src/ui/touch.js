// On-screen controls for phones and tablets: floating joystick + action buttons.
import { Input } from '../core/input.js';
import { Audio } from '../core/audio.js';

const RADIUS = 46;     // joystick travel in CSS px
const DEADZONE = 0.14;

export class TouchControls {
  constructor(g, root) {
    this.g = g;
    this.el = document.createElement('div');
    this.el.id = 'touch';
    this.el.className = 'hidden';
    this.el.innerHTML = `
      <div class="stick-zone"></div>
      <div class="stick idle"><div class="knob"></div></div>
      <button class="tbtn pause-btn" aria-label="Pause">II</button>
      <button class="tbtn dash-btn" aria-label="Dash"><div class="cd"></div><span>DASH</span></button>
      <button class="tbtn act-btn" aria-label="Action"><b>!</b><span class="lbl"></span></button>`;
    root.insertBefore(this.el, root.querySelector('#prompt'));
    this.zone = this.el.querySelector('.stick-zone');
    this.stick = this.el.querySelector('.stick');
    this.knob = this.el.querySelector('.knob');
    this.act = this.el.querySelector('.act-btn');
    this.actLbl = this.el.querySelector('.act-btn .lbl');
    this.dashCd = this.el.querySelector('.dash-btn .cd');
    this.pid = null;
    this.bindStick();
    this.tap(this.act, () => Input.press('KeyE'));
    this.tap(this.el.querySelector('.dash-btn'), () => Input.press('Space'));
    this.tap(this.el.querySelector('.pause-btn'), () => {
      if (this.g.mode === 'town') { if (!this.g.modal) this.g.ui.openTownMenu(); return; }
      if (this.g.modal === 'pause') this.g.ui.closePause();
      else if (!this.g.modal) this.g.ui.openPause();
    });
    this.restStick();
    window.addEventListener('resize', () => { if (this.pid === null) this.restStick(); });
  }

  tap(el, fn) {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Audio.unlock(); fn(); });
  }

  bindStick() {
    const z = this.zone;
    z.addEventListener('pointerdown', (e) => {
      if (this.pid !== null) return;
      e.preventDefault();
      Audio.unlock();
      this.pid = e.pointerId;
      try { z.setPointerCapture(e.pointerId); } catch { /* not supported */ }
      this.ox = e.clientX; this.oy = e.clientY;
      this.stick.classList.remove('idle');
      this.placeStick(this.ox, this.oy);
      this.moveKnob(e.clientX, e.clientY);
    });
    z.addEventListener('pointermove', (e) => { if (e.pointerId === this.pid) this.moveKnob(e.clientX, e.clientY); });
    const end = (e) => {
      if (e.pointerId !== this.pid) return;
      this.pid = null;
      Input.setStick(0, 0);
      this.restStick();
    };
    z.addEventListener('pointerup', end);
    z.addEventListener('pointercancel', end);
    z.addEventListener('lostpointercapture', end);
  }

  placeStick(x, y) { this.stick.style.left = `${x}px`; this.stick.style.top = `${y}px`; }
  restStick() {
    this.stick.classList.add('idle');
    this.placeStick(Math.max(90, window.innerWidth * 0.14), window.innerHeight - 110);
    this.knob.style.transform = 'translate(0px, 0px)';
  }
  moveKnob(x, y) {
    let dx = x - this.ox, dy = y - this.oy;
    const d = Math.hypot(dx, dy);
    // let the base trail the finger so you never run out of stick
    if (d > RADIUS * 1.35) {
      const k = (d - RADIUS * 1.35) / d;
      this.ox += dx * k; this.oy += dy * k;
      this.placeStick(this.ox, this.oy);
      dx = x - this.ox; dy = y - this.oy;
    }
    const len = Math.min(1, Math.hypot(dx, dy) / RADIUS);
    const a = Math.atan2(dy, dx);
    this.knob.style.transform = `translate(${Math.cos(a) * len * RADIUS}px, ${Math.sin(a) * len * RADIUS}px)`;
    if (len < DEADZONE) Input.setStick(0, 0);
    else {
      const m = Math.min(1, (len - DEADZONE) / (1 - DEADZONE) * 1.15);
      Input.setStick(Math.cos(a) * m, Math.sin(a) * m);
    }
  }

  setVisible(on) {
    this.el.classList.toggle('hidden', !on);
    this.pid = null;
    Input.setStick(0, 0);
    this.restStick();
  }
  setAction(label) {
    this.act.classList.toggle('ready', !!label);
    this.actLbl.textContent = label ? label.replace(/^Enter the Wild$/, 'Go!').replace(/^Enter /, '').replace(/ \(searched\)| · opens later$/, '') : '';
  }
  update() {
    const P = this.g.player;
    if (!P) return;
    const frac = P.dashCd > 0 ? P.dashCd / (2 * P.stats.cooldown) : 0;
    this.dashCd.style.height = `${Math.round(frac * 100)}%`;
  }
}
