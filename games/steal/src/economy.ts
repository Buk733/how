// Правила экономики без графики — их легко тестировать.
import { ECONOMY } from './config';
import { characterById, type CharacterDef } from './data/characters';
import type { SaveData } from './save';

export interface SlotChoice {
  /** Номер места на полке. */
  readonly slot: number;
  /** Кого придётся заменить (null — место свободно). */
  readonly replaces: CharacterDef | null;
}

export type PurchaseCheck = ({ readonly ok: true } & SlotChoice) | { readonly ok: false; readonly reason: 'coins' | 'space' };

/**
 * Куда сядет новый персонаж: на первое свободное место, а если мест нет —
 * вместо самого слабого, но только если новый доходнее. null — места нет.
 */
export function findSlotFor(save: SaveData, def: CharacterDef): SlotChoice | null {
  for (let i = 0; i < save.unlocked; i++) {
    if (!save.slots[i]?.id) return { slot: i, replaces: null };
  }
  let weakest = -1;
  let weakestIncome = Infinity;
  for (let i = 0; i < save.unlocked; i++) {
    const income = incomeOf(save.slots[i]?.id);
    if (income < weakestIncome) {
      weakestIncome = income;
      weakest = i;
    }
  }
  if (weakest >= 0 && def.income > weakestIncome) {
    return { slot: weakest, replaces: characterById(save.slots[weakest].id ?? '') ?? null };
  }
  return null;
}

/** Можно ли купить персонажа и на какое место он сядет. */
export function checkPurchase(save: SaveData, def: CharacterDef): PurchaseCheck {
  if (save.coins < def.price) return { ok: false, reason: 'coins' };
  const choice = findSlotFor(save, def);
  return choice ? { ok: true, ...choice } : { ok: false, reason: 'space' };
}

function incomeOf(id: string | null | undefined): number {
  return id ? (characterById(id)?.income ?? 0) : 0;
}

/** Суммарный доход всех персонажей на полке, монет в секунду. */
export function totalIncome(save: SaveData): number {
  return save.slots.reduce((sum, slot) => sum + incomeOf(slot.id), 0);
}

/** Сколько вернут за персонажа, которого заменили. */
export function sellValue(def: CharacterDef): number {
  return Math.floor(def.price * ECONOMY.sellRatio);
}

/** Цена открытия места с номером index или null, если место уже бесплатное или мест больше нет. */
export function unlockCost(index: number): number | null {
  if (index < ECONOMY.freeSlots || index >= ECONOMY.totalSlots) return null;
  return ECONOMY.unlockCosts[index - ECONOMY.freeSlots] ?? null;
}
