// What changed in each version, newest first, for the What's new page (town_ui: openNews).
// Every push to GitHub Pages raises window.SURVIVALMON_VERSION in index.html one step and adds an
// entry here, written for players. A note is either a short line (a small fix or tweak: "Fixed a bug
// when Voltowl attacked") or { h: heading, t: a short paragraph } for a bigger change.
export const CHANGELOG = [
  {
    v: '0.76', date: '20 Nov 2026',
    notes: [
      'The title screen\'s logo uses the same gold pixel font as the loading screen.',
      'The title screen fits on very small screens without cutting off the logo.',
    ],
  },
  {
    v: '0.75', date: '20 Nov 2026',
    notes: [
      { h: "What's new", t: "After every update, a What's new button shows up in town. Tap it to see what changed. You can read past updates any time from the town menu." },
    ],
  },
  {
    v: '0.74', date: '20 Nov 2026',
    notes: [
      "Bars line up on every screen now, however long a survivalmon's name is.",
      'Fixed a window sometimes opening on the side of the screen after looking at a survivalmon.',
    ],
  },
  {
    v: '0.73', date: '20 Nov 2026',
    notes: [
      { h: 'Watch your team level up', t: "At the end of a run, each survivalmon's EXP bar fills up with its share of the team's EXP. Every time the bar is full, its level pops up." },
    ],
  },
  {
    v: '0.72', date: '20 Nov 2026',
    notes: [
      { h: 'Who did what', t: 'The end-of-run screen shows how much damage your hero and each survivalmon dealt, how much they took, and how much healing they gave. A bar under each line shows who did the most damage.' },
      'A new loading screen with the poster art.',
      'The version number shows on the loading screen and in the town menu.',
    ],
  },
];

// The version that's running (index.html sets it)
export const gameVersion = () => globalThis.SURVIVALMON_VERSION || CHANGELOG[0].v;

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
