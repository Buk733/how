// Герои на выбор игрока. Картинки рисует tools/art (heroGirl, heroGuy), выбор хранится в сохранении.
import { t } from '../i18n';

export type HeroId = 'girl' | 'guy';

export interface HeroDef {
  /** Хранится в сохранении — не менять после релиза. */
  readonly id: HeroId;
  /** Имя и описание на языке игры (i18n: heroes). */
  readonly name: string;
  readonly description: string;
  /** Лист sprites/<sprite>.png: 4 направления × 4 кадра ходьбы, кадр 24×24. */
  readonly sprite: string;
}

export const HEROES: readonly HeroDef[] = (
  [
    { id: 'girl', sprite: 'hero-girl' },
    { id: 'guy', sprite: 'hero-guy' },
  ] as const
).map((hero) => ({
  ...hero,
  get name() {
    return t.heroes[hero.id].name;
  },
  get description() {
    return t.heroes[hero.id].description;
  },
}));

/** Кем начинается новая игра. Сменить можно в окне «Герой». */
export const DEFAULT_HERO: HeroId = 'girl';

export function isHeroId(value: unknown): value is HeroId {
  return HEROES.some((hero) => hero.id === value);
}

export function heroById(id: HeroId): HeroDef {
  return HEROES.find((hero) => hero.id === id) ?? HEROES[0];
}
