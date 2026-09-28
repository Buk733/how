import { describe, expect, it } from 'vitest';
import { formatNumber } from './format';

describe('formatNumber', () => {
  it('небольшие числа — как есть, без дробной части', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999.9)).toBe('999');
  });

  it('большие — коротко, с запятой и округлением вниз', () => {
    expect(formatNumber(1000)).toBe('1K');
    expect(formatNumber(1234)).toBe('1,23K');
    expect(formatNumber(12_345)).toBe('12,3K');
    expect(formatNumber(100_000)).toBe('100K');
    expect(formatNumber(999_999)).toBe('999K');
    expect(formatNumber(5_600_000)).toBe('5,6M');
    expect(formatNumber(2_000_000_000)).toBe('2B');
  });
});
