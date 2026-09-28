import { describe, expect, it } from 'vitest';
import { Rng } from './rng';

describe('Rng', () => {
  it('одно зерно — одна последовательность', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 20; i++) expect(a.next()).toBe(b.next());
  });

  it('числа в нужных диапазонах', () => {
    const rng = new Rng(1);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      const n = rng.int(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThan(7);
      const p = rng.pointInRing(2, 5);
      const r = Math.hypot(p.x, p.z);
      expect(r).toBeGreaterThanOrEqual(2 - 1e-9);
      expect(r).toBeLessThanOrEqual(5 + 1e-9);
    }
  });
});
