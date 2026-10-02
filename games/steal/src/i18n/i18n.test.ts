import { afterEach, describe, expect, it } from 'vitest';
import { formatNumber } from '@engine/format';
import { CASES } from '../data/cases';
import { CHARACTERS } from '../data/characters';
import { HEROES } from '../data/heroes';
import { PRODUCTS } from '../data/shop';
import { SECRETS } from '../data/secrets';
import { NEIGHBORS } from '../config';
import { DAILY } from '../daily';
import { WHEEL } from '../wheel';
import { DICTIONARIES, formatAway, formatChance, formatSeconds, LANGUAGES, pickLanguage, setLanguage, t, type Language } from '.';

/** Все строки словаря: у функций — результат на примерных значениях. */
function strings(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (typeof value === 'function') {
    const args = Array.from({ length: value.length }, (_, i) => (i % 2 === 0 ? 'X' : 7));
    // числовые параметры — числами, строковые — строкой: функции словаря одинаково переварят и то, и другое
    return [[path, String((value as (...a: unknown[]) => unknown)(...args.map((a) => a)))]];
  }
  if (Array.isArray(value)) return value.flatMap((item, i) => strings(item, `${path}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => strings(item, path ? `${path}.${key}` : key));
  return [];
}

/** Форма словаря: пути ключей, у списков — длина (порядок пунктов что-то значит: дни календаря, списки). */
function shape(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) return [`${path}[${value.length}]`];
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => shape(item, path ? `${path}.${key}` : key));
  return [`${path}:${typeof value}`];
}

/** Казино-лексика под запретом правил площадки — ни в одном языке. */
const CASINO = /ставк|джекпот|рулетк|казино|jackpot|roulette|ruleta|roleta|rulet|casino|cassino|kumar|bahis|apuesta|aposta|wette|(?<!\p{L})(bet|pari)(?!\p{L})/iu;

afterEach(() => setLanguage('ru'));

describe('словари', () => {
  it('у всех языков те же ключи и та же длина списков, что у русского', () => {
    const reference = shape(DICTIONARIES.ru);
    for (const language of LANGUAGES) expect(shape(DICTIONARIES[language]), language).toEqual(reference);
  });

  it('нет пустых строк, «undefined» и «NaN»', () => {
    for (const language of LANGUAGES) {
      for (const [path, text] of strings(DICTIONARIES[language])) {
        expect(text.trim(), `${language}: ${path}`).not.toBe('');
        expect(text, `${language}: ${path}`).not.toMatch(/undefined|NaN|\[object/);
      }
    }
  });

  it('в других языках не осталось русских букв', () => {
    for (const language of LANGUAGES.filter((l) => l !== 'ru')) {
      for (const [path, text] of strings(DICTIONARIES[language])) expect(text, `${language}: ${path}`).not.toMatch(/[а-яё]/i);
    }
  });

  it('никакой казино-лексики (правило площадки)', () => {
    for (const language of LANGUAGES) {
      for (const [path, text] of strings(DICTIONARIES[language])) expect(text, `${language}: ${path}`).not.toMatch(CASINO);
    }
  });

  it('подписи кнопок окон короткие — помещаются на узком экране (перерождение — во всю ширину)', () => {
    for (const language of LANGUAGES) {
      const { rebirth, ...menus } = DICTIONARIES[language].hud.menus;
      for (const [id, text] of Object.entries(menus)) expect(text.length, `${language}: ${id} «${text}»`).toBeLessThanOrEqual(9);
      expect(rebirth.length, `${language}: rebirth`).toBeLessThanOrEqual(12);
    }
  });

  it('у каждого персонажа, кейса, пасхалки, товара, соседа и героя есть тексты на всех языках', () => {
    for (const language of LANGUAGES) {
      setLanguage(language);
      const dictionary = DICTIONARIES[language];
      for (const def of CHARACTERS) expect(Object.keys(dictionary.characters), language).toContain(def.id);
      for (const box of CASES) expect(Object.keys(dictionary.cases.names), language).toContain(box.id);
      for (const secret of SECRETS) expect(Object.keys(dictionary.secrets), language).toContain(secret.id);
      for (const product of PRODUCTS) expect(product.name, language).toBe(dictionary.shop.products[product.id].name);
      for (const neighbor of NEIGHBORS) expect(dictionary.neighbors[neighbor.id].name, language).not.toBe('');
      for (const hero of HEROES) expect(hero.name, language).toBe(dictionary.heroes[hero.id].name);
      expect(DAILY.map((d) => d.label)).toEqual(dictionary.daily.labels);
      for (const sector of WHEEL) expect(sector.label, language).not.toBe('');
    }
  });
});

describe('выбор языка', () => {
  it('язык площадки: свой словарь, для России и соседей — русский, для остальных — английский (правило 2.10)', () => {
    const cases: [string, Language][] = [
      ['ru', 'ru'],
      ['be', 'ru'],
      ['kk', 'ru'],
      ['uk', 'ru'],
      ['uz', 'ru'],
      ['en', 'en'],
      ['tr', 'tr'],
      ['pt-BR', 'pt'],
      ['ES', 'es'],
      ['de_AT', 'de'],
      ['fr', 'fr'],
      ['ja', 'en'],
      ['', 'en'],
    ];
    for (const [code, language] of cases) expect(pickLanguage(code), code).toBe(language);
  });

  it('смена языка меняет тексты данных и запись чисел', () => {
    setLanguage('en');
    expect(t).toBe(DICTIONARIES.en);
    expect(CHARACTERS.find((c) => c.id === 'diver')?.name).toBe('Sniff Faster');
    expect(formatNumber(1234)).toBe('1.23K');
    expect(formatChance(0.025)).toBe('2.5%');
    expect(formatSeconds(1.84)).toBe('1.8\u00a0s');
    expect(formatAway(2 * 3600 + 15 * 60)).toBe('2 h 15 min');
    setLanguage('ru');
    expect(CHARACTERS.find((c) => c.id === 'diver')?.name).toBe('Нюхай Быстрее');
    expect(formatNumber(1234)).toBe('1,23K');
    expect(formatSeconds(1.84)).toBe('1,8\u00a0с');
  });

  it('проценты, дни и согласование — как принято в каждом языке', () => {
    setLanguage('tr');
    expect(formatChance(0.46)).toBe('%46');
    setLanguage('de');
    expect(formatChance(0.46)).toBe('46\u00a0%');
    setLanguage('es');
    expect(t.daily.streak(1)).toBe('Racha: 1 día seguido');
    expect(t.daily.streak(3)).toBe('Racha: 3 días seguidos');
    setLanguage('ru');
    expect(formatChance(0.46)).toBe('46%');
    expect(formatAway(47 * 3600)).toBe('47 ч');
    expect(formatAway(30 * 24 * 3600)).toBe('30 дней');
    expect(formatAway(3 * 24 * 3600 + 5 * 3600)).toBe('3 дня');
  });

  it('русские числа и падежи', () => {
    expect(t.daily.streak(1)).toBe('Серия: 1 день подряд');
    expect(t.daily.streak(3)).toBe('Серия: 3 дня подряд');
    expect(t.daily.streak(11)).toBe('Серия: 11 дней подряд');
    expect(t.daily.streak(22)).toBe('Серия: 22 дня подряд');
  });
});
