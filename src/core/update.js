// New versions for the installed app. The app can stay open in the background for days, so each
// time it comes back to the front it asks GitHub Pages when the site was last published (every
// file there carries the publish time). If that changed since the app started, a button at the top
// offers the new version, only in town or on the title screen, never in the middle of a run.
const LIVE = location.protocol === 'https:' && location.hostname.endsWith('github.io') && window.top === window;

async function published() {
  try {
    const r = await fetch('index.html', { method: 'HEAD', cache: 'no-store' });
    return r.ok ? r.headers.get('last-modified') : null;
  } catch { return null; } // offline
}

// "0.72 · 16 Nov, 10:14": the version number (index.html) and, on GitHub Pages, when it was published
export const appVersion = () => [window.SURVIVALMON_VERSION, Update.label()].filter(Boolean).join(' · ');

export const Update = {
  started: null, // publish time of the version that's running
  ready: false,
  btn: null,

  // "16 Nov, 10:14", for the town menu (in English, like the rest of the game)
  label() {
    if (!this.started) return '';
    const d = new Date(this.started);
    return isNaN(d) ? '' : d.toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  async init(g) {
    if (!LIVE) return;
    this.started = await published();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.check(); });
    // show the button only where leaving is safe
    setInterval(() => {
      if (!this.ready) return;
      const safe = (g.mode === 'town' || g.mode === 'title') && !g.modal;
      if (safe && !this.btn) this.show();
      else if (!safe && this.btn) { this.btn.remove(); this.btn = null; }
    }, 1000);
  },

  async check() {
    if (this.ready || !this.started) return;
    const now = await published();
    if (now && now !== this.started) this.ready = true;
  },

  show() {
    const b = this.btn = document.createElement('button');
    b.className = 'btn small update-btn';
    b.textContent = 'New version ready · Tap to update';
    b.addEventListener('click', () => location.reload());
    document.body.appendChild(b);
  },
};
