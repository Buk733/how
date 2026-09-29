import { describe, expect, it } from 'vitest';
import { BOT, ECONOMY, NEIGHBORS, UPGRADES } from './config';
import { createSave, parseSave } from './save';

const known = new Set(['panther', 'kotost']);

describe('parseSave', () => {
  it('пустое или чужое сохранение — новая игра', () => {
    expect(parseSave(null, known)).toEqual(createSave());
    expect(parseSave('мусор', known)).toEqual(createSave());
    expect(parseSave({ version: 99, coins: 5 }, known)).toEqual(createSave());
  });

  it('переживает круговорот через JSON', () => {
    const save = createSave();
    save.coins = 1234;
    save.unlocked = 5;
    save.slots[4] = { id: 'kotost', gold: true, stored: 12.5 };
    save.neighbors = NEIGHBORS.map(() => ({ slots: Array.from({ length: BOT.slots }, (_, i) => (i === 0 ? { id: 'panther', gold: i === 0 } : null)) }));
    save.upgrades = { speed: 2, broom: 1, latch: 3, stove: 4 };
    save.keys = { bath: 2, gold: 1 };
    save.freeCaseAt = 111;
    save.freeSpinAt = 222;
    save.adSpins = { day: '2026-09-29', count: 2 };
    save.boostUntil = 333;
    save.music = false;
    save.tutorial = 3;
    save.stats = { bought: 2, earned: 100, stolen: 1, lost: 0, opened: 5, upgraded: 1 };
    expect(parseSave(JSON.parse(JSON.stringify(save)), known)).toEqual(save);
  });

  it('читает сохранение версии 1: соседей, прокачки и «Голды» ещё нет', () => {
    const v1 = { version: 1, coins: 300, unlocked: 4, slots: [{ id: 'kotost', stored: 3 }], tutorial: 2, muted: true, stats: { bought: 5, earned: 40 }, savedAt: 1 };
    const save = parseSave(v1, known);
    expect(save.version).toBe(4);
    expect(save.coins).toBe(300);
    expect(save.slots[0]).toEqual({ id: 'kotost', gold: false, stored: 3 });
    expect(save.neighbors).toEqual([]);
    expect(save.upgrades).toEqual({ speed: 0, broom: 0, latch: 0, stove: 0 });
    expect(save.music).toBe(true);
    expect(save.tutorial).toBe(2);
    expect(save.stats).toEqual({ bought: 5, earned: 40, stolen: 0, lost: 0, opened: 0, upgraded: 0 });
  });

  it('читает сохранение версии 3: у соседей были просто id, кейсов и таймеров ещё нет', () => {
    const neighbors = NEIGHBORS.map(() => ({ slots: ['panther', null, 'удалённый'] }));
    const save = parseSave({ version: 3, coins: 10, unlocked: 5, slots: [], neighbors, upgrades: { speed: 1 }, tutorial: 3 }, known);
    expect(save.version).toBe(4);
    expect(save.neighbors[0].slots.slice(0, 3)).toEqual([{ id: 'panther', gold: false }, null, null]);
    expect(save.upgrades.speed).toBe(1);
    expect(save.keys).toEqual({});
    expect(save.freeCaseAt).toBe(0);
    expect(save.freeSpinAt).toBe(0);
  });

  it('чинит сломанные значения и выкидывает неизвестное', () => {
    const save = parseSave(
      {
        version: 4,
        coins: -50,
        unlocked: 100,
        slots: [{ id: 'panther', gold: 'да', stored: 'много' }, { id: 'удалённый', stored: 5 }],
        neighbors: [{ slots: [{ id: 'kotost', gold: true }, { id: 'удалённый' }] }, { slots: 'не массив' }],
        upgrades: { speed: 99, broom: -1, latch: 'два', stove: 2.7 },
        keys: { bath: 2.9, unknown: 5, meme: -1 },
        adSpins: { day: 5 },
        boostUntil: -10,
        stats: { bought: 3 },
      },
      known,
    );
    expect(save.coins).toBe(ECONOMY.startCoins);
    expect(save.unlocked).toBe(ECONOMY.totalSlots);
    expect(save.slots[0]).toEqual({ id: 'panther', gold: false, stored: 0 });
    expect(save.slots[1]).toEqual({ id: null, gold: false, stored: 0 });
    expect(save.neighbors[0].slots.slice(0, 2)).toEqual([{ id: 'kotost', gold: true }, null]);
    expect(save.neighbors[0].slots).toHaveLength(BOT.slots);
    expect(save.neighbors[1].slots.every((unit) => unit === null)).toBe(true);
    expect(save.upgrades).toEqual({ speed: UPGRADES.speed.costs.length, broom: 0, latch: 0, stove: 2 });
    expect(save.keys).toEqual({ bath: 2 });
    expect(save.adSpins).toEqual({ day: '', count: 0 });
    expect(save.boostUntil).toBe(0);
    expect(save.stats).toEqual({ bought: 3, earned: 0, stolen: 0, lost: 0, opened: 0, upgraded: 0 });
  });
});
