// Entry point.
import { Game } from './core/game.js';
import { Audio } from './core/audio.js';
import { Update } from './core/update.js';
import { Analytics } from './systems/analytics.js';
import { Meta } from './systems/meta.js';
import { Box } from './systems/collection.js';

const unlock = () => Audio.unlock();
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

const game = new Game();
window.game = game; // handy for debugging in the console
game.boot().then(() => {
  // anonymous play stats (systems/analytics.js): only on the live site, with a key, and while allowed
  Analytics.init(game.settings);
  const returning = Meta.data.runs > 0 || Box.mons.length > 0;
  Analytics.track('$pageview');
  Analytics.track('app_open', { returning, runs: Meta.data.runs || 0, mons: Box.mons.length, gates: Meta.gates || 0 });
  Analytics.person({ runs: Meta.data.runs || 0, mons: Box.mons.length, gates: Meta.gates || 0, version: globalThis.SURVIVALMON_VERSION || '' },
    { first_source: Analytics.source, first_version: globalThis.SURVIVALMON_VERSION || '', first_seen: new Date().toISOString() });
}).catch((err) => { console.error(err); window.dispatchEvent(new Event('survivalmon-error')); });
Update.init(game);

// One-tap install: Chrome offers it when the game isn't installed yet; the title screen shows the button.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__install = e;
  if (game.ui?.screen === 'title') game.ui.showTitle();
});
window.addEventListener('appinstalled', () => { window.__install = null; game.ui?.toast?.('Installed! Open Survivalmon from its new icon.'); });

// As an installed app (the https site, not inside another page), keep the game playable offline.
if ('serviceWorker' in navigator && location.protocol === 'https:' && window.top === window) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* no offline play, the game still runs */ });
}
