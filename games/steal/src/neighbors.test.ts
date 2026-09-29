import { describe, expect, it } from 'vitest';
import { Rng } from '@engine/rng';
import { CHARACTERS, characterById } from './data/characters';
import { createNeighborRoster, neighborSlotFor, pickRaidTarget, playerPower, rollNeighborCharacter, tierOf } from './neighbors';
import { createSave } from './save';

const def = (id: string) => {
  const found = characterById(id);
  if (!found) throw new Error(id);
  return found;
};

describe('соседи', () => {
  it('сила игрока — самая высокая редкость на его полке', () => {
    const save = createSave();
    expect(playerPower(save.slots)).toBe(-1);
    save.slots[0].id = 'panther';
    save.slots[1].id = 'baba-chai';
    expect(playerPower(save.slots)).toBe(tierOf('epic'));
  });

  it('у новичка соседи держат обычных и редких, а не легендарных', () => {
    const rng = new Rng(9);
    for (let i = 0; i < 500; i++) {
      const tier = tierOf(rollNeighborCharacter(rng, CHARACTERS, -1).rarity);
      expect(tier).toBeLessThanOrEqual(tierOf('rare'));
    }
  });

  it('с ростом игрока соседи тоже богатеют', () => {
    const rng = new Rng(3);
    const average = (power: number) => {
      let sum = 0;
      for (let i = 0; i < 400; i++) sum += tierOf(rollNeighborCharacter(rng, CHARACTERS, power).rarity);
      return sum / 400;
    };
    expect(average(tierOf('epic'))).toBeGreaterThan(average(tierOf('common')) + 1);
  });

  it('полок соседа заполнен частично, «Голда» — с заданным шансом', () => {
    const roster = createNeighborRoster(new Rng(1), CHARACTERS, 0, 6);
    expect(roster).toHaveLength(6);
    expect(roster.filter(Boolean).length).toBe(4);
    expect(roster.slice(4)).toEqual([null, null]);
    expect(roster.every((unit) => !unit?.gold)).toBe(true);
    const golden = createNeighborRoster(new Rng(1), CHARACTERS, 0, 6, 1);
    expect(golden.filter(Boolean).every((unit) => unit?.gold)).toBe(true);
  });

  it('вор выбирает самого доходного из доступных', () => {
    const save = createSave();
    save.slots[0].id = 'kotost';
    save.slots[1].id = 'baba-chai';
    save.slots[2].id = 'panther';
    expect(pickRaidTarget(save.slots, () => true)).toBe(1);
    expect(pickRaidTarget(save.slots, (i) => i !== 1)).toBe(0);
    expect(pickRaidTarget(createSave().slots, () => true)).toBe(-1);
  });

  it('новый персонаж соседа садится на свободное место или вместо слабого', () => {
    const unit = (id: string, gold = false) => ({ id, gold });
    expect(neighborSlotFor([unit('panther'), null, unit('kotost')], def('diver'))).toBe(1);
    expect(neighborSlotFor([unit('kotost'), unit('panther'), unit('diver')], def('baba-chai'))).toBe(1);
    expect(neighborSlotFor([unit('kotost'), unit('diver')], def('panther'))).toBe(-1);
    // «Голда» ценится вдвое: золотую пантеру не заменит обычный рыцарь
    expect(neighborSlotFor([unit('panther', true), unit('kotost')], def('anime-cook'))).toBe(-1);
  });

  it('вор выбирает самого доходного с учётом «Голды»', () => {
    const save = createSave();
    save.slots[0] = { id: 'kotost', gold: false, stored: 0 };
    save.slots[1] = { id: 'anime-knight', gold: true, stored: 0 };
    expect(pickRaidTarget(save.slots, () => true)).toBe(0);
    save.slots[1] = { id: 'diver', gold: true, stored: 0 };
    expect(pickRaidTarget(save.slots, () => true)).toBe(1);
  });
});
