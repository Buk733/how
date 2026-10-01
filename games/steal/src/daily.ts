// Ежедневные награды без графики: календарь на 7 дней и серия заходов подряд.
import type { SaveData } from './save';
import { coinsPrize, dayKey, startBoost } from './wheel';

export type DailyPrize =
  | { readonly kind: 'coins'; readonly minutes: number; readonly minCoins: number }
  | { readonly kind: 'key'; readonly caseId: string }
  | { readonly kind: 'boost'; readonly minutes: number };

export interface DailyReward {
  readonly prize: DailyPrize;
  readonly icon: string;
  readonly label: string;
}

/**
 * Награда за каждый день серии. Седьмой — самый ценный, дальше календарь идёт по кругу.
 * Монеты — минуты дохода игрока, но не меньше minCoins.
 */
export const DAILY: readonly DailyReward[] = [
  { prize: { kind: 'coins', minutes: 3, minCoins: 300 }, icon: '💰', label: 'Монеты' },
  { prize: { kind: 'key', caseId: 'bath' }, icon: '🪣', label: 'Банный кейс' },
  { prize: { kind: 'coins', minutes: 10, minCoins: 1000 }, icon: '💰', label: 'Много монет' },
  { prize: { kind: 'boost', minutes: 10 }, icon: '⚡', label: '×2 доход на 10 мин' },
  { prize: { kind: 'key', caseId: 'meme' }, icon: '🎭', label: 'Мемный кейс' },
  { prize: { kind: 'coins', minutes: 30, minCoins: 3000 }, icon: '💰', label: 'Гора монет' },
  { prize: { kind: 'key', caseId: 'gold' }, icon: '👑', label: 'Золотой кейс' },
];

const DAY = 86_400_000;

export interface DailyState {
  /** Сегодняшнюю награду ещё можно забрать. */
  readonly available: boolean;
  /** Какой по счёту день серии сегодня: уже забранный или тот, что можно забрать. */
  readonly streak: number;
  /** Клетка календаря (0…6) для сегодняшнего дня серии. */
  readonly index: number;
  /** Через сколько мс начнутся следующие сутки (по UTC, как и спины колеса). */
  readonly nextIn: number;
}

/** Серия продолжается, если вчера награду забирали; пропущен день — снова с первого. */
export function dailyState(save: SaveData, now: number): DailyState {
  const nextIn = DAY - (now % DAY);
  if (save.daily.day === dayKey(now)) {
    const streak = Math.max(1, save.daily.streak);
    return { available: false, streak, index: (streak - 1) % DAILY.length, nextIn };
  }
  const streak = save.daily.day === dayKey(now - DAY) ? save.daily.streak + 1 : 1;
  return { available: true, streak, index: (streak - 1) % DAILY.length, nextIn };
}

/** Сколько монет даст денежная награда при таком доходе. */
export function dailyCoins(prize: DailyPrize, incomePerSecond: number): number {
  return prize.kind === 'coins' ? coinsPrize(prize, incomePerSecond) : 0;
}

/**
 * Забирает сегодняшнюю награду: выдаёт её и продлевает серию.
 * Возвращает, что выдано (и сколько монет), или null, если сегодня уже забирали.
 */
export function claimDaily(save: SaveData, now: number, incomePerSecond: number): { reward: DailyReward; coins: number } | null {
  const state = dailyState(save, now);
  if (!state.available) return null;
  save.daily = { day: dayKey(now), streak: state.streak };
  const reward = DAILY[state.index];
  const { prize } = reward;
  const coins = dailyCoins(prize, incomePerSecond);
  if (prize.kind === 'coins') save.coins += coins;
  else if (prize.kind === 'key') save.keys[prize.caseId] = (save.keys[prize.caseId] ?? 0) + 1;
  else startBoost(save, now, prize.minutes);
  return { reward, coins };
}
