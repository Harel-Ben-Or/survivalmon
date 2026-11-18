// The Survidex's Monsters tab: every monster you can meet, in groups, with what it does (shown once
// you've met one) and how to beat it (shown once you've defeated one). Stats come from ENEMIES.
// Your own records (met, defeated, where, darkest gate) are kept by Box.meetFoe / Box.foeKilled.
export const FOE_GROUPS = [
  { id: 'blight', name: 'The Blight', note: 'Living black ink that crept over the land after the Starfall. It turns up everywhere.',
    ids: ['blob', 'droplet', 'inkwing', 'hound', 'spitter', 'shardooze', 'bloater'] },
  { id: 'zone', name: 'Zone monsters', note: 'The Blight made them out of each zone\'s own creatures. Each one lives in its own zone.',
    ids: ['thornling', 'bogcrab', 'sawbeetle', 'cinderimp', 'snowgolem', 'wiltsprite'] },
  { id: 'night', name: 'Night creatures', note: 'Blight that hides from the sun. They only come out after dark, and light hurts them.',
    ids: ['moonfang', 'witch'] },
  { id: 'boss', name: 'Bosses', note: 'One comes every two minutes or so of a full run. The Night Lord is the last, and the one you must defeat to win.',
    ids: ['inkking', 'elder', 'colossus', 'night_lord'] },
];
export const FOE_IDS = FOE_GROUPS.flatMap((g) => g.ids);
export const FOE_GROUP_OF = Object.fromEntries(FOE_GROUPS.flatMap((g) => g.ids.map((id) => [id, g])));

// when: when it shows up · desc: what it does · tip: how to beat it
export const FOES = {
  blob: { when: 'All day, everywhere', desc: 'A crawling blob of living ink. Half the time it bursts into two Ink Drops when it falls.', tip: 'Attacks that hit an area clean up the drops it leaves.' },
  droplet: { when: 'Wherever Ink Blobs burst', desc: 'A little splash of ink from a burst Ink Blob. Quick, but frail.', tip: 'Weak alone, dangerous in numbers: don\'t let them pile up.' },
  inkwing: { when: 'All day, often in big flocks', desc: 'An ink bat that flutters in on a wobbly path, straight over walls and water.', tip: 'Chain lightning and auras catch a whole flock at once.' },
  hound: { when: 'All day, often in packs', desc: 'Stalks you, crouches, then charges in a straight line.', tip: 'When it crouches, step aside: it can\'t turn mid-charge.' },
  spitter: { when: 'All day', desc: 'Keeps its distance and spits slow balls of ink at you.', tip: 'Close in on it, or let your shooters pick it off. Its orbs are slow enough to dodge.' },
  shardooze: { when: 'Later in a run', desc: 'A heavy ooze bristling with shards. Slow, tough, and hard to push back.', tip: 'Steady damage wears it down; don\'t let it corner you.' },
  bloater: { when: 'Later in a run, sometimes in swarms', desc: 'Swells up and bursts when it reaches you, hurting you and your survivalmons close by.', tip: 'Kill it from a distance before it gets close.' },
  thornling: { when: 'In Leafy Meadow', desc: 'Ink-soaked bramble that creeps out of the meadow grass.', tip: 'Slow: easy to lead around while your team works.' },
  bogcrab: { when: 'In the Lakelands', desc: 'Scuttles out of the shallows and charges.', tip: 'It charges in a straight line: sidestep it.' },
  sawbeetle: { when: 'In the Stony Quarry', desc: 'Charges with its spinning saw horn.', tip: 'Sidestep the charge, then hit it while it turns.' },
  cinderimp: { when: 'In the Ember Fields', desc: 'Flies about and throws fireballs from a distance.', tip: 'Shooters and lightning reach it in the air.' },
  snowgolem: { when: 'In the Windy Highlands', desc: 'Slow and tough, and barely moves when hit.', tip: 'Don\'t try to push it back: just keep hitting it.' },
  wiltsprite: { when: 'In the Blossom Glades', desc: 'A withered fairy that flings poison spores from afar.', tip: 'It\'s frail up close.' },
  poacher: { when: 'In Snare gang raids', desc: 'Throws nets that slow you down.', tip: 'Dodge sideways when it throws; a netted hero is an easy target.' },
  slinger: { when: 'In Snare gang raids', desc: 'Slings stones at you from long range.', tip: 'Close the gap: it\'s weak up close.' },
  drone: { when: 'In Snare gang raids', desc: 'Grabs a fainted survivalmon and flies off with it.', tip: 'Defeat it and the survivalmon it carries gets back on its feet.' },
  moonfang: { when: 'From dusk, in packs of 3 or 4', desc: 'A fast wolf of shadow and ink. Packs hunt once the sun goes down.', tip: 'Your lantern light slows and burns it. Lightning and Fairy attacks hit it harder.' },
  witch: { when: 'Only when it\'s properly dark (about 6:00)', desc: 'Floats at a distance and lobs globs of venom where you stand. Each leaves a pool of poison for a few seconds.', tip: 'Keep moving out of the red rings. Light hurts it: daylight, your lantern, lightning and Fairy attacks.' },
  inkking: { when: 'Around 2:00', desc: 'A huge ink slime. It leaps high and lands with a crash, spilling Ink Blobs.', tip: 'Get out from under it when it leaps.' },
  elder: { when: 'Around 4:00', desc: 'A blighted old tree. Roots burst up where you stand, and it calls Thornlings to its side.', tip: 'Keep moving: the roots strike where the red rings show.' },
  colossus: { when: 'Around 6:00', desc: 'Rock from the Night Star, given a body. Slow, huge and very hard to stop.', tip: 'Keep moving: it hits hard but turns slowly.' },
  snareboss: { when: 'Around 6:00', desc: 'The Snare gang\'s boss. Throws nets, slams the ground when you\'re close, and calls the gang.', tip: 'Get out of the red ring before it slams.' },
  night_lord: { when: 'At 7:30 of a full run', desc: 'The last boss of a full run. It fires rings of dark orbs, vanishes and reappears beside you, and calls flocks of Inkwings.', tip: 'Slip through the gaps in its orb rings. It doesn\'t leave at 8:00: defeat it to win the run.' },
};
