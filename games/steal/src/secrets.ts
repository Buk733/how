// Пасхалки без графики: какие найдены и сколько за них дают.
import { SECRET_REWARD } from './config';
import { SECRET_IDS, SECRETS } from './data/secrets';
import { levelReward } from './economy';
import type { SaveData } from './save';

/** Сколько всего пасхалок в игре. */
export const SECRET_COUNT = SECRETS.length;

/** Награда за первую находку: доля стоимости полки игрока. */
export function secretReward(save: SaveData): number {
  return levelReward(save, SECRET_REWARD.share);
}

/**
 * Отмечает пасхалку найденной и начисляет награду.
 * Возвращает награду или null, если её уже находили (или такой пасхалки нет).
 */
export function findSecret(save: SaveData, id: string): number | null {
  if (!SECRET_IDS.has(id) || save.secrets.includes(id)) return null;
  const reward = secretReward(save);
  save.secrets.push(id);
  save.coins += reward;
  return reward;
}
