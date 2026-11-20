// Anonymous play stats for the game's maker, sent to PostHog (posthog.com): how many people open the
// game (and from where: the poster's QR code adds ?src=poster), how far they get (the opening, the first
// hatch, Hearthvale, the gates), how runs go and where people stop.
// What is sent: a random id for this device (never a name or a save), the game's own events with a few
// numbers each, the version, and a little about the screen (phone or not, size, installed app or not).
// PostHog works out the country from the connection.
// Nothing is sent: without a key (POSTHOG_KEY), anywhere but the live site (so not on localhost or the
// Claude link), or when the player turns "Share play stats" off in the town menu.
// Events are queued and sent in small batches every few seconds, and the rest when the page is hidden.

// The PostHog project's token ("phc_..."; public, it can only send events) and its region's ingestion
// host come from the page's settings (window.SURVIVALMON_STATS in index.html). Without them: no stats.
export const POSTHOG_KEY = globalThis.SURVIVALMON_STATS?.key || '';
export const POSTHOG_HOST = globalThis.SURVIVALMON_STATS?.host || '';

const LIVE = /(^|\.)github\.io$/.test(location.hostname) && window.top === window;
const ID_KEY = 'survivelmon.anonId';
const rid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
const os = () => {
  const ua = navigator.userAgent;
  return /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'iOS'
    : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'Mac OS X' : /Linux/i.test(ua) ? 'Linux' : 'Other';
};

export const Analytics = {
  key: POSTHOG_KEY, host: POSTHOG_HOST,
  forceLive: false, // (for testing on localhost)
  settings: null,
  queue: [],
  timer: 0,
  id: null,
  session: rid(), // one per time the game is opened
  started: Date.now(),
  // where this visit came from: ?src=poster (the poster's QR code) or anything else put after ?src=
  source: new URLSearchParams(location.search).get('src') || (document.referrer ? 'link' : 'direct'),

  // settings: the game's saved settings (stats: false turns it off)
  init(settings) {
    this.settings = settings;
    try { this.id = localStorage.getItem(ID_KEY); if (!this.id) { this.id = rid(); localStorage.setItem(ID_KEY, this.id); } } catch { this.id = this.id || rid(); }
    // whatever is still waiting goes out when the game is put away
    addEventListener('pagehide', () => this.flush(true));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.track('app_hidden', { seconds: Math.round((Date.now() - this.started) / 1000) }); this.flush(true); }
    });
  },
  get on() { return !!this.key && !!this.host && (LIVE || this.forceLive) && this.settings?.stats !== false && !!this.id; },

  // one event: its name and a few numbers or words (never a name, a save or anything typed)
  track(event, props = {}) {
    if (!this.on) return;
    const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || !!navigator.standalone;
    this.queue.push({
      event,
      timestamp: new Date().toISOString(),
      properties: {
        distinct_id: this.id,
        $session_id: this.session,
        $current_url: location.origin + location.pathname + location.search,
        $host: location.host, $pathname: location.pathname,
        $referrer: document.referrer || '$direct',
        $os: os(), $device_type: matchMedia('(pointer: coarse)').matches ? 'Mobile' : 'Desktop',
        $screen_width: screen.width, $screen_height: screen.height,
        $lib: 'survivalmon', $lib_version: globalThis.SURVIVALMON_VERSION || '',
        version: globalThis.SURVIVALMON_VERSION || '',
        installed: standalone, source: this.source,
        ...props,
      },
    });
    if (this.queue.length >= 20) this.flush();
    else if (!this.timer) this.timer = setTimeout(() => this.flush(), 5000);
  },
  // facts about this player for PostHog's person page (how far they are), sent with an event
  person(set, setOnce) {
    if (!this.on) return;
    this.track('$set', { $set: set, ...(setOnce ? { $set_once: setOnce } : {}) });
  },

  flush(leaving = false) {
    clearTimeout(this.timer); this.timer = 0;
    if (!this.queue.length || !this.key || !this.host) return;
    const body = JSON.stringify({ api_key: this.key, batch: this.queue.splice(0) });
    const url = `${this.host}/batch/`;
    try {
      // leaving: a beacon still goes out after the page is gone (as plain text, which needs no
      // permission check from the browser; PostHog reads the JSON either way)
      if (leaving && navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))) return;
      fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: body.length < 60000 }).catch(() => {});
    } catch { /* offline or blocked: these stats are lost, the game goes on */ }
  },
};
