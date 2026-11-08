import { describe, expect, it } from 'vitest';
import { MockDM } from '../dm/MockDM';
import { applyEvent } from './reducer';
import { command, dispatchOk, prepareChest, prepareCombat, testEngine } from '../test/helpers';

describe('authoritative command engine', () => {
  it('rejects a forged action for the other player with no event (acceptance 1/2)', () => {
    const engine = testEngine();
    const before = engine.eventLog.length;
    const forged = command(engine, 'pc-borin', { type: 'submit_action', text: 'Attack Sera' });
    forged.actorId = 'player-a';
    const result = engine.dispatch(forged);
    expect(result).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(engine.eventLog).toHaveLength(before);
  });

  it('keeps a rolled failure immutable when narration claims success (acceptance 3/12)', () => {
    const engine = testEngine([0.3]); // natural 7 + Aria investigation 4 = 11
    const result = dispatchOk(engine, command(engine, 'pc-aria', { type: 'inspect_chest' }));
    const check = result.events[0];
    expect(check.data.type === 'check_resolved' && check.data.result.success).toBe(false);
    engine.addNarration('lying-summary', check.id, 'Critical success! The chest opens.');
    expect(engine.state.quest.chestInspected).toBe(false);
  });

  it('allows a unique pickup once and makes retries idempotent (acceptance 5)', () => {
    const engine = testEngine([0.9]);
    prepareChest(engine);
    const pickup = command(engine, 'pc-aria', { type: 'pickup_item', itemId: 'item-brass-key' }, 'pickup-once');
    dispatchOk(engine, pickup);
    dispatchOk(engine, pickup);
    expect(engine.state.characters['pc-aria'].inventory.filter((id) => id === 'item-brass-key')).toHaveLength(1);
    expect(engine.eventLog.filter((event) => event.data.type === 'item_transferred')).toHaveLength(1);
  });

  it('resolves a two-player stale-version pickup race coherently (acceptance 6)', () => {
    const engine = testEngine([0.9]);
    prepareChest(engine);
    const version = engine.state.version;
    const aria = command(engine, 'pc-aria', { type: 'pickup_item', itemId: 'item-brass-key' });
    const borin = command(engine, 'pc-borin', { type: 'pickup_item', itemId: 'item-brass-key' });
    aria.expectedVersion = version; borin.expectedVersion = version;
    expect(engine.dispatch(aria).ok).toBe(true);
    expect(engine.dispatch(borin)).toMatchObject({ ok: false, code: 'CONFLICT' });
    const retry = command(engine, 'pc-borin', { type: 'pickup_item', itemId: 'item-brass-key' });
    expect(engine.dispatch(retry)).toMatchObject({ ok: false, code: 'INVALID' });
    const owners = Object.values(engine.state.characters).filter((pc) => pc.inventory.includes('item-brass-key'));
    expect(owners).toHaveLength(1);
  });

  it('adds and removes inventory only through validated ownership events', () => {
    const engine = testEngine([0.9]);
    prepareChest(engine);
    dispatchOk(engine, command(engine, 'pc-aria', { type: 'pickup_item', itemId: 'item-brass-key' }));
    expect(engine.dispatch(command(engine, 'pc-borin', { type: 'drop_item', itemId: 'item-brass-key' }))).toMatchObject({ ok: false, code: 'INVALID' });
    dispatchOk(engine, command(engine, 'pc-aria', { type: 'drop_item', itemId: 'item-brass-key' }));
    expect(engine.state.characters['pc-aria'].inventory).not.toContain('item-brass-key');
    expect(engine.state.items['item-brass-key']).toMatchObject({ ownerId: null, location: 'cellar-chest' });
  });

  it('enforces initiative order and one main action per turn', () => {
    const engine = testEngine([0.6, 0.1, 0.6, 0.5]);
    prepareCombat(engine);
    expect(engine.dispatch(command(engine, 'pc-borin', { type: 'attack', targetId: 'enemy-rat' }))).toMatchObject({ ok: false, code: 'INVALID' });
    dispatchOk(engine, command(engine, 'pc-aria', { type: 'attack', targetId: 'enemy-rat' }));
    expect(engine.dispatch(command(engine, 'pc-aria', { type: 'attack', targetId: 'enemy-rat' }))).toMatchObject({ ok: false, code: 'INVALID' });
    dispatchOk(engine, command(engine, 'pc-aria', { type: 'end_turn' }));
    expect(engine.state.combat?.order[engine.state.combat.activeIndex]).toBe('pc-borin');
  });

  it('keeps a defeated NPC dead despite later prose (acceptance 9)', async () => {
    const engine = testEngine([0.99, 0.99]);
    prepareCombat(engine);
    const result = dispatchOk(engine, command(engine, 'pc-aria', { type: 'attack', targetId: 'enemy-rat' }));
    expect(engine.state.npcs['enemy-rat'].status).toBe('dead');
    engine.addNarration('bad-continuity', result.events[0].id, 'The rat greets you cheerfully.');
    expect(engine.state.npcs['enemy-rat'].status).toBe('dead');
    expect(engine.dispatch(command(engine, 'pc-aria', { type: 'attack', targetId: 'enemy-rat' }))).toMatchObject({ ok: false });
    await expect(new MockDM().narrate(result.events[0], engine.state)).resolves.toMatchObject({ basedOnEventId: result.events[0].id });
  });

  it('rejects malformed committed damage beyond remaining HP', () => {
    const engine = testEngine();
    const state = engine.state;
    expect(() => applyEvent(state, {
      seq: state.version + 1, id: 'malicious', campaignId: 'phase-1-demo', actorId: 'system', commandId: 'malicious', previousVersion: state.version,
      createdAt: '2026-11-08T00:00:00.000Z',
      data: { type: 'attack_resolved', attackerId: 'pc-aria', targetId: 'enemy-rat', attack: { die: 20, rolls: [20], modifier: 5, total: 25 }, hit: true, damage: { die: 6, rolls: [6], modifier: 3, total: 9 }, appliedDamage: 999 },
    })).toThrow('HP bounds');
  });

  it('does not expose mutable state or event references', () => {
    const engine = testEngine();
    const leakedState = engine.state;
    leakedState.characters['pc-aria'].hp.current = 999;
    const leakedEvents = engine.eventLog;
    leakedEvents[0].data = { type: 'quest_completed' };
    expect(engine.state.characters['pc-aria'].hp.current).toBe(9);
    expect(engine.state.quest.completed).toBe(false);
  });
});
