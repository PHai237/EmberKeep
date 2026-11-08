import type { Character, ShopItemId } from '../domain/types.ts';

/** Phase 1 demo economy. Prices are campaign fixtures, not a full SRD equipment table. */
export const SHOP_CATALOG: Record<ShopItemId, { name: string; price: number; description: string }> = {
  torch: { name: 'Đuốc', price: 2, description: 'Soi sáng đường đi.' },
  'healing-potion': { name: 'Bình hồi phục', price: 10, description: 'Hồi 2d4 + 2 HP khi sử dụng.' },
  rations: { name: 'Khẩu phần', price: 4, description: 'Lương thực cho một ngày.' },
};
export function resalePrice(catalogId: ShopItemId): number {
  return Math.floor(SHOP_CATALOG[catalogId].price / 2);
}
const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
export function levelFromXp(xp: number): number {
  const level = XP_THRESHOLDS.findIndex((threshold) => threshold > xp);
  return level < 0 ? 20 : Math.max(1, level);
}
export function xpToNextLevel(xp: number): number | null {
  return XP_THRESHOLDS[levelFromXp(xp)] ?? null;
}
export function levelHpGain(character: Character): number {
  const hitDieAverage = character.className.toLowerCase().includes('fighter') ? 6 : 5;
  return Math.max(1, hitDieAverage + Math.floor((character.abilities.constitution - 10) / 2));
}
