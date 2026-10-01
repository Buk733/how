// Перерождение без графики: цена, множитель дохода и что сбрасывается.
import { ECONOMY, REBIRTH } from './config';
import { emptySlot, type SaveData } from './save';
import { createUpgradeLevels } from './upgrades';

/** Во сколько раз больше доход после rebirths перерождений: ×1, ×1,5, ×2… */
export function rebirthMultiplier(rebirths: number): number {
  return 1 + REBIRTH.incomeBonus * rebirths;
}

/** Сколько монет нужно на следующее перерождение, если уже было rebirths. */
export function rebirthCost(rebirths: number): number {
  return REBIRTH.firstCost * REBIRTH.costGrowth ** rebirths;
}

export function canRebirth(save: SaveData): boolean {
  return save.coins >= rebirthCost(save.rebirths);
}

/**
 * Перерождение: монеты, персонажи на полке, открытые места, прокачка и лучший доход
 * (по нему растут соседи) — с нуля, а доход навсегда больше. Остаются альбом, пасхалки,
 * ключи от кейсов, таймеры кейса и колеса, серия ежедневных наград, герой и настройки.
 * Полки соседей пересаживает тот, кто их показывает. false — не хватает монет.
 */
export function rebirth(save: SaveData): boolean {
  if (!canRebirth(save)) return false;
  save.rebirths++;
  save.coins = ECONOMY.startCoins;
  save.unlocked = ECONOMY.freeSlots;
  save.slots = Array.from({ length: ECONOMY.totalSlots }, emptySlot);
  save.upgrades = createUpgradeLevels();
  save.stats.peakIncome = 0;
  return true;
}
