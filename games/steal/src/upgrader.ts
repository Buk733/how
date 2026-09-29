// Парилка (апгрейдер) без графики: отдаёшь персонажа и с видимым шансом получаешь более ценного.
import type { Rng } from '@engine/rng';
import { UPGRADER } from './config';
import type { CharacterDef } from './data/characters';
import { unitPrice } from './economy';

export interface UpgradeTarget {
  readonly def: CharacterDef;
  readonly gold: boolean;
  /** Шанс успеха, 0…1. */
  readonly chance: number;
}

/**
 * Шанс превратить персонажа ценностью from в персонажа ценностью to.
 * Чем больше разница, тем меньше шанс; парилка забирает немного ценности (efficiency < 1).
 */
export function upgradeChance(from: number, to: number): number {
  return Math.min(UPGRADER.maxChance, (UPGRADER.efficiency * from) / to);
}

/** Во что можно превратить персонажа: всё ценнее его (включая его же «Голду»), по возрастанию цены. */
export function upgradeTargets(def: CharacterDef, gold: boolean, characters: readonly CharacterDef[]): UpgradeTarget[] {
  const value = unitPrice(def, gold);
  return characters
    .flatMap((target) => [false, true].map((targetGold) => ({ def: target, gold: targetGold, value: unitPrice(target, targetGold) })))
    .filter((t) => t.value > value)
    .map((t) => ({ def: t.def, gold: t.gold, chance: upgradeChance(value, t.value), value: t.value }))
    .filter((t) => t.chance >= UPGRADER.minChance)
    .sort((a, b) => a.value - b.value)
    .map(({ def: target, gold: targetGold, chance }) => ({ def: target, gold: targetGold, chance }));
}

/** Бросок парилки: roll — где остановился градусник (0…1), успех — если ниже шанса. */
export function rollUpgrade(rng: Rng, chance: number): { readonly roll: number; readonly success: boolean } {
  const roll = rng.next();
  return { roll, success: roll < chance };
}
