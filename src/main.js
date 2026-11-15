// Entry point.
import { Game } from './core/game.js';
import { Audio } from './core/audio.js';

const unlock = () => Audio.unlock();
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

const game = new Game();
window.game = game; // handy for debugging in the console
game.boot();

// As an installed app (the https site, not inside another page), keep the game playable offline.
if ('serviceWorker' in navigator && location.protocol === 'https:' && window.top === window) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* no offline play, the game still runs */ });
}
