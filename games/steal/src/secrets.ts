// Пасхалки без графики: какие найдены и сколько за них дают.
import { SECRET_REWARD } from './config';
import { SECRET_IDS, SECRETS } from './data/secrets';
import type { SaveData } from './save';

/** Сколько всего пасхалок в игре. */
export const SECRET_COUNT = SECRETS.length;

/** Награда за первую находку: минута дохода, но не меньше SECRET_REWARD.min. */
export function secretReward(income: number): number {
  return Math.max(SECRET_REWARD.min, Math.round(income * SECRET_REWARD.seconds));
}

/**
 * Отмечает пасхалку найденной и начисляет награду.
 * Возвращает награду или null, если её уже находили (или такой пасхалки нет).
 */
export function findSecret(save: SaveData, id: string, income: number): number | null {
  if (!SECRET_IDS.has(id) || save.secrets.includes(id)) return null;
  save.secrets.push(id);
  const reward = secretReward(income);
  save.coins += reward;
  return reward;
}
