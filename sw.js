// Survivalmon service worker (installed app on GitHub Pages).
// Network first, so a new version of the game is used as soon as you're online; every file it
// fetches is also kept, so the game still starts with no connection once it has loaded fully.
// The game's own files are always checked with the site (GitHub Pages would otherwise let the
// phone reuse a file for 10 minutes), so a fresh start always gets the newest version.
const CACHE = 'survivalmon-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!same && !font) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await (same ? fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req));
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: same });
      if (hit) return hit;
      throw err;
    }
  })());
});
