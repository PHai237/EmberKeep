import { GameEngine } from '../domain/engine';
import { DiceRoller } from '../rules/dice';
import type { CharacterId, GameCommand } from '../domain/types';

type CommandPayload = GameCommand extends infer Command
  ? Command extends GameCommand
    ? Omit<Command, 'commandId' | 'actorId' | 'expectedVersion' | 'characterId'>
    : never
  : never;

export function sequenceRandom(values: number[], fallback = 0.5): () => number {
  let index = 0;
  return () => values[index++] ?? fallback;
}

export function testEngine(values: number[] = [0.75]): GameEngine {
  let id = 0;
  return new GameEngine({
    dice: new DiceRoller(sequenceRandom(values)),
    clock: () => '2026-11-08T00:00:00.000Z',
    idFactory: () => `event-${++id}`,
  });
}

export function command(engine: GameEngine, characterId: CharacterId, value: CommandPayload, commandId: string = crypto.randomUUID()): GameCommand {
  return {
    ...value,
    commandId,
    actorId: engine.state.characters[characterId].controllerId,
    expectedVersion: engine.state.version,
    characterId,
  } as GameCommand;
}

export function dispatchOk(engine: GameEngine, value: GameCommand) {
  const result = engine.dispatch(value);
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
  return result;
}

export function prepareChest(engine: GameEngine, characterId: CharacterId = 'pc-aria') {
  dispatchOk(engine, command(engine, characterId, { type: 'inspect_chest' }));
}

export function prepareCombat(engine: GameEngine) {
  dispatchOk(engine, command(engine, 'pc-aria', { type: 'talk_to_sera' }));
  dispatchOk(engine, command(engine, 'pc-aria', { type: 'start_combat' }));
}
