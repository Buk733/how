import { describe, expect, it } from 'vitest';
import { BoxModel, faceShade } from './boxes';

/** u, v вершины i геометрии и её x. */
function vertex(geometry: ReturnType<BoxModel['build']>, i: number) {
  const uv = geometry.getAttribute('uv');
  const position = geometry.getAttribute('position');
  return { u: uv.getX(i), v: uv.getY(i), x: position.getX(i), y: position.getY(i), z: position.getZ(i) };
}

describe('модель из коробок', () => {
  it('рисует только указанные грани, по две треугольника на грань', () => {
    const geometry = new BoxModel().box([2, 1, 1], [0, 0.5, 0], { near: [0], top: [0], front: [0] }).build();
    expect(geometry.getAttribute('position').count).toBe(12);
    expect(geometry.getIndex()!.count).toBe(18);
  });

  it('грани одного материала — одна группа, даже из разных коробок', () => {
    const geometry = new BoxModel()
      .box([1, 1, 1], [0, 0, 0], { near: [1], top: [0] })
      .box([1, 1, 1], [3, 0, 0], { near: [1], top: [0], front: [2] })
      .build();
    expect(geometry.groups.map((g) => [g.materialIndex, g.count])).toEqual([
      [0, 12],
      [1, 12],
      [2, 6],
    ]);
  });

  it('ближний бок: зад слева, клетка листа по строке', () => {
    const geometry = new BoxModel([[1, 2]]).box([4, 1, 2], [0, 0.5, 0], { near: [0, 0, 1] }).build();
    const [bottomLeft, bottomRight, topRight] = [0, 1, 2].map((i) => vertex(geometry, i));
    expect(bottomLeft).toMatchObject({ u: 0, v: 0, x: -2, y: 0, z: 1 });
    expect(bottomRight).toMatchObject({ u: 1, x: 2 });
    // строка 1 из двух — нижняя половина картинки
    expect(topRight.v).toBeCloseTo(0.5);
  });

  it('дальний бок — зеркально: зад картинки тоже сзади', () => {
    const geometry = new BoxModel().box([4, 1, 2], [0, 0.5, 0], { far: [0] }).build();
    const [bottomLeft, bottomRight] = [0, 1].map((i) => vertex(geometry, i));
    expect(bottomLeft).toMatchObject({ x: 2, z: -1, u: 1 });
    expect(bottomRight).toMatchObject({ x: -2, u: 0 });
  });

  it('грани смотрят наружу', () => {
    const geometry = new BoxModel().box([1, 1, 1], [0, 0, 0], { near: [0], far: [0], front: [0], back: [0], top: [0] }).build();
    const index = geometry.getIndex()!;
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    for (let t = 0; t < index.count; t += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => index.getX(t + k));
      const ab = [position.getX(b) - position.getX(a), position.getY(b) - position.getY(a), position.getZ(b) - position.getZ(a)];
      const ac = [position.getX(c) - position.getX(a), position.getY(c) - position.getY(a), position.getZ(c) - position.getZ(a)];
      const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
      const dot = cross[0] * normal.getX(a) + cross[1] * normal.getY(a) + cross[2] * normal.getZ(a);
      expect(dot).toBeGreaterThan(0);
    }
  });

  it('наклонная грань смотрит вверх-вперёд, верх при этом короче низа', () => {
    const geometry = new BoxModel().box([2, 1, 1], [0, 0.5, 0], { front: [0], top: [0] }, { slant: [0, 0.5] }).build();
    const normal = geometry.getAttribute('normal');
    // перед: нормаль с подъёмом
    expect(normal.getX(0)).toBeGreaterThan(0.5);
    expect(normal.getY(0)).toBeGreaterThan(0.3);
    // верх кончается на 0.5 раньше низа
    const position = geometry.getAttribute('position');
    const xs = [4, 5, 6, 7].map((i) => position.getX(i));
    expect(Math.max(...xs)).toBeCloseTo(0.5);
  });

  it('верх светлее ближнего бока, ближний бок светлее торцов и дальнего бока', () => {
    const top = faceShade([0, 1, 0]);
    const near = faceShade([0, 0, 1]);
    expect(top).toBe(1);
    expect(near).toBeLessThan(top);
    expect(faceShade([1, 0, 0])).toBeLessThan(near);
    expect(faceShade([0, 0, -1])).toBeLessThan(faceShade([1, 0, 0]));
  });
});

