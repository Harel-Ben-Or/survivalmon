// The Survivalmon community (a Discord server: updates, feedback and bug reports): its invite link, and
// the "bug info" a player can copy into a report: the game's version, the device and how far the save
// is. Nothing in it says who the player is (no name, no profile).
import { gameVersion } from '../content/changelog.js';
import { gateName } from '../content/gates.js';
import { Meta } from './meta.js';
import { Box } from './collection.js';
import { Update } from '../core/update.js';
import { HEROES } from '../content/heroes.js';

export const COMMUNITY_URL = 'https://discord.gg/A3rxF3HQK';

// The last script error of this visit, kept so a report can quote it
let lastError = '';
const note = (msg, where = '') => { lastError = `${String(msg).slice(0, 160)}${where ? ` (${where})` : ''}`; };
window.addEventListener('error', (e) => note(e.message, e.filename ? `${e.filename.split('/').pop()}:${e.lineno}` : ''));
window.addEventListener('unhandledrejection', (e) => note(e.reason?.message || e.reason));

function device() {
  const ua = navigator.userAgent;
  const os = /Android ([\d.]+)/.exec(ua) ? `Android ${RegExp.$1}`
    : /(iPhone|iPad).*OS ([\d_]+)/.exec(ua) ? `${RegExp.$1} iOS ${RegExp.$2.replace(/_/g, '.')}`
      : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'unknown device';
  const browser = /(Edg|OPR|SamsungBrowser|Firefox|CriOS|Chrome)\/(\d+)/.exec(ua) ? `${{ Edg: 'Edge', OPR: 'Opera', SamsungBrowser: 'Samsung Internet', CriOS: 'Chrome' }[RegExp.$1] || RegExp.$1} ${RegExp.$2}`
    : /Version\/(\d+).*Safari/.exec(ua) ? `Safari ${RegExp.$1}` : 'unknown browser';
  return `${os} · ${browser}`;
}

// A few lines for a bug report (g: the game)
export function bugInfo(g) {
  const app = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone;
  const where = location.hostname.endsWith('github.io') ? 'website' : location.hostname === 'localhost' ? 'dev' : 'Claude link';
  const run = g.mode === 'world' || g.mode === 'house' ? ` · in a run: ${gateName(g.tier || 0)}, ${Math.floor(g.time / 60)}:${String(Math.floor(g.time % 60)).padStart(2, '0')}, ${g.player?.hero?.name || ''}` : '';
  return [
    `Survivalmon ${gameVersion()}${Update.label() ? ` (${Update.label()})` : ''} · ${where}${app ? ', installed app' : ''}`,
    `Device: ${device()} · screen ${innerWidth}x${innerHeight} @${+devicePixelRatio.toFixed(2)}`,
    `Save: ${Meta.data.runs || 0} runs · ${Meta.gates ? `${Meta.gates} gates opened (up to ${gateName(Meta.gates)})` : 'first gate'} · ${Box.mons.length} survivalmons · hero ${HEROES.find((h) => h.id === Meta.hero)?.name || Meta.hero}${run}`,
    `Last error: ${lastError || 'none'}`,
  ].join('\n');
}
