import { boundedDamage } from '../rules/srd.ts';
import { SHOP_CATALOG, levelFromXp, levelHpGain, resalePrice } from '../rules/economy.ts';
import type { CampaignState, GameEvent } from './types.ts';

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function applyEvent(previous: CampaignState | null, event: GameEvent): CampaignState {
  if (event.data.type === 'campaign_created') {
    if (previous) throw new Error('Campaign can only be created once.');
    const initial = clone(event.data.initialState);
    // Backward compatible with saves created before the XP/gold ledger existed.
    for (const pc of Object.values(initial.characters)) {
      pc.xp ??= 0;
      pc.gold ??= 20;
      pc.level = levelFromXp(pc.xp);
    }
    if (initial.items['item-torch']) initial.items['item-torch'].catalogId ??= 'torch';
    initial.version = event.seq;
    return initial;
  }
  if (!previous) throw new Error('Campaign must be created before other events.');
  if (event.previousVersion !== previous.version || event.seq !== previous.version + 1) {
    throw new Error(`Broken event sequence at event ${event.id}.`);
  }

  const state = clone(previous);
  const data = event.data;
  switch (data.type) {
    case 'character_updated':
      Object.assign(state.characters[data.characterId], data.patch);
      break;
    case 'action_submitted':
      break;
    case 'dice_rolled':
      break;
    case 'npc_spoken':
      state.quest.spokeToSera = true;
      break;
    case 'check_resolved':
      if (data.purpose === 'inspect_chest' && data.result.success) state.quest.chestInspected = true;
      break;
    case 'item_transferred': {
      const item = state.items[data.itemId];
      if (!item || item.ownerId || item.location !== data.fromLocation) throw new Error('Invalid item transfer event.');
      item.location = null;
      item.ownerId = data.toCharacterId;
      if (!state.characters[data.toCharacterId].inventory.includes(data.itemId)) {
        state.characters[data.toCharacterId].inventory.push(data.itemId);
      }
      break;
    }
    case 'item_purchased': {
      const buyer = state.characters[data.buyerId];
      const entry = data.item.catalogId && SHOP_CATALOG[data.item.catalogId];
      if (!entry || data.price !== entry.price || !Number.isInteger(data.price) || data.price < 0 || buyer.gold < data.price) throw new Error('Invalid purchase event.');
      if (state.items[data.item.id] || data.item.ownerId !== buyer.id || data.item.location !== null || data.item.unique || data.item.name !== entry.name) throw new Error('Invalid purchased item.');
      buyer.gold -= data.price;
      state.items[data.item.id] = clone(data.item);
      buyer.inventory.push(data.item.id);
      break;
    }
    case 'item_sold': {
      const seller = state.characters[data.sellerId];
      const item = state.items[data.itemId];
      if (!item || !item.catalogId || item.unique || item.ownerId !== seller.id || !seller.inventory.includes(item.id) || data.price !== resalePrice(item.catalogId)) throw new Error('Invalid sale event.');
      seller.inventory = seller.inventory.filter(id => id !== item.id);
      seller.gold += data.price;
      delete state.items[item.id];
      break;
    }
    case 'item_consumed': {
      const character = state.characters[data.characterId];
      const item = state.items[data.itemId];
      if (!item || item.ownerId !== character.id || item.catalogId !== 'healing-potion' || !character.inventory.includes(item.id)) throw new Error('Invalid consumable event.');
      if (data.healing.die !== 4 || data.healing.rolls.length !== 2 || data.healing.modifier !== 2 || data.healing.rolls.some(r => !Number.isInteger(r) || r < 1 || r > 4) || data.healing.total !== data.healing.rolls[0] + data.healing.rolls[1] + 2) throw new Error('Invalid healing roll.');
      const possibleHealing = Math.min(character.hp.max - character.hp.current, data.healing.total);
      if (data.healed !== possibleHealing || data.healed <= 0) throw new Error('Invalid healing amount.');
      character.hp.current += data.healed;
      character.inventory = character.inventory.filter(id => id !== item.id);
      delete state.items[item.id];
      if (state.combat) state.combat.actionUsed = true;
      break;
    }
    case 'experience_awarded': {
      const character = state.characters[data.characterId];
      if (!Number.isInteger(data.amount) || data.amount < 1 || data.amount > 10000) throw new Error('Invalid XP amount.');
      character.xp += data.amount;
      const nextLevel = levelFromXp(character.xp);
      while (character.level < nextLevel) {
        const hpGain = levelHpGain(character);
        character.level += 1;
        character.hp.max += hpGain;
        character.hp.current += hpGain;
      }
      character.proficiencyBonus = 2 + Math.floor((character.level - 1) / 4);
      break;
    }
    case 'item_dropped': {
      const item = state.items[data.itemId];
      const owner = state.characters[data.fromCharacterId];
      if (!item || item.ownerId !== owner.id || !owner.inventory.includes(item.id)) throw new Error('Invalid item drop event.');
      owner.inventory = owner.inventory.filter((id) => id !== item.id);
      item.ownerId = null;
      item.location = data.toLocation;
      break;
    }
    case 'combat_started':
      state.combat = { order: [...data.order], activeIndex: 0, round: 1, actionUsed: false };
      break;
    case 'attack_resolved': {
      const target = data.targetId === 'enemy-rat' ? state.npcs['enemy-rat'] : state.characters[data.targetId];
      const bounded = boundedDamage(target.hp.current, data.appliedDamage);
      if (bounded.applied !== data.appliedDamage) throw new Error('Attack damage exceeds valid HP bounds.');
      target.hp.current = bounded.hp;
      if (data.targetId === 'enemy-rat' && target.hp.current === 0) {
        state.npcs['enemy-rat'].status = 'dead';
        state.quest.ratDefeated = true;
        state.combat = null; // End the encounter as soon as the only enemy is defeated.
      }
      if (state.combat) state.combat.actionUsed = true;
      break;
    }
    case 'turn_ended':
      if (!state.combat) throw new Error('Cannot end a turn outside combat.');
      state.combat.activeIndex = data.nextIndex;
      state.combat.round = data.nextRound;
      state.combat.actionUsed = false;
      break;
    case 'location_changed':
      state.characters[data.characterId].position = data.to;
      break;
    case 'quest_completed':
      state.quest.completed = true;
      state.scene = 'courtyard';
      state.combat = null;
      break;
    case 'narration_added':
      state.lastNarration = data.text;
      break;
    default: {
      const exhaustive: never = data;
      throw new Error(`Unknown event: ${String(exhaustive)}`);
    }
  }
  state.version = event.seq;
  return state;
}

export function replay(events: readonly GameEvent[]): CampaignState {
  if (events.length === 0) throw new Error('Event log is empty.');
  return events.reduce<CampaignState | null>((state, event) => applyEvent(state, event), null) as CampaignState;
}
