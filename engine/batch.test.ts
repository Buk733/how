import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createBillboardBatch } from './batch';
import type { SpriteSheet } from './sprite';

const sheet: SpriteSheet = { url: '', frameWidth: 16, frameHeight: 32, pixelsPerUnit: 16, texture: new THREE.Texture(), columns: 4, rows: 2 };

describe('пачка билбордов', () => {
  it('по четыре угла и два треугольника на спрайт, точка привязки — у каждого угла', () => {
    const mesh = createBillboardBatch(sheet, [
      { x: 1, z: 2 },
      { x: -3, z: 5, y: 0.5 },
    ]);
    const geometry = mesh.geometry;
    expect(geometry.getAttribute('position').count).toBe(8);
    expect(geometry.getIndex()?.count).toBe(12);
    const position = geometry.getAttribute('position');
    expect([position.getX(0), position.getY(0), position.getZ(0)]).toEqual([1, 0, 2]);
    expect([position.getX(7), position.getY(7), position.getZ(7)]).toEqual([-3, 0.5, 5]);
  });

  it('углы — размер кадра в единицах мира с учётом масштаба, низ на земле', () => {
    const mesh = createBillboardBatch(sheet, [{ x: 0, z: 0, scale: 2 }]);
    const corner = mesh.geometry.getAttribute('corner');
    // кадр 16×32 при 16 px на единицу — 1×2, вдвое крупнее — 2×4
    expect([corner.getX(0), corner.getY(0)]).toEqual([-1, 0]);
    expect([corner.getX(2), corner.getY(2)]).toEqual([1, 4]);
  });

  it('кадр листа и отражение задаются координатами текстуры', () => {
    const mesh = createBillboardBatch(sheet, [
      { x: 0, z: 0, column: 2, row: 1 },
      { x: 0, z: 0, column: 2, row: 1, flip: true },
    ]);
    const uv = mesh.geometry.getAttribute('uv');
    // левый нижний угол кадра (2, 1): u = 2/4, v = 1 − 2/2
    expect([uv.getX(0), uv.getY(0)]).toEqual([0.5, 0]);
    expect([uv.getX(2), uv.getY(2)]).toEqual([0.75, 0.5]);
    // отражённый: левый угол берёт правый край кадра
    expect(uv.getX(4)).toBe(0.75);
    expect(uv.getX(5)).toBe(0.5);
  });
});
