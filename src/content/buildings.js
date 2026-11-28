// Town buildings: what unlocks them, what each level adds and what the next level costs.
// Levels go 1–5. bonus arrays are indexed by level - 1. An upgrade takes time to build (BUILD_MINS);
// the building keeps working at its old level until it's done, and Skyfall Shards can finish it at once.
import { GRADES, MERCHANT_STOCK } from './shop.js';

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
  merchant: { name: 'Merchant', bonus: { stock: MERCHANT_STOCK },
    levelText: (L) => `Sells grade ${GRADES[L - 1]} goods, ${MERCHANT_STOCK[L - 1]} kinds` },
  workshop: { name: 'Workshop', bonus: { cap: [10, 20, 30, 40, 50], tools: [2, 4, 6, 8, 10] },
    levelText: (L) => `Gear pieces go up to level ${[10, 20, 30, 40, 50][L - 1]}; tools up to level ${2 * L}` },
  shrine: { name: 'Spirit Shrine', bonus: { cap: [5, 10, 15, 20, 25], research: [1, 2, 3, 4, 5] },
    levelText: (L) => `Shrine upgrades go up to level ${[5, 10, 15, 20, 25][L - 1]}; ${[1, 2, 3, 4, 5][L - 1]} tier research levels` },
};

// Cost of going from level L to L + 1 (coins + materials).
export function buildingCost(id, L) {
  if (L >= 5) return null;
  const k = L;
  return { coins: 150 * k * k, wood: 15 * k, stone: 12 * k, clay: k >= 2 ? 8 * (k - 1) : 0, iron: k >= 3 ? 5 * (k - 2) : 0 };
}
// Minutes to build level L + 1 (from level 1: 15 min, then 45 min, 2 h and 4 h)
export const BUILD_MINS = [15, 45, 120, 240];
export const buildMins = (L) => BUILD_MINS[L - 1] || 0;
export const fmtMins = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);

// When a closed building opens (Enter the Wild, Training Hall, Ranch and Hatchery are open from the start).
export const UNLOCK_TEXT = {
  clinic: 'Opens when a survivalmon first gets hurt',
  survidex: 'Opens after your first wild catch',
  merchant: 'Opens when your first egg hatches',
  shrine: 'Opens when you own 3 survivalmons',
  workshop: 'Opens when you find your first gear',
  hall: 'Opens after your first run',
  watchtower: 'Opens when you have 5 different basic mons',
};

// The Merchant's goods are in content/shop.js.
export const MATERIALS = { wood: { name: 'Wood', icon: 'mat_wood' }, stone: { name: 'Stone', icon: 'mat_stone' }, clay: { name: 'Clay', icon: 'mat_clay' }, iron: { name: 'Iron', icon: 'mat_iron' } };
