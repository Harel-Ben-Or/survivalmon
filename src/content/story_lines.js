// The story's lines (see the "Survivalmon Story: The Starfall" doc). {name} is your name.
// The scenes that use them are in story_scenes.js: people walk up to you on the map and talk in
// speech bubbles. who: an NPC id (npcs.js), a friend's hero id, or 'you'.

// Your first time at Hearthvale: you arrive with a survivalmon, and the town is afraid of it.
export const GATE_LINES = {
  ollie: 'Halt! What is that thing beside you? A survivalmon? Keep that beast away from our gate!',
  juniper: 'A star fell last night, and now this! It must have come down with it!',
  barrow: 'Send it back to the wild where it belongs!',
  tib: 'Is it going to eat us?!',
  you: 'Please. Brightnest is gone. Hollis sent me. I have to find Granny Wren.',
  fen: 'Brightnest? The rangers\' village? ...Gone?',
  wren1: 'Hollis? ...Let me through. Let me through, I said.',
  wren2: 'Ollie, put that spear down. I will vouch for this one, and for the little one too.',
  ollie2: '...As you say, Granny Wren.',
  wren3: 'Hollis was my student, a long time ago. If he sent you, you stay with us. Come and find me at the Hatchery, {name}.',
  moss: 'Wow, a real survivalmon! Can I pet it? I\'m Moss! Granny Wren says I can show you round!',
};

// A friend found past each gate (the first win at its Lv 1): out in the wild, right after the Night
// Lord falls, they run up to you. [who, text]; 'friend' is the friend.
export const FRIEND_REUNION = {
  rowanf: [
    ['friend', '{name}?! It\'s really you!'],
    ['you', 'Rowan! You\'re alive!'],
    ['friend', 'When the star fell we were all asleep in the tents. We split up, so at least one of us would get away.'],
    ['friend', 'I don\'t know where the others ran. But you came looking. Let\'s find them, together.'],
  ],
  bram: [
    ['friend', 'Took you long enough! I\'ve been holding this road with a spear and a bad mood.'],
    ['you', 'Bram! Rowan made it too. He\'s safe in Hearthvale.'],
    ['friend', 'Good. Then Lyra and Pip are still out there. Let\'s go get them.'],
  ],
  lyra: [
    ['friend', 'Don\'t look at me like that, I\'m fine! Mostly. My wand kept them back.'],
    ['you', 'Lyra! We\'ve been looking everywhere for you.'],
    ['friend', 'The creatures keep coming from the west. Whatever the star left behind, it\'s out there.'],
  ],
  pip: [
    ['friend', 'You found me! I\'ve been looking after the freed mons out here. They\'re scared, but they\'re good.'],
    ['you', 'Pip! That\'s all five of us.'],
    ['friend', 'All five! Then let\'s see what waits at the end of the west road.'],
  ],
};
// Then, back at the gate, the town meets them
export const FRIEND_TOWN = {
  guard: 'Another one from Brightnest? ...Welcome to Hearthvale, ranger.',
  tib: 'Another ranger!! Is it true you all grew up with survivalmons?',
  rowanf: 'So this is Hearthvale. Taller walls than I thought.',
  bram: 'Nice wall. I\'d still rather have a good spear.',
  lyra: 'Hearthvale! I always wanted to see the town. Under nicer circumstances, though.',
  pip: 'So many freed mons here already! You\'ve been busy, {name}.',
};

// After the West Gate Lv 4: the Scar (the pictures play first, in story.js), then Wren in town
export const ENDING_TALK = [
  { who: 'wren', text: 'So there is no stopping them. Then we do what the rangers always did: we survive.' },
  { who: 'wren', text: 'Together, with the mons. Hollis would be proud of you, {name}. Now rest. The wild will still be there tomorrow.' },
];

// Kept for the old talk-box version of the gate scene (and anything still asking for it)
export const GATE_SCENE = [
  { who: 'ollie', text: GATE_LINES.ollie },
  { who: 'crowd', face: 'juniper', text: GATE_LINES.juniper },
  { who: 'crowd', face: 'barrow', text: GATE_LINES.barrow },
  { who: 'you', text: GATE_LINES.you },
  { who: 'wren', text: GATE_LINES.wren2 },
  { who: 'wren', text: GATE_LINES.wren3 },
];
export const FRIEND_SCENES = Object.fromEntries(Object.entries(FRIEND_REUNION).map(([id, lines]) => [id, lines.map(([who, text]) => ({ who: who === 'friend' ? id : who, text }))]));
