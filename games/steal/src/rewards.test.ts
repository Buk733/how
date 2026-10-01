import { describe, expect, it } from 'vitest';
import { Rng } from '@engine/rng';
import { caseOdds, casePayment, isFirstCase, payForCase, rarityOdds, rollCase } from './cases';
import { REWARDS, UPGRADER } from './config';
import { CASES, caseById, FREE_CASE_ID } from './data/cases';
import { CHARACTERS, characterById } from './data/characters';
import { unitPrice } from './economy';
import { tierOf } from './neighbors';
import { createSave } from './save';
import { rollUpgrade, upgradeChance, upgradeTargets } from './upgrader';
import { coinsPrize, dayKey, rollWheel, spinState, startBoost, useSpin, WHEEL, wheelChances } from './wheel';

const box = (id: string) => {
  const found = caseById(id);
  if (!found) throw new Error(id);
  return found;
};
const def = (id: string) => {
  const found = characterById(id);
  if (!found) throw new Error(id);
  return found;
};
const MINUTE = 60_000;
const NOW = Date.UTC(2026, 8, 29, 12, 0, 0);

describe('кейсы', () => {
  it('шансы в каждом кейсе в сумме дают 100%, внутри редкости — поровну', () => {
    for (const c of CASES) {
      const odds = caseOdds(c, CHARACTERS);
      expect(odds.reduce((sum, o) => sum + o.chance, 0)).toBeCloseTo(1);
      const commons = odds.filter((o) => o.def.rarity === 'common');
      for (const o of commons) expect(o.chance).toBeCloseTo(commons[0].chance);
    }
    expect(rarityOdds(box('bath'), CHARACTERS).map((r) => r.rarity)).toEqual(['common', 'rare', 'epic']);
  });

  it('что выпадает, совпадает с объявленными шансами', () => {
    const rng = new Rng(42);
    const c = box('meme');
    const counts = new Map<string, number>();
    let gold = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const drop = rollCase(rng, c, CHARACTERS);
      counts.set(drop.def.rarity, (counts.get(drop.def.rarity) ?? 0) + 1);
      if (drop.gold) gold++;
    }
    for (const { rarity, chance } of rarityOdds(c, CHARACTERS)) expect((counts.get(rarity) ?? 0) / N).toBeCloseTo(chance, 1);
    expect(gold / N).toBeCloseTo(c.gold, 1);
  });

  it('первый кейс — точно редкий или лучше', () => {
    const rng = new Rng(7);
    for (let i = 0; i < 500; i++) expect(tierOf(rollCase(rng, box('bath'), CHARACTERS, true).def.rarity)).toBeGreaterThanOrEqual(tierOf('rare'));
    const save = createSave();
    expect(isFirstCase(save)).toBe(true);
    save.stats.opened = 1;
    expect(isFirstCase(save)).toBe(false);
  });

  it('оплата: сначала бесплатный по таймеру, потом ключ, потом монеты', () => {
    const save = createSave();
    const bath = box(FREE_CASE_ID);
    save.coins = 0;
    expect(payForCase(save, bath, NOW)).toBe('free');
    expect(save.freeCaseAt).toBe(NOW + REWARDS.freeCaseMinutes * MINUTE);
    expect(casePayment(save, bath, NOW)).toBeNull();
    save.keys.bath = 1;
    expect(payForCase(save, bath, NOW)).toBe('key');
    expect(save.keys.bath).toBeUndefined();
    save.coins = bath.price;
    expect(payForCase(save, bath, NOW)).toBe('coins');
    expect(save.coins).toBe(0);
    expect(save.stats.opened).toBe(3);
    expect(payForCase(save, box('mellstroy'), NOW)).toBeNull();
    expect(save.stats.opened).toBe(3);
  });

  it('чем дороже кейс, тем он ценнее: средняя ценность выпадения растёт', () => {
    const value = (id: string) => {
      const c = box(id);
      const base = caseOdds(c, CHARACTERS).reduce((sum, o) => sum + o.chance * o.def.price, 0);
      return base * (1 - c.gold) + base * c.gold * (unitPrice(def('panther'), true) / def('panther').price);
    };
    const ids = CASES.map((c) => c.id);
    for (let i = 1; i < ids.length; i++) expect(value(ids[i])).toBeGreaterThan(value(ids[i - 1]));
    // и дают меньше, чем стоят (кейс — развлечение, а не способ заработать), но не намного — иначе их не открывают
    for (const c of CASES) {
      expect(value(c.id) / c.price).toBeGreaterThan(0.7);
      expect(value(c.id) / c.price).toBeLessThan(0.85);
    }
  });
});

