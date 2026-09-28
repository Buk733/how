import { describe, expect, it } from 'vitest';
import { ECONOMY } from './config';
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
    save.tutorial = 2;
    expect(parseSave(JSON.parse(JSON.stringify(save)), known)).toEqual(save);
  });

  it('чинит сломанные значения и выкидывает неизвестных персонажей', () => {
    const save = parseSave(
      {
        version: 1,
        coins: -50,
        unlocked: 100,
        slots: [{ id: 'panther', stored: 'много' }, { id: 'удалённый', stored: 5 }],
        stats: { bought: 3 },
      },
      known,
    );
    expect(save.coins).toBe(ECONOMY.startCoins);
    expect(save.unlocked).toBe(ECONOMY.totalSlots);
    expect(save.slots[0]).toEqual({ id: 'panther', stored: 0 });
    expect(save.slots[1]).toEqual({ id: null, stored: 0 });
    expect(save.stats).toEqual({ bought: 3, earned: 0 });
  });
});
