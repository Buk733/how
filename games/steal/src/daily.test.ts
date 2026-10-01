import { describe, expect, it } from 'vitest';
import { REWARDS } from './config';
import { claimDaily, DAILY, dailyState } from './daily';
import { createSave } from './save';
import { dayKey } from './wheel';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 1, 12, 0, 0);

describe('ежедневные награды', () => {
  it('в первый день — первая клетка, забрать можно один раз в сутки', () => {
    const save = createSave();
    expect(dailyState(save, NOW)).toMatchObject({ available: true, streak: 1, index: 0 });
    const first = claimDaily(save, NOW, 0);
    expect(first?.reward).toBe(DAILY[0]);
    expect(first?.coins).toBe(300);
    expect(save.coins).toBe(50 + 300);
    expect(save.daily).toEqual({ day: dayKey(NOW), streak: 1 });
    expect(dailyState(save, NOW + 1000)).toMatchObject({ available: false, streak: 1, index: 0 });
    expect(claimDaily(save, NOW + 1000, 0)).toBeNull();
  });

  it('заходы подряд двигают серию, после седьмого дня календарь идёт по кругу', () => {
    const save = createSave();
    for (let day = 0; day < 8; day++) claimDaily(save, NOW + day * DAY, 100);
    expect(save.daily.streak).toBe(8);
    expect(dailyState(save, NOW + 8 * DAY)).toMatchObject({ available: true, streak: 9, index: 1 });
  });

  it('пропущен день — серия начинается заново', () => {
    const save = createSave();
    claimDaily(save, NOW, 0);
    claimDaily(save, NOW + DAY, 0);
    expect(dailyState(save, NOW + 3 * DAY)).toMatchObject({ available: true, streak: 1, index: 0 });
  });

  it('выдаёт ключи от кейсов и ускоритель', () => {
    const save = createSave();
    claimDaily(save, NOW, 0);
    claimDaily(save, NOW + DAY, 0);
    expect(save.keys).toEqual({ bath: 1 });
    claimDaily(save, NOW + 2 * DAY, 0);
    claimDaily(save, NOW + 3 * DAY, 0);
    expect(save.boostUntil).toBe(NOW + 3 * DAY + 10 * 60_000);
    expect(REWARDS.boostMinutes).not.toBe(10); // ускоритель из календаря длиннее, чем с колеса
  });

  it('денежные награды растут с доходом', () => {
    const save = createSave();
    expect(claimDaily(save, NOW, 50)?.coins).toBe(50 * 3 * 60);
  });

  it('сутки — по UTC, следующая награда в полночь', () => {
    const state = dailyState(createSave(), NOW);
    expect(state.nextIn).toBe(12 * 3600_000);
  });
});
