import { describe, expect, it } from 'vitest';
import { BOT, NEIGHBORS, RIVALS } from './config';
import { t } from './i18n';
import { chaseSpeed, describeRivals, rivalLevel, rivalStats, stunOn } from './rivals';
import { createUpgradeLevels, broomStun } from './upgrades';

const [zhorik, timur] = NEIGHBORS;

describe('прокачка соседей', () => {
  it('уровень растёт с лучшим доходом игрока, соня отстаёт на уровень', () => {
    expect(rivalLevel(0)).toBe(1);
    expect(RIVALS.incomeSteps.map((step) => rivalLevel(step))).toEqual([2, 3, 4, 5]);
    expect(rivalLevel(RIVALS.incomeSteps[0] - 1)).toBe(1);
    expect(rivalLevel(1e12)).toBe(RIVALS.maxLevel);
    expect(rivalLevel(0, zhorik.levelOffset)).toBe(1);
    expect(rivalLevel(RIVALS.incomeSteps[1], zhorik.levelOffset)).toBe(2);
    expect(rivalLevel(RIVALS.incomeSteps[1], timur.levelOffset)).toBe(3);
  });

  it('на первом уровне сосед такой же, как раньше, дальше — сильнее', () => {
    const first = rivalStats(1, timur);
    expect(first).toMatchObject({ speed: 1, chaseEdge: BOT.chaseEdge, toughness: 0, windup: BOT.swingWindup, hitStun: BOT.hitStun, dog: false, bell: false });
    for (let level = 2; level <= RIVALS.maxLevel; level++) {
      const weaker = rivalStats(level - 1, timur);
      const stronger = rivalStats(level, timur);
      expect(stronger.speed).toBeGreaterThan(weaker.speed);
      expect(stronger.chaseEdge).toBeGreaterThan(weaker.chaseEdge);
      expect(stronger.toughness).toBeGreaterThan(weaker.toughness);
      expect(stronger.windup).toBeLessThan(weaker.windup);
      expect(stronger.sleepTime[1]).toBeLessThan(weaker.sleepTime[1]);
      expect(stronger.latchClosed[0]).toBeGreaterThan(weaker.latchClosed[0]);
    }
    expect(rivalStats(RIVALS.dogLevel - 1, timur).dog).toBe(false);
    expect(rivalStats(RIVALS.dogLevel, timur).dog).toBe(true);
    expect(rivalStats(RIVALS.bellLevel - 1, timur).bell).toBe(false);
    expect(rivalStats(RIVALS.bellLevel, timur).bell).toBe(true);
  });

  it('соня спит дольше и чаще качка', () => {
    const sleepy = rivalStats(3, zhorik);
    const athlete = rivalStats(3, timur);
    expect(sleepy.sleepTime[0]).toBeGreaterThan(athlete.sleepTime[0]);
    expect(sleepy.awakeTime[1]).toBeLessThan(athlete.awakeTime[1]);
  });

  it('закалка съедает часть оглушения, но прокачанный веник всё равно помогает', () => {
    const levels = createUpgradeLevels();
    const strong = rivalStats(RIVALS.maxLevel, timur);
    expect(stunOn(broomStun(levels), strong)).toBe(RIVALS.minStun);
    let previous = 0;
    for (let broom = 0; broom <= 4; broom++) {
      const stun = stunOn(broomStun({ ...levels, broom }), strong);
      expect(stun).toBeGreaterThanOrEqual(previous);
      previous = stun;
    }
    expect(previous).toBeGreaterThan(RIVALS.minStun);
  });

  it('игрок, прокачанный по доходу, оглушает соседа примерно одинаково на всех уровнях', () => {
    // сколько уровней веника обычно есть у игрока, когда соседи получают уровень 1…5
    const expectedBroom = [0, 1, 2, 3, 4];
    const stuns = expectedBroom.map((broom, i) => stunOn(broomStun({ ...createUpgradeLevels(), broom }), rivalStats(i + 1, timur)));
    for (const stun of stuns) {
      expect(stun).toBeGreaterThanOrEqual(1.3);
      expect(stun).toBeLessThanOrEqual(1.9);
    }
  });

  it('подсказка в окне прокачки называет уровни обоих соседей', () => {
    const text = describeRivals(RIVALS.incomeSteps[2]);
    expect(text).toContain(`${t.neighbors.zhorik.name} — ур. 3`);
    expect(text).toContain(`${t.neighbors.timur.name} — ур. 4`);
  });

  it('в погоне хозяин всегда быстрее вора, и чем выше уровень, тем заметнее', () => {
    const thief = 5;
    expect(chaseSpeed(thief, rivalStats(1, timur))).toBeGreaterThan(thief);
    expect(chaseSpeed(thief, rivalStats(5, timur)) - thief).toBeGreaterThan(chaseSpeed(thief, rivalStats(1, timur)) - thief + 1);
  });
});
