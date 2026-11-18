// The story's talk scenes (see the "Survivalmon Story: The Starfall" doc). {name} is your name.
// who: an NPC id (npcs.js), a hero id (your friends), 'you', or 'crowd' (townsfolk at the gate).

// Your first time at Hearthvale: you arrive with a survivalmon, and the town is afraid of it.
export const GATE_SCENE = [
  { who: 'ollie', text: 'Halt! What is that thing beside you? A survivalmon? Keep that beast away from our gate!' },
  { who: 'crowd', face: 'juniper', text: 'Creatures came down with the star last night! It must be one of them!' },
  { who: 'crowd', face: 'barrow', text: 'Send it back to the wild where it belongs!' },
  { who: 'you', text: 'Please. Brightnest is gone. Hollis sent me. I have to find Granny Wren.' },
  { who: 'wren', text: 'Hollis? ...Let me through. Ollie, open the gate. I will vouch for this one, and for the little one too.' },
  { who: 'wren', text: 'Hollis was my student, a long time ago. If he sent you, you stay with me. Come, {name}. We will talk at the Hatchery.' },
];

// A friend found past each gate (the first win at its Lv 1)
export const FRIEND_SCENES = {
  rowanf: [
    { who: 'rowanf', text: '{name}! You made it! When the star fell we were all asleep in the tents.' },
    { who: 'rowanf', text: 'We split up so at least one of us would get away. I don\'t know where the others ran.' },
    { who: 'rowanf', text: 'Let me come with you. My boomerang still comes back. (Rowan can now be picked at any gate.)' },
  ],
  bram: [
    { who: 'bram', text: 'Took you long enough! I\'ve been holding this road with a spear and a bad mood.' },
    { who: 'bram', text: 'Rowan\'s with you? Good. Then Lyra and Pip are still out there. Let\'s go. (Bram can now be picked at any gate.)' },
  ],
  lyra: [
    { who: 'lyra', text: 'Don\'t look at me like that, I\'m fine! Mostly. My wand keeps them back.' },
    { who: 'lyra', text: 'The creatures keep coming from the west. Whatever the star left behind, it\'s out there. (Lyra can now be picked at any gate.)' },
  ],
  pip: [
    { who: 'pip', text: 'You found me! I\'ve been looking after the freed mons out here. They\'re scared, but they\'re good.' },
    { who: 'pip', text: 'That\'s all five of us. Now let\'s see what waits at the end of the west road. (Pip can now be picked at any gate.)' },
  ],
};

// After the West Gate Lv 4: the Scar (the pictures play first, in story.js)
export const ENDING_TALK = [
  { who: 'wren', text: 'So there is no stopping them. Then we do what the rangers always did: we survive.' },
  { who: 'wren', text: 'Together, with the mons. Hollis would be proud of you, {name}. Now rest. The wild will still be there tomorrow.' },
];
