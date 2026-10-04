import { describe, expect, it } from 'vitest';
import { LEVEL_REWARDS, SECRET_REWARD } from './config';
import { SECRETS } from './data/secrets';
import { shelfValue } from './economy';
import { createSave } from './save';
import { findSecret, secretReward } from './secrets';

describe('пасхалки', () => {
  it('награда — только за первую находку', () => {
    const save = createSave();
    const coins = save.coins;
    const reward = LEVEL_REWARDS.minShelf * SECRET_REWARD.share;
    expect(findSecret(save, 'hut')).toBe(reward);
    expect(save.coins).toBe(coins + reward);
    expect(save.secrets).toEqual(['hut']);
    expect(findSecret(save, 'hut')).toBeNull();
    expect(findSecret(save, 'нет-такой')).toBeNull();
    expect(save.coins).toBe(coins + reward);
  });

  it('награда — доля стоимости полки: растёт с уровнем игрока', () => {
    const save = createSave();
    save.slots[0] = { id: 'hamam', gold: false, stored: 0 };
    expect(secretReward(save)).toBe(Math.round(shelfValue(save) * SECRET_REWARD.share));
    expect(secretReward(save)).toBeLessThan(shelfValue(save));
  });

  it('у всех пасхалок разные id и есть надпись на кнопке', () => {
    expect(new Set(SECRETS.map((s) => s.id)).size).toBe(SECRETS.length);
    for (const secret of SECRETS) expect(secret.action.length).toBeGreaterThan(0);
  });
});
