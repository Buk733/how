import type { Rarity } from './rarity';

export interface CaseDef {
  /** Латиница: по нему хранятся ключи в сохранении. Не менять после релиза. */
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  /** Цена в монетах. */
  readonly price: number;
  /** Шансы редкостей (в сумме 1). Внутри редкости персонажи выпадают поровну. */
  readonly odds: Partial<Record<Rarity, number>>;
  /** Шанс, что выпадет «Голда»-версия. */
  readonly gold: number;
  /** Цвет рамки карточки. */
  readonly color: string;
}

/**
 * Кейсы — только за монеты (правила площадки), шансы всегда на виду.
 * Цены подобраны так, что средняя ценность выпадения — около 80% цены.
 */
export const CASES: readonly CaseDef[] = [
  { id: 'bath', name: 'Банный кейс', icon: '🪣', price: 500, odds: { common: 0.72, rare: 0.24, epic: 0.04 }, gold: 0.03, color: '#94b0c2' },
  { id: 'meme', name: 'Мемный кейс', icon: '🎭', price: 12_000, odds: { rare: 0.6, epic: 0.33, legendary: 0.07 }, gold: 0.05, color: '#41a6f6' },
  { id: 'gold', name: 'Золотой кейс', icon: '👑', price: 150_000, odds: { epic: 0.5, legendary: 0.42, mythic: 0.08 }, gold: 0.12, color: '#ffcd75' },
  { id: 'mellstroy', name: 'Кейс Меллстроя', icon: '💎', price: 600_000, odds: { legendary: 0.65, mythic: 0.35 }, gold: 0.2, color: '#ff6b6b' },
];

/** Бесплатный кейс по таймеру — самый дешёвый. */
export const FREE_CASE_ID = 'bath';

const byId = new Map(CASES.map((c) => [c.id, c]));

export function caseById(id: string): CaseDef | undefined {
  return byId.get(id);
}
