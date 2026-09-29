import { describe, expect, it } from 'vitest';
import { SECRET_REWARD } from './config';
import { SECRETS } from './data/secrets';
import { createSave } from './save';
import { findSecret, secretReward } from './secrets';

describe('пасхалки', () => {
  it('награда — только за первую находку', () => {
    const save = createSave();
    const coins = save.coins;
    const reward = findSecret(save, 'hut', 0);
    expect(reward).toBe(SECRET_REWARD.min);
    expect(save.coins).toBe(coins + SECRET_REWARD.min);
    expect(save.secrets).toEqual(['hut']);
    expect(findSecret(save, 'hut', 0)).toBeNull();
    expect(findSecret(save, 'нет-такой', 0)).toBeNull();
    expect(save.coins).toBe(coins + SECRET_REWARD.min);
  });

  it('награда растёт с доходом, но не меньше минимума', () => {
    expect(secretReward(0)).toBe(SECRET_REWARD.min);
    expect(secretReward(1000)).toBe(1000 * SECRET_REWARD.seconds);
  });

  it('у всех пасхалок разные id и есть надпись на кнопке', () => {
    expect(new Set(SECRETS.map((s) => s.id)).size).toBe(SECRETS.length);
    for (const secret of SECRETS) expect(secret.action.length).toBeGreaterThan(0);
  });
});
