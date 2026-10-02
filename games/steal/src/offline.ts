// Доход вне игры без графики: сколько персонажи «напарили», пока игрока не было.
import { OFFLINE } from './config';
import { steadyIncome } from './economy';
import type { SaveData } from './save';

export interface OfflineEarnings {
  /** Сколько секунд игрока не было. */
  readonly away: number;
  /** Накопилось бы больше, но награда упёрлась в потолок — долю OFFLINE.maxShare монет игрока. */
  readonly capped: boolean;
  readonly coins: number;
}

/**
 * Доход за время отсутствия — с последнего сохранения до now (мс): доля OFFLINE.rate
 * обычного дохода с печью и перерождениями, без ускорителя, но не больше доли OFFLINE.maxShare
 * монет игрока. null — игры ещё не было, отлучка короткая, на полке никого или монет нет.
 */
export function offlineEarnings(save: SaveData, now: number): OfflineEarnings | null {
  if (save.savedAt <= 0) return null;
  const away = (now - save.savedAt) / 1000;
  if (away < OFFLINE.minMinutes * 60) return null;
  const earned = Math.floor(steadyIncome(save) * OFFLINE.rate * away);
  const cap = Math.floor(save.coins * OFFLINE.maxShare);
  const coins = Math.min(earned, cap);
  return coins > 0 ? { away, capped: earned > cap, coins } : null;
}
