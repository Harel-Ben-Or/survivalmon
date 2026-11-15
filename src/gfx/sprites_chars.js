// Procedural pixel art: playable heroes and pet critters.
import { PixelCanvas, mk, drawScaled, recolor } from './pixel.js';
import { shade } from '../core/util.js';

export const OUT = '#2b1d24';

export const HERO_LOOKS = {
  rowan: {
    skin: '#f5c99b', hair: '#6b3e26', hairDark: '#4a2a1a', hairStyle: 'short',
    hat: 'cowboy', hatC: '#b06a32', hatD: '#7a4420', band: '#4a2a1a',
    shirt: '#d8473b', shirtD: '#a8322b', vest: '#8a5a32',
    pants: '#3d5aa8', pantsD: '#2c4180', shoes: '#5a3a24', belt: '#4a2a1a',
  },
  bram: {
    skin: '#e0a874', hair: '#d0632a', hairDark: '#a04a1e', hairStyle: 'short',
    hat: 'straw', hatC: '#f2d06b', hatD: '#c9a13f', band: '#c8453a',
    shirt: '#f3eedc', shirtD: '#cfc6a8', overalls: '#4c7fbf', overallsD: '#365e94',
    pants: '#4c7fbf', pantsD: '#365e94', shoes: '#6b4426',
  },
  lyra: {
    skin: '#f8d3b0', hair: '#f2a6c8', hairDark: '#c97aa0', hairStyle: 'long',
    hat: 'wizard', hatC: '#6c4bc4', hatD: '#4a3191', band: '#f4d35e',
    robe: true, shirt: '#6c4bc4', shirtD: '#4a3191', trim: '#f4d35e',
    pants: '#4a3191', pantsD: '#3a2577', shoes: '#3a2a5a',
  },
  pip: {
    skin: '#f5c99b', hair: '#f4d35e', hairDark: '#d1a93a', hairStyle: 'spiky',
    hat: 'beanie', hatC: '#ef8a3a', hatD: '#c4642a', band: '#c4642a',
    shirt: '#2fa39a', shirtD: '#21786f', backpack: '#c8453a',
    pants: '#8a6a44', pantsD: '#6b5032', shoes: '#4a3a2a',
  },
};

function inHead(x, y, by) {
  const dx = (x + 0.5 - 9) / 5.3, dy = (y + 0.5 - (8 + by)) / 4.7;
  return dx * dx + dy * dy <= 1;
}

