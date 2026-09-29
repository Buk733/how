import { describe, expect, it } from 'vitest';
import { segmentHitsBox, type Box, type PointXZ } from './math';
import { NavGrid } from './pathfinding';

const bounds: Box = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
/** Стена поперёк поля с проходом у края: x от −10 до 6, z = 0. */
const wall: Box = { minX: -10, maxX: 6, minZ: -0.25, maxZ: 0.25 };

const length = (from: PointXZ, path: readonly PointXZ[]) =>
  path.reduce((sum, p, i) => sum + Math.hypot(p.x - (i ? path[i - 1] : from).x, p.z - (i ? path[i - 1] : from).z), 0);

describe('NavGrid', () => {
  it('без препятствий — прямо к цели', () => {
    const grid = new NavGrid({ boxes: [], circles: [], bounds }, 0.35);
    expect(grid.findPath({ x: -5, z: -5 }, { x: 5, z: 5 })).toEqual([{ x: 5, z: 5 }]);
  });

  it('обходит стену через проход, не пересекая её', () => {
    const grid = new NavGrid({ boxes: [wall], circles: [], bounds }, 0.35);
    const from = { x: -5, z: -3 };
    const to = { x: -5, z: 3 };
    const path = grid.findPath(from, to);
    expect(path).not.toBeNull();
    const points = [from, ...(path ?? [])];
    for (let i = 1; i < points.length; i++) expect(segmentHitsBox(points[i - 1], points[i], wall)).toBe(false);
    expect(points.at(-1)).toEqual(to);
    // путь идёт через проход у x > 6, поэтому заметно длиннее прямой
    expect(length(from, path ?? [])).toBeGreaterThan(20);
    expect(path?.length).toBeLessThan(5);
  });

  it('к замурованной цели пути нет', () => {
    const box = (minX: number, maxX: number, minZ: number, maxZ: number): Box => ({ minX, maxX, minZ, maxZ });
    const walls = [box(2, 8, 2, 2.5), box(2, 8, 7.5, 8), box(2, 2.5, 2, 8), box(7.5, 8, 2, 8)];
    const grid = new NavGrid({ boxes: walls, circles: [], bounds }, 0.35);
    expect(grid.findPath({ x: -5, z: -5 }, { x: 5, z: 5 })).toBeNull();
  });

  it('обходит деревья', () => {
    const grid = new NavGrid({ boxes: [], circles: [{ x: 0, z: 0, radius: 1 }], bounds }, 0.35);
    expect(grid.clear({ x: -3, z: 0 }, { x: 3, z: 0 })).toBe(true); // деревья не мешают идти напрямую — их обходит скольжение
    expect(grid.findPath({ x: -3, z: 0 }, { x: 3, z: 0 })).toEqual([{ x: 3, z: 0 }]);
  });
});

describe('segmentHitsBox', () => {
  const box: Box = { minX: 0, maxX: 1, minZ: 0, maxZ: 1 };

  it('отрезок сквозь прямоугольник и мимо него', () => {
    expect(segmentHitsBox({ x: -1, z: 0.5 }, { x: 2, z: 0.5 }, box)).toBe(true);
    expect(segmentHitsBox({ x: -1, z: 2 }, { x: 2, z: 2 }, box)).toBe(false);
    expect(segmentHitsBox({ x: -1, z: 0.5 }, { x: -0.1, z: 0.5 }, box)).toBe(false);
  });

  it('учитывает толщину идущего', () => {
    expect(segmentHitsBox({ x: -1, z: 1.3 }, { x: 2, z: 1.3 }, box)).toBe(false);
    expect(segmentHitsBox({ x: -1, z: 1.3 }, { x: 2, z: 1.3 }, box, 0.35)).toBe(true);
  });

  it('от стены, в которую упёрся, можно отойти', () => {
    expect(segmentHitsBox({ x: 0.5, z: 1.1 }, { x: 0.5, z: 3 }, box, 0.35)).toBe(false);
  });
});
