import type { Rarity } from './rarity';
import { spriteUrl } from './sprites';
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
  /** Лист спрайта: 2 кадра 32×32 («вдох» и «выдох»). Файл sprites/<id>.png. */
  readonly sprite: string;
  /** Тот же лист в золоте — для «Голды». Файл sprites/<id>-gold.png. */
  readonly goldSprite: string;
  /** Мемный звук: играет, когда персонажа покупают. */
  readonly sound?: CharacterSound;
}

type Entry = Omit<CharacterDef, 'sprite' | 'goldSprite'>;

/**
 * Все персонажи игры. Чтобы добавить нового:
 * 1) нарисуйте его в tools/art/characters.mjs и запустите `npm run art` (золотая версия рисуется сама);
 * 2) положите звук в src/sounds;
 * 3) добавьте строку сюда.
 */
const ENTRIES: readonly Entry[] = [
  { id: 'panther', name: 'Танцуй Пантера', rarity: 'common', price: 25, income: 1, sound: { url: pantherSound } },
  { id: 'anime-cook', name: 'Тянка в фартуке', rarity: 'common', price: 50, income: 2 },
  { id: 'anime-knight', name: 'Аниме-рыцарь', rarity: 'common', price: 100, income: 4 },
  { id: 'kotost', name: 'Котость', rarity: 'rare', price: 400, income: 10, sound: { url: kotostSound, offset: 3.2, duration: 3 } },
  { id: 'diver', name: 'Нюхай Быстрее', rarity: 'rare', price: 750, income: 17, sound: { url: diverSound } },
  { id: 'baba-chai', name: 'Баба Чай', rarity: 'epic', price: 4000, income: 70, sound: { url: babaChaiSound, offset: 0.9, duration: 1.8 } },
  { id: 'koch-bratan', name: 'Коч Братан', rarity: 'epic', price: 7500, income: 120 },
  { id: 'hamam', name: 'Хамам', rarity: 'legendary', price: 50000, income: 600 },
  { id: 'dark-drun', name: 'Тёмный Друн', rarity: 'legendary', price: 90000, income: 1000 },
  { id: 'schoolboy', name: 'Школьник второй смены', rarity: 'legendary', price: 150000, income: 1600 },
  { id: 'fat-mellstroy', name: 'Толстый Меллстрой', rarity: 'mythic', price: 500000, income: 5000 },
  { id: 'indian-mellstroy', name: 'Индеец Меллстрой', rarity: 'mythic', price: 900000, income: 8500 },
];

export const CHARACTERS: readonly CharacterDef[] = ENTRIES.map((entry) => ({
  ...entry,
  sprite: spriteUrl(entry.id),
  goldSprite: spriteUrl(`${entry.id}-gold`),
}));

const byId = new Map(CHARACTERS.map((c) => [c.id, c]));

export function characterById(id: string): CharacterDef | undefined {
  return byId.get(id);
}
