// Герои на выбор игрока. Картинки рисует tools/art (heroGirl, heroGuy), выбор хранится в сохранении.

export type HeroId = 'girl' | 'guy';

export interface HeroDef {
  /** Хранится в сохранении — не менять после релиза. */
  readonly id: HeroId;
  readonly name: string;
  readonly description: string;
  /** Лист sprites/<sprite>.png: 4 направления × 4 кадра ходьбы, кадр 24×24. */
  readonly sprite: string;
}

export const HEROES: readonly HeroDef[] = [
  { id: 'girl', name: 'Аниме-девушка', description: 'Длинные волосы, красный бант, взгляд — огонь', sprite: 'hero-girl' },
  { id: 'guy', name: 'Качок', description: 'Квадратная челюсть и бицепсы размером с арбуз', sprite: 'hero-guy' },
];

/** Кем начинается новая игра. Сменить можно в окне «Герой». */
export const DEFAULT_HERO: HeroId = 'girl';

export function isHeroId(value: unknown): value is HeroId {
  return HEROES.some((hero) => hero.id === value);
}

export function heroById(id: HeroId): HeroDef {
  return HEROES.find((hero) => hero.id === id) ?? HEROES[0];
}
