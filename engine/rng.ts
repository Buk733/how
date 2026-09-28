import type { PointXZ } from './math';

/**
 * Генератор случайных чисел с зерном (алгоритм mulberry32).
 * Одно и то же зерно всегда даёт одну и ту же последовательность — и один и тот же мир.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Число в диапазоне [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Число в диапазоне [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Целое число в диапазоне [min, max). */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Случайная точка в кольце между minRadius и maxRadius, равномерно по площади. */
  pointInRing(minRadius: number, maxRadius: number): PointXZ {
    const radius = Math.sqrt(this.range(minRadius * minRadius, maxRadius * maxRadius));
    const angle = this.range(0, Math.PI * 2);
    return { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius };
  }
}
