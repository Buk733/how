import { describe, expect, it } from 'vitest';
import { rasterizeMarks, smoothLine, type MarkStyle } from './ground-marks';

const DIRT: MarkStyle = { fill: ['#c08040'] };
const SAND: MarkStyle = { fill: ['#e0d090'] };
const REGION = { minX: -5, maxX: 5, minZ: -5, maxZ: 5 };
const PPU = 16;

/** Цвет пикселя под точкой мира (x, z) или null, если там прозрачно. */
function colorAt(pixels: ReturnType<typeof rasterizeMarks>, x: number, z: number): string | null {
  const i = Math.floor((x - REGION.minX) * PPU);
  const j = Math.floor((REGION.maxZ - z) * PPU);
  const k = (j * pixels.width + i) * 4;
  if (pixels.data[k + 3] === 0) return null;
  return '#' + [0, 1, 2].map((c) => pixels.data[k + c].toString(16).padStart(2, '0')).join('');
}

describe('следы на земле', () => {
  it('тропинка закрашена по оси и пуста в стороне', () => {
    const pixels = rasterizeMarks([{ style: DIRT, line: [{ x: -3, z: 0 }, { x: 3, z: 0 }], width: 1 }], REGION, PPU);
    expect(pixels.width).toBe(160);
    expect(pixels.height).toBe(160);
    expect(colorAt(pixels, 0, 0)).toBe('#c08040');
    expect(colorAt(pixels, 0, 0.2)).toBe('#c08040');
    expect(colorAt(pixels, 0, 1.5)).toBeNull();
  });

  it('конец тропинки круглый, а не обрубленный', () => {
    const pixels = rasterizeMarks([{ style: DIRT, line: [{ x: -3, z: 0 }, { x: 0, z: 0 }], width: 1 }], REGION, PPU);
    // чуть дальше конца по оси — ещё тропинка (полукруг)
    expect(colorAt(pixels, 0.25, 0)).not.toBeNull();
    // там, где был бы угол прямоугольника, — уже трава
    expect(colorAt(pixels, 0.45, 0.45)).toBeNull();
  });

  it('у сходящего на нет конца тропинка уже, чем в середине', () => {
    const pixels = rasterizeMarks([{ style: DIRT, line: [{ x: -4, z: 0 }, { x: 4, z: 0 }], width: 1.2, taper: [0, 2] }], REGION, PPU);
    expect(colorAt(pixels, -2, 0.4)).not.toBeNull();
    expect(colorAt(pixels, 3.7, 0.4)).toBeNull();
    expect(colorAt(pixels, 3.7, 0)).not.toBeNull();
  });

  it('следующий след рисуется поверх предыдущего', () => {
    const pixels = rasterizeMarks(
      [
        { style: DIRT, ellipse: { x: 0, z: 0 }, rx: 2, rz: 2 },
        { style: SAND, ellipse: { x: 1, z: 0 }, rx: 1, rz: 1 },
      ],
      REGION,
      PPU,
    );
    expect(colorAt(pixels, -1.5, 0)).toBe('#c08040');
    expect(colorAt(pixels, 1, 0)).toBe('#e0d090');
  });

  it('на развилке тропинок одного стиля нет края', () => {
    const style: MarkStyle = { fill: ['#c08040'], rim: '#806040' };
    const pixels = rasterizeMarks(
      [
        { style, line: [{ x: -3, z: 0 }, { x: 3, z: 0 }], width: 1 },
        { style, line: [{ x: 0, z: -3 }, { x: 0, z: 3 }], width: 1 },
      ],
      REGION,
      PPU,
    );
    // у края второй тропинки, но в глубине первой — середина, а не край
    for (let z = -0.2; z <= 0.2; z += 0.0625) expect(colorAt(pixels, 0.45, z)).toBe('#c08040');
    // а у наружного края тропинки край остаётся
    const across = Array.from({ length: 24 }, (_, i) => colorAt(pixels, -0.75 + i * 0.0625, 2));
    expect(across).toContain('#806040');
  });

  it('строка 0 — южный край: след у большого z попадает в первые строки', () => {
    const pixels = rasterizeMarks([{ style: DIRT, rect: { minX: -6, maxX: 6, minZ: 4, maxZ: 6 } }], REGION, PPU);
    const middle = (pixels.width / 2) * 4 + 3;
    expect(pixels.data[middle]).toBe(255);
    expect(pixels.data[(pixels.height - 1) * pixels.width * 4 + middle]).toBe(0);
  });

  it('вытоптанная трава закрашена только частью пикселей', () => {
    const pixels = rasterizeMarks([{ style: { ...DIRT, coverage: 0.5 }, ellipse: { x: 0, z: 0 }, rx: 3, rz: 3 }], REGION, PPU);
    let painted = 0;
    let total = 0;
    for (let z = -1; z < 1; z += 0.0625)
      for (let x = -1; x < 1; x += 0.0625) {
        total++;
        if (colorAt(pixels, x, z)) painted++;
      }
    expect(painted / total).toBeGreaterThan(0.35);
    expect(painted / total).toBeLessThan(0.65);
  });

  it('сглаживание оставляет концы ломаной на месте', () => {
    const points = [{ x: 0, z: 0 }, { x: 2, z: 1 }, { x: 4, z: 0 }];
    const smooth = smoothLine(points);
    expect(smooth[0]).toEqual(points[0]);
    expect(smooth[smooth.length - 1]).toEqual(points[2]);
    expect(smooth.length).toBeGreaterThan(points.length);
  });
});
