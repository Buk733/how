import { t } from '../i18n';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'secret';

export interface RarityInfo {
  /** Название на языке игры (i18n: rarities). */
  readonly name: string;
  /** Цвет подписи и рамок. */
  readonly color: string;
  /** Относительный шанс появиться на дорожке (0 — не появляется). */
  readonly weight: number;
}

const INFO: Readonly<Record<Rarity, Omit<RarityInfo, 'name'>>> = {
  common: { color: '#d7dce6', weight: 60 },
  rare: { color: '#41a6f6', weight: 28 },
  epic: { color: '#c07bff', weight: 9 },
  legendary: { color: '#ffcd75', weight: 2.5 },
  mythic: { color: '#ff6b6b', weight: 0.5 },
  secret: { color: '#73eff7', weight: 0 },
};

export const RARITIES: Readonly<Record<Rarity, RarityInfo>> = Object.fromEntries(
  (Object.keys(INFO) as Rarity[]).map((rarity) => [
    rarity,
    {
      ...INFO[rarity],
      get name() {
        return t.rarities[rarity];
      },
    },
  ]),
) as Record<Rarity, RarityInfo>;

/** Редкости по возрастанию ценности. */
export const RARITY_ORDER: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic', 'secret'];
