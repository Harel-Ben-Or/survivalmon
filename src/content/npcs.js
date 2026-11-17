// The people of the village: a keeper in every building (talk to them to use it), two who stand
// outside (the Merchant at the stall, the guard at the gate) and villagers who wander the town.
// Talk lines change as you get further: `min` is the story stage a line needs (see npcStage).
// {name} in a line is the hero's name (the main character goes by the name the player gave).
// Art: assets/sprites/npcs.png, 4 rows of 64px cells per person in NPC_IDS order: their 8 turns
// (DIR8 order), then an idle cycle facing south (keepers) or walk cycles south, north, east
// (villagers; west is east mirrored).

export const NPC_IDS = ['wren', 'hale', 'tamsin', 'sol', 'poppy', 'quill', 'dell', 'mags', 'ollie', 'tib', 'juniper', 'fen', 'barrow', 'moss'];

// home: the building they keep (their room), 'stall' / 'gate' (stands outside) or 'roam'.
// act: the button that opens the building, and the screen it opens.
export const NPCS = {
  wren: {
    name: 'Granny Wren', role: 'Hatchery keeper', home: 'hatchery', act: ['Eggs', 'showHatchery'],
    hello: 'Come in, {name}, come in. Mind the eggs, dear.',
    lines: [
      { max: 0, text: 'That egg you carried in is warm. Take it with you into the wild: eggs hatch with time spent out there.' },
      { text: 'Eggs warm up while you are out in the wild. Bring them home safe and they hatch.' },
      { text: 'Every egg carries a bit of both parents. Luck decides which skills come through.' },
      { text: 'Since the star fell, the wild ones hide. The ones that trust you are worth more than gold.' },
      { min: 2, text: 'The Blight is thick past the meadow now. Keep your little ones close.' },
      { min: 3, text: 'I have kept eggs for sixty summers. I have never seen the wild this frightened.' },
    ],
  },
  hale: {
    name: 'Coach Hale', role: 'Training Hall', home: 'training', act: ['Train', 'showTraining'],
    hello: 'Feet apart! Shoulders back! Oh, it is you, {name}.',
    lines: [
      { text: 'Feet first! A quick tamer is a living tamer.' },
      { text: 'Coins in, muscle out. Every level you train here stays with you for good.' },
      { text: 'Those dummies by the Ranch? Your mons practise on them all day long.' },
      { min: 2, text: 'You beat the Ink King? Ha! Then we train harder.' },
      { min: 4, text: 'Grimjaw fights dirty. So do I. Again!' },
    ],
  },
  tamsin: {
    name: 'Tamsin', role: 'Blacksmith', home: 'workshop', act: ['Gear', 'showWorkshop'],
    hello: 'Hot iron, {name}, mind your fingers. What do you need?',
    lines: [
      { text: 'Bring me what you find out there and I will make it sing.' },
      { text: 'Each gear slot grows on its own. Level them all and the whole set wakes up.' },
      { text: 'Iron from the crater glows at night. I do not touch it with bare hands.' },
      { min: 1, text: 'The Snare gang\'s nets are good steel. Shame what they use them for.' },
    ],
  },
  sol: {
    name: 'Keeper Sol', role: 'Spirit Shrine', home: 'shrine', act: ['Upgrades', 'showShrine'],
    hello: 'Breathe, {name}. The spirits are listening.',
    lines: [
      { text: 'What the spirits teach one survivalmon, every survivalmon learns.' },
      { text: 'Research takes time. Go out; the spirits work while you are away.' },
      { text: 'Before the Starfall, the carvings here were just old stories.' },
      { min: 3, text: 'The Blighted Elder guarded the forest once. Grieve it, then go on.' },
    ],
  },
  poppy: {
    name: 'Doc Poppy', role: 'Healer', home: 'clinic', act: ['Heal', 'showClinic'],
    hello: 'Hello, {name}! Anyone hurt? Let me have a look.',
    lines: [
      { text: 'Hurt mons rest here between runs. Resting is free; a quick fix costs coins.' },
      { text: 'Fainted is not gone. Bring them in and they will be back on their feet.' },
      { text: 'Blight scratches sting, but they wash off. Mostly.' },
      { text: 'Eat something before your next run. You look pale.' },
    ],
  },
  quill: {
    name: 'Quill', role: 'Survidex archivist', home: 'survidex', act: ['Survidex', 'showSurvidex'],
    hello: 'Ah, {name}! Have you seen anything new out there?',
    lines: [
      { text: 'One hundred and ten kinds of survivalmon, and I mean to draw every one.' },
      { text: 'Each zone has its own natives. Write down where you meet them!' },
      { text: 'A breed of two kinds is a whole new page. Bring me more pages!' },
      { text: 'The Blight never shows up in my book. It is not alive the way they are.' },
    ],
  },
  dell: {
    name: 'Dell', role: 'Rancher', home: 'ranch', act: ['Ranch', 'showRanch'],
    hello: 'Howdy, {name}! The herd is doing fine.',
    lines: [
      { text: 'The ones you leave behind stay here and train on the dummies.' },
      { text: 'Happy mons, strong mons. Mostly happy, honestly.' },
      { text: 'Want more training spots? Build up the Ranch and I will set out more dummies.' },
      { text: 'Something spooked the herd the night the star fell. They still watch the sky.' },
    ],
  },
  mags: {
    name: 'Mags', role: 'Merchant', home: 'stall', act: ['Shop', 'showMerchant'],
    hello: 'Step right up, {name}! Everything lasts one whole run!',
    lines: [
      { text: 'Snacks, tonics, horns and candles. Each lasts one run, so spend while it is hot.' },
      { text: 'I came for the falling star. I am staying for the customers.' },
      { text: 'A Lure Horn makes the wild ones come to you. Do not ask how.' },
      { text: 'No refunds on Time Candles. Time is time.' },
    ],
  },
  ollie: {
    name: 'Ollie', role: 'Gate guard', home: 'gate', act: ['Head out', 'showTeam'],
    hello: 'Halt! Oh, it is you, {name}. Heading out?',
    lines: [
      { text: 'The wild is past this gate. Pick your team, then go.' },
      { text: 'When the clock runs out, come home. Nothing good walks at the end.' },
      { min: 1, text: 'Snare raids are getting bolder. Watch out for nets.' },
      { min: 2, text: 'I heard you made it past two minutes out there. Not bad!' },
    ],
  },
  tib: {
    name: 'Tib', role: 'Village kid', home: 'roam',
    lines: [
      { text: 'When I grow up I am getting a Voltowl. A big one!' },
      { text: 'Mum says I cannot go past the gate. The Blight is out there.' },
      { text: 'Did you see the star fall? It was purple!' },
      { text: '{name}! {name}! Can I see your survivalmons? Please?' },
    ],
  },
  juniper: {
    name: 'Juniper', role: 'Flower seller', home: 'roam',
    lines: [
      { text: 'Flowers for the Hatchery! Granny Wren says the eggs like the smell.' },
      { text: 'The Blossom Glades used to be so pretty. Now there is ink in the petals.' },
      { text: 'The pond has been so quiet since the Starfall.' },
    ],
  },
  fen: {
    name: 'Old Fen', role: 'Fisherman', home: 'roam',
    lines: [
      { text: 'Fish will not bite since the Starfall. The water tastes of ink.' },
      { text: 'The Lakelands are full of Puddlits. And bogcrabs. Mind your toes.' },
      { text: 'Back in my day, stars stayed in the sky.' },
    ],
  },
  barrow: {
    name: 'Barrow', role: 'Woodcutter', home: 'roam',
    lines: [
      { text: 'Building upgrades need wood, stone, clay and iron. Never enough wood.' },
      { text: 'Bring back what you gather out there. The town grows with it.' },
      { text: 'The trees near the crater have gone black. I will not cut those.' },
    ],
  },
  moss: {
    name: 'Moss', role: 'Creature fan', home: 'roam',
    lines: [
      { text: 'Every survivalmon evolves twice, at Lv 30 and Lv 55, with a stone of its type. I have read every page!' },
      { text: 'Your team looks strong, {name}! Mine would be all Glimmoths.' },
      { text: 'Quill lets me sort the drawings in the Survidex sometimes.' },
    ],
  },
};

// How far along you are, for the talk lines: 0 no survivalmon yet, 1 has some, then 2, 3 and 4
// for runs that reached the 2:00, 4:00 and 6:00 bosses.
export function npcStage(bestTime, mons) {
  if (!mons) return 0;
  return bestTime >= 360 ? 4 : bestTime >= 240 ? 3 : bestTime >= 120 ? 2 : 1;
}

// The lines someone can say right now
export function npcLines(id, stage) {
  return NPCS[id].lines.filter((l) => (l.min ?? 0) <= stage && (l.max ?? 9) >= stage).map((l) => l.text);
}
