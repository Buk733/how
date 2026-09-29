// Кейсы без графики: шансы, что выпало, чем платить. Легко тестировать.
import type { Rng } from '@engine/rng';
import { REWARDS } from './config';
import { FREE_CASE_ID, type CaseDef } from './data/cases';
import type { CharacterDef } from './data/characters';
import { RARITY_ORDER, type Rarity } from './data/rarity';
import { tierOf } from './neighbors';
import type { SaveData } from './save';

export interface CharacterOdds {
  readonly def: CharacterDef;
  /** Шанс выпасть (любым вариантом — обычным или «Голдой»). */
  readonly chance: number;
}

export interface CaseDrop {
  readonly def: CharacterDef;
  readonly gold: boolean;
}

/** Чем платим за открытие: бесплатное по таймеру, ключ с колеса или монеты. */
export type CasePayment = 'free' | 'key' | 'coins';

const MINUTE = 60_000;

/**
 * Шанс каждого персонажа в кейсе. Внутри редкости персонажи выпадают поровну;
 * редкости, для которых персонажей нет, не считаются (их доля делится между остальными).
 */
export function caseOdds(box: CaseDef, characters: readonly CharacterDef[]): CharacterOdds[] {
  const rarities = RARITY_ORDER.filter((r) => (box.odds[r] ?? 0) > 0 && characters.some((c) => c.rarity === r));
  const total = rarities.reduce((sum, r) => sum + (box.odds[r] ?? 0), 0);
  return rarities.flatMap((r) => {
    const pool = characters.filter((c) => c.rarity === r);
    return pool.map((def) => ({ def, chance: (box.odds[r] ?? 0) / total / pool.length }));
  });
}

/** Шансы по редкостям — для подписи на карточке кейса. */
export function rarityOdds(box: CaseDef, characters: readonly CharacterDef[]): { readonly rarity: Rarity; readonly chance: number }[] {
  const byRarity = new Map<Rarity, number>();
  for (const { def, chance } of caseOdds(box, characters)) byRarity.set(def.rarity, (byRarity.get(def.rarity) ?? 0) + chance);
  return [...byRarity].map(([rarity, chance]) => ({ rarity, chance }));
}

/** Что выпало из кейса. guaranteeRare — первый кейс в игре: только редкий и выше. */
export function rollCase(rng: Rng, box: CaseDef, characters: readonly CharacterDef[], guaranteeRare = false): CaseDrop {
  let odds = caseOdds(box, characters);
  if (guaranteeRare) {
    const better = odds.filter((o) => tierOf(o.def.rarity) >= tierOf('rare'));
    if (better.length > 0) odds = better;
  }
  const total = odds.reduce((sum, o) => sum + o.chance, 0);
  let roll = rng.next() * total;
  let def = odds[odds.length - 1].def;
  for (const o of odds) {
    roll -= o.chance;
    if (roll < 0) {
      def = o.def;
      break;
    }
  }
  return { def, gold: rng.chance(box.gold) };
}

/** Первый кейс в игре — с гарантированно редким персонажем. */
export function isFirstCase(save: SaveData): boolean {
  return save.stats.opened === 0;
}

/** Готов ли бесплатный кейс и сколько ждать (мс). */
export function freeCaseIn(save: SaveData, now: number): number {
  return Math.max(0, save.freeCaseAt - now);
}

/** Чем можно заплатить за кейс сейчас (null — не хватает монет и нет ни ключа, ни бесплатного). */
export function casePayment(save: SaveData, box: CaseDef, now: number): CasePayment | null {
  if (box.id === FREE_CASE_ID && freeCaseIn(save, now) === 0) return 'free';
  if ((save.keys[box.id] ?? 0) > 0) return 'key';
  return save.coins >= box.price ? 'coins' : null;
}

/** Списывает оплату за кейс. Возвращает, чем заплатили, или null, если нечем. */
export function payForCase(save: SaveData, box: CaseDef, now: number): CasePayment | null {
  const payment = casePayment(save, box, now);
  if (payment === 'free') save.freeCaseAt = now + REWARDS.freeCaseMinutes * MINUTE;
  else if (payment === 'key') {
    const left = (save.keys[box.id] ?? 0) - 1;
    if (left > 0) save.keys[box.id] = left;
    else delete save.keys[box.id];
  } else if (payment === 'coins') save.coins -= box.price;
  if (payment) save.stats.opened++;
  return payment;
}
