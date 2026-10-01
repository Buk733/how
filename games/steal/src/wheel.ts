// Колесо удачи без графики: призы, шансы, таймер бесплатного спина и спины за рекламу.
import type { Rng } from '@engine/rng';
import { REWARDS } from './config';
import type { SaveData } from './save';

export type WheelPrize =
  | { readonly kind: 'coins'; readonly minutes: number; readonly minCoins: number }
  | { readonly kind: 'key'; readonly caseId: string }
  | { readonly kind: 'boost' }
  | { readonly kind: 'character' };

export interface WheelSector {
  readonly prize: WheelPrize;
  readonly icon: string;
  readonly label: string;
  /** Вес: шанс сектора = вес / сумма весов (сумма — 100, то есть веса — это проценты). */
  readonly weight: number;
  readonly color: string;
}

/** Сектора по часовой стрелке, начиная сверху. Шансы всегда показаны под колесом. */
export const WHEEL: readonly WheelSector[] = [
  { prize: { kind: 'coins', minutes: 2, minCoins: 300 }, icon: '💰', label: 'Монеты', weight: 24, color: '#ffcd75' },
  { prize: { kind: 'key', caseId: 'bath' }, icon: '🪣', label: 'Банный кейс', weight: 18, color: '#94b0c2' },
  { prize: { kind: 'boost' }, icon: '⚡', label: '×2 доход', weight: 14, color: '#a7f070' },
  { prize: { kind: 'coins', minutes: 6, minCoins: 800 }, icon: '💰', label: 'Много монет', weight: 16, color: '#ef7d57' },
  { prize: { kind: 'key', caseId: 'meme' }, icon: '🎭', label: 'Мемный кейс', weight: 11, color: '#41a6f6' },
  { prize: { kind: 'character' }, icon: '🎁', label: 'Персонаж', weight: 7, color: '#c07bff' },
  { prize: { kind: 'coins', minutes: 20, minCoins: 2500 }, icon: '💰', label: 'Гора монет', weight: 7, color: '#38b764' },
  { prize: { kind: 'key', caseId: 'gold' }, icon: '👑', label: 'Золотой кейс', weight: 3, color: '#ffd23f' },
];

/** Шанс «Голды», если на колесе выпал персонаж. */
export const WHEEL_CHARACTER_GOLD = 0.1;

const MINUTE = 60_000;

/** Шанс каждого сектора (доли от 1). */
export function wheelChances(): number[] {
  const total = WHEEL.reduce((sum, s) => sum + s.weight, 0);
  return WHEEL.map((s) => s.weight / total);
}

/** Номер выпавшего сектора. */
export function rollWheel(rng: Rng): number {
  let roll = rng.next() * WHEEL.reduce((sum, s) => sum + s.weight, 0);
  for (let i = 0; i < WHEEL.length; i++) {
    roll -= WHEEL[i].weight;
    if (roll < 0) return i;
  }
  return WHEEL.length - 1;
}

/** Сколько монет в денежном призе: столько-то минут дохода, но не меньше minCoins. */
export function coinsPrize(prize: { readonly minutes: number; readonly minCoins: number }, incomePerSecond: number): number {
  return Math.max(prize.minCoins, Math.round(incomePerSecond * prize.minutes * 60));
}

/** Сутки для счётчика спинов за рекламу (по UTC). */
export function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export interface SpinState {
  /** Бесплатный спин доступен. */
  readonly free: boolean;
  /** Через сколько мс будет бесплатный спин. */
  readonly freeIn: number;
  /** Сколько спинов за рекламу осталось сегодня. */
  readonly adLeft: number;
}

export function spinState(save: SaveData, now: number): SpinState {
  const freeIn = Math.max(0, save.freeSpinAt - now);
  const used = save.adSpins.day === dayKey(now) ? save.adSpins.count : 0;
  return { free: freeIn === 0, freeIn, adLeft: Math.max(0, REWARDS.adSpinsPerDay - used) };
}

/** Тратит спин: бесплатный (запускает таймер) или за рекламу (считает за сегодня). false — спина нет. */
export function useSpin(save: SaveData, now: number, kind: 'free' | 'ad'): boolean {
  const state = spinState(save, now);
  if (kind === 'free') {
    if (!state.free) return false;
    save.freeSpinAt = now + REWARDS.freeSpinMinutes * MINUTE;
    return true;
  }
  if (state.adLeft === 0) return false;
  const day = dayKey(now);
  save.adSpins = { day, count: (save.adSpins.day === day ? save.adSpins.count : 0) + 1 };
  return true;
}

/** Включает ускоритель «×2 к доходу» на minutes минут (если уже работает — продлевает). */
export function startBoost(save: SaveData, now: number, minutes: number = REWARDS.boostMinutes): void {
  save.boostUntil = Math.max(save.boostUntil, now) + minutes * MINUTE;
}
