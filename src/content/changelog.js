// What changed in each version, newest first, for the What's new page (town_ui: openNews).
// The game went to 1.0 on 20 Nov 2026 and the list started over then. Every push to GitHub Pages
// raises window.SURVIVALMON_VERSION in index.html one step (1.0, 1.01, 1.02, ... 1.09, 1.10) and adds
// an entry here, written for players. A note is either a short line (a small fix or tweak: "Fixed a bug
// when Voltowl attacked") or { h: heading, t: a short paragraph } for a bigger change.
export const CHANGELOG = [
  // newest first, e.g.
  // { v: '1.01', date: '21 Nov 2026', notes: ['Fixed a bug when Voltowl attacked', { h: 'A new thing', t: 'A short paragraph.' }] },
];

// The version that's running (index.html sets it)
export const gameVersion = () => globalThis.SURVIVALMON_VERSION || CHANGELOG[0]?.v || '1.0';

// '0.9' < '0.72' < '0.100': compared number by number, not as decimals
export function verCmp(a, b) {
  const A = String(a || 0).split('.').map(Number), B = String(b || 0).split('.').map(Number);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const d = (A[i] || 0) - (B[i] || 0);
    if (d) return d;
  }
  return 0;
}

// The updates this player hasn't read yet (newer than the last version they saw, up to the running one)
export const unseenUpdates = (seen) => (seen ? CHANGELOG.filter((e) => verCmp(e.v, seen) > 0 && verCmp(e.v, gameVersion()) <= 0) : []);
