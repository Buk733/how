// Прокачка соседей без графики: уровень соседа и что он даёт — это легко тестировать.
import { clamp } from '@engine/math';
import { BOT, NEIGHBORS, RIVALS } from './config';

/** Характер соседа из config.ts (NEIGHBORS). */
export type NeighborTrait = Pick<(typeof NEIGHBORS)[number], 'levelOffset' | 'sleepFactor' | 'awakeFactor'>;

/** Сила соседа на его уровне. */
export interface RivalStats {
  /** Уровень 1…5. */
  readonly level: number;
  /** Во сколько раз быстрее ходит и бегает, чем на первом уровне. */
  readonly speed: number;
  /** Насколько быстрее вора с добычей бежит в погоне, ед./с. */
  readonly chaseEdge: number;
  /** На сколько секунд короче оглушение от веника игрока. */
  readonly toughness: number;
  /** Сколько длится замах веником, секунды. */
  readonly windup: number;
  /** Сколько секунд оглушён игрок, которого выгнали веником. */
  readonly hitStun: number;
  readonly sleepTime: readonly [number, number];
  readonly awakeTime: readonly [number, number];
  readonly latchOpen: readonly [number, number];
  readonly latchClosed: readonly [number, number];
  /** Собака у входа. */
  readonly dog: boolean;
  /** Колокольчик над полком: будит спящего хозяина, если что-то украли. */
  readonly bell: boolean;
}

/**
 * Уровень соседа: растёт с лучшим доходом игрока (монет в секунду без печи и ускорителя).
 * offset — характер: соня отстаёт на уровень.
 */
export function rivalLevel(peakIncome: number, offset = 0): number {
  const reached = RIVALS.incomeSteps.filter((step) => peakIncome >= step).length;
  return clamp(1 + reached + offset, 1, RIVALS.maxLevel);
}

const scale = ([min, max]: readonly [number, number], factor: number): [number, number] => [min * factor, max * factor];

/** Что умеет сосед на уровне level с характером trait. */
export function rivalStats(level: number, trait: NeighborTrait): RivalStats {
  const steps = level - 1;
  const latch = RIVALS.latchPerLevel * steps;
  return {
    level,
    speed: 1 + RIVALS.speedPerLevel * steps,
    chaseEdge: BOT.chaseEdge + RIVALS.chaseEdgePerLevel * steps,
    toughness: RIVALS.toughnessPerLevel * steps,
    windup: BOT.swingWindup - RIVALS.windupPerLevel * steps,
    hitStun: BOT.hitStun + RIVALS.hitStunPerLevel * steps,
    sleepTime: scale(BOT.sleepTime, trait.sleepFactor * (1 - RIVALS.sleepPerLevel * steps)),
    awakeTime: scale(BOT.awakeTime, trait.awakeFactor * (1 + RIVALS.sleepPerLevel * steps)),
    latchOpen: [Math.max(15, BOT.latchOpen[0] - latch), Math.max(20, BOT.latchOpen[1] - latch)],
    latchClosed: [BOT.latchClosed[0] + latch, BOT.latchClosed[1] + latch],
    dog: level >= RIVALS.dogLevel,
    bell: level >= RIVALS.bellLevel,
  };
}

/** Сколько секунд сосед стоит оглушённый после веника игрока: закалка съедает часть оглушения. */
export function stunOn(playerStun: number, stats: RivalStats): number {
  return Math.max(RIVALS.minStun, playerStun - stats.toughness);
}

/** Скорость хозяина в погоне: чуть быстрее вора с добычей, и тем быстрее, чем выше уровень. */
export function chaseSpeed(thiefSpeed: number, stats: RivalStats): number {
  return thiefSpeed + stats.chaseEdge;
}

/** Подсказка в окне прокачки: какого уровня соседи сейчас. */
export function describeRivals(peakIncome: number): string {
  const levels = NEIGHBORS.map((n) => `${n.name} — ур. ${rivalLevel(peakIncome, n.levelOffset)}`).join(', ');
  return `Соседи качаются вместе с тобой: ${levels}. Их закалка съедает часть оглушения веником, а в погоне они быстрее.`;
}

/** Что появилось у соседа на новом уровне — для объявления. */
export function levelNews(level: number): string {
  if (level === RIVALS.dogLevel) return 'завёл собаку у входа';
  if (level === RIVALS.bellLevel) return 'повесил колокольчик над полком';
  return 'бегает быстрее и держит удар веником';
}
