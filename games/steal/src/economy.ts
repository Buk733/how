// Правила экономики без графики — их легко тестировать.
import { ECONOMY, GOLD } from './config';
import { characterById, type CharacterDef } from './data/characters';
import { rebirthMultiplier } from './rebirth';
import type { SaveData, SlotSave } from './save';
import { incomeMultiplier } from './upgrades';

/** Персонаж с вариантом: обычный или «Голда». */
export interface Unit {
  readonly def: CharacterDef;
  readonly gold: boolean;
}

export interface SlotChoice {
  /** Номер места на полке. */
  readonly slot: number;
  /** Кого придётся заменить (null — место свободно). */
  readonly replaces: Unit | null;
}

export type PurchaseCheck = ({ readonly ok: true } & SlotChoice) | { readonly ok: false; readonly reason: 'coins' | 'space' };

/** Доход персонажа в секунду («Голда» — вдвое больше). */
export function unitIncome(def: CharacterDef, gold: boolean): number {
  return gold ? def.income * GOLD.incomeFactor : def.income;
}

/** Цена персонажа («Голда» — дороже). */
export function unitPrice(def: CharacterDef, gold: boolean): number {
  return gold ? Math.round(def.price * GOLD.priceFactor) : def.price;
}

/** Имя для текстов: «Хамам» или «Хамам · Голда». */
export function unitName(def: CharacterDef, gold: boolean): string {
  return gold ? `${def.name} · Голда` : def.name;
}

/** Персонаж на месте полка (или null, если место пустое). */
export function slotUnit(slot: SlotSave | undefined): Unit | null {
  const def = slot?.id ? characterById(slot.id) : undefined;
  return def && slot ? { def, gold: slot.gold } : null;
}

function slotIncome(slot: SlotSave | undefined): number {
  const unit = slotUnit(slot);
  return unit ? unitIncome(unit.def, unit.gold) : 0;
}

/**
 * Куда сядет новый персонаж: на первое свободное место, а если мест нет —
 * вместо самого слабого, но только если новый доходнее. null — места нет.
 */
export function findSlotFor(save: SaveData, def: CharacterDef, gold = false): SlotChoice | null {
  for (let i = 0; i < save.unlocked; i++) {
    if (!save.slots[i]?.id) return { slot: i, replaces: null };
  }
  let weakest = -1;
  let weakestIncome = Infinity;
  for (let i = 0; i < save.unlocked; i++) {
    const income = slotIncome(save.slots[i]);
    if (income < weakestIncome) {
      weakestIncome = income;
      weakest = i;
    }
  }
  if (weakest >= 0 && unitIncome(def, gold) > weakestIncome) {
    return { slot: weakest, replaces: slotUnit(save.slots[weakest]) };
  }
  return null;
}

/** Можно ли купить персонажа и на какое место он сядет. */
export function checkPurchase(save: SaveData, def: CharacterDef, gold = false): PurchaseCheck {
  if (save.coins < unitPrice(def, gold)) return { ok: false, reason: 'coins' };
  const choice = findSlotFor(save, def, gold);
  return choice ? { ok: true, ...choice } : { ok: false, reason: 'space' };
}

/** Действует ли ускоритель «×2 к доходу» в момент now (Date.now, мс). */
export function boostActive(save: SaveData, now: number): boolean {
  return now < save.boostUntil;
}

/** Во сколько раз больше приносят персонажи: печь, перерождения и ускоритель. */
export function incomeFactor(save: SaveData, now: number): number {
  return incomeMultiplier(save.upgrades) * rebirthMultiplier(save.rebirths) * (boostActive(save, now) ? 2 : 1);
}

/** Доход персонажей на полке без печи, перерождений и ускорителя — по нему растут соседи. */
export function baseIncome(save: SaveData): number {
  return save.slots.reduce((sum, slot) => sum + slotIncome(slot), 0);
}

/** Суммарный доход всех персонажей на полке, монет в секунду (now — для ускорителя). */
export function totalIncome(save: SaveData, now = 0): number {
  return baseIncome(save) * incomeFactor(save, now);
}

/** Сколько вернут за персонажа, которого заменили или продали. */
export function sellValue(def: CharacterDef, gold = false): number {
  return Math.floor(unitPrice(def, gold) * ECONOMY.sellRatio);
}

/** Цена открытия места с номером index или null, если место уже бесплатное или мест больше нет. */
export function unlockCost(index: number): number | null {
  if (index < ECONOMY.freeSlots || index >= ECONOMY.totalSlots) return null;
  return ECONOMY.unlockCosts[index - ECONOMY.freeSlots] ?? null;
}
