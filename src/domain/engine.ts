import { DiceRoller } from '../rules/dice.ts';
import { boundedDamage, isAttackHit, skillModifier } from '../rules/srd.ts';
import { SHOP_CATALOG, resalePrice } from '../rules/economy.ts';
import { createInitialState } from './fixtures.ts';
import { applyEvent, replay } from './reducer.ts';
import type { ActorId, CampaignRecord, CampaignState, CharacterId, CommandFailure, CommandResult, GameCommand, GameEvent, GameEventData, SkillCheckResult } from './types.ts';

export interface EngineOptions {
  dice?: DiceRoller;
  clock?: () => string;
  idFactory?: () => string;
  record?: CampaignRecord;
  campaignId?: string;
}

export class GameEngine {
  private readonly dice: DiceRoller;
  private readonly clock: () => string;
  private readonly idFactory: () => string;
  private events: GameEvent[];
  private current: CampaignState;

  constructor(options: EngineOptions = {}) {
    this.dice = options.dice ?? new DiceRoller();
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.idFactory = options.idFactory ?? (() => crypto.randomUUID());
    if (options.record) {
      this.events = structuredClone(options.record.events);
      this.current = replay(this.events);
    } else {
      const initial = createInitialState(options.campaignId);
      const created: GameEvent = {
        seq: 1, id: this.idFactory(), campaignId: initial.campaignId, actorId: 'system', commandId: 'bootstrap',
        previousVersion: 0, createdAt: this.clock(), data: { type: 'campaign_created', initialState: initial },
      };
      this.events = [created];
      this.current = applyEvent(null, created);
    }
  }

  get state(): CampaignState { return structuredClone(this.current); }
  get eventLog(): GameEvent[] { return structuredClone(this.events); }
  exportRecord(): CampaignRecord { return { schemaVersion: 1, events: this.eventLog }; }

  dispatch(command: GameCommand): CommandResult {
    const duplicate = this.events.filter((event) => event.commandId === command.commandId);
    if (duplicate.length) return { ok: true, events: structuredClone(duplicate), state: this.state };
    if (command.expectedVersion !== this.current.version) return this.fail('CONFLICT', 'Campaign changed; refresh and retry.');
    if (!this.owns(command.actorId, command.characterId)) return this.fail('FORBIDDEN', 'You cannot act for this character.');

    try {
      const data = this.validateAndResolve(command);
      const committed = data.map((entry) => this.commit(command.actorId, command.commandId, entry));
      return { ok: true, events: committed, state: this.state };
    } catch (error) {
      return this.fail('INVALID', error instanceof Error ? error.message : 'Invalid command.');
    }
  }

  addNarration(commandId: string, basedOnEventId: string, text: string): GameEvent {
    if (!this.events.some((event) => event.id === basedOnEventId)) throw new Error('Narration must reference a committed event.');
    const clean = text.trim().slice(0, 1200);
    if (!clean) throw new Error('Narration cannot be empty.');
    return this.commit('system', commandId, { type: 'narration_added', text: clean, basedOnEventId });
  }

  private owns(actorId: ActorId, characterId: CharacterId): boolean {
    return actorId !== 'system' && this.current.characters[characterId].controllerId === actorId;
  }

