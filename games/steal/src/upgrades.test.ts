import { describe, expect, it } from 'vitest';
import { BROOM, LOCK, UPGRADES } from './config';
import { createSave } from './save';
import {
  broomCooldown,
  broomStun,
  buyUpgrade,
  checkUpgrade,
  createUpgradeLevels,
  describeUpgrade,
  incomeMultiplier,
  latchDuration,
  maxLevel,
  speedMultiplier,
  UPGRADE_IDS,
  upgradeCost,
} from './upgrades';

describe('прокачка', () => {
  it('каждый следующий уровень дороже предыдущего', () => {
    for (const id of UPGRADE_IDS) {
      for (let level = 1; level < maxLevel(id); level++) {
        expect(upgradeCost(id, level)).toBeGreaterThan(upgradeCost(id, level - 1) ?? Infinity);
      }
      expect(upgradeCost(id, maxLevel(id))).toBeNull();
    }
  });

  it('покупка списывает монеты и поднимает уровень', () => {
    const save = createSave();
    save.coins = 1000;
    expect(buyUpgrade(save, 'speed')).toBe(true);
    expect(save.upgrades.speed).toBe(1);
    expect(save.coins).toBe(1000 - UPGRADES.speed.costs[0]);
  });

  it('без монет не покупается', () => {
    const save = createSave();
    save.coins = UPGRADES.stove.costs[0] - 1;
    expect(checkUpgrade(save, 'stove')).toEqual({ ok: false, reason: 'coins' });
    expect(buyUpgrade(save, 'stove')).toBe(false);
    expect(save.upgrades.stove).toBe(0);
    expect(save.coins).toBe(UPGRADES.stove.costs[0] - 1);
  });

  it('после последнего уровня покупать нечего', () => {
    const save = createSave();
    save.coins = 1e9;
    save.upgrades.latch = maxLevel('latch');
    expect(checkUpgrade(save, 'latch')).toEqual({ ok: false, reason: 'max' });
    expect(buyUpgrade(save, 'latch')).toBe(false);
  });

  it('без прокачки всё как в настройках', () => {
    const levels = createUpgradeLevels();
    expect(speedMultiplier(levels)).toBe(1);
    expect(incomeMultiplier(levels)).toBe(1);
    expect(broomStun(levels)).toBe(BROOM.stun);
    expect(broomCooldown(levels)).toBe(BROOM.cooldown);
    expect(latchDuration(levels)).toBe(LOCK.duration);
  });

  it('на последнем уровне веник всё ещё перезаряжается, а сосед не оглушён навсегда', () => {
    const levels = { ...createUpgradeLevels(), broom: maxLevel('broom') };
    expect(broomCooldown(levels)).toBeGreaterThan(1);
    expect(broomStun(levels)).toBeLessThan(4);
  });

  it('печь прибавляет доход', () => {
    expect(incomeMultiplier({ ...createUpgradeLevels(), stove: 3 })).toBeCloseTo(1 + 3 * UPGRADES.stove.perLevel);
  });

  it('понятные подписи для панели', () => {
    expect(describeUpgrade('speed', 0)).toBe('обычная скорость');
    expect(describeUpgrade('speed', 2)).toBe('скорость +16%');
    expect(describeUpgrade('broom', 1)).toBe('оглушает на 1,8 с, перезарядка 2,3 с');
    expect(describeUpgrade('latch', 1)).toBe(`закрывает баню на ${LOCK.duration + UPGRADES.latch.secondsPerLevel} с`);
    expect(describeUpgrade('stove', 5)).toBe('доход +50%');
  });
});
