import { describe, expect, it } from 'vitest';
import { ECONOMY, GOLD, UPGRADES } from './config';
import { CHARACTERS, characterById } from './data/characters';
import { boostActive, checkPurchase, findSlotFor, sellValue, totalIncome, unitIncome, unitName, unitPrice, unlockCost } from './economy';
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
    save.coins = def('kotost').price;
    save.slots[0].id = 'panther';
    expect(checkPurchase(save, def('kotost'))).toEqual({ ok: true, slot: 1, replaces: null });
  });

  it('когда мест нет — заменяет самого слабого, если новый доходнее', () => {
    const save = createSave();
    save.coins = def('diver').price;
    ['kotost', 'panther', 'anime-knight', 'anime-cook'].forEach((id, i) => (save.slots[i].id = id));
    const check = checkPurchase(save, def('diver'));
    expect(check).toEqual({ ok: true, slot: 1, replaces: { def: def('panther'), gold: false } });
  });

  it('«Голда» дороже и доходнее, а на полке ценится выше обычной', () => {
    const save = createSave();
    save.coins = 100;
    expect(checkPurchase(save, def('kotost'), true)).toEqual({ ok: false, reason: 'coins' });
    save.coins = unitPrice(def('kotost'), true);
    for (let i = 0; i < save.unlocked; i++) save.slots[i].id = 'kotost';
    // обычная котость не лучше тех, что уже сидят, а «Голда» — лучше
    expect(checkPurchase(save, def('kotost'))).toEqual({ ok: false, reason: 'space' });
    expect(checkPurchase(save, def('kotost'), true)).toMatchObject({ ok: true, replaces: { def: def('kotost'), gold: false } });
    expect(unitIncome(def('kotost'), true)).toBe(def('kotost').income * GOLD.incomeFactor);
    expect(unitName(def('kotost'), true)).toBe('Котость · Голда');
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

  it('печь увеличивает доход', () => {
    const save = createSave();
    save.slots[0].id = 'kotost';
    save.upgrades.stove = 2;
    expect(totalIncome(save)).toBeCloseTo(def('kotost').income * (1 + 2 * UPGRADES.stove.perLevel));
  });

  it('«Голда» на полке — двойной доход, ускоритель — ещё ×2, пока не кончился', () => {
    const save = createSave();
    save.slots[0] = { id: 'kotost', gold: true, stored: 0 };
    expect(totalIncome(save)).toBe(def('kotost').income * 2);
    save.boostUntil = 1000;
    expect(boostActive(save, 999)).toBe(true);
    expect(totalIncome(save, 999)).toBe(def('kotost').income * 4);
    expect(totalIncome(save, 1000)).toBe(def('kotost').income * 2);
  });

  it('за заменённого возвращают половину цены («Голда» — дороже)', () => {
    expect(sellValue(def('kotost'))).toBe(Math.floor(def('kotost').price * ECONOMY.sellRatio));
    expect(sellValue(def('kotost'), true)).toBe(Math.floor(def('kotost').price * GOLD.priceFactor * ECONOMY.sellRatio));
  });

  it('цены открытия мест идут по порядку', () => {
    expect(unlockCost(0)).toBeNull();
    expect(unlockCost(ECONOMY.freeSlots)).toBe(ECONOMY.unlockCosts[0]);
    expect(unlockCost(ECONOMY.totalSlots)).toBeNull();
  });

  it('чем редкее персонаж, тем он дороже и доходнее', () => {
    const order = ['common', 'rare', 'epic', 'legendary', 'mythic'];
    const byRarity = order.map((r) => CHARACTERS.filter((c) => c.rarity === r));
    for (let i = 1; i < byRarity.length; i++) {
      const cheapestHigher = Math.min(...byRarity[i].map((c) => c.price));
      const priciestLower = Math.max(...byRarity[i - 1].map((c) => c.price));
      expect(cheapestHigher).toBeGreaterThan(priciestLower);
    }
  });
});
