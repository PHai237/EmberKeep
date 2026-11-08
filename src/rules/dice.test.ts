import { describe, expect, it } from 'vitest';
import { DiceRoller } from './dice';
import { abilityModifier, boundedDamage, isAttackHit } from './srd';
import { sequenceRandom } from '../test/helpers';

describe('dice and SRD math', () => {
  it.each([4, 6, 8, 10, 12, 20, 100] as const)('rolls a genuine d%i within bounds', (die) => {
    const dice = new DiceRoller(sequenceRandom([0, 0.999999]));
    expect(dice.roll(die).rolls[0]).toBe(1);
    expect(dice.roll(die).rolls[0]).toBe(die);
  });

  it('applies integer modifiers to the rolled total', () => {
    expect(new DiceRoller(() => 0.45).roll(20, 3)).toEqual({ die: 20, rolls: [10], modifier: 3, total: 13 });
  });

  it('uses the ability modifier floor rule', () => {
    expect(abilityModifier(9)).toBe(-1);
    expect(abilityModifier(16)).toBe(3);
  });

  it('bounds damage at zero HP and rejects negative damage', () => {
    expect(boundedDamage(5, 999)).toEqual({ hp: 0, applied: 5 });
    expect(() => boundedDamage(5, -1)).toThrow();
  });

  it('honors natural 1 and natural 20 for attacks', () => {
    expect(isAttackHit({ die: 20, rolls: [1], modifier: 99, total: 100 }, 10)).toBe(false);
    expect(isAttackHit({ die: 20, rolls: [20], modifier: -10, total: 10 }, 30)).toBe(true);
  });
});
