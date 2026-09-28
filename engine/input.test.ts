import { describe, expect, it } from 'vitest';
import { keysToVector } from './input';

describe('keysToVector', () => {
  it('WASD и стрелки дают направление', () => {
    expect(keysToVector(new Set(['KeyW']))).toEqual({ x: 0, y: 1 });
    expect(keysToVector(new Set(['ArrowLeft']))).toEqual({ x: -1, y: 0 });
  });

  it('по диагонали не быстрее, чем по прямой', () => {
    const v = keysToVector(new Set(['KeyW', 'KeyD']));
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
  });

  it('противоположные клавиши гасят друг друга', () => {
    expect(keysToVector(new Set(['KeyA', 'KeyD']))).toEqual({ x: 0, y: 0 });
  });
});
