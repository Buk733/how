// Доход вне игры без графики: сколько персонажи «напарили», пока игрока не было.
import { OFFLINE } from './config';
import { steadyIncome } from './economy';
import type { SaveData } from './save';

export interface OfflineEarnings {
  /** Сколько секунд игрока не было на самом деле. */
  readonly away: number;
  /** Сколько из них засчитано (не больше OFFLINE.maxHours). */
  readonly seconds: number;
  readonly coins: number;
}

/**
 * Доход за время отсутствия — с последнего сохранения до now (мс): доля OFFLINE.rate
 * обычного дохода с печью и перерождениями, без ускорителя. null — игры ещё не было,
 * отлучка короткая или на полке никого.
 */
export function offlineEarnings(save: SaveData, now: number): OfflineEarnings | null {
  if (save.savedAt <= 0) return null;
  const away = (now - save.savedAt) / 1000;
  if (away < OFFLINE.minMinutes * 60) return null;
  const seconds = Math.min(away, OFFLINE.maxHours * 3600);
  const coins = Math.floor(steadyIncome(save) * OFFLINE.rate * seconds);
  return coins > 0 ? { away, seconds, coins } : null;
}
