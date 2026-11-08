import type { CampaignState, CharacterId, GameCommand, Character } from '../domain/types';

export type CommandBase = { commandId: string; actorId: Character['controllerId']; expectedVersion: number; characterId: CharacterId };
export type CommandFactory = (base: CommandBase) => GameCommand;
export interface SuggestedAction {
  id: string;
  label: string;
  hint: string;
  build: CommandFactory;
}

/**
 * Phase 1 only: validated suggestions derived from canonical state.
 * When a real AI DM is connected, its proposed options must be mapped to
 * allowlisted command intents on the server, never executed as model-authored state.
 */
export function mockSuggestions(state: CampaignState, activeId: CharacterId): SuggestedAction[] {
  const active = state.characters[activeId];
  const combatant = state.combat?.order[state.combat.activeIndex];
  const options: SuggestedAction[] = [];
  const add = (id: string, label: string, hint: string, build: CommandFactory) => options.push({ id, label, hint, build });
  if (state.quest.completed) return options;
  if (state.combat) {
    if (combatant === activeId) {
      if (!state.combat.actionUsed && state.npcs['enemy-rat'].status === 'alive') add('attack', 'Tấn công Chuột Tro', 'Tung d20 + sát thương', base => ({ ...base, type: 'attack', targetId: 'enemy-rat' }));
      add('end_turn', 'Kết thúc lượt', 'Để người tiếp theo hành động', base => ({ ...base, type: 'end_turn' }));
    }
    return options;
  }
  if (!state.quest.spokeToSera) add('talk', 'Nói chuyện với Sera', 'Hỏi về căn hầm', base => ({ ...base, type: 'talk_to_sera' }));
  if (!state.quest.chestInspected) add('inspect', 'Điều tra chiếc rương', 'Investigation · DC 12', base => ({ ...base, type: 'inspect_chest' }));
  if (state.quest.chestInspected && !state.items['item-brass-key'].ownerId) add('pickup', 'Lấy chìa khóa đồng', 'Thêm vào túi đồ', base => ({ ...base, type: 'pickup_item', itemId: 'item-brass-key' }));
  if (state.quest.spokeToSera && !state.quest.ratDefeated) add('combat', 'Đối đầu Chuột Tro', 'Bắt đầu chiến đấu', base => ({ ...base, type: 'start_combat' }));
  if (state.quest.ratDefeated && active.inventory.includes('item-brass-key')) add('leave', 'Mở cửa ra sân', 'Hoàn thành nhiệm vụ', base => ({ ...base, type: 'move', to: 'courtyard' }));
  return options;
}
