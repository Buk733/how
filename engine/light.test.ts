import { describe, expect, it } from 'vitest';
import { gradeColor, gradeGlsl, type ColorGrade } from './light';

const NONE: ColorGrade = {
  exposure: 1,
  balance: [1, 1, 1],
  greens: { red: 0, blue: 0 },
  saturation: 1,
  contrast: 0,
  shadows: { tint: '#808080', amount: 0 },
  highlights: { tint: '#808080', amount: 0 },
};

const WARM: ColorGrade = { ...NONE, balance: [1.05, 1, 0.88], greens: { red: 0.42, blue: 0.3 } };

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

describe('цветокоррекция', () => {
  it('без настроек цвет не меняется', () => {
    for (const hex of ['#000000', '#ffffff', '#9fd8f5', '#39bb66', '#caa87a']) expect(gradeColor(NONE, hex)).toBe(hex);
  });

  it('тёплый баланс: серый становится желтее', () => {
    const [r, , b] = channels(gradeColor(WARM, '#808080'));
    expect(r).toBeGreaterThan(128);
    expect(b).toBeLessThan(128);
  });

  it('мятная трава уходит к жёлтому, а дерево, кожа и красный — без сдвига зелени', () => {
    const [r, g, b] = channels(gradeColor(WARM, '#39bb66'));
    expect(r).toBeGreaterThan(0x39 + 30);
    expect(b).toBeLessThan(0x66 - 30);
    expect(g).toBe(0xbb);
    const noGreens = { ...WARM, greens: { red: 0, blue: 0 } };
    for (const hex of ['#caa87a', '#f2c9a0', '#d43d4f']) expect(gradeColor(WARM, hex)).toBe(gradeColor(noGreens, hex));
  });

  it('насыщенность и контраст не выводят цвет за пределы', () => {
    const strong = { ...WARM, saturation: 3, contrast: 1, exposure: 1.5 };
    for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000']) expect(gradeColor(strong, hex)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('шейдер собирается из тех же чисел: целые — с точкой, как требует GLSL', () => {
    const glsl = gradeGlsl(WARM);
    expect(glsl).toContain('vec3 CustomToneMapping( vec3 color )');
    expect(glsl).toContain('vec3(1.05, 1.0, 0.88)');
    expect(glsl).toContain('vec3( 0.42, 0.0, -0.3 )');
    expect(glsl).not.toMatch(/undefined|NaN/);
  });
});
