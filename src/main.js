// Entry point.
import { Game } from './core/game.js';
import { Audio } from './core/audio.js';
import { Update } from './core/update.js';

const unlock = () => Audio.unlock();
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

const game = new Game();
window.game = game; // handy for debugging in the console
game.boot();
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
