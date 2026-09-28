import { describe, expect, it } from 'vitest';
import { Rng } from '@engine/rng';
import { CHARACTERS } from './data/characters';
import { RARITIES } from './data/rarity';
import { pickCharacter, Spawner } from './spawner';

describe('pickCharacter', () => {
  it('редкости выпадают примерно по своим весам', () => {
    const rng = new Rng(123);
    const counts = new Map<string, number>();
    const runs = 20_000;
    for (let i = 0; i < runs; i++) {
      const c = pickCharacter(CHARACTERS, rng.next(), rng.next());
      counts.set(c.rarity, (counts.get(c.rarity) ?? 0) + 1);
    }
    const present = [...new Set(CHARACTERS.map((c) => c.rarity))].filter((r) => RARITIES[r].weight > 0);
    const total = present.reduce((sum, r) => sum + RARITIES[r].weight, 0);
    for (const rarity of present) {
      const expected = RARITIES[rarity].weight / total;
      expect((counts.get(rarity) ?? 0) / runs).toBeCloseTo(expected, 1);
    }
  });

  it('крайние значения броска не ломают выбор', () => {
    expect(pickCharacter(CHARACTERS, 0, 0)).toBeDefined();
    expect(pickCharacter(CHARACTERS, 0.999999, 0.999999)).toBeDefined();
  });
});

describe('Spawner', () => {
  it('выпускает персонажей с паузами из заданного промежутка', () => {
    const spawner = new Spawner(new Rng(5), CHARACTERS, [2, 3]);
    let spawned = 0;
    for (let t = 0; t < 30; t += 0.1) if (spawner.update(0.1)) spawned++;
    expect(spawned).toBeGreaterThanOrEqual(9);
    expect(spawned).toBeLessThanOrEqual(15);
  });
});
