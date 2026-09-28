import { describe, expect, it } from 'vitest';
import { cameraRelative, Facing, facingFromCamera } from './direction';

describe('cameraRelative', () => {
  it('при yaw = 0 «вперёд» — это −Z, «вправо» — +X', () => {
    const forward = cameraRelative(0, 1, 0);
    expect(forward.x).toBeCloseTo(0);
    expect(forward.z).toBeCloseTo(-1);
    const right = cameraRelative(1, 0, 0);
    expect(right.x).toBeCloseTo(1);
    expect(right.z).toBeCloseTo(0);
  });

  it('поворачивается вместе с камерой', () => {
    const forward = cameraRelative(0, 1, Math.PI / 2);
    expect(forward.x).toBeCloseTo(-1);
    expect(forward.z).toBeCloseTo(0);
  });
});

describe('facingFromCamera', () => {
  it('выбирает ряд спрайта по направлению относительно камеры', () => {
    expect(facingFromCamera(0, 1, 0)).toBe(Facing.Front);
    expect(facingFromCamera(0, -1, 0)).toBe(Facing.Back);
    expect(facingFromCamera(1, 0, 0)).toBe(Facing.Right);
    expect(facingFromCamera(-1, 0, 0)).toBe(Facing.Left);
  });

  it('после поворота камеры на 180° лицо и спина меняются местами', () => {
    expect(facingFromCamera(0, 1, Math.PI)).toBe(Facing.Back);
  });

  it('на диагонали сохраняет прошлый ряд, чтобы спрайт не мигал', () => {
    const d = Math.SQRT1_2;
    expect(facingFromCamera(d, -d, 0, Facing.Right)).toBe(Facing.Right);
    expect(facingFromCamera(d, -d, 0, Facing.Back)).toBe(Facing.Back);
  });
});
