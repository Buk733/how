// Логика соседей-ботов без графики: кого они держат на полке и у кого что красть.
import type { Rng } from '@engine/rng';
import { characterById, type CharacterDef } from './data/characters';
import { RARITIES, RARITY_ORDER, type Rarity } from './data/rarity';
import type { SlotSave } from './save';

/** Номер редкости: 0 — обычный, 1 — редкий и т. д. */
export function tierOf(rarity: Rarity): number {
  return RARITY_ORDER.indexOf(rarity);
}

/** «Сила» игрока — самая высокая редкость у него на полке (−1, если полок пуст). */
export function playerPower(slots: readonly SlotSave[]): number {
  return slots.reduce((best, slot) => {
    const def = slot.id ? characterById(slot.id) : undefined;
    return def ? Math.max(best, tierOf(def.rarity)) : best;
  }, -1);
}

/**
 * Кого сосед ставит себе на полок: редкость около силы игрока —
 * чаще такая же или ниже, иногда на ступень выше (чтобы было что украсть).
 */
export function rollNeighborCharacter(rng: Rng, characters: readonly CharacterDef[], power: number): CharacterDef {
  const tiers = [...new Set(characters.filter((c) => RARITIES[c.rarity].weight > 0).map((c) => tierOf(c.rarity)))].sort((a, b) => a - b);
  const roll = rng.next();
  const offset = roll < 0.35 ? -1 : roll < 0.8 ? 0 : 1;
  const wanted = Math.max(0, power) + offset;
  // ближайшая существующая редкость к желаемой
  const tier = tiers.reduce((best, t) => (Math.abs(t - wanted) < Math.abs(best - wanted) ? t : best), tiers[0]);
  const pool = characters.filter((c) => tierOf(c.rarity) === tier);
  return pool[rng.int(0, pool.length)];
}

/** Новый полок соседа: часть мест занята, часть пустует. */
export function createNeighborRoster(rng: Rng, characters: readonly CharacterDef[], power: number, slots: number): (string | null)[] {
  const filled = Math.max(2, Math.round(slots * 0.66));
  return Array.from({ length: slots }, (_, i) => (i < filled ? rollNeighborCharacter(rng, characters, power).id : null));
}

/** Кого вор утащит из бани игрока: самого доходного. Возвращает номер места или −1. */
export function pickRaidTarget(slots: readonly SlotSave[], available: (slot: number) => boolean): number {
  let best = -1;
  let bestIncome = -1;
  slots.forEach((slot, i) => {
    const income = slot.id ? (characterById(slot.id)?.income ?? 0) : -1;
    if (income > bestIncome && available(i)) {
      best = i;
      bestIncome = income;
    }
  });
  return best;
}

/** Куда сосед посадит нового персонажа: пустое место, иначе — вместо самого слабого, если новый лучше. */
export function neighborSlotFor(slots: readonly (string | null)[], def: CharacterDef): number {
  const free = slots.indexOf(null);
  if (free >= 0) return free;
  let weakest = -1;
  let weakestIncome = Infinity;
  slots.forEach((id, i) => {
    const income = id ? (characterById(id)?.income ?? 0) : 0;
    if (income < weakestIncome) {
      weakestIncome = income;
      weakest = i;
    }
  });
  return def.income > weakestIncome ? weakest : -1;
}
