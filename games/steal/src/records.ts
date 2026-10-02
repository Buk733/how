// Таблица рекордов без графики: когда отправлять лучший доход.
import { LEADERBOARD } from './config';

/**
 * Какой результат отправить в таблицу рекордов (null — пока не надо): лучший доход вырос
 * хотя бы в LEADERBOARD.minGrowth раз с прошлой отправки и прошло не меньше LEADERBOARD.interval секунд.
 */
export function scoreToSend(best: number, lastSent: number, secondsSinceSent: number): number | null {
  const score = Math.floor(best);
  if (score <= 0 || secondsSinceSent < LEADERBOARD.interval) return null;
  return lastSent <= 0 || score >= lastSent * LEADERBOARD.minGrowth ? score : null;
}