describe('колесо удачи', () => {
  it('шансы секторов в сумме — 100%', () => {
    expect(wheelChances().reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(WHEEL.length).toBe(8);
  });

  it('выпадения совпадают с шансами', () => {
    const rng = new Rng(3);
    const counts = new Array<number>(WHEEL.length).fill(0);
    const N = 20000;
    for (let i = 0; i < N; i++) counts[rollWheel(rng)]++;
    wheelChances().forEach((chance, i) => expect(counts[i] / N).toBeCloseTo(chance, 1));
  });

  it('денежный приз растёт с доходом, но не меньше минимума', () => {
    const prize = { minutes: 2, minCoins: 300 };
    expect(coinsPrize(prize, 0)).toBe(300);
    expect(coinsPrize(prize, 100)).toBe(12000);
  });

  it('бесплатный спин — сразу, потом через таймер; за рекламу — не больше лимита в день', () => {
    const save = createSave();
    expect(spinState(save, NOW).free).toBe(true);
    expect(useSpin(save, NOW, 'free')).toBe(true);
    expect(useSpin(save, NOW, 'free')).toBe(false);
    expect(spinState(save, NOW).freeIn).toBe(REWARDS.freeSpinMinutes * MINUTE);
    for (let i = 0; i < REWARDS.adSpinsPerDay; i++) expect(useSpin(save, NOW, 'ad')).toBe(true);
    expect(useSpin(save, NOW, 'ad')).toBe(false);
    // на следующий день лимит снова полный
    const tomorrow = NOW + 24 * 60 * MINUTE;
    expect(dayKey(tomorrow)).not.toBe(dayKey(NOW));
    expect(spinState(save, tomorrow).adLeft).toBe(REWARDS.adSpinsPerDay);
  });

  it('ускоритель продлевается, а не сгорает', () => {
    const save = createSave();
    startBoost(save, NOW);
    startBoost(save, NOW + MINUTE);
    expect(save.boostUntil).toBe(NOW + 2 * REWARDS.boostMinutes * MINUTE);
  });
});

describe('парилка', () => {
  it('шанс — доля ценности с небольшой потерей и потолком', () => {
    expect(upgradeChance(100, 200)).toBeCloseTo(UPGRADER.efficiency / 2);
    expect(upgradeChance(100, 101)).toBe(UPGRADER.maxChance);
  });

  it('цели — только ценнее, по возрастанию, включая свою «Голду»', () => {
    const targets = upgradeTargets(def('kotost'), false, CHARACTERS);
    const values = targets.map((t) => unitPrice(t.def, t.gold));
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    expect(values.every((v) => v > def('kotost').price)).toBe(true);
    expect(targets.some((t) => t.def.id === 'kotost' && t.gold)).toBe(true);
    expect(targets.every((t) => t.chance >= UPGRADER.minChance)).toBe(true);
  });

  it('из самого ценного персонажа прокачиваться некуда', () => {
    expect(upgradeTargets(def('indian-mellstroy'), true, CHARACTERS)).toEqual([]);
  });

  it('успех ровно тогда, когда градусник остановился ниже шанса', () => {
    const rng = new Rng(11);
    let wins = 0;
    for (let i = 0; i < 10000; i++) {
      const { roll, success } = rollUpgrade(rng, 0.3);
      expect(success).toBe(roll < 0.3);
      if (success) wins++;
    }
    expect(wins / 10000).toBeCloseTo(0.3, 1);
  });
});
