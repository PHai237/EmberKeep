import type { CampaignState } from './types.ts';

export function createInitialState(campaignId = 'phase-1-demo'): CampaignState {
  return {
    schemaVersion: 1,
    campaignId,
    version: 0,
    scene: 'cellar',
    characters: {
      'pc-aria': {
        id: 'pc-aria', controllerId: 'player-a', name: 'Aria', ancestry: 'Human', className: 'Rogue', level: 1, xp: 0, gold: 20,
        abilities: { strength: 10, dexterity: 16, constitution: 12, intelligence: 14, wisdom: 12, charisma: 10 },
        proficientSkills: ['stealth', 'investigation'], proficiencyBonus: 2,
        hp: { current: 9, max: 9 }, armorClass: 14, attackBonus: 5, damageDie: 6,
        inventory: ['item-torch'], position: 'cellar',
      },
      'pc-borin': {
        id: 'pc-borin', controllerId: 'player-b', name: 'Borin', ancestry: 'Dwarf', className: 'Fighter', level: 1, xp: 0, gold: 20,
        abilities: { strength: 16, dexterity: 12, constitution: 16, intelligence: 10, wisdom: 12, charisma: 8 },
        proficientSkills: ['athletics', 'perception'], proficiencyBonus: 2,
        hp: { current: 13, max: 13 }, armorClass: 16, attackBonus: 5, damageDie: 8,
        inventory: [], position: 'cellar',
      },
    },
    npcs: {
      'npc-sera': { id: 'npc-sera', name: 'Sera', hp: { current: 8, max: 8 }, armorClass: 11, position: 'cellar', status: 'alive' },
      'enemy-rat': { id: 'enemy-rat', name: 'Chuột Tro Khổng Lồ', hp: { current: 7, max: 7 }, armorClass: 12, position: 'cellar', status: 'alive' },
    },
    items: {
      'item-torch': { id: 'item-torch', name: 'Đuốc', unique: false, location: null, ownerId: 'pc-aria', catalogId: 'torch' },
      'item-brass-key': { id: 'item-brass-key', name: 'Chìa khóa đồng', unique: true, location: 'cellar-chest', ownerId: null },
    },
    combat: null,
    quest: { spokeToSera: false, chestInspected: false, ratDefeated: false, completed: false },
    lastNarration: 'Sera giữ ngọn đèn dầu sát ngực. Một chiếc rương khóa nằm bên tường; tiếng cào khẽ vọng từ sau các thùng gỗ.',
  };
}
