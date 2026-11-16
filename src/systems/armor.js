// Armor cuts a share of each hit, with diminishing returns: 10 armor takes off a third, 20 half,
// 30 three fifths. (It used to subtract flat points, which made most hits do 1 damage.)
// The hero's armor also shields the survivalmons at half strength.
export const ARMOR_K = 20;
export const armorCut = (armor) => ARMOR_K / (ARMOR_K + Math.max(0, armor));
export const armorPct = (armor) => Math.round(100 * (1 - armorCut(armor)));
