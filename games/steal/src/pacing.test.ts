import { beforeAll, describe, expect, it } from 'vitest';
import { OFFLINE, REBIRTH } from './config';
import { steadyIncome } from './economy';
import { formatClock, MILESTONES, PacingSim, PLAYERS, type Milestone } from './pacing';

// Темп прохождения по модели (pacing.ts): медиана вех по нескольким прохождениям с разным зерном.
// Таблица целиком — `npm run pacing`. Меняете баланс — смотрите, остался ли темп в рамках.

const SEEDS = Array.from({ length: 21 }, (_, i) => 101 + i * 7919);
const MINUTES = 90;

type Profile = keyof typeof PLAYERS;

/**
 * Целевой темп: когда игрок доходит до вехи, минуты игры [не раньше, не позже].
 * Легендарный (с треком из ТикТока) — в первой сессии; мифический — к концу первой длинной сессии
 * или во второй; первое перерождение у активного — в первой длинной сессии, у спокойного — во второй-третьей.
 */
const TARGETS: Record<Profile, Partial<Record<Milestone, readonly [number, number]>>> = {
  casual: { legendary: [12, 25], mythic: [30, 60], allSlots: [15, 30], income1k: [6, 16], income10k: [20, 45], rebirth1: [50, 90] },
  active: { legendary: [5, 15], mythic: [12, 35], allSlots: [8, 20], income1k: [3, 10], income10k: [10, 30], rebirth1: [25, 50] },
};

const LABELS: Record<Milestone, string> = {
  rare: 'редкий',
  epic: 'эпический',
  legendary: 'легендарный',
  mythic: 'мифический',
  gold: '«Голда»',
  allSlots: 'все 8 мест заняты',
  income100: 'доход 100/с',
  income1k: 'доход 1 000/с',
  income10k: 'доход 10 000/с',
  rebirth1: '1-е перерождение',
  rebirth2: '2-е перерождение',
  rebirth3: '3-е перерождение',
};

const median = (values: readonly number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/** Медиана вехи по прохождениям, секунды (Infinity — больше половины не дошли). */
const reached = (runs: readonly PacingSim[], m: Milestone) => median(runs.map((r) => r.milestones.get(m) ?? Infinity));

const runs = {} as Record<Profile, PacingSim[]>;

beforeAll(() => {
  for (const profile of Object.keys(PLAYERS) as Profile[]) {
    runs[profile] = SEEDS.map((seed) => new PacingSim(PLAYERS[profile], seed).run(MINUTES * 60));
  }
  // видно в `npm run pacing`; в обычном `npm test` вывод прошедших тестов скрыт
  const rows = MILESTONES.map((m) => `${LABELS[m].padEnd(18)} ${formatClock(finite(reached(runs.casual, m))).padStart(9)} ${formatClock(finite(reached(runs.active, m))).padStart(9)}`);
  console.log([`Темп, медиана по ${SEEDS.length} прохождениям (мин:с игры)`, `${''.padEnd(18)} ${'спокойный'.padStart(9)} ${'активный'.padStart(9)}`, ...rows].join('\n'));
});

const finite = (seconds: number) => (Number.isFinite(seconds) ? seconds : null);

describe('темп прохождения (модель)', () => {
  for (const profile of Object.keys(TARGETS) as Profile[]) {
    it(`${PLAYERS[profile].name} игрок доходит до вех в целевое время`, () => {
      for (const [m, [from, to]] of Object.entries(TARGETS[profile]) as [Milestone, readonly [number, number]][]) {
        const minutes = reached(runs[profile], m) / 60;
        expect(minutes, `${LABELS[m]}: ${minutes.toFixed(1)} мин, а цель ${from}–${to}`).toBeGreaterThanOrEqual(from);
        expect(minutes, `${LABELS[m]}: ${minutes.toFixed(1)} мин, а цель ${from}–${to}`).toBeLessThanOrEqual(to);
      }
    });
  }

  it('кто крадёт и открывает кейсы, растёт быстрее того, кто только покупает', () => {
    for (const m of ['legendary', 'mythic', 'income10k', 'rebirth1'] as const) {
      expect(reached(runs.active, m)).toBeLessThan(reached(runs.casual, m));
    }
  });

  it('каждое следующее перерождение даётся дольше, но не в разы', () => {
    const first = reached(runs.active, 'rebirth1');
    const second = reached(runs.active, 'rebirth2') - first;
    expect(second / 60).toBeGreaterThan(25);
    expect(second / first).toBeGreaterThan(0.8);
    expect(second / first).toBeLessThan(2);
  });

  it('когда соседи растут, у игрока, который качается по мере дохода, уже есть кроссовки и веник', () => {
    // так задумана сложность краж (rivals.test.ts): прокачка игрока поспевает за уровнем соседей
    for (const profile of Object.keys(PLAYERS) as Profile[]) {
      for (let level = 3; level <= 5; level++) {
        const levels = runs[profile].map((r) => r.rivalUpgrades.get(level)).filter((u) => u !== undefined);
        expect(levels.length).toBeGreaterThan(SEEDS.length / 2);
        expect(median(levels.map((u) => u.speed))).toBeGreaterThanOrEqual(level - 2);
        expect(median(levels.map((u) => u.broom))).toBeGreaterThanOrEqual(level - 2);
      }
    }
  });

  it('доход вне игры за ночь — подарок не больше доли монет, и перерождение без рекламы не приходит само', () => {
    const nights = SEEDS.map((seed) => {
      const sim = new PacingSim(PLAYERS.casual, seed).run(30 * 60);
      const coins = sim.save.coins;
      const income = steadyIncome(sim.save);
      const earned = sim.away(16 * 3600, false);
      return { coins, earned, minutes: earned / Math.max(1, income) / 60 };
    });
    for (const night of nights) expect(night.earned).toBeLessThanOrEqual(Math.floor(night.coins * OFFLINE.maxShare));
    // с рекламой вдвое больше — всё равно меньше часа активной игры
    expect(2 * median(nights.map((n) => n.minutes))).toBeLessThan(60);
    expect(median(nights.map((n) => n.earned))).toBeLessThan(REBIRTH.firstCost);
  });

  it('с тем же зерном модель повторяется', () => {
    const a = new PacingSim(PLAYERS.active, 7).run(15 * 60);
    const b = new PacingSim(PLAYERS.active, 7).run(15 * 60);
    expect([...a.milestones]).toEqual([...b.milestones]);
    expect(a.save.coins).toBe(b.save.coins);
  });
});
