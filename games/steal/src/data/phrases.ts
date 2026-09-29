// Что говорят персонажи на полке бани игрока. Реальным людям слов не придумываем —
// у них только общие банные фразы и смайлики.
import type { Rng } from '@engine/rng';

/** Общие банные фразы — для всех. */
export const SHELF_LINES: readonly string[] = ['С лёгким паром!', 'Поддай парку!', 'Кайф!', 'Жарко!', '💦', '😌', 'Ещё парку!', 'Хорошо сидим!'];

/** Свои фразы мемных персонажей (по id). */
export const CHARACTER_LINES: Readonly<Record<string, readonly string[]>> = {
  panther: ['Танцуй!', 'Танцуй, пантера!'],
  'anime-cook': ['Кушать подано!', 'Приятного аппетита!'],
  'anime-knight': ['За баню!', 'Я на страже!'],
  kotost: ['Мур-р…', 'Котость!'],
  diver: ['Нюхай быстрее!', 'Буль-буль'],
  'baba-chai': ['Чай будешь?', 'Баба, чай!'],
  'koch-bratan': ['Братан, парку!', 'Веником — хоп!'],
  hamam: ['Пены мало!', 'Хамам — кайф!'],
};

/** Что скажет персонаж: чаще своё, иногда общее. */
export function shelfLine(id: string, rng: Rng): string {
  const own = CHARACTER_LINES[id];
  const pool = own && rng.chance(0.6) ? own : SHELF_LINES;
  return pool[rng.int(0, pool.length)];
}
