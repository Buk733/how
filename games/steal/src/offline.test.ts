import { describe, expect, it } from 'vitest';
import { OFFLINE, UPGRADES } from './config';
import { offlineEarnings } from './offline';
import { createSave } from './save';

const NOW = Date.UTC(2026, 9, 1, 12, 0, 0);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Сохранение с Котостью (10 монет/с) на полке, сохранённое away мс назад. */
function saveAway(away: number) {
  const save = createSave();
  save.slots[0] = { id: 'kotost', gold: false, stored: 0 };
  save.savedAt = NOW - away;
  return save;
}

describe('доход вне игры', () => {
  it('новая игра, короткая отлучка или пустой полок — ничего', () => {
    expect(offlineEarnings(createSave(), NOW)).toBeNull();
    expect(offlineEarnings(saveAway(OFFLINE.minMinutes * MINUTE - 1000), NOW)).toBeNull();
    const empty = saveAway(HOUR);
    empty.slots[0] = { id: null, gold: false, stored: 0 };
    expect(offlineEarnings(empty, NOW)).toBeNull();
  });

  it('половина обычного дохода за всё время отсутствия', () => {
    const earned = offlineEarnings(saveAway(HOUR), NOW);
    expect(earned).toEqual({ away: 3600, seconds: 3600, coins: 10 * OFFLINE.rate * 3600 });
  });

  it('копится не дольше OFFLINE.maxHours', () => {
    const earned = offlineEarnings(saveAway(3 * 24 * HOUR), NOW);
    expect(earned?.seconds).toBe(OFFLINE.maxHours * 3600);
    expect(earned?.coins).toBe(10 * OFFLINE.rate * OFFLINE.maxHours * 3600);
  });

  it('печь и перерождения считаются, ускоритель — нет', () => {
    const save = saveAway(HOUR);
    save.upgrades.stove = 2;
    save.rebirths = 1;
    save.boostUntil = NOW + HOUR;
    const factor = (1 + 2 * UPGRADES.stove.perLevel) * 1.5;
    expect(offlineEarnings(save, NOW)?.coins).toBe(Math.floor(10 * factor * OFFLINE.rate * 3600));
  });
});
