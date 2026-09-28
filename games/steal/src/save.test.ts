import { describe, expect, it } from 'vitest';
import { BOT, ECONOMY, NEIGHBORS } from './config';
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
    save.slots[4] = { id: 'kotost', stored: 12.5 };
    save.neighbors = NEIGHBORS.map(() => ({ slots: Array.from({ length: BOT.slots }, (_, i) => (i === 0 ? 'panther' : null)) }));
    save.tutorial = 3;
    save.stats = { bought: 2, earned: 100, stolen: 1, lost: 0 };
    expect(parseSave(JSON.parse(JSON.stringify(save)), known)).toEqual(save);
  });

  it('читает сохранение версии 1: соседей ещё нет, статистика краж — ноль', () => {
    const v1 = { version: 1, coins: 300, unlocked: 4, slots: [{ id: 'kotost', stored: 3 }], tutorial: 2, muted: true, stats: { bought: 5, earned: 40 }, savedAt: 1 };
    const save = parseSave(v1, known);
    expect(save.version).toBe(2);
    expect(save.coins).toBe(300);
    expect(save.slots[0]).toEqual({ id: 'kotost', stored: 3 });
    expect(save.neighbors).toEqual([]);
    expect(save.tutorial).toBe(2);
    expect(save.stats).toEqual({ bought: 5, earned: 40, stolen: 0, lost: 0 });
  });

  it('чинит сломанные значения и выкидывает неизвестных персонажей', () => {
    const save = parseSave(
      {
        version: 2,
        coins: -50,
        unlocked: 100,
        slots: [{ id: 'panther', stored: 'много' }, { id: 'удалённый', stored: 5 }],
        neighbors: [{ slots: ['kotost', 'удалённый'] }, { slots: 'не массив' }],
        stats: { bought: 3 },
      },
      known,
    );
    expect(save.coins).toBe(ECONOMY.startCoins);
    expect(save.unlocked).toBe(ECONOMY.totalSlots);
    expect(save.slots[0]).toEqual({ id: 'panther', stored: 0 });
    expect(save.slots[1]).toEqual({ id: null, stored: 0 });
    expect(save.neighbors[0].slots.slice(0, 2)).toEqual(['kotost', null]);
    expect(save.neighbors[0].slots).toHaveLength(BOT.slots);
    expect(save.neighbors[1].slots.every((id) => id === null)).toBe(true);
    expect(save.stats).toEqual({ bought: 3, earned: 0, stolen: 0, lost: 0 });
  });
});