// dir: 'down' | 'up' | 'side' (facing right). frame 0..3
export function drawHero(s, dir, frame) {
  const p = new PixelCanvas(18, 24);
  const side = dir === 'side', back = dir === 'up';
  const step = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  const by = step !== 0 ? -1 : 0;
  const skinD = shade(s.skin, -0.16);

  // Long hair falls behind the shoulders
  if (s.hairStyle === 'long') {
    if (side) p.rect(4, 9 + by, 5, 7, s.hairDark);
    else p.rect(4, 9 + by, 10, back ? 8 : 6, s.hairDark);
  }
  // Backpack (behind body in side/front, on top when seen from the back)
  if (s.backpack && side) { p.rect(4, 13 + by, 3, 5, s.backpack); p.rect(4, 13 + by, 3, 1, shade(s.backpack, -0.25)); }

  // ---- Legs & shoes
  if (s.robe) {
    for (let y = 13; y <= 20; y++) {
      const wgrow = y >= 16 ? 1 : 0;
      const x0 = side ? 7 - wgrow : 6 - wgrow, x1 = side ? 11 + wgrow : 11 + wgrow;
      for (let x = x0; x <= x1; x++) p.set(x, y + (y < 18 ? by : 0), x === x1 ? s.shirtD : s.shirt);
    }
    p.rect(side ? 6 : 5, 20, side ? 7 : 8, 1, s.trim);
    if (!side) {
      p.rect(6, 21 + (step === 1 ? -1 : 0), 3, 2, s.shoes);
      p.rect(9, 21 + (step === -1 ? -1 : 0), 3, 2, s.shoes);
    } else {
      if (step === 0) p.rect(8, 21, 4, 2, s.shoes);
      else { p.rect(10, 21, 3, 2, s.shoes); p.rect(6, 21, 3, 2, shade(s.shoes, -0.2)); }
    }
  } else if (!side) {
    const lL = step === 1 ? -1 : 0, rL = step === -1 ? -1 : 0;
    p.rect(6, 18 + by, 3, 3 - by + lL, s.pants); p.rect(8, 18 + by, 1, 3 - by + lL, s.pantsD);
    p.rect(9, 18 + by, 3, 3 - by + rL, s.pants); p.rect(9, 18 + by, 1, 3 - by + rL, s.pantsD);
    p.rect(6, 21 + lL, 3, 2, s.shoes);
    p.rect(9, 21 + rL, 3, 2, s.shoes);
  } else {
    if (step === 0) {
      p.rect(8, 18 + by, 3, 3 - by, s.pants); p.rect(8, 18 + by, 1, 3 - by, s.pantsD);
      p.rect(8, 21, 4, 2, s.shoes);
    } else {
      const farC = s.pantsD;
      // back leg
      p.rect(6, 18 + by, 2, 3 - by, step === 1 ? farC : s.pants);
      p.rect(5, 21, 3, 2, shade(s.shoes, step === 1 ? -0.25 : 0));
      // front leg
      p.rect(10, 18 + by, 2, 3 - by, step === 1 ? s.pants : farC);
      p.rect(10, 21, 3, 2, shade(s.shoes, step === 1 ? 0 : -0.25));
    }
  }

  // ---- Torso
  if (!s.robe) {
    const tx0 = side ? 7 : 6, tx1 = 11;
    for (let y = 13; y <= 17; y++) for (let x = tx0; x <= tx1; x++)
      p.set(x, y + by, x === tx1 || (side && x === tx0) ? s.shirtD : s.shirt);
    if (s.vest && !back) {
      if (side) p.rect(9, 13 + by, 3, 4, s.vest);
      else { p.rect(6, 13 + by, 2, 4, s.vest); p.rect(10, 13 + by, 2, 4, s.vest); }
    }
    if (s.vest && back) p.rect(6, 13 + by, 6, 4, s.vest);
    if (s.overalls) {
      p.rect(tx0, 15 + by, tx1 - tx0 + 1, 3, s.overalls);
      p.set(tx1, 15 + by, s.overallsD); p.set(tx1, 16 + by, s.overallsD); p.set(tx1, 17 + by, s.overallsD);
      if (!side) { p.rect(7, 13 + by, 1, 2, s.overalls); p.rect(10, 13 + by, 1, 2, s.overalls); }
      else p.rect(9, 13 + by, 1, 2, s.overalls);
    }
    if (s.belt) p.rect(tx0, 17 + by, tx1 - tx0 + 1, 1, s.belt);
    if (s.backpack && back) {
      p.rect(6, 13 + by, 6, 5, s.backpack); p.rect(6, 13 + by, 6, 1, shade(s.backpack, -0.25));
      p.rect(8, 15 + by, 2, 1, '#f4d35e');
    }
    if (s.backpack && !back && !side) { p.rect(7, 13 + by, 1, 3, shade(s.backpack, -0.2)); p.rect(10, 13 + by, 1, 3, shade(s.backpack, -0.2)); }
  } else if (s.trim && !back) {
    if (!side) p.rect(9, 13 + by, 1, 5, s.trim); else p.rect(11, 13 + by, 1, 5, s.trim);
  }

  // ---- Arms
  const sleeve = s.robe ? s.shirt : s.shirt;
  if (!side) {
    const aL = step === -1 ? -1 : 0, aR = step === 1 ? -1 : 0;
    p.rect(5, 13 + by + aL, 1, 3, sleeve); p.set(5, 16 + by + aL, s.skin);
    p.rect(12, 13 + by + aR, 1, 3, shade(sleeve, -0.2)); p.set(12, 16 + by + aR, skinD);
  } else {
    const armC = shade(sleeve, -0.22);
    if (step === 0) { p.rect(9, 13 + by, 2, 3, armC); p.rect(9, 16 + by, 2, 1, s.skin); }
    else if (step === 1) { p.rect(10, 13 + by, 2, 3, armC); p.rect(11, 16 + by, 2, 1, s.skin); }
    else { p.rect(8, 13 + by, 2, 3, armC); p.rect(7, 16 + by, 2, 1, s.skin); }
  }

  // ---- Head
  for (let y = 2; y < 14; y++) for (let x = 3; x < 15; x++) {
    if (!inHead(x, y, by)) continue;
    let c = s.skin;
    if (back) c = s.hair;
    else if (side) {
      if (y < 7 + by || (x < 9 && y < 12 + by) || (x === 9 && y < 9 + by)) c = s.hair;
    } else {
      if (y < 7 + by || ((x < 5 || x > 12) && y < 11 + by)) c = s.hair;
    }
    if (c === s.hair && y >= 11 + by) c = s.hairDark;
    p.set(x, y, c);
  }
  // fringe + spikes
  if (!back) {
    if (side) { p.set(12, 7 + by, s.hair); p.set(13, 7 + by, s.hair); p.set(11, 7 + by, s.hairDark); }
    else { p.set(6, 7 + by, s.hair); p.set(8, 7 + by, s.hair); p.set(11, 7 + by, s.hair); }
  }
  if (s.hairStyle === 'spiky') {
    p.set(4, 8 + by, s.hair); p.set(13, 8 + by, s.hair);
    if (!back) { p.set(3, 9 + by, s.hair); p.set(14, 9 + by, s.hair); }
  }
  if (s.hairStyle === 'long' && !back) {
    if (!side) { p.rect(4, 7 + by, 1, 6, s.hair); p.rect(13, 7 + by, 1, 6, s.hair); }
  }

  // ---- Face
  if (!back) {
    if (!side) {
      p.rect(7, 9 + by, 1, 2, OUT); p.rect(10, 9 + by, 1, 2, OUT);
      p.set(6, 11 + by, '#f08a8a'); p.set(11, 11 + by, '#f08a8a');
      p.set(5, 8 + by, skinD); p.set(12, 8 + by, skinD);
    } else {
      p.rect(12, 9 + by, 1, 2, OUT);
      p.set(13, 11 + by, '#f08a8a');
      p.set(9, 9 + by, skinD); p.set(9, 10 + by, skinD);
    }
  }

  // ---- Hats
  if (s.hat === 'cowboy') {
    for (let y = 0; y < 9; y++) for (let x = 0; x < 18; x++) {
      const dx = (x + 0.5 - 9) / 7.6, dy = (y + 0.5 - (6 + by)) / 1.5;
      if (dx * dx + dy * dy <= 1) p.set(x, y, y >= 6 + by ? s.hatD : s.hatC);
    }
    const cx0 = side ? 5 : 5, cx1 = side ? 12 : 12;
    for (let y = 1 + by; y <= 5 + by; y++) for (let x = cx0; x <= cx1; x++) {
      if (y === 1 + by && (x === cx0 || x === cx1)) continue;
      p.set(x, y, x === cx1 ? s.hatD : s.hatC);
    }
    if (!side) { p.set(8, 1 + by, s.hatD); p.set(9, 1 + by, s.hatD); }
    p.rect(cx0, 4 + by, cx1 - cx0 + 1, 1, s.band);
  } else if (s.hat === 'straw') {
    for (let y = 0; y < 9; y++) for (let x = 0; x < 18; x++) {
      const dx = (x + 0.5 - 9) / 8, dy = (y + 0.5 - (6 + by)) / 1.6;
      if (dx * dx + dy * dy <= 1) p.set(x, y, (x + y) % 3 === 0 ? s.hatD : s.hatC);
    }
    p.ellipse(9, 4 + by, 4.2, 2.8, s.hatC);
    p.paint((x, y) => (y <= 6 + by && y >= 1 + by && x >= 5 && x <= 13 && (x * 7 + y) % 5 === 0 ? s.hatD : null));
    p.rect(5, 5 + by, 8, 1, s.band);
  } else if (s.hat === 'wizard') {
    for (let y = 0; y < 9; y++) for (let x = 0; x < 18; x++) {
      const dx = (x + 0.5 - 9) / 7.2, dy = (y + 0.5 - (6.2 + by)) / 1.4;
      if (dx * dx + dy * dy <= 1) p.set(x, y, y >= 6 + by ? s.hatD : s.hatC);
    }
    // cone leaning right
    for (let y = 0; y <= 5; y++) {
      const half = 1 + y * 0.75;
      const cxx = 10.5 - y * 0.35;
      for (let x = Math.floor(cxx - half); x <= Math.ceil(cxx + half); x++) {
        if (x + 0.5 >= cxx - half && x + 0.5 <= cxx + half) p.set(x, y + by, x + 0.5 > cxx + half * 0.4 ? s.hatD : s.hatC);
      }
    }
    p.rect(5, 5 + by, 8, 1, s.band);
    if (!back) p.set(side ? 10 : 8, 3 + by, s.band);
  } else if (s.hat === 'beanie') {
    for (let y = 1; y < 8; y++) for (let x = 3; x < 15; x++) {
      const dx = (x + 0.5 - 9) / 5.6, dy = (y + 0.5 - (6 + by)) / 3.6;
      if (dx * dx + dy * dy <= 1 && y <= 7 + by) p.set(x, y, s.hatC);
    }
    p.rect(4, 6 + by, 10, 2, s.band);
    p.circle(9, 2 + by, 1.6, '#f3eedc');
    p.paint((x, y) => (y >= 3 + by && y <= 5 + by && x % 2 === 0 && p.get(x, y) === p.get(9, 4 + by) ? shade(s.hatC, -0.08) : null));
  }

  p.outline(OUT);
  return p;
}

