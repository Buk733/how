// Что говорят персонажи на полке бани игрока. Реальным людям слов не придумываем —
// у них только общие банные фразы и смайлики.
// Сами фразы — в словарях i18n (shelf).
import type { Rng } from '@engine/rng';
import { ownShelfLines, t } from '../i18n';

/** Что скажет персонаж: чаще своё, иногда общее банное. */
export function shelfLine(id: string, rng: Rng): string {
  const own = ownShelfLines(id);
  const pool = own.length > 0 && rng.chance(0.6) ? own : t.shelf.common;
  return pool[rng.int(0, pool.length)];
}
