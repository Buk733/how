// Языки игры. Язык выбирается один раз при запуске, до того как строится интерфейс: на площадке —
// из SDK (environment.i18n.lang, требование Яндекса 2.14), в демо и при разработке — из браузера
// или выбора игрока. Тексты берутся из t в момент показа, поэтому модули данных хранят только id.
import { setDecimalSeparator } from '@engine/format';
import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { pt } from './pt';
import { ru, type Messages } from './ru';
import { tr } from './tr';

export type { Messages };

/** Все словари: первым — основной (русский), дальше — по охвату аудитории Яндекс Игр. */
export const DICTIONARIES = { ru, en, tr, es, pt, de, fr } as const satisfies Record<string, Messages>;
export type Language = keyof typeof DICTIONARIES;
export const LANGUAGES = Object.keys(DICTIONARIES) as Language[];

/** Для этих языков площадка требует русский (правило 2.10), для остальных незнакомых — английский. */
const RUSSIAN_FOR: readonly string[] = ['ru', 'be', 'kk', 'uk', 'uz'];

export function isLanguage(value: string): value is Language {
  return Object.hasOwn(DICTIONARIES, value);
}

/** Язык игры по коду площадки или браузера: «tr», «pt-BR», «kk» → tr, pt, ru; незнакомый → en. */
export function pickLanguage(requested: string): Language {
  const code = requested.toLowerCase().split(/[-_]/)[0];
  if (isLanguage(code)) return code;
  return RUSSIAN_FOR.includes(code) ? 'ru' : 'en';
}

/** Тексты текущего языка. */
export let t: Messages = ru;
export let language: Language = 'ru';

export function setLanguage(next: Language): void {
  language = next;
  t = DICTIONARIES[next];
  setDecimalSeparator(t.decimal);
}

/** «1,5» или «1.5» — дробное число с разделителем языка. */
export function formatDecimal(value: number): string {
  return String(value).replace('.', t.decimal);
}

/** «×1,5». */
export function formatMultiplier(value: number): string {
  return `×${formatDecimal(Math.round(value * 100) / 100)}`;
}

/** «2,3 с» — секунды с одной цифрой после запятой. */
export function formatSeconds(value: number): string {
  return t.units.seconds(formatDecimal(Math.round(value * 10) / 10));
}

/** «46%» или «2,5%» для маленьких шансов; знак процента — как принято в языке («%46», «46 %»). */
export function formatChance(chance: number): string {
  const percent = chance * 100;
  const value = percent >= 10 || Number.isInteger(percent) ? Math.round(percent) : Math.round(percent * 10) / 10;
  return t.units.percent(formatDecimal(value));
}

/** «+8%» в прокачке, «10%» в окне «С возвращением!»: целые проценты доли. */
export function formatPercent(fraction: number): string {
  return t.units.percent(String(Math.round(fraction * 100)));
}

/** Отлучки дольше двух суток — в днях. */
const DAYS_FROM_HOURS = 48;

/** «2 ч 15 мин», «45 мин», «3 дня» — сколько игрока не было. */
export function formatAway(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours >= DAYS_FROM_HOURS) return t.units.awayDays(Math.floor(hours / 24));
  return hours === 0 ? t.units.awayMinutes(minutes) : t.units.awayHours(hours, minutes % 60);
}

/** Тексты по id из данных игры: незнакомый id показываем как есть (так видно, чего не хватает). */
function lookup<T>(table: object, id: string): T | undefined {
  return (table as Readonly<Record<string, T | undefined>>)[id];
}

export function characterName(id: string): string {
  return lookup<string>(t.characters, id) ?? id;
}

export function caseName(id: string): string {
  return lookup<string>(t.cases.names, id) ?? id;
}

export function secretText(id: string): { readonly name: string; readonly action: string; readonly hint: string } {
  return lookup<{ name: string; action: string; hint: string }>(t.secrets, id) ?? { name: id, action: id, hint: '' };
}

/** Свои фразы мемного персонажа на полке (у кого их нет — пусто). */
export function ownShelfLines(id: string): readonly string[] {
  return lookup<readonly string[]>(t.shelf.own, id) ?? [];
}
