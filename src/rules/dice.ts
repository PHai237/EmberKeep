import type { Die, RollResult } from '../domain/types.ts';

export type RandomSource = () => number;

export class DiceRoller {
  constructor(private readonly random: RandomSource = Math.random) {}

  roll(die: Die, modifier = 0, count = 1): RollResult {
    if (![4, 6, 8, 10, 12, 20, 100].includes(die)) throw new Error('Unsupported die.');
    if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('Invalid dice count.');
    if (!Number.isInteger(modifier)) throw new Error('Modifier must be an integer.');
    const rolls = Array.from({ length: count }, () => {
      const value = this.random();
      if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('RNG must return a value in [0, 1).');
      return Math.floor(value * die) + 1;
    });
    return { die, rolls, modifier, total: rolls.reduce((sum, roll) => sum + roll, modifier) };
  }
}
