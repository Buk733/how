import { describe, expect, it } from 'vitest';
import { clamp, clampToBox, clampToRadius, damp, distanceXZ, pushOutOfBoxes, pushOutOfCircles } from './math';

describe('clamp / damp', () => {
  it('clamp держит значение в границах', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it('damp не зависит от того, как время разбито на кадры', () => {
    const oneStep = damp(0, 10, 4, 0.5);
    let manySteps = 0;
    for (let i = 0; i < 50; i++) manySteps = damp(manySteps, 10, 4, 0.01);
    expect(manySteps).toBeCloseTo(oneStep, 10);
    expect(oneStep).toBeGreaterThan(0);
    expect(oneStep).toBeLessThan(10);
  });
});

describe('столкновения', () => {
  it('выталкивает круг из круглого препятствия', () => {
    const p = pushOutOfCircles(0.5, 0, 0.5, [{ x: 0, z: 0, radius: 1 }]);
    expect(distanceXZ(p, { x: 0, z: 0 })).toBeCloseTo(1.5);
    expect(p.z).toBeCloseTo(0);
  });

  it('не трогает круг, который не задевает препятствие', () => {
    expect(pushOutOfCircles(3, 0, 0.5, [{ x: 0, z: 0, radius: 1 }])).toEqual({ x: 3, z: 0 });
  });

  it('выталкивает круг из прямоугольника снаружи и изнутри', () => {
    const box = { minX: 0, maxX: 2, minZ: 0, maxZ: 2 };
    expect(pushOutOfBoxes(-0.2, 1, 0.5, [box]).x).toBeCloseTo(-0.5);
    const fromInside = pushOutOfBoxes(1.9, 1, 0.5, [box]);
    expect(fromInside.x).toBeCloseTo(2.5);
    expect(fromInside.z).toBeCloseTo(1);
  });

  it('держит точку внутри круга и прямоугольника', () => {
    const inRadius = clampToRadius(10, 0, 5);
    expect(inRadius.x).toBeCloseTo(5);
    expect(clampToBox(-9, 9, { minX: -1, maxX: 1, minZ: -2, maxZ: 2 })).toEqual({ x: -1, z: 2 });
  });
});