  private validateAndResolve(command: GameCommand): GameEventData[] {
    const character = this.current.characters[command.characterId];
    if (character.hp.current <= 0) throw new Error('An unconscious character cannot act.');
    switch (command.type) {
      case 'edit_character': {
        const values = [command.patch.name, command.patch.ancestry, command.patch.className].map((value) => value.trim());
        if (values.some((value) => value.length < 1 || value.length > 40)) throw new Error('Character fields must contain 1–40 characters.');
        return [{ type: 'character_updated', characterId: command.characterId, patch: { name: values[0], ancestry: values[1], className: values[2] } }];
      }
      case 'submit_action': {
        const text = command.text.trim();
        if (!text || text.length > 300) throw new Error('Action must contain 1–300 characters.');
        return [{ type: 'action_submitted', characterId: command.characterId, text }];
      }
      case 'roll_dice':
        if (!Number.isInteger(command.modifier) || command.modifier < -10 || command.modifier > 20) throw new Error('Dice modifier must be an integer from -10 to 20.');
        return [{ type: 'dice_rolled', characterId: command.characterId, result: this.dice.roll(command.die, command.modifier), purpose: 'manual' }];
      case 'talk_to_sera':
        if (this.current.npcs['npc-sera'].status !== 'alive') throw new Error('Sera cannot answer.');
        if (character.position !== 'cellar') throw new Error('Sera is not here.');
        return [{ type: 'npc_spoken', npcId: 'npc-sera', characterId: command.characterId }];
      case 'inspect_chest': {
        if (this.current.combat) throw new Error('You cannot carefully inspect the chest during combat.');
        if (this.current.quest.chestInspected) throw new Error('The chest has already been inspected.');
        const modifier = skillModifier(character, 'investigation');
        const roll = this.dice.roll(20, modifier);
        const result: SkillCheckResult = {
          ...roll, ability: 'intelligence', skill: 'investigation', dc: 12,
          success: roll.total >= 12, critical: roll.rolls[0] === 20 ? 'success' : roll.rolls[0] === 1 ? 'failure' : null,
        };
        return [{ type: 'check_resolved', characterId: command.characterId, result, purpose: 'inspect_chest' }];
      }
      case 'pickup_item': {
        const item = this.current.items[command.itemId];
        if (!item) throw new Error('Item does not exist.');
        if (!this.current.quest.chestInspected) throw new Error('Inspect the chest successfully first.');
        if (item.ownerId || item.location !== 'cellar-chest') throw new Error('Item is no longer available.');
        return [{ type: 'item_transferred', itemId: item.id, fromLocation: item.location, toCharacterId: command.characterId }];
      }
      case 'buy_item': {
        this.requireShop(character.position);
        const product = SHOP_CATALOG[command.catalogId];
        if (!product || character.gold < product.price) throw new Error('Không đủ vàng hoặc vật phẩm không tồn tại.');
        const itemId = `shop-${this.idFactory()}`;
        return [{ type: 'item_purchased', buyerId: command.characterId,
          item: { id: itemId, name: product.name, unique: false, location: null, ownerId: command.characterId, catalogId: command.catalogId },
          price: product.price }];
      }
      case 'sell_item': {
        this.requireShop(character.position);
        const item = this.current.items[command.itemId];
        if (!item || item.ownerId !== character.id || !character.inventory.includes(item.id)) throw new Error('Nhân vật không sở hữu vật phẩm.');
        if (!item.catalogId || item.unique) throw new Error('Vật phẩm nhiệm vụ hoặc vật phẩm đặc biệt không thể bán.');
        return [{ type: 'item_sold', sellerId: character.id, itemId: item.id, price: resalePrice(item.catalogId) }];
      }
      case 'use_item': {
        const item = this.current.items[command.itemId];
        if (!item || item.ownerId !== character.id || !character.inventory.includes(item.id)) throw new Error('Nhân vật không sở hữu vật phẩm.');
        if (item.catalogId !== 'healing-potion') throw new Error('Vật phẩm này chưa có hành động sử dụng.');
        if (character.hp.current >= character.hp.max) throw new Error('Sinh lực đã đầy.');
        if (this.current.combat) {
          const combat = this.requirePlayerTurn(command.characterId);
          if (combat.actionUsed) throw new Error('Hành động chính đã được sử dụng trong lượt này.');
        }
        const healing = this.dice.roll(4, 2);
        const extra = this.dice.roll(4, 0);
        const result = { die: 4 as const, rolls: [healing.rolls[0], extra.rolls[0]], modifier: 2, total: healing.rolls[0] + extra.rolls[0] + 2 };
        return [{ type: 'item_consumed', characterId: character.id, itemId: item.id,
          healing: result, healed: Math.min(character.hp.max - character.hp.current, result.total) }];
      }
      case 'drop_item': {
        const item = this.current.items[command.itemId];
        if (!item || item.ownerId !== command.characterId || !character.inventory.includes(item.id)) throw new Error('Character does not own this item.');
        return [{ type: 'item_dropped', itemId: item.id, fromCharacterId: command.characterId, toLocation: 'cellar-chest' }];
      }
      case 'start_combat':
        if (this.current.combat) throw new Error('Combat has already started.');
        if (this.current.npcs['enemy-rat'].status === 'dead') throw new Error('There is no living enemy.');
        if (!this.current.quest.spokeToSera) throw new Error('Talk to Sera before confronting the threat.');
        return [{ type: 'combat_started', order: ['pc-aria', 'pc-borin', 'enemy-rat'] }];
      case 'attack': {
        const combat = this.requirePlayerTurn(command.characterId);
        if (combat.actionUsed) throw new Error('Main action already used this turn.');
        const enemy = this.current.npcs[command.targetId];
        if (enemy.status === 'dead') throw new Error('Target is already defeated.');
        const attack = this.dice.roll(20, character.attackBonus);
        const hit = isAttackHit(attack, enemy.armorClass);
        const damage = hit ? this.dice.roll(character.damageDie, Math.max(0, character.attackBonus - 2)) : null;
        const bounded = boundedDamage(enemy.hp.current, damage?.total ?? 0);
        const events: GameEventData[] = [{ type: 'attack_resolved', attackerId: command.characterId, targetId: command.targetId, attack, hit, damage, appliedDamage: bounded.applied }];
        if (bounded.hp === 0 && enemy.hp.current > 0) {
          events.push({ type: 'experience_awarded', characterId: 'pc-aria', amount: 50, reason: 'rat_defeated' });
          events.push({ type: 'experience_awarded', characterId: 'pc-borin', amount: 50, reason: 'rat_defeated' });
        }
        return events;
      }
      case 'end_turn': {
        const combat = this.requirePlayerTurn(command.characterId);
        let nextIndex = (combat.activeIndex + 1) % combat.order.length;
        let nextRound = combat.round + (nextIndex === 0 ? 1 : 0);
        const events: GameEventData[] = [{ type: 'turn_ended', nextIndex, nextRound }];
        if (combat.order[nextIndex] === 'enemy-rat' && this.current.npcs['enemy-rat'].status === 'alive') {
          const target = this.current.characters['pc-aria'].hp.current > 0 ? this.current.characters['pc-aria'] : this.current.characters['pc-borin'];
          const attack = this.dice.roll(20, 3);
          const hit = isAttackHit(attack, target.armorClass);
          const damage = hit ? this.dice.roll(4, 1) : null;
          const bounded = boundedDamage(target.hp.current, damage?.total ?? 0);
          events.push({ type: 'attack_resolved', attackerId: 'enemy-rat', targetId: target.id, attack, hit, damage, appliedDamage: bounded.applied });
          nextIndex = (nextIndex + 1) % combat.order.length;
          nextRound += nextIndex === 0 ? 1 : 0;
          events.push({ type: 'turn_ended', nextIndex, nextRound });
        }
        return events;
      }
      case 'move':
        if (this.current.combat && this.current.npcs['enemy-rat'].status === 'alive') throw new Error('You cannot leave during active combat.');
        if (!this.current.quest.ratDefeated) throw new Error('The cellar is not safe yet.');
        if (!character.inventory.includes('item-brass-key')) throw new Error('This character needs the brass key.');
        return [
          { type: 'location_changed', characterId: command.characterId, to: command.to },
          { type: 'quest_completed' },
          { type: 'experience_awarded', characterId: 'pc-aria', amount: 250, reason: 'quest_completed' },
          { type: 'experience_awarded', characterId: 'pc-borin', amount: 250, reason: 'quest_completed' },
        ];
      default: {
        const exhaustive: never = command;
        throw new Error(`Unknown command: ${String(exhaustive)}`);
      }
    }
  }

  private requireShop(position: string) {
    if (!this.current.quest.spokeToSera || this.current.combat || this.current.scene !== 'cellar' || position !== 'cellar' || this.current.npcs['npc-sera'].status !== 'alive') {
      throw new Error('Chỉ có thể giao dịch với Sera khi đang ở hầm rượu và không chiến đấu.');
    }
  }

  private requirePlayerTurn(characterId: CharacterId) {
    const combat = this.current.combat;
    if (!combat) throw new Error('Combat has not started.');
    if (combat.order[combat.activeIndex] !== characterId) throw new Error('It is not this character’s turn.');
    return combat;
  }

  private commit(actorId: ActorId, commandId: string, data: GameEventData): GameEvent {
    const event: GameEvent = {
      seq: this.current.version + 1, id: this.idFactory(), campaignId: this.current.campaignId,
      actorId, commandId, previousVersion: this.current.version, createdAt: this.clock(), data,
    };
    this.current = applyEvent(this.current, event);
    this.events.push(event);
    return structuredClone(event);
  }

  private fail(code: CommandFailure['code'], message: string): CommandFailure {
    return { ok: false, code, message, state: this.state };
  }
}
