import { describe, expect, it } from 'vitest';
import { mockSuggestions } from './choices';
import { command, dispatchOk, testEngine } from '../test/helpers';

describe('MockDM suggestions', () => {
  it('suggests rules-valid exploration actions, not free mutation commands', () => {
    const engine = testEngine([0.99]);
    expect(mockSuggestions(engine.state, 'pc-aria').map(c => c.id)).toEqual(['talk','inspect']);
    dispatchOk(engine, command(engine, 'pc-aria', { type: 'talk_to_sera' }));
    dispatchOk(engine, command(engine, 'pc-aria', { type: 'inspect_chest' }));
    expect(mockSuggestions(engine.state, 'pc-aria').map(c => c.id)).toEqual(['pickup','combat']);
    const first = mockSuggestions(engine.state,'pc-aria')[0];
    const character = engine.state.characters['pc-aria'];
    const built = first.build({ commandId:'suggestion-1', actorId:character.controllerId, expectedVersion:engine.state.version, characterId:character.id });
    expect(built).toMatchObject({type:'pickup_item', itemId:'item-brass-key'});
  });
});
