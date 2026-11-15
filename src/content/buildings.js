// Town buildings: what unlocks them, what each level adds and what the next level costs.
// Levels go 1–5. bonus arrays are indexed by level - 1.

export const BUILDINGS = {
  gate: { name: 'Enter the Wild', bonus: { team: [0, 1, 1, 2, 2] },
    levelText: (L) => `Team of ${3 + [0, 1, 1, 2, 2][L - 1]}` },
  training: { name: 'Training Hall', bonus: { cap: [10, 15, 20, 25, 30] },
    levelText: (L) => `Upgrades go up to level ${[10, 15, 20, 25, 30][L - 1]}` },
  ranch: { name: 'Ranch', bonus: { spots: [0, 1, 2, 3, 4], rate: [0, 0.25, 0.5, 0.75, 1] },
    levelText: (L) => `${2 + [0, 1, 2, 3, 4][L - 1]} training spots, training ${Math.round([0, 25, 50, 75, 100][L - 1])}% faster` },
  hatchery: { name: 'Hatchery', bonus: { speed: [0, 0.15, 0.3, 0.45, 0.6] },
    levelText: (L) => `Eggs hatch ${Math.round([0, 15, 30, 45, 60][L - 1])}% faster` },
  clinic: { name: 'Clinic', bonus: { discount: [0, 0.2, 0.35, 0.5, 0.6], rest: [0, 0.1, 0.2, 0.3, 0.4] },
    levelText: (L) => `Healing ${Math.round([0, 20, 35, 50, 60][L - 1])}% cheaper; resting heals ${50 + [0, 10, 20, 30, 40][L - 1]}% per run` },
  merchant: { name: 'Merchant', bonus: { stock: [3, 4, 5, 6, 7] },
    levelText: (L) => `${[3, 4, 5, 6, 7][L - 1]} items for sale` },
  workshop: { name: 'Workshop', bonus: { cap: [10, 20, 30, 40, 50] },
    levelText: (L) => `Gear slots go up to level ${[10, 20, 30, 40, 50][L - 1]}` },
  shrine: { name: 'Spirit Shrine', bonus: { cap: [5, 10, 15, 20, 25], research: [1, 2, 3, 4, 5] },
    levelText: (L) => `Shrine upgrades go up to level ${[5, 10, 15, 20, 25][L - 1]}; ${[1, 2, 3, 4, 5][L - 1]} tier research levels` },
};

// Cost of going from level L to L + 1 (coins + materials).
export function buildingCost(id, L) {
  if (L >= 5) return null;
  const k = L;
  return { coins: 150 * k * k, wood: 15 * k, stone: 12 * k, clay: k >= 2 ? 8 * (k - 1) : 0, iron: k >= 3 ? 5 * (k - 2) : 0 };
}

// When a closed building opens (Enter the Wild, Training Hall, Ranch and Hatchery are open from the start).
export const UNLOCK_TEXT = {
  clinic: 'Opens when a survivalmon first gets hurt',
  survidex: 'Opens after your first wild catch',
  merchant: 'Opens when your first egg hatches',
  shrine: 'Opens when you own 3 survivalmons',
  workshop: 'Opens when you find your first gear',
};

// The Merchant's goods: each lasts for your next run. The stall shows as many as its level allows.
export const MERCHANT_ITEMS = [
  { id: 'snack', name: 'Power Snack', icon: 'berry', price: 40, text: 'Survivalmons deal 20% more damage next run' },
  { id: 'tonic', name: 'Iron Tonic', icon: 'shell', price: 40, text: 'Survivalmons take 20% less damage next run' },
  { id: 'horn', name: 'Lure Horn', icon: 'orb_star', price: 60, text: 'Wild survivalmons appear 50% more often next run' },
  { id: 'pick', name: 'Lucky Pick', icon: 'mat_iron', price: 50, text: 'Double materials next run' },
  { id: 'candle', name: 'Time Candle', icon: 'hourglass', price: 30, text: '+10 seconds on your next run' },
  { id: 'feather', name: 'Revive Feather', icon: 'phoenix', price: 50, text: 'The first survivalmon to faint gets back up once' },
  { id: 'warmer', name: 'Egg Warmer', icon: 'egg', price: 40, text: 'Eggs warm up 50% faster next run' },
];

export const MATERIALS = { wood: { name: 'Wood', icon: 'mat_wood' }, stone: { name: 'Stone', icon: 'mat_stone' }, clay: { name: 'Clay', icon: 'mat_clay' }, iron: { name: 'Iron', icon: 'mat_iron' } };