export function buildHeroSprite(id) {
  const s = HERO_LOOKS[id];
  const dirs = {};
  for (const d of ['down', 'up', 'side']) dirs[d] = [0, 1, 2, 3].map((f) => drawHero(s, d, f));
  const toC = (arr) => arr.map((f) => f.toCanvas());
  const toF = (arr) => arr.map((f) => f.silhouette('#ffffff').toCanvas());
  return {
    w: 18, h: 24, ax: 9, ay: 22,
    dirs: {
      down: toC(dirs.down), up: toC(dirs.up), right: toC(dirs.side),
      left: toC(dirs.side.map((f) => f.flipX())),
    },
    flash: {
      down: toF(dirs.down), up: toF(dirs.up), right: toF(dirs.side),
      left: toF(dirs.side.map((f) => f.flipX())),
    },
    portrait: dirs.down[0],
  };
}

// ---------------------------------------------------------------- Pets
// All pets face right; flip for left. 2-frame hop/flap.
function petEmberpup(f) {
  const p = mk(20, 18);
  const b = f ? -1 : 0;
  const O = '#f08a3c', D = '#c8602a', C = '#fbe3b8';
  // flame tail
  p.circle(4, 9 + b, 2.6, '#e0483e'); p.circle(3.5, 7.5 + b, 1.9, '#f6a03a'); p.circle(3.5, 6 + b, 1.2, '#ffe07a');
  p.ellipse(9, 12 + b, 5, 3.5, O);
  p.ellipse(9, 13 + b, 3, 1.6, C);
  // legs
  const l = f ? 0 : 1;
  p.rect(6, 15, 2, 2 - (f ? 1 : 0), D); p.rect(11, 15, 2, 2 - l, D);
  p.circle(13, 8 + b, 4.2, O);
  p.tri(10, 5 + b, 11.5, 1 + b, 13, 5 + b, D);
  p.tri(13.5, 5 + b, 15.5, 1.5 + b, 16, 6 + b, D);
  p.ellipse(16, 9.5 + b, 2.2, 1.6, C);
  p.set(17, 9 + b, '#2b1d24');
  p.rect(14, 7 + b, 1, 2, '#2b1d24'); p.set(14, 7 + b, '#ffffff');
  p.set(13, 10 + b, '#f07a6a');
  p.outline(OUT);
  return p;
}
function petLeafkit(f) {
  const p = mk(20, 18);
  const b = f ? -1 : 0;
  const G = '#8fd16a', D = '#5aa83f', L = '#c9f0a8';
  p.ellipse(8, 3.5 + b, 1.6, 3.5, '#4fa34a'); p.set(8, 3 + b, L); p.set(8, 5 + b, L);
  p.ellipse(12, 3 + b, 1.6, 3.8, '#4fa34a'); p.set(12, 2 + b, L); p.set(12, 4 + b, L);
  p.circle(4, 11 + b, 2, '#f3eedc');
  p.ellipse(10, 11 + b, 6, 4.6, G);
  p.ellipse(9, 13 + b, 4, 2, L);
  p.paint((x, y) => (y >= 13 + b && x > 12 && p.get(x, y) === p.get(10, 11 + b) ? D : null));
  p.rect(7, 15, 2, 2 - (f ? 1 : 0), D); p.rect(12, 15, 2, 2 - (f ? 0 : 1), D);
  p.rect(12, 9 + b, 1, 2, '#2b1d24'); p.set(12, 9 + b, '#ffffff');
  p.rect(15, 9 + b, 1, 2, '#2b1d24'); p.set(15, 9 + b, '#ffffff');
  p.set(14, 11 + b, '#e86a7a');
  p.set(11, 11 + b, '#f5a0b0'); p.set(16, 11 + b, '#f5a0b0');
  p.outline(OUT);
  return p;
}
function petVoltowl(f) {
  const p = mk(20, 18);
  const b = f ? -1 : 0;
  const B = '#3b5bd1', D = '#2a3f99', L = '#b8c8ff', Y = '#ffd84a';
  // wings
  if (f) { p.ellipse(3.5, 8 + b, 2.2, 3.4, D); p.ellipse(16.5, 8 + b, 2.2, 3.4, D); }
  else { p.ellipse(4, 11, 2, 3, D); p.ellipse(16, 11, 2, 3, D); }
  p.ellipse(10, 10 + b, 6, 6, B);
  p.ellipse(10, 12 + b, 3.6, 3.6, L);
  // lightning tufts
  p.tri(4, 5 + b, 6, 1 + b, 8, 5 + b, Y); p.tri(12, 5 + b, 14, 1 + b, 16, 5 + b, Y);
  p.circle(7.5, 8.5 + b, 2, '#ffffff'); p.circle(12.5, 8.5 + b, 2, '#ffffff');
  p.rect(8, 8 + b, 1, 2, '#2b1d24'); p.rect(13, 8 + b, 1, 2, '#2b1d24');
  p.tri(9, 10 + b, 11, 10 + b, 10, 12 + b, '#f6a03a');
  p.rect(7, 16, 2, 1, '#f6a03a'); p.rect(11, 16, 2, 1, '#f6a03a');
  p.outline(OUT);
  return p;
}
function petPuddlit(f) {
  const p = mk(20, 18);
  const b = f ? -1 : 0;
  const A = '#4fc0d8', D = '#2f8fa8', L = '#c8f2ff';
  p.ellipse(10, 12 + b, 6.5, 4, A);
  p.ellipse(10, 13.5 + b, 4, 2, L);
  p.circle(6.5, 7 + b, 2.4, A); p.circle(13.5, 7 + b, 2.4, A);
  p.circle(6.5, 7 + b, 1.4, '#ffffff'); p.circle(13.5, 7 + b, 1.4, '#ffffff');
  p.set(7, 7 + b, '#2b1d24'); p.set(14, 7 + b, '#2b1d24');
  p.rect(8, 11 + b, 5, 1, D);
  p.set(7, 10 + b, D); p.set(13, 10 + b, D);
  p.rect(4, 15, 3, 2 - (f ? 1 : 0), D); p.rect(13, 15, 3, 2 - (f ? 0 : 1), D);
  p.outline(OUT);
  // bubble
  p.circle(16.5, 3 + b, 1.6, L); p.set(16, 2 + b, '#ffffff');
  return p;
}
function petPebblet(f) {
  const p = mk(20, 18);
  const b = f ? -1 : 0;
  const S = '#9a9aa6', D = '#6e6e7c', L = '#c4c4cc';
  p.ellipse(10, 11 + b, 6.5, 5.2, S);
  p.paint((x, y) => (x + y > 22 + b ? D : (x + y < 13 + b ? L : null)));
  p.ellipse(9, 6.5 + b, 4, 1.6, '#6cc24e'); p.set(12, 5 + b, '#8fd65a'); p.set(7, 5 + b, '#4f9a3a');
  p.rect(11, 9 + b, 1, 2, '#2b1d24'); p.rect(14, 9 + b, 1, 2, '#2b1d24');
  p.set(11, 9 + b, '#ffffff'); p.set(14, 9 + b, '#ffffff');
  p.set(13, 12 + b, '#4a4a56');
  p.rect(6, 16, 3, 1, D); p.rect(12, 16, 3, 1, D);
  p.outline(OUT);
  return p;
}
function petGlimmoth(f) {
  const p = mk(20, 18);
  const b = f ? -1 : 0;
  const W = '#f5b8e8', WD = '#d88ad0', B = '#efe4ff';
  const wr = f ? 2.6 : 4;
  p.ellipse(4.5, 8 + b, 3.6, wr, W); p.ellipse(15.5, 8 + b, 3.6, wr, W);
  p.ellipse(5, 11 + b, 2.4, 2, WD); p.ellipse(15, 11 + b, 2.4, 2, WD);
  p.circle(4, 7 + b, 1, '#ffffff'); p.circle(16, 7 + b, 1, '#ffffff');
  p.ellipse(10, 10 + b, 3.2, 4.5, B);
  p.ellipse(10, 7 + b, 3.6, 1.6, '#ffffff');
  p.line(8, 4 + b, 7, 1 + b, '#7a5a9a'); p.line(12, 4 + b, 13, 1 + b, '#7a5a9a');
  p.rect(8, 9 + b, 1, 2, '#2b1d24'); p.rect(11, 9 + b, 1, 2, '#2b1d24');
  p.outline(OUT);
  return p;
}

export const PET_DRAW = {
  emberpup: petEmberpup, leafkit: petLeafkit, voltowl: petVoltowl,
  puddlit: petPuddlit, pebblet: petPebblet, glimmoth: petGlimmoth,
};

export function buildPetSprite(id) {
  const fr = [PET_DRAW[id](0), PET_DRAW[id](1)];
  const right = fr.map((f) => f.toCanvas());
  const left = fr.map((f) => f.flipX().toCanvas());
  return { w: 20, h: 18, ax: 10, ay: 16, right, left, portrait: fr[0] };
}
