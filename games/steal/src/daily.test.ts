import { describe, expect, it } from 'vitest';
import { LEVEL_REWARDS, REWARDS } from './config';
import { claimDaily, DAILY, dailyCoins, dailyState } from './daily';
import { shelfValue } from './economy';
import { createSave } from './save';
import { dayKey } from './wheel';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 1, 12, 0, 0);

describe('ежедневные награды', () => {
  it('в первый день — первая клетка, забрать можно один раз в сутки', () => {
    const save = createSave();
    expect(dailyState(save, NOW)).toMatchObject({ available: true, streak: 1, index: 0 });
    // полка пустая — награда считается от минимальной стоимости полки
    const coins = LEVEL_REWARDS.minShelf * 0.2;
    expect(dailyCoins(DAILY[0].prize, save)).toBe(coins);
    const first = claimDaily(save, NOW);
    expect(first?.reward).toBe(DAILY[0]);
    expect(first?.coins).toBe(coins);
    expect(save.coins).toBe(50 + coins);
    expect(save.daily).toEqual({ day: dayKey(NOW), streak: 1 });
    expect(dailyState(save, NOW + 1000)).toMatchObject({ available: false, streak: 1, index: 0 });
    expect(claimDaily(save, NOW + 1000)).toBeNull();
  });

  it('заходы подряд двигают серию, после седьмого дня календарь идёт по кругу', () => {
    const save = createSave();
    for (let day = 0; day < 8; day++) claimDaily(save, NOW + day * DAY);
    expect(save.daily.streak).toBe(8);
    expect(dailyState(save, NOW + 8 * DAY)).toMatchObject({ available: true, streak: 9, index: 1 });
  });

  it('пропущен день — серия начинается заново', () => {
    const save = createSave();
    claimDaily(save, NOW);
    claimDaily(save, NOW + DAY);
    expect(dailyState(save, NOW + 3 * DAY)).toMatchObject({ available: true, streak: 1, index: 0 });
  });

  it('выдаёт ключи от кейсов и ускоритель', () => {
    const save = createSave();
    claimDaily(save, NOW);
    claimDaily(save, NOW + DAY);
    expect(save.keys).toEqual({ bath: 1 });
    claimDaily(save, NOW + 2 * DAY);
    claimDaily(save, NOW + 3 * DAY);
    expect(save.boostUntil).toBe(NOW + 3 * DAY + 10 * 60_000);
    expect(REWARDS.boostMinutes).not.toBe(10); // ускоритель из календаря длиннее, чем с колеса
  });

  it('монеты — доля стоимости полки: растут с уровнем, но даже самая большая меньше полки', () => {
    const save = createSave();
    save.slots[0] = { id: 'hamam', gold: false, stored: 0 };
    save.slots[1] = { id: 'koch-bratan', gold: true, stored: 0 };
    const shelf = shelfValue(save);
    expect(claimDaily(save, NOW)?.coins).toBe(Math.round(shelf * 0.2));
    for (const { prize } of DAILY) expect(dailyCoins(prize, save)).toBeLessThan(shelf);
  });

  it('сутки — по UTC, следующая награда в полночь', () => {
    const state = dailyState(createSave(), NOW);
    expect(state.nextIn).toBe(12 * 3600_000);
  });
});
