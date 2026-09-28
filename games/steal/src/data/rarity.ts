export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'secret';

export interface RarityInfo {
  readonly name: string;
  /** Цвет подписи и рамок. */
  readonly color: string;
  /** Относительный шанс появиться на дорожке (0 — не появляется). */
  readonly weight: number;
}

export const RARITIES: Readonly<Record<Rarity, RarityInfo>> = {
  common: { name: 'Обычный', color: '#d7dce6', weight: 60 },
  rare: { name: 'Редкий', color: '#41a6f6', weight: 28 },
  epic: { name: 'Эпический', color: '#c07bff', weight: 9 },
  legendary: { name: 'Легендарный', color: '#ffcd75', weight: 2.5 },
  mythic: { name: 'Мифический', color: '#ff6b6b', weight: 0.5 },
  secret: { name: 'Секретный', color: '#73eff7', weight: 0 },
};

/** Редкости по возрастанию ценности. */
export const RARITY_ORDER: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic', 'secret'];
