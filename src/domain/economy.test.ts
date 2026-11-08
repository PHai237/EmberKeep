import { describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { command, dispatchOk, testEngine } from '../test/helpers';
import { deserializeCampaign, serializeCampaign } from '../persistence/storage';

describe('authoritative character progression and trade ledger', () => {
  it('purchases, sells and persists item ownership and currency', () => {
    const engine = testEngine();
    dispatchOk(engine, command(engine, 'pc-aria', { type: 'talk_to_sera' }));
    dispatchOk(engine, command(engine, 'pc-aria', { type: 'buy_item', catalogId: 'healing-potion' }));
    const aria = engine.state.characters['pc-aria'];
    expect(aria.gold).toBe(10);
    const potionId = aria.inventory.find(id => id.startsWith('shop-'))!;
    expect(engine.state.items[potionId]).toMatchObject({ ownerId: 'pc-aria', catalogId: 'healing-potion' });
    expect(engine.dispatch(command(engine, 'pc-borin', { type: 'sell_item', itemId: potionId }))).toMatchObject({ ok: false, code: 'INVALID' });
    dispatchOk(engine, command(engine, 'pc-aria', { type: 'sell_item', itemId: potionId }));
    expect(engine.state.characters['pc-aria'].gold).toBe(15);
    expect(engine.state.items[potionId]).toBeUndefined();
    const restored = new GameEngine({ record: deserializeCampaign(serializeCampaign(engine.exportRecord())) });
    expect(restored.state).toEqual(engine.state);
  });

  it('rejects buying without funds and quest-item sales', () => {
    const engine = testEngine([0.9]);
    dispatchOk(engine, command(engine, 'pc-aria', { type: 'talk_to_sera' }));
    dispatchOk(engine, command(engine, 'pc-aria', { type: 'inspect_chest' }));
    dispatchOk(engine, command(engine, 'pc-aria', { type: 'pickup_item', itemId: 'item-brass-key' }));
    expect(engine.dispatch(command(engine, 'pc-aria', { type: 'sell_item', itemId: 'item-brass-key' }))).toMatchObject({ ok: false, code: 'INVALID' });
    dispatchOk(engine, command(engine, 'pc-aria', { type: 'buy_item', catalogId: 'healing-potion' }));
    dispatchOk(engine, command(engine, 'pc-aria', { type: 'buy_item', catalogId: 'healing-potion' }));
    expect(engine.dispatch(command(engine, 'pc-aria', { type: 'buy_item', catalogId: 'torch' }))).toMatchObject({ ok: false, code: 'INVALID' });
  });

  it('rewards the party after the rat and the quest, leveling both to two', () => {
    const engine = testEngine([0.99]);
    dispatchOk(engine, command(engine, 'pc-aria', { type: 'talk_to_sera' }));
    dispatchOk(engine, command(engine, 'pc-aria', { type: 'inspect_chest' }));
    dispatchOk(engine, command(engine, 'pc-aria', { type: 'pickup_item', itemId: 'item-brass-key' }));
    dispatchOk(engine, command(engine, 'pc-aria', { type: 'start_combat' }));
    dispatchOk(engine, command(engine, 'pc-aria', { type: 'attack', targetId: 'enemy-rat' }));
    expect(engine.state.combat).toBeNull();
    expect(engine.state.characters['pc-aria'].xp).toBe(50);
    dispatchOk(engine, command(engine, 'pc-aria', { type: 'move', to: 'courtyard' }));
    for (const character of Object.values(engine.state.characters)) {
      expect(character.level).toBe(2);
      expect(character.xp).toBe(300);
      expect(character.hp.max).toBeGreaterThan(9);
    }
  });

  it('consumes a healing potion exactly once and limits recovery to missing HP', () => {
    const engine = testEngine([0.9,0.9,0.9,0.1,0.1]);
    dispatchOk(engine, command(engine, 'pc-aria', { type: 'talk_to_sera' }));
    dispatchOk(engine, command(engine, 'pc-aria', { type: 'buy_item', catalogId: 'healing-potion' }));
    const potionId = engine.state.characters['pc-aria'].inventory.find(id => id.startsWith('shop-'))!;
    expect(engine.dispatch(command(engine, 'pc-aria', { type: 'use_item', itemId: potionId }))).toMatchObject({ ok:false, code:'INVALID' }); // full HP
    // Existing game engine only permits damage through combat: simulate rat attacking Aria.
    dispatchOk(engine, command(engine, 'pc-aria', { type: 'start_combat' }));
    dispatchOk(engine, command(engine, 'pc-aria', { type: 'end_turn' }));
    dispatchOk(engine, command(engine, 'pc-borin', { type: 'end_turn' }));
    const damaged = engine.state.characters['pc-aria'].hp.current;
    expect(damaged).toBeLessThan(9);
    dispatchOk(engine, command(engine, 'pc-aria', { type: 'use_item', itemId: potionId }));
    expect(engine.state.characters['pc-aria'].hp.current).toBeGreaterThan(damaged);
    expect(engine.state.characters['pc-aria'].inventory).not.toContain(potionId);
    expect(engine.dispatch(command(engine, 'pc-aria', { type: 'use_item', itemId: potionId }))).toMatchObject({ ok: false, code: 'INVALID' });
  });

  it('loads pre-economy saves without losing event history', () => {
    const engine = testEngine();
    const record = engine.exportRecord();
    const initial = record.events[0].data;
    if (initial.type !== 'campaign_created') throw new Error('Expected initial event');
    for (const pc of Object.values(initial.initialState.characters)) {
      delete (pc as Partial<typeof pc>).xp;
      delete (pc as Partial<typeof pc>).gold;
    }
    const loaded = new GameEngine({ record: deserializeCampaign(serializeCampaign(record)) });
    expect(loaded.state.characters['pc-aria']).toMatchObject({ level: 1, xp: 0, gold: 20 });
    expect(loaded.eventLog).toHaveLength(1);
  });
});
