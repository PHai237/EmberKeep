import { describe, expect, it } from 'vitest';
import { GameEngine } from '../domain/engine';
import { command, dispatchOk, testEngine } from '../test/helpers';
import { checksumRecord, deserializeCampaign, serializeCampaign } from './storage';

describe('save, load, replay, and event integrity', () => {
  it('round-trips to an equivalent state hash and exact event log (acceptance 14)', () => {
    const engine = testEngine([0.8]);
    dispatchOk(engine, command(engine, 'pc-aria', { type: 'talk_to_sera' }));
    dispatchOk(engine, command(engine, 'pc-borin', { type: 'roll_dice', die: 100, modifier: 2 }));
    const json = serializeCampaign(engine.exportRecord(), '2026-11-08T00:00:00.000Z');
    const record = deserializeCampaign(json);
    const loaded = new GameEngine({ record });
    expect(loaded.state).toEqual(engine.state);
    expect(loaded.eventLog).toEqual(engine.eventLog);
    expect(checksumRecord(loaded.exportRecord())).toBe(checksumRecord(engine.exportRecord()));
  });

  it('rejects a modified confirmed event', () => {
    const engine = testEngine();
    const parsed = JSON.parse(serializeCampaign(engine.exportRecord()));
    parsed.record.events[0].data.initialState.characters['pc-aria'].hp.current = 999;
    expect(() => deserializeCampaign(JSON.stringify(parsed))).toThrow('checksum');
  });

  it('survives 50+ two-player actions and a reload halfway', () => {
    let engine = testEngine(Array(70).fill(0.5));
    for (let index = 0; index < 60; index += 1) {
      const id = index % 2 === 0 ? 'pc-aria' : 'pc-borin';
      dispatchOk(engine, command(engine, id, { type: 'roll_dice', die: 20, modifier: index % 4 }, `roll-${index}`));
      if (index === 29) engine = new GameEngine({ record: deserializeCampaign(serializeCampaign(engine.exportRecord())) });
    }
    expect(engine.eventLog.filter((event) => event.data.type === 'dice_rolled')).toHaveLength(60);
    expect(engine.state.version).toBe(61);
  });
});
