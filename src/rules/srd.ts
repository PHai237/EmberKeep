import type { Ability, Character, RollResult, Skill } from '../domain/types.ts';

export const SKILL_ABILITIES: Record<Skill, Ability> = {
  athletics: 'strength',
  stealth: 'dexterity',
  investigation: 'intelligence',
  perception: 'wisdom',
  persuasion: 'charisma',
};

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function skillModifier(character: Character, skill: Skill): number {
  const base = abilityModifier(character.abilities[SKILL_ABILITIES[skill]]);
  return base + (character.proficientSkills.includes(skill) ? character.proficiencyBonus : 0);
}

export function boundedDamage(currentHp: number, damage: number): { hp: number; applied: number } {
  if (!Number.isInteger(damage) || damage < 0) throw new Error('Damage must be a non-negative integer.');
  const hp = Math.max(0, currentHp - damage);
  return { hp, applied: currentHp - hp };
}

export function isAttackHit(attack: RollResult, armorClass: number): boolean {
  const natural = attack.rolls[0];
  if (natural === 1) return false;
  if (natural === 20) return true;
  return attack.total >= armorClass;
}
