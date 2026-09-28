import type { Rarity } from './rarity';
import pantherUrl from '../assets/sprites/panther.png';
import animeCookUrl from '../assets/sprites/anime-cook.png';
import animeKnightUrl from '../assets/sprites/anime-knight.png';
import kotostUrl from '../assets/sprites/kotost.png';
import diverUrl from '../assets/sprites/diver.png';
import babaChaiUrl from '../assets/sprites/baba-chai.png';
import hamamUrl from '../assets/sprites/hamam.png';
import pantherSound from '../sounds/tantsui-pantera.mp3';
import kotostSound from '../sounds/kotost.mp3';
import diverSound from '../sounds/niukhai-bystree.mp3';
import babaChaiSound from '../sounds/baba-chai.mp3';

export interface CharacterSound {
  readonly url: string;
  /** С какой секунды записи начинается фраза. */
  readonly offset?: number;
  /** Сколько секунд играть. */
  readonly duration?: number;
}

export interface CharacterDef {
  /** Латиница, без пробелов: по нему персонаж хранится в сохранении. Не менять после релиза! */
  readonly id: string;
  readonly name: string;
  readonly rarity: Rarity;
  /** Цена на дорожке, монеты. */
  readonly price: number;
  /** Доход на полке, монет в секунду. */
  readonly income: number;
  /** Лист спрайта: 2 кадра 32×32 («вдох» и «выдох»). */
  readonly sprite: string;
  /** Мемный звук: играет, когда персонажа покупают. */
  readonly sound?: CharacterSound;
}

/**
 * Все персонажи игры. Чтобы добавить нового:
 * 1) нарисуйте его в tools/art/characters.mjs и запустите `npm run art`;
 * 2) положите звук в src/sounds;
 * 3) добавьте строку сюда.
 */
export const CHARACTERS: readonly CharacterDef[] = [
  { id: 'panther', name: 'Танцуй Пантера', rarity: 'common', price: 25, income: 1, sprite: pantherUrl, sound: { url: pantherSound } },
  { id: 'anime-cook', name: 'Тянка в фартуке', rarity: 'common', price: 50, income: 2, sprite: animeCookUrl },
  { id: 'anime-knight', name: 'Аниме-рыцарь', rarity: 'common', price: 100, income: 4, sprite: animeKnightUrl },
  { id: 'kotost', name: 'Котость', rarity: 'rare', price: 400, income: 10, sprite: kotostUrl, sound: { url: kotostSound, offset: 3.2, duration: 3 } },
  { id: 'diver', name: 'Нюхай Быстрее', rarity: 'rare', price: 750, income: 17, sprite: diverUrl, sound: { url: diverSound } },
  { id: 'baba-chai', name: 'Баба Чай', rarity: 'epic', price: 4000, income: 70, sprite: babaChaiUrl, sound: { url: babaChaiSound, offset: 0.9, duration: 1.8 } },
  { id: 'hamam', name: 'Хамам', rarity: 'legendary', price: 50000, income: 600, sprite: hamamUrl },
];

const byId = new Map(CHARACTERS.map((c) => [c.id, c]));

export function characterById(id: string): CharacterDef | undefined {
  return byId.get(id);
}
