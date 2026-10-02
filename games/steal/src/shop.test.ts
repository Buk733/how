import { describe, expect, it } from 'vitest';
import { LEADERBOARD, OFFLINE, SHOP } from './config';
import { PRODUCTS } from './data/shop';
import { steadyIncome, totalIncome } from './economy';
import { offlineEarnings } from './offline';
import { scoreToSend } from './records';
import { createSave } from './save';
import { adsDisabled, chestCoins, grantPurchase, needsConsume, owns } from './shop';

/** Игрок с Котостью на полке: 10 монет в секунду. */
function withIncome() {
  const save = createSave();
  save.slots[0] = { id: 'kotost', gold: false, stored: 0 };
  return save;
}

describe('товары за Яны', () => {
  it('за реальные деньги — только фиксированное содержимое: постоянные товары и монеты, никаких кейсов и ключей', () => {
    for (const product of PRODUCTS) {
      expect(['permanent', 'consumable']).toContain(product.kind);
      expect(product.id).toMatch(/^[a-z0-9_]+$/);
      expect(`${product.name} ${product.description}`).not.toMatch(/кейс|ключ|колес|шанс|случайн/i);
    }
  });

  it('постоянный товар выдаётся один раз и не «используется» на площадке', () => {
    const save = createSave();
    expect(grantPurchase(save, { productId: 'no_ads', token: 'a' })).toMatchObject({ kind: 'granted' });
    expect(grantPurchase(save, { productId: 'no_ads', token: 'b' })).toMatchObject({ kind: 'already' });
    expect(save.purchases.owned).toEqual(['no_ads']);
    expect(adsDisabled(save)).toBe(true);
    expect(needsConsume('no_ads')).toBe(false);
  });

  it('сундук монет: полчаса дохода, но не меньше минимума; один токен — одна выдача', () => {
    const empty = createSave();
    expect(chestCoins(empty)).toBe(SHOP.chestMin);
    const save = withIncome();
    save.coins = 0;
    const coins = Math.max(SHOP.chestMin, 10 * SHOP.chestMinutes * 60);
    expect(grantPurchase(save, { productId: 'coin_chest', token: 't1' })).toMatchObject({ kind: 'granted', coins });
    expect(save.coins).toBe(coins);
    // сохранение прошло, а «использовать» покупку не удалось: при следующем запуске она придёт снова
    expect(grantPurchase(save, { productId: 'coin_chest', token: 't1' })).toMatchObject({ kind: 'already' });
    expect(save.coins).toBe(coins);
    expect(grantPurchase(save, { productId: 'coin_chest', token: 't2' })).toMatchObject({ kind: 'granted' });
    expect(save.coins).toBe(coins * 2);
    expect(needsConsume('coin_chest')).toBe(true);
  });

  it('незнакомый товар ничего не выдаёт', () => {
    const save = createSave();
    expect(grantPurchase(save, { productId: 'vip', token: 'x' })).toEqual({ kind: 'unknown' });
    expect(save.purchases).toEqual({ owned: [], granted: [] });
    expect(needsConsume('vip')).toBe(false);
  });

  it('«Доход ×2 навсегда» удваивает доход — и в игре, и вне игры, а соседи его не видят', () => {
    const save = withIncome();
    const before = steadyIncome(save);
    grantPurchase(save, { productId: 'income_x2', token: 'x' });
    expect(owns(save, 'income_x2')).toBe(true);
    expect(steadyIncome(save)).toBe(before * SHOP.incomeFactor);
    expect(totalIncome(save, 0)).toBe(before * SHOP.incomeFactor);
    save.savedAt = 1;
    expect(offlineEarnings(save, 1 + 3600_000)?.coins).toBe(Math.floor(before * SHOP.incomeFactor * OFFLINE.rate * 3600));
  });

  it('помнит не больше SHOP.rememberTokens токенов', () => {
    const save = createSave();
    for (let i = 0; i < SHOP.rememberTokens + 10; i++) grantPurchase(save, { productId: 'coin_chest', token: `t${i}` });
    expect(save.purchases.granted).toHaveLength(SHOP.rememberTokens);
    expect(save.purchases.granted[0]).toBe('t10');
  });
});

describe('таблица рекордов', () => {
  it('отправляет целый лучший доход, когда он заметно вырос, и не чаще раза в интервал', () => {
    expect(scoreToSend(0, 0, 100)).toBeNull();
    expect(scoreToSend(123.7, 0, LEADERBOARD.interval)).toBe(123);
    expect(scoreToSend(500, 0, LEADERBOARD.interval - 1)).toBeNull();
    expect(scoreToSend(1000 * LEADERBOARD.minGrowth - 1, 1000, 100)).toBeNull();
    expect(scoreToSend(1000 * LEADERBOARD.minGrowth, 1000, 100)).toBe(Math.floor(1000 * LEADERBOARD.minGrowth));
  });
});
