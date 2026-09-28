import { describe, expect, it } from 'vitest';
import { ECONOMY } from './config';
import { CHARACTERS, characterById } from './data/characters';
import { checkPurchase, findSlotFor, sellValue, totalIncome, unlockCost } from './economy';
import { createSave } from './save';

const def = (id: string) => {
  const found = characterById(id);
  if (!found) throw new Error(id);
  return found;
};

describe('checkPurchase', () => {
  it('не хватает монет', () => {
    const save = createSave();
    save.coins = 10;
    expect(checkPurchase(save, def('panther'))).toEqual({ ok: false, reason: 'coins' });
  });

  it('садит на первое свободное место', () => {
    const save = createSave();
    save.coins = 1000;
    save.slots[0].id = 'panther';
    expect(checkPurchase(save, def('kotost'))).toEqual({ ok: true, slot: 1, replaces: null });
  });

  it('когда мест нет — заменяет самого слабого, если новый доходнее', () => {
    const save = createSave();
    save.coins = 1000;
    ['kotost', 'panther', 'anime-knight', 'anime-cook'].forEach((id, i) => (save.slots[i].id = id));
    const check = checkPurchase(save, def('diver'));
    expect(check).toEqual({ ok: true, slot: 1, replaces: def('panther') });
  });

  it('не заменяет, если новый не доходнее самого слабого', () => {
    const save = createSave();
    save.coins = 1000;
    for (let i = 0; i < save.unlocked; i++) save.slots[i].id = 'anime-knight';
    expect(checkPurchase(save, def('panther'))).toEqual({ ok: false, reason: 'space' });
  });
});

describe('findSlotFor', () => {
  it('не зависит от монет: краденого можно посадить и без денег', () => {
    const save = createSave();
    save.coins = 0;
    expect(findSlotFor(save, def('hamam'))).toEqual({ slot: 0, replaces: null });
  });

  it('null, если мест нет и новый не лучше самого слабого', () => {
    const save = createSave();
    for (let i = 0; i < save.unlocked; i++) save.slots[i].id = 'kotost';
    expect(findSlotFor(save, def('panther'))).toBeNull();
  });
});

describe('экономика', () => {
  it('доход — сумма доходов персонажей на полке', () => {
    const save = createSave();
    save.slots[0].id = 'panther';
    save.slots[1].id = 'kotost';
    expect(totalIncome(save)).toBe(def('panther').income + def('kotost').income);
  });

  it('за заменённого возвращают половину цены', () => {
    expect(sellValue(def('kotost'))).toBe(Math.floor(def('kotost').price * ECONOMY.sellRatio));
  });

  it('цены открытия мест идут по порядку', () => {
    expect(unlockCost(0)).toBeNull();
    expect(unlockCost(ECONOMY.freeSlots)).toBe(ECONOMY.unlockCosts[0]);
    expect(unlockCost(ECONOMY.totalSlots)).toBeNull();
  });

  it('чем редкее персонаж, тем он дороже и доходнее', () => {
    const order = ['common', 'rare', 'epic', 'legendary'];
    const byRarity = order.map((r) => CHARACTERS.filter((c) => c.rarity === r));
    for (let i = 1; i < byRarity.length; i++) {
      const cheapestHigher = Math.min(...byRarity[i].map((c) => c.price));
      const priciestLower = Math.max(...byRarity[i - 1].map((c) => c.price));
      expect(cheapestHigher).toBeGreaterThan(priciestLower);
    }
  });
});
