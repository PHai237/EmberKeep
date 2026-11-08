export type CharacterId = 'pc-aria' | 'pc-borin';
export type ActorId = 'player-a' | 'player-b' | 'system';
export type Ability = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';
export type Skill = 'athletics' | 'stealth' | 'investigation' | 'perception' | 'persuasion';
export type Die = 4 | 6 | 8 | 10 | 12 | 20 | 100;
export type ShopItemId = 'torch' | 'healing-potion' | 'rations';

export interface Character {
  id: CharacterId;
  controllerId: Exclude<ActorId, 'system'>;
  name: string;
  ancestry: string;
  className: string;
  level: number;
  xp: number;
  gold: number;
  abilities: Record<Ability, number>;
  proficientSkills: Skill[];
  proficiencyBonus: number;
  hp: { current: number; max: number };
  armorClass: number;
  attackBonus: number;
  damageDie: 6 | 8;
  inventory: string[];
  position: string;
}

export interface Npc {
  id: 'npc-sera' | 'enemy-rat';
  name: string;
  hp: { current: number; max: number };
  armorClass: number;
  position: string;
  status: 'alive' | 'dead';
}

export interface WorldItem {
  id: string;
  name: string;
  unique: boolean;
  location: string | null;
  ownerId: CharacterId | null;
  catalogId?: ShopItemId;
}

export interface CombatState {
  order: Array<CharacterId | 'enemy-rat'>;
  activeIndex: number;
  round: number;
  actionUsed: boolean;
}

export interface CampaignState {
  schemaVersion: 1;
  campaignId: string;
  version: number;
  scene: string;
  characters: Record<CharacterId, Character>;
  npcs: Record<Npc['id'], Npc>;
  items: Record<string, WorldItem>;
  combat: CombatState | null;
  quest: {
    spokeToSera: boolean;
    chestInspected: boolean;
    ratDefeated: boolean;
    completed: boolean;
  };
  lastNarration: string;
}

export interface RollResult {
  die: Die;
  rolls: number[];
  modifier: number;
  total: number;
}

export interface SkillCheckResult extends RollResult {
  ability: Ability;
  skill: Skill;
  dc: number;
  success: boolean;
  critical: 'success' | 'failure' | null;
}

export type GameEventData =
  | { type: 'campaign_created'; initialState: CampaignState }
  | { type: 'character_updated'; characterId: CharacterId; patch: Pick<Character, 'name' | 'ancestry' | 'className'> }
  | { type: 'action_submitted'; characterId: CharacterId; text: string }
  | { type: 'dice_rolled'; characterId: CharacterId; result: RollResult; purpose: 'manual' }
  | { type: 'npc_spoken'; npcId: 'npc-sera'; characterId: CharacterId }
  | { type: 'check_resolved'; characterId: CharacterId; result: SkillCheckResult; purpose: 'inspect_chest' }
  | { type: 'item_transferred'; itemId: string; fromLocation: string; toCharacterId: CharacterId }
  | { type: 'item_dropped'; itemId: string; fromCharacterId: CharacterId; toLocation: string }
  | { type: 'item_purchased'; buyerId: CharacterId; item: WorldItem; price: number }
  | { type: 'item_sold'; sellerId: CharacterId; itemId: string; price: number }
  | { type: 'item_consumed'; characterId: CharacterId; itemId: string; healing: RollResult; healed: number }
  | { type: 'experience_awarded'; characterId: CharacterId; amount: number; reason: 'rat_defeated' | 'quest_completed' }
  | { type: 'combat_started'; order: CombatState['order'] }
  | { type: 'attack_resolved'; attackerId: CharacterId | 'enemy-rat'; targetId: CharacterId | 'enemy-rat'; attack: RollResult; hit: boolean; damage: RollResult | null; appliedDamage: number }
  | { type: 'turn_ended'; nextIndex: number; nextRound: number }
  | { type: 'location_changed'; characterId: CharacterId; to: string }
  | { type: 'quest_completed' }
  | { type: 'narration_added'; text: string; basedOnEventId: string };

export interface GameEvent {
  seq: number;
  id: string;
  campaignId: CampaignState['campaignId'];
  actorId: ActorId;
  commandId: string;
  previousVersion: number;
  createdAt: string;
  data: GameEventData;
}

export interface CampaignRecord {
  schemaVersion: 1;
  events: GameEvent[];
}

export type GameCommand =
  | { type: 'edit_character'; commandId: string; actorId: ActorId; expectedVersion: number; characterId: CharacterId; patch: Pick<Character, 'name' | 'ancestry' | 'className'> }
  | { type: 'submit_action'; commandId: string; actorId: ActorId; expectedVersion: number; characterId: CharacterId; text: string }
  | { type: 'roll_dice'; commandId: string; actorId: ActorId; expectedVersion: number; characterId: CharacterId; die: Die; modifier: number }
  | { type: 'talk_to_sera'; commandId: string; actorId: ActorId; expectedVersion: number; characterId: CharacterId }
  | { type: 'inspect_chest'; commandId: string; actorId: ActorId; expectedVersion: number; characterId: CharacterId }
  | { type: 'pickup_item'; commandId: string; actorId: ActorId; expectedVersion: number; characterId: CharacterId; itemId: string }
  | { type: 'drop_item'; commandId: string; actorId: ActorId; expectedVersion: number; characterId: CharacterId; itemId: string }
  | { type: 'buy_item'; commandId: string; actorId: ActorId; expectedVersion: number; characterId: CharacterId; catalogId: ShopItemId }
  | { type: 'sell_item'; commandId: string; actorId: ActorId; expectedVersion: number; characterId: CharacterId; itemId: string }
  | { type: 'use_item'; commandId: string; actorId: ActorId; expectedVersion: number; characterId: CharacterId; itemId: string }
  | { type: 'start_combat'; commandId: string; actorId: ActorId; expectedVersion: number; characterId: CharacterId }
  | { type: 'attack'; commandId: string; actorId: ActorId; expectedVersion: number; characterId: CharacterId; targetId: 'enemy-rat' }
  | { type: 'end_turn'; commandId: string; actorId: ActorId; expectedVersion: number; characterId: CharacterId }
  | { type: 'move'; commandId: string; actorId: ActorId; expectedVersion: number; characterId: CharacterId; to: 'courtyard' };

export interface CommandSuccess { ok: true; events: GameEvent[]; state: CampaignState }
export interface CommandFailure { ok: false; code: 'FORBIDDEN' | 'CONFLICT' | 'INVALID' | 'NOT_FOUND'; message: string; state: CampaignState }
export type CommandResult = CommandSuccess | CommandFailure;
