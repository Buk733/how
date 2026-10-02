import { describe, expect, it } from 'vitest';
import { OFFLINE, UPGRADES } from './config';
import { offlineEarnings } from './offline';
import { createSave } from './save';

const NOW = Date.UTC(2026, 9, 1, 12, 0, 0);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Сохранение с Котостью (10 монет/с) на полке и миллионом монет, сохранённое away мс назад. */
function saveAway(away: number) {
  const save = createSave();
  save.slots[0] = { id: 'kotost', gold: false, stored: 0 };
  save.coins = 1_000_000;
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

  it('доля обычного дохода за всё время отсутствия', () => {
    const earned = offlineEarnings(saveAway(HOUR), NOW);
    expect(earned).toEqual({ away: 3600, capped: false, coins: 10 * OFFLINE.rate * 3600 });
  });

  it('сколько бы игрока ни было — не больше OFFLINE.maxShare его монет', () => {
    const earned = offlineEarnings(saveAway(30 * 24 * HOUR), NOW);
    expect(earned).toEqual({ away: 30 * 24 * 3600, capped: true, coins: 1_000_000 * OFFLINE.maxShare });
    const poor = saveAway(HOUR);
    poor.coins = 1000;
    expect(offlineEarnings(poor, NOW)).toMatchObject({ capped: true, coins: 1000 * OFFLINE.maxShare });
  });

  it('без монет награды нет: потолок — доля баланса', () => {
    const broke = saveAway(HOUR);
    broke.coins = 0;
    expect(offlineEarnings(broke, NOW)).toBeNull();
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
