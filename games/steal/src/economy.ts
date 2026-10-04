// Правила экономики без графики — их легко тестировать.
import { ECONOMY, GOLD, LEVEL_REWARDS, SHOP } from './config';
import { characterById, type CharacterDef } from './data/characters';
import { INCOME_X2 } from './data/shop';
import { t } from './i18n';
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
  return gold ? t.gold.unit(def.name) : def.name;
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

/** Покупка «Доход ×2 навсегда». */
export function purchaseMultiplier(save: SaveData): number {
  return save.purchases.owned.includes(INCOME_X2) ? SHOP.incomeFactor : 1;
}

/** Множители навсегда: печь, перерождения и покупка «Доход ×2» (без ускорителя). */
function steadyFactor(save: SaveData): number {
  return incomeMultiplier(save.upgrades) * rebirthMultiplier(save.rebirths) * purchaseMultiplier(save);
}

/** Во сколько раз больше приносят персонажи: печь, перерождения, покупка «Доход ×2» и ускоритель. */
export function incomeFactor(save: SaveData, now: number): number {
  return steadyFactor(save) * (boostActive(save, now) ? 2 : 1);
}

/** Доход персонажей на полке без печи, перерождений, покупок и ускорителя — по нему растут соседи. */
export function baseIncome(save: SaveData): number {
  return save.slots.reduce((sum, slot) => sum + slotIncome(slot), 0);
}

/** Суммарный доход всех персонажей на полке, монет в секунду (now — для ускорителя). */
export function totalIncome(save: SaveData, now = 0): number {
  return baseIncome(save) * incomeFactor(save, now);
}

/** Доход без ускорителя — с печью, перерождениями и покупкой «Доход ×2»: столько игрок получает обычно (и вне игры). */
export function steadyIncome(save: SaveData): number {
  return baseIncome(save) * steadyFactor(save);
}

/** Сколько стоят персонажи на полке по цене дорожки («Голда» — дороже): мерило уровня игрока для наград. */
export function shelfValue(save: SaveData): number {
  return save.slots.reduce((sum, slot) => {
    const unit = slotUnit(slot);
    return unit ? sum + unitPrice(unit.def, unit.gold) : sum;
  }, 0);
}

/**
 * Награда монетами по уровню игрока: доля стоимости его полки (пока полка дешевле LEVEL_REWARDS.minShelf —
 * доля от minShelf). Растёт вместе с игроком, а с долей меньше 1 не перепрыгивает ступень: на неё не купить
 * больше, чем уже стоит полка. Печь, перерождения, покупки и ускоритель на награду не влияют.
 */
export function levelReward(save: SaveData, share: number): number {
  return Math.round(Math.max(shelfValue(save), LEVEL_REWARDS.minShelf) * share);
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
