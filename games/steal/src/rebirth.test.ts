import { describe, expect, it } from 'vitest';
import { ECONOMY, REBIRTH } from './config';
import { totalIncome } from './economy';
import { canRebirth, rebirth, rebirthCost, rebirthMultiplier } from './rebirth';
import { createSave } from './save';

describe('перерождение', () => {
  it('каждое следующее дороже, доход растёт на REBIRTH.incomeBonus за раз', () => {
    expect(rebirthCost(0)).toBe(REBIRTH.firstCost);
    expect(rebirthCost(1)).toBe(REBIRTH.firstCost * REBIRTH.costGrowth);
    expect(rebirthMultiplier(0)).toBe(1);
    expect(rebirthMultiplier(2)).toBe(2);
  });

  it('без нужной суммы не перерождаешься', () => {
    const save = createSave();
    save.coins = rebirthCost(0) - 1;
    expect(canRebirth(save)).toBe(false);
    expect(rebirth(save)).toBe(false);
    expect(save.rebirths).toBe(0);
  });

  it('сбрасывает монеты, полок, места, прокачку и лучший доход, но не альбом, пасхалки, ключи и героя', () => {
    const save = createSave();
    save.coins = rebirthCost(0) + 5;
    save.unlocked = 8;
    save.slots[3] = { id: 'hamam', gold: true, stored: 77 };
    save.upgrades.stove = 4;
    save.stats.peakIncome = 9000;
    save.stats.bought = 12;
    save.collection = ['hamam:gold'];
    save.secrets = ['hut'];
    save.keys = { gold: 1 };
    save.hero = 'guy';
    save.daily = { day: '2026-10-01', streak: 3 };
    expect(rebirth(save)).toBe(true);
    expect(save.rebirths).toBe(1);
    expect(save.coins).toBe(ECONOMY.startCoins);
    expect(save.unlocked).toBe(ECONOMY.freeSlots);
    expect(save.slots.every((s) => s.id === null && s.stored === 0)).toBe(true);
    expect(save.upgrades.stove).toBe(0);
    expect(save.stats.peakIncome).toBe(0);
    expect(save.stats.bought).toBe(12);
    expect(save.collection).toEqual(['hamam:gold']);
    expect(save.secrets).toEqual(['hut']);
    expect(save.keys).toEqual({ gold: 1 });
    expect(save.hero).toBe('guy');
    expect(save.daily).toEqual({ day: '2026-10-01', streak: 3 });
  });

  it('множитель перерождений входит в доход', () => {
    const save = createSave();
    save.slots[0] = { id: 'kotost', gold: false, stored: 0 };
    expect(totalIncome(save)).toBe(10);
    save.rebirths = 1;
    expect(totalIncome(save)).toBe(15);
  });
});
